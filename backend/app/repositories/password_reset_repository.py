"""
NeuroLearn IA — Repositorios SQLAlchemy usados por CU-03 «Recuperar contraseña».

Implementan los contratos definidos en ``app.services.password_reset_service``.
No hacen commit: la transacción la controla el servicio.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.institution import AuditLog
from app.models.password_reset import PasswordResetToken
from app.models.user import User


class SqlAlchemyUserRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def find_by_identifier(self, identifier: str) -> Optional[User]:
        """
        Busca por usuario (n.º de documento para estudiantes) y, si no hay
        coincidencia, por correo sin distinguir mayúsculas.
        """
        user = self._db.query(User).filter(User.username == identifier).first()
        if user is not None:
            return user
        if "@" not in identifier:
            return None
        return (
            self._db.query(User)
            .filter(func.lower(User.email) == identifier.lower())
            .first()
        )

    def get_by_id(self, user_id: int) -> Optional[User]:
        return self._db.query(User).filter(User.id == user_id).first()


class SqlAlchemyPasswordResetTokenRepository:
    def __init__(self, db: Session) -> None:
        self._db = db

    def add(
        self,
        *,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
        created_at: datetime,
        ip_address: Optional[str],
    ) -> PasswordResetToken:
        token = PasswordResetToken(
            user_id=user_id,
            token=token_hash,
            expires_at=expires_at,
            created_at=created_at,
            ip_address=(ip_address or None) and ip_address[:45],
        )
        self._db.add(token)
        self._db.flush()
        return token

    def find_by_hash(self, token_hash: str, *, for_update: bool = False) -> Optional[PasswordResetToken]:
        query = self._db.query(PasswordResetToken).filter(PasswordResetToken.token == token_hash)
        if for_update:
            # PostgreSQL: evita que dos peticiones usen el mismo enlace a la vez.
            # SQLite ignora la cláusula.
            query = query.with_for_update()
        return query.first()

    def latest_created_at(self, user_id: int) -> Optional[datetime]:
        return (
            self._db.query(func.max(PasswordResetToken.created_at))
            .filter(PasswordResetToken.user_id == user_id)
            .scalar()
        )

    def count_created_since(self, user_id: int, since: datetime) -> int:
        return (
            self._db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.created_at >= since,
            )
            .count()
        )

    def invalidate_active(self, user_id: int) -> int:
        return (
            self._db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.user_id == user_id,
                PasswordResetToken.used.is_(False),
            )
            .update({"used": True}, synchronize_session=False)
        )


class SqlAlchemyAuditRecorder:
    """Registra eventos de CU-03 en ``audit_logs`` (visibles en CU-35)."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def record(self, *, action: str, user: User, ip_address: Optional[str], notes: str = "") -> None:
        self._db.add(
            AuditLog(
                action=action,
                performed_by_id=user.id,  # autoservicio: el propio usuario
                target_user_id=user.id,
                institution_id=user.institution_id,
                user_type=user.role,
                ip_address=(ip_address or None) and ip_address[:45],
                notes=notes or None,
            )
        )
