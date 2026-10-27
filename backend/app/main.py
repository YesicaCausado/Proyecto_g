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
from app.api import bot_documents
from app.api import neurobot_assignments
from app.api import classroom
from app.api import stats
from app.api import conversations
from app.api import credentials
from app.api import posts
from app.api import events
from app.api import messages
from app.api import super_stats
from app.api import super_reports
from app.api import teacher_stats
from app.api import teacher_materials
from app.api import student_materials
from app.api import teacher_evaluations
from app.api import student_evaluations
from app.api import student_diagnostic
from app.api import consents
from app.api import student_privacy
from app.api import teacher_reports
from app.api import teacher_ai
from app.api import admin_users
from app.api import notifications
from app.api import admin_bots
from app.api import integrations
from app.api import voice


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

# Errores 422 en español y por campo, sin devolver el valor recibido.
from app.core import validation_errors  # noqa: E402
validation_errors.install(app)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    # Misma lista que el chequeo de origen del login (config.ALLOWED_ORIGINS).
    allow_origins=settings.ALLOWED_ORIGINS,
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
    """Crea lo que falte del esquema.

    PostgreSQL: lee el catálogo (3 consultas de solo lectura) y solo ejecuta
    DDL para tablas, columnas o índices que de verdad falten, con lock_timeout
    corto (ver app/db/migrate.py). Antes se ejecutaban create_all, ALTER TABLE
    y un UPDATE en cada arranque en frío, lo que bloqueaba tablas en uso.
    SQLite (desarrollo): create_all + columnas nuevas de tablas existentes.
    """
    try:
        if engine.dialect.name == "sqlite":
            Base.metadata.create_all(bind=engine)
            from app.db.migrate import _add_missing_sqlite_columns
            _add_missing_sqlite_columns(engine)
        else:
            from app.db.migrate import prepare_postgres_schema
            prepare_postgres_schema(engine)
        print("[DB] Esquema verificado.")
    except Exception as exc:  # noqa: BLE001
        print("[DB] ERROR verificando el esquema:", repr(exc))


# ============================================================
# CLAVE DE FIRMA DE LOS TOKENS
# ============================================================

# PyJWT rechaza una clave vacía (el inicio de sesión respondería 500) y
# recomienda al menos 32 bytes para HS256. Se informa en el log del servidor
# al arrancar, sin mostrar nunca la clave.
_secret_len = len(settings.SECRET_KEY.encode("utf-8"))
if _secret_len == 0:
    print(
        "[SEGURIDAD] ERROR: SECRET_KEY no está configurada. "
        "El inicio de sesión fallará hasta definirla en las variables de entorno."
    )
elif _secret_len < 32:
    print(
        f"[SEGURIDAD] AVISO: SECRET_KEY tiene {_secret_len} bytes; "
        "se recomiendan al menos 32 para HS256."
    )


# ============================================================
# INICIALIZACIÓN
# ============================================================

# Síncrono también en Vercel: es barato cuando no falta nada, y un hilo de
# fondo quedaba congelado a mitad de una transacción con la tabla bloqueada.
if engine is not None:
    print("[DB] Entorno serverless detectado." if IS_SERVERLESS else "[DB] Entorno local detectado.")
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

app.include_router(
    student_privacy.router,
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

# Asignación, «Mis NeuroBots» y resultados: ANTES de expert_bot para que
# /bots/assigned-to-me no lo capture /bots/{bot_id}.
app.include_router(
    neurobot_assignments.router,
    prefix="/api/v1/bots",
)

app.include_router(
    expert_bot.router,
    prefix="/api/v1/bots",
)

# Documentos de la base de conocimiento de cada NeuroBot:
# /api/v1/bots/{bot_id}/documents...
app.include_router(
    bot_documents.router,
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

app.include_router(
    super_reports.router,
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

app.include_router(
    student_materials.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# TEACHER EVALUATIONS
# ------------------------------------------------------------

app.include_router(
    teacher_evaluations.router,
    prefix="/api/v1",
)

# Evaluaciones del estudiante: /api/v1/student/evaluations...
app.include_router(
    student_evaluations.router,
    prefix="/api/v1",
)

# Consentimientos de cámara y micrófono: /api/v1/consents...
app.include_router(
    consents.router,
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


# ------------------------------------------------------------
# VOZ DEL TUTOR (Azure Speech por el servidor)
# ------------------------------------------------------------

app.include_router(
    voice.router,
    prefix="/api/v1",
)


# ------------------------------------------------------------
# DIAGNÓSTICO INICIAL (estudiante y vista del profesor)
# ------------------------------------------------------------

app.include_router(
    student_diagnostic.router,
    prefix="/api/v1",
)

app.include_router(
    student_diagnostic.teacher_router,
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