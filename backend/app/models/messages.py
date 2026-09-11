"""
NeuroLearn AI - Modelo de Mensajes Directos

DirectMessage: mensaje directo entre dos usuarios de la plataforma.

Reglas de conversación (validadas en app/api/messages.py):
  - Estudiante  ↔ Profesor    (de sus clases)
  - Profesor    ↔ Estudiante  (de sus clases)
  - Profesor    ↔ Profesor    (misma institución)
  - Profesor    ↔ Super       (rector)
  - Super       ↔ cualquiera  (rector puede hablar con todos)
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class DirectMessage(Base):
    """Mensaje directo entre dos usuarios (validado por rol según reglas de conversación)."""
    __tablename__ = "direct_messages"

    id          = Column(Integer, primary_key=True, index=True)
    sender_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content     = Column(Text, nullable=False)
    is_read     = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    sender   = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
