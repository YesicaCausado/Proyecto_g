"""
NeuroLearn AI - Modelos de Clase e Inscripción (Rol Profesor)

Permite a los profesores:
- Crear clases con código de invitación único
- Inscribir estudiantes
- Asignar bots a la clase
- Monitorear progreso
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import uuid


class Classroom(Base):
    """Clase creada por un profesor"""
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Información de la clase
    name = Column(String(150), nullable=False)
    description = Column(Text, default="")
    subject = Column(String(100), nullable=False)  # Habilidad transversal
    grade = Column(String(20), default="")  # Grado: 6to, 7mo, etc.
    invite_code = Column(String(8), unique=True, index=True, nullable=False)
    color = Column(String(20), default="#2E6FDB")

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Configuración
    max_students = Column(Integer, default=40)
    settings = Column(JSON, default={
        "allow_self_enrollment": True,
        "show_leaderboard": False,
        "auto_assign_bots": True,
    })

    # Relaciones
    teacher = relationship("User", backref="classrooms_taught")
    enrollments = relationship("Enrollment", back_populates="classroom", cascade="all, delete-orphan")
    assigned_bots = relationship("ClassroomBot", back_populates="classroom", cascade="all, delete-orphan")

    @staticmethod
    def generate_invite_code() -> str:
        """Genera un código de invitación único de 8 caracteres"""
        return uuid.uuid4().hex[:8].upper()


class Enrollment(Base):
    """Inscripción de un estudiante en una clase"""
    __tablename__ = "enrollments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)

    enrolled_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Progreso general del estudiante en la clase
    overall_progress = Column(Float, default=0.0)  # 0.0 - 100.0
    last_activity = Column(DateTime, nullable=True)
    total_sessions = Column(Integer, default=0)
    total_time_minutes = Column(Float, default=0.0)
    average_score = Column(Float, default=0.0)

    # Estado de alerta
    risk_level = Column(String(20), default="none")  # none, low, medium, high
    risk_factors = Column(JSON, default=[])

    # Relaciones
    student = relationship("User", backref="enrollments")
    classroom = relationship("Classroom", back_populates="enrollments")


class ClassroomBot(Base):
    """Bot asignado a una clase por el profesor"""
    __tablename__ = "classroom_bots"

    id = Column(Integer, primary_key=True, index=True)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    bot_id = Column(Integer, ForeignKey("expert_bots.id"), nullable=False)

    assigned_at = Column(DateTime, default=datetime.utcnow)
    is_required = Column(Boolean, default=False)  # Obligatorio o complementario
    order_index = Column(Integer, default=0)  # Orden en el que se muestran

    # Relaciones
    classroom = relationship("Classroom", back_populates="assigned_bots")
    bot = relationship("ExpertBot", backref="classroom_assignments")
