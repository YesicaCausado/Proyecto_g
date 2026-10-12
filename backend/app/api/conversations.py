"""
NeuroLearn AI — API de Conversaciones del Tutor IA

Memoria completa de conversaciones (tipo ChatGPT):
  GET  /chat/conversations                → listar conversaciones del estudiante
  POST /chat/conversations                → crear nueva conversación
  GET  /chat/conversations/{id}           → recuperar mensajes de una conversación
  POST /chat/conversations/{id}/rename    → renombrar
  DELETE /chat/conversations/{id}         → eliminar
"""
from typing import Optional
from fastapi import Query, APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List

from app.db.database import get_db
from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.user import User
from app.schemas.schemas import (
    ConversationCreate,
    ConversationRename,
    ConversationMeta,
    ConversationListResponse,
)
from app.models.adaptive import Conversation, ConversationMessage


router = APIRouter(prefix="/chat/conversations", tags=["Chat Adaptativo - Conversaciones"])


def _to_meta(conv: Conversation) -> ConversationMeta:
    return ConversationMeta(
        id=conv.id,
        student_id=conv.student_id,
        title=conv.title or "Nueva conversación",
        subject=conv.subject or "",
        skill=conv.skill or "",
        topic=conv.topic or "",
        is_active=bool(conv.is_active),
        created_at=conv.created_at or datetime.utcnow(),
        updated_at=conv.updated_at or datetime.utcnow(),
        last_interaction=conv.last_interaction or datetime.utcnow(),
        bot_id=conv.bot_id,
    )


@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    bot_id: Optional[int] = Query(None, description="Solo las conversaciones con este NeuroBot"),
    scope: Optional[str] = Query(None, description="competencias = solo chats sin NeuroBot; neurobots = solo con NeuroBot"),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.USAR_CHAT_IA)),
    db: Session = Depends(get_db),
):
    """Lista las conversaciones del estudiante (más recientes primero).

    Los chats de competencias y los de NeuroBots se listan por separado
    (bot_id / scope) para que cada módulo muestre solo su historial."""
    q = db.query(Conversation).filter(
        Conversation.student_id == current_user.id,
        Conversation.is_active == True,
    )
    if bot_id is not None:
        q = q.filter(Conversation.bot_id == bot_id)
    elif scope == "competencias":
        q = q.filter(Conversation.bot_id.is_(None))
    elif scope == "neurobots":
        q = q.filter(Conversation.bot_id.isnot(None))
    rows = q.order_by(Conversation.last_interaction.desc()).all()
    return ConversationListResponse(
        conversations=[_to_meta(r) for r in rows],
        total=len(rows),
    )


@router.post("", response_model=ConversationMeta)
async def create_conversation(
    body: ConversationCreate,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.USAR_CHAT_IA)),
    db: Session = Depends(get_db),
):
    """Crea una conversación nueva (no reutiliza cargas previas: solo la).
    El StudentModel se recupera automáticamente al decidir (memoria entre chats)."""
    conv = Conversation(
        student_id=current_user.id,
        bot_id=body.bot_id,
        subject=body.subject or "",
        skill=body.skill or "",
        topic=body.topic or "",
        title=(body.topic or body.skill or "Nueva conversación")[:200],
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return _to_meta(conv)


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.USAR_CHAT_IA)),
    db: Session = Depends(get_db),
):
    """Devuelve una conversación con sus mensajes (para continuarla)."""
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.student_id == current_user.id,
        Conversation.is_active == True,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")

    msgs = db.query(ConversationMessage).filter(
        ConversationMessage.conversation_id == conv.id,
    ).order_by(ConversationMessage.timestamp.asc()).all()

    return {
        "conversation": _to_meta(conv).model_dump(),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp.isoformat() if m.timestamp else None,
                "metadata": m.meta or {},
            }
            for m in msgs
        ],
    }


@router.post("/{conversation_id}/rename", response_model=ConversationMeta)
async def rename_conversation(
    conversation_id: int,
    body: ConversationRename,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.USAR_CHAT_IA)),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.student_id == current_user.id,
        Conversation.is_active == True,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    conv.title = body.title
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)
    return _to_meta(conv)


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.USAR_CHAT_IA)),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.student_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    # Eliminación lógica: se conserva el histórico pero deja de aparecer/listarse.
    conv.is_active = False
    conv.updated_at = datetime.utcnow()
    db.commit()
    return {"ok": True, "deleted": conversation_id}
