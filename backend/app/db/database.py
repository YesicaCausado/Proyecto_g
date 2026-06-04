"""
NeuroLearn AI - Configuración de Base de Datos
Soporta SQLite (local/desarrollo) y PostgreSQL (Vercel/producción).
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
import os

# Detectar si estamos en un entorno sin base de datos (ej. Vercel sin DATABASE_URL)
# La variable VERCEL_ENV es establecida automáticamente por Vercel.
IS_DB_DISABLED = settings.ENVIRONMENT != "development" and not settings.DATABASE_URL.startswith("postgres")

if IS_DB_DISABLED:
    # Modo sin base de datos: no configurar engine ni session
    engine = None
    SessionLocal = None
    Base = declarative_base()
else:
    # Modo normal con base de datos
    _db_url = settings.DATABASE_URL
    _connect_args = {"check_same_thread": False} if _db_url.startswith("sqlite") else {}
    engine = create_engine(_db_url, connect_args=_connect_args)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base = declarative_base()


def get_db():
    """Dependencia para obtener sesión de base de datos"""
    if IS_DB_DISABLED or not SessionLocal:
        # Si la DB está deshabilitada, simplemente retornamos None y terminamos.
        # Los endpoints deben manejar este caso.
        yield None
        return
        
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
