"""
NeuroLearn AI - Modelo de Aula Usuario
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class ClassroomUser(Base):
    """Relación muchos-a-muchos entre usuarios y aulas"""
    __tablename__ = "classroom_users"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    classroom = relationship("Classroom", foreign_keys=[classroom_id])
    user = relationship("User", foreign_keys=[user_id])