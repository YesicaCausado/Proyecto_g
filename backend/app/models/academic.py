"""
NeuroLearn IA — Períodos académicos y gestión del seguimiento académico.

AcademicPeriod
    Períodos que define cada institución (p. ej. «Primer período 2026»). Los
    usan los reportes del Súper Profesor como rango de análisis y para
    comparar con el período anterior. No se pueden solapar dentro de una
    institución.

FollowupCase / FollowupNote
    Los casos de seguimiento los DETECTA el sistema con reglas académicas
    (app/services/super_report_service.py); aquí solo se guarda su gestión:
    estado, responsable y bitácora de notas. Un caso se identifica por
    `case_key` = «regla-estudiante-competencia».

    Estados:
        abierto         detectado, sin gestionar (estado por defecto)
        en_seguimiento  alguien de la institución lo está atendiendo
        cerrado         atendido; si la regla vuelve a cumplirse con evidencia
                        posterior al cierre, el caso se muestra reabierto
"""
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint

from app.db.database import Base

FOLLOWUP_STATUSES = ("abierto", "en_seguimiento", "cerrado")


class AcademicPeriod(Base):
    __tablename__ = "academic_periods"

    id             = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    name           = Column(String(120), nullable=False)
    start_date     = Column(Date, nullable=False)
    end_date       = Column(Date, nullable=False)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)


class FollowupCase(Base):
    __tablename__ = "followup_cases"
    __table_args__ = (UniqueConstraint("institution_id", "case_key", name="uq_followup_case"),)

    id             = Column(Integer, primary_key=True, index=True)
    institution_id = Column(Integer, ForeignKey("institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    case_key       = Column(String(120), nullable=False)
    student_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    rule           = Column(String(40), nullable=False)
    competency     = Column(String(30), nullable=True)
    status         = Column(String(20), nullable=False, default="abierto")
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    closed_at      = Column(DateTime, nullable=True)


class FollowupNote(Base):
    __tablename__ = "followup_notes"

    id          = Column(Integer, primary_key=True, index=True)
    case_id     = Column(Integer, ForeignKey("followup_cases.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    text        = Column(Text, nullable=False, default="")
    from_status = Column(String(20), nullable=True)
    to_status   = Column(String(20), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow, nullable=False)
