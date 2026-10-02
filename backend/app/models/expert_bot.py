from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.database import Base


class ExpertBot(Base):
    __tablename__ = "expert_bots"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50))

    # Idioma del bot
    language = Column(String(10), default="es")

    # Configuración del nivel de dificultad
    difficulty_range = Column(
        JSON,
        default=lambda: {
            "min": "beginner",
            "max": "expert",
        }
    )

    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    # Prompt principal del bot
    system_prompt = Column(Text, default="")

    # Personalidad del bot
    personality = Column(
        JSON,
        default=lambda: {
            "teaching_style": "balanced",
            "verbosity": "medium",
            "use_examples": True,
            "use_analogies": True,
        }
    )

    # Base de conocimiento
    knowledge_base = Column(
        JSON,
        default=lambda: {
            "steps": [],
            "warnings": [],
            "rules": [],
            "tips": [],
            "scenarios": [],
            "faq": [],
        }
    )

    # Estadísticas
    total_users = Column(Integer, default=0)
    avg_rating = Column(Float, default=0.0)
    total_sessions = Column(Integer, default=0)
    effectiveness_score = Column(Float, default=0.0)

    # Relaciones
    creator = relationship(
        "User",
        back_populates="expert_bots"
    )

    sessions = relationship(
        "LearningSession",
        back_populates="bot"
    )

    training_data = relationship(
        "BotTrainingData",
        back_populates="bot"
    )


class BotTrainingData(Base):
    __tablename__ = "bot_training_data"

    id = Column(Integer, primary_key=True, index=True)

    bot_id = Column(
        Integer,
        ForeignKey("expert_bots.id"),
        nullable=False
    )

    data_type = Column(String(50))

    content = Column(
        JSON,
        nullable=False
    )

    order_index = Column(
        Integer,
        default=0
    )

    is_critical = Column(
        Boolean,
        default=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    bot = relationship(
        "ExpertBot",
        back_populates="training_data"
    )