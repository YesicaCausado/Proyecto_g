"""
NeuroLearn IA — Servicio de notificaciones persistentes.

Las notificaciones se crean a partir de eventos reales, en la MISMA
transacción que el evento: `notify()` agrega las filas a la sesión y no hace
commit; el endpoint que genera el evento confirma todo junto. Si el commit
falla, no queda ni el evento ni su notificación (sin estados incoherentes).

Tipos y grupo de preferencia del perfil al que pertenecen:

    neurobot_asignado      nueva_actividad   → estudiante
    neurobot_completado    nueva_actividad   → profesor que asignó
    evaluacion_publicada   nueva_actividad   → estudiantes del aula
    alerta_riesgo          nueva_actividad   → profesor del aula y Súper Profesor
    actividad_institucional nueva_actividad  → Súper Profesor
    racha / rendimiento    nueva_actividad   → estudiante
    mensaje_directo        mensaje_directo   → destinatario del mensaje
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notification import Notification, NotificationPreference
from app.models.user import User, UserRole

# tipo → (grupo de preferencia, icono del frontend)
NOTIFICATION_TYPES: Dict[str, tuple] = {
    "neurobot_asignado":       ("nueva_actividad", "bot"),
    "neurobot_completado":     ("nueva_actividad", "trophy"),
    "evaluacion_publicada":    ("nueva_actividad", "clipboard"),
    "alerta_riesgo":           ("nueva_actividad", "alert"),
    "actividad_institucional": ("nueva_actividad", "building"),
    "racha":                   ("nueva_actividad", "flame"),
    "rendimiento":             ("nueva_actividad", "star"),
    "mensaje_directo":         ("mensaje_directo", "message"),
    "automatizacion":          ("nueva_actividad", "alert"),
}
PREFERENCE_FIELDS = ("nueva_actividad", "mensaje_directo")

MAX_TITLE = 200
MAX_MESSAGE = 500


def utcnow() -> datetime:
    """UTC sin zona (convención de la base)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() + "Z" if value else None


# ── Preferencias ───────────────────────────────────────────────────────────

def get_preferences(db: Session, user_id: int) -> Dict[str, bool]:
    row = db.get(NotificationPreference, user_id)
    if row is None:
        return {field: True for field in PREFERENCE_FIELDS}
    return {field: bool(getattr(row, field)) for field in PREFERENCE_FIELDS}


def set_preferences(db: Session, user_id: int, values: Dict[str, bool]) -> Dict[str, bool]:
    row = db.get(NotificationPreference, user_id)
    if row is None:
        row = NotificationPreference(user_id=user_id)
        db.add(row)
    for field in PREFERENCE_FIELDS:
        if field in values and values[field] is not None:
            setattr(row, field, bool(values[field]))
    row.updated_at = utcnow()
    db.flush()
    return get_preferences(db, user_id)


def _allowed_recipients(db: Session, user_ids: Iterable[int], notif_type: str) -> List[int]:
    group = NOTIFICATION_TYPES[notif_type][0]
    ids = sorted({int(u) for u in user_ids if u})
    if not ids:
        return []
    disabled = {
        r.user_id for r in db.query(NotificationPreference).filter(
            NotificationPreference.user_id.in_(ids),
            getattr(NotificationPreference, group) == False,  # noqa: E712
        )
    }
    return [u for u in ids if u not in disabled]


# ── Creación ───────────────────────────────────────────────────────────────

def notify(
    db: Session,
    user_ids: Iterable[int],
    notif_type: str,
    title: str,
    message: str,
    link: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    dedupe_key: Optional[str] = None,
) -> List[Notification]:
    """Agrega una notificación por destinatario a la sesión (sin commit).

    Respeta las preferencias del perfil y, si hay `dedupe_key`, no repite una
    notificación que el usuario ya tiene con esa misma clave.
    """
    if notif_type not in NOTIFICATION_TYPES:
        raise ValueError(f"Tipo de notificación desconocido: {notif_type}")
    recipients = _allowed_recipients(db, user_ids, notif_type)
    if dedupe_key and recipients:
        existing = {
            r.user_id for r in db.query(Notification.user_id).filter(
                Notification.user_id.in_(recipients), Notification.dedupe_key == dedupe_key)
        }
        recipients = [u for u in recipients if u not in existing]
    created = []
    now = utcnow()
    for user_id in recipients:
        n = Notification(
            user_id=user_id, type=notif_type, title=title[:MAX_TITLE],
            message=(message or "")[:MAX_MESSAGE], link=link,
            resource_type=resource_type, resource_id=resource_id,
            is_read=False, created_at=now, dedupe_key=dedupe_key,
        )
        db.add(n)
        created.append(n)
    if created:
        db.flush()
    return created


def notify_direct_message(db: Session, sender: User, receiver: User, preview: str) -> Optional[Notification]:
    """Un mensaje nuevo. Si ya hay una notificación sin leer del mismo
    remitente, se actualiza (con el conteo) en vez de apilar una por mensaje."""
    if not _allowed_recipients(db, [receiver.id], "mensaje_directo"):
        return None
    link = messages_link(receiver.role, sender.id)
    sender_name = sender.full_name or sender.username
    preview = (preview or "").strip() or "Te envió un archivo adjunto."
    if len(preview) > 140:
        preview = preview[:137] + "…"
    pending = db.query(Notification).filter(
        Notification.user_id == receiver.id,
        Notification.type == "mensaje_directo",
        Notification.resource_type == "usuario",
        Notification.resource_id == sender.id,
        Notification.is_read == False,  # noqa: E712
    ).first()
    if pending is not None:
        count = int(pending.dedupe_key.split(":")[-1]) + 1 if pending.dedupe_key else 2
        pending.title = f"{count} mensajes nuevos de {sender_name}"[:MAX_TITLE]
        pending.message = preview
        pending.created_at = utcnow()
        pending.link = link
        pending.dedupe_key = f"mensajes:{sender.id}:{pending.id}:{count}"
        db.flush()
        return pending
    created = notify(db, [receiver.id], "mensaje_directo", f"Nuevo mensaje de {sender_name}", preview,
                     link=link, resource_type="usuario", resource_id=sender.id)
    if created:
        created[0].dedupe_key = f"mensajes:{sender.id}:{created[0].id}:1"
        db.flush()
    return created[0] if created else None


