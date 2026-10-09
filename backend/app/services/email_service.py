"""
NeuroLearn IA — Fachada de correo para los módulos existentes.

Mantiene la firma pública ``send_credentials_email`` que usa
``api/credentials.py`` (alta de Súper Profesor, docentes y estudiantes), pero
delega en el puerto ``EmailSender`` (Brevo por defecto).

El envío de credenciales es "mejor esfuerzo": si falla, se registra y se
devuelve ``False``; la creación del usuario no se revierte porque el Súper
Profesor también ve la contraseña temporal en pantalla.

El correo de recuperación de contraseña ya no vive aquí: lo envía
``PasswordResetService`` (CU-03), que sí necesita saber si el envío falló.
"""
from __future__ import annotations

import logging

from app.core.config import settings
from app.services.mail.addresses import is_deliverable_email
from app.services.mail.factory import get_email_sender
from app.services.mail.ports import EmailAddress, EmailDeliveryError, EmailMessage
from app.services.mail.templates import render_credentials_email

logger = logging.getLogger(__name__)


def frontend_url(path: str = "") -> str:
    """URL pública de una pantalla del frontend (``FRONTEND_URL``).

    El frontend usa HashRouter: las rutas van después de ``#``
    (``https://app/#/reset-password``). Sin el ``#`` el navegador abre la
    landing y la pantalla nunca recibe el token (CU-03).
    """
    base = settings.FRONTEND_URL.rstrip("/")
    if not path:
        return base
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}/#{path}"


def send_credentials_email(
    to_email: str,
    to_name: str,
    username: str,
    temp_password: str,
    role: str,
) -> bool:
    """
    Envía las credenciales temporales al usuario recién creado.

    Returns:
        True si el proveedor aceptó el mensaje; False en cualquier otro caso.
    """
    if not is_deliverable_email(to_email):
        logger.info("Credenciales no enviadas: el usuario %s no tiene correo entregable.", username)
        return False

    rendered = render_credentials_email(
        recipient_name=to_name,
        username=username,
        temp_password=temp_password,
        role=role,
        login_url=frontend_url("/login"),
    )
    message = EmailMessage(
        to=EmailAddress(email=to_email, name=to_name),
        subject=rendered.subject,
        html=rendered.html,
        text=rendered.text,
        tags=("credenciales", role),
    )
    try:
        get_email_sender().send(message)
        return True
    except EmailDeliveryError as exc:
        logger.error("No se enviaron las credenciales de %s (%s): %s", username, role, exc)
        return False
