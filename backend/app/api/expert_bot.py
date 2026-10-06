"""
NeuroLearn AI - API de ExpertBots (MODIFICADO)
===============================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.expert_bot import ExpertBot
from app.services.license_service import require_active_license  # Mantener por compatibilidad

router = APIRouter(prefix="/expert-bots", tags=["ExpertBots"])


# ── Esquemas ────────────────────────────────────────────────────────────────

class ExpertBotBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str = "general"  # general, matemáticas, lenguaje, ciencias, etc.
    is_active: bool = True

class ExpertBotCreate(ExpertBotBase):
    pass

class ExpertBotResponse(ExpertBotBase):
    id: int
    creator_id: int
    creator_name: str
    created_at: datetime
    updated_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_expert_bots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lista los ExpertBots creados por el usuario actual.
    """
    # Solo usuarios autenticados pueden ver sus bots
    expert_bots = db.query(ExpertBot).filter(
        ExpertBot.creator_id == current_user.id
    ).all()
    
    results = []
    for bot in expert_bots:
        # Obtener nombre del creador
        creator = db.query(User).filter(User.id == bot.creator_id).first()
        creator_name = f"{creator.first_name} {creator.last_name}".strip() or creator.username
        
        results.append(ExpertBotResponse(
            id=bot.id,
            creator_id=bot.creator_id,
            creator_name=creator_name,
            created_at=bot.created_at,
            updated_at=bot.updated_at,
            is_active=bot.is_active,
        ))
    
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expert_bot(
    payload: ExpertBotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Crea un nuevo ExpertBot.
    NOTA: Ya no se aplican límites por licencia - todos los usuarios pueden crear ExpertBots ilimitados.
    """
    # Verificar que el usuario tenga permisos para crear ExpertBots
    # Según la matriz de características, tutor_ia (para estudiantes) y teacher_ai (para profesores)
    # están disponibles según el rol
    from app.services.license_service import get_license_for_user
    license_info = get_license_for_user(current_user, db)
    
    # Estudiantes necesitan tutor_ia, profesores necesitan teacher_ai
    if current_user.role == UserRole.ESTUDIANTE.value:
        required_feature = "tutor_ia"
    elif current_user.role in {UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value}:
        required_feature = "teacher_ai"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol del usuario no permite crear ExpertBots.",
        )
    
    if not license_info.has_feature(required_feature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"La funcionalidad '{required_feature}' no está disponible para tu rol.",
        )
    
    # NOTA: Ya no se verifica límite de bots por licencia
    # Todos los usuarios pueden crear ExpertBots ilimitados
    
    bot = ExpertBot(
        name=payload.name,
        description=payload.description or "",
        category=payload.category,
        creator_id=current_user.id,
        is_active=payload.is_active,
    )
    
    db.add(bot)
    db.commit()
    db.refresh(bot)
    
    # Obtener nombre del creador
    creator = db.query(User).filter(User.id == current_user.id).first()
    creator_name = f"{creator.first_name} {creator.last_name}".strip() or creator.username
    
    return ExpertBotResponse(
        id=bot.id,
        creator_id=bot.creator_id,
        creator_name=creator_name,
        created_at=bot.created_at,
        updated_at=bot.updated_at,
        is_active=bot.is_active,
    )


@router.get("/{bot_id}", response_model=ExpertBotResponse)
async def get_expert_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Obtiene los detalles de un ExpertBot específico.
    """
    bot = db.query(ExpertBot).filter(
        ExpertBot.id == bot_id,
        ExpertBot.creator_id == current_user.id
    ).first()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ExpertBot no encontrado o no tienes permiso para acceder a él."
        )
    
    # Obtener nombre del creador
    creator = db.query(User).filter(User.id == bot.creator_id).first()
    creator_name = f"{creator.first_name} {creator.last_name}".strip() or creator.username
    
    return ExpertBotResponse(
        id=bot.id,
        creator_id=bot.creator_id,
        creator_name=creator_name,
        created_at=bot.created_at,
        updated_at=bot.updated_at,
        is_active=bot.is_active,
    )


@router.put("/{bot_id}", response_model=ExpertBotResponse)
async def update_expert_bot(
    bot_id: int,
    payload: ExpertBotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Actualiza un ExpertBot existente.
    """
    bot = db.query(ExpertBot).filter(
        ExpertBot.id == bot_id,
        ExpertBot.creator_id == current_user.id
    ).first()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ExpertBot no encontrado o no tienes permiso para acceder a él."
        )
    
    # Verificar que el usuario tenga permisos para actualizar ExpertBots
    from app.services.license_service import get_license_for_user
    license_info = get_license_for_user(current_user, db)
    
    if current_user.role == UserRole.ESTUDIANTE.value:
        required_feature = "tutor_ia"
    elif current_user.role in {UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value}:
        required_feature = "teacher_ai"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol del usuario no permite actualizar ExpertBots.",
        )
    
    if not license_info.has_feature(required_feature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"La funcionalidad '{required_feature}' no está disponible para tu rol.",
        )
    
    # Actualizar campos
    bot.name = payload.name
    bot.description = payload.description or ""
    bot.category = payload.category
    bot.is_active = payload.is_active
    
    db.commit()
    db.refresh(bot)
    
    # Obtener nombre del creador
    creator = db.query(User).filter(User.id == current_user.id).first()
    creator_name = f"{creator.first_name} {creator.last_name}".strip() or creator.username
    
    return ExpertBotResponse(
        id=bot.id,
        creator_id=bot.creator_id,
        creator_name=creator_name,
        created_at=bot.created_at,
        updated_at=bot.updated_at,
        is_active=bot.is_active,
    )


@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expert_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Elimina un ExpertBot existente.
    """
    bot = db.query(ExpertBot).filter(
        ExpertBot.id == bot_id,
        ExpertBot.creator_id == current_user.id
    ).first()
    
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ExpertBot no encontrado o no tienes permiso para acceder a él."
        )
    
    db.delete(bot)
    db.commit()
    
    return None


# Mantener funciones de compatibilidad pero simplificadas
def _require_expert_bot_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    from app.services.license_service import get_license_for_user
    license_info = get_license_for_user(user, None)  # db será None en compatibilidad
    if current_user.role == UserRole.ESTUDIANTE.value:
        required_feature = "tutor_ia"
    elif current_user.role in {UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value}:
        required_feature = "teacher_ai"
    else:
        return False
    return license_info.has_feature(required_feature)