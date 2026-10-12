"""
NeuroLearn IA — Evaluaciones del profesor y entregas de los estudiantes.

Flujo:
    Profesor crea la evaluación (borrador) para una de sus aulas → la publica
    → los estudiantes inscritos la responden (intentos con tiempo controlado)
    → el servidor califica → el profesor revisa resultados y califica las
    preguntas abiertas → la cierra.

Estados de la evaluación (`status`):
    borrador   solo la ve el profesor; se puede editar
    publicada  visible para los estudiantes del aula; se puede responder
    cerrada    ya no recibe entregas; los estudiantes ven la corrección

Estados de una entrega (`EvaluationSubmission.status`):
    en_curso             el estudiante abrió el intento y corre el tiempo
                         (sus respuestas se guardan mientras responde)
    pendiente_revision   enviada; tiene preguntas abiertas sin calificar
    calificada           enviada y con puntaje final

Si el tiempo se agota sin que el estudiante envíe, el intento se envía solo
con las respuestas guardadas (`auto_submitted = True`).
"""
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    UniqueConstraint,
)

from app.db.database import Base

EVALUATION_STATUSES = ("borrador", "publicada", "cerrada")
SUBMISSION_STATUSES = ("en_curso", "pendiente_revision", "calificada")


class TeacherEvaluation(Base):
    __tablename__ = "teacher_evaluations"

    id          = Column(Integer, primary_key=True, index=True)
    teacher_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id"), nullable=True, index=True)
    title       = Column(String(200), nullable=False)
    group_name  = Column(String(120), default="")      # nombre del aula (copia para mostrar)
    eval_type   = Column(String(30), default="cuestionario")   # cuestionario | examen
    date        = Column(String(20), default="")       # fecha límite AAAA-MM-DD ("" = sin límite)
    duration    = Column(Integer, default=30)          # minutos por intento
    attempts    = Column(Integer, default=1)           # intentos permitidos
    questions   = Column(JSON, default=list)
    status      = Column(String(20), nullable=False, default="borrador")
    # `active` y `submissions` existían antes de los estados; se mantienen
    # sincronizados (active = publicada, submissions = entregas enviadas).
    active      = Column(Boolean, default=False)
    submissions = Column(Integer, default=0)
    created_at  = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime, nullable=True)
    closed_at   = Column(DateTime, nullable=True)


class EvaluationSubmission(Base):
    __tablename__ = "evaluation_submissions"
    __table_args__ = (
        UniqueConstraint("evaluation_id", "student_id", "attempt_number",
                         name="uq_evaluation_submission_attempt"),
    )

    id             = Column(Integer, primary_key=True, index=True)
    evaluation_id  = Column(Integer, ForeignKey("teacher_evaluations.id", ondelete="CASCADE"),
                            nullable=False, index=True)
    student_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    classroom_id   = Column(Integer, ForeignKey("classrooms.id"), nullable=True)
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    attempt_number = Column(Integer, nullable=False, default=1)
    status         = Column(String(30), nullable=False, default="en_curso")

    answers        = Column(JSON, nullable=True)   # {question_id: respuesta}
    results        = Column(JSON, nullable=True)   # {question_id: {correct, points, max_points, feedback}}
    score          = Column(Float, nullable=True)  # puntos obtenidos
    max_score      = Column(Float, nullable=True)  # puntos posibles
    percentage     = Column(Float, nullable=True)  # 0-100

    started_at     = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at     = Column(DateTime, nullable=False)  # fin del tiempo del intento (UTC)
    submitted_at   = Column(DateTime, nullable=True)
    auto_submitted = Column(Boolean, nullable=False, default=False)  # enviado al agotarse el tiempo
    graded_at      = Column(DateTime, nullable=True)
    graded_by_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
