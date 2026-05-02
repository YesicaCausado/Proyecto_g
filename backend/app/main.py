"""
🧠 NeuroLearn AI - Punto de Entrada Principal

Plataforma Inteligente de Aprendizaje y Transferencia de Habilidades
basada en Modelado Neuroconductual Digital

Ejecutar con:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, Base
from app.api import auth, chat, expert_bot
from app.api import classroom as classroom_api

# Importar TODOS los modelos para que SQLAlchemy los registre
import app.models.user          # noqa: F401
import app.models.learning      # noqa: F401
import app.models.expert_bot    # noqa: F401
import app.models.classroom     # noqa: F401

# Crear tablas en la base de datos
Base.metadata.create_all(bind=engine)

# Crear aplicación FastAPI
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Plataforma inteligente que combina IA adaptativa y modelado de "
        "comportamiento digital para optimizar el aprendizaje y permitir "
        "la transferencia estructurada de conocimiento experto."
    ),
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, limitar a dominios específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Rutas de la API =====
app.include_router(auth.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(expert_bot.router, prefix="/api/v1")
app.include_router(classroom_api.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "modules": {
            "auth": "/api/v1/auth",
            "chat": "/api/v1/chat (Modo Aprender - Chatbot Adaptativo)",
            "bots": "/api/v1/bots (Bot Experto Entrenable)",
            "classrooms": "/api/v1/classrooms (Gestión de Clases - Rol Profesor)",
        },
        "description": (
            "Plataforma de aprendizaje con inferencia neuroconductual digital. "
            "Analiza el comportamiento del usuario para adaptar la enseñanza."
        ),
    }


@app.get("/health")
async def health_check():
    """Verificación de salud del sistema"""
    from app.api.chat import ai_manager
    return {
        "status": "healthy",
        "modules": {
            "cognitive_engine": "ready",
            "adaptive_chatbot": "ready",
            "expert_bot_trainer": "ready",
            "database": "connected",
        },
        "ai_providers": ai_manager.get_status(),
    }
