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


def _build_db_url(url: str) -> str:
    """Añade sslmode=require si falta (obligatorio en Supabase)."""
    if not url:
        return url
    if "sslmode" not in url:
        separator = "&" if "?" in url else "?"
        url += f"{separator}sslmode=require"
    return url


_db_url = _build_db_url(settings.DATABASE_URL)

if not _db_url or not _db_url.startswith("postgres"):
    logger.warning("⚠️ DATABASE_URL no configurada — arrancando sin base de datos.")
    engine = None
    SessionLocal = None
else:
    try:
        if IS_SERVERLESS:
            # NullPool: no mantiene conexiones persistentes entre invocaciones serverless
            # Esto es CRÍTICO en Vercel — pool_size/max_overflow causan errores en lambdas
            engine = create_engine(
                _db_url,
                poolclass=NullPool,
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
                echo=settings.DEBUG,
            )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info("✅ Conexión a Supabase configurada correctamente.")
    except Exception as e:
        logger.error(f"❌ Error configurando base de datos: {e}")
        engine = None
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

