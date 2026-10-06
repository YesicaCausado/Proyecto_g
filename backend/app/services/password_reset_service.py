"""
NeuroLearn IA — Caso de uso CU-03 «Recuperar contraseña» (RF-ES-005 / RF-29).

Actores: Usuario (cualquier rol con correo real; principalmente Estudiante)
y Servicio de correo (Brevo).

Flujo:
1. ``request_reset``  — el usuario indica su usuario (n.º de documento) o
   correo; si la cuenta es elegible se genera un token de un solo uso y se
   envía un enlace por correo.
2. ``validate_token`` — la pantalla /reset-password comprueba el enlace.
3. ``reset_password`` — se fija la nueva contraseña y se invalida el token.

Reglas de negocio:
- RN-CU03-01 La respuesta pública de la solicitud es siempre la misma
  (no revela si la cuenta existe, está inactiva o no tiene correo).
- RN-CU03-02 Solo se envía a correos entregables; las cuentas con correo
  ficticio ``@neurolearn.local`` deben pedir el restablecimiento al
  Administrador (CU-42).
- RN-CU03-03 El enlace expira (15 min por defecto) y es de un solo uso.
  Al emitir uno nuevo se invalidan los anteriores.
- RN-CU03-04 Límite por cuenta: 1 solicitud por minuto y 3 por hora,
  guardado en BD (funciona en Vercel, donde la memoria no se comparte).
- RN-CU03-05 La base de datos guarda solo el hash SHA-256 del token.
- RN-CU03-06 La nueva contraseña cumple la política de fortaleza y debe ser
  distinta de la actual. Restablecerla también quita ``must_change_password``.
- RN-CU03-07 Tras el cambio se envía una notificación al correo (mejor esfuerzo).

Este módulo no importa FastAPI ni SQLAlchemy: recibe sus dependencias por
constructor (Dependency Injection) para poder probarse en aislamiento.
"""
from __future__ import annotations

import enum
import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, Protocol

from app.services.mail.addresses import is_deliverable_email
from app.services.mail.ports import EmailAddress, EmailDeliveryError, EmailMessage, EmailSender
from app.services.mail.templates import render_password_changed_email, render_password_reset_email

logger = logging.getLogger(__name__)


# ─── Contratos de las dependencias ───────────────────────────────────────────

class ResetUser(Protocol):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str
    institution_id: Optional[int]
    is_active: bool
    hashed_password: str
    must_change_password: bool


class ResetToken(Protocol):
    id: int
    user_id: int
    expires_at: datetime
    used: bool


class UserRepository(Protocol):
    def find_by_identifier(self, identifier: str) -> Optional[ResetUser]: ...

    def get_by_id(self, user_id: int) -> Optional[ResetUser]: ...


class PasswordResetTokenRepository(Protocol):
    def add(
        self,
        *,
        user_id: int,
        token_hash: str,
        expires_at: datetime,
        created_at: datetime,
        ip_address: Optional[str],
    ) -> ResetToken: ...

    def find_by_hash(self, token_hash: str, *, for_update: bool = False) -> Optional[ResetToken]: ...

    def latest_created_at(self, user_id: int) -> Optional[datetime]: ...

    def count_created_since(self, user_id: int, since: datetime) -> int: ...

    def invalidate_active(self, user_id: int) -> int: ...


class AuditRecorder(Protocol):
    def record(self, *, action: str, user: ResetUser, ip_address: Optional[str], notes: str = "") -> None: ...


class TransactionManager(Protocol):
    """Lo cumple ``sqlalchemy.orm.Session``."""

    def commit(self) -> None: ...

    def rollback(self) -> None: ...


PasswordHasher = Callable[[str], str]
PasswordVerifier = Callable[[str, str], bool]
#: Devuelve None si la contraseña es válida o el mensaje de error.
PasswordPolicyCheck = Callable[[str], Optional[str]]
Clock = Callable[[], datetime]
TokenFactory = Callable[[], str]


# ─── Configuración, resultados y errores ─────────────────────────────────────

@dataclass(frozen=True)
class PasswordResetPolicy:
    reset_page_url: str
    login_url: str
    token_ttl_minutes: int = 15
    cooldown_seconds: int = 60
    max_requests_per_hour: int = 3


