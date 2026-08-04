"""
NeuroLearn AI - Modelo de Mensajes Directos

DirectMessage: mensaje entre un estudiante y su profesor
Solo se permiten conversaciones estudiante↔profesor (no entre pares).
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class DirectMessage(Base):
    """Mensaje directo entre un estudiante y un profesor"""
    __tablename__ = "direct_messages"

    id          = Column(Integer, primary_key=True, index=True)
    sender_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content     = Column(Text, nullable=False)
    is_read     = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    sender   = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])
