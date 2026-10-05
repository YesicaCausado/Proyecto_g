"""
NeuroLearn IA — Adaptadores de correo sin proveedor externo.

- ``ConsoleEmailSender``: solo desarrollo local. Escribe el mensaje en el log
  para poder probar el flujo (por ejemplo, copiar el enlace de recuperación)
  sin una cuenta de Brevo.
- ``DisabledEmailSender``: producción sin configuración. Siempre falla con
  ``EmailConfigurationError`` para que el problema quede registrado y nunca
  se exponga contenido sensible en los logs de producción.
"""
from __future__ import annotations

import logging
import uuid

from app.services.mail.ports import EmailConfigurationError, EmailMessage

logger = logging.getLogger(__name__)


class ConsoleEmailSender:
    """Imprime el correo en el log. Nunca usar en producción."""

    def send(self, message: EmailMessage) -> str:
        message_id = f"console-{uuid.uuid4()}"
        logger.warning(
            "\n[DEV] Correo NO enviado (EMAIL_PROVIDER=console)\n"
            "Para: %s\nAsunto: %s\n%s\n",
            message.to.email,
            message.subject,
            message.text,
        )
        return message_id


class DisabledEmailSender:
    """Proveedor no configurado: rechaza todos los envíos."""

    def __init__(self, reason: str) -> None:
        self._reason = reason

    def send(self, message: EmailMessage) -> str:
        raise EmailConfigurationError(self._reason)
