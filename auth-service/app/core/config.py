"""
Configuración centralizada - Auth Service
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Configuración de la aplicación"""
    
    # App
    APP_NAME: str = "NeuroLearn Auth Service"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Database - Neon PostgreSQL
    DATABASE_URL: str = "postgresql://neondb_owner:npg_MAed8LuD7yOz@ep-restless-river-am0m57yj-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    ALLOWED_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000", "*"]
    
    # Bot Service
    BOT_SERVICE_URL: str = "http://localhost:8001"
    
    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Ignorar campos adicionales del .env


settings = Settings()
