from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import (
    SecurityHeadersMiddleware,
    HSTSHeaderMiddleware,
)
from app.db.database import (
    engine,
    Base,
    IS_SERVERLESS,
)

# ============================================================
# ROUTERS
# ============================================================

from app.api import auth
from app.api import chat
from app.api import expert_bot
from app.api import classroom
from app.api import stats
from app.api import conversations
from app.api import credentials
from app.api import posts
from app.api import events
from app.api import messages
from app.api import super_stats
from app.api import teacher_stats
from app.api import teacher_materials
from app.api import teacher_evaluations
from app.api import teacher_reports
from app.api import teacher_ai
from app.api import license
from app.api import admin_users
from app.api import notifications
from app.api import admin_bots
from app.api import integrations


# ============================================================
# APLICACIÓN FASTAPI
# ============================================================

app = FastAPI(
    title=settings.APP_NAME,
    description="API backend de NeuroLearn AI",
    version=settings.APP_VERSION,

    # Documentación
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://neurolearnym.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# MIDDLEWARES DE SEGURIDAD
# ============================================================

app.add_middleware(
    SecurityHeadersMiddleware
)

app.add_middleware(
    HSTSHeaderMiddleware
)


# ============================================================
# SCHEMA / BASE DE DATOS
# ============================================================

def _apply_schema_and_migrations():
    """
    Inicializa las tablas necesarias.

    En producción, las migraciones reales deberían ejecutarse
    mediante el sistema de migraciones del proyecto.

    create_all() solamente crea tablas que no existen;
    no modifica columnas existentes.
    """

    try:
        print("[DB] Iniciando inicialización del schema...")

        Base.metadata.create_all(
            bind=engine
        )

        print("[DB] Schema inicializado correctamente.")

    except Exception as exc:

        print(
            "[DB] ERROR inicializando schema:",
            repr(exc),
        )


# ============================================================
# INICIALIZACIÓN
# ============================================================

if IS_SERVERLESS:

    print("[DB] Entorno serverless detectado.")

    # No bloqueamos el import de FastAPI.
    # Vercel puede continuar cargando la aplicación.
    import threading

    _thread = threading.Thread(
        target=_apply_schema_and_migrations,
        name="schema-init",
        daemon=True,
    )

    _thread.start()

else:

    print("[DB] Entorno local detectado.")

    _apply_schema_and_migrations()


# ============================================================
# ROUTERS API V1
# ============================================================

# ------------------------------------------------------------
# AUTH
# ------------------------------------------------------------

app.include_router(
    auth.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# CHAT
#
# Resultado esperado:
#
# POST /api/v1/chat/message
# ------------------------------------------------------------

app.include_router(
    chat.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# CONVERSATIONS
# ------------------------------------------------------------

app.include_router(
    conversations.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# EXPERT BOTS
#
# expert_bot.py:
# router = APIRouter(...)
#
# Resultado:
# /api/v1/bots/...
# ------------------------------------------------------------

app.include_router(
    expert_bot.router,
    prefix="/api/v1/bots",
)


# ------------------------------------------------------------
# CLASSROOMS
#
# classroom.py:
#
# router = APIRouter(
#     prefix="/classrooms"
# )
#
# POST /
#
# Resultado:
#
# POST /api/v1/classrooms/
# ------------------------------------------------------------

app.include_router(
    classroom.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# STATS
# ------------------------------------------------------------

app.include_router(
    stats.router,
    prefix="/api/v1/stats",
)


# ------------------------------------------------------------
# CREDENTIALS
# ------------------------------------------------------------

app.include_router(
    credentials.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# POSTS
# ------------------------------------------------------------

app.include_router(
    posts.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# EVENTS
# ------------------------------------------------------------

app.include_router(
    events.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# MESSAGES
# ------------------------------------------------------------

app.include_router(
    messages.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# SUPER STATS
# ------------------------------------------------------------

app.include_router(
    super_stats.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# TEACHER STATS
#
# teacher_stats.py:
#
# router = APIRouter(prefix="/teacher")
#
# Resultado:
#
# GET /api/v1/teacher/stats
# ------------------------------------------------------------

app.include_router(
    teacher_stats.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# TEACHER MATERIALS
# ------------------------------------------------------------

app.include_router(
    teacher_materials.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# TEACHER EVALUATIONS
# ------------------------------------------------------------

app.include_router(
    teacher_evaluations.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# TEACHER AI
# ------------------------------------------------------------

app.include_router(
    teacher_ai.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# TEACHER REPORTS
# ------------------------------------------------------------

app.include_router(
    teacher_reports.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# LICENSE
# ------------------------------------------------------------

app.include_router(
    license.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# ADMIN USERS
# ------------------------------------------------------------

app.include_router(
    admin_users.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# NOTIFICATIONS
# ------------------------------------------------------------

app.include_router(
    notifications.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# ADMIN BOTS
# ------------------------------------------------------------

app.include_router(
    admin_bots.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# INTEGRATIONS
# ------------------------------------------------------------

app.include_router(
    integrations.router,
    prefix="/api/v1",
)


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "api": "/api/v1",
        "docs": "/docs",
        "openapi": "/openapi.json",
    }


# ============================================================
# TEST SIMPLE DEL BACKEND
# ============================================================

@app.get("/api/v1/test")
def test_backend():

    return {
        "status": "ok",
        "message": "NeuroLearn backend funcionando correctamente",
        "version": settings.APP_VERSION,
        "serverless": IS_SERVERLESS,
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():

    db_status = "unknown"

    try:

        from sqlalchemy import text

        with engine.connect() as connection:

            connection.execute(
                text("SELECT 1")
            )

        db_status = "connected"

    except Exception as exc:

        db_status = (
            f"error: {str(exc)[:200]}"
        )

        print(
            "[HEALTH] Error conectando a BD:",
            repr(exc),
        )

    return {
        "status": "ok",
        "database": db_status,
        "serverless": IS_SERVERLESS,
        "version": settings.APP_VERSION,
    }


# ============================================================
# HEALTH CHECK API V1
# ============================================================

@app.get("/api/v1/health")
def api_health_check():

    db_status = "unknown"

    try:

        from sqlalchemy import text

        with engine.connect() as connection:

            connection.execute(
                text("SELECT 1")
            )

        db_status = "connected"

    except Exception as exc:

        db_status = (
            f"error: {str(exc)[:200]}"
        )

        print(
            "[API HEALTH] Error conectando a BD:",
            repr(exc),
        )

    return {
        "status": "ok",
        "database": db_status,
        "serverless": IS_SERVERLESS,
        "version": settings.APP_VERSION,
    }


# ============================================================
# DEBUG DE RUTAS
# ============================================================

print(
    "========================================"
)

print(
    "NEUROLEARN - RUTAS REGISTRADAS"
)

print(
    "========================================"
)

for route in app.routes:

    path = getattr(
        route,
        "path",
        "",
    )

    methods = getattr(
        route,
        "methods",
        set(),
    )

    if (
        "/teacher" in path
        or "/classrooms" in path
        or "/chat" in path
        or "/test" in path
        or "/health" in path
    ):

        print(
            f"{sorted(methods)} {path}"
        )

print(
    "========================================"
)

print(
    f"[APP] NeuroLearn AI {settings.APP_VERSION}"
)

print(
    f"[APP] Serverless: {IS_SERVERLESS}"
)

print(
    "[APP] FastAPI inicializado correctamente."
)