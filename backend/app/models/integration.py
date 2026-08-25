"""
NeuroLearn AI - Modelo de Integraciones y Automatizaciones
=============================================================
Integraciones conectadas (Google Drive, Google Calendar, Webhooks) y
automatizaciones (evento → acción). Soporta el modelo multi-tenant:
toda fila queda ligada a su `institution_id` y, en el caso de las
integraciones, al `user_id` que la conectó.

Los tokens de Google (access/refresh) se guardan CIFRADOS con la clave
del servidor (SECRET_KEY) — nunca en claro, y nunca viajan al frontend.
"""
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, JSON,
    ForeignKey, Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


class IntegrationProvider(str):
    GOOGLE_DRIVE   = "google_drive"
    GOOGLE_CALENDAR = "google_calendar"
    WEBHOOK        = "webhook"


class Integration(Base):
    """Conexión real de una institución/usuario con un proveedor."""
    __tablename__ = "integrations"

    id               = Column(Integer, primary_key=True, index=True)
    institution_id   = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider         = Column(String(40), nullable=False, index=True)   # google_drive|google_calendar|webhook

    # Estado de la conexión (para fecha de caducidad del token)
    status           = Column(String(20), default="connected")  # connected|error|token_expired|disconnected

    # Datos de cuenta / configuración del proveedor
    account_email    = Column(String(200), nullable=True)        # correo de la cuenta Google conectada
    account_label    = Column(String(200), nullable=True)        # etiqueta amigable del proveedor

    # Tokens Google CIFRADOS (se descifran solo al usarlos, en backend).
    access_token     = Column(Text, nullable=True)   # ciphertext
    refresh_token    = Column(Text, nullable=True)   # ciphertext
    token_expires_at = Column(DateTime, nullable=True)

    # Configuración específica del proveedor (JSON):
    #   - google_drive: { "folder_id": .., "folder_name": .. }
    #   - google_calendar: { "calendar_id": .., "calendar_name": .. }
    #   - webhook: { "url": .., "secret": .., "last_status": .., "last_response": .. }
    config           = Column(JSON, default=dict)

    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relación con el usuario que conectó (útil para mostrar correo).
    user = relationship("User", foreign_keys=[user_id])


class AutomationTrigger(str):
    NUEVO_ESTUDIANTE    = "nuevo_estudiante"
    NUEVA_ACTIVIDAD     = "nueva_actividad"
    BAJO_RENDIMIENTO    = "bajo_rendimiento"
    REPORTE_GENERADO    = "reporte_generado"


class AutomationAction(str):
    CREAR_ALERTA        = "crear_alerta"
    ENVIAR_NOTIFICACION = "enviar_notificacion"
    GOOGLE_CALENDAR     = "google_calendar"
    WEBHOOK             = "webhook"


class Automation(Base):
    """Automatización configurada por un docente (evento → acción)."""
    __tablename__ = "automations"

    id             = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)
    created_by     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name           = Column(String(200), nullable=False)
    trigger        = Column(String(40), nullable=False)   # AutomationTrigger
    action         = Column(String(40), nullable=False)   # AutomationAction
    # Configuración específica de la automatización (JSON):
    #   - umbral para bajo_rendimiento: { "threshold": 60 }
    #   - calendar_id para google_calendar, webhook_id para webhook, ...
    configuration  = Column(JSON, default=dict)
    enabled        = Column(Boolean, default=True)

    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    executions = relationship(
        "AutomationExecution",
        back_populates="automation",
        cascade="all, delete-orphan",
    )


class AutomationExecution(Base):
    """Trazabilidad de cada ejecución de una automatización (historial real)."""
    __tablename__ = "automation_executions"

    id             = Column(Integer, primary_key=True, index=True)
    automation_id  = Column(Integer, ForeignKey("automations.id"), nullable=False, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=False, index=True)

    event          = Column(String(120), nullable=True)   # descripción del evento que disparó
    status         = Column(String(20), default="ok")     # ok | error
    detail         = Column(Text, nullable=True)          # detalle / respuesta del webhook
    executed_at    = Column(DateTime, default=datetime.utcnow)

    automation = relationship("Automation", back_populates="executions")