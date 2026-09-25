#!/usr/bin/env python3
"""
Script para sembrar/restaurar los usuarios demo documentados.

Crea los usuarios demo de docs/CREDENTIALS_DEMO.md si no existen y resetea
sus contraseñas a las documentadas. Idempotente: puede ejecutarse varias
veces sin duplicar registros.

Roles documentados:
    demo           / demo            → Estudiante
    profesor       / profesor        → Profesor
    superprofesor  / superprofesor   → Super Profesor (Rector)
    admin          / admin1234       → Admin
"""
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Importar todos los modelos
import app.models.institution        # noqa: F401
import app.models.user               # noqa: F401
import app.models.learning           # noqa: F401
import app.models.expert_bot         # noqa: F401
import app.models.classroom          # noqa: F401
import app.models.posts              # noqa: F401
import app.models.events             # noqa: F401
import app.models.messages           # noqa: F401
import app.models.password_reset     # noqa: F401

from app.db.database import SessionLocal
from app.models.user import User
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Usuarios demo documentados (docs/CREDENTIALS_DEMO.md)
DEMO_USERS = [
    # (username, email, password, full_name, role)
    ("demo", "demo@neurolearn.app", "demo", "Usuario Demo", "estudiante"),
    ("profesor", "profesor@neurolearn.app", "profesor", "Profesor Demo", "profesor"),
    ("superprofesor", "superprofesor@neurolearn.app", "superprofesor", "Super Profesor Demo", "super_profesor"),
    ("admin", "admin@neurolearn.app", "admin1234", "Administrador Demo", "admin"),
]

print("=" * 80)
print("SEMBRAR / RESTAURAR USUARIOS DEMO")
print("=" * 80)

db = SessionLocal()

try:
    for username, email, password, full_name, role in DEMO_USERS:
        user = db.query(User).filter(User.username == username).first()
        hashed = pwd_context.hash(password)
        if user:
            user.hashed_password = hashed
            user.email = user.email or email
            user.full_name = user.full_name or full_name
            user.role = role if not user.role or user.role == "estudiante" else user.role
            user.is_active = True
            action = "contraseña restaurada"
        else:
            user = User(
                username=username,
                email=email,
                hashed_password=hashed,
                full_name=full_name,
                role=role,
                is_active=True,
            )
            db.add(user)
            action = "usuario creado"
        db.commit()
        db.refresh(user)
        print(f"✅ {username} (id={user.id}, rol={user.role}): {action} → '{password}'")
finally:
    db.close()

print("=" * 80)
print("✅ USUARIOS DEMO LISTOS")
print("=" * 80)
