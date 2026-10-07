"""
NeuroLearn IA — Reporte académico exportable del profesor.

Consulta datos reales y arma tres tipos de reporte:

    resumen       una fila por estudiante: quizzes adaptativos, evaluaciones,
                  progreso y nivel de riesgo
    quizzes       detalle de los quizzes adaptativos (sistema de quizzes del tutor)
    evaluaciones  resultado oficial (mejor intento) de cada estudiante en las
                  evaluaciones publicadas por el profesor

Alcance (aislamiento por institución):
    Profesor        sus aulas activas.
    Súper Profesor  las aulas activas de los profesores de su institución.

Los quizzes se asocian al ESTUDIANTE (igual que el Centro de Analítica,
GET /teacher/stats): son la práctica que el estudiante hace con el tutor.
Las evaluaciones se asocian al AULA donde se publicaron.

Fechas: el rango (AAAA-MM-DD) se interpreta en hora de Colombia (UTC-5).
"""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional, Sequence

from sqlalchemy.orm import Session

from app.models.classroom import Classroom, Enrollment
from app.models.evaluation import EvaluationSubmission, TeacherEvaluation
from app.models.institution import Institution
from app.models.learning import QuizHistory
from app.models.user import User, UserRole
from app.services import evaluation_service
from app.services.pdf_table import build_table_pdf

COLOMBIA_TZ = timezone(timedelta(hours=-5))
REPORT_KINDS = ("resumen", "quizzes", "evaluaciones")
RISK_LABELS = {"none": "Sin riesgo", "low": "Bajo", "medium": "Medio", "high": "Alto"}
EVAL_STATUS_LABELS = {"calificada": "Calificada", "pendiente_revision": "Por calificar"}


class ReportError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass
class Report:
    kind: str
    title: str
    meta: List[str]
    headers: List[str]
    rows: List[List[object]]
    col_weights: List[float]
    filename_base: str
    summary: Dict[str, object] = field(default_factory=dict)


# ── Utilidades ───────────────────────────────────────────────────────────────

def parse_day(value: Optional[str], label: str) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise ReportError(f"{label} inválida. Usa el formato AAAA-MM-DD.")


def _utc_bounds(start: Optional[date], end: Optional[date]):
    """Inicio y fin (exclusivo) en UTC naive para un rango de días de Colombia."""
    def to_utc(d: date) -> datetime:
        local = datetime(d.year, d.month, d.day, tzinfo=COLOMBIA_TZ)
        return local.astimezone(timezone.utc).replace(tzinfo=None)
    return (to_utc(start) if start else None, to_utc(end + timedelta(days=1)) if end else None)


