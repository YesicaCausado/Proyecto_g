"""
NeuroLearn AI - API de Mensajería (MODIFICADO)
===============================================

Actualizado para usar permisos basados en rol en lugar de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.message import Message, Conversation
from app.services.license_service import require_active_license  # Mantener por compatibilidad

router = APIRouter(prefix="/messages", tags=["Mensajería"])


# ── Esquemas ────────────────────────────────────────────────────────────────

class MessageCreate(BaseModel):
    conversation_id: int
    content: str
    message_type: str = "text"  # text, image, file, etc.

class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    message_type: str
    created_at: datetime
    is_read: bool

class ConversationCreate(BaseModel):
    participant_ids: List[int]  # IDs de usuarios con quienes iniciar la conversación

class ConversationResponse(BaseModel):
    id: int
    participant_ids: List[int]
    participant_names: List[str]
    created_at: datetime
    updated_at: datetime
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0


# ── Funciones de ayuda ───────────────────────────────────────────────────────

def _require_messaging_access(user: User) -> None:
    """Valida si el usuario tiene acceso al módulo de mensajería basado en su rol."""
    # Mensajería está disponible para todos los roles institucionales
    if user.role not in {UserRole.SUPER_PROFESOR.value, UserRole.PROFESOR.value, UserRole.ESTUDIANTE.value, UserRole.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para acceder a la mensajería."
        )


def _get_user_conversations(user_id: int, db: Session) -> List[Conversation]:
    """Obtiene las conversaciones de un usuario."""
    return db.query(Conversation).filter(
        Conversation.participants.any(id=user_id)
    ).all()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lista las conversaciones del usuario actual.
    """
    _require_messaging_access(current_user)
    
    conversations = _get_user_conversations(current_user.id, db)
    
    results = []
    for conv in conversations:
        # Obtener el último mensaje
        last_message = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).order_by(Message.created_at.desc()).first()
        
        # Contar mensajes no leídos
        unread_count = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != current_user.id,
            Message.is_read == False
        ).count()
        
        # Obtener nombres de participantes
        participant_names = []
        for participant_id in conv.participant_ids:
            user = db.query(User).filter(User.id == participant_id).first()
            if user:
                participant_names.append(f"{user.first_name} {user.last_name}".strip() or user.username)
        
        results.append(ConversationResponse(
            id=conv.id,
            participant_ids=conv.participant_ids,
            participant_names=participant_names,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            last_message=MessageResponse(
                id=last_message.id,
                conversation_id=last_message.conversation_id,
                sender_id=last_message.sender_id,
                sender_name=(
                    db.query(User.first_name, User.last_name, User.username)
                    .filter(User.id == last_message.sender_id)
                    .first()
                ),
                content=last_message.content,
                message_type=last_message.message_type,
                created_at=last_message.created_at,
                is_read=last_message.is_read
            ) if last_message else None,
            unread_count=unread_count
        ))
    
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Envía un nuevo mensaje en una conversación.
    """
    _require_messaging_access(current_user)
    
    # Verificar que la conversación existe y el usuario es participante
    conversation = db.query(Conversation).filter(
        Conversation.id == message_data.conversation_id,
        Conversation.participants.any(id=current_user.id)
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada o no tiene permiso para acceder a ella."
        )
    
    # Crear el mensaje
    message = Message(
        conversation_id=message_data.conversation_id,
        sender_id=current_user.id,
        content=message_data.content,
        message_type=message_data.message_type
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    # Obtener nombre del remitente
    sender_user = db.query(User).filter(User.id == current_user.id).first()
    sender_name = f"{sender_user.first_name} {sender_user.last_name}".strip() or sender_user.username
    
    return MessageResponse(
        id=message.id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        sender_name=sender_name,
        content=message.content,
        message_type=message.message_type,
        created_at=message.created_at,
        is_read=message.is_read
    )


# Los demás endpoints seguirían un patrón similar...

# Mantener funciones de compatibilidad pero simplificadas
def _require_messaging_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    _require_messaging_access(user)