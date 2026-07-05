"""
NeuroLearn AI - Modelo de Evento de Calendario

ClassroomEvent: evento publicado por el profesor en su clase
(examen, tarea, clase especial, anuncio, evento, feriado)
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class ClassroomEvent(Base):
    """Evento del calendario de una clase"""
    __tablename__ = "classroom_events"

    id           = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True)   # NULL = institucional/global
    teacher_id   = Column(Integer, ForeignKey("users.id"), nullable=False)

    title        = Column(String(200), nullable=False)
    event_type   = Column(String(30), default="clase")    # examen|tarea|clase|anuncio|evento|feriado
    event_date   = Column(String(20), nullable=False)     # YYYY-MM-DD
    event_time   = Column(String(10), nullable=True)      # HH:MM AM/PM
    description  = Column(Text, default="")
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    teacher   = relationship("User", foreign_keys=[teacher_id])
    classroom = relationship("Classroom", foreign_keys=[classroom_id])
