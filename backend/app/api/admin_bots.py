"""
NeuroLearn AI — Admin: Moderación de Bots
==========================================
Endpoints para la moderación global de bots (públicos/privados) y
consulta de bots pre-entrenados.

  GET   /admin/bots               → lista todos los bots del sistema
  GET   /admin/bots/pretrained    → bots pre-entrenados (data/trained_bots)
  PATCH /admin/bots/{bot_id}      → cambiar visibilidad (is_public) / estado (is_active)
"""
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.expert_bot import ExpertBot
from app.models.learning import LearningSession, ChatMessage
from app.ai.expert_bot.persistence import list_bots as list_pretrained_bots

router = APIRouter(prefix="/admin/bots", tags=["Admin - Moderación de Bots"])


def _require_admin(user: User):
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el administrador puede moderar bots")


def _admin_bot_out(bot: ExpertBot, db: Session) -> dict:
    """Convierte un ExpertBot al formato que consume la UI de moderación."""
    session_count = (
        db.query(LearningSession)
        .filter(LearningSession.bot_id == bot.id)
        .count()
    )
    return {
        "id": bot.id,
        "name": bot.name,
        "description": bot.description or "",
        "category": bot.subject_area or bot.category or "",
        "creator_id": bot.creator_id,
        "creator_name": bot.creator.full_name if bot.creator else "",
        "is_public": bot.is_public,
        "is_active": bot.is_active,
        "total_users": bot.total_users or 0,
        "avg_rating": bot.avg_rating or 0.0,
        "total_sessions": session_count,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
    }


@router.get("")
async def list_all_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos los bots del sistema (para moderación global)."""
    _require_admin(current_user)

    bots = db.query(ExpertBot).order_by(ExpertBot.created_at.desc()).all()
    return {"bots": [_admin_bot_out(b, db) for b in bots]}


@router.get("/pretrained")
async def list_pretrained(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista los bots pre-entrenados disponibles (data/trained_bots/*.json)."""
    _require_admin(current_user)

    try:
        bots = list_pretrained_bots()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo bots pre-entrenados: {e}")

    return {"bots": bots}


class AdminBotPatchPayload(BaseModel):
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None


@router.patch("/{bot_id}")
async def patch_bot(
    bot_id: int,
    payload: AdminBotPatchPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cambia la visibilidad o el estado de un bot (moderación global)."""
    _require_admin(current_user)

    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    if payload.is_public is not None:
        bot.is_public = payload.is_public
    if payload.is_active is not None:
        bot.is_active = payload.is_active

    db.commit()
    db.refresh(bot)

    return _admin_bot_out(bot, db)