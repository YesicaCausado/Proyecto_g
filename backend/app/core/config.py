import os

from typing import Optional

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "NeuroLearn Bot Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Detectar entorno
    ENVIRONMENT: str = os.getenv("VERCEL_ENV", "development")  # production, preview, development
    IS_PRODUCTION: bool = os.getenv("VERCEL_ENV") == "production"

    # ← REEMPLAZAR (misma DB, todo unificado en Supabase)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    AUTH_SERVICE_URL: str = "http://localhost:8000"

    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "qwen/qwen3-32b")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    COGNITIVE_ANALYSIS_WINDOW: int = 30
    FATIGUE_THRESHOLD: float = 0.7
    OVERLOAD_THRESHOLD: float = 0.8
    DOUBT_THRESHOLD: float = 0.6
    MASTERY_THRESHOLD: float = 0.85

    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "*",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"

settings = Settings()