#!/usr/bin/env python3
"""
Script para resetear las contraseñas de los usuarios demo
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

# Usuarios a resetear con sus nuevas contraseñas
USERS_TO_RESET = [
    ("demo", "demo"),
    ("profesor", "profesor"),
    ("superprofesor", "superprofesor"),
]

print("=" * 80)
print("RESETEAR CONTRASEÑAS DE USUARIOS")
print("=" * 80)

db = SessionLocal()

try:
    for username, password in USERS_TO_RESET:
        user = db.query(User).filter(User.username == username).first()
        if user:
            hashed = pwd_context.hash(password)
            user.hashed_password = hashed
            db.commit()
            print(f"✅ {username}: contraseña actualizada a '{password}'")
        else:
            print(f"❌ {username}: usuario no encontrado")
finally:
    db.close()

print("=" * 80)
print("✅ CONTRASEÑAS ACTUALIZADAS")
print("=" * 80)
