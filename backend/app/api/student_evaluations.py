"""
NeuroLearn IA — Evaluaciones del estudiante.

Endpoints (permiso PARTICIPAR_EN_AULAS):
    GET  /student/evaluations                      evaluaciones de sus aulas (?classroom_id=)
    GET  /student/evaluations/{id}                 detalle, intentos y resultado
    POST /student/evaluations/{id}/start           abre (o retoma) un intento con tiempo
    PUT  /student/evaluations/{id}/progress        guarda respuestas del intento en curso
    POST /student/evaluations/{id}/submit          envía el intento → calificación en el servidor

El estudiante solo ve evaluaciones publicadas o cerradas de aulas activas en
las que está inscrito. Nunca recibe la respuesta correcta ni la explicación
mientras la evaluación acepta entregas (ver evaluation_service.corrections_visible).
"""
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.db.database import get_db
from app.models.classroom import Classroom, Enrollment
from app.models.evaluation import EvaluationSubmission, TeacherEvaluation
from app.models.user import User
from app.services import evaluation_service as svc

router = APIRouter(prefix="/student", tags=["Student Evaluations"])


class AnswersPayload(BaseModel):
    submission_id: int
    answers: Dict[str, Optional[str]] = Field(default_factory=dict)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _enrolled_classroom_ids(db: Session, user: User) -> List[int]:
    rows = (
        db.query(Enrollment.classroom_id)
        .join(Classroom, Classroom.id == Enrollment.classroom_id)
        .filter(
            Enrollment.student_id == user.id,
            Enrollment.is_active == True,  # noqa: E712
            Classroom.is_active == True,  # noqa: E712
        )
        .all()
    )
    return [r.classroom_id for r in rows]


def _get_visible_evaluation(db: Session, eval_id: int, user: User) -> TeacherEvaluation:
    ev = db.query(TeacherEvaluation).filter(TeacherEvaluation.id == eval_id).first()
    if (
        not ev
        or ev.status not in ("publicada", "cerrada")
        or not ev.classroom_id
        or ev.classroom_id not in _enrolled_classroom_ids(db, user)
    ):
        raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
    return ev


def _my_attempts(db: Session, ev: TeacherEvaluation, user: User) -> List[EvaluationSubmission]:
    return (
        db.query(EvaluationSubmission)
        .filter(EvaluationSubmission.evaluation_id == ev.id, EvaluationSubmission.student_id == user.id)
        .order_by(EvaluationSubmission.attempt_number)
        .all()
    )


def _attempt_out(sub: EvaluationSubmission) -> dict:
    return {
        "id": sub.id,
        "attempt_number": sub.attempt_number,
        "status": sub.status,
        "score": sub.score if sub.status == "calificada" else None,
        "max_score": sub.max_score,
        "percentage": sub.percentage if sub.status == "calificada" else None,
        "auto_submitted": bool(sub.auto_submitted),
        "started_at": svc.iso(sub.started_at),
        "submitted_at": svc.iso(sub.submitted_at),
        "expires_at": svc.iso(sub.expires_at),
    }


def _summary(db: Session, ev: TeacherEvaluation, user: User, attempts: List[EvaluationSubmission]) -> dict:
    now = svc.utcnow()
    in_progress = next((a for a in attempts if a.status == "en_curso"), None)
    official = svc.official_submission(attempts)
    used = len(attempts)
    can_start = svc.accepts_submissions(ev, now) and (in_progress is not None or used < (ev.attempts or 1))
    if in_progress:
        state = "en_curso"
    elif official is not None:
        state = official.status            # calificada | pendiente_revision
    elif svc.accepts_submissions(ev, now):
        state = "pendiente"
    else:
        state = "no_entregada"
    return {
        "id": ev.id,
        "title": ev.title,
        "type": ev.eval_type,
        "classroom_id": ev.classroom_id,
        "classroom_name": ev.group_name,
        "status": ev.status,
        "deadline": svc.iso(svc.deadline_utc(ev)),
        "date": ev.date,
        "duration": ev.duration,
        "attempts_allowed": ev.attempts,
        "attempts_used": used,
        "questions_count": len(ev.questions or []),
        "max_score": svc.max_score(ev.questions or []),
        "state": state,
        "can_start": can_start,
        "in_progress_id": in_progress.id if in_progress else None,
        "official": _attempt_out(official) if official else None,
        "corrections_available": svc.corrections_visible(ev, now),
    }