def _local(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.replace(tzinfo=timezone.utc).astimezone(COLOMBIA_TZ).strftime("%Y-%m-%d %H:%M")


def _slug(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()[:40] or "grupo"


def _pct(value: Optional[float]) -> str:
    return "" if value is None else f"{value:.1f}"


# ── Alcance ──────────────────────────────────────────────────────────────────

def scope_classrooms(db: Session, user: User, classroom_id: Optional[int]) -> List[Classroom]:
    if user.role == UserRole.PROFESOR.value:
        query = db.query(Classroom).filter(Classroom.teacher_id == user.id)
    elif user.role == UserRole.SUPER_PROFESOR.value:
        if not user.institution_id:
            raise ReportError("Tu cuenta no está asociada a una institución.", 403)
        query = (
            db.query(Classroom)
            .join(User, User.id == Classroom.teacher_id)
            .filter(User.institution_id == user.institution_id)
        )
    else:
        raise ReportError("Solo profesores y súper profesores pueden exportar este reporte.", 403)

    query = query.filter(Classroom.is_active == True)  # noqa: E712
    if classroom_id is not None:
        classroom = query.filter(Classroom.id == classroom_id).first()
        if classroom is None:
            raise ReportError("El grupo no existe o no tienes acceso a él.", 404)
        return [classroom]
    return query.order_by(Classroom.name).all()


# ── Reportes ─────────────────────────────────────────────────────────────────

def build_report(db: Session, user: User, kind: str, classroom_id: Optional[int],
                 start: Optional[date], end: Optional[date]) -> Report:
    if kind not in REPORT_KINDS:
        raise ReportError("Tipo de reporte inválido. Usa resumen, quizzes o evaluaciones.")
    if start and end and start > end:
        raise ReportError("La fecha inicial no puede ser posterior a la final.")

    classrooms = scope_classrooms(db, user, classroom_id)
    if not classrooms:
        raise ReportError("No tienes grupos activos para generar el reporte.", 404)
    classroom_ids = [c.id for c in classrooms]
    names = {c.id: c.name for c in classrooms}

    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.classroom_id.in_(classroom_ids), Enrollment.is_active == True)  # noqa: E712
        .all()
    )
    student_ids = sorted({e.student_id for e in enrollments})
    students = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}
    groups_by_student: Dict[int, List[str]] = {}
    for e in enrollments:
        groups_by_student.setdefault(e.student_id, []).append(names[e.classroom_id])

    since, until = _utc_bounds(start, end)

    # Quizzes adaptativos completados de los estudiantes (misma base que /teacher/stats)
    quizzes: List[QuizHistory] = []
    if student_ids:
        q = db.query(QuizHistory).filter(
            QuizHistory.user_id.in_(student_ids),
            QuizHistory.performance_score.isnot(None),
        )
        if since:
            q = q.filter(QuizHistory.completed_at >= since)
        if until:
            q = q.filter(QuizHistory.completed_at < until)
        quizzes = q.order_by(QuizHistory.completed_at.desc()).all()

    # Evaluaciones publicadas o cerradas de los grupos
    evaluations = (
        db.query(TeacherEvaluation)
        .filter(
            TeacherEvaluation.classroom_id.in_(classroom_ids),
            TeacherEvaluation.status.in_(("publicada", "cerrada")),
        )
        .order_by(TeacherEvaluation.published_at)
        .all()
    )
    subs_by_eval_student: Dict[tuple, List[EvaluationSubmission]] = {}
    if evaluations:
        sq = db.query(EvaluationSubmission).filter(
            EvaluationSubmission.evaluation_id.in_([e.id for e in evaluations]),
            EvaluationSubmission.status != "en_curso",
        )
        if since:
            sq = sq.filter(EvaluationSubmission.submitted_at >= since)
        if until:
            sq = sq.filter(EvaluationSubmission.submitted_at < until)
        for sub in sq.all():
            subs_by_eval_student.setdefault((sub.evaluation_id, sub.student_id), []).append(sub)
    official = {
        key: evaluation_service.official_submission(subs)
        for key, subs in subs_by_eval_student.items()
    }

    # Metadatos comunes
    institution = db.query(Institution).filter(Institution.id == user.institution_id).first() \
        if user.institution_id else None
    scope_label = names[classroom_ids[0]] if classroom_id is not None else f"Todos ({len(classrooms)} grupos)"
    range_label = (
        f"{start.isoformat() if start else 'inicio'} a {end.isoformat() if end else 'hoy'}"
        if (start or end) else "Todo el periodo"
    )
    scored = [q.performance_score for q in quizzes if q.performance_score is not None]
    avg_quiz = sum(scored) / len(scored) if scored else None
    generated_at = datetime.now(COLOMBIA_TZ).strftime("%Y-%m-%d %H:%M")
    meta = [
        f"Institución: {institution.name if institution else '—'}",
        f"Generado por: {user.full_name or user.username} · {generated_at} (hora de Colombia)",
        f"Grupo: {scope_label}  ·  Periodo: {range_label}",
        f"Estudiantes: {len(student_ids)}  ·  Quizzes adaptativos: {len(quizzes)}  ·  "
        f"Promedio quizzes: {_pct(avg_quiz) or '—'}%  ·  Evaluaciones publicadas: {len(evaluations)}",
    ]
    file_scope = _slug(scope_label) if classroom_id is not None else "todos"
    file_range = (
        f"_{(start or date(2000, 1, 1)).strftime('%Y%m%d')}-{(end or date.today()).strftime('%Y%m%d')}"
        if (start or end) else ""
    )
    summary = {
        "students": len(student_ids),
        "groups": len(classrooms),
        "quizzes": len(quizzes),
        "avg_quiz_percentage": round(avg_quiz, 1) if avg_quiz is not None else None,
        "evaluations": len(evaluations),
        "generated_at": generated_at,
    }

    if kind == "quizzes":
        rows = []
        for q in quizzes:
            st = students.get(q.user_id)
            rows.append([
                _local(q.completed_at or q.created_at),
                st.full_name if st else q.user_id,
                st.username if st else "",
                ", ".join(groups_by_student.get(q.user_id, [])),
                q.topic or q.quiz_title or "",
                q.difficulty or "",
                q.questions_count or 0,
                q.correct_answers or 0,
                _pct(q.performance_score),
                round((q.time_spent_seconds or 0) / 60, 1),
            ])
        if not rows:
            raise ReportError("No hay quizzes completados con los filtros seleccionados.", 404)
        return Report(
            kind, "Reporte de quizzes adaptativos", meta,
            ["Fecha", "Estudiante", "Usuario", "Grupo(s)", "Competencia / tema", "Dificultad",
             "Preguntas", "Correctas", "Puntaje (%)", "Tiempo (min)"],
            rows, [1.3, 1.8, 1.1, 1.5, 2.6, 0.9, 0.8, 0.8, 0.9, 0.9],
            f"reporte_quizzes_{file_scope}{file_range}", summary,
        )

    if kind == "evaluaciones":
        rows = []
        for ev in evaluations:
            max_score = evaluation_service.max_score(ev.questions or [])
            for e in enrollments:
                if e.classroom_id != ev.classroom_id:
                    continue
                st = students.get(e.student_id)
                sub = official.get((ev.id, e.student_id))
                rows.append([
                    ev.title,
                    names[ev.classroom_id],
                    st.full_name if st else e.student_id,
                    st.username if st else "",
                    EVAL_STATUS_LABELS.get(sub.status, sub.status) if sub else "Sin entregar",
                    len(subs_by_eval_student.get((ev.id, e.student_id), [])),
                    "" if not sub or sub.status != "calificada" else f"{sub.score:g}",
                    f"{max_score:g}",
                    _pct(sub.percentage) if sub and sub.status == "calificada" else "",
                    _local(sub.submitted_at) if sub else "",
                ])
        if not rows:
            raise ReportError("No hay evaluaciones publicadas en los grupos seleccionados.", 404)
        return Report(
            kind, "Reporte de evaluaciones", meta,
            ["Evaluación", "Grupo", "Estudiante", "Usuario", "Estado", "Intentos",
             "Puntaje", "Puntaje máx.", "Nota (%)", "Entregada"],
            rows, [2.2, 1.4, 1.8, 1.1, 1.1, 0.7, 0.8, 0.9, 0.8, 1.3],
            f"reporte_evaluaciones_{file_scope}{file_range}", summary,
        )

    # resumen
    if not student_ids:
        raise ReportError("Los grupos seleccionados no tienen estudiantes inscritos.", 404)
    quizzes_by_student: Dict[int, List[QuizHistory]] = {}
    for q in quizzes:
        quizzes_by_student.setdefault(q.user_id, []).append(q)
    enrollment_by_student: Dict[int, List[Enrollment]] = {}
    for e in enrollments:
        enrollment_by_student.setdefault(e.student_id, []).append(e)

    rows = []
    for sid in sorted(student_ids, key=lambda i: (students[i].full_name or "").lower() if i in students else ""):
        st = students.get(sid)
        sq = quizzes_by_student.get(sid, [])
        s_scores = [q.performance_score for q in sq if q.performance_score is not None]
        own_classrooms = {e.classroom_id for e in enrollment_by_student.get(sid, [])}
        evs = [ev for ev in evaluations if ev.classroom_id in own_classrooms]
        graded = [official[(ev.id, sid)] for ev in evs
                  if official.get((ev.id, sid)) and official[(ev.id, sid)].status == "calificada"]
        delivered = [ev for ev in evs if official.get((ev.id, sid))]
        enr = enrollment_by_student.get(sid, [])
        risk_order = ["none", "low", "medium", "high"]
        risk = max((e.risk_level or "none" for e in enr), key=lambda r: risk_order.index(r) if r in risk_order else 0)
        last_activity = max((e.last_activity for e in enr if e.last_activity), default=None)
        last_quiz = max((q.completed_at for q in sq if q.completed_at), default=None)
        last = max([d for d in (last_activity, last_quiz) if d], default=None)
        progress = sum((e.overall_progress or 0) for e in enr) / len(enr) if enr else 0
        rows.append([
            st.full_name if st else sid,
            st.username if st else "",
            ", ".join(groups_by_student.get(sid, [])),
            len(sq),
            _pct(sum(s_scores) / len(s_scores)) if s_scores else "",
            f"{len(delivered)} / {len(evs)}",
            _pct(sum(g.percentage for g in graded) / len(graded)) if graded else "",
            _pct(progress),
            RISK_LABELS.get(risk, risk),
            _local(last),
        ])
    return Report(
        "resumen", "Reporte académico por estudiante", meta,
        ["Estudiante", "Usuario", "Grupo(s)", "Quizzes", "Prom. quizzes (%)",
         "Eval. entregadas", "Prom. evaluaciones (%)", "Progreso (%)", "Riesgo", "Última actividad"],
        rows, [2.0, 1.1, 1.7, 0.7, 1.2, 1.1, 1.5, 0.9, 0.8, 1.3],
        f"reporte_resumen_{file_scope}{file_range}", summary,
    )


# ── Formatos ─────────────────────────────────────────────────────────────────

def _csv_value(value: object) -> str:
    """Números con coma decimal (Excel en español); el resto como texto."""
    if isinstance(value, float):
        return f"{value:.1f}".replace(".", ",")
    text = str(value)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return text.replace(".", ",")
    return text


def to_csv(report: Report) -> bytes:
    """CSV UTF-8 con BOM y separador «;» (se abre bien en Excel configurado en español)."""
    buf = io.StringIO()
    writer = csv.writer(buf, delimiter=";", quoting=csv.QUOTE_MINIMAL, lineterminator="\r\n")
    writer.writerow([report.title])
    for line in report.meta:
        writer.writerow([line])
    writer.writerow([])
    writer.writerow(report.headers)
    for row in report.rows:
        writer.writerow([_csv_value(v) for v in row])
    return ("﻿" + buf.getvalue()).encode("utf-8")


def to_pdf(report: Report) -> bytes:
    rows: Sequence[Sequence[str]] = [[str(v) for v in row] for row in report.rows]
    return build_table_pdf(report.title, report.meta, report.headers, rows, report.col_weights,
                           generated_at=f"{report.summary.get('generated_at', '')} (hora de Colombia)")
