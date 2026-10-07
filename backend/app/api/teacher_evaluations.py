"""
NeuroLearn AI - Evaluaciones del Profesor
CRUD para evaluaciones (cuestionarios y exámenes) con preguntas en JSON.
"""
import re
from datetime import datetime
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.orm import Session

from app.db.database import Base, get_db
from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.classroom import Classroom
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


# ─── Schemas de entrada ──────────────────────────────────────────────────────

TRUE_FALSE_OPTIONS = ["Verdadero", "Falso"]


class EvaluationQuestionIn(BaseModel):
    """Pregunta tal como la arma EvaluacionesTab (manual o generada con IA)."""
    id: Optional[str] = Field(None, max_length=60)
    type: Literal["multiple", "truefalse", "open", "match"]
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
    group: str = Field(..., max_length=120)
    type: Literal["cuestionario", "examen"] = "cuestionario"
    date: str = Field("", max_length=20)
    duration: int = Field(30, ge=5, le=180)
    attempts: int = Field(1, ge=1, le=5)
    questions: List[EvaluationQuestionIn] = Field(..., max_length=100)

    @field_validator("title", "group")
    @classmethod
    def _strip_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Campo obligatorio.")
        return value

    @field_validator("date")
    @classmethod
    def _date_format(cls, value: str) -> str:
        value = (value or "").strip()
        if value and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
            raise ValueError("La fecha debe tener el formato AAAA-MM-DD.")
        return value


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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
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
    data: EvaluationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
):
    """
    Crea una evaluación con sus preguntas (manuales o generadas con IA y
    revisadas por el profesor). El grupo debe ser una de las aulas del profesor.
    """
    if not data.questions:
        raise HTTPException(status_code=400, detail="Debe incluir al menos una pregunta.")

    owns_group = db.query(Classroom.id).filter(
        Classroom.teacher_id == current_user.id,
        Classroom.name == data.group,
        Classroom.is_active == True,  # noqa: E712
    ).first()
    if not owns_group:
        raise HTTPException(status_code=400, detail="Selecciona uno de tus grupos.")

    questions = []
    for i, q in enumerate(data.questions, start=1):
        item = q.model_dump(exclude_none=True)
        item["id"] = item.get("id") or f"q{i}"
        questions.append(item)

    ev = TeacherEvaluation(
        teacher_id=current_user.id,
        title=data.title,
        group_name=data.group,
        eval_type=data.type,
        date=data.date,
        duration=data.duration,
        attempts=data.attempts,
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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_EVALUACIONES)),
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
