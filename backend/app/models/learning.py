"""
NeuroLearn AI - Modelos de Sesión de Aprendizaje y Eventos Cognitivos
"""
from sqlalchemy import Column, Integer, String, DateTime, Float, JSON, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base
import enum


class CognitiveState(str, enum.Enum):
    NORMAL = "normal"
    FATIGUE = "fatigue"
    OVERLOAD = "overload"
    DOUBT = "doubt"
    MASTERY = "mastery"
    FLOW = "flow"


class DifficultyLevel(str, enum.Enum):
    BEGINNER = "beginner"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bot_id = Column(Integer, ForeignKey("expert_bots.id"), nullable=True)
    topic = Column(String(200))
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    current_difficulty = Column(String(20), default=DifficultyLevel.MEDIUM.value)
    
    # Métricas de la sesión
    total_interactions = Column(Integer, default=0)
    correct_responses = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    avg_response_time_ms = Column(Float, default=0.0)
    
    # Estado cognitivo inferido
    last_cognitive_state = Column(String(20), default=CognitiveState.NORMAL.value)
    cognitive_state_history = Column(JSON, default=[])
    
    # Resumen de la sesión
    session_summary = Column(JSON, default={})
    
    # Relaciones
    user = relationship("User", back_populates="learning_sessions")
    bot = relationship("ExpertBot", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session")
    cognitive_events = relationship("CognitiveEvent", back_populates="session")


class CognitiveEvent(Base):
    """Eventos capturados para inferencia neuroconductual"""
    __tablename__ = "cognitive_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("learning_sessions.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Datos del evento
    event_type = Column(String(50))  # keystroke, click, response, correction, pause
    event_data = Column(JSON, default={})
    
    # Métricas calculadas
    response_time_ms = Column(Float, nullable=True)
    typing_speed_cpm = Column(Float, nullable=True)  # caracteres por minuto
    error_rate = Column(Float, nullable=True)
    correction_count = Column(Integer, default=0)
    pause_duration_ms = Column(Float, nullable=True)
    
    # Estado inferido
    inferred_state = Column(String(20), default=CognitiveState.NORMAL.value)
    confidence_score = Column(Float, default=0.0)
    
    # Relaciones
    user = relationship("User", back_populates="cognitive_events")
    session = relationship("LearningSession", back_populates="cognitive_events")


class ChatMessage(Base):
    """Mensajes del chat entre usuario y bot"""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("learning_sessions.id"), nullable=False)
    role = Column(String(20))  # user, assistant, system
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    # Metadata del mensaje
    response_time_ms = Column(Float, nullable=True)
    cognitive_state_at_time = Column(String(20), nullable=True)
    difficulty_at_time = Column(String(20), nullable=True)
    extra_data = Column("metadata", JSON, default={})
    
    # Relaciones
    session = relationship("LearningSession", back_populates="messages")


class QuizHistory(Base):
    """Historial acumulativo de quizzes realizados por el usuario"""
    __tablename__ = "quiz_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(Integer, ForeignKey("learning_sessions.id"), nullable=True)
    
    # Información del quiz
    quiz_title = Column(String(200), nullable=False)
    topic = Column(String(200), nullable=False)
    difficulty = Column(String(20), nullable=False)  # Fácil/Medio/Difícil
    questions_count = Column(Integer, nullable=False)
    
    # Resultados del usuario
    user_score = Column(String(10), nullable=True)  # Formato "X/Y"
    correct_answers = Column(Integer, default=0)
    wrong_answers = Column(Integer, default=0)
    
    # Contenido completo del quiz (formato Gemini)
    quiz_data = Column(JSON, nullable=False)  # Guarda el quiz completo
    user_answers = Column(JSON, nullable=True)  # {question_id: user_answer}
    
    # Metadatos
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    time_spent_seconds = Column(Integer, nullable=True)
    
    # Relaciones
    user = relationship("User", back_populates="quiz_history")
