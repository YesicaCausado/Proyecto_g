"""
NeuroLearn Bot Service - Configuración Central
Separado del servicio de autenticación
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "NeuroLearn Bot Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # Database - SQLite local para caché de bots
    DATABASE_URL: str = "sqlite:///./bots.db"

    # Security - Igual que Auth Service para verificar tokens
    SECRET_KEY: str = "neurolearn-secret-key-cambiar-en-produccion-2026"
    ALGORITHM: str = "HS256"

    # Auth Service - Para validar tokens
    AUTH_SERVICE_URL: str = "http://localhost:8002"
    
    # OpenAI (opcional - para chatbot avanzado)
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-3.5-turbo"

    # Groq (gratuito - IA principal)
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.1-8b-instant"

    # Google Gemini (gratuito - fallback)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Configuración de Inferencia Neuroconductual
    COGNITIVE_ANALYSIS_WINDOW: int = 30  # segundos para análisis
    FATIGUE_THRESHOLD: float = 0.7
    OVERLOAD_THRESHOLD: float = 0.8
    DOUBT_THRESHOLD: float = 0.6
    MASTERY_THRESHOLD: float = 0.85

    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:5173", "http://localhost:8002", "*"]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignorar campos adicionales del .env


settings = Settings()
