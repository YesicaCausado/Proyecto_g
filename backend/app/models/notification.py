"""
NeuroLearn IA — Notificaciones persistentes.

Cada notificación nace de un evento real del sistema (asignación de un
NeuroBot, NeuroBot completado, mensaje directo, evaluación publicada, alerta
de riesgo, actividad institucional, racha o rendimiento) y se guarda para su
destinatario. `link` es la ruta del frontend del recurso exacto
(`resource_type` + `resource_id`) y `is_read` persiste al marcarla como leída.

`dedupe_key` evita duplicar notificaciones derivadas de una condición que se
evalúa más de una vez (p. ej. «racha en riesgo» del mismo día).
"""
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint,
)

from app.db.database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        UniqueConstraint("user_id", "dedupe_key", name="uq_notification_dedupe"),
        Index("ix_notifications_user_read", "user_id", "is_read"),
    )

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type          = Column(String(40), nullable=False)
    title         = Column(String(200), nullable=False)
    message       = Column(Text, nullable=False, default="")
    link          = Column(String(300), nullable=True)
    resource_type = Column(String(40), nullable=True)
    resource_id   = Column(Integer, nullable=True)
    is_read       = Column(Boolean, nullable=False, default=False)
    read_at       = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    dedupe_key    = Column(String(120), nullable=True)


class NotificationPreference(Base):
    """Preferencias del perfil: si están desactivadas, no se crean
    notificaciones de ese grupo para el usuario."""

    __tablename__ = "notification_preferences"

    user_id         = Column(Integer, ForeignKey("users.id"), primary_key=True)
    nueva_actividad = Column(Boolean, nullable=False, default=True)
    mensaje_directo = Column(Boolean, nullable=False, default=True)
    updated_at      = Column(DateTime, nullable=False, default=datetime.utcnow)
