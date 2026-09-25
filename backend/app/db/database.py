"""
NeuroLearn AI - Configuración de Base de Datos
Supabase PostgreSQL — Production Ready (Serverless Compatible)
"""
import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool
from app.core.config import settings

logger = logging.getLogger(__name__)

# Detectar entorno serverless (Vercel establece VERCEL_ENV automáticamente)
IS_SERVERLESS = os.getenv("VERCEL_ENV") is not None

# Tiempos límite para que las consultas fallen rápido en vez de colgarse:
#  - connect_timeout (segundos): evita que la apertura de conexión se cuelgue
#    cuando Supabase está lento o caído (causa típica de 504/500 en serverless).
#  - options=-c statement_timeout=... : mata cualquier query individual que
#    exceda el límite devolviendo un error controlado en vez de agotar el
#    tiempo de la función de Vercel (Hobby ≈ 10s).
CONNECT_TIMEOUT = int(os.getenv("DB_CONNECT_TIMEOUT", "5"))       # segundos
STATEMENT_TIMEOUT = int(os.getenv("DB_STATEMENT_TIMEOUT", "6000"))  # milisegundos


def _build_connect_args() -> dict:
    """Argumentos de conexión por defecto (psycopg2)."""
    args = {"connect_timeout": CONNECT_TIMEOUT}
    # statement_timeout aplica a nivel servidor en cada conexión PostgreSQL.
    args["options"] = f"-c statement_timeout={STATEMENT_TIMEOUT}"
    return args


def _build_db_url(url: str) -> str:
    """Añade sslmode=require si falta (obligatorio en Supabase)."""
    if not url:
        return url
    if "sslmode" not in url:
        separator = "&" if "?" in url else "?"
        url += f"{separator}sslmode=require"
    return url


_db_url = _build_db_url(settings.DATABASE_URL)

# Sin DATABASE_URL (o vacía) se cae a SQLite local: la arquitectura documentada
# es "SQLite (desarrollo) / PostgreSQL (producción)". Así la app funciona en
# local sin Supabase (antes arrancaba sin base de datos y TODOS los endpoints
# con DB devolvían 503, incluido el login).
if not _db_url:
    # FIX: ruta ABSOLUTA anclada a backend/. Con el default relativo
    # ("neurolearn.db") la ubicación de la BD dependía del CWD desde el que se
    # lanzara uvicorn/scripts: se creaban neurolearn.db distintos (root del
    # proyecto vs backend/) y los datos "desaparecían" al cambiar el cwd.
    # TRES dirname: app/db/database.py → app/db → app → backend/
    _backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    _sqlite_file = (
        os.getenv("SQLITE_DB_PATH")
        or os.path.join(_backend_dir, "neurolearn.db")
    )
    _db_url = "sqlite:///" + _sqlite_file.replace(os.sep, "/")
    logger.info(f"🗄️ DATABASE_URL no configurada — usando SQLite local ({_sqlite_file}).")

IS_DB_DISABLED = False

if _db_url.startswith("sqlite"):
    # SQLite local: check_same_thread=False permite usar la conexión desde los
    # hilos de uvicorn (FastAPI ejecuta los endpoints en un threadpool).
    engine = create_engine(
        _db_url,
        connect_args={"check_same_thread": False},
        echo=settings.DEBUG,
    )
    logger.info("✅ Base de datos SQLite local configurada.")
elif _db_url.startswith("postgres"):
    try:
        if IS_SERVERLESS:
            # NullPool: no mantiene conexiones persistentes entre invocaciones serverless
            # Esto es CRÍTICO en Vercel — pool_size/max_overflow causan errores en lambdas
            engine = create_engine(
                _db_url,
                poolclass=NullPool,
                connect_args=_build_connect_args(),
                echo=False,
            )
        else:
            # Entorno local: pool de conexiones normal
            engine = create_engine(
                _db_url,
                pool_size=5,
                max_overflow=10,
                pool_pre_ping=True,
                pool_recycle=300,
                connect_args=_build_connect_args(),
                echo=settings.DEBUG,
            )
        logger.info("✅ Conexión a Supabase configurada correctamente.")
    except Exception as e:
        logger.error(f"❌ Error configurando base de datos: {e}")
        engine = None
        SessionLocal = None
        IS_DB_DISABLED = True
else:
    logger.warning(
        f"⚠️ DATABASE_URL no soportada (driver '{_db_url.split(':')[0]}') — arrancando sin base de datos."
    )
    engine = None
    IS_DB_DISABLED = True

if engine is not None:
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
else:
    SessionLocal = None

Base = declarative_base()


def get_db():
    """Dependencia FastAPI para obtener sesión de base de datos."""
    if SessionLocal is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Base de datos no disponible. Verifica DATABASE_URL en Vercel.")
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

