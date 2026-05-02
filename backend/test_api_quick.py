"""Test rápido de la API de NeuroLearn AI"""
import urllib.request
import json
import sys

BASE = "http://127.0.0.1:8000/api/v1"

def api(method, path, data=None, token=None):
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req)
        return resp.getcode(), json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

print("=" * 60)
print("🧪 TEST RÁPIDO DE API - NeuroLearn AI")
print("=" * 60)

# 1. Registrar usuario
print("\n1️⃣  Registrando usuario...")
code, resp = api("POST", "/auth/register", {
    "username": "yesica",
    "email": "yesica@test.com",
    "password": "password123",
    "full_name": "Yesica"
})
print(f"   Status: {code}")
if code == 201 or code == 200:
    print(f"   ✅ Usuario registrado: {resp.get('username', resp)}")
else:
    print(f"   ⚠️  {resp}")

# 2. Login
print("\n2️⃣  Haciendo login...")
code, resp = api("POST", "/auth/login", {
    "username": "yesica",
    "password": "password123"
})
print(f"   Status: {code}")
if code == 200:
    token = resp["access_token"]
    print(f"   ✅ Token obtenido: {token[:30]}...")
else:
    print(f"   ❌ Error: {resp}")
    sys.exit(1)

# 3. Ver perfil
print("\n3️⃣  Consultando perfil...")
code, resp = api("GET", "/auth/me", token=token)
print(f"   Status: {code}")
if code == 200:
    print(f"   ✅ Perfil: {resp['username']} ({resp['email']})")
else:
    print(f"   ❌ Error: {resp}")

# 4. Iniciar sesión de chat
print("\n4️⃣  Iniciando sesión de aprendizaje...")
code, resp = api("POST", "/chat/start", {
    "topic": "Python Básico",
    "difficulty": "beginner"
}, token=token)
print(f"   Status: {code}")
if code == 200:
    print(f"   ✅ Sesión iniciada")
    print(f"   🤖 {resp['message'][:100]}...")
    print(f"   Estado: {resp['cognitive_state']} | Acción: {resp['action']}")
else:
    print(f"   ❌ Error: {resp}")

# 5. Enviar mensaje al chatbot
print("\n5️⃣  Enviando mensaje al chatbot...")
code, resp = api("POST", "/chat/message", {
    "message": "¿Qué es una variable en Python?",
    "response_time_ms": 3000,
    "typing_speed_cpm": 120,
    "corrections": 0,
    "pause_before_ms": 500
}, token=token)
print(f"   Status: {code}")
if code == 200:
    print(f"   ✅ Respuesta recibida")
    print(f"   🤖 {resp['message'][:120]}...")
    print(f"   Estado cognitivo: {resp['cognitive_state']}")
    print(f"   Acción: {resp['action']}")
    print(f"   Dificultad: {resp['difficulty']}")
    print(f"   Engagement: {resp.get('engagement_score', 'N/A')}")
    print(f"   Modalidades activas: {resp.get('active_modalities', [])}")
else:
    print(f"   ❌ Error: {resp}")

# 6. Segundo mensaje (simular fatiga)
print("\n6️⃣  Enviando mensaje con señales de fatiga...")
code, resp = api("POST", "/chat/message", {
    "message": "no entiendo",
    "response_time_ms": 8000,
    "typing_speed_cpm": 40,
    "corrections": 3,
    "pause_before_ms": 5000
}, token=token)
print(f"   Status: {code}")
if code == 200:
    print(f"   ✅ Respuesta recibida")
    print(f"   🤖 {resp['message'][:120]}...")
    print(f"   Estado cognitivo: {resp['cognitive_state']}")
    print(f"   ¿Pausa sugerida?: {resp['should_pause']}")
else:
    print(f"   ❌ Error: {resp}")

# 7. Estadísticas
print("\n7️⃣  Consultando estadísticas...")
code, resp = api("GET", "/chat/stats", token=token)
print(f"   Status: {code}")
if code == 200:
    print(f"   ✅ Estadísticas de sesión:")
    print(f"   📊 Tema: {resp['topic']}")
    print(f"   📊 Interacciones: {resp['interactions']}")
    print(f"   📊 Estado: {resp['cognitive_state']}")
    print(f"   📊 Dificultad: {resp['difficulty']}")
else:
    print(f"   ❌ Error: {resp}")

# 8. Finalizar sesión
print("\n8️⃣  Finalizando sesión...")
code, resp = api("POST", "/chat/end", token=token)
print(f"   Status: {code}")
if code == 200:
    print(f"   ✅ {resp['message']}")
else:
    print(f"   ❌ Error: {resp}")

print("\n" + "=" * 60)
print("✅ ¡TEST COMPLETO!")
print("=" * 60)
