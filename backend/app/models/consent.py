"""
NeuroLearn IA — Consentimientos de cámara y micrófono.

Cada aceptación crea un registro (historial auditable). Retirar el
consentimiento marca `revoked_at` en el registro vigente; volver a aceptar
crea uno nuevo. Un consentimiento solo es válido para la versión vigente del
texto (app/services/consent_service.py): si el texto cambia de versión, el
usuario debe aceptarlo de nuevo.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String

from app.db.database import Base

CONSENT_TYPES = ("camara_facial", "microfono_voz")


class UserConsent(Base):
    __tablename__ = "user_consents"

    id           = Column(Integer, primary_key=True, index=True)
    user_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    consent_type = Column(String(30), nullable=False)        # camara_facial | microfono_voz
    version      = Column(String(10), nullable=False)        # versión del texto aceptado
    granted_at   = Column(DateTime, nullable=False, default=datetime.utcnow)   # fecha y hora (UTC)
    revoked_at   = Column(DateTime, nullable=True)
    ip_address   = Column(String(45), nullable=True)
    user_agent   = Column(String(255), nullable=True)
