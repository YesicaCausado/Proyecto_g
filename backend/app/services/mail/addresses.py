"""
NeuroLearn IA — Reglas sobre direcciones de correo de usuarios.

Regla de negocio (credentials.py): cuando el Súper Profesor crea un
estudiante sin correo, el sistema le asigna una dirección ficticia
``{numero_documento}@neurolearn.local`` porque la columna ``email`` debe ser
única. Esa dirección NO es entregable y nunca debe recibir correos.
"""
from __future__ import annotations

from email.utils import parseaddr
from typing import Optional

from app.services.mail.ports import EmailAddress, EmailConfigurationError

#: Dominio de las direcciones ficticias generadas para cuentas sin correo.
PLACEHOLDER_EMAIL_DOMAIN = "neurolearn.local"


def placeholder_email_for(document_number: str) -> str:
    """Dirección ficticia para un usuario creado sin correo real."""
    return f"{document_number}@{PLACEHOLDER_EMAIL_DOMAIN}"


def is_deliverable_email(email: Optional[str]) -> bool:
    """True si la dirección puede recibir correos reales."""
    if not email:
        return False
    normalized = email.strip().lower()
    if normalized.count("@") != 1:
        return False
    local, domain = normalized.split("@")
    if not local or "." not in domain:
        return False
    return domain != PLACEHOLDER_EMAIL_DOMAIN


def parse_sender(raw: str) -> EmailAddress:
    """
    Convierte ``"Nombre <correo@dominio>"`` (formato de ``EMAIL_FROM``) en
    ``EmailAddress``. También acepta solo el correo.

    Raises:
        EmailConfigurationError: si no contiene una dirección válida.
    """
    name, address = parseaddr(raw or "")
    if not address or "@" not in address:
        raise EmailConfigurationError(
            "EMAIL_FROM no contiene una dirección de remitente válida."
        )
    return EmailAddress(email=address, name=name or None)