class RequestOutcome(str, enum.Enum):
    """Resultado interno (logs y pruebas). Nunca se expone al cliente."""

    SENT = "sent"
    UNKNOWN_ACCOUNT = "unknown_account"
    INACTIVE_ACCOUNT = "inactive_account"
    NO_DELIVERABLE_EMAIL = "no_deliverable_email"
    THROTTLED = "throttled"
    DELIVERY_FAILED = "delivery_failed"


class TokenProblem(str, enum.Enum):
    NOT_FOUND = "not_found"
    USED = "used"
    EXPIRED = "expired"


class PasswordResetError(Exception):
    """Base de los errores de negocio de CU-03."""


class InvalidResetTokenError(PasswordResetError):
    MESSAGES = {
        TokenProblem.NOT_FOUND: "El enlace no es válido. Solicita uno nuevo.",
        TokenProblem.USED: "Este enlace ya fue utilizado. Solicita uno nuevo si lo necesitas.",
        TokenProblem.EXPIRED: "El enlace ha expirado. Solicita uno nuevo.",
    }

    def __init__(self, problem: TokenProblem) -> None:
        self.problem = problem
        super().__init__(self.MESSAGES[problem])


class WeakPasswordError(PasswordResetError):
    pass


class PasswordReuseError(PasswordResetError):
    def __init__(self) -> None:
        super().__init__("La nueva contraseña debe ser diferente de la anterior.")


# ─── Utilidades ──────────────────────────────────────────────────────────────

