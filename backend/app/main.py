"""
NeuroLearn Bot Service - Punto de Entrada Principal

Servicio dedicado a gestión de bots y chat adaptativo

Ejecutar con (desarrollo local):
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

En Vercel (version 2): la ruta /api/(.*) llega completa al handler,
por lo que los routers usan el prefijo /api/v1 tanto en local como en Vercel.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, Base
from app.api import auth, chat, expert_bot
from app.api import classroom as classroom_api

# Importar modelos para que SQLAlchemy los registre
import app.models.user          # noqa: F401
import app.models.learning      # noqa: F401
import app.models.expert_bot    # noqa: F401
import app.models.classroom     # noqa: F401

# Crear tablas (funciona en SQLite local y PostgreSQL en Vercel)
Base.metadata.create_all(bind=engine)

# Crear aplicación
app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Servicio de bots inteligentes con IA adaptativa. "
        "Gestión de bots expertos y chat adaptativo basado en "
        "modelado neuroconductual digital."
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas — prefijo /api/v1 tanto en local como en Vercel
app.include_router(auth.router,          prefix="/api/v1")
app.include_router(chat.router,          prefix="/api/v1")
app.include_router(expert_bot.router,    prefix="/api/v1")
app.include_router(classroom_api.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "info": "Para autenticación, usa http://localhost:8002",
        "endpoints": {
            "chat": "/api/v1/chat (Chat Adaptativo)",
            "bots": "/api/v1/bots (Gestión de Bots)",
            "classrooms": "/api/v1/classrooms (Gestión de Clases)",
        },
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
