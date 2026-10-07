"""
NeuroLearn AI - Modelo de Usuario
Sistema B2B:
Administrador → Super Profesor → Profesor → Estudiante
"""

import enum
from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    JSON,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class UserRole(str, enum.Enum):
    ESTUDIANTE = "estudiante"
    PROFESOR = "profesor"
    SUPER_PROFESOR = "super_profesor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    # =========================================================
    # IDENTIFICACIÓN
    # =========================================================

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    username = Column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )

    email = Column(
        String(100),
        unique=True,
        index=True,
        nullable=True,
    )

    hashed_password = Column(
        String(255),
        nullable=False,
    )

    full_name = Column(
        String(100),
        nullable=True,
    )

    # =========================================================
    # ROL Y ESTADO
    # =========================================================

    role = Column(
        String(20),
        default=UserRole.ESTUDIANTE.value,
        nullable=False,
        index=True,
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    is_expert = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Avatar / foto del usuario
    photo = Column(
        Text,
        nullable=True,
    )

    # =========================================================
    # DOCUMENTO
    # =========================================================

    document_number = Column(
        String(30),
        unique=True,
        index=True,
        nullable=True,
    )

    document_type = Column(
        String(20),
        nullable=True,
    )

    # =========================================================
    # INSTITUCIÓN
    # =========================================================

    institution_id = Column(
        Integer,
        ForeignKey(
            "institutions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # =========================================================
    # SEGURIDAD / PRIMER LOGIN
    # =========================================================

    must_change_password = Column(
        Boolean,
        default=False,
        nullable=False,
    )

    # =========================================================
    # INFORMACIÓN ACADÉMICA
    # =========================================================

    # Solo aplica principalmente a profesores
    subject_area = Column(
        String(100),
        nullable=True,
    )

    # Solo aplica principalmente a estudiantes
    grade = Column(
        String(20),
        nullable=True,
    )

    birth_date = Column(
        DateTime,
        nullable=True,
    )

    # =========================================================
    # PERFIL COGNITIVO
    # =========================================================
    #
    # IMPORTANTE:
    # No usar un dict directamente como default mutable.
    # El backend puede actualizar este JSON dinámicamente.
    #

    cognitive_profile = Column(
        JSON,
        nullable=False,
        default=lambda: {
            "learning_speed": 0.5,
            "error_tolerance": 0.5,
            "preferred_difficulty": "medium",
            "fatigue_pattern": [],
            "strong_areas": [],
            "weak_areas": [],
            "total_sessions": 0,
            "avg_session_duration": 0,
        },
    )

    # =========================================================
    # FECHAS
    # =========================================================

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    last_login = Column(
        DateTime,
        nullable=True,
    )

    # =========================================================
    # RELACIONES
    # =========================================================

    institution = relationship(
        "Institution",
        back_populates="users",
        foreign_keys=[institution_id],
    )

    @property
    def institution_name(self):
        """Nombre real de la institución del usuario (None si no tiene)."""
        if self.institution_id is None:
            return None
        institution = self.institution
        return institution.name if institution is not None else None

    learning_sessions = relationship(
        "LearningSession",
        back_populates="user",
    )

    expert_bots = relationship(
        "ExpertBot",
        back_populates="creator",
    )

    cognitive_events = relationship(
        "CognitiveEvent",
        back_populates="user",
    )

    quiz_history = relationship(
        "QuizHistory",
        back_populates="user",
    )

    # Logs donde este usuario fue quien realizó la acción
    audit_logs_performed = relationship(
        "AuditLog",
        foreign_keys="AuditLog.performed_by_id",
        back_populates="performed_by",
    )

    # Logs donde este usuario fue el usuario afectado
    audit_logs_target = relationship(
        "AuditLog",
        foreign_keys="AuditLog.target_user_id",
        back_populates="target_user",
    )