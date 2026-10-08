"""
NeuroLearn IA — Evaluaciones del profesor.

Flujo: crear (borrador) → editar mientras no tenga entregas → publicar para un
aula → los estudiantes responden (student_evaluations.py) → ver resultados,
calificar preguntas abiertas → cerrar.

Endpoints (permiso GESTIONAR_EVALUACIONES; cada profesor solo ve las suyas):
    GET    /teacher/evaluations
    POST   /teacher/evaluations
    PUT    /teacher/evaluations/{id}
    POST   /teacher/evaluations/{id}/publish
    POST   /teacher/evaluations/{id}/close
    DELETE /teacher/evaluations/{id}
    GET    /teacher/evaluations/{id}/results
    GET    /teacher/evaluations/{id}/submissions/{submission_id}
    POST   /teacher/evaluations/{id}/submissions/{submission_id}/grade

Reglas de fechas, intentos y calificación: app/services/evaluation_service.py.
"""
import re
from datetime import date as date_cls
from typing import Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.db.database import get_db
from app.models.classroom import Classroom, Enrollment
from app.models.evaluation import EvaluationSubmission, TeacherEvaluation  # noqa: F401 (re-export)
from app.models.user import User
from app.services import evaluation_service as svc

router = APIRouter(prefix="/teacher", tags=["Teacher Evaluations"])


# ─── Schemas de entrada ──────────────────────────────────────────────────────

TRUE_FALSE_OPTIONS = ["Verdadero", "Falso"]


class EvaluationQuestionIn(BaseModel):
    """Pregunta tal como la arma EvaluacionesTab (manual o generada con IA)."""
    id: Optional[str] = Field(None, max_length=60)
    type: Literal["multiple", "truefalse", "open"]
    text: str = Field(..., max_length=2000)
    options: Optional[List[str]] = None
    correct: Optional[str] = Field(None, max_length=500)
    points: int = Field(2, ge=1, le=10)
    explanation: Optional[str] = Field(None, max_length=1000)

    @field_validator("text")
    @classmethod
    def _text_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Cada pregunta necesita un enunciado.")
        return value

    @model_validator(mode="after")
    def _check_options(self):
        opts = [o.strip() for o in (self.options or []) if o and o.strip()]
        if self.type == "open":
            self.options, self.correct = None, None
            return self
        if self.type == "truefalse":
            opts = list(TRUE_FALSE_OPTIONS)
        if len(opts) < 2:
            raise ValueError(f"La pregunta «{self.text[:60]}» necesita al menos 2 opciones.")
        if len(set(opts)) != len(opts):
            raise ValueError(f"La pregunta «{self.text[:60]}» tiene opciones repetidas.")
        correct = (self.correct or "").strip()
        if correct not in opts:
            raise ValueError(f"Marca la respuesta correcta de la pregunta «{self.text[:60]}».")
        self.options, self.correct = opts, correct
        return self


class EvaluationCreate(BaseModel):
    title: str = Field(..., max_length=200)
    classroom_id: int
    type: Literal["cuestionario", "examen"] = "cuestionario"
    date: str = Field("", max_length=20)      # fecha límite AAAA-MM-DD ("" = sin límite)
    duration: int = Field(30, ge=5, le=180)   # minutos por intento
    attempts: int = Field(1, ge=1, le=5)
    questions: List[EvaluationQuestionIn] = Field(..., max_length=100)

    @field_validator("title")
    @classmethod
    def _strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("El título es obligatorio.")
        return value

    @field_validator("date")
    @classmethod
    def _date_format(cls, value: str) -> str:
        value = (value or "").strip()
        if not value:
            return value
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("La fecha debe tener el formato AAAA-MM-DD.")
        try:
            date_cls.fromisoformat(value)
        except ValueError:
            raise ValueError("La fecha no es válida.")
        return value


class QuestionGrade(BaseModel):
    points: float = Field(..., ge=0)
    feedback: Optional[str] = Field(None, max_length=1000)


class GradePayload(BaseModel):
    grades: Dict[str, QuestionGrade]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_own_evaluation(db: Session, eval_id: int, user: User) -> TeacherEvaluation:
    ev = db.query(TeacherEvaluation).filter(
        TeacherEvaluation.id == eval_id,
        TeacherEvaluation.teacher_id == user.id,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
    return ev


def _get_own_classroom(db: Session, classroom_id: int, user: User) -> Classroom:
    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == user.id,
        Classroom.is_active == True,  # noqa: E712
    ).first()
    if not classroom:
        raise HTTPException(status_code=400, detail="Selecciona uno de tus grupos.")
    return classroom


