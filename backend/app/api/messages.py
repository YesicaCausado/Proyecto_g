"""
NeuroLearn AI - API de Mensajes Directos

Reglas de conversación:
  - Estudiante  ↔ Profesor    (de sus clases)
  - Profesor    ↔ Estudiante  (de sus clases)
  - Profesor    ↔ Profesor    (misma institución)
  - Profesor    ↔ Super       (rector)
  - Super       ↔ cualquiera  (rector puede hablar con todos)

Endpoints:
  GET  /messages/conversations          - listar hilos de conversación
  GET  /messages/conversations/{user_id}- mensajes con un usuario
  POST /messages/conversations/{user_id}- enviar mensaje
  POST /messages/conversations/{user_id}/read - marcar leídos
  GET  /messages/contacts               - usuarios con los que puedes iniciar chat
  DELETE /messages/{message_id}         - eliminar mensaje (para mí o para todos)
  GET  /messages/{message_id}/can-delete-for-all - verificar ventana de 15 min
"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy.orm import Session, undefer
from sqlalchemy import or_, and_, func, case
from typing import Optional
from urllib.parse import quote

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.messages import DirectMessage

router = APIRouter(prefix="/messages", tags=["Mensajes Directos"])

# Ventana de tiempo para "eliminar para todos" (segundos)
DELETE_FOR_ALL_WINDOW_SECONDS = 15 * 60  # 15 minutos


# ── Helpers ───────────────────────────────────────────────────────────────────

def _can_delete_for_all(msg: DirectMessage) -> bool:
    """Devuelve True si el mensaje aún está dentro de la ventana de 15 min."""
    now = datetime.now(timezone.utc)
    created = msg.created_at
    # Normalizar a UTC si la fecha no tiene tzinfo
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return (now - created).total_seconds() <= DELETE_FOR_ALL_WINDOW_SECONDS


def _msg_to_dict(msg: DirectMessage, current_user_id: int, db: Session) -> Optional[dict]:
    """
    Convierte un DirectMessage a dict teniendo en cuenta el estado de eliminación
    para el usuario actual. Devuelve None si el mensaje debe ocultarse completamente.
    """
    is_sender   = msg.sender_id   == current_user_id
    is_receiver = msg.receiver_id == current_user_id

    # ── Eliminado para todos ──────────────────────────────────────────────────
    deleted_for_all = getattr(msg, "deleted_for_all", False)
    if deleted_for_all:
        return {
            "id":              msg.id,
            "sender_id":       msg.sender_id,
            "receiver_id":     msg.receiver_id,
            "sender_name":     None,
            "sender_role":     None,
            "receiver_name":   None,
            "content":         "Eliminaste este mensaje" if is_sender else "Se eliminó este mensaje",
            "is_read":         msg.is_read,
            "created_at":      msg.created_at.isoformat(),
            "attachment":      None,
            "is_deleted":      True,
            "deleted_for_all": True,
            "can_delete_for_all": False,
        }

    # ── Eliminado solo para mí ────────────────────────────────────────────────
    deleted_for_sender   = getattr(msg, "deleted_for_sender",   False)
    deleted_for_receiver = getattr(msg, "deleted_for_receiver", False)

    if is_sender   and deleted_for_sender:
        return None  # Ocultar completamente para el remitente
    if is_receiver and deleted_for_receiver:
        return None  # Ocultar completamente para el receptor

    # ── Mensaje normal ────────────────────────────────────────────────────────
    sender   = db.query(User).filter(User.id == msg.sender_id).first()
    receiver = db.query(User).filter(User.id == msg.receiver_id).first()
    return {
        "id":            msg.id,
        "sender_id":     msg.sender_id,
        "sender_name":   (sender.full_name or sender.username)   if sender   else "?",
        "sender_role":   sender.role                              if sender   else "estudiante",
        "receiver_id":   msg.receiver_id,
        "receiver_name": (receiver.full_name or receiver.username) if receiver else "?",
        "content":       msg.content,
        "is_read":       msg.is_read,
        "created_at":    msg.created_at.isoformat(),
        "attachment": {
            "name": msg.attachment_name,
            "mime": msg.attachment_mime,
            "size": msg.attachment_size,
            "url":  f"/api/v1/messages/{msg.id}/attachment" if msg.attachment_name else None,
        } if msg.attachment_name else None,
        "is_deleted":         False,
        "deleted_for_all":    False,
        # El frontend puede saber si puede ofrecer "eliminar para todos"
        "can_delete_for_all": is_sender and _can_delete_for_all(msg),
    }


# Mapa de extensión -> MIME para conservar el formato en la descarga de adjuntos.
_MIME_BY_EXT = {
    ".pdf":   "application/pdf",
    ".doc":   "application/msword",
    ".docx":  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt":   "application/vnd.ms-powerpoint",
    ".pptx":  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls":   "application/vnd.ms-excel",
    ".xlsx":  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt":   "text/plain",
    ".csv":   "text/csv",
    ".png":   "image/png",
    ".jpg":   "image/jpeg",
    ".jpeg":  "image/jpeg",
    ".gif":   "image/gif",
    ".webp":  "image/webp",
    ".svg":   "image/svg+xml",
    ".zip":   "application/zip",
    ".mp4":   "video/mp4",
    ".mp3":   "audio/mpeg",
}


def _guess_mime(filename: str) -> str:
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    return _MIME_BY_EXT.get(ext, "application/octet-stream")


def _can_message(sender: User, receiver: User, db: Session) -> bool:
    """Devuelve True si sender tiene permiso de enviar a receiver."""
    s_role = sender.role
    r_role = receiver.role

    same_institution = (
        sender.institution_id is not None
        and sender.institution_id == receiver.institution_id
    )

    if s_role == UserRole.SUPER_PROFESOR.value or r_role == UserRole.SUPER_PROFESOR.value:
        return same_institution

    if s_role == UserRole.PROFESOR.value and r_role == UserRole.PROFESOR.value:
        return sender.institution_id is not None and sender.institution_id == receiver.institution_id

    if s_role == UserRole.ESTUDIANTE.value and r_role == UserRole.PROFESOR.value:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == sender.id,
            Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]
        return db.query(Classroom).filter(
            Classroom.teacher_id == receiver.id,
            Classroom.id.in_(cids),
        ).first() is not None

    if s_role == UserRole.PROFESOR.value and r_role == UserRole.ESTUDIANTE.value:
        cids = [c.id for c in db.query(Classroom).filter(Classroom.teacher_id == sender.id).all()]
        return db.query(Enrollment).filter(
            Enrollment.student_id == receiver.id,
            Enrollment.classroom_id.in_(cids),
            Enrollment.is_active == True,
        ).first() is not None

    return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/contacts")
async def get_contacts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve la lista de usuarios con los que el usuario actual puede iniciar
    una conversación (según las reglas de rol).
    """
    uid  = current_user.id
    role = current_user.role
    contacts = []

    if role == UserRole.SUPER_PROFESOR.value:
        users = db.query(User).filter(
            User.id != uid,
            User.is_active == True,
            User.institution_id == current_user.institution_id,
        ).order_by(User.full_name).all()
        contacts = users

    elif role == UserRole.PROFESOR.value:
        seen_ids = set()
        cids = [c.id for c in db.query(Classroom).filter(Classroom.teacher_id == uid).all()]
        if cids:
            enrollments = db.query(Enrollment).filter(
                Enrollment.classroom_id.in_(cids),
                Enrollment.is_active == True,
            ).all()
            for e in enrollments:
                if e.student_id not in seen_ids:
                    seen_ids.add(e.student_id)
        others = db.query(User).filter(
            User.role == UserRole.PROFESOR.value,
            User.institution_id == current_user.institution_id,
            User.id != uid,
            User.is_active == True,
        ).all()
        for u in others:
            seen_ids.add(u.id)
        supers = db.query(User).filter(
            User.role == UserRole.SUPER_PROFESOR.value,
            User.institution_id == current_user.institution_id,
            User.is_active == True,
        ).all()
        for u in supers:
            seen_ids.add(u.id)
        contacts = db.query(User).filter(User.id.in_(seen_ids)).order_by(User.full_name).all()

    elif role == UserRole.ESTUDIANTE.value:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == uid,
            Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]
        teacher_ids = set()
        for c in db.query(Classroom).filter(Classroom.id.in_(cids)).all():
            teacher_ids.add(c.teacher_id)
        contacts = db.query(User).filter(User.id.in_(teacher_ids), User.is_active == True).all()

    return {
        "contacts": [
            {
                "id":       u.id,
                "name":     u.full_name or u.username,
                "role":     u.role,
                "initials": (u.full_name or u.username or "?")[0].upper(),
            }
            for u in contacts
        ]
    }


