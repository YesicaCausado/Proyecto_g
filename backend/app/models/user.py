"""
NeuroLearn AI - Modelo de Usuario
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, JSON, ForeignKey
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
    email = Column(String(100), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(String(20), default=UserRole.ESTUDIANTE.value, nullable=False)
    is_active = Column(Boolean, default=True)
    is_expert = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Campos B2B nuevos ─────────────────────────────────
    document_number      = Column(String(30), unique=True, index=True, nullable=True)
    document_type        = Column(String(20), nullable=True)   # CC, TI, CE, PA
    institution_id       = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    must_change_password = Column(Boolean, default=False)      # primer login
    subject_area         = Column(String(100), nullable=True)  # área del profesor
    grade                = Column(String(20),  nullable=True)  # grado del estudiante
    birth_date           = Column(String(20),  nullable=True)  # YYYY-MM-DD

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
    quiz_history = relationship("QuizHistory", back_populates="user")
    institution = relationship(
        "Institution",
        back_populates="users",
        primaryjoin="User.institution_id == Institution.id",
        foreign_keys="[User.institution_id]",
    )