def hash_reset_token(raw_token: str) -> str:
    """SHA-256 hex (64 caracteres). Suficiente para tokens aleatorios de 256 bits."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    """SQLite y columnas sin zona devuelven datetimes ingenuos: se asume UTC."""
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _new_raw_token() -> str:
    return secrets.token_urlsafe(32)


# ─── Servicio ────────────────────────────────────────────────────────────────

class PasswordResetService:
    def __init__(
        self,
        *,
        users: UserRepository,
        tokens: PasswordResetTokenRepository,
        audit: AuditRecorder,
        transaction: TransactionManager,
        email_sender: EmailSender,
        hash_password: PasswordHasher,
        verify_password: PasswordVerifier,
        check_password_policy: PasswordPolicyCheck,
        policy: PasswordResetPolicy,
        clock: Clock = _utc_now,
        token_factory: TokenFactory = _new_raw_token,
    ) -> None:
        self._users = users
        self._tokens = tokens
        self._audit = audit
        self._tx = transaction
        self._email = email_sender
        self._hash_password = hash_password
        self._verify_password = verify_password
        self._check_policy = check_password_policy
        self._policy = policy
        self._now = clock
        self._new_token = token_factory

    # ── Paso 1: solicitar enlace ────────────────────────────────────────────

    def request_reset(self, identifier: str, ip_address: Optional[str] = None) -> RequestOutcome:
        identifier = (identifier or "").strip()
        user = self._users.find_by_identifier(identifier) if identifier else None

        if user is None:
            return self._log_outcome(RequestOutcome.UNKNOWN_ACCOUNT, None)
        if not user.is_active:
            return self._log_outcome(RequestOutcome.INACTIVE_ACCOUNT, user)
        if not is_deliverable_email(user.email):
            return self._log_outcome(RequestOutcome.NO_DELIVERABLE_EMAIL, user)

        now = self._now()
        if self._is_throttled(user.id, now):
            return self._log_outcome(RequestOutcome.THROTTLED, user)

        # Un solo enlace vigente por cuenta.
        self._tokens.invalidate_active(user.id)

        raw_token = self._new_token()
        token = self._tokens.add(
            user_id=user.id,
            token_hash=hash_reset_token(raw_token),
            expires_at=now + timedelta(minutes=self._policy.token_ttl_minutes),
            created_at=now,
            ip_address=ip_address,
        )
        self._audit.record(action="password_reset_requested", user=user, ip_address=ip_address)
        # Se confirma ANTES de enviar: así nunca llega un enlace que la BD no
        # conozca y no se mantiene una transacción abierta durante la llamada HTTP.
        self._tx.commit()

        try:
            self._email.send(self._build_reset_message(user, raw_token))
        except EmailDeliveryError as exc:
            logger.error("CU-03: no se pudo enviar el enlace al usuario id=%s: %s", user.id, exc)
            token.used = True  # enlace que nadie recibió: se anula
            self._tx.commit()
            return RequestOutcome.DELIVERY_FAILED

        return self._log_outcome(RequestOutcome.SENT, user)

    # ── Paso 2: validar enlace ──────────────────────────────────────────────

    def validate_token(self, raw_token: str) -> None:
        """Lanza ``InvalidResetTokenError`` si el enlace no sirve."""
        self._require_valid_token(raw_token, for_update=False)

    # ── Paso 3: fijar nueva contraseña ──────────────────────────────────────

    def reset_password(self, raw_token: str, new_password: str, ip_address: Optional[str] = None) -> None:
        try:
            token = self._require_valid_token(raw_token, for_update=True)

            policy_error = self._check_policy(new_password)
            if policy_error:
                raise WeakPasswordError(policy_error)

            user = self._users.get_by_id(token.user_id)
            if user is None or not user.is_active:
                raise InvalidResetTokenError(TokenProblem.NOT_FOUND)

            if self._verify_password(new_password, user.hashed_password):
                raise PasswordReuseError()

            user.hashed_password = self._hash_password(new_password)
            user.must_change_password = False
            token.used = True
            self._tokens.invalidate_active(user.id)
            self._audit.record(action="password_reset_completed", user=user, ip_address=ip_address)
            self._tx.commit()
        except PasswordResetError:
            self._tx.rollback()  # libera el bloqueo FOR UPDATE
            raise

        self._notify_password_changed(user, ip_address)

    # ── Internos ────────────────────────────────────────────────────────────

    def _require_valid_token(self, raw_token: str, *, for_update: bool) -> ResetToken:
        if not raw_token:
            raise InvalidResetTokenError(TokenProblem.NOT_FOUND)
        token = self._tokens.find_by_hash(hash_reset_token(raw_token), for_update=for_update)
        if token is None:
            raise InvalidResetTokenError(TokenProblem.NOT_FOUND)
        if token.used:
            raise InvalidResetTokenError(TokenProblem.USED)
        if _as_utc(token.expires_at) <= self._now():
            raise InvalidResetTokenError(TokenProblem.EXPIRED)
        return token

    def _is_throttled(self, user_id: int, now: datetime) -> bool:
        latest = self._tokens.latest_created_at(user_id)
        if latest is not None and now - _as_utc(latest) < timedelta(seconds=self._policy.cooldown_seconds):
            return True
        recent = self._tokens.count_created_since(user_id, now - timedelta(hours=1))
        return recent >= self._policy.max_requests_per_hour

    def _build_reset_message(self, user: ResetUser, raw_token: str) -> EmailMessage:
        name = user.full_name or user.username
        rendered = render_password_reset_email(
            recipient_name=name,
            reset_url=f"{self._policy.reset_page_url}?token={raw_token}",
            expires_in_minutes=self._policy.token_ttl_minutes,
        )
        return EmailMessage(
            to=EmailAddress(email=str(user.email), name=name),
            subject=rendered.subject,
            html=rendered.html,
            text=rendered.text,
            tags=("recuperar-contrasena",),
        )

    def _notify_password_changed(self, user: ResetUser, ip_address: Optional[str]) -> None:
        if not is_deliverable_email(user.email):
            return
        name = user.full_name or user.username
        rendered = render_password_changed_email(name, self._policy.login_url, ip_address)
        try:
            self._email.send(
                EmailMessage(
                    to=EmailAddress(email=str(user.email), name=name),
                    subject=rendered.subject,
                    html=rendered.html,
                    text=rendered.text,
                    tags=("contrasena-cambiada",),
                )
            )
        except EmailDeliveryError as exc:
            logger.warning("CU-03: no se envió la notificación de cambio (usuario id=%s): %s", user.id, exc)

    @staticmethod
    def _log_outcome(outcome: RequestOutcome, user: Optional[ResetUser]) -> RequestOutcome:
        logger.info("CU-03 solicitud de recuperación: %s (usuario id=%s)", outcome.value, getattr(user, "id", None))
        return outcome
