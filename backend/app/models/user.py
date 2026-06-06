"""
NeuroLearn AI - Modelo de Usuario
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum


class UserRole(str, enum.Enum):
    ESTUDIANTE     = "estudiante"
    PROFESOR       = "profesor"
    SUPER_PROFESOR = "super_profesor"
    ADMIN          = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(String(20), default=UserRole.ESTUDIANTE.value, nullable=False)
    is_active = Column(Boolean, default=True)
    is_expert = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Perfil cognitivo dinámico
    cognitive_profile = Column(JSON, default={
        "learning_speed": 0.5,
        "error_tolerance": 0.5,
        "preferred_difficulty": "medium",
        "fatigue_pattern": [],
        "strong_areas": [],
        "weak_areas": [],
        "total_sessions": 0,
        "avg_session_duration": 0,
    })

    # Relaciones
    learning_sessions = relationship("LearningSession", back_populates="user")
    expert_bots = relationship("ExpertBot", back_populates="creator")
    cognitive_events = relationship("CognitiveEvent", back_populates="user")
