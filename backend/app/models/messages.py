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
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, LargeBinary, JSON
from sqlalchemy.orm import relationship, deferred
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
    # Adjunto opcional (binario en DB, patrón idéntico a teacher_materials)
    attachment_name      = Column(String(255), nullable=True)   # nombre original del archivo
    attachment_mime      = Column(String(80), nullable=True)    # tipo MIME real
    attachment_size      = Column(Integer, nullable=True)       # tamaño en bytes
    attachment_data      = deferred(Column(LargeBinary, nullable=True))  # binario

    sender   = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])


class Message(Base):
    """Mensaje en una conversación"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("user_conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String(50), default="text")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])


class Conversation(Base):
    """Conversación entre usuarios"""
    __tablename__ = "user_conversations"

    id = Column(Integer, primary_key=True, index=True)
    participant_ids = Column(JSON, nullable=False)  # List of user IDs
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    last_message = relationship("Message", foreign_keys=[last_message_id])

    # Relationship to messages
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