def _check_future_date(value: str) -> None:
    if value and date_cls.fromisoformat(value) < svc.today_colombia():
        raise HTTPException(status_code=400, detail="La fecha límite no puede estar en el pasado.")


def _submission_count(db: Session, ev_id: int) -> int:
    return db.query(EvaluationSubmission).filter(
        EvaluationSubmission.evaluation_id == ev_id,
    ).count()


def _eval_out(ev: TeacherEvaluation, db: Optional[Session] = None) -> dict:
    out = {
        "id":           ev.id,
        "title":        ev.title,
        "classroom_id": ev.classroom_id,
        "group":        ev.group_name,
        "type":         ev.eval_type,
        "date":         ev.date,
        "deadline":     svc.iso(svc.deadline_utc(ev)),
        "duration":     ev.duration,
        "attempts":     ev.attempts,
        "questions":    ev.questions or [],
        "status":       ev.status,
        "active":       ev.status == "publicada",
        "submissions":  ev.submissions or 0,
        "published_at": svc.iso(ev.published_at),
        "closed_at":    svc.iso(ev.closed_at),
        "past_deadline": svc.is_past_deadline(ev),
    }
    if db is not None:
        subs = db.query(EvaluationSubmission.student_id, EvaluationSubmission.status).filter(
            EvaluationSubmission.evaluation_id == ev.id,
        ).all()
        out["students_submitted"] = len({s.student_id for s in subs if s.status != "en_curso"})
        out["pending_review"] = sum(1 for s in subs if s.status == "pendiente_revision")
        out["editable"] = ev.status != "cerrada" and len(subs) == 0
        out["students_total"] = db.query(Enrollment).filter(
            Enrollment.classroom_id == ev.classroom_id,
            Enrollment.is_active == True,  # noqa: E712
        ).count() if ev.classroom_id else 0
    return out


def _apply_payload(ev: TeacherEvaluation, data: EvaluationCreate, classroom: Classroom) -> None:
    questions = [q.model_dump(exclude_none=True) for q in data.questions]
    ev.title = data.title
    ev.classroom_id = classroom.id
    ev.group_name = classroom.name
    ev.eval_type = data.type
    ev.date = data.date
    ev.duration = data.duration
    ev.attempts = data.attempts
    ev.questions = svc.ensure_question_ids(questions)


# ─── CRUD ────────────────────────────────────────────────────────────────────

@router.get("/evaluations")
async def list_evaluations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Evaluaciones del profesor con su estado y conteo real de entregas."""
    evals = (
        db.query(TeacherEvaluation)
        .filter(TeacherEvaluation.teacher_id == current_user.id)
        .order_by(TeacherEvaluation.created_at.desc())
        .all()
    )
    repaired = False
    for ev in evals:
        if ev.status not in ("borrador", "publicada", "cerrada"):
            # Filas creadas antes de los estados (SQLite local sin migración 009).
            ev.status, ev.active = "borrador", False
            repaired = True
    if repaired:
        db.commit()
    for ev in evals:
        if ev.status == "publicada":
            svc.finalize_expired_attempts(db, ev)
    return {"evaluations": [_eval_out(e, db) for e in evals]}


@router.post("/evaluations", status_code=201)
async def create_evaluation(
    data: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Crea la evaluación como borrador (los estudiantes aún no la ven)."""
    if not data.questions:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una pregunta.")
    classroom = _get_own_classroom(db, data.classroom_id, current_user)
    _check_future_date(data.date)

    ev = TeacherEvaluation(teacher_id=current_user.id, status="borrador", active=False, submissions=0)
    _apply_payload(ev, data, classroom)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _eval_out(ev, db)


