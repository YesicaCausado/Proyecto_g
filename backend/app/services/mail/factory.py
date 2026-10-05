"""
NeuroLearn IA — Composición del proveedor de correo (Dependency Injection).

Único punto que conoce la configuración y decide qué adaptador usar:

    EMAIL_PROVIDER=brevo    → BrevoEmailSender (requiere BREVO_API_KEY y EMAIL_FROM)
    EMAIL_PROVIDER=console  → ConsoleEmailSender (solo fuera de producción)

Si falta configuración en producción se devuelve ``DisabledEmailSender``,
que registra el error en cada intento sin exponer datos sensibles.
"""
from __future__ import annotations

import logging

from app.core.config import settings
from app.services.mail.addresses import parse_sender
from app.services.mail.brevo import BrevoEmailSender
from app.services.mail.console import ConsoleEmailSender, DisabledEmailSender
from app.services.mail.ports import EmailConfigurationError, EmailSender

logger = logging.getLogger(__name__)


def _brevo_api_key() -> str:
    """BREVO_API_KEY o, como respaldo, el nombre heredado RESEND_API_KEY."""
    return settings.BREVO_API_KEY or settings.RESEND_API_KEY or ""


def get_email_sender() -> EmailSender:
    """Construye el adaptador según la configuración vigente."""
    provider = (settings.EMAIL_PROVIDER or "brevo").strip().lower()

    if provider == "console":
        if settings.IS_PRODUCTION:
            return DisabledEmailSender("EMAIL_PROVIDER=console no está permitido en producción.")
        return ConsoleEmailSender()

    if provider == "brevo":
        api_key = _brevo_api_key()
        if not api_key:
            if settings.IS_PRODUCTION:
                return DisabledEmailSender("BREVO_API_KEY no está configurada.")
            logger.warning("BREVO_API_KEY vacía: se usará el correo de consola (desarrollo).")
            return ConsoleEmailSender()
        try:
            sender = parse_sender(settings.EMAIL_FROM)
        except EmailConfigurationError as exc:
            return DisabledEmailSender(str(exc))
        return BrevoEmailSender(
            api_key=api_key,
            sender=sender,
            timeout_seconds=settings.EMAIL_HTTP_TIMEOUT,
        )

    return DisabledEmailSender(f"EMAIL_PROVIDER desconocido: {provider!r}")


def is_email_configured() -> bool:
    """Para el panel del Administrador (CU-45 Monitorear estado del sistema)."""
    if (settings.EMAIL_PROVIDER or "brevo").strip().lower() != "brevo":
        return False
    if not _brevo_api_key():
        return False
    try:
        parse_sender(settings.EMAIL_FROM)
    except EmailConfigurationError:
        return False
    return True
