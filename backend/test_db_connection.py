#!/usr/bin/env python3
"""
Script para probar la conexión a Supabase PostgreSQL
"""
import os
import sys
from pathlib import Path

# Agregar backend al path
_BACKEND_DIR = Path(__file__).parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Importar todos los modelos PRIMERO para registrarlos en SQLAlchemy
import app.models.institution        # noqa: F401
import app.models.user               # noqa: F401
import app.models.learning           # noqa: F401
import app.models.expert_bot         # noqa: F401
import app.models.classroom          # noqa: F401
import app.models.posts              # noqa: F401
import app.models.events             # noqa: F401
import app.models.messages           # noqa: F401
import app.models.password_reset     # noqa: F401

from app.core.config import settings
from app.db.database import engine, SessionLocal, IS_DB_DISABLED
from app.models.user import User

print("=" * 80)
print("TEST DE CONEXIÓN A BASE DE DATOS")
print("=" * 80)

# 1. Verificar configuración
print("\n1️⃣ CONFIGURACIÓN:")
print(f"   DATABASE_URL: {settings.DATABASE_URL[:50]}..." if settings.DATABASE_URL else "   ❌ DATABASE_URL no configurada")
print(f"   ENVIRONMENT: {settings.ENVIRONMENT}")
print(f"   IS_PRODUCTION: {settings.IS_PRODUCTION}")
print(f"   IS_DB_DISABLED: {IS_DB_DISABLED}")

if IS_DB_DISABLED:
    print("\n❌ BASE DE DATOS DESHABILITADA")
    sys.exit(1)

if engine is None:
    print("\n❌ Engine es None - No se puede conectar")
    sys.exit(1)

# 2. Probar conexión basic
print("\n2️⃣ PROBANDO CONEXIÓN BÁSICA...")
try:
    from sqlalchemy import text
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1 as test"))
        print("   ✅ Conexión exitosa")
        print(f"   Resultado: {result.fetchone()}")
except Exception as e:
    print(f"   ❌ Error de conexión: {str(e)}")
    sys.exit(1)

# 3. Probar sesión
print("\n3️⃣ PROBANDO SESIÓN...")
try:
    db = SessionLocal()
    print("   ✅ Sesión creada")
    db.close()
except Exception as e:
    print(f"   ❌ Error creando sesión: {str(e)}")
    sys.exit(1)

# 4. Consultar usuarios existentes
print("\n4️⃣ CONSULTANDO USUARIOS...")
try:
    db = SessionLocal()
    count = db.query(User).count()
    users = db.query(User).limit(5).all()
    print(f"   ✅ Total de usuarios: {count}")
    if users:
        print("\n   Primeros 5 usuarios:")
        for u in users:
            print(f"      - {u.username} ({u.role}) | activo: {u.is_active}")
    else:
        print("   ℹ️ No hay usuarios en la base de datos")
    db.close()
except Exception as e:
    print(f"   ❌ Error consultando usuarios: {str(e)}")
    sys.exit(1)

# 5. Probar usuario demo
print("\n5️⃣ PROBANDO USUARIO DEMO (demo/demo)...")
try:
    db = SessionLocal()
    demo_user = db.query(User).filter(User.username == "demo").first()
    if demo_user:
        print(f"   ✅ Usuario demo encontrado")
        print(f"      - ID: {demo_user.id}")
        print(f"      - Role: {demo_user.role}")
        print(f"      - Activo: {demo_user.is_active}")
    else:
        print("   ❌ Usuario demo NO encontrado - Es necesario para testing")
    db.close()
except Exception as e:
    print(f"   ❌ Error: {str(e)}")
    sys.exit(1)

print("\n" + "=" * 80)
print("✅ TODOS LOS TESTS PASARON - LA CONEXIÓN ESTÁ FUNCIONANDO")
print("=" * 80)