@router.put("/evaluations/{eval_id}")
async def update_evaluation(
    eval_id: int,
    data: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Edita la evaluación mientras ningún estudiante la haya empezado."""
    ev = _get_own_evaluation(db, eval_id, current_user)
    if ev.status == "cerrada":
        raise HTTPException(status_code=409, detail="La evaluación está cerrada y no se puede editar.")
    if _submission_count(db, ev.id):
        raise HTTPException(
            status_code=409,
            detail="La evaluación ya tiene entregas de estudiantes y no se puede editar.",
        )
    if not data.questions:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una pregunta.")
    classroom = _get_own_classroom(db, data.classroom_id, current_user)
    _check_future_date(data.date)
    _apply_payload(ev, data, classroom)
    db.commit()
    db.refresh(ev)
    return _eval_out(ev, db)


@router.post("/evaluations/{eval_id}/publish")
async def publish_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Publica la evaluación: los estudiantes del aula ya pueden responderla."""
    ev = _get_own_evaluation(db, eval_id, current_user)
    if ev.status != "borrador":
        raise HTTPException(status_code=409, detail="Solo se pueden publicar evaluaciones en borrador.")
    if not ev.classroom_id:
        raise HTTPException(status_code=400, detail="Asigna un grupo a la evaluación antes de publicarla.")
    _get_own_classroom(db, ev.classroom_id, current_user)
    if not ev.questions:
        raise HTTPException(status_code=400, detail="La evaluación no tiene preguntas.")
    _check_future_date(ev.date or "")

    ev.status = "publicada"
    ev.active = True
    ev.published_at = svc.utcnow()
    _notify_published(db, ev, current_user)
    db.commit()
    db.refresh(ev)
    return _eval_out(ev, db)


def _notify_published(db: Session, ev: TeacherEvaluation, teacher: User) -> None:
    """Evaluación publicada → estudiantes activos del aula (misma transacción)."""
    from app.services import notification_service
    classroom = db.get(Classroom, ev.classroom_id)
    student_ids = [r.student_id for r in db.query(Enrollment.student_id).filter(
        Enrollment.classroom_id == ev.classroom_id, Enrollment.is_active == True)]  # noqa: E712
    when = f" Fecha límite: {ev.date}." if ev.date else ""
    notification_service.notify(
        db, student_ids, "evaluacion_publicada", "Nueva evaluación publicada",
        f'{teacher.full_name or teacher.username} publicó "{ev.title}" en {classroom.name if classroom else "tu grupo"}.{when}',
        link=f"/evaluations?id={ev.id}", resource_type="evaluacion", resource_id=ev.id,
    )


@router.post("/evaluations/{eval_id}/close")
async def close_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """
    Cierra la evaluación: no recibe más entregas y los estudiantes pasan a ver
    la corrección. Los intentos en curso se envían con lo que tengan guardado.
    """
    ev = _get_own_evaluation(db, eval_id, current_user)
    if ev.status != "publicada":
        raise HTTPException(status_code=409, detail="Solo se pueden cerrar evaluaciones publicadas.")
    now = svc.utcnow()
    in_progress = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.evaluation_id == ev.id,
        EvaluationSubmission.status == "en_curso",
    ).all()
    for sub in in_progress:
        svc.submit_attempt(sub, ev, sub.answers or {}, submitted_at=now, auto=True)
    ev.status = "cerrada"
    ev.active = False
    ev.closed_at = now
    svc.refresh_submission_counter(db, ev)
    db.commit()
    db.refresh(ev)
    return _eval_out(ev, db)


@router.delete("/evaluations/{eval_id}", status_code=204)
async def delete_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Elimina la evaluación y todas sus entregas."""
    ev = _get_own_evaluation(db, eval_id, current_user)
    db.query(EvaluationSubmission).filter(
        EvaluationSubmission.evaluation_id == ev.id
    ).delete(synchronize_session=False)
    db.delete(ev)
    db.commit()


# ─── Resultados ──────────────────────────────────────────────────────────────

def _submission_summary(sub: EvaluationSubmission) -> dict:
    return {
        "id": sub.id,
        "attempt_number": sub.attempt_number,
        "status": sub.status,
        "score": sub.score,
        "max_score": sub.max_score,
        "percentage": sub.percentage,
        "auto_submitted": bool(sub.auto_submitted),
        "started_at": svc.iso(sub.started_at),
        "submitted_at": svc.iso(sub.submitted_at),
    }


@router.get("/evaluations/{eval_id}/results")
async def evaluation_results(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Estudiantes del aula, sus intentos, nota oficial (mejor intento) y desempeño por pregunta."""
    ev = _get_own_evaluation(db, eval_id, current_user)
    if ev.status == "publicada":
        svc.finalize_expired_attempts(db, ev)

    subs = (
        db.query(EvaluationSubmission)
        .filter(EvaluationSubmission.evaluation_id == ev.id)
        .order_by(EvaluationSubmission.attempt_number)
        .all()
    )
    by_student: Dict[int, List[EvaluationSubmission]] = {}
    for sub in subs:
        by_student.setdefault(sub.student_id, []).append(sub)

    enrolled_ids = [
        row.student_id for row in db.query(Enrollment.student_id).filter(
            Enrollment.classroom_id == ev.classroom_id,
            Enrollment.is_active == True,  # noqa: E712
        ).all()
    ] if ev.classroom_id else []
    student_ids = list(dict.fromkeys(enrolled_ids + list(by_student.keys())))
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids)).all()} if student_ids else {}

    students = []
    official_subs = []
    for sid in student_ids:
        user = users.get(sid)
        attempts = by_student.get(sid, [])
        official = svc.official_submission(attempts)
        if official is not None:
            official_subs.append(official)
        in_progress = any(a.status == "en_curso" for a in attempts)
        students.append({
            "student_id": sid,
            "name": user.full_name if user else f"Estudiante {sid}",
            "username": user.username if user else "",
            "enrolled": sid in enrolled_ids,
            "attempts_used": len(attempts),
            "status": (official.status if official else ("en_curso" if in_progress else "sin_entregar")),
            "official": _submission_summary(official) if official else None,
            "attempts": [_submission_summary(a) for a in attempts],
        })
    students.sort(key=lambda s: s["name"].lower())

    graded = [s for s in official_subs if s.status == "calificada" and s.percentage is not None]
    question_stats = []
    for i, q in enumerate(ev.questions or []):
        qid = svc.question_id(q, i)
        evaluated = [s.results.get(qid) for s in official_subs if s.results and s.results.get(qid)]
        scored = [r for r in evaluated if r.get("points") is not None]
        correct = [r for r in scored if r.get("correct")]
        question_stats.append({
            "id": qid,
            "text": q.get("text", ""),
            "type": q.get("type"),
            "responses": len(evaluated),
            "correct_rate": round(len(correct) / len(scored) * 100, 1) if scored else None,
            "avg_points": round(sum(r["points"] for r in scored) / len(scored), 2) if scored else None,
            "max_points": float(int(q.get("points") or 0)),
        })

    return {
        "evaluation": _eval_out(ev, db),
        "summary": {
            "students_total": len(enrolled_ids),
            "students_submitted": len(official_subs),
            "pending_review": sum(1 for s in official_subs if s.status == "pendiente_revision"),
            "average_percentage": round(sum(s.percentage for s in graded) / len(graded), 1) if graded else None,
            "max_score": svc.max_score(ev.questions or []),
        },
        "students": students,
        "questions": question_stats,
    }


