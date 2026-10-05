"""
NeuroLearn IA — Puerto de envío de correo (Clean Architecture).

Define el contrato que usan los casos de uso (p. ej. CU-03 Recuperar
contraseña) para enviar correos, sin depender de un proveedor concreto.

Los adaptadores (Brevo, consola de desarrollo, etc.) implementan
``EmailSender``. Para cambiar de proveedor solo se agrega un adaptador y se
registra en ``factory.py``; los servicios de negocio no cambian.

Este módulo es Python puro: no importa FastAPI, SQLAlchemy ni la
configuración, para poder probarse de forma aislada.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional, Protocol, Tuple, runtime_checkable


@dataclass(frozen=True)
class EmailAddress:
    """Dirección de correo con nombre visible opcional."""

    email: str
    name: Optional[str] = None


@dataclass(frozen=True)
class EmailMessage:
    """Mensaje listo para enviar (contenido ya renderizado)."""

    to: EmailAddress
    subject: str
    html: str
    text: str
    # Etiquetas para trazabilidad en el panel del proveedor (p. ej. Brevo).
    tags: Tuple[str, ...] = field(default_factory=tuple)


class EmailDeliveryError(Exception):
    """El proveedor no aceptó el mensaje o no fue posible contactarlo."""


class EmailConfigurationError(EmailDeliveryError):
    """El servicio de correo no está configurado (API key o remitente)."""


@runtime_checkable
class EmailSender(Protocol):
    """Contrato de cualquier proveedor de correo transaccional."""

    def send(self, message: EmailMessage) -> str:
        """
        Envía el mensaje.

        Returns:
            Identificador del mensaje asignado por el proveedor.

        Raises:
            EmailDeliveryError: si el envío falla por cualquier motivo.
        """
        ...
