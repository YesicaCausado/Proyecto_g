"""
NeuroLearn IA — Asignación individual de NeuroBots y progreso del estudiante.

Un NeuroBot llega a un estudiante de dos formas:

* por aula: `classroom_bots` (app/models/classroom.py), para todos los
  estudiantes inscritos en el aula;
* individualmente: `student_bot_assignments`, para estudiantes concretos de
  las aulas del profesor.

En ambos casos el avance del estudiante con ese bot se guarda en una sola fila
de `neurobot_progress` (estudiante + bot), creada cuando empieza a usarlo. El
estado se deriva de datos reales (app/services/neurobot_service.py):

    asignado     → no hay fila de progreso todavía
    iniciado     → abrió el chat con el bot (started_at)
    en_progreso  → al menos una interacción respondida por el bot
    completado   → alcanzó la meta de interacciones fijada por el profesor
"""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db.database import Base


class StudentBotAssignment(Base):
    __tablename__ = "student_bot_assignments"
    __table_args__ = (UniqueConstraint("bot_id", "student_id", name="uq_student_bot_assignment"),)

    id                = Column(Integer, primary_key=True, index=True)
    bot_id            = Column(Integer, ForeignKey("expert_bots.id"), nullable=False, index=True)
    student_id        = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    teacher_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    goal_interactions = Column(Integer, nullable=False)
    assigned_at       = Column(DateTime, nullable=False, default=datetime.utcnow)

    bot = relationship("ExpertBot")
    student = relationship("User", foreign_keys=[student_id])
    teacher = relationship("User", foreign_keys=[teacher_id])


class NeuroBotProgress(Base):
    __tablename__ = "neurobot_progress"
    __table_args__ = (UniqueConstraint("bot_id", "student_id", name="uq_neurobot_progress"),)

    id               = Column(Integer, primary_key=True, index=True)
    bot_id           = Column(Integer, ForeignKey("expert_bots.id"), nullable=False, index=True)
    student_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    # Mensajes del estudiante respondidos por el NeuroBot (IA real, no el
    # mensaje local de error).
    interactions     = Column(Integer, nullable=False, default=0)
    started_at       = Column(DateTime, nullable=True)
    last_activity_at = Column(DateTime, nullable=True)
    completed_at     = Column(DateTime, nullable=True)
    # Meta vigente cuando se completó (para que el resultado no cambie si el
    # profesor modifica la meta después).
    completed_goal   = Column(Integer, nullable=True)
    created_at       = Column(DateTime, nullable=False, default=datetime.utcnow)
