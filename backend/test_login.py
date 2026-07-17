#!/usr/bin/env python3
"""
Script para probar el endpoint de login
"""
import sys
from pathlib import Path

# Agregar backend al path
_BACKEND_DIR = Path(__file__).parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Importar todos los modelos PRIMERO
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

print("=" * 80)
print("TEST DE LOGIN")
print("=" * 80)

# 1. Probar endpoint /health
print("\n1️⃣ PROBANDO HEALTH CHECK...")
try:
    response = client.get("/health")
    print(f"   Status: {response.status_code}")
    print(f"   Response: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# 2. Probar login con usuario demo
print("\n2️⃣ INTENTANDO LOGIN CON DEMO (demo/demo)...")
try:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "demo",
            "password": "demo"
        }
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ LOGIN EXITOSO")
        print(f"      - Token: {data.get('access_token')[:50]}...")
        print(f"      - User ID: {data.get('user_id')}")
        print(f"      - Role: {data.get('role')}")
    else:
        print(f"   ❌ Error {response.status_code}")
        print(f"      Response: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# 3. Probar login con profesor
print("\n3️⃣ INTENTANDO LOGIN CON PROFESOR (profesor/profesor)...")
try:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "profesor",
            "password": "profesor"
        }
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ LOGIN EXITOSO")
        print(f"      - Token: {data.get('access_token')[:50]}...")
        print(f"      - User ID: {data.get('user_id')}")
        print(f"      - Role: {data.get('role')}")
    else:
        print(f"   ❌ Error {response.status_code}")
        print(f"      Response: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# 4. Probar login con admin
print("\n4️⃣ INTENTANDO LOGIN CON ADMIN (admin/admin1234)...")
try:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "admin",
            "password": "admin1234"
        }
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ LOGIN EXITOSO")
        print(f"      - Token: {data.get('access_token')[:50]}...")
        print(f"      - User ID: {data.get('user_id')}")
        print(f"      - Role: {data.get('role')}")
    else:
        print(f"   ❌ Error {response.status_code}")
        print(f"      Response: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

# 5. Probar login fallido
print("\n5️⃣ INTENTANDO LOGIN CON CONTRASEÑA INCORRECTA (demo/wrong)...")
try:
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": "demo",
            "password": "wrong"
        }
    )
    print(f"   Status: {response.status_code}")
    if response.status_code == 401:
        print(f"   ✅ RECHAZO CORRECTO (401)")
        print(f"      Response: {response.json()}")
    else:
        print(f"   ❌ Status inesperado {response.status_code}")
        print(f"      Response: {response.json()}")
except Exception as e:
    print(f"   ❌ Error: {str(e)}")

print("\n" + "=" * 80)
print("✅ TEST COMPLETADO")
print("=" * 80)