@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista los hilos de conversación del usuario actual."""
    uid = current_user.id

    seg = or_(DirectMessage.sender_id == uid, DirectMessage.receiver_id == uid)

    partner_col = case(
        (DirectMessage.sender_id == uid, DirectMessage.receiver_id),
        else_=DirectMessage.sender_id,
    ).label("partner_id")
    partner_rows = (
        db.query(partner_col)
        .filter(seg)
        .group_by(partner_col)
        .all()
    )
    partner_ids = [r[0] for r in partner_rows if r[0] is not None]

    users = {}
    if partner_ids:
        users = {
            u.id: u for u in db.query(User).filter(User.id.in_(partner_ids)).all()
        }

    last_msg_map: dict[int, tuple] = {}
    if partner_ids:
        msg_sub = db.query(
            DirectMessage.id,
            DirectMessage.content,
            DirectMessage.created_at,
            partner_col,
        ).filter(seg).subquery()
        max_sub = (
            db.query(msg_sub.c.partner_id, func.max(msg_sub.c.id).label("mid"))
            .group_by(msg_sub.c.partner_id)
            .subquery()
        )
        latest_rows = (
            db.query(
                msg_sub.c.partner_id,
                msg_sub.c.content,
                msg_sub.c.created_at,
            )
            .join(
                max_sub,
                and_(max_sub.c.partner_id == msg_sub.c.partner_id, max_sub.c.mid == msg_sub.c.id),
            )
            .all()
        )
        last_msg_map = {pid: (content, created) for pid, content, created in latest_rows}

    unread_map: dict[int, int] = {}
    if partner_ids:
        unread_rows = (
            db.query(DirectMessage.sender_id, func.count(DirectMessage.id))
            .filter(
                DirectMessage.receiver_id == uid,
                DirectMessage.sender_id.in_(partner_ids),
                DirectMessage.is_read == False,
            )
            .group_by(DirectMessage.sender_id)
            .all()
        )
        unread_map = {sid: cnt for sid, cnt in unread_rows}

    seen: dict[int, dict] = {}
    for other_id in partner_ids:
        other = users.get(other_id)
        if not other:
            continue
        last = last_msg_map.get(other_id)
        seen[other_id] = {
            "other_user_id":   other_id,
            "other_user_name": other.full_name or other.username,
            "other_user_role": other.role,
            "last_message":    last[0] if last else None,
            "last_message_at": last[1].isoformat() if last else None,
            "unread_count":    int(unread_map.get(other_id, 0)),
        }

    if current_user.role == UserRole.ESTUDIANTE.value:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == uid, Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]
        classrooms = {
            c.id: c for c in db.query(Classroom).filter(Classroom.id.in_(cids)).all()
        } if cids else {}
        tids = {c.teacher_id for c in classrooms.values() if c.teacher_id}
        teachers = {}
        if tids:
            teachers = {u.id: u for u in db.query(User).filter(User.id.in_(tids)).all()}
        for e in enrollments:
            classroom = classrooms.get(e.classroom_id)
            if not classroom:
                continue
            tid = classroom.teacher_id
            if tid not in seen:
                teacher = teachers.get(tid)
                if teacher:
                    seen[tid] = {
                        "other_user_id":   tid,
                        "other_user_name": teacher.full_name or teacher.username,
                        "other_user_role": teacher.role,
                        "last_message":    None,
                        "last_message_at": None,
                        "unread_count":    0,
                    }

    if current_user.role == UserRole.PROFESOR.value:
        cids = [c.id for c in db.query(Classroom).filter(Classroom.teacher_id == uid).all()]
        if cids:
            enrollments = db.query(Enrollment).filter(
                Enrollment.classroom_id.in_(cids), Enrollment.is_active == True,
            ).all()
            add_stu_ids = [e.student_id for e in enrollments if e.student_id not in seen]
            students = {}
            if add_stu_ids:
                students = {
                    u.id: u for u in db.query(User).filter(User.id.in_(add_stu_ids)).all()
                }
            for e in enrollments:
                if e.student_id not in seen:
                    student = students.get(e.student_id)
                    if student:
                        seen[e.student_id] = {
                            "other_user_id":   e.student_id,
                            "other_user_name": student.full_name or student.username,
                            "other_user_role": student.role,
                            "last_message":    None,
                            "last_message_at": None,
                            "unread_count":    0,
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
    """Devuelve todos los mensajes entre el usuario actual y otro, aplicando
    las reglas de visibilidad (eliminados para mí / para todos)."""
    uid = current_user.id
    msgs = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == uid,           DirectMessage.receiver_id == other_user_id),
            and_(DirectMessage.sender_id == other_user_id, DirectMessage.receiver_id == uid),
        )
    ).order_by(DirectMessage.created_at).all()

    other = db.query(User).filter(User.id == other_user_id).first()
    if not other or (not msgs and not _can_message(current_user, other, db)):
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Filtrar mensajes ocultos para el usuario actual (None = oculto completamente)
    dicts = [_msg_to_dict(m, uid, db) for m in msgs]
    visible = [d for d in dicts if d is not None]

    return {
        "other_user_id":   other_user_id,
        "other_user_name": other.full_name or other.username,
        "other_user_role": other.role,
        "messages":        visible,
        "total":           len(visible),
    }


@router.delete("/{message_id}", status_code=status.HTTP_200_OK)
async def delete_message(
    message_id: int,
    scope: str = Query(default="for_me", description="'for_me' | 'for_all'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Elimina un mensaje.

    - scope=for_me  : oculta el mensaje únicamente para el usuario que hace la acción.
                      No tiene restricción de tiempo. Cualquier participante puede hacerlo.
    - scope=for_all : elimina el mensaje para todos los participantes.
                      Solo el remitente puede hacerlo y únicamente dentro de los 15 minutos
                      siguientes al envío. El backend valida la ventana de tiempo.
    """
    if scope not in ("for_me", "for_all"):
        raise HTTPException(status_code=400, detail="scope debe ser 'for_me' o 'for_all'")

    message = db.query(DirectMessage).filter(DirectMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")

    uid = current_user.id
    is_participant = uid in (message.sender_id, message.receiver_id)
    if not is_participant:
        raise HTTPException(status_code=403, detail="No tienes acceso a este mensaje")

    # ── Eliminar para todos ───────────────────────────────────────────────────
    if scope == "for_all":
        # Solo el remitente puede eliminar para todos
        if message.sender_id != uid:
            raise HTTPException(
                status_code=403,
                detail="Solo el remitente puede eliminar el mensaje para todos",
            )
        # Verificar ventana de 15 minutos en el servidor (nunca confiar en el cliente)
        if not _can_delete_for_all(message):
            raise HTTPException(
                status_code=403,
                detail="El mensaje supera los 15 minutos permitidos para eliminar para todos",
            )
        # Marcar como eliminado para todos (no borrar el registro para mantener posición)
        message.deleted_for_all = True
        message.deleted_for_sender   = False
        message.deleted_for_receiver = False
        message.content = ""  # Limpiar contenido real por privacidad
        db.commit()
        db.refresh(message)
        return {
            "id":              message.id,
            "deleted_for_all": True,
            "is_deleted":      True,
            "content":         "Eliminaste este mensaje",
        }

    # ── Eliminar para mí ──────────────────────────────────────────────────────
    is_sender   = message.sender_id   == uid
    is_receiver = message.receiver_id == uid

    if is_sender:
        message.deleted_for_sender = True
    elif is_receiver:
        message.deleted_for_receiver = True

    db.commit()
    return {"id": message.id, "deleted_for_me": True, "is_deleted": True}


@router.get("/{message_id}/attachment")
async def download_attachment(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Descarga el adjunto de un mensaje (solo si el usuario es remitente o receptor)."""
    msg = db.query(DirectMessage).options(undefer(DirectMessage.attachment_data)).filter(
        DirectMessage.id == message_id,
    ).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    if current_user.id not in (msg.sender_id, msg.receiver_id):
        raise HTTPException(status_code=403, detail="No tienes acceso a este adjunto")
    if not msg.attachment_name or not msg.attachment_data:
        raise HTTPException(status_code=404, detail="Este mensaje no tiene archivo adjunto")

    mime = msg.attachment_mime or _guess_mime(msg.attachment_name)
    ascii_name = "".join(ch if 32 <= ord(ch) < 127 else "_" for ch in msg.attachment_name)
    disposition = (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{quote(msg.attachment_name)}"
    )
    return Response(
        content=bytes(msg.attachment_data),
        media_type=mime,
        headers={"Content-Disposition": disposition, "Content-Length": str(len(msg.attachment_data))},
    )


@router.post("/conversations/{other_user_id}", status_code=status.HTTP_201_CREATED)
async def send_message(
    other_user_id: int,
    content: str = Form(...),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Envía un mensaje al otro usuario según las reglas de rol (con adjunto opcional)."""
    if not (content or "").strip() and file is None:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    receiver = db.query(User).filter(User.id == other_user_id, User.is_active == True).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")

    if not _can_message(current_user, receiver, db):
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para enviar mensajes a este usuario",
        )

    attach_name = attach_mime = None
    attach_size = None
    attach_data = None
    if file is not None:
        raw = await file.read()
        if len(raw) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="El archivo supera el límite de 25 MB.")
        if raw:
            attach_name = file.filename or "archivo"
            attach_mime = file.content_type or _guess_mime(attach_name)
            attach_size = len(raw)
            attach_data = raw

    msg = DirectMessage(
        sender_id=current_user.id,
        receiver_id=other_user_id,
        content=(content or "").strip(),
        attachment_name=attach_name,
        attachment_mime=attach_mime,
        attachment_size=attach_size,
        attachment_data=attach_data,
    )
    db.add(msg)
    from app.services import notification_service
    notification_service.notify_direct_message(db, current_user, receiver, msg.content)
    db.commit()
    db.refresh(msg)
    return _msg_to_dict(msg, current_user.id, db)


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