#!/usr/bin/env python3
"""
Script para verificar el login de todos los usuarios
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

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# Credenciales de prueba
LOGIN_TESTS = [
    ("admin", "admin1234", True, "Super Admin"),
    ("demo", "demo", True, "Demo User"),
    ("profesor", "profesor", True, "Profesor User"),
    ("superprofesor", "superprofesor", True, "Superprofesor User"),
]

print("=" * 80)
print("PRUEBAS DE LOGIN - TODOS LOS USUARIOS")
print("=" * 80)
print()

for username, password, should_pass, description in LOGIN_TESTS:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password}
    )
    
    status = "✅" if response.status_code == 200 else "❌"
    print(f"{status} {description:20} ({username})")
    print(f"   Status: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print(f"   Token: {data.get('access_token', 'N/A')[:50]}...")
        print(f"   User: {data.get('user', {}).get('username', 'N/A')}")
    else:
        print(f"   Error: {response.text[:100]}")
    print()

print("=" * 80)
print("✅ PRUEBAS COMPLETADAS")
print("=" * 80)
