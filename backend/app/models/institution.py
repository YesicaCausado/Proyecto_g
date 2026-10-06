"""
NeuroLearn AI - Modelos de Institución (MODIFICADO)
====================================================

Actualizado para eliminar el sistema de licencias.
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


# =========================================================
# INSTITUCIÓN
# =========================================================

class Institution(Base):
    __tablename__ = "institutions"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    name = Column(
        String(200),
        nullable=False,
    )

    # Código DANE de la institución
    dane_code = Column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
    )

    # =====================================================
    # INFORMACIÓN DE CONTACTO
    # =====================================================

    email = Column(
        String(200),
        nullable=True,
    )

    phone = Column(
        String(50),
        nullable=True,
    )

    address = Column(
        String(255),
        nullable=True,
    )

    website = Column(
        String(255),
        nullable=True,
    )

    # =====================================================
    # CONFIGURACIÓN
    # =====================================================

    timezone = Column(
        String(80),
        default="America/Bogota",
        nullable=False,
    )

    language = Column(
        String(20),
        default="es",
        nullable=False,
    )

    primary_color = Column(
        String(20),
        default="#6940A5",
        nullable=True,
    )

    logo_url = Column(
        Text,
        nullable=True,
    )

    # =====================================================
    # AUDITORÍA
    # =====================================================

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    # Usuario administrador que creó la institución
    created_by = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # =====================================================
    # RELACIONES
    # =====================================================

    users = relationship(
        "User",
        back_populates="institution",
        foreign_keys="User.institution_id",
    )

    creator = relationship(
        "User",
        foreign_keys=[created_by],
    )


# =========================================================
# AUDITORÍA
# =========================================================

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    # Ejemplo:
    # create_teacher
    # create_student
    # delete_teacher
    # change_license
    # login
    # logout
    action = Column(
        String(100),
        nullable=False,
        index=True,
    )

    # Usuario que realizó la acción
    performed_by_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # Usuario afectado por la acción
    target_user_id = Column(
        Integer,
        ForeignKey(
            "users.id",
            ondelete="SET NULL",
        ),
        nullable=True,
    )

    # Institución relacionada
    institution_id = Column(
        Integer,
        ForeignKey(
            "institutions.id",
            ondelete="SET NULL",
        ),
        nullable=True,
        index=True,
    )

    # Tipo del usuario afectado
    #
    # profesor
    # estudiante
    # super_profesor
    # admin
    user_type = Column(
        String(30),
        nullable=True,
    )

    ip_address = Column(
        String(45),
        nullable=True,
    )

    notes = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
        index=True,
    )

    # =====================================================
    # RELACIONES
    # =====================================================

    performed_by = relationship(
        "User",
        foreign_keys=[performed_by_id],
        back_populates="audit_logs_performed",
    )

    target_user = relationship(
        "User",
        foreign_keys=[target_user_id],
        back_populates="audit_logs_target",
    )

    institution = relationship(
        "Institution",
        foreign_keys=[institution_id],
    )