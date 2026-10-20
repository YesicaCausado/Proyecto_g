"""
NeuroLearn IA — Analítica institucional del Súper Profesor (módulo Reportes).

Todos los cálculos salen de registros reales de la base de datos y respetan el
aislamiento por institución (el alcance se calcula aquí, en el backend).

Fuentes de resultados académicos (ambas en la MISMA escala: % de aciertos 0-100)
    quiz        QuizHistory completados (performance_score). Práctica adaptativa
                que el estudiante hace con el tutor. Se asocian al ESTUDIANTE
                (igual que /teacher/stats y /teacher/reports/export), porque el
                sistema no guarda el aula del quiz (classroom_id llega vacío).
    evaluacion  Evaluaciones publicadas por los docentes. Se toma el resultado
                OFICIAL de cada estudiante en cada evaluación dentro del período
                (mejor intento calificado, evaluation_service.official_submission).
                Las entregas «pendiente_revision» no tienen nota final y no
                entran en los promedios (se reportan en Calidad de datos).

Competencia de cada resultado
    Se deriva del tema del quiz (el texto que envía el frontend, ver
    frontend/src/data/competencies.ts) o de la materia del aula donde se
    publicó la evaluación. Los resultados que no se pueden clasificar cuentan
    en el promedio general, pero no en el análisis por competencia.

Fórmulas
    Promedio (de un grupo, competencia, profesor o institución)
        = media de los promedios POR ESTUDIANTE. Cada estudiante pesa lo mismo,
        así quien presenta muchas evaluaciones no domina el resultado.
    Participación = estudiantes con ≥1 resultado / estudiantes del alcance × 100.
    Variación = promedio del período − promedio del período anterior de igual
        duración (en puntos porcentuales, pp). Solo con rango de fechas cerrado.
    Niveles de desempeño (PERFORMANCE_BANDS): escala de valoración del Decreto
        1290 de 2009 (Bajo, Básico, Alto, Superior) con los cortes habituales
        en escala 1-5 (3,0 · 4,0 · 4,6) convertidos a porcentaje.

Las ausencias de datos se devuelven como null, nunca como 0.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from statistics import mean
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from sqlalchemy.orm import Session, defer, load_only

from app.models.academic import FOLLOWUP_STATUSES, AcademicPeriod, FollowupCase, FollowupNote
from app.models.classroom import Classroom, Enrollment
from app.models.evaluation import EVALUATION_STATUSES, EvaluationSubmission, TeacherEvaluation
from app.models.institution import Institution
from app.models.learning import QuizHistory
from app.models.user import User, UserRole
from app.services import evaluation_service
from app.services.competencies import (  # noqa: F401  (re-exportados)
    COMP_KEYS, COMP_NAMES, COMPETENCIES, classify_competency, classroom_competency,
    evaluation_competency, quiz_competency,
)
from app.services.teacher_report_service import COLOMBIA_TZ, ReportError, _utc_bounds

# ── Configuración (criterios explícitos) ─────────────────────────────────────

# (clave, etiqueta, mínimo incluido, máximo excluido) en % de aciertos.
PERFORMANCE_BANDS = (
    ("bajo", "Bajo", 0.0, 60.0),
    ("basico", "Básico", 60.0, 80.0),
    ("alto", "Alto", 80.0, 92.0),
    ("superior", "Superior", 92.0, 100.0001),
)
REFERENCE_THRESHOLD = 60.0       # límite Bajo/Básico; umbral por defecto del seguimiento
MIN_STUDENTS_COMPARISON = 3      # estudiantes mínimos para comparar competencias / grupos
DEFAULT_MIN_RESULTS = 3          # resultados comparables mínimos para una regla de seguimiento
DECLINE_MIN_DROP = 10.0          # caída mínima (pp) para «descenso persistente»
OVERDUE_MIN = 2                  # evaluaciones vencidas sin entregar para seguimiento
INACTIVITY_MIN_DAYS = 14         # duración mínima del período para la regla de inactividad
RELATIVE_MARGIN = 5.0            # pp sobre/bajo la media de competencias para «relativamente alto/bajo»
TREND_MARGIN = 3.0               # pp de variación para hablar de mejora o descenso
SOURCES = ("todas", "quiz", "evaluacion")
SOURCE_LABELS = {"quiz": "Quiz adaptativo", "evaluacion": "Evaluación docente"}
EVAL_STATUS_LABELS = {"borrador": "Borrador", "publicada": "Publicada", "cerrada": "Cerrada"}

FOLLOWUP_RULES = (
    {
        "key": "bajo_desempeno", "label": "Bajo desempeño persistente", "category": "rendimiento",
        "definition": "El promedio de los últimos N resultados de una misma competencia es menor que el umbral.",
        "observation": "Período seleccionado",
        "min_data": "N resultados de la misma competencia (N configurable, 3 por defecto)",
    },
    {
        "key": "descenso", "label": "Descenso persistente", "category": "rendimiento",
        "definition": f"Los últimos N resultados de una misma competencia bajan uno tras otro y la caída total "
                      f"es de al menos {DECLINE_MIN_DROP:g} puntos porcentuales.",
        "observation": "Período seleccionado",
        "min_data": "N resultados de la misma competencia",
    },
    {
        "key": "vencidas", "label": "Evaluaciones vencidas sin entregar", "category": "actividad",
        "definition": f"Al menos {OVERDUE_MIN} evaluaciones publicadas en sus grupos vencieron "
                      f"(fecha límite) sin ninguna entrega del estudiante.",
        "observation": "Fechas límite dentro del período",
        "min_data": "Evaluaciones con fecha límite registrada",
    },
    {
        "key": "inactividad", "label": "Sin actividad evaluativa", "category": "actividad",
        "definition": "Estudiante inscrito en al menos un grupo sin ningún quiz ni evaluación calificada en el período.",
        "observation": f"Períodos de {INACTIVITY_MIN_DAYS} días o más",
        "min_data": "Inscripción activa en un grupo",
    },
)
RULE_LABELS = {r["key"]: r["label"] for r in FOLLOWUP_RULES}
RULE_CATEGORY = {r["key"]: r["category"] for r in FOLLOWUP_RULES}

RECOMMENDATIONS = {
    "matematicas": [
        "Retomar los conceptos base con ejemplos concretos antes de aumentar la dificultad.",
        "Proponer práctica guiada corta con retroalimentación inmediata (quizzes adaptativos).",
        "Pedir que el estudiante explique el procedimiento, no solo el resultado.",
    ],
    "lectora": [
        "Trabajar textos cortos con preguntas de idea principal, inferencia y propósito del autor.",
        "Modelar en voz alta cómo se identifican argumentos y evidencias en un texto.",
        "Aumentar progresivamente la extensión y complejidad de las lecturas.",
    ],
    "ingles": [
        "Reforzar vocabulario y estructuras de uso frecuente en contextos comunicativos.",
        "Combinar lectura y escucha con tareas breves y frecuentes.",
        "Usar el tutor en inglés para práctica de bajo riesgo con retroalimentación.",
    ],
    "ciudadanas": [
        "Analizar casos y situaciones reales que conecten los conceptos con el entorno del estudiante.",
        "Proponer discusiones guiadas sobre distintas perspectivas de un mismo problema.",
        "Revisar conceptos de la Constitución y la participación ciudadana con ejemplos cotidianos.",
    ],
    "cientifico": [
        "Plantear preguntas a partir de fenómenos observables antes de presentar la teoría.",
        "Practicar la lectura de tablas y gráficas de datos experimentales.",
        "Trabajar la formulación de hipótesis y conclusiones a partir de evidencia.",
    ],
    None: [
        "Revisar con el docente del grupo los temas de las evaluaciones con resultados bajos.",
        "Acordar un plan de refuerzo con metas cortas y verificables.",
    ],
}

METHODOLOGY_NOTES = [
    "Escala: todos los resultados se expresan en % de aciertos (0-100). Quizzes y evaluaciones ya usan esa escala; no hay conversión.",
    "Promedio: media de los promedios por estudiante (cada estudiante pesa lo mismo).",
    "Evaluaciones docentes: se usa el resultado oficial (mejor intento calificado). Las entregas por calificar no entran en los promedios.",
    "Quizzes adaptativos: práctica del estudiante con el tutor; se asocian al estudiante y a todos sus grupos.",
    "Competencia: la registrada en el quiz, la evaluación o el grupo; en registros anteriores se deduce del tema o de la materia (ver Calidad de datos).",
    "Grupos: cuentan las evaluaciones publicadas en el grupo y los quizzes de sus estudiantes en la competencia del grupo (todos, si el grupo es general).",
    "Niveles: Bajo < 60 %, Básico 60-79 %, Alto 80-91 %, Superior ≥ 92 % (escala del Decreto 1290 convertida de 1-5 a %).",
    "Variación: frente al período académico anterior, o al período anterior de igual duración si no hay períodos configurados (en puntos porcentuales, pp).",
    "El promedio de los estudiantes no mide por sí solo la calidad docente; debe leerse con el tamaño del grupo y la participación.",
    "Las alertas son observaciones académicas para revisión pedagógica, no diagnósticos.",
]

def _norm(text: Optional[str]) -> str:
    from app.services.competencies import norm
    return norm(text)


def band_of(pct: float) -> str:
    for key, _, lo, hi in PERFORMANCE_BANDS:
        if lo <= pct < hi:
            return key
    return PERFORMANCE_BANDS[-1][0]


def _r1(value: Optional[float]) -> Optional[float]:
    return None if value is None else round(float(value), 1)


def _iso(dt: Optional[datetime]) -> Optional[str]:
    return evaluation_service.iso(dt)


def _local_date(dt: datetime) -> date:
    return dt.replace(tzinfo=timezone.utc).astimezone(COLOMBIA_TZ).date()


def _local_text(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    return dt.replace(tzinfo=timezone.utc).astimezone(COLOMBIA_TZ).strftime("%Y-%m-%d %H:%M")


def _name(u: Optional[User]) -> str:
    if u is None:
        return "—"
    return u.full_name or u.username


# ── Filtros ──────────────────────────────────────────────────────────────────

@dataclass
class Filters:
    start: Optional[date] = None
    end: Optional[date] = None
    classroom_id: Optional[int] = None
    teacher_id: Optional[int] = None
    student_id: Optional[int] = None
    competency: Optional[str] = None
    source: str = "todas"
    eval_status: Optional[str] = None
    threshold: float = REFERENCE_THRESHOLD
    min_results: int = DEFAULT_MIN_RESULTS
    followup_status: Optional[str] = None
    period_id: Optional[int] = None
    period_name: Optional[str] = None
    previous_override: Optional[Tuple[date, date, str]] = None

    def validate(self) -> "Filters":
        if self.start and self.end and self.start > self.end:
            raise ReportError("La fecha inicial no puede ser posterior a la final.")
        if self.competency is not None and self.competency not in COMP_NAMES:
            raise ReportError("Competencia inválida.")
        if self.source not in SOURCES:
            raise ReportError("Fuente inválida. Usa todas, quiz o evaluacion.")
        if self.eval_status is not None and self.eval_status not in EVALUATION_STATUSES:
            raise ReportError("Estado de evaluación inválido.")
        if not (0 < self.threshold <= 100):
            raise ReportError("El umbral debe estar entre 1 y 100.")
        if not (2 <= self.min_results <= 10):
            raise ReportError("El número mínimo de resultados debe estar entre 2 y 10.")
        if self.followup_status is not None and self.followup_status not in FOLLOWUP_STATUSES:
            raise ReportError("Estado de seguimiento inválido.")
        return self

    def previous(self) -> Optional[Tuple[date, date]]:
        if self.previous_override:
            return self.previous_override[0], self.previous_override[1]
        if not (self.start and self.end):
            return None
        length = (self.end - self.start).days + 1
        return self.start - timedelta(days=length), self.start - timedelta(days=1)

    def period_label(self) -> str:
        if not (self.start or self.end):
            return "Todo el historial"
        if self.period_name:
            return f"{self.period_name} ({self.start.isoformat()} a {self.end.isoformat()})"
        return f"{self.start.isoformat() if self.start else 'inicio'} a {self.end.isoformat() if self.end else 'hoy'}"

    def period_days(self) -> Optional[int]:
        if not self.start:
            return None
        end = self.end or evaluation_service.today_colombia()
        return (end - self.start).days + 1


# ── Contexto de datos ────────────────────────────────────────────────────────

@dataclass
class Result:
    student_id: int
    competency: Optional[str]
    pct: float
    at: datetime
    source: str
    title: str
    ref_id: int
    classroom_id: Optional[int] = None
    score: Optional[float] = None
    max_score: Optional[float] = None
    seconds: Optional[int] = None
    attempts: int = 1
    explicit: bool = True          # competencia registrada (True) o deducida por palabras clave


@dataclass
class Context:
    user: User
    institution: Institution
    filters: Filters
    teachers: Dict[int, User]
    all_classrooms: Dict[int, Classroom]
    classrooms: Dict[int, Classroom]
    students: Dict[int, User]
    groups_by_student: Dict[int, List[int]]
    students_by_group: Dict[int, Set[int]]
    evaluations: List[TeacherEvaluation]
    results: List[Result]                 # período, fuente y competencia filtradas
    results_any_comp: List[Result]        # período y fuente (todas las competencias)
    prev_results: List[Result]
    has_previous: bool
    since: Optional[datetime]
    until: Optional[datetime]
    counts: Dict[str, int] = field(default_factory=dict)
    prev_counts: Dict[str, int] = field(default_factory=dict)
    generated_at: datetime = field(default_factory=datetime.utcnow)
    group_comp: Dict[int, Optional[str]] = field(default_factory=dict)


def institution_id_for(user: User) -> int:
    if user.role not in (UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value):
        raise ReportError("Acceso restringido al súper profesor.", 403)
    if not user.institution_id:
        raise ReportError("Tu cuenta no está asociada a una institución.", 403)
    return user.institution_id


def build_context(db: Session, user: User, filters: Filters) -> Context:
    filters.validate()
    inst_id = institution_id_for(user)
    institution = db.query(Institution).filter(Institution.id == inst_id).first()
    if institution is None:
        raise ReportError("Institución no encontrada.", 404)
    if filters.period_id is not None:
        apply_academic_period(db, inst_id, filters)

    all_classrooms = {
        c.id: c for c in (
            db.query(Classroom)
            .join(User, User.id == Classroom.teacher_id)
            .filter(User.institution_id == inst_id, Classroom.is_active == True)  # noqa: E712
            .order_by(Classroom.name)
            .all()
        )
    }
    owner_ids = {c.teacher_id for c in all_classrooms.values()}
    teachers = {
        u.id: u for u in db.query(User).filter(
            User.institution_id == inst_id,
            (User.role == UserRole.PROFESOR.value) | (User.id.in_(list(owner_ids) or [-1])),
        ).all()
    }

    if filters.classroom_id is not None and filters.classroom_id not in all_classrooms:
        raise ReportError("El grupo no existe o no pertenece a tu institución.", 404)
    if filters.teacher_id is not None and filters.teacher_id not in teachers:
        raise ReportError("El profesor no existe o no pertenece a tu institución.", 404)

    classrooms = {
        cid: c for cid, c in all_classrooms.items()
        if (filters.classroom_id is None or cid == filters.classroom_id)
        and (filters.teacher_id is None or c.teacher_id == filters.teacher_id)
    }

    inst_students = {
        u.id: u for u in db.query(User).filter(
            User.institution_id == inst_id,
            User.role == UserRole.ESTUDIANTE.value,
            User.is_active == True,  # noqa: E712
        ).all()
    }
    enrollments = (
        db.query(Enrollment.student_id, Enrollment.classroom_id)
        .filter(Enrollment.classroom_id.in_(list(all_classrooms) or [-1]), Enrollment.is_active == True)  # noqa: E712
        .all()
    ) if all_classrooms else []

    groups_by_student: Dict[int, List[int]] = {}
    students_by_group: Dict[int, Set[int]] = {}
    for sid, cid in enrollments:
        if sid not in inst_students:
            continue
        groups_by_student.setdefault(sid, []).append(cid)
        students_by_group.setdefault(cid, set()).add(sid)

    group_scoped = filters.classroom_id is not None or filters.teacher_id is not None
    if group_scoped:
        scope_ids = set().union(*[students_by_group.get(cid, set()) for cid in classrooms]) if classrooms else set()
    else:
        scope_ids = set(inst_students)
    if filters.student_id is not None:
        if filters.student_id not in scope_ids:
            raise ReportError("El estudiante no existe o no pertenece al alcance seleccionado.", 404)
        scope_ids = {filters.student_id}
    students = {sid: inst_students[sid] for sid in scope_ids}

    since, until = _utc_bounds(filters.start, filters.end)
    prev = filters.previous()
    prev_since, prev_until = _utc_bounds(*prev) if prev else (None, None)
    lo = prev_since if prev else since

    eval_classroom_ids = list(classrooms) if group_scoped else list(all_classrooms)
    evaluations = (
        db.query(TeacherEvaluation)
        .options(defer(TeacherEvaluation.questions))
        .filter(TeacherEvaluation.classroom_id.in_(eval_classroom_ids or [-1]))
        .order_by(TeacherEvaluation.created_at.desc())
        .all()
    )
    eval_by_id = {e.id: e for e in evaluations}
    eval_comp = {e.id: evaluation_competency(e, all_classrooms.get(e.classroom_id)) for e in evaluations}

    student_list = list(students) or [-1]

    def in_window(dt: Optional[datetime], a: Optional[datetime], b: Optional[datetime]) -> bool:
        return dt is not None and (a is None or dt >= a) and (b is None or dt < b)

    # Quizzes completados
    # Solo las columnas necesarias: quiz_history guarda el quiz completo en JSON.
    quiz_q = db.query(QuizHistory).options(load_only(
        QuizHistory.id, QuizHistory.user_id, QuizHistory.topic, QuizHistory.quiz_title,
        QuizHistory.performance_score, QuizHistory.completed_at, QuizHistory.correct_answers,
        QuizHistory.questions_count, QuizHistory.time_spent_seconds, QuizHistory.competency,
        QuizHistory.classroom_id,
    )).filter(
        QuizHistory.user_id.in_(student_list),
        QuizHistory.performance_score.isnot(None),
        QuizHistory.completed_at.isnot(None),
    )
    if lo:
        quiz_q = quiz_q.filter(QuizHistory.completed_at >= lo)
    if until:
        quiz_q = quiz_q.filter(QuizHistory.completed_at < until)
    quizzes = quiz_q.all()

    def quiz_result(q: QuizHistory) -> Result:
        comp, explicit = quiz_competency(q)
        return Result(
            student_id=q.user_id, competency=comp, explicit=explicit,
            pct=float(q.performance_score), at=q.completed_at, source="quiz",
            title=q.quiz_title or q.topic or "Quiz", ref_id=q.id,
            classroom_id=q.classroom_id if q.classroom_id in all_classrooms else None,
            score=float(q.correct_answers) if q.correct_answers is not None else None,
            max_score=float(q.questions_count) if q.questions_count else None,
            seconds=q.time_spent_seconds,
        )

    # Entregas de evaluaciones (enviadas)
    sub_q = db.query(EvaluationSubmission).options(load_only(
        EvaluationSubmission.id, EvaluationSubmission.evaluation_id, EvaluationSubmission.student_id,
        EvaluationSubmission.status, EvaluationSubmission.percentage, EvaluationSubmission.score,
        EvaluationSubmission.max_score, EvaluationSubmission.started_at, EvaluationSubmission.submitted_at,
    )).filter(
        EvaluationSubmission.evaluation_id.in_(list(eval_by_id) or [-1]),
        EvaluationSubmission.student_id.in_(student_list),
        EvaluationSubmission.status != "en_curso",
        EvaluationSubmission.submitted_at.isnot(None),
    )
    if lo:
        sub_q = sub_q.filter(EvaluationSubmission.submitted_at >= lo)
    if until:
        sub_q = sub_q.filter(EvaluationSubmission.submitted_at < until)
    submissions = sub_q.all()

    def eval_results(subs: Iterable[EvaluationSubmission]) -> Tuple[List[Result], int]:
        grouped: Dict[Tuple[int, int], List[EvaluationSubmission]] = {}
        for s in subs:
            grouped.setdefault((s.evaluation_id, s.student_id), []).append(s)
        out, pending = [], 0
        for (eid, sid), group in grouped.items():
            official = evaluation_service.official_submission(group)
            if official is None:
                continue
            if official.status != "calificada" or official.percentage is None:
                pending += 1
                continue
            ev = eval_by_id[eid]
            comp, explicit = eval_comp[eid]
            out.append(Result(
                student_id=sid, competency=comp, explicit=explicit,
                pct=float(official.percentage), at=official.submitted_at, source="evaluacion",
                title=ev.title, ref_id=ev.id, classroom_id=ev.classroom_id,
                score=official.score, max_score=official.max_score,
                seconds=int((official.submitted_at - official.started_at).total_seconds())
                if official.submitted_at and official.started_at else None,
                attempts=len(group),
            ))
        return out, pending

    cur_quizzes = [quiz_result(q) for q in quizzes if in_window(q.completed_at, since, until)]
    cur_evals, pending_review = eval_results(s for s in submissions if in_window(s.submitted_at, since, until))
    prev_quizzes = [quiz_result(q) for q in quizzes if prev and in_window(q.completed_at, prev_since, prev_until)]
    prev_evals, _ = eval_results(s for s in submissions if prev and in_window(s.submitted_at, prev_since, prev_until)) \
        if prev else ([], 0)

    def by_source(results: List[Result]) -> List[Result]:
        if filters.source == "todas":
            return results
        return [r for r in results if r.source == filters.source]

    def by_comp(results: List[Result]) -> List[Result]:
        if filters.competency is None:
            return results
        return [r for r in results if r.competency == filters.competency]

    current_any = sorted(by_source(cur_quizzes + cur_evals), key=lambda r: r.at)
    previous = sorted(by_comp(by_source(prev_quizzes + prev_evals)), key=lambda r: r.at)

    # Conteos de actividad (todas las entregas, no solo la oficial)
    def activity_counts(a: Optional[datetime], b: Optional[datetime]) -> Dict[str, int]:
        completed_quizzes = sum(1 for q in quizzes if in_window(q.completed_at, a, b))
        completed_subs = sum(1 for s in submissions if in_window(s.submitted_at, a, b))
        return {"completed_quizzes": completed_quizzes, "completed_submissions": completed_subs}

    counts = activity_counts(since, until)
    prev_counts = activity_counts(prev_since, prev_until) if prev else {}

    open_q = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.evaluation_id.in_(list(eval_by_id) or [-1]),
        EvaluationSubmission.student_id.in_(student_list),
        EvaluationSubmission.status == "en_curso",
    )
    pending_quiz_q = db.query(QuizHistory).filter(
        QuizHistory.user_id.in_(student_list),
        QuizHistory.completed_at.is_(None),
    )
    if since:
        open_q = open_q.filter(EvaluationSubmission.started_at >= since)
        pending_quiz_q = pending_quiz_q.filter(QuizHistory.created_at >= since)
    if until:
        open_q = open_q.filter(EvaluationSubmission.started_at < until)
        pending_quiz_q = pending_quiz_q.filter(QuizHistory.created_at < until)
    counts["open_submissions"] = open_q.count() if filters.source in ("todas", "evaluacion") else 0
    counts["pending_quizzes"] = pending_quiz_q.count() if filters.source in ("todas", "quiz") else 0
    counts["pending_review"] = pending_review if filters.source in ("todas", "evaluacion") else 0
    drop = {"quiz": "completed_submissions", "evaluacion": "completed_quizzes"}.get(filters.source)
    if drop:
        counts[drop] = 0
        if prev:
            prev_counts[drop] = 0

    return Context(
        user=user, institution=institution, filters=filters, teachers=teachers,
        all_classrooms=all_classrooms, classrooms=classrooms, students=students,
        groups_by_student=groups_by_student, students_by_group=students_by_group,
        evaluations=evaluations, results=by_comp(current_any), results_any_comp=current_any,
        prev_results=previous, has_previous=prev is not None, since=since, until=until,
        counts=counts, prev_counts=prev_counts,
        group_comp={cid: classroom_competency(c) for cid, c in all_classrooms.items()},
    )


# ── Agregados ────────────────────────────────────────────────────────────────

def student_means(results: Iterable[Result]) -> Dict[int, float]:
    acc: Dict[int, List[float]] = {}
    for r in results:
        acc.setdefault(r.student_id, []).append(r.pct)
    return {sid: mean(vals) for sid, vals in acc.items()}


def aggregate(results: Sequence[Result]) -> dict:
    means = student_means(results)
    return {
        "average": _r1(mean(means.values())) if means else None,
        "students": len(means),
        "results": len(results),
    }


def _delta(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
    if cur is None or prev is None:
        return None
    return round(cur - prev, 1)


def distribution(results: Sequence[Result]) -> List[dict]:
    means = student_means(results)
    total = len(means)
    out = []
    for key, label, lo, hi in PERFORMANCE_BANDS:
        n = sum(1 for v in means.values() if band_of(v) == key)
        out.append({
            "key": key, "label": label, "min": lo, "max": min(hi, 100.0),
            "students": n, "pct": _r1(n / total * 100) if total else None,
        })
    return out


def competency_rows(ctx: Context, results: Optional[Sequence[Result]] = None,
                    prev_results: Optional[Sequence[Result]] = None) -> List[dict]:
    results = ctx.results_any_comp if results is None else results
    prev_results = ctx.prev_results if prev_results is None else prev_results
    rows = []
    for key, name in COMPETENCIES:
        if ctx.filters.competency and key != ctx.filters.competency:
            continue
        cur = aggregate([r for r in results if r.competency == key])
        prev = aggregate([r for r in prev_results if r.competency == key])
        rows.append({
            "key": key, "name": name, **cur,
            "previous_average": prev["average"] if ctx.has_previous else None,
            "change": _delta(cur["average"], prev["average"]) if ctx.has_previous else None,
            "sufficient": cur["students"] >= MIN_STUDENTS_COMPARISON,
        })
    return rows


def _best_worst(rows: Sequence[dict], min_students: int = MIN_STUDENTS_COMPARISON):
    valid = [r for r in rows if r["average"] is not None and r["students"] >= min_students]
    if len(valid) < 2:
        return None, None
    best = max(valid, key=lambda r: r["average"])
    worst = min(valid, key=lambda r: r["average"])
    return best, worst


def interpretation(rows: Sequence[dict], has_previous: bool) -> List[dict]:
    """Conclusiones por reglas transparentes (sin IA, sin causalidades)."""
    out: List[dict] = []
    valid = [r for r in rows if r["sufficient"] and r["average"] is not None]
    if len(valid) >= 2:
        ref = mean(r["average"] for r in valid)
        for r in valid:
            if r["average"] >= ref + RELATIVE_MARGIN:
                out.append({"type": "alta", "competency": r["key"],
                            "text": f"{r['name']}: {r['average']:.1f} %, {r['average'] - ref:.1f} pp sobre la media "
                                    f"de las competencias evaluadas ({ref:.1f} %)."})
            elif r["average"] <= ref - RELATIVE_MARGIN:
                out.append({"type": "baja", "competency": r["key"],
                            "text": f"{r['name']}: {r['average']:.1f} %, {ref - r['average']:.1f} pp bajo la media "
                                    f"de las competencias evaluadas ({ref:.1f} %). Puede requerir revisión pedagógica."})
    for r in rows:
        if r["results"] == 0:
            out.append({"type": "sin_datos", "competency": r["key"],
                        "text": f"{r['name']}: sin resultados en el período."})
            continue
        if not r["sufficient"]:
            out.append({"type": "insuficiente", "competency": r["key"],
                        "text": f"{r['name']}: solo {r['students']} estudiante(s) evaluado(s); se necesitan al menos "
                                f"{MIN_STUDENTS_COMPARISON} para comparar."})
        if r.get("change") is not None and r["sufficient"]:
            if r["change"] >= TREND_MARGIN:
                out.append({"type": "mejora", "competency": r["key"],
                            "text": f"{r['name']}: sube {r['change']:.1f} pp frente al período anterior."})
            elif r["change"] <= -TREND_MARGIN:
                out.append({"type": "descenso", "competency": r["key"],
                            "text": f"{r['name']}: baja {abs(r['change']):.1f} pp frente al período anterior."})
        elif has_previous and r["sufficient"] and r.get("previous_average") is None:
            out.append({"type": "insuficiente", "competency": r["key"],
                        "text": f"{r['name']}: sin datos en el período anterior; aún no hay tendencia."})
    return out


def _results_index(results: Iterable[Result]):
    by_student: Dict[int, List[Result]] = {}
    evals_by_group: Dict[int, List[Result]] = {}
    for r in results:
        by_student.setdefault(r.student_id, []).append(r)
        if r.source == "evaluacion" and r.classroom_id is not None:
            evals_by_group.setdefault(r.classroom_id, []).append(r)
    return by_student, evals_by_group


def _group_results(gid: int, members: Set[int], by_student, evals_by_group) -> List[Result]:
    """Evaluaciones publicadas en el grupo + quizzes de sus estudiantes."""
    out = [r for r in evals_by_group.get(gid, []) if r.student_id in members]
    for sid in members:
        out.extend(r for r in by_student.get(sid, []) if r.source == "quiz")
    return out


def group_rows(ctx: Context) -> List[dict]:
    cur_s, cur_g = _results_index(ctx.results)
    prev_s, prev_g = _results_index(ctx.prev_results)
    rows = []
    for gid, c in ctx.classrooms.items():
        members = ctx.students_by_group.get(gid, set()) & set(ctx.students)
        res = _group_results(gid, members, cur_s, cur_g)
        prev = _group_results(gid, members, prev_s, prev_g)
        agg = aggregate(res)
        comp = [dict(key=k, name=n, **aggregate([r for r in res if r.competency == k])) for k, n in COMPETENCIES]
        best, worst = _best_worst(comp, min_students=1)
        prev_avg = aggregate(prev)["average"]
        teacher = ctx.teachers.get(c.teacher_id)
        rows.append({
            "id": gid, "name": c.name, "grade": c.grade or "", "subject": c.subject or "",
            "competency": classify_competency(c.subject),
            "teacher": {"id": c.teacher_id, "name": _name(teacher)} if teacher else None,
            "enrolled": len(members), "evaluated": agg["students"],
            "participation": _r1(agg["students"] / len(members) * 100) if members else None,
            "average": agg["average"], "results": agg["results"],
            "best_competency": {"key": best["key"], "name": best["name"], "average": best["average"]} if best else None,
            "worst_competency": {"key": worst["key"], "name": worst["name"], "average": worst["average"]} if worst else None,
            "change": _delta(agg["average"], prev_avg) if ctx.has_previous else None,
            "small_sample": agg["students"] < MIN_STUDENTS_COMPARISON,
        })
    return rows


def teacher_rows(ctx: Context) -> List[dict]:
    cur_s, cur_g = _results_index(ctx.results)
    evals_by_teacher: Dict[int, List[TeacherEvaluation]] = {}
    for ev in ctx.evaluations:
        if ev.classroom_id in ctx.classrooms:
            evals_by_teacher.setdefault(ev.teacher_id, []).append(ev)
    completed_by_eval: Dict[int, int] = {}
    for r in ctx.results:
        if r.source == "evaluacion":
            completed_by_eval[r.ref_id] = completed_by_eval.get(r.ref_id, 0) + 1

    group_filtered = ctx.filters.classroom_id is not None or ctx.filters.teacher_id is not None
    rows = []
    for tid, t in sorted(ctx.teachers.items(), key=lambda kv: _norm(_name(kv[1]))):
        groups = [c for c in ctx.classrooms.values() if c.teacher_id == tid]
        if tid != ctx.filters.teacher_id and not groups and (
                group_filtered or t.role != UserRole.PROFESOR.value or not t.is_active):
            continue
        members: Set[int] = set()
        seen: Set[int] = set()
        res: List[Result] = []
        for c in groups:
            m = ctx.students_by_group.get(c.id, set()) & set(ctx.students)
            members |= m
            for r in _group_results(c.id, m, cur_s, cur_g):
                if id(r) not in seen:
                    seen.add(id(r))
                    res.append(r)
        agg = aggregate(res)
        comp = [dict(key=k, name=n, **aggregate([r for r in res if r.competency == k])) for k, n in COMPETENCIES]
        _, worst = _best_worst(comp, min_students=1)
        evs = evals_by_teacher.get(tid, [])
        published = [e for e in evs if e.status in ("publicada", "cerrada")
                     and _active_in_period(e, ctx.since, ctx.until)]
        last_candidates = [r.at for r in res] + [d for e in evs for d in (e.created_at, e.published_at) if d]
        rows.append({
            "id": tid, "name": _name(t), "subject_area": t.subject_area or "",
            "groups": len(groups), "group_names": [c.name for c in groups],
            "students": len(members), "evaluated": agg["students"],
            "participation": _r1(agg["students"] / len(members) * 100) if members else None,
            "evaluations_published": len(published),
            "evaluations_completed": sum(completed_by_eval.get(e.id, 0) for e in evs),
            "average": agg["average"], "results": agg["results"],
            "worst_competency": {"key": worst["key"], "name": worst["name"], "average": worst["average"]} if worst else None,
            "last_activity": _iso(max(last_candidates)) if last_candidates else None,
            "small_sample": agg["students"] < MIN_STUDENTS_COMPARISON,
        })
    return rows


def _active_in_period(ev: TeacherEvaluation, since: Optional[datetime], until: Optional[datetime]) -> bool:
    if ev.status == "borrador":
        start = ev.created_at
        return start is not None and (since is None or start >= since) and (until is None or start < until)
    start = ev.published_at or ev.created_at
    if until is not None and start is not None and start >= until:
        return False
    if since is not None and ev.closed_at is not None and ev.closed_at < since:
        return False
    return True


# ── Evolución temporal ───────────────────────────────────────────────────────

def _granularity(start: date, end: date) -> str:
    days = (end - start).days + 1
    if days <= 14:
        return "day"
    if days <= 120:
        return "week"
    return "month"


def _bucket_start(d: date, gran: str) -> date:
    if gran == "day":
        return d
    if gran == "week":
        return d - timedelta(days=d.weekday())
    return d.replace(day=1)


def _next_bucket(d: date, gran: str) -> date:
    if gran == "day":
        return d + timedelta(days=1)
    if gran == "week":
        return d + timedelta(days=7)
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1)


_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]


def _bucket_label(d: date, gran: str) -> str:
    if gran == "month":
        return f"{_MONTHS[d.month - 1]} {d.year}"
    if gran == "week":
        return f"Sem. {d.day} {_MONTHS[d.month - 1]}"
    return f"{d.day} {_MONTHS[d.month - 1]}"


def evolution(ctx: Context, results: Optional[Sequence[Result]] = None) -> dict:
    results = ctx.results_any_comp if results is None else results
    if ctx.filters.competency:
        results = [r for r in results if r.competency == ctx.filters.competency]
    today = evaluation_service.today_colombia()
    end = min(ctx.filters.end or today, today)
    if ctx.filters.start:
        start = ctx.filters.start
    elif results:
        start = min(_local_date(r.at) for r in results)
    else:
        return {"granularity": None, "buckets": [], "series": [], "table": []}
    if start > end:
        start = end
    gran = _granularity(start, end)
    starts: List[date] = []
    d = _bucket_start(start, gran)
    while d <= end and len(starts) < 400:
        starts.append(d)
        d = _next_bucket(d, gran)
    keys = [s.isoformat() for s in starts]
    buckets = [{"key": k, "label": _bucket_label(s, gran)} for k, s in zip(keys, starts)]

    per_bucket: Dict[str, List[Result]] = {k: [] for k in keys}
    for r in results:
        k = _bucket_start(_local_date(r.at), gran).isoformat()
        if k in per_bucket:
            per_bucket[k].append(r)

    series = []
    table = []
    lines = [("general", "Indicador general (todas las competencias)")] + [
        (k, n) for k, n in COMPETENCIES if not ctx.filters.competency or k == ctx.filters.competency]
    for key, name in lines:
        points = []
        prev_avg = None
        for b in buckets:
            rs = per_bucket[b["key"]] if key == "general" else [r for r in per_bucket[b["key"]] if r.competency == key]
            agg = aggregate(rs)
            change = _delta(agg["average"], prev_avg)
            points.append({"bucket": b["key"], **agg, "change": change})
            if agg["average"] is not None:
                prev_avg = agg["average"]
                table.append({"period": b["label"], "bucket": b["key"], "competency": key, "competency_name": name,
                              **agg, "change": change})
        if any(p["average"] is not None for p in points):
            series.append({"key": key, "name": name, "points": points})
    return {"granularity": gran, "buckets": buckets, "series": series, "table": table}


# ── Seguimiento académico ────────────────────────────────────────────────────

def followup_cases(ctx: Context, db: Session) -> List[dict]:
    f = ctx.filters
    n = f.min_results
    cases: List[dict] = []
    by_pair: Dict[Tuple[int, Optional[str]], List[Result]] = {}
    for r in ctx.results:
        if r.competency is not None:
            by_pair.setdefault((r.student_id, r.competency), []).append(r)

    def group_names(sid: int) -> List[str]:
        return [ctx.all_classrooms[c].name for c in ctx.groups_by_student.get(sid, []) if c in ctx.all_classrooms]

    def evidence(rs: Sequence[Result]) -> List[dict]:
        return [{"date": _iso(r.at), "title": r.title, "source": r.source,
                 "source_label": SOURCE_LABELS[r.source], "pct": _r1(r.pct)} for r in rs]

    def base(sid: int, comp: Optional[str], rule: str) -> dict:
        st = ctx.students.get(sid)
        return {
            "id": f"{rule}-{sid}-{comp or 'general'}",
            "student": {"id": sid, "name": _name(st), "username": st.username if st else ""},
            "groups": group_names(sid), "competency": comp,
            "competency_name": COMP_NAMES.get(comp, "Varias / general") if comp else "Varias / general",
            "rule": rule, "rule_label": RULE_LABELS[rule], "category": RULE_CATEGORY[rule],
            "recommendations": RECOMMENDATIONS.get(comp, RECOMMENDATIONS[None]),
        }

    for (sid, comp), rs in by_pair.items():
        rs = sorted(rs, key=lambda r: r.at)
        all_ev = evidence(rs)
        if len(rs) < n:
            continue
        last = rs[-n:]
        avg_last = mean(r.pct for r in last)
        evo = {"first": _r1(rs[0].pct), "last": _r1(rs[-1].pct), "change": _r1(rs[-1].pct - rs[0].pct),
               "results": len(rs)}
        missing = []
        if len(rs) < n + 2:
            missing.append("Pocos resultados: más evaluaciones de esta competencia darían una observación más sólida.")
        if len({r.source for r in rs}) == 1:
            missing.append(f"Todos los resultados provienen de una sola fuente ({SOURCE_LABELS[rs[0].source]}).")
        if avg_last < f.threshold:
            cases.append({**base(sid, comp, "bajo_desempeno"),
                          "reason": f"Promedio de sus últimos {n} resultados en {COMP_NAMES[comp]}: {avg_last:.1f} % "
                                    f"(umbral {f.threshold:g} %).",
                          "evidence": all_ev, "considered": evidence(last), "detected_at": _iso(rs[-1].at),
                          "evolution": evo, "missing": missing})
        drops = all(last[i].pct > last[i + 1].pct for i in range(len(last) - 1))
        if drops and last[0].pct - last[-1].pct >= DECLINE_MIN_DROP:
            cases.append({**base(sid, comp, "descenso"),
                          "reason": f"Sus últimos {n} resultados en {COMP_NAMES[comp]} bajan de {last[0].pct:.1f} % "
                                    f"a {last[-1].pct:.1f} % ({last[0].pct - last[-1].pct:.1f} pp).",
                          "evidence": all_ev, "considered": evidence(last), "detected_at": _iso(rs[-1].at),
                          "evolution": evo, "missing": missing})

    # Evaluaciones vencidas sin entregar (no depende de la competencia filtrada salvo coincidencia)
    if f.source in ("todas", "evaluacion"):
        now = datetime.utcnow()
        overdue_evals = []
        for ev in ctx.evaluations:
            if ev.status not in ("publicada", "cerrada") or ev.classroom_id not in ctx.classrooms:
                continue
            limit = evaluation_service.deadline_utc(ev)
            if limit is None or limit >= now:
                continue
            if (ctx.since and limit < ctx.since) or (ctx.until and limit >= ctx.until):
                continue
            classroom = ctx.all_classrooms[ev.classroom_id]
            comp = classify_competency(classroom.subject, ev.title)
            if f.competency and comp != f.competency:
                continue
            overdue_evals.append((ev, limit, comp))
        if overdue_evals:
            delivered = set(
                db.query(EvaluationSubmission.evaluation_id, EvaluationSubmission.student_id)
                .filter(EvaluationSubmission.evaluation_id.in_([e.id for e, _, _ in overdue_evals]))
                .distinct().all()
            )
            missed: Dict[int, List[Tuple[TeacherEvaluation, datetime, Optional[str]]]] = {}
            for ev, limit, comp in overdue_evals:
                for sid in ctx.students_by_group.get(ev.classroom_id, set()) & set(ctx.students):
                    if (ev.id, sid) not in delivered:
                        missed.setdefault(sid, []).append((ev, limit, comp))
            for sid, items in missed.items():
                if len(items) < OVERDUE_MIN:
                    continue
                comps = {c for _, _, c in items}
                comp = comps.pop() if len(comps) == 1 else None
                items.sort(key=lambda t: t[1])
                cases.append({**base(sid, comp, "vencidas"),
                              "reason": f"{len(items)} evaluaciones vencieron sin ninguna entrega.",
                              "evidence": [{"date": _iso(lim), "title": ev.title, "source": "evaluacion",
                                            "source_label": "Fecha límite vencida", "pct": None}
                                           for ev, lim, _ in items],
                              "considered": [], "detected_at": _iso(items[-1][1]), "evolution": None,
                              "missing": ["No se sabe si hubo una causa justificada (ausencia, problemas de acceso)."]})

    # Inactividad
    days = f.period_days()
    if days is not None and days >= INACTIVITY_MIN_DAYS and f.competency is None:
        active = {r.student_id for r in ctx.results_any_comp}
        scope_groups = set(ctx.classrooms)
        for sid in ctx.students:
            if sid in active:
                continue
            if not any(g in scope_groups for g in ctx.groups_by_student.get(sid, [])):
                continue
            cases.append({**base(sid, None, "inactividad"),
                          "reason": f"Sin quizzes ni evaluaciones calificadas en los {days} días del período.",
                          "evidence": [], "considered": [], "detected_at": _iso(ctx.until or datetime.utcnow()),
                          "evolution": None,
                          "missing": ["La inactividad no indica bajo rendimiento; conviene verificar acceso y asistencia."]})

    order = {"bajo_desempeno": 0, "descenso": 1, "vencidas": 2, "inactividad": 3}
    cases.sort(key=lambda c: (order[c["rule"]], _norm(c["student"]["name"])))
    return cases


# ── Calidad y cobertura ──────────────────────────────────────────────────────

def data_quality(ctx: Context, comps: Sequence[dict]) -> dict:
    evaluated = {r.student_id for r in ctx.results_any_comp}
    unclassified = sum(1 for r in ctx.results_any_comp if r.competency is None)
    without_group = sum(1 for sid in ctx.students if not ctx.groups_by_student.get(sid))
    latest = max((r.at for r in ctx.results_any_comp), default=None)
    warnings = []
    today = evaluation_service.today_colombia()
    if ctx.filters.end is None or ctx.filters.end >= today:
        warnings.append("El período incluye el día de hoy: los datos pueden seguir cambiando.")
    small = [c["name"] for c in comps if 0 < c["students"] < MIN_STUDENTS_COMPARISON]
    if small:
        warnings.append("Muestras pequeñas (menos de "
                        f"{MIN_STUDENTS_COMPARISON} estudiantes): {', '.join(small)}.")
    if not ctx.results_any_comp:
        warnings.append("No hay resultados en el período con los filtros aplicados.")
    if ctx.counts.get("pending_review"):
        warnings.append(f"{ctx.counts['pending_review']} resultado(s) de evaluaciones esperan calificación "
                        "del docente y no cuentan en los promedios.")
    if unclassified:
        warnings.append(f"{unclassified} resultado(s) no se pudieron asociar a una competencia "
                        "(cuentan solo en el promedio general).")
    if ctx.filters.source == "todas" and {r.source for r in ctx.results_any_comp} == {"quiz", "evaluacion"}:
        warnings.append("Se combinan quizzes adaptativos y evaluaciones docentes: son instrumentos distintos "
                        "con la misma escala (% de aciertos). Usa el filtro de fuente para analizarlos por separado.")
    if not ctx.has_previous:
        warnings.append("Sin rango de fechas cerrado no se calcula la comparación con el período anterior.")
    return {
        "registered_students": len(ctx.students),
        "students_with_results": len(evaluated),
        "students_without_results": len(ctx.students) - len(evaluated),
        "students_without_group": without_group,
        "competencies_with_data": [c["name"] for c in comps if c["results"]],
        "competencies_without_data": [c["name"] for c in comps if not c["results"]],
        "graded_results": sum(1 for r in ctx.results_any_comp if r.source == "evaluacion"),
        "quiz_results": sum(1 for r in ctx.results_any_comp if r.source == "quiz"),
        "pending_review": ctx.counts.get("pending_review", 0),
        "open_submissions": ctx.counts.get("open_submissions", 0),
        "pending_quizzes": ctx.counts.get("pending_quizzes", 0),
        "unclassified_results": unclassified,
        "latest_record": _iso(latest),
        "warnings": warnings,
    }


# ── Respuestas de la API ─────────────────────────────────────────────────────

def meta(ctx: Context) -> dict:
    f = ctx.filters
    prev = f.previous()
    classroom = ctx.all_classrooms.get(f.classroom_id) if f.classroom_id else None
    return {
        "institution": {"id": ctx.institution.id, "name": ctx.institution.name, "dane_code": ctx.institution.dane_code},
        "generated_at": _iso(ctx.generated_at),
        "period": {"start": f.start.isoformat() if f.start else None, "end": f.end.isoformat() if f.end else None,
                   "label": f.period_label()},
        "previous_period": {"start": prev[0].isoformat(), "end": prev[1].isoformat()} if prev else None,
        "filters": {
            "classroom": classroom.name if classroom else None,
            "teacher": _name(ctx.teachers.get(f.teacher_id)) if f.teacher_id else None,
            "student": _name(ctx.students.get(f.student_id)) if f.student_id else None,
            "competency": COMP_NAMES.get(f.competency) if f.competency else None,
            "source": f.source, "threshold": f.threshold, "min_results": f.min_results,
        },
        "scale": "Porcentaje de aciertos (0-100)",
        "bands": [{"key": k, "label": l, "min": lo, "max": min(hi, 100.0)} for k, l, lo, hi in PERFORMANCE_BANDS],
        "reference_threshold": REFERENCE_THRESHOLD,
        "min_students_comparison": MIN_STUDENTS_COMPARISON,
        "methodology": METHODOLOGY_NOTES,
    }


def summary_cards(ctx: Context, comps: Sequence[dict], cases: Sequence[dict]) -> dict:
    cur = aggregate(ctx.results)
    prev = aggregate(ctx.prev_results)
    registered = len(ctx.students)
    prev_evaluated = prev["students"]
    best, worst = _best_worst(comps)
    completed = ctx.counts["completed_quizzes"] + ctx.counts["completed_submissions"]
    prev_completed = (ctx.prev_counts.get("completed_quizzes", 0) + ctx.prev_counts.get("completed_submissions", 0)) \
        if ctx.has_previous else None
    perf_students = {c["student"]["id"] for c in cases if c["category"] == "rendimiento"}
    act_students = {c["student"]["id"] for c in cases if c["category"] == "actividad"} - perf_students
    return {
        "evaluated_students": {
            "evaluated": cur["students"], "registered": registered,
            "participation": _r1(cur["students"] / registered * 100) if registered else None,
            "previous_participation": _r1(prev_evaluated / registered * 100) if ctx.has_previous and registered else None,
        },
        "average": {
            "value": cur["average"], "results": cur["results"],
            "previous": prev["average"] if ctx.has_previous else None,
            "change": _delta(cur["average"], prev["average"]) if ctx.has_previous else None,
        },
        "strongest_competency": {"key": best["key"], "name": best["name"], "average": best["average"],
                                 "students": best["students"], "results": best["results"]} if best else None,
        "weakest_competency": {"key": worst["key"], "name": worst["name"], "average": worst["average"],
                               "students": worst["students"], "results": worst["results"],
                               "gap_to_reference": round(worst["average"] - REFERENCE_THRESHOLD, 1)} if worst else None,
        "followup": {"students": len(perf_students), "activity_students": len(act_students),
                     "threshold": ctx.filters.threshold, "min_results": ctx.filters.min_results},
        "activity": {
            "completed": completed,
            "completed_quizzes": ctx.counts["completed_quizzes"],
            "completed_submissions": ctx.counts["completed_submissions"],
            "open_submissions": ctx.counts["open_submissions"],
            "pending_quizzes": ctx.counts["pending_quizzes"],
            "previous_completed": prev_completed,
            "change_pct": _r1((completed - prev_completed) / prev_completed * 100)
            if prev_completed else None,
        },
    }


def overview(db: Session, user: User, filters: Filters) -> dict:
    ctx = build_context(db, user, filters)
    comps = competency_rows(ctx)
    cases = followup_cases(ctx, db)
    return {
        "meta": meta(ctx),
        "cards": summary_cards(ctx, comps, cases),
        "competencies": comps,
        "interpretation": interpretation(comps, ctx.has_previous),
        "groups": group_rows(ctx),
        "teachers": teacher_rows(ctx),
        "evolution": evolution(ctx),
        "quality": data_quality(ctx, comps),
        "followup_rules": list(FOLLOWUP_RULES),
    }


def filter_options(db: Session, user: User) -> dict:
    ctx = build_context(db, user, Filters())
    return {
        "institution": {"id": ctx.institution.id, "name": ctx.institution.name},
        "groups": [{"id": c.id, "name": c.name, "grade": c.grade or "", "teacher_id": c.teacher_id,
                    "teacher_name": _name(ctx.teachers.get(c.teacher_id))} for c in ctx.all_classrooms.values()],
        "teachers": [{"id": t.id, "name": _name(t)}
                     for t in sorted(ctx.teachers.values(), key=lambda u: _norm(_name(u)))
                     if t.is_active or any(c.teacher_id == t.id for c in ctx.all_classrooms.values())],
        "competencies": [{"key": k, "name": n} for k, n in COMPETENCIES],
        "sources": [{"key": "todas", "name": "Todas las fuentes"},
                    {"key": "quiz", "name": "Quizzes adaptativos"},
                    {"key": "evaluacion", "name": "Evaluaciones docentes"}],
        "eval_statuses": [{"key": k, "name": v} for k, v in EVAL_STATUS_LABELS.items()],
    }


def _paginate(items: List, page: int, size: int) -> dict:
    size = max(1, min(size, 100))
    total = len(items)
    pages = max(1, (total + size - 1) // size)
    page = max(1, min(page, pages))
    return {"items": items[(page - 1) * size: page * size], "total": total, "page": page,
            "size": size, "pages": pages}


def student_list(db: Session, user: User, filters: Filters, q: str = "", page: int = 1, size: int = 20) -> dict:
    ctx = build_context(db, user, filters)
    needle = _norm(q).strip()
    by_student, _ = _results_index(ctx.results)
    rows = []
    for sid, st in ctx.students.items():
        if needle and needle not in _norm(st.full_name) and needle not in _norm(st.username):
            continue
        rs = by_student.get(sid, [])
        rows.append({
            "id": sid, "name": _name(st), "username": st.username, "grade": st.grade or "",
            "groups": [ctx.all_classrooms[c].name for c in ctx.groups_by_student.get(sid, []) if c in ctx.all_classrooms],
            "results": len(rs), "average": _r1(mean(r.pct for r in rs)) if rs else None,
            "last_result": _iso(max(r.at for r in rs)) if rs else None,
        })
    rows.sort(key=lambda r: _norm(r["name"]))
    return _paginate(rows, page, size)


def student_detail(db: Session, user: User, filters: Filters, student_id: int) -> dict:
    filters.student_id = student_id
    ctx = build_context(db, user, filters)
    st = ctx.students[student_id]
    rs = sorted(ctx.results, key=lambda r: r.at)
    history = []
    last_by_key: Dict[Tuple[Optional[str], str], Result] = {}
    for r in rs:
        prev = last_by_key.get((r.competency, r.source))
        history.append({
            "date": _iso(r.at), "competency": r.competency,
            "competency_name": COMP_NAMES.get(r.competency, "Sin competencia identificada"),
            "title": r.title, "source": r.source, "source_label": SOURCE_LABELS[r.source],
            "pct": _r1(r.pct), "score": _r1(r.score), "max_score": _r1(r.max_score),
            "seconds": r.seconds, "attempts": r.attempts, "status": "Calificada" if r.source == "evaluacion" else "Completado",
            "change_vs_previous": _r1(r.pct - prev.pct) if prev else None,
        })
        last_by_key[(r.competency, r.source)] = r
    comps = []
    for key, name in COMPETENCIES:
        cr = [r for r in rs if r.competency == key]
        if not cr:
            comps.append({"key": key, "name": name, "results": 0, "average": None, "first": None, "last": None,
                          "change": None, "status": "sin_datos"})
            continue
        avg = mean(r.pct for r in cr)
        change = cr[-1].pct - cr[0].pct if len(cr) >= 2 else None
        if len(cr) < 2:
            status = "insuficiente"
        elif change is not None and change >= 5:
            status = "avance"
        elif avg < ctx.filters.threshold or (change is not None and change <= -5):
            status = "refuerzo"
        else:
            status = "estable"
        comps.append({"key": key, "name": name, "results": len(cr), "average": _r1(avg),
                      "first": _r1(cr[0].pct), "last": _r1(cr[-1].pct), "change": _r1(change), "status": status})
    cases = followup_cases(ctx, db)
    return {
        "meta": meta(ctx),
        "student": {"id": st.id, "name": _name(st), "username": st.username, "grade": st.grade or "",
                    "groups": [ctx.all_classrooms[c].name for c in ctx.groups_by_student.get(st.id, [])
                               if c in ctx.all_classrooms]},
        "summary": {"results": len(rs), "average": _r1(mean(student_means(rs).values())) if rs else None,
                    "last_result": _iso(rs[-1].at) if rs else None,
                    "competencies_evaluated": [c["name"] for c in comps if c["results"]]},
        "competencies": comps,
        "history": list(reversed(history)),
        "points": [{"date": h["date"], "pct": h["pct"], "competency": h["competency"], "title": h["title"],
                    "source": h["source"]} for h in history],
        "followup": cases,
    }


def group_detail(db: Session, user: User, filters: Filters, classroom_id: int) -> dict:
    filters.classroom_id = classroom_id
    filters.teacher_id = None
    filters.student_id = None
    ctx = build_context(db, user, filters)
    row = group_rows(ctx)[0]
    members = ctx.students_by_group.get(classroom_id, set()) & set(ctx.students)
    cur_s, cur_g = _results_index(ctx.results_any_comp)
    prev_s, prev_g = _results_index(ctx.prev_results)
    res_all = _group_results(classroom_id, members, cur_s, cur_g)
    res = [r for r in res_all if not ctx.filters.competency or r.competency == ctx.filters.competency]
    prev = _group_results(classroom_id, members, prev_s, prev_g)
    cases = followup_cases(ctx, db)
    flagged = {c["student"]["id"] for c in cases}
    by_student: Dict[int, List[Result]] = {}
    for r in res:
        by_student.setdefault(r.student_id, []).append(r)
    students = []
    for sid in members:
        st = ctx.students[sid]
        rs = sorted(by_student.get(sid, []), key=lambda r: r.at)
        students.append({
            "id": sid, "name": _name(st), "username": st.username,
            "average": _r1(mean(r.pct for r in rs)) if rs else None, "results": len(rs),
            "competencies": sorted({COMP_NAMES[r.competency] for r in rs if r.competency}),
            "last_result": _iso(rs[-1].at) if rs else None,
            "change": _r1(rs[-1].pct - rs[0].pct) if len(rs) >= 2 else None,
            "followup": sid in flagged,
            "followup_rules": sorted({c["rule_label"] for c in cases if c["student"]["id"] == sid}),
        })
    students.sort(key=lambda s: _norm(s["name"]))
    completed = sum(1 for r in res if r.source == "evaluacion")
    return {
        "meta": meta(ctx),
        "group": row,
        "summary": {"enrolled": len(members), "evaluated": row["evaluated"], "average": row["average"],
                    "completed_evaluations": completed, "quiz_results": sum(1 for r in res if r.source == "quiz"),
                    "change": row["change"]},
        "competencies": competency_rows(ctx, res_all, prev),
        "distribution": distribution(res),
        "evolution": evolution(ctx, res_all),
        "students": students,
    }


def teacher_detail(db: Session, user: User, filters: Filters, teacher_id: int) -> dict:
    filters.teacher_id = teacher_id
    filters.classroom_id = None
    filters.student_id = None
    ctx = build_context(db, user, filters)
    rows = teacher_rows(ctx)
    row = next((r for r in rows if r["id"] == teacher_id), None)
    groups = group_rows(ctx)
    cur_s, cur_g = _results_index(ctx.results_any_comp)
    prev_s, prev_g = _results_index(ctx.prev_results)
    res: List[Result] = []
    prev: List[Result] = []
    seen: Set[int] = set()
    for gid in ctx.classrooms:
        m = ctx.students_by_group.get(gid, set()) & set(ctx.students)
        for r in _group_results(gid, m, cur_s, cur_g):
            if id(r) not in seen:
                seen.add(id(r))
                res.append(r)
        for r in _group_results(gid, m, prev_s, prev_g):
            if id(r) not in seen:
                seen.add(id(r))
                prev.append(r)
    return {
        "meta": meta(ctx),
        "teacher": row or {"id": teacher_id, "name": _name(ctx.teachers.get(teacher_id)), "groups": 0},
        "groups": groups,
        "competencies": competency_rows(ctx, res, prev),
        "evolution": evolution(ctx, res),
        "evaluations": evaluation_rows(ctx, db),
        "comparison_note": "Las diferencias entre grupos deben leerse junto con el tamaño del grupo y el número "
                           "de estudiantes evaluados." if len(groups) > 1 else None,
    }


def competency_detail(db: Session, user: User, filters: Filters, key: str) -> dict:
    if key not in COMP_NAMES:
        raise ReportError("Competencia inválida.", 404)
    filters.competency = key
    ctx = build_context(db, user, filters)
    comps = competency_rows(ctx)
    by_student: Dict[int, List[Result]] = {}
    for r in ctx.results:
        by_student.setdefault(r.student_id, []).append(r)
    students = []
    for sid, rs in by_student.items():
        rs.sort(key=lambda r: r.at)
        st = ctx.students[sid]
        students.append({
            "id": sid, "name": _name(st), "username": st.username,
            "groups": [ctx.all_classrooms[c].name for c in ctx.groups_by_student.get(sid, []) if c in ctx.all_classrooms],
            "average": _r1(mean(r.pct for r in rs)), "results": len(rs),
            "last_result": _iso(rs[-1].at), "band": band_of(mean(r.pct for r in rs)),
        })
    students.sort(key=lambda s: (s["average"], _norm(s["name"])))
    return {
        "meta": meta(ctx),
        "competency": comps[0],
        "distribution": distribution(ctx.results),
        "evolution": evolution(ctx),
        "groups": [g for g in group_rows(ctx) if g["results"]],
        "students": students,
    }


def evaluation_rows(ctx: Context, db: Session) -> List[dict]:
    f = ctx.filters
    evs = [e for e in ctx.evaluations if e.classroom_id in ctx.classrooms
           and _active_in_period(e, ctx.since, ctx.until)
           and (f.eval_status is None or e.status == f.eval_status)]
    comps = {e.id: classify_competency(ctx.all_classrooms[e.classroom_id].subject, e.title) for e in evs}
    if f.competency:
        evs = [e for e in evs if comps[e.id] == f.competency]
    if not evs:
        return []
    subs = db.query(EvaluationSubmission).filter(EvaluationSubmission.evaluation_id.in_([e.id for e in evs])).all()
    by_eval: Dict[int, List[EvaluationSubmission]] = {}
    for s in subs:
        if s.student_id in ctx.students:
            by_eval.setdefault(s.evaluation_id, []).append(s)
    now = datetime.utcnow()
    rows = []
    for e in evs:
        assigned = ctx.students_by_group.get(e.classroom_id, set()) & set(ctx.students)
        es = by_eval.get(e.id, [])
        per_student: Dict[int, List[EvaluationSubmission]] = {}
        for s in es:
            per_student.setdefault(s.student_id, []).append(s)
        started = set(per_student)
        completed = {sid for sid, ss in per_student.items() if any(s.status != "en_curso" for s in ss)}
        abandoned = {sid for sid, ss in per_student.items()
                     if sid not in completed and all(s.expires_at and s.expires_at < now for s in ss)}
        officials = [evaluation_service.official_submission(ss) for ss in per_student.values()]
        graded = [o.percentage for o in officials if o and o.status == "calificada" and o.percentage is not None]
        pending = sum(1 for o in officials if o and o.status == "pendiente_revision")
        teacher = ctx.teachers.get(e.teacher_id)
        bands = {k: 0 for k, *_ in PERFORMANCE_BANDS}
        for p in graded:
            bands[band_of(p)] += 1
        rows.append({
            "id": e.id, "title": e.title, "type": e.eval_type, "competency": comps[e.id],
            "competency_name": COMP_NAMES.get(comps[e.id], "Sin competencia identificada"),
            "group": {"id": e.classroom_id, "name": ctx.all_classrooms[e.classroom_id].name},
            "teacher": {"id": e.teacher_id, "name": _name(teacher)},
            "created_at": _iso(e.created_at), "published_at": _iso(e.published_at), "closed_at": _iso(e.closed_at),
            "deadline": e.date or None, "status": e.status, "status_label": EVAL_STATUS_LABELS.get(e.status, e.status),
            "assigned": len(assigned), "started": len(started), "completed": len(completed),
            "abandoned": len(abandoned), "pending_review": pending,
            "completion_rate": _r1(len(completed) / len(assigned) * 100) if assigned else None,
            "average": _r1(mean(graded)) if graded else None, "graded": len(graded),
            "distribution": bands,
        })
    return rows


def evaluations_report(db: Session, user: User, filters: Filters, page: int = 1, size: int = 20) -> dict:
    ctx = build_context(db, user, filters)
    rows = evaluation_rows(ctx, db)
    assigned = sum(r["assigned"] for r in rows)
    started = sum(r["started"] for r in rows)
    completed = sum(r["completed"] for r in rows)
    abandoned = sum(r["abandoned"] for r in rows)
    bands = {k: 0 for k, *_ in PERFORMANCE_BANDS}
    for r in rows:
        for k, v in r["distribution"].items():
            bands[k] += v
    graded_avgs = [(r["average"], r["graded"]) for r in rows if r["average"] is not None]
    by_group: Dict[int, dict] = {}
    for r in rows:
        g = by_group.setdefault(r["group"]["id"], {"id": r["group"]["id"], "name": r["group"]["name"],
                                                   "assigned": 0, "completed": 0, "evaluations": 0})
        g["assigned"] += r["assigned"]
        g["completed"] += r["completed"]
        g["evaluations"] += 1
    for g in by_group.values():
        g["completion_rate"] = _r1(g["completed"] / g["assigned"] * 100) if g["assigned"] else None
    evo_results = [r for r in ctx.results if r.source == "evaluacion"]
    evo = evolution(ctx, evo_results)
    return {
        "meta": meta(ctx),
        "indicators": {
            "evaluations": len(rows), "assigned": assigned, "started": started, "completed": completed,
            "completion_rate": _r1(completed / assigned * 100) if assigned else None,
            "abandonment_rate": _r1(abandoned / started * 100) if started else None,
            "average": _r1(sum(a * n for a, n in graded_avgs) / sum(n for _, n in graded_avgs)) if graded_avgs else None,
            "distribution": [{"key": k, "label": l, "count": bands[k]} for k, l, *_ in PERFORMANCE_BANDS],
            "by_group": sorted(by_group.values(), key=lambda g: _norm(g["name"])),
            "completed_over_time": [{"bucket": b["label"], "results": p["results"]}
                                    for b, p in zip(evo["buckets"], next(
                                        (s["points"] for s in evo["series"] if s["key"] == "general"),
                                        [{"results": 0}] * len(evo["buckets"])))],
            "definitions": {
                "completion_rate": "Estudiantes con al menos una entrega enviada / estudiantes inscritos en el grupo.",
                "abandonment_rate": "Estudiantes que abrieron un intento, no enviaron ninguno y el tiempo se agotó "
                                    "/ estudiantes que iniciaron.",
                "average": "Media de los resultados oficiales calificados (mejor intento).",
                "counts": "Los conteos de cada evaluación incluyen todas sus entregas; el período decide qué "
                          "evaluaciones aparecen (activas durante el período).",
            },
        },
        **_paginate(rows, page, size),
    }


def evaluation_detail(db: Session, user: User, filters: Filters, evaluation_id: int) -> dict:
    ctx = build_context(db, user, filters)
    ev = next((e for e in ctx.evaluations if e.id == evaluation_id), None)
    if ev is None or ev.classroom_id not in ctx.all_classrooms:
        raise ReportError("La evaluación no existe o no pertenece a tu institución.", 404)
    row = next((r for r in evaluation_rows(_with_period_all(ctx, ev), db) if r["id"] == ev.id), None)
    subs = db.query(EvaluationSubmission).filter(EvaluationSubmission.evaluation_id == ev.id).all()
    per_student: Dict[int, List[EvaluationSubmission]] = {}
    for s in subs:
        per_student.setdefault(s.student_id, []).append(s)
    students = []
    for sid in sorted(ctx.students_by_group.get(ev.classroom_id, set()) & set(ctx.students),
                      key=lambda i: _norm(_name(ctx.students.get(i)))):
        ss = per_student.get(sid, [])
        off = evaluation_service.official_submission(ss)
        if off is not None:
            status = "Calificada" if off.status == "calificada" else "Por calificar"
        elif ss:
            status = "En curso"
        else:
            status = "Sin iniciar"
        students.append({
            "id": sid, "name": _name(ctx.students.get(sid)), "status": status, "attempts": len(ss),
            "pct": _r1(off.percentage) if off is not None and off.status == "calificada" else None,
            "submitted_at": _iso(off.submitted_at) if off is not None else None,
        })
    return {"meta": meta(ctx), "evaluation": row, "students": students}


def _with_period_all(ctx: Context, ev: TeacherEvaluation) -> Context:
    """Copia del contexto sin restricción de período ni de estado (detalle de una evaluación)."""
    clone = Context(**{**ctx.__dict__})
    clone.since = None
    clone.until = None
    clone.filters = Filters(**{**ctx.filters.__dict__, "eval_status": None, "competency": None})
    clone.classrooms = {ev.classroom_id: ctx.all_classrooms[ev.classroom_id]}
    return clone


def followup_report(db: Session, user: User, filters: Filters, rule: Optional[str] = None,
                    page: int = 1, size: int = 20) -> dict:
    ctx = build_context(db, user, filters)
    cases = followup_cases(ctx, db)
    totals = {r["key"]: sum(1 for c in cases if c["rule"] == r["key"]) for r in FOLLOWUP_RULES}
    if rule:
        if rule not in RULE_LABELS:
            raise ReportError("Regla de seguimiento inválida.")
        cases = [c for c in cases if c["rule"] == rule]
    return {"meta": meta(ctx), "rules": list(FOLLOWUP_RULES), "totals": totals,
            "neurodigital_note": "Los indicadores neurodigitales (atención, emociones, riesgo cognitivo del tutor) "
                                 "no se usan en estas reglas. Se consultan por separado en NeuroAlertas y no "
                                 "sustituyen la evidencia académica.",
            **_paginate(cases, page, size)}
