"""
NeuroLearn AI - Evaluaciones del Profesor
CRUD para evaluaciones (cuestionarios y exámenes) con preguntas en JSON.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import Base, get_db
from app.api.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/teacher", tags=["Teacher Evaluations"])


# ─── Modelo ──────────────────────────────────────────────────────────────────

class TeacherEvaluation(Base):
    __tablename__ = "teacher_evaluations"
    id          = Column(Integer, primary_key=True, index=True)
    teacher_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    title       = Column(String(200), nullable=False)
    group_name  = Column(String(120), default="")
    eval_type   = Column(String(30), default="cuestionario")   # cuestionario | examen
    date        = Column(String(20), default="")
    duration    = Column(Integer, default=30)   # minutos
    attempts    = Column(Integer, default=1)
    questions   = Column(JSON, default=[])
    active      = Column(Boolean, default=True)
    submissions = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ─── Helper ──────────────────────────────────────────────────────────────────

def _eval_out(ev: TeacherEvaluation) -> dict:
    return {
        "id":          ev.id,
        "title":       ev.title,
        "group":       ev.group_name,
        "type":        ev.eval_type,
        "date":        ev.date,
        "duration":    ev.duration,
        "attempts":    ev.attempts,
        "questions":   ev.questions or [],
        "active":      ev.active,
        "submissions": ev.submissions,
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/evaluations")
async def list_evaluations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todas las evaluaciones del profesor."""
    evals = (
        db.query(TeacherEvaluation)
        .filter(TeacherEvaluation.teacher_id == current_user.id)
        .order_by(TeacherEvaluation.created_at.desc())
        .all()
    )
    return {"evaluations": [_eval_out(e) for e in evals]}


@router.post("/evaluations", status_code=201)
async def create_evaluation(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Crea una nueva evaluación con sus preguntas."""
    title = (data.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="El título es obligatorio.")
    questions = data.get("questions", [])
    if not questions:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una pregunta.")

    ev = TeacherEvaluation(
        teacher_id=current_user.id,
        title=title,
        group_name=data.get("group", ""),
        eval_type=data.get("type", "cuestionario"),
        date=data.get("date", ""),
        duration=int(data.get("duration", 30)),
        attempts=int(data.get("attempts", 1)),
        questions=questions,
        active=True,
        submissions=0,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _eval_out(ev)


@router.post("/evaluations/{eval_id}/toggle")
async def toggle_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Activa o desactiva una evaluación."""
    ev = db.query(TeacherEvaluation).filter(
        TeacherEvaluation.id == eval_id,
        TeacherEvaluation.teacher_id == current_user.id,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
    ev.active = not ev.active
    db.commit()
    db.refresh(ev)
    return _eval_out(ev)


@router.delete("/evaluations/{eval_id}", status_code=204)
async def delete_evaluation(
    eval_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Elimina una evaluación."""
    ev = db.query(TeacherEvaluation).filter(
        TeacherEvaluation.id == eval_id,
        TeacherEvaluation.teacher_id == current_user.id,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada.")
    db.delete(ev)
    db.commit()