def _get_submission(db: Session, ev: TeacherEvaluation, submission_id: int) -> EvaluationSubmission:
    sub = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.id == submission_id,
        EvaluationSubmission.evaluation_id == ev.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Entrega no encontrada.")
    return sub


def _submission_detail(db: Session, ev: TeacherEvaluation, sub: EvaluationSubmission) -> dict:
    student = db.query(User).filter(User.id == sub.student_id).first()
    answers = sub.answers or {}
    results = sub.results or {}
    items = []
    for i, q in enumerate(ev.questions or []):
        qid = svc.question_id(q, i)
        items.append({
            "question": {**q, "id": qid},
            "answer": answers.get(qid),
            "result": results.get(qid),
        })
    return {
        "submission": _submission_summary(sub),
        "student": {"id": sub.student_id, "name": student.full_name if student else ""},
        "items": items,
    }


@router.get("/evaluations/{eval_id}/submissions/{submission_id}")
async def submission_detail(
    eval_id: int,
    submission_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Respuestas de un intento, pregunta por pregunta."""
    ev = _get_own_evaluation(db, eval_id, current_user)
    sub = _get_submission(db, ev, submission_id)
    return _submission_detail(db, ev, sub)


@router.post("/evaluations/{eval_id}/submissions/{submission_id}/grade")
async def grade_submission(
    eval_id: int,
    submission_id: int,
    payload: GradePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """Califica las preguntas abiertas de un intento (puntos y comentario)."""
    ev = _get_own_evaluation(db, eval_id, current_user)
    sub = _get_submission(db, ev, submission_id)
    if sub.status == "en_curso":
        raise HTTPException(status_code=409, detail="El estudiante aún no ha enviado este intento.")

    questions = {svc.question_id(q, i): q for i, q in enumerate(ev.questions or [])}
    results = dict(sub.results or {})
    for qid, grade in payload.grades.items():
        q = questions.get(qid)
        if q is None:
            raise HTTPException(status_code=400, detail=f"La pregunta {qid} no existe en la evaluación.")
        if q.get("type") in svc.AUTO_GRADED:
            raise HTTPException(status_code=400, detail="Solo se califican a mano las preguntas abiertas.")
        max_points = float(int(q.get("points") or 0))
        if grade.points > max_points:
            raise HTTPException(status_code=400, detail=f"La pregunta vale máximo {max_points:g} puntos.")
        results[qid] = {
            "correct": grade.points >= max_points,
            "points": round(grade.points, 2),
            "max_points": max_points,
            "feedback": (grade.feedback or "").strip() or None,
        }
    sub.results = results
    svc.apply_totals(sub, ev.questions or [])
    sub.graded_at = svc.utcnow()
    sub.graded_by_id = current_user.id
    db.commit()
    db.refresh(sub)
    return _submission_detail(db, ev, sub)