# ── Destinatarios y enlaces por rol ────────────────────────────────────────

def super_profesores_of(db: Session, institution_id: Optional[int], exclude: Iterable[int] = ()) -> List[int]:
    if not institution_id:
        return []
    excluded = set(exclude)
    rows = db.query(User.id).filter(
        User.role == UserRole.SUPER_PROFESOR.value,
        User.institution_id == institution_id,
        User.is_active == True,  # noqa: E712
    ).all()
    return [r.id for r in rows if r.id not in excluded]


def messages_link(role: Optional[str], other_user_id: int) -> Optional[str]:
    if role == UserRole.ESTUDIANTE.value:
        return f"/messages?with={other_user_id}"
    if role == UserRole.PROFESOR.value:
        return f"/teacher?tab=mensajes&with={other_user_id}"
    if role == UserRole.SUPER_PROFESOR.value:
        return f"/super?tab=mensajeria&with={other_user_id}"
    return None


def alerts_link(role: Optional[str]) -> Optional[str]:
    if role == UserRole.PROFESOR.value:
        return "/teacher?tab=alertas"
    if role == UserRole.SUPER_PROFESOR.value:
        return "/super?tab=alertas"
    return None


# ── Consulta ───────────────────────────────────────────────────────────────

def serialize(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "icon": NOTIFICATION_TYPES.get(n.type, ("", "bell"))[1],
        "title": n.title,
        "message": n.message,
        "link": n.link,
        "resource_type": n.resource_type,
        "resource_id": n.resource_id,
        "read": bool(n.is_read),
        "read_at": iso(n.read_at),
        "created_at": iso(n.created_at),
    }


def unread_count(db: Session, user_id: int) -> int:
    return db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id, Notification.is_read == False,  # noqa: E712
    ).scalar() or 0


# ── Rachas y rendimiento (estudiante) ──────────────────────────────────────
# Se evalúan con el historial real de quizzes cuando el estudiante consulta
# sus notificaciones y se guardan una sola vez por condición (dedupe_key).

COLOMBIA = timezone(timedelta(hours=-5))


def _activity_dates(db: Session, user_id: int, since_days: int = 366) -> set:
    from app.models.learning import QuizHistory
    since = utcnow() - timedelta(days=since_days)
    rows = db.query(QuizHistory.completed_at).filter(
        QuizHistory.user_id == user_id,
        QuizHistory.completed_at.isnot(None),
        QuizHistory.completed_at >= since,
    ).all()
    # Días calendario de Colombia (las fechas se guardan en UTC).
    return {r[0].replace(tzinfo=timezone.utc).astimezone(COLOMBIA).date() for r in rows}


def ensure_activity_notifications(db: Session, user: User, today: Optional[date] = None) -> int:
    """Crea (si corresponde y no existen) las notificaciones de racha y
    rendimiento del estudiante. Retorna cuántas creó (sin commit)."""
    if user.role != UserRole.ESTUDIANTE.value:
        return 0
    from app.models.learning import QuizHistory

    today = today or utcnow().replace(tzinfo=timezone.utc).astimezone(COLOMBIA).date()
    dates = _activity_dates(db, user.id)
    created = 0
    yesterday = today - timedelta(days=1)

    if yesterday in dates and today not in dates:
        created += len(notify(
            db, [user.id], "racha", "¡Tu racha está en riesgo!",
            "Ayer practicaste, pero hoy todavía no. Haz al menos un quiz hoy para mantener tu racha.",
            link="/quizzes", dedupe_key=f"racha_riesgo:{today.isoformat()}"))

    streak, day = 0, (today if today in dates else yesterday)
    while day in dates:
        streak += 1
        day -= timedelta(days=1)
    if streak >= 7 and streak % 7 == 0:
        created += len(notify(
            db, [user.id], "racha", f"🔥 ¡{streak} días de racha!",
            f"Llevas {streak} días seguidos practicando. ¡Sigue así!",
            link="/performance", dedupe_key=f"racha_logro:{streak}:{(today - timedelta(days=streak - 1)).isoformat()}"))

    since = utcnow() - timedelta(days=3)
    recent = db.query(QuizHistory.performance_score).filter(
        QuizHistory.user_id == user.id,
        QuizHistory.completed_at.isnot(None),
        QuizHistory.completed_at >= since,
        QuizHistory.performance_score.isnot(None),
    ).all()
    if len(recent) >= 2:
        avg = sum(r[0] for r in recent) / len(recent)
        week = f"{today.isocalendar()[0]}-W{today.isocalendar()[1]:02d}"
        if avg >= 80:
            created += len(notify(
                db, [user.id], "rendimiento", "¡Excelente rendimiento!",
                f"Promedio de {round(avg)}% en tus {len(recent)} quizzes de los últimos 3 días.",
                link="/performance", dedupe_key=f"rendimiento_alto:{week}"))
        elif avg < 50:
            created += len(notify(
                db, [user.id], "rendimiento", "Área de oportunidad",
                f"Promedio de {round(avg)}% en tus {len(recent)} quizzes de los últimos 3 días. "
                "Revisa tu desempeño para ver qué temas reforzar.",
                link="/performance", dedupe_key=f"rendimiento_bajo:{week}"))
    return created