def _review(ev: TeacherEvaluation, sub: EvaluationSubmission) -> List[dict]:
    """Corrección del intento oficial (solo cuando corrections_visible)."""
    answers = sub.answers or {}
    results = sub.results or {}
    items = []
    for i, q in enumerate(ev.questions or []):
        qid = svc.question_id(q, i)
        items.append({
            "question": {**svc.public_question(q, i), "correct": q.get("correct"),
                         "explanation": q.get("explanation")},
            "answer": answers.get(qid),
            "result": results.get(qid),
        })
    return items


def _get_own_in_progress(db: Session, ev: TeacherEvaluation, user: User,
                         submission_id: int) -> EvaluationSubmission:
    sub = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.id == submission_id,
        EvaluationSubmission.evaluation_id == ev.id,
        EvaluationSubmission.student_id == user.id,
    ).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Intento no encontrado.")
    if sub.status != "en_curso":
        raise HTTPException(status_code=409, detail="Este intento ya fue enviado.")
    return sub


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/evaluations")
async def list_my_evaluations(
    classroom_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    """Evaluaciones publicadas o cerradas de las aulas del estudiante."""
    classroom_ids = _enrolled_classroom_ids(db, current_user)
    if classroom_id is not None:
        classroom_ids = [c for c in classroom_ids if c == classroom_id]
    if not classroom_ids:
        return {"evaluations": []}
    evals = (
        db.query(TeacherEvaluation)
        .filter(
            TeacherEvaluation.classroom_id.in_(classroom_ids),
            TeacherEvaluation.status.in_(("publicada", "cerrada")),
        )
        .order_by(TeacherEvaluation.published_at.desc(), TeacherEvaluation.id.desc())
        .all()
    )
    items = []
    for ev in evals:
        svc.finalize_expired_attempts(db, ev, student_id=current_user.id)
        items.append(_summary(db, ev, current_user, _my_attempts(db, ev, current_user)))
    return {"evaluations": items}


@router.get("/evaluations/{eval_id}")
async def my_evaluation_detail(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    """Detalle de la evaluación, mis intentos y, si ya está disponible, la corrección."""
    ev = _get_visible_evaluation(db, eval_id, current_user)
    svc.finalize_expired_attempts(db, ev, student_id=current_user.id)
    attempts = _my_attempts(db, ev, current_user)
    data = _summary(db, ev, current_user, attempts)
    data["attempts"] = [_attempt_out(a) for a in attempts]
    official = svc.official_submission(attempts)
    data["review"] = _review(ev, official) if official and data["corrections_available"] else None
    return data


@router.post("/evaluations/{eval_id}/start")
async def start_attempt(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    """Abre un intento nuevo o retoma el que está en curso. Devuelve las preguntas sin respuestas."""
    ev = _get_visible_evaluation(db, eval_id, current_user)
    now = svc.utcnow()
    svc.finalize_expired_attempts(db, ev, student_id=current_user.id, now=now)
    if not svc.accepts_submissions(ev, now):
        raise HTTPException(status_code=409, detail="Esta evaluación ya no recibe entregas.")

    attempts = _my_attempts(db, ev, current_user)
    sub = next((a for a in attempts if a.status == "en_curso"), None)
    if sub is None:
        if len(attempts) >= (ev.attempts or 1):
            raise HTTPException(status_code=409, detail="Ya usaste todos los intentos de esta evaluación.")
        sub = EvaluationSubmission(
            evaluation_id=ev.id,
            student_id=current_user.id,
            classroom_id=ev.classroom_id,
            institution_id=current_user.institution_id,
            attempt_number=(max((a.attempt_number for a in attempts), default=0) + 1),
            status="en_curso",
            answers={},
            started_at=now,
            expires_at=svc.attempt_expiry(ev, now),
        )
        db.add(sub)
        try:
            db.commit()
        except IntegrityError:
            # Doble clic / dos pestañas: el otro request ya creó el intento.
            db.rollback()
            sub = next((a for a in _my_attempts(db, ev, current_user) if a.status == "en_curso"), None)
            if sub is None:
                raise HTTPException(status_code=409, detail="No se pudo abrir el intento. Recarga la página.")
        db.refresh(sub)

    remaining = max(0, int((sub.expires_at - svc.utcnow()).total_seconds()))
    return {
        "evaluation": _summary(db, ev, current_user, _my_attempts(db, ev, current_user)),
        "submission_id": sub.id,
        "attempt_number": sub.attempt_number,
        "expires_at": svc.iso(sub.expires_at),
        "remaining_seconds": remaining,
        "questions": [svc.public_question(q, i) for i, q in enumerate(ev.questions or [])],
        "answers": sub.answers or {},
    }


@router.put("/evaluations/{eval_id}/progress")
async def save_progress(
    eval_id: int,
    payload: AnswersPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    """Guarda las respuestas del intento en curso (si se agota el tiempo se envía con ellas)."""
    ev = _get_visible_evaluation(db, eval_id, current_user)
    sub = _get_own_in_progress(db, ev, current_user, payload.submission_id)
    if svc.utcnow() > sub.expires_at:
        raise HTTPException(status_code=409, detail="Se agotó el tiempo de este intento.")
    sub.answers = svc.clean_answers(ev.questions or [], payload.answers)
    db.commit()
    return {"ok": True, "saved": len(sub.answers)}


@router.post("/evaluations/{eval_id}/submit")
async def submit_attempt(
    eval_id: int,
    payload: AnswersPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    """Envía el intento. El servidor califica y responde con la confirmación."""
    ev = _get_visible_evaluation(db, eval_id, current_user)
    sub = _get_own_in_progress(db, ev, current_user, payload.submission_id)
    now = svc.utcnow()
    if ev.status != "publicada":
        raise HTTPException(status_code=409, detail="La evaluación fue cerrada por el profesor.")
    if (now - sub.expires_at).total_seconds() > svc.GRACE_SECONDS:
        svc.finalize_expired_attempts(db, ev, student_id=current_user.id, now=now)
        raise HTTPException(
            status_code=409,
            detail="Se agotó el tiempo. El intento se envió con las respuestas guardadas.",
        )

    # Se califica sobre una copia fuera de la sesión para que el UPDATE
    # condicional siguiente sea el único que cambia el estado en la BD.
    graded = EvaluationSubmission()
    svc.submit_attempt(graded, ev, payload.answers, submitted_at=now)
    # Envío atómico: solo un request puede pasar el intento de "en_curso" a enviado.
    updated = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.id == sub.id,
        EvaluationSubmission.status == "en_curso",
    ).update({
        "status": graded.status,
        "answers": graded.answers,
        "results": graded.results,
        "score": graded.score,
        "max_score": graded.max_score,
        "percentage": graded.percentage,
        "submitted_at": graded.submitted_at,
        "graded_at": graded.graded_at,
        "auto_submitted": False,
    }, synchronize_session=False)
    if not updated:
        db.rollback()
        raise HTTPException(status_code=409, detail="Este intento ya fue enviado.")
    db.expire_all()
    svc.refresh_submission_counter(db, ev)
    db.commit()

    attempts = _my_attempts(db, ev, current_user)
    sent = next(a for a in attempts if a.id == sub.id)
    return {
        "ok": True,
        "message": (
            "Evaluación enviada. Tu profesor debe calificar las preguntas abiertas."
            if sent.status == "pendiente_revision" else "Evaluación enviada y calificada."
        ),
        "attempt": _attempt_out(sent),
        "evaluation": _summary(db, ev, current_user, attempts),
    }
