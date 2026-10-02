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
    description=(
        "API backend de NeuroLearn AI"
    ),
    version=settings.APP_VERSION,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
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
# SCHEMA / MIGRACIONES
# ============================================================

def _apply_schema_and_migrations():
    """
    Inicializa el schema cuando corresponde.

    Esta función utiliza la lógica de base de datos
    definida en el proyecto.
    """

    try:
        Base.metadata.create_all(
            bind=engine
        )
    except Exception as exc:
        print(
            "[DB] Error inicializando schema:",
            exc,
        )


if IS_SERVERLESS:

    import threading

    _thread = threading.Thread(
        target=_apply_schema_and_migrations,
        name="schema-init",
        daemon=True,
    )

    _thread.start()

else:

    _apply_schema_and_migrations()


# ============================================================
# ROUTERS API V1
# ============================================================

app.include_router(
    auth.router,
    prefix="/api/v1",
)

app.include_router(
    chat.router,
    prefix="/api/v1",
)

app.include_router(
    conversations.router,
    prefix="/api/v1",
)

app.include_router(
    expert_bot.router,
    prefix="/api/v1/bots",
)

# ------------------------------------------------------------
# CLASSROOMS
#
# classroom.py:
# router = APIRouter(prefix="/classrooms")
#
# @router.post("/")
#
# Resultado:
# POST /api/v1/classrooms/
# ------------------------------------------------------------

app.include_router(
    classroom.router,
    prefix="/api/v1",
)

app.include_router(
    stats.router,
    prefix="/api/v1/stats",
)

app.include_router(
    credentials.router,
    prefix="/api/v1",
)

app.include_router(
    posts.router,
    prefix="/api/v1",
)

app.include_router(
    events.router,
    prefix="/api/v1",
)

app.include_router(
    messages.router,
    prefix="/api/v1",
)

app.include_router(
    super_stats.router,
    prefix="/api/v1",
)

# ------------------------------------------------------------
# TEACHER STATS
#
# teacher_stats.py:
# router = APIRouter(prefix="/teacher")
#
# @router.get("/stats")
#
# Resultado:
# GET /api/v1/teacher/stats
# ------------------------------------------------------------

app.include_router(
    teacher_stats.router,
    prefix="/api/v1",
)

app.include_router(
    teacher_materials.router,
    prefix="/api/v1",
)

app.include_router(
    teacher_evaluations.router,
    prefix="/api/v1",
)

app.include_router(
    teacher_ai.router,
    prefix="/api/v1",
)

app.include_router(
    teacher_reports.router,
    prefix="/api/v1",
)

app.include_router(
    license.router,
    prefix="/api/v1",
)

app.include_router(
    admin_users.router,
    prefix="/api/v1",
)

app.include_router(
    notifications.router,
    prefix="/api/v1",
)

app.include_router(
    admin_bots.router,
    prefix="/api/v1",
)

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
        "docs": "/api/docs",
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

    return {
        "status": "ok",
        "database": db_status,
        "serverless": IS_SERVERLESS,
        "version": settings.APP_VERSION,
    }


# ============================================================
# DEBUG DE RUTAS
# ============================================================
#
# Esto sirve para confirmar que Vercel realmente cargó
# classroom.py y teacher_stats.py.
#
# Puedes eliminarlo después de verificar el deploy.
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
    ):

        print(
            f"{sorted(methods)} {path}"
        )

print(
    "========================================"
)