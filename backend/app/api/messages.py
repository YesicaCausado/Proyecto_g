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
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, case
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.services.license_service import get_license, require_active_license, LicenseInfo
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.messages import DirectMessage

router = APIRouter(prefix="/messages", tags=["Mensajes Directos"])


# ── Schemas ──────────────────────────────────────────────────────────────────

class MessageSend(BaseModel):
    content: str


def _msg_to_dict(msg: DirectMessage, db: Session) -> dict:
    sender   = db.query(User).filter(User.id == msg.sender_id).first()
    receiver = db.query(User).filter(User.id == msg.receiver_id).first()
    return {
        "id":            msg.id,
        "sender_id":     msg.sender_id,
        "sender_name":   (sender.full_name or sender.username) if sender else "?",
        "sender_role":   sender.role if sender else "estudiante",
        "receiver_id":   msg.receiver_id,
        "receiver_name": (receiver.full_name or receiver.username) if receiver else "?",
        "content":       msg.content,
        "is_read":       msg.is_read,
        "created_at":    msg.created_at.isoformat(),
    }


def _can_message(sender: User, receiver: User, db: Session) -> bool:
    """Devuelve True si sender tiene permiso de enviar a receiver."""
    s_role = sender.role
    r_role = receiver.role

    # Super puede hablar con cualquiera
    if s_role == UserRole.SUPER_PROFESOR.value:
        return True

    # Cualquiera puede hablar con super
    if r_role == UserRole.SUPER_PROFESOR.value:
        return True

    # Profesor ↔ Profesor (misma institución)
    if s_role == UserRole.PROFESOR.value and r_role == UserRole.PROFESOR.value:
        return sender.institution_id is not None and sender.institution_id == receiver.institution_id

    # Estudiante → Profesor de sus clases
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

    # Profesor → Estudiante de sus clases
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
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """
    Devuelve la lista de usuarios con los que el usuario actual puede iniciar
    una conversación (según las reglas de rol).
    """
    # Verificar acceso al módulo 'mensajes' según la licencia institucional
    if current_user.role == UserRole.PROFESOR.value and not license_info.has_teacher_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.ESTUDIANTE.value and not license_info.has_student_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.SUPER_PROFESOR.value and not license_info.has_super_module("mensajeria"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajeria' no está disponible en tu licencia ({license_info.license_type}).")

    uid  = current_user.id
    role = current_user.role
    contacts = []

    if role == UserRole.SUPER_PROFESOR.value:
        # Rector puede hablar con todos (misma institución)
        users = db.query(User).filter(
            User.id != uid,
            User.is_active == True,
            User.institution_id == current_user.institution_id,
        ).order_by(User.full_name).all()
        contacts = users

    elif role == UserRole.PROFESOR.value:
        seen_ids = set()
        # Mis estudiantes
        cids = [c.id for c in db.query(Classroom).filter(Classroom.teacher_id == uid).all()]
        if cids:
            enrollments = db.query(Enrollment).filter(
                Enrollment.classroom_id.in_(cids),
                Enrollment.is_active == True,
            ).all()
            for e in enrollments:
                if e.student_id not in seen_ids:
                    seen_ids.add(e.student_id)
        # Otros profesores (misma institución)
        others = db.query(User).filter(
            User.role == UserRole.PROFESOR.value,
            User.institution_id == current_user.institution_id,
            User.id != uid,
            User.is_active == True,
        ).all()
        for u in others:
            seen_ids.add(u.id)
        # Super/rector
        supers = db.query(User).filter(
            User.role == UserRole.SUPER_PROFESOR.value,
            User.institution_id == current_user.institution_id,
            User.is_active == True,
        ).all()
        for u in supers:
            seen_ids.add(u.id)
        contacts = db.query(User).filter(User.id.in_(seen_ids)).order_by(User.full_name).all()

    elif role == UserRole.ESTUDIANTE.value:
        # Profesores de mis clases
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
                "id":    u.id,
                "name":  u.full_name or u.username,
                "role":  u.role,
                "initials": (u.full_name or u.username or "?")[0].upper(),
            }
            for u in contacts
        ]
    }


@router.get("/conversations")
async def list_conversations(
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """Lista los hilos de conversación del usuario actual."""
    # Verificar acceso al módulo 'mensajes'
    if current_user.role == UserRole.PROFESOR.value and not license_info.has_teacher_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.ESTUDIANTE.value and not license_info.has_student_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.SUPER_PROFESOR.value and not license_info.has_super_module("mensajeria"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajeria' no está disponible en tu licencia ({license_info.license_type}).")
    uid = current_user.id

    # ── Optimización (504 en producción): ─────────────────────────────────
    # Antes se cargaban TODOS los mensajes y se hacían ~2 queries por mensaje
    # (usuario + conde de no leídos) → N+1 que agotaba el tiempo de Vercel.
    # Ahora se resuelve en pocas consultas por lotes:
    #   1) ids de interlocutores distintos + batch de usuarios
    #   2) último mensaje por interlocutor (una query agregada)
    #   3) no leídos por interlocutor (una query agregada)
    seg = or_(DirectMessage.sender_id == uid, DirectMessage.receiver_id == uid)

    # 1) Interlocutores distintos.
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

    # Batch de usuarios (una query, no una por interlocutor).
    users = {}
    if partner_ids:
        users = {
            u.id: u for u in db.query(User).filter(User.id.in_(partner_ids)).all()
        }

    # 2) Último mensaje por interlocutor (una query agregada).
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

    # 3) No leídos por interlocutor (una query agregada).
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

    # Para estudiantes: añadir profesores de sus clases sin mensajes aún
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

    # Para profesores: añadir estudiantes de sus clases sin mensajes aún
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
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """Devuelve todos los mensajes entre el usuario actual y otro."""
    # Verificar acceso al módulo 'mensajes'
    if current_user.role == UserRole.PROFESOR.value and not license_info.has_teacher_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.ESTUDIANTE.value and not license_info.has_student_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.SUPER_PROFESOR.value and not license_info.has_super_module("mensajeria"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajeria' no está disponible en tu licencia ({license_info.license_type}).")
    uid = current_user.id
    msgs = db.query(DirectMessage).filter(
        or_(
            and_(DirectMessage.sender_id == uid,           DirectMessage.receiver_id == other_user_id),
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
        "messages":        [_msg_to_dict(m, db) for m in msgs],
        "total":           len(msgs),
    }


@router.post("/conversations/{other_user_id}", status_code=status.HTTP_201_CREATED)
async def send_message(
    other_user_id: int,
    body: MessageSend,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Envía un mensaje al otro usuario según las reglas de rol."""
    # Verificar acceso al módulo 'mensajes' y estado de licencia (active_license ya valida estado)
    if current_user.role == UserRole.PROFESOR.value and not license_info.has_teacher_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.ESTUDIANTE.value and not license_info.has_student_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.SUPER_PROFESOR.value and not license_info.has_super_module("mensajeria"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajeria' no está disponible en tu licencia ({license_info.license_type}).")
    if not body.content.strip():
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacío")

    receiver = db.query(User).filter(User.id == other_user_id, User.is_active == True).first()
    if not receiver:
        raise HTTPException(status_code=404, detail="Destinatario no encontrado")

    if not _can_message(current_user, receiver, db):
        raise HTTPException(
            status_code=403,
            detail="No tienes permiso para enviar mensajes a este usuario",
        )

    msg = DirectMessage(
        sender_id=current_user.id,
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
    license_info: LicenseInfo = Depends(get_license),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Marca como leídos todos los mensajes de other_user_id recibidos por el usuario actual."""
    # Verificar acceso al módulo 'mensajes' y estado de licencia
    if current_user.role == UserRole.PROFESOR.value and not license_info.has_teacher_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.ESTUDIANTE.value and not license_info.has_student_module("mensajes"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajes' no está disponible en tu licencia ({license_info.license_type}).")
    if current_user.role == UserRole.SUPER_PROFESOR.value and not license_info.has_super_module("mensajeria"):
        raise HTTPException(status_code=403, detail=f"El módulo 'mensajeria' no está disponible en tu licencia ({license_info.license_type}).")
    db.query(DirectMessage).filter(
        DirectMessage.sender_id == other_user_id,
        DirectMessage.receiver_id == current_user.id,
        DirectMessage.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "Mensajes marcados como leídos"}
