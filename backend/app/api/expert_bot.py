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
from app.models.classroom import Classroom, Enrollment, ClassroomBot
from app.models.learning import ChatMessage, LearningSession
from app.models.bot_document import BotDocument
from app.services.bot_documents import can_use_bot, delete_bot_documents
from app.core.permissions import FORBIDDEN_MESSAGE


def _same_institution_creators(query, user: User):
    """
    Aislamiento por institución: limita la consulta a bots creados por usuarios
    de la institución de `user` o por el Administrador (bots globales, sin
    institución). Misma regla que `can_use_bot`.
    """
    query = query.join(User, ExpertBot.creator_id == User.id)
    if user.institution_id is None:
        return query.filter(User.institution_id.is_(None))
    return query.filter(
        or_(User.institution_id == user.institution_id, User.institution_id.is_(None))
    )


def _is_institution_super(user: User, bot: ExpertBot) -> bool:
    """Súper Profesor de la institución del creador: supervisa (activa,
    desactiva o retira) los NeuroBots de su institución, sin editar su contenido."""
    creator = bot.creator
    return (
        user.role == UserRole.SUPER_PROFESOR.value
        and creator is not None
        and creator.institution_id is not None
        and creator.institution_id == user.institution_id
    )


def _query_count(db: Session, bot_id: int) -> int:
    """Consultas reales: mensajes enviados por usuarios en sesiones con este bot."""
    return (
        db.query(func.count(ChatMessage.id))
        .join(LearningSession, ChatMessage.session_id == LearningSession.id)
        .filter(LearningSession.bot_id == bot_id, ChatMessage.role == "user")
        .scalar()
        or 0
    )


def _document_count(db: Session, bot_id: int) -> int:
    return db.query(func.count(BotDocument.id)).filter(BotDocument.bot_id == bot_id).scalar() or 0

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
    if current_user.role == UserRole.ADMIN.value:
        # Admin ve todos los bots del sistema
        if is_public is not None:
            query = query.filter(ExpertBot.is_public == is_public)
        if creator_id is not None:
            query = query.filter(ExpertBot.creator_id == creator_id)
    elif current_user.role != UserRole.SUPER_PROFESOR.value:
        # Profesores y estudiantes: solo ven bots públicos de su institución O los que ellos mismos crearon.
        # Se ignora el parámetro is_public del cliente para evitar enumeración de bots privados ajenos.
        query = _same_institution_creators(query, current_user).filter(
            or_(ExpertBot.is_public == True, ExpertBot.creator_id == current_user.id)
        )
        if creator_id is not None:
            query = query.filter(ExpertBot.creator_id == creator_id)
    else:
        # Súper Profesor: todos los bots de su institución (y los globales)
        query = _same_institution_creators(query, current_user)
        if is_public is not None:
            query = query.filter(ExpertBot.is_public == is_public)
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


# ─── GET /shared-with-me (bots compartidos con el estudiante) ─────────────────
@router.get("/shared-with-me")
async def list_shared_bots(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    NeuroBots que el profesor ha compartido con el estudiante actual.

    Incluye:
    - Bots asignados a las clases en las que está inscrito el estudiante.
    - Bots públicos (is_public=True) creados por profesores.

    Formato consumido por el frontend del estudiante (NeuroBotsPage):
    {bots: [{id, name, description, subject, creator_name, classroom_name,
             is_required, source}]}.
    """
    result: List[dict] = []
    seen: set = set()

    # 1) Bots asignados a clases en las que el estudiante está inscrito
    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.is_active == True,
    ).all()

    classroom_ids = [e.classroom_id for e in enrollments]
    if classroom_ids:
        assignments = (
            db.query(ClassroomBot, Classroom)
            .join(Classroom, ClassroomBot.classroom_id == Classroom.id)
            .filter(ClassroomBot.classroom_id.in_(classroom_ids))
            .order_by(ClassroomBot.order_index)
            .all()
        )
        for assignment, classroom in assignments:
            bot = db.query(ExpertBot).filter(ExpertBot.id == assignment.bot_id).first()
            if not bot or not bot.is_active:
                continue
            key = ("classroom", bot.id, classroom.id)
            if key in seen:
                continue
            seen.add(key)
            result.append({
                "id": bot.id,
                "name": bot.name,
                "description": bot.description or "",
                "subject": bot.category or "",
                "creator_name": bot.creator.full_name if bot.creator else "",
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
                "is_required": assignment.is_required,
                "source": "classroom",
            })

    # 2) Bots públicos creados por profesores (que no sean del propio estudiante)
    public_bots = (
        _same_institution_creators(db.query(ExpertBot), current_user)
        .filter(ExpertBot.is_public == True, ExpertBot.is_active == True)
        .order_by(ExpertBot.created_at.desc())
        .all()
    )
    for bot in public_bots:
        key = ("public", bot.id, 0)
        if key in seen:
            continue
        seen.add(key)
        result.append({
            "id": bot.id,
            "name": bot.name,
            "description": bot.description or "",
            "subject": bot.category or "",
            "creator_name": bot.creator.full_name if bot.creator else "",
            "classroom_id": None,
            "classroom_name": None,
            "is_required": False,
            "source": "public",
        })

    return {"bots": result, "total": len(result)}


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
    return {"bots": [_build_bot_response(b, db) for b in bots]}


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

    # Verificar permisos (creador, Admin, o bot público/asignado de su institución)
    if not can_use_bot(db, current_user, bot):
        raise HTTPException(status_code=403, detail=FORBIDDEN_MESSAGE)

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
def _build_bot_response(bot: ExpertBot, db: Optional[Session] = None) -> dict:
    """Respuesta normalizada del bot que consume el frontend (NeuroBotsTab)."""
    return {
        "document_count": _document_count(db, bot.id) if db is not None else 0,
        "query_count": _query_count(db, bot.id) if db is not None else 0,
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
    db.flush()
    # Actividad institucional → Súper Profesor(es) de la institución (si lo
    # crea un profesor; un Súper Profesor no se notifica a sí mismo).
    from app.services import notification_service
    notification_service.notify(
        db,
        notification_service.super_profesores_of(db, current_user.institution_id, exclude=[current_user.id]),
        "actividad_institucional",
        "Nuevo NeuroBot",
        f'{current_user.full_name or current_user.username} creó el NeuroBot "{bot.name}".',
        link="/super?tab=neurobots",
        resource_type="neurobot",
        resource_id=bot.id,
    )
    db.commit()
    db.refresh(bot)

    return _build_bot_response(bot, db)


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

    return _build_bot_response(bot, db)


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
        content_fields = (payload.name, payload.description, payload.subject_area,
                          payload.category, payload.is_public, payload.language)
        only_status = payload.is_active is not None and all(v is None for v in content_fields)
        if not (only_status and _is_institution_super(current_user, bot)):
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

    return _build_bot_response(bot, db)


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

    if (bot.creator_id != current_user.id and current_user.role != UserRole.ADMIN.value
            and not _is_institution_super(current_user, bot)):
        raise HTTPException(status_code=403, detail="Solo el creador, el Súper Profesor de su institución o el admin puede eliminar el bot")

    # Limpiar referencias FK antes de eliminar para evitar IntegrityError en PostgreSQL.
    # 1. Desasignar el bot de todas las aulas donde esté asignado.
    db.query(ClassroomBot).filter(ClassroomBot.bot_id == bot_id).delete(synchronize_session=False)
    # Asignaciones individuales y progreso (parche 11B); las notificaciones
    # ya enviadas se conservan, pero su enlace dejará de abrir el bot.
    from app.models.neurobot_assignment import NeuroBotProgress, StudentBotAssignment
    db.query(StudentBotAssignment).filter(StudentBotAssignment.bot_id == bot_id).delete(synchronize_session=False)
    db.query(NeuroBotProgress).filter(NeuroBotProgress.bot_id == bot_id).delete(synchronize_session=False)
    # 2. Desvincular las sesiones de aprendizaje (se conserva el historial, solo se suelta la FK).
    db.query(LearningSession).filter(LearningSession.bot_id == bot_id).update(
        {"bot_id": None}, synchronize_session=False
    )
    # 3. Conversaciones del tutor asociadas al bot (se conservan, sin la FK).
    from app.models.adaptive import Conversation
    db.query(Conversation).filter(Conversation.bot_id == bot_id).update(
        {"bot_id": None}, synchronize_session=False
    )
    # 4. Base de conocimiento: documentos y fragmentos indexados.
    delete_bot_documents(db, bot_id)
    db.delete(bot)
    db.commit()

    return {"ok": True, "message": "Bot eliminado correctamente"}
