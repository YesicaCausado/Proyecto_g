"""
NeuroLearn IA — Diagnóstico inicial del estudiante (RF-13).

Un registro por estudiante y competencia: el diagnóstico es inicial, se
presenta una sola vez y su resultado fija el nivel de partida del estudiante
en esa competencia. Las preguntas están en app/services/diagnostic_bank.py.
"""
from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint

from app.db.database import Base


class DiagnosticResult(Base):
    __tablename__ = "diagnostic_results"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    competency      = Column(String(30), nullable=False)        # clave de app/services/competencies.py
    correct_count   = Column(Integer, nullable=False, default=0)
    total_questions = Column(Integer, nullable=False, default=0)
    score           = Column(Float, nullable=False, default=0.0)  # 0-100, ponderado por dificultad
    level           = Column(Integer, nullable=False)             # 1-4 (niveles de desempeño Saber 11)
    answers         = Column(JSON, default=dict)                  # {question_id: índice elegido}
    topic_results   = Column(JSON, default=list)                  # [{topic, correct, total}]
    duration_seconds = Column(Integer, nullable=True)
    tutor_feedback  = Column(Text, nullable=True)                 # evaluación escrita por el tutor de IA
    feedback_provider = Column(String(20), nullable=True)         # groq | gemini | local
    completed_at    = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "competency", name="uq_diagnostic_user_competency"),
    )
