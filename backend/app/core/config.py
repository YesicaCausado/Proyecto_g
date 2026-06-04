"""
NeuroLearn Bot Service - Configuración Central
Separado del servicio de autenticación
"""
import os
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "NeuroLearn Bot Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Detectar entorno
    ENVIRONMENT: str = os.getenv("VERCEL_ENV", "development")  # production, preview, development
    IS_PRODUCTION: bool = os.getenv("VERCEL_ENV") == "production"

    # Database - PostgreSQL en Vercel, SQLite en desarrollo
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./bots.db"
    )

    # Security - Igual que Auth Service para verificar tokens
    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "neurolearn-secret-key-cambiar-en-produccion-2026"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 horas

    # Auth Service - Para validar tokens
    AUTH_SERVICE_URL: str = os.getenv("AUTH_SERVICE_URL", "http://localhost:8002")
    
    # OpenAI (opcional - para chatbot avanzado)
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL: str = "gpt-3.5-turbo"

    # Groq (gratuito - IA principal)
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3-32b")

    # Google Gemini (gratuito - fallback)
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = "gemini-2.0-flash"

    # Configuración de Inferencia Neuroconductual
    COGNITIVE_ANALYSIS_WINDOW: int = 30  # segundos para análisis
    FATIGUE_THRESHOLD: float = 0.7
    OVERLOAD_THRESHOLD: float = 0.8
    DOUBT_THRESHOLD: float = 0.6
    MASTERY_THRESHOLD: float = 0.85

    # CORS — en Vercel se agrega el dominio de producción automáticamente
    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8002",
        "*",  # Vercel genera dominios dinámicos en preview
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignorar campos adicionales del .env


settings = Settings()
