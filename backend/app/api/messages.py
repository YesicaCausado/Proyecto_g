"""
NeuroLearn AI - API de Mensajes Directos

Solo se permiten conversaciones estudiante ↔ profesor
(no mensajes entre pares de estudiantes).

Endpoints:
  GET  /messages/conversations          - listar hilos de conversación del usuario
  GET  /messages/conversations/{user_id}- mensajes con un usuario específico
  POST /messages/conversations/{user_id}- enviar mensaje a un usuario
  POST /messages/conversations/{user_id}/read - marcar como leídos
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.messages import DirectMessage

router = APIRouter(prefix="/messages", tags=["Mensajes Directos"])


# ── Schemas internos ─────────────────────────────────────────────────────────

class MessageSend(BaseModel):
    content: str


def _msg_to_dict(msg: DirectMessage, db: Session) -> dict:
    sender   = db.query(User).filter(User.id == msg.sender_id).first()
    receiver = db.query(User).filter(User.id == msg.receiver_id).first()
    return {
        "id": msg.id,
        "sender_id":     msg.sender_id,
        "sender_name":   sender.full_name or sender.username if sender else "?",
        "sender_role":   sender.role if sender else "estudiante",
        "receiver_id":   msg.receiver_id,
        "receiver_name": receiver.full_name or receiver.username if receiver else "?",
        "content":       msg.content,
        "is_read":       msg.is_read,
        "created_at":    msg.created_at.isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lista los hilos de conversación del usuario actual.
    Para cada hilo devuelve: el otro usuario, último mensaje y cantidad de no leídos.
    """
    uid = current_user.id

    # Todos los mensajes del usuario (enviados o recibidos)
    all_msgs = db.query(DirectMessage).filter(
        or_(DirectMessage.sender_id == uid, DirectMessage.receiver_id == uid)
    ).order_by(DirectMessage.created_at.desc()).all()

    # Agrupar por "el otro participante"
    seen: dict[int, dict] = {}
    for msg in all_msgs:
        other_id = msg.receiver_id if msg.sender_id == uid else msg.sender_id
        if other_id not in seen:
            other = db.query(User).filter(User.id == other_id).first()
            if not other:
                continue
            unread = db.query(DirectMessage).filter(
                DirectMessage.sender_id == other_id,
                DirectMessage.receiver_id == uid,
                DirectMessage.is_read == False,
            ).count()
            seen[other_id] = {
                "other_user_id":   other_id,
                "other_user_name": other.full_name or other.username,
                "other_user_role": other.role,
                "last_message":    msg.content,
                "last_message_at": msg.created_at.isoformat(),
                "unread_count":    unread,
            }

    # Para estudiantes: añadir profesores de sus clases con los que aún no
    # hay mensajes, para facilitar iniciar conversación.
    if current_user.role == UserRole.ESTUDIANTE.value:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == uid,
            Enrollment.is_active == True,
        ).all()
        for e in enrollments:
            classroom = db.query(Classroom).filter(Classroom.id == e.classroom_id).first()
            if not classroom:
                continue
            tid = classroom.teacher_id
            if tid not in seen:
                teacher = db.query(User).filter(User.id == tid).first()
                if teacher:
                    seen[tid] = {
                        "other_user_id":   tid,
                        "other_user_name": teacher.full_name or teacher.username,
                        "other_user_role": teacher.role,
                        "last_message":    None,
                        "last_message_at": None,
                        "unread_count":    0,
                        "classroom_name":  classroom.name,
                    }

    convs = sorted(
        seen.values(),
        key=lambda c: c["last_message_at"] or "",
        reverse=True,
    )
    return {"conversations": convs, "total": len(convs)}


@router.get("/conversations/{other_user_id}")
async def get_messages(
    other_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Devuelve todos los mensajes entre el usuario actual y otro usuario."""
    uid = current_user.id
    msgs = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == uid,          DirectMessage.receiver_id == other_user_id),
            and_(DirectMessage.sender_id == other_user_id, DirectMessage.receiver_id == uid),
        )
    ).order_by(DirectMessage.created_at).all()

    other = db.query(User).filter(User.id == other_user_id).first()
    if not other:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    return {
        "other_user_id":   other_user_id,
        "other_user_name": other.full_name or other.username,
        "other_user_role": other.role,
        "messages": [_msg_to_dict(m, db) for m in msgs],
        "total": len(msgs),
    }


@router.post("/conversations/{other_user_id}", status_code=status.HTTP_201_CREATED)
async def send_message(
    other_user_id: int,
    body: MessageSend,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Envía un mensaje al otro usuario.
    Reglas:
      - Estudiante → solo puede enviar a profesores de sus clases.
      - Profesor → puede responder a cualquier estudiante de sus clases.
    """
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    receiver = db.query(User).filter(User.id == other_user_id, User.is_active == True).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")

    uid = current_user.id

    # Validación: estudiante → receptor debe ser profesor de alguna de sus clases
    if current_user.role == UserRole.ESTUDIANTE.value:
        if receiver.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
            raise HTTPException(status_code=403, detail="Los estudiantes solo pueden escribir a sus profesores")

        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == uid,
            Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]
        valid = db.query(Classroom).filter(
            Classroom.teacher_id == other_user_id,
            Classroom.id.in_(cids),
        ).first()
        if not valid:
            raise HTTPException(status_code=403, detail="Solo puedes escribir a profesores de tus clases")

    msg = DirectMessage(
        sender_id=uid,
        receiver_id=other_user_id,
        content=body.content.strip(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return _msg_to_dict(msg, db)


@router.post("/conversations/{other_user_id}/read")
async def mark_as_read(
    other_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Marca como leídos todos los mensajes de other_user_id recibidos por el usuario actual."""
    db.query(DirectMessage).filter(
        DirectMessage.sender_id == other_user_id,
        DirectMessage.receiver_id == current_user.id,
        DirectMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Mensajes marcados como leídos"}
