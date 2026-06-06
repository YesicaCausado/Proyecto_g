"""
NeuroLearn AI - Configuración de Base de Datos
Supabase PostgreSQL — Production Ready
"""
from dotenv import load_dotenv
load_dotenv()
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

import os
print("DATABASE_URL =", os.getenv("DATABASE_URL"))
# Detectar si estamos en un entorno sin base de datos (ej. Vercel sin DATABASE_URL)
# La variable VERCEL_ENV es establecida automáticamente por Vercel.
IS_DB_DISABLED = settings.ENVIRONMENT != "development" and not settings.DATABASE_URL.startswith("postgres")
_db_url = settings.DATABASE_URL
# PostgreSQL con pool optimizado para Supabase + serverless
engine = create_engine(
    _db_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,   # Detecta conexiones caídas antes de usarlas
    pool_recycle=300,     # Recicla conexiones cada 5 minutos
    echo=settings.DEBUG,  # Muestra SQL en consola solo en DEBUG
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependencia FastAPI para obtener sesión de base de datos"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
