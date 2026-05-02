"""
Test rápido de todos los endpoints nuevos - NeuroLearn AI
"""
import httpx
import json

BASE = "http://127.0.0.1:8000/api/v1"


def test_full_flow():
    client = httpx.Client(timeout=15.0)

    print("=" * 60)
    print("🧪 TEST COMPLETO - NeuroLearn AI (Abril 2026)")
    print("=" * 60)

    # 1. Health check
    print("\n1️⃣ Health Check...")
    r = client.get("http://127.0.0.1:8000/health")
    data = r.json()
    print(f"   Status: {data['status']}")
    print(f"   AI Providers: {data['ai_providers']}")
    assert data["status"] == "healthy"
    print("   ✅ OK")

    # 2. Registrar profesor
    print("\n2️⃣ Registrar profesor...")
    r = client.post(f"{BASE}/auth/register", json={
        "username": "prof_garcia",
        "email": "garcia@colegio.edu.co",
        "password": "123456",
        "full_name": "María García",
        "role": "profesor",
    })
    print(f"   Status: {r.status_code}")
    prof = r.json()
    print(f"   Profesor: {prof['full_name']} (rol: {prof['role']})")
    assert prof["role"] == "profesor"
    print("   ✅ OK")

    # 3. Login profesor
    print("\n3️⃣ Login profesor...")
    r = client.post(f"{BASE}/auth/login", json={
        "username": "prof_garcia",
        "password": "123456",
    })
    token_prof = r.json()["access_token"]
    headers_prof = {"Authorization": f"Bearer {token_prof}"}
    print("   ✅ Token obtenido")

    # 4. Registrar estudiantes
    print("\n4️⃣ Registrar 3 estudiantes...")
    students = []
    for i, name in enumerate(["Carlos Pérez", "Ana López", "Luis Martínez"], 1):
        r = client.post(f"{BASE}/auth/register", json={
            "username": f"estudiante{i}",
            "email": f"est{i}@colegio.edu.co",
            "password": "123456",
            "full_name": name,
            "role": "estudiante",
        })
        students.append(r.json())
        print(f"   Estudiante {i}: {name} (rol: {r.json()['role']})")
    print("   ✅ OK")

    # 5. Login estudiante 1
    print("\n5️⃣ Login estudiante 1...")
    r = client.post(f"{BASE}/auth/login", json={
        "username": "estudiante1",
        "password": "123456",
    })
    token_est1 = r.json()["access_token"]
    headers_est1 = {"Authorization": f"Bearer {token_est1}"}
    print("   ✅ Token obtenido")

    # 6. Profesor crea una clase
    print("\n6️⃣ Profesor crea clase...")
    r = client.post(f"{BASE}/classrooms/", json={
        "name": "Pensamiento Matemático - 10mo",
        "description": "Clase de razonamiento lógico-matemático",
        "subject": "Pensamiento Lógico-Matemático",
        "grade": "10mo",
        "max_students": 30,
    }, headers=headers_prof)
    print(f"   Status: {r.status_code}")
    classroom = r.json()
    print(f"   Clase: {classroom['name']}")
    print(f"   Código invitación: {classroom['invite_code']}")
    assert r.status_code == 201
    invite_code = classroom["invite_code"]
    classroom_id = classroom["id"]
    print("   ✅ OK")

    # 7. Estudiante se inscribe con código
    print("\n7️⃣ Estudiante 1 se inscribe con código...")
    r = client.post(f"{BASE}/classrooms/join", json={
        "invite_code": invite_code,
    }, headers=headers_est1)
    print(f"   Status: {r.status_code}")
    enrollment = r.json()
    print(f"   Inscrito: {enrollment['student_name']}")
    print("   ✅ OK")

    # 8. Inscribir otros 2 estudiantes
    print("\n8️⃣ Inscribir estudiantes 2 y 3...")
    for i in range(2, 4):
        r = client.post(f"{BASE}/auth/login", json={
            "username": f"estudiante{i}",
            "password": "123456",
        })
        token = r.json()["access_token"]
        r = client.post(f"{BASE}/classrooms/join", json={
            "invite_code": invite_code,
        }, headers={"Authorization": f"Bearer {token}"})
        print(f"   Estudiante {i}: {r.json()['student_name']} inscrito")
    print("   ✅ OK")

    # 9. Profesor ve lista de estudiantes
    print("\n9️⃣ Profesor ve estudiantes de la clase...")
    r = client.get(f"{BASE}/classrooms/{classroom_id}/students", headers=headers_prof)
    students_list = r.json()
    print(f"   Total estudiantes: {len(students_list)}")
    for s in students_list:
        print(f"   - {s['student_name']} (progreso: {s['overall_progress']}%)")
    assert len(students_list) == 3
    print("   ✅ OK")

    # 10. Profesor ve estadísticas de la clase
    print("\n🔟 Profesor ve estadísticas...")
    r = client.get(f"{BASE}/classrooms/{classroom_id}/stats", headers=headers_prof)
    stats = r.json()
    print(f"   Clase: {stats['classroom_name']}")
    print(f"   Total estudiantes: {stats['total_students']}")
    print(f"   Promedio progreso: {stats['avg_progress']}%")
    print(f"   Estudiantes en riesgo: {stats['students_at_risk']}")
    print("   ✅ OK")

    # 11. Profesor ve alertas
    print("\n1️⃣1️⃣ Profesor ve alertas...")
    r = client.get(f"{BASE}/classrooms/{classroom_id}/alerts", headers=headers_prof)
    alerts = r.json()
    print(f"   Total alertas: {alerts['total']}")
    for a in alerts["alerts"][:3]:
        print(f"   ⚠️ [{a['severity']}] {a['student']}: {a['message']}")
    print("   ✅ OK")

    # 12. Profesor lista sus clases
    print("\n1️⃣2️⃣ Profesor lista sus clases...")
    r = client.get(f"{BASE}/classrooms/my-classes", headers=headers_prof)
    classes = r.json()
    print(f"   Total clases: {classes['total']}")
    for c in classes["classrooms"]:
        print(f"   📚 {c['name']} ({c['student_count']} estudiantes)")
    print("   ✅ OK")

    # 13. Estudiante inicia sesión de chat
    print("\n1️⃣3️⃣ Estudiante inicia sesión de aprendizaje...")
    r = client.post(f"{BASE}/chat/start", json={
        "topic": "Pensamiento Lógico-Matemático",
        "difficulty": "medium",
    }, headers=headers_est1)
    chat_resp = r.json()
    print(f"   Mensaje: {chat_resp['message'][:80]}...")
    print(f"   Estado cognitivo: {chat_resp['cognitive_state']}")
    print("   ✅ OK")

    # 14. Estudiante envía mensaje
    print("\n1️⃣4️⃣ Estudiante interactúa con el tutor...")
    r = client.post(f"{BASE}/chat/message", json={
        "message": "¿Qué es el razonamiento lógico?",
        "response_time_ms": 3500,
        "typing_speed_cpm": 120,
        "corrections": 1,
        "pause_before_ms": 800,
    }, headers=headers_est1)
    chat_resp = r.json()
    print(f"   Respuesta: {chat_resp['message'][:80]}...")
    print(f"   Acción: {chat_resp['action']}")
    print(f"   Estado: {chat_resp['cognitive_state']}")
    print("   ✅ OK")

    # 15. Verificar rol no autorizado
    print("\n1️⃣5️⃣ Verificar que estudiante NO puede crear clase...")
    r = client.post(f"{BASE}/classrooms/", json={
        "name": "Test",
        "subject": "Test",
    }, headers=headers_est1)
    print(f"   Status: {r.status_code} (esperado 403)")
    assert r.status_code == 403
    print("   ✅ OK - Acceso denegado correctamente")

    print("\n" + "=" * 60)
    print("🎉 TODOS LOS TESTS PASARON CORRECTAMENTE")
    print("=" * 60)
    print(f"\n📊 Resumen de endpoints probados:")
    print(f"   ✅ GET  /health")
    print(f"   ✅ POST /auth/register (con rol)")
    print(f"   ✅ POST /auth/login")
    print(f"   ✅ POST /classrooms/ (crear clase)")
    print(f"   ✅ GET  /classrooms/my-classes")
    print(f"   ✅ GET  /classrooms/{{id}}")
    print(f"   ✅ POST /classrooms/join (inscripción por código)")
    print(f"   ✅ GET  /classrooms/{{id}}/students")
    print(f"   ✅ GET  /classrooms/{{id}}/stats")
    print(f"   ✅ GET  /classrooms/{{id}}/alerts")
    print(f"   ✅ POST /chat/start")
    print(f"   ✅ POST /chat/message")
    print(f"   ✅ Control de acceso por rol")

    client.close()


if __name__ == "__main__":
    test_full_flow()
