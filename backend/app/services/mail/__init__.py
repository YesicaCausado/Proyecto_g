"""
NeuroLearn IA — Paquete de correo transaccional.

Exporta solo el contrato y los tipos puros. La fábrica (``factory``) se
importa explícitamente donde se componen las dependencias, porque depende de
la configuración.
"""
from app.services.mail.ports import (
    EmailAddress,
    EmailConfigurationError,
    EmailDeliveryError,
    EmailMessage,
    EmailSender,
)

__all__ = [
    "EmailAddress",
    "EmailConfigurationError",
    "EmailDeliveryError",
    "EmailMessage",
    "EmailSender",
]
