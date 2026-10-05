"""
NeuroLearn IA — Modelo de Token de Recuperación de Contraseña (CU-03).

Seguridad: la columna ``token`` guarda el hash SHA-256 (64 caracteres hex)
del token enviado por correo, nunca el token en claro. Así, una filtración de
la base de datos no permite restablecer contraseñas. Se conserva el nombre de
la columna para no requerir migración (migración 004b).
"""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String

from app.db.database import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # Hash SHA-256 del token (ver docstring del módulo).
    token      = Column(String(128), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    ip_address = Column(String(45), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utc_now, nullable=False)

    def __repr__(self) -> str:
        return f"<PasswordResetToken user_id={self.user_id} used={self.used}>"
