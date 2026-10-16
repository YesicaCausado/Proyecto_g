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
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, LargeBinary
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
"""
Parche al modelo DirectMessage  (app/models/messages.py)
=========================================================

Añade los tres campos nuevos de eliminación a la clase SQLAlchemy existente.
NO reemplaces el modelo completo; solo agrega las tres líneas marcadas con ⬇.

Ejemplo de cómo debería quedar la clase (solo se muestra el bloque relevante):

    class DirectMessage(Base):
        __tablename__ = "direct_messages"

        id              = Column(Integer, primary_key=True, index=True)
        sender_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        receiver_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
        content         = Column(Text, default="")
        is_read         = Column(Boolean, default=False)
        created_at      = Column(DateTime, default=datetime.utcnow)

        # Adjuntos (ya existentes)
        attachment_name = Column(String, nullable=True)
        attachment_mime = Column(String, nullable=True)
        attachment_size = Column(Integer, nullable=True)
        attachment_data = Column(LargeBinary, nullable=True, deferred=True)

        # ⬇ NUEVOS CAMPOS — agréga estas tres líneas:
        deleted_for_sender   = Column(Boolean, nullable=False, default=False)
        deleted_for_receiver = Column(Boolean, nullable=False, default=False)
        deleted_for_all      = Column(Boolean, nullable=False, default=False)
"""

# Este archivo es solo documentación del parche.
# Las líneas reales a agregar en app/models/messages.py son:

NEW_FIELDS = """
    # Eliminación por usuario / para todos
    deleted_for_sender   = Column(Boolean, nullable=False, default=False)
    deleted_for_receiver = Column(Boolean, nullable=False, default=False)
    deleted_for_all      = Column(Boolean, nullable=False, default=False)
"""

print(NEW_FIELDS)