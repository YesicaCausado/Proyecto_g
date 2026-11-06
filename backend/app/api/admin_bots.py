"""
NeuroLearn AI — Admin: Moderación de Bots
==========================================
Endpoints para la moderación global de bots (públicos/privados).

  GET   /admin/bots               → lista todos los bots del sistema
  GET   /admin/bots/base          → NeuroBots base de las cinco competencias (solo lectura)
  PATCH /admin/bots/{bot_id}      → cambiar visibilidad (is_public) / estado (is_active)
"""
from collections import defaultdict
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.expert_bot import ExpertBot
from app.models.diagnostic import DiagnosticResult
from app.models.learning import LearningSession, ChatMessage
from app.services.competencies import COMPETENCIES, classify_competency
from app.services.diagnostic_bank import questions_for

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
        "category": bot.category or "",
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
def list_all_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lista todos los bots del sistema (para moderación global)."""
    _require_admin(current_user)

    bots = db.query(ExpertBot).order_by(ExpertBot.created_at.desc()).all()
    return {"bots": [_admin_bot_out(b, db) for b in bots]}


@router.get("/base")
def list_base_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """NeuroBots base preentrenados: el tutor de cada una de las cinco competencias.

    Vienen con la plataforma (no los crea ningún profesor), así que no se
    editan ni se moderan: se consultan con sus temas preentrenados (los del
    banco del diagnóstico inicial) y su uso real.
    """
    _require_admin(current_user)

    # Sesiones del tutor general (sin NeuroBot) agrupadas por tema; el tema
    # se clasifica en Python porque es texto libre.
    usage = defaultdict(lambda: {"sessions": 0, "students": set(), "last": None})
    rows = (
        db.query(LearningSession.topic, LearningSession.user_id,
                 func.count(LearningSession.id), func.max(LearningSession.started_at))
        .filter(LearningSession.bot_id.is_(None))
        .group_by(LearningSession.topic, LearningSession.user_id)
        .all()
    )
    for topic, user_id, count, last in rows:
        key = classify_competency(topic)
        if key is None:
            continue
        u = usage[key]
        u["sessions"] += count
        u["students"].add(user_id)
        if last and (u["last"] is None or last > u["last"]):
            u["last"] = last
    diagnostics = dict(
        db.query(DiagnosticResult.competency, func.count(DiagnosticResult.id))
        .group_by(DiagnosticResult.competency).all()
    )

    bots = []
    for key, name in COMPETENCIES:
        topics = list(dict.fromkeys(q["topic"] for q in questions_for(key)))
        u = usage[key]
        bots.append({
            "key": key,
            "name": f"Tutor de {name}",
            "competency": name,
            "is_base": True,
            "is_active": True,
            "topics": topics,
            "diagnostic_questions": len(questions_for(key)),
            "total_sessions": u["sessions"],
            "total_students": len(u["students"]),
            "diagnostics_completed": diagnostics.get(key, 0),
            "last_activity_at": u["last"].isoformat() if u["last"] else None,
        })
    return {"bots": bots}


class AdminBotPatchPayload(BaseModel):
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None


@router.patch("/{bot_id}")
def patch_bot(
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