import os
from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings

# Busca el .env en el directorio backend/ independientemente de desde dónde
# se ejecute uvicorn (raíz del proyecto o dentro de backend/)
_THIS_FILE = Path(__file__).resolve()               # .../backend/app/core/config.py
_BACKEND_DIR = _THIS_FILE.parent.parent.parent      # .../backend/
_ENV_FILE = _BACKEND_DIR / ".env"

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

    # Email — Resend
    RESEND_API_KEY: Optional[str] = os.getenv("RESEND_API_KEY")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "NeuroLearn IA <noreply@neurolearn.app>")

    OPENAI_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    # openai/gpt-oss-120b en Groq NO razona: genera JSON estructurado completo
    # y válido sin truncar (los modelos "qwen3" razonadores agotan los tokens
    # de salida en su bloque "thinking" y devuelven JSON incompleto → vacío).
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    COGNITIVE_ANALYSIS_WINDOW: int = 30
    FATIGUE_THRESHOLD: float = 0.7
    OVERLOAD_THRESHOLD: float = 0.8
    DOUBT_THRESHOLD: float = 0.6
    MASTERY_THRESHOLD: float = 0.85

    # ── Seguridad ────────────────────────────────────────────────────────────
    # Orígenes permitidos para CORS. NUNCA incluyas "*" cuando
    # allow_credentials=True (los navegadores lo rechazan y expone endpoints).
    ALLOWED_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    # Rate limiting (anti fuerza bruta) en endpoints de autenticación.
    RATE_LIMIT_MAX_REQUESTS: int = 20        # intentos permitidos en la ventana
    RATE_LIMIT_WINDOW_SECONDS: int = 300     # ventana de tiempo (300 s = 5 min)
    RATE_LIMIT_LOCKOUT_SECONDS: int = 900    # bloqueo extra tras alcanzar el máximo (15 min)

    # CSRF: como la API usa JWT Bearer (no cookies de sesión), no hay cookie
    # que secuestrar; este flag activa una validación extra del encabezado
    # Origin/Referer solo en peticiones de autenticación por seguridad.
    CSRF_ORIGIN_ENFORCEMENT: bool = os.getenv("CSRF_ORIGIN_ENFORCEMENT", "true").lower() == "true"

    # ── Google OAuth 2.0 (Integraciones) ──────────────────────────────────
    # Credenciales de la app OAuth (Google Cloud Console). Nunca en frontend.
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    # URL de callback registrada en Google (apunta al backend).
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI",
        "http://localhost:8000/api/v1/integrations/google/callback",
    )
    # Alcances mínimos para Drive + Calendar.
    GOOGLE_SCOPES: str = os.getenv(
        "GOOGLE_SCOPES",
        "https://www.googleapis.com/auth/drive.readonly "
        "https://www.googleapis.com/auth/calendar.events "
        "https://www.googleapis.com/auth/calendar.readonly "
        "openid",
    )
    # Origen del frontend al que se redirige tras terminar el flujo OAuth.
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = str(_ENV_FILE)
        case_sensitive = True
        extra = "ignore"

settings = Settings()