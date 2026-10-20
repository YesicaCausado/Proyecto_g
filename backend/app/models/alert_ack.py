"""
NeuroLearn IA — Alertas marcadas como resueltas.

Las NeuroAlertas no se guardan: se derivan en cada consulta de la inscripción
del estudiante (app/services/neuroalert_service.py). Aquí solo se guarda que
un usuario (profesor o Súper Profesor) revisó una alerta concreta.

`signature` resume el estado que originó la alerta (fecha de la última
actividad, sesiones, nivel y factores de riesgo). Si la condición cambia, la
firma ya no coincide y la alerta vuelve a mostrarse como activa.
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.db.database import Base


class AlertAcknowledgement(Base):
    __tablename__ = "alert_acknowledgements"
    __table_args__ = (UniqueConstraint("user_id", "alert_key", name="uq_alert_ack_user_key"),)

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    alert_key  = Column(String(80), nullable=False)
    signature  = Column(String(200), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
