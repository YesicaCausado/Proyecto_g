"""
NeuroLearn AI - Modelo de Bot Experto
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, JSON, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class ExpertBot(Base):
    """Bot experto creado por un usuario con conocimiento específico"""
    __tablename__ = "expert_bots"

    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Información del bot
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category = Column(String(50))  # tecnología, medicina, cocina, etc.
    difficulty_range = Column(JSON, default={"min": "beginner", "max": "expert"})
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Configuración del bot
    system_prompt = Column(Text, default="")
    personality = Column(JSON, default={
        "teaching_style": "balanced",  # strict, balanced, encouraging
        "verbosity": "medium",         # brief, medium, detailed
        "use_examples": True,
        "use_analogies": True,
    })
    
    # Conocimiento estructurado
    knowledge_base = Column(JSON, default={
        "steps": [],           # Pasos del proceso
        "warnings": [],        # Advertencias críticas
        "rules": [],           # Reglas operativas
        "tips": [],            # Recomendaciones prácticas
        "scenarios": [],       # Escenarios de simulación
        "faq": [],             # Preguntas frecuentes
    })
    
    # Métricas del bot
    total_users = Column(Integer, default=0)
    avg_rating = Column(Float, default=0.0)
    total_sessions = Column(Integer, default=0)
    effectiveness_score = Column(Float, default=0.0)
    
    # Relaciones
    creator = relationship("User", back_populates="expert_bots")
    sessions = relationship("LearningSession", back_populates="bot")
    training_data = relationship("BotTrainingData", back_populates="bot")


class BotTrainingData(Base):
    """Datos de entrenamiento para el bot experto"""
    __tablename__ = "bot_training_data"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(Integer, ForeignKey("expert_bots.id"), nullable=False)
    
    # Tipo de dato de entrenamiento
    data_type = Column(String(50))  # step, warning, rule, tip, scenario, qa_pair
    content = Column(JSON, nullable=False)
    order_index = Column(Integer, default=0)
    is_critical = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relaciones
    bot = relationship("ExpertBot", back_populates="training_data")
