"""
NeuroLearn Bot Service - Punto de Entrada Principal

Servicio dedicado a gestión de bots y chat adaptativo

Ejecutar con (desarrollo local):
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
import sys
import os

# Garantiza que el directorio 'backend/' esté en sys.path.
# Necesario cuando Vercel ejecuta la lambda desde /var/task con
# el entrypoint en /var/task/backend/app/main.py.
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.database import engine, Base
from app.api import auth, chat, expert_bot, classroom, stats
from app.api import credentials  # B2B credential system
from app.api import posts, events, messages  # Tablero, Calendario, Mensajes
from app.api import super_stats               # Super Profesor stats institucionales
from app.api import teacher_stats            # Teacher dashboard stats
from app.api import teacher_materials        # Teacher materials (carpetas + archivos)
from app.api import teacher_evaluations      # Teacher evaluations (evaluaciones)
from app.api import license                  # License system
from app.api import admin_users              # Admin: gestión de usuarios

# Importar modelos para que SQLAlchemy los registre
import app.models.user          # noqa: F401
import app.models.learning      # noqa: F401
import app.models.expert_bot    # noqa: F401
import app.models.classroom     # noqa: F401
import app.models.institution   # noqa: F401
import app.models.posts         # noqa: F401
import app.models.events        # noqa: F401
import app.models.messages      # noqa: F401
import app.models.password_reset            # noqa: F401 — PasswordResetToken
import app.api.teacher_materials            # noqa: F401 — registers TeacherFolder + TeacherMaterial
import app.api.teacher_evaluations          # noqa: F401 — registers TeacherEvaluation

# Crear tablas (funciona en SQLite local y PostgreSQL en Vercel)
try:
    if engine is not None:
        Base.metadata.create_all(bind=engine)
    else:
        import logging
        logging.getLogger(__name__).warning("⚠️ engine es None — tablas no creadas. Verifica DATABASE_URL.")
except Exception as e:
    import logging
    logging.getLogger(__name__).error(f"⚠️ No se pudo crear las tablas: {e}. El backend arrancará sin DB.")

# ─── Migraciones B2B (columnas nuevas en tablas existentes) ──────────────────
try:
    from app.db.migrate import run_migrations
    run_migrations(engine)
except Exception as e:
    import logging
    logging.getLogger(__name__).error(f"⚠️ Error en migraciones B2B: {e}")

# ─── Usuario demo (DEMO_MODE del frontend) ────────────────────────────────────
def _ensure_demo_user():
    """Crea los usuarios demo (estudiante y admin) si no existen."""
    from app.db.database import SessionLocal
    from app.models.user import User, UserRole
    from passlib.context import CryptContext
    try:
        db = SessionLocal()
        try:
            pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")
            
            # 1. Usuario Demo Estudiante
            if not db.query(User).filter(User.username == "demo").first():
                user_std = User(
                    username="demo",
                    email="demo@neurolearn.app",
                    full_name="Usuario Demo",
                    hashed_password=pwd.hash("demo"),
                    role=UserRole.ESTUDIANTE,
                    is_active=True,
                )
                db.add(user_std)
                import logging
                logging.getLogger(__name__).info("✅ Usuario demo creado: demo / demo1234")
            
            # 2. Usuario Admin (para el nuevo panel administrativo)
            if not db.query(User).filter(User.username == "admin").first():
                user_adm = User(
                    username="admin",
                    email="admin@neurolearn.app",
                    full_name="Administrador Sistema",
                    hashed_password=pwd.hash("admin1234"),
                    role=UserRole.ADMIN,
                    is_active=True,
                )
                db.add(user_adm)
                import logging
                logging.getLogger(__name__).info("✅ Usuario admin creado: admin / admin1234")

            # 3. Usuario Profesor demo
            if not db.query(User).filter(User.username == "profesor").first():
                user_prof = User(
                    username="profesor",
                    email="profesor@neurolearn.app",
                    full_name="Profesor Demo",
                    hashed_password=pwd.hash("profesor"),
                    role=UserRole.PROFESOR,
                    is_active=True,
                )
                db.add(user_prof)
                import logging
                logging.getLogger(__name__).info("✅ Usuario profesor creado: profesor / profesor")

            # 4. Usuario Super Profesor demo
            if not db.query(User).filter(User.username == "superprofesor").first():
                user_sp = User(
                    username="superprofesor",
                    email="superprofesor@neurolearn.app",
                    full_name="Super Profesor Demo",
                    hashed_password=pwd.hash("superprofesor"),
                    role=UserRole.SUPER_PROFESOR,
                    is_active=True,
                )
                db.add(user_sp)
                import logging
                logging.getLogger(__name__).info("✅ Usuario superprofesor creado: superprofesor / superprofesor")
            
            db.commit()
        finally:
            db.close()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"⚠️ No se pudo crear usuarios demo (sin DB o error): {e}")

def _ensure_demo_institution():
    """
    Crea la institución demo y asigna institution_id a los usuarios
    super_profesor / profesor que no tengan ninguna institución asignada.
    Idempotente: se puede ejecutar múltiples veces sin efectos secundarios.
    """
    from app.db.database import SessionLocal
    from app.models.user import User, UserRole
    from app.models.institution import Institution
    import logging
    log = logging.getLogger(__name__)
    try:
        db = SessionLocal()
        try:
            # 1. Crear institución demo si no existe
            inst = db.query(Institution).filter(Institution.dane_code == "DEMO0001").first()
            if not inst:
                inst = Institution(
                    name="Institución Demo NeuroLearn",
                    dane_code="DEMO0001",
                    license_type="premium",
                    is_active=True,
                )
                db.add(inst)
                db.flush()
                log.info(f"✅ Institución demo creada: id={inst.id}")

            # 2. Asignar a todos los super_profesor / profesor sin institución
            for username in ("superprofesor", "profesor"):
                u = db.query(User).filter(User.username == username).first()
                if u and not u.institution_id:
                    u.institution_id = inst.id
                    log.info(f"✅ {username}.institution_id = {inst.id}")

            db.commit()
        finally:
            db.close()
    except Exception as e:
        import logging as _log
        _log.getLogger(__name__).warning(f"⚠️ No se pudo crear institución demo: {e}")

try:
    _ensure_demo_user()
except Exception:
    pass

try:
    _ensure_demo_institution()
except Exception:
    pass

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
app.include_router(expert_bot.router,    prefix="/api/v1/bots")
app.include_router(classroom.router,     prefix="/api/v1/classrooms")
app.include_router(stats.router,         prefix="/api/v1/stats")
app.include_router(credentials.router,   prefix="/api/v1")
app.include_router(posts.router,         prefix="/api/v1")
app.include_router(events.router,        prefix="/api/v1")
app.include_router(messages.router,      prefix="/api/v1")
app.include_router(super_stats.router,         prefix="/api/v1")
app.include_router(teacher_stats.router,       prefix="/api/v1")
app.include_router(teacher_materials.router,   prefix="/api/v1")
app.include_router(teacher_evaluations.router, prefix="/api/v1")
app.include_router(license.router,             prefix="/api/v1")
app.include_router(admin_users.router,         prefix="/api/v1")


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
    from app.db.database import engine, IS_DB_DISABLED
    from app.api.chat import ai_manager

    db_status = "disabled"
    if not IS_DB_DISABLED and engine is not None:
        try:
            with engine.connect() as conn:
                conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            db_status = "connected"
        except Exception as e:
            db_status = f"error: {str(e)}"

    return {
        "status": "healthy",
        "database": db_status,
        "ai_providers": ai_manager.get_status(),
    }
