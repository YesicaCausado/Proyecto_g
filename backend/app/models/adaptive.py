"""
NeuroLearn AI — Modelos del Sistema Neurodigital Adaptativo (núcleo diferencial)

Persisten el modelo del estudiante entre conversaciones y sesiones:

- student_mastery  : dominio (mastery) por estudiante+sujeto+habilidad+tema.
- learning_state   : continuidad pedagógica — en qué punto quedó el estudiante.
- student_memory   : memoria episódica/semántica de eventos de aprendizaje importantes.
- conversations    : conversaciones (chat tipo ChatGPT) con título/materia/habilidad.

Estos modelos complementan `cognitive_session_state` (métricas agregadas reales)
y `cognitive_events` (eventos crudos), que ya existen y NO se duplican.

⚠️ Nunca se inventan datos: mastery/weak/strong se derivan exclusivamente de la
interacción real persistida (quiz_history, cognitive_events, chat_messages, etc.).
"""
from sqlalchemy import (
    Column, Integer, String, Float, DateTime, JSON, Boolean, ForeignKey, Text,
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


class StudentMastery(Base):
    """Dominio del estudiante por habilidad/tema (derivado de interacción real)."""
    __tablename__ = "student_mastery"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(60), nullable=False, index=True)      # Matemáticas
    skill = Column(String(120), nullable=False, index=True)        # Ecuaciones de 1er grado
    topic = Column(String(200), default="")                        # Ecuaciones lineales
    mastery = Column(Float, default=0.0)                           # 0-1
    attempts = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    consecutive_wrong = Column(Integer, default=0)
    # Conceptos específicos marcados como débiles (derivados de errores reales)
    weak_concepts = Column(JSON, default=list)
    strength_concepts = Column(JSON, default=list)
    last_activity_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class LearningState(Base):
    """Continuidad pedagógica: el punto exacto donde quedó el estudiante."""
    __tablename__ = "learning_state"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subject = Column(String(60), nullable=False)
    skill = Column(String(120), nullable=False, index=True)
    topic = Column(String(200), default="")
    current_step = Column(String(200), default="")
    difficulty = Column(String(20), default="medium")
    mastery = Column(Float, default=0.0)
    last_activity = Column(String(300), default="")
    last_result = Column(String(20), default="")                 # correct | incorrect
    detected_difficulty = Column(String(300), default="")        # p.ej. "Cambio de signo"
    next_recommended_action = Column(String(300), default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # un registro por (student, skill) para mantener un único punto de continuidad
        # por habilidad.
    )


class StudentMemory(Base):
    """Memoria episódica/semántica del aprendizaje del estudiante.

    memory_type:
      - 'episodio'   : evento puntual importante (error crítico, logro, dificultad).
      - 'semantica'  : conocimiento consolidado sobre el progreso (autocontenido).
      - 'contexto'   : detalle leve de contexto/estrategia.
    importance/confidence escalan y condicionan su uso en la adaptación.
    """
    __tablename__ = "student_memory"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    memory_type = Column(String(20), default="episodio")
    subject = Column(String(60), default="")
    skill = Column(String(120), default="")
    content = Column(Text, nullable=False)                        # auto-contenido para el LLM
    source = Column(String(60), default="")                       # p.ej. quiz_history | chat
    importance = Column(Float, default=0.5)                       # 0-1
    confidence = Column(Float, default=0.5)                       # 0-1
    event_ts = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        # Índice para recuperar memoria relevante por estudiante.
    )


class Conversation(Base):
    """Conversación del tutor IA (soporta historial tipo ChatGPT).

    Un estudiante (o un bot) tiene muchas conversaciones independientes, cada una
    con su propia continuidad. El StudentModel es transversal a todas ellas.
    """
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    bot_id = Column(Integer, ForeignKey("expert_bots.id"), nullable=True)
    title = Column(String(200), default="Nueva conversación")
    subject = Column(String(60), default="")
    skill = Column(String(120), default="")
    topic = Column(String(200), default="")
    current_learning_goal = Column(String(300), default="")
    current_progress = Column(String(300), default="")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_interaction = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )


class ConversationMessage(Base):
    """Mensaje dentro de una conversación del tutor IA."""
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(20), nullable=False)                     # user | assistant | system
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    # Metadata del estado en ese momento (real, no rellenado con valores inventados)
    meta = Column("metadata", JSON, default=dict)

    conversation = relationship(
        "Conversation",
        back_populates="messages",
    )