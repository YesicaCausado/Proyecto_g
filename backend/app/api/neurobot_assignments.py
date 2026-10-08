"""
NeuroLearn IA — Asignación de NeuroBots, «Mis NeuroBots» y resultados.

    Estudiante
      GET    /bots/assigned-to-me                     NeuroBots asignados + progreso real
      GET    /bots/assigned-to-me/{bot_id}            Detalle de uno (destino de la notificación)

    Profesor (dueño de los grupos)
      GET    /bots/{bot_id}/assignments               Grupos y estudiantes con su estado de asignación
      POST   /bots/{bot_id}/assignments               Asigna a grupos y/o estudiantes con meta
      DELETE /bots/{bot_id}/assignments/classrooms/{classroom_id}
      DELETE /bots/{bot_id}/assignments/students/{student_id}

    Profesor / Súper Profesor / Administrador
      GET    /bots/{bot_id}/progress                  Resultados por estudiante

Se registra ANTES del router de expert_bot para que /bots/assigned-to-me no
sea capturado por /bots/{bot_id}.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_permission
from app.core.permissions import FORBIDDEN_MESSAGE, Permission
from app.db.database import get_db
from app.models.expert_bot import ExpertBot
from app.models.user import User, UserRole
from app.services import neurobot_service as svc
from app.services.bot_documents import _same_institution, can_use_bot

router = APIRouter(tags=["NeuroBots — Asignación y progreso"])


class AssignPayload(BaseModel):
    classroom_ids: List[int] = Field(default_factory=list)
    student_ids: List[int] = Field(default_factory=list)
    goal_interactions: int = svc.DEFAULT_GOAL_INTERACTIONS


def _raise(exc: svc.NeuroBotError):
    raise HTTPException(status_code=exc.status_code, detail=exc.message)


def _get_bot(db: Session, bot_id: int) -> ExpertBot:
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if bot is None:
        raise HTTPException(status_code=404, detail="NeuroBot no encontrado")
    return bot


def _bot_for_teacher(db: Session, bot_id: int, teacher: User) -> ExpertBot:
    bot = _get_bot(db, bot_id)
    if not can_use_bot(db, teacher, bot):
        raise HTTPException(status_code=403,
                            detail="Solo puedes asignar tus NeuroBots o los públicos de tu institución.")
    if not bot.is_active:
        raise HTTPException(status_code=409, detail="El NeuroBot está desactivado; actívalo antes de asignarlo.")
    return bot


# ── Estudiante ─────────────────────────────────────────────────────────────

@router.get("/assigned-to-me")
async def my_assigned_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    bots = svc.student_bots(db, current_user)
    return {"bots": bots, "total": len(bots)}


@router.get("/assigned-to-me/{bot_id}")
async def my_assigned_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
):
    try:
        return svc.student_bot_detail(db, current_user, bot_id)
    except svc.NeuroBotError as exc:
        _raise(exc)


# ── Profesor ───────────────────────────────────────────────────────────────

@router.get("/{bot_id}/assignments")
async def get_assignments(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
):
    bot = _bot_for_teacher(db, bot_id, current_user)
    return svc.assignments_overview(db, current_user, bot)


@router.post("/{bot_id}/assignments")
async def create_assignments(
    bot_id: int,
    payload: AssignPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
):
    bot = _bot_for_teacher(db, bot_id, current_user)
    try:
        summary = svc.assign(db, current_user, bot, payload.classroom_ids, payload.student_ids,
                             payload.goal_interactions)
        db.commit()  # asignación + notificaciones en una sola transacción
    except svc.NeuroBotError as exc:
        db.rollback()
        _raise(exc)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="No fue posible asignar el NeuroBot.")
    return {**summary, "assignments": svc.assignments_overview(db, current_user, bot)}


@router.delete("/{bot_id}/assignments/classrooms/{classroom_id}")
async def delete_classroom_assignment(
    bot_id: int,
    classroom_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
):
    bot = _get_bot(db, bot_id)
    try:
        svc.unassign_classroom(db, current_user, bot, classroom_id)
        db.commit()
    except svc.NeuroBotError as exc:
        db.rollback()
        _raise(exc)
    return {"ok": True, "assignments": svc.assignments_overview(db, current_user, bot)}


@router.delete("/{bot_id}/assignments/students/{student_id}")
async def delete_student_assignment(
    bot_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
):
    bot = _get_bot(db, bot_id)
    try:
        svc.unassign_student(db, current_user, bot, student_id)
        db.commit()
    except svc.NeuroBotError as exc:
        db.rollback()
        _raise(exc)
    return {"ok": True, "assignments": svc.assignments_overview(db, current_user, bot)}


# ── Resultados ─────────────────────────────────────────────────────────────

@router.get("/{bot_id}/progress")
async def bot_results(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permission.VER_RESULTADOS_NEUROBOT)),
):
    bot = _get_bot(db, bot_id)
    if current_user.role != UserRole.ADMIN.value and not _same_institution(current_user, bot):
        raise HTTPException(status_code=403, detail=FORBIDDEN_MESSAGE)
    return svc.results(db, current_user, bot)
