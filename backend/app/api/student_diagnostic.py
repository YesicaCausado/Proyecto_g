"""
NeuroLearn IA — API del diagnóstico inicial (RF-13).

El tutor de IA aplica 10 preguntas por competencia (una sola vez por
competencia), las califica y escribe su evaluación de las respuestas, que se
guarda con el resultado (tutor_feedback).

Estudiante:
    GET  /api/v1/student/diagnostic           estado de las cinco competencias
    GET  /api/v1/student/diagnostic/{key}     preguntas (sin respuestas) o resultado si ya lo presentó
    POST /api/v1/student/diagnostic/{key}     enviar {answers: {question_id: índice}, duration_seconds?}

Profesor (solo sus aulas):
    GET  /api/v1/teacher/classrooms/{classroom_id}/diagnostics
"""
from typing import Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.ai.providers.ai_manager import AIManager
from app.api.auth import require_permission
from app.core.config import settings
from app.core.permissions import Permission
from app.db.database import get_db
from app.models.classroom import Classroom, Enrollment
from app.models.diagnostic import DiagnosticResult
from app.models.user import User
from app.services import diagnostic_service as svc
from app.services.competencies import COMP_KEYS, COMP_NAMES, classroom_competency, valid_key
from app.services.diagnostic_bank import public_question, questions_for

router = APIRouter(prefix="/student/diagnostic", tags=["Diagnóstico inicial"])
teacher_router = APIRouter(prefix="/teacher/classrooms", tags=["Diagnóstico inicial"])

# Mismo gestor que el tutor (Groq → Gemini); sin IA la evaluación es local.
ai_manager = AIManager(
    groq_api_key=settings.GROQ_API_KEY,
    groq_model=settings.GROQ_MODEL,
    gemini_api_key=settings.GEMINI_API_KEY,
    gemini_model=settings.GEMINI_MODEL,
    total_timeout=settings.AI_TOTAL_TIMEOUT,
)


class DiagnosticSubmit(BaseModel):
    answers: Dict[str, int]
    duration_seconds: Optional[int] = Field(default=None, ge=0, le=24 * 3600)


def _iso(dt):
    return dt.replace(microsecond=0).isoformat() + "Z" if dt else None


def _competency_or_404(key: str) -> str:
    if valid_key(key) is None:
        raise HTTPException(404, "Competencia no encontrada.")
    return key


def _summary(result: DiagnosticResult) -> dict:
    return {
        **svc.level_info(result.level),
        "score": result.score,
        "correct_count": result.correct_count,
        "total_questions": result.total_questions,
        "topic_results": result.topic_results or [],
        "weak_topics": svc.weak_topics(result.topic_results or []),
        "tutor_feedback": result.tutor_feedback,
        "feedback_provider": result.feedback_provider,
        "completed_at": _iso(result.completed_at),
    }


def _results_by_competency(db: Session, user_id: int) -> Dict[str, DiagnosticResult]:
    rows = db.query(DiagnosticResult).filter(DiagnosticResult.user_id == user_id).all()
    return {r.competency: r for r in rows}


@router.get("")
def diagnostic_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REALIZAR_DIAGNOSTICO)),
):
    """Qué competencias ya diagnosticó el estudiante y con qué nivel."""
    done = _results_by_competency(db, current_user.id)
    items = [
        {
            "key": key,
            "name": COMP_NAMES[key],
            "total_questions": len(questions_for(key)),
            "completed": key in done,
            "result": _summary(done[key]) if key in done else None,
        }
        for key in COMP_KEYS
    ]
    return {"competencies": items, "completed_count": len(done), "total": len(COMP_KEYS)}


@router.get("/{key}")
def diagnostic_detail(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REALIZAR_DIAGNOSTICO)),
):
    """Preguntas sin respuestas o, si ya lo presentó, su resultado con la revisión."""
    key = _competency_or_404(key)
    result = (db.query(DiagnosticResult)
              .filter(DiagnosticResult.user_id == current_user.id, DiagnosticResult.competency == key)
              .first())
    base = {"key": key, "name": COMP_NAMES[key]}
    if result is not None:
        review = svc.grade(key, result.answers or {})["review"]
        return {**base, "completed": True, "result": _summary(result), "review": review}
    return {**base, "completed": False, "questions": [public_question(q) for q in questions_for(key)]}


@router.post("/{key}", status_code=201)
async def submit_diagnostic(
    key: str,
    payload: DiagnosticSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.REALIZAR_DIAGNOSTICO)),
):
    """Califica, pide la evaluación al tutor y guarda el diagnóstico (una vez por competencia)."""
    key = _competency_or_404(key)
    questions = {q["id"]: q for q in questions_for(key)}

    unknown = set(payload.answers) - set(questions)
    if unknown:
        raise HTTPException(400, "Hay respuestas a preguntas que no pertenecen a este diagnóstico.")
    missing = set(questions) - set(payload.answers)
    if missing:
        raise HTTPException(400, f"Debes responder las {len(questions)} preguntas antes de enviar.")
    for qid, chosen in payload.answers.items():
        if not 0 <= chosen < len(questions[qid]["options"]):
            raise HTTPException(400, "Una de las respuestas no corresponde a una opción válida.")

    exists = (db.query(DiagnosticResult.id)
              .filter(DiagnosticResult.user_id == current_user.id, DiagnosticResult.competency == key)
              .first())
    if exists:
        raise HTTPException(409, "Ya presentaste el diagnóstico inicial de esta competencia.")

    graded = svc.grade(key, payload.answers)
    feedback, provider = await svc.tutor_evaluation(ai_manager, COMP_NAMES[key], graded)
    result = DiagnosticResult(
        user_id=current_user.id,
        competency=key,
        correct_count=graded["correct_count"],
        total_questions=graded["total_questions"],
        score=graded["score"],
        level=graded["level"],
        answers=dict(payload.answers),
        topic_results=graded["topic_results"],
        duration_seconds=payload.duration_seconds,
        tutor_feedback=feedback,
        feedback_provider=provider,
    )
    db.add(result)
    try:
        db.commit()
    except IntegrityError:
        # Doble envío simultáneo: el otro ya quedó guardado.
        db.rollback()
        raise HTTPException(409, "Ya presentaste el diagnóstico inicial de esta competencia.")
    db.refresh(result)
    return {"key": key, "name": COMP_NAMES[key], "completed": True,
            "result": _summary(result), "review": graded["review"]}


@teacher_router.get("/{classroom_id}/diagnostics")
def classroom_diagnostics(
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
):
    """Nivel inicial de los estudiantes activos de un aula del profesor."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if classroom is None or classroom.teacher_id != current_user.id:
        raise HTTPException(404, "Clase no encontrada.")

    students = (db.query(User)
                .join(Enrollment, Enrollment.student_id == User.id)
                .filter(Enrollment.classroom_id == classroom_id,
                        Enrollment.is_active.is_(True),
                        Enrollment.removed_at.is_(None))
                .order_by(User.full_name)
                .all())
    ids = [s.id for s in students]
    rows = (db.query(DiagnosticResult).filter(DiagnosticResult.user_id.in_(ids)).all() if ids else [])
    by_student: Dict[int, Dict[str, DiagnosticResult]] = {}
    for r in rows:
        by_student.setdefault(r.user_id, {})[r.competency] = r

    return {
        "classroom_id": classroom_id,
        "competency": classroom_competency(classroom),
        "students": [
            {
                "id": s.id,
                "full_name": s.full_name,
                "diagnostics": {k: _summary(r) for k, r in by_student.get(s.id, {}).items()},
            }
            for s in students
        ],
    }
