"""
🔐 NeuroLearn Auth Service - Punto de Entrada Principal

Servicio de Autenticación y Gestión de Usuarios y Permisos

Ejecutar con:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8002
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, Base
from app.api import auth

# Importar modelos
import app.models.user  # noqa: F401

# Crear tablas
Base.metadata.create_all(bind=engine)

# Crear aplicación
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas
app.include_router(auth.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Endpoint raíz"""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "docs": "/docs",
        "endpoints": {
            "register": "/api/v1/auth/register",
            "login": "/api/v1/auth/login",
            "refresh": "/api/v1/auth/refresh",
            "me": "/api/v1/auth/me",
            "logout": "/api/v1/auth/logout",
        }
    }


@app.get("/health")
async def health_check():
    """Verificación de salud"""
    return {"status": "healthy", "service": "auth"}
