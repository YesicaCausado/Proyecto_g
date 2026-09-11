"""
NeuroLearn AI — Gestión de Expert Bots
=====================================
Endpoints para CRUD, creación y compartición de bots expertos
"""
import secrets
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.expert_bot import ExpertBot
from app.models.learning import ChatMessage, LearningSession
from app.services.license_service import NEUROBOT_LIMITS

# Router montado en main.py con prefix="/api/v1/bots".
# (El antiguo `prefix="/expert-bots"` se eliminó para evitar rutas duplicadas
# tipo /api/v1/bots/expert-bots/... que el frontend no consumía.)
router = APIRouter(tags=["Expert Bots"])


class BotCreatePayload(BaseModel):
    name: str
    description: Optional[str] = None
    # Main field: category (technology, medicine, etc.)
    category: Optional[str] = None
    # Alias used by some codepaths (subject_area)
    subject_area: Optional[str] = None
    is_public: bool = False
    knowledge_base: Optional[list] = None
    language: str = "es"


class BotSharePayload(BaseModel):
    bot_id: int
    share_with: str  # "public" o email
    access_level: str = "view"  # view, train, admin


class BotPatchPayload(BaseModel):
    """Payload ligero para actualizaciones parciales (PATCH)."""
    name: Optional[str] = None
    description: Optional[str] = None
    subject_area: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None
    is_active: Optional[bool] = None
    language: Optional[str] = None


# ─── GET /bots (montado en main.py con prefix="/api/v1/bots") ─────────────────
@router.get("/")
async def list_bots(
    creator_id: Optional[int] = Query(None, description="Filtrar por creador"),
    is_public: Optional[bool] = Query(None, description="Solo bots públicos"),
    search: Optional[str] = Query(None, description="Buscar por nombre o descripción"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista todos los bots expertos.
    
    - creator_id: Filtrar por creador (solo usuario)
    - is_public: Filtrar bots públicos (default: true para usuarios no admin)
    - search: Buscar por nombre o descripción
    """
    query = db.query(ExpertBot)

    # Restringir acceso según rol
    if current_user.role != UserRole.SUPER_PROFESOR.value and current_user.role != UserRole.ADMIN.value:
        # Solo mostrar bots públicos o creados por el usuario
        if is_public is None:
            is_public = True
        query = query.filter(ExpertBot.is_public == is_public)
        if creator_id is not None:
            query = query.filter(ExpertBot.creator_id == creator_id)
    else:
        # Admin/Super pueden ver todos
        if creator_id is not None:
            query = query.filter(ExpertBot.creator_id == creator_id)

    if search:
        term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                ExpertBot.name.ilike(term),
                ExpertBot.description.ilike(term)
            )
        )

    bots = query.order_by(ExpertBot.created_at.desc()).all()

    return {
        "bots": [
            {
                "id": bot.id,
                "name": bot.name,
                "description": bot.description or "",
                "category": bot.category or "",
                "subject": bot.category or "",
                "subject_area": bot.category or "",
                "creator_id": bot.creator_id,
                "creator_name": bot.creator.full_name if bot.creator else "",
                "is_public": bot.is_public,
                "knowledge_base_size": getattr(bot, "knowledge_base_size", 0),
                "created_at": bot.created_at.isoformat() if bot.created_at else None,
                "message_count": db.query(ChatMessage).join(
                    LearningSession, ChatMessage.session_id == LearningSession.id
                ).filter(LearningSession.bot_id == bot.id).count()
            }
            for bot in bots
        ]
    }


# ─── GET /my-bots (bots del usuario actual) ────────────────────────────────────
@router.get("/my-bots")
async def list_my_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista los bots creados por el usuario actual.
    Formato consumido por el frontend del profesor (NeuroBotsTab): {bots: [...]}.
    """
    bots = (
        db.query(ExpertBot)
        .filter(ExpertBot.creator_id == current_user.id)
        .order_by(ExpertBot.created_at.desc())
        .all()
    )
    return {"bots": [_build_bot_response(b) for b in bots]}


# ─── GET /bots/{bot_id} ────────────────────────────────────────────────────────
@router.get("/{bot_id}")
async def get_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene detalles completos de un bot.
    
    Permite acceder a bots públicos o creados por el usuario actual.
    """
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    # Verificar permisos
    if not bot.is_public and bot.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Acceso denegado. El bot es privado.")

    return {
        "id": bot.id,
        "name": bot.name,
        "description": bot.description or "",
        "subject_area": bot.category or "",
        "creator_id": bot.creator_id,
        "creator_name": bot.creator.full_name if bot.creator else "",
        "is_public": bot.is_public,
        "language": "es",
        "knowledge_base": getattr(bot, "knowledge_base", []),
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else None,
        "message_count": db.query(ChatMessage).join(
            LearningSession, ChatMessage.session_id == LearningSession.id
        ).filter(LearningSession.bot_id == bot_id).count(),
        "usage_stats": {
            "total_messages": db.query(ChatMessage).join(
                LearningSession, ChatMessage.session_id == LearningSession.id
            ).filter(LearningSession.bot_id == bot_id).count(),
            "unique_users": db.query(LearningSession.user_id).filter(
                LearningSession.bot_id == bot_id
            ).distinct().count()
        }
    }


# ─── POST /bots + /bots/create ────────────────────────────────────────────────
def _build_bot_response(bot: ExpertBot) -> dict:
    """Respuesta normalizada del bot que consume el frontend (NeuroBotsTab)."""
    return {
        "id": bot.id,
        "name": bot.name,
        "description": bot.description or "",
        "category": bot.category or "",
        "subject": bot.category or "",
        "subject_area": bot.category or "",
        "creator_id": bot.creator_id,
        "is_public": bot.is_public,
        "is_active": bot.is_active,
        "total_users": bot.total_users or 0,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else None,
    }


@router.post("/")
@router.post("/create")
async def create_bot(
    payload: BotCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crea un nuevo bot experto.

    Acepta tanto `category` como el alias `subject_area`.
    """
    if current_user.role not in [UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Solo profesores, super profesores y admins pueden crear bots")

    # Resolver categoría (campo principal) o alias subject_area
    category = payload.category or payload.subject_area or ""

    # Verificar cupos de la institución
    institution = current_user.institution
    if institution and institution.license_type:
        limits = NEUROBOT_LIMITS.get(institution.license_type, NEUROBOT_LIMITS["basica"])
        if db.query(ExpertBot).filter(ExpertBot.creator_id == current_user.id).count() >= limits:
            raise HTTPException(status_code=400, detail=f"Límite de bots alcanzado: {limits}")

    bot = ExpertBot(
        name=payload.name,
        description=payload.description or "",
        category=category,
        creator_id=current_user.id,
        is_public=payload.is_public,
        language=payload.language,
        knowledge_base=payload.knowledge_base or {},
    )

    db.add(bot)
    db.commit()
    db.refresh(bot)

    return _build_bot_response(bot)


# ─── PUT /bots/{bot_id} ────────────────────────────────────────────────────────
@router.put("/{bot_id}")
async def update_bot(
    bot_id: int,
    payload: BotCreatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualiza información de un bot existente.
    """
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    # Solo creador o admin puede editar
    if bot.creator_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el creador o admin puede editar el bot")

    # Actualizar campos
    if payload.name is not None:
        bot.name = payload.name
    if payload.description is not None:
        bot.description = payload.description
    # Determine category from payload.category (main) or payload.subject_area (alias)
    if payload.category is not None:
        bot.category = payload.category
    elif payload.subject_area is not None:
        bot.category = payload.subject_area
    # If neither provided, keep existing category
    if payload.is_public is not None:
        bot.is_public = payload.is_public
    if payload.language is not None:
        bot.language = payload.language
    if payload.knowledge_base is not None:
        bot.knowledge_base = payload.knowledge_base

    db.commit()
    db.refresh(bot)

    return _build_bot_response(bot)


# ─── PATCH /{bot_id} (actualización parcial — toggle is_active/is_public) ─────
@router.patch("/{bot_id}")
async def patch_bot(
    bot_id: int,
    payload: BotPatchPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Actualización parcial de un bot (usada por el frontend para
    activar/desactivar y cambiar visibilidad).
    """
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    if bot.creator_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el creador o admin puede editar el bot")

    if payload.name is not None:
        bot.name = payload.name
    if payload.description is not None:
        bot.description = payload.description
    # Determine category from payload.category (main) or payload.subject_area (alias)
    if payload.category is not None:
        bot.category = payload.category
    elif payload.subject_area is not None:
        bot.category = payload.subject_area
    # If neither provided, keep existing category
    if payload.is_public is not None:
        bot.is_public = payload.is_public
    if payload.is_active is not None:
        bot.is_active = payload.is_active
    if payload.language is not None:
        bot.language = payload.language

    db.commit()
    db.refresh(bot)

    return _build_bot_response(bot)


# ─── DELETE /bots/{bot_id} ─────────────────────────────────────────────────────
@router.delete("/{bot_id}")
async def delete_bot(
    bot_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Elimina un bot experto.
    
    Solo el creador o admin puede eliminar.
    """
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    if bot.creator_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el creador o admin puede eliminar el bot")

    db.delete(bot)
    db.commit()

    return {"ok": True, "message": "Bot eliminado correctamente"}


# ─── POST /bots/{bot_id}/share ─────────────────────────────────────────────────
@router.post("/{bot_id}/share")
async def share_bot(
    bot_id: int,
    payload: BotSharePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Comparte un bot con otros usuarios.
    
    - bot_id: ID del bot a compartir
    - share_with: "public" para hacer público, o email de usuario
    - access_level: "view" (solo lectura), "train" (puede entrenar), "admin" (puede editar)
    """
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    # Solo creador o admin puede compartir
    if bot.creator_id != current_user.id and current_user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el creador o admin puede compartir el bot")

    if payload.share_with == "public":
        bot.is_public = True
        db.commit()
        db.refresh(bot)

        return {
            "ok": True,
            "message": "Bot ahora es público",
            "bot": {
                "id": bot.id,
                "name": bot.name,
                "is_public": bot.is_public
            }
        }
    else:
        # Compartir con usuario específico
        from app.models.user import User as UserModel
        user_to_share = db.query(UserModel).filter(UserModel.email == payload.share_with).first()
        if not user_to_share:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")

        # Aquí crearías una relación de compartición en una tabla nueva
        # share_table: bot_id, user_id, access_level, created_at
        return {
            "ok": True,
            "message": f"Bot compartido con {user_to_share.username} (acceso: {payload.access_level})",
            "bot": {
                "id": bot.id,
                "name": bot.name,
                "shared_with": payload.share_with
            }
        }