"""
Auditoría final (parche 14): aislamiento entre instituciones, grupos del
Súper Profesor, cierre de sesiones, autorización del acudiente, voz del tutor
por el servidor, configuración del sistema y quizzes sin respuestas inventadas.
"""
from __future__ import annotations

import os
import sys
import time
import unittest
from datetime import datetime, timedelta
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import create_access_token, get_password_hash  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.institution import AuditLog, Institution  # noqa: E402
from app.models.posts import Post  # noqa: E402
from app.models.user import User  # noqa: E402

API = "/api/v1"
PASSWORD = "Clave-Segura-2026"


def reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class AuditoriaFinalTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def _get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        self.client = TestClient(app, raise_server_exceptions=False)
        db = self.Session()
        self.ids = {}
        hashed = get_password_hash(PASSWORD)
        for tag in "AB":
            inst = Institution(name=f"Colegio {tag}", dane_code=f"5550000000{ord(tag)}", is_active=True)
            db.add(inst)
            db.flush()
            self.ids["inst" + tag] = inst.id
            for role, n in (("super_profesor", ""), ("profesor", ""), ("profesor", "2"), ("estudiante", "")):
                u = User(username=f"{role}{n}{tag}", email=f"{role}{n}{tag}@t.edu.co", full_name=f"{role} {n}{tag}",
                         hashed_password=hashed, role=role, institution_id=inst.id, is_active=True)
                db.add(u)
                db.flush()
                self.ids[f"{role}{n}{tag}"] = u.id
            c = Classroom(teacher_id=self.ids["profesor" + tag], name=f"Grupo {tag}", subject="Mat", grade="9",
                          invite_code=f"GRP{tag}0001", is_active=True, max_students=40)
            db.add(c)
            db.flush()
            self.ids["class" + tag] = c.id
            db.add(Enrollment(student_id=self.ids["estudiante" + tag], classroom_id=c.id, is_active=True))
            p = Post(classroom_id=c.id, teacher_id=self.ids["profesor" + tag], title=f"Aviso {tag}")
            db.add(p)
            db.flush()
            self.ids["post" + tag] = p.id
        db.commit()
        db.close()
        reset_limits()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def login(self, username, password=PASSWORD):
        reset_limits()
        return self.client.post(f"{API}/auth/login", json={"username": username, "password": password})

    # ── Aislamiento entre instituciones ──────────────────────────────────────
    def test_super_de_otra_institucion_no_ve_grupos_ni_publicaciones(self):
        self.assertEqual(self.client.get(f"{API}/classrooms/{self.ids['classA']}",
                                         headers=self.h("super_profesorA")).status_code, 200)
        r = self.client.get(f"{API}/classrooms/{self.ids['classA']}", headers=self.h("super_profesorB"))
        self.assertIn(r.status_code, (403, 404))
        self.assertNotIn("GRPA0001", r.text)
        self.assertEqual(self.client.get(f"{API}/posts/{self.ids['postA']}",
                                         headers=self.h("super_profesorB")).status_code, 403)
        self.assertEqual(self.client.post(f"{API}/posts/{self.ids['postA']}/reactions", json={},
                                          headers=self.h("super_profesorB")).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/posts/{self.ids['postA']}",
                                         headers=self.h("super_profesorA")).status_code, 200)

    def test_mensajeria_no_cruza_instituciones(self):
        r = self.client.post(f"{API}/messages/conversations/{self.ids['profesorA']}",
                             headers=self.h("super_profesorB"), data={"content": "hola"})
        self.assertEqual(r.status_code, 403, r.text)
        r = self.client.get(f"{API}/messages/conversations/{self.ids['profesorA']}", headers=self.h("estudianteB"))
        self.assertEqual(r.status_code, 404)
        self.assertNotIn("profesor A", r.text)
        # Dentro de la misma institución sigue funcionando.
        r = self.client.post(f"{API}/messages/conversations/{self.ids['profesorA']}",
                             headers=self.h("super_profesorA"), data={"content": "hola"})
        self.assertIn(r.status_code, (200, 201), r.text)

    # ── Grupos del Súper Profesor ────────────────────────────────────────────
    def test_grupos_activar_desactivar_y_transferir_se_guardan(self):
        cid = self.ids["classA"]
        r = self.client.patch(f"{API}/super/classrooms/{cid}", headers=self.h("super_profesorA"),
                              json={"is_active": False})
        self.assertEqual(r.status_code, 200, r.text)
        listing = self.client.get(f"{API}/super/classrooms", headers=self.h("super_profesorA")).json()["classrooms"]
        self.assertEqual([(g["id"], g["status"]) for g in listing], [(cid, "inactivo")])   # sigue en la lista
        db = self.Session()
        self.assertFalse(db.get(Classroom, cid).is_active)
        db.close()

        # Transferir a un profesor de otra institución: rechazado.
        self.assertEqual(self.client.patch(f"{API}/super/classrooms/{cid}", headers=self.h("super_profesorA"),
                                           json={"teacher_id": self.ids["profesorB"]}).status_code, 400)
        r = self.client.patch(f"{API}/super/classrooms/{cid}", headers=self.h("super_profesorA"),
                              json={"teacher_id": self.ids["profesor2A"], "is_active": True})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["teacherId"], self.ids["profesor2A"])
        db = self.Session()
        c = db.get(Classroom, cid)
        self.assertEqual((c.teacher_id, c.is_active), (self.ids["profesor2A"], True))
        self.assertEqual(db.query(AuditLog).filter_by(action="update_classroom").count(), 2)
        db.close()

        detail = self.client.get(f"{API}/super/classrooms/{cid}", headers=self.h("super_profesorA")).json()
        self.assertEqual(detail["teacher"]["id"], self.ids["profesor2A"])
        self.assertEqual([s["id"] for s in detail["students"]], [self.ids["estudianteA"]])

        # Otra institución no lo ve ni lo cambia.
        self.assertEqual(self.client.get(f"{API}/super/classrooms/{cid}",
                                         headers=self.h("super_profesorB")).status_code, 404)
        self.assertEqual(self.client.patch(f"{API}/super/classrooms/{cid}", headers=self.h("super_profesorB"),
                                           json={"is_active": False}).status_code, 404)
        self.assertEqual(self.client.patch(f"{API}/super/classrooms/{cid}", headers=self.h("profesorA"),
                                           json={"is_active": False}).status_code, 403)

    # ── Sesiones ─────────────────────────────────────────────────────────────
    def test_cerrar_sesiones_invalida_los_tokens_anteriores(self):
        old = self.login("profesorA").json()["access_token"]
        old_h = {"Authorization": f"Bearer {old}"}
        self.assertEqual(self.client.get(f"{API}/auth/me", headers=old_h).status_code, 200)
        time.sleep(1.1)   # los tokens se fechan por segundos
        r = self.client.post(f"{API}/auth/logout-all", headers=old_h)
        self.assertEqual(r.status_code, 200, r.text)
        new_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        self.assertEqual(self.client.get(f"{API}/auth/me", headers=old_h).status_code, 401)
        self.assertEqual(self.client.get(f"{API}/auth/me", headers=new_h).status_code, 200)

        # El Súper Profesor cierra las sesiones de un estudiante de su institución.
        st = {"Authorization": "Bearer " + self.login("estudianteA").json()["access_token"]}
        time.sleep(1.1)
        self.assertEqual(self.client.post(f"{API}/super/users/{self.ids['estudianteA']}/revoke-sessions",
                                          headers=self.h("super_profesorB")).status_code, 404)
        self.assertEqual(self.client.post(f"{API}/super/users/{self.ids['estudianteA']}/revoke-sessions",
                                          headers=self.h("super_profesorA")).status_code, 200)
        self.assertEqual(self.client.get(f"{API}/auth/me", headers=st).status_code, 401)
        self.assertEqual(self.login("estudianteA").status_code, 200)   # puede volver a entrar

    def test_historial_de_accesos_registra_exitos_y_fallos(self):
        self.assertEqual(self.login("profesorA", "mala").status_code, 401)
        self.assertEqual(self.login("profesorA").status_code, 200)
        sec = self.client.get(f"{API}/super/stats/security", headers=self.h("super_profesorA")).json()
        actions = [h["action"] for h in sec["login_history"]]
        self.assertIn("login", actions)
        self.assertIn("login_failed", actions)
        self.assertTrue(any(s["id"] == self.ids["profesorA"] for s in sec["active_sessions"]))
        self.assertNotIn("Colombia", str(sec))      # ya no se inventa la ubicación
        other = self.client.get(f"{API}/super/stats/security", headers=self.h("super_profesorB")).json()
        self.assertEqual(other["login_history"], [])

    # ── Autorización del acudiente ───────────────────────────────────────────
    def consent(self, who, ctype="camara_facial"):
        version = self.client.get(f"{API}/consents/me", headers=self.h(who)).json()["consents"][ctype]["current_version"]
        return self.client.post(f"{API}/consents", headers=self.h(who),
                                json={"consent_type": ctype, "version": version, "accepted": True})

    def test_menor_necesita_autorizacion_del_acudiente(self):
        me = self.client.get(f"{API}/consents/me", headers=self.h("estudianteA")).json()
        self.assertTrue(me["guardian"]["blocked"])           # sin fecha de nacimiento
        self.assertEqual(self.consent("estudianteA").status_code, 403)

        sid = self.ids["estudianteA"]
        # Sin nombre del acudiente no se puede registrar.
        self.assertEqual(self.client.put(f"{API}/super/students/{sid}", headers=self.h("super_profesorA"),
                                         json={"guardian_authorized": True}).status_code, 400)
        r = self.client.put(f"{API}/super/students/{sid}", headers=self.h("super_profesorA"),
                            json={"guardian_name": "Ana Pérez", "guardian_authorized": True})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["guardian_authorized"])
        self.assertEqual(self.consent("estudianteA").status_code, 201)
        self.assertTrue(self.client.get(f"{API}/consents/me", headers=self.h("estudianteA"))
                        .json()["consents"]["camara_facial"]["granted"])

        # Si la institución retira la autorización, el consentimiento deja de valer.
        self.client.put(f"{API}/super/students/{sid}", headers=self.h("super_profesorA"),
                        json={"guardian_authorized": False})
        self.assertFalse(self.client.get(f"{API}/consents/me", headers=self.h("estudianteA"))
                         .json()["consents"]["camara_facial"]["granted"])

    def test_mayor_de_edad_y_docentes_no_necesitan_acudiente(self):
        from app.services.consent_service import guardian_status
        adult = User(role="estudiante", birth_date=(datetime.now() - timedelta(days=365 * 19)).strftime("%Y-%m-%d"))
        minor = User(role="estudiante", birth_date=(datetime.now() - timedelta(days=365 * 15)).strftime("%Y-%m-%d"))
        self.assertFalse(guardian_status(adult)["required"])
        self.assertEqual(guardian_status(minor)["reason"], "menor")
        self.assertFalse(guardian_status(User(role="profesor"))["required"])
        self.assertEqual(self.consent("profesorA").status_code, 201)

    # ── Voz del tutor por el servidor ────────────────────────────────────────
    def test_voz_sin_clave_en_el_navegador(self):
        self.assertEqual(self.client.post(f"{API}/voice/tts", json={"text": "hola"}).status_code, 401)
        with mock.patch.object(settings, "AZURE_SPEECH_KEY", None):
            self.assertEqual(self.client.post(f"{API}/voice/tts", headers=self.h("estudianteA"),
                                              json={"text": "hola"}).status_code, 503)

        class FakeResponse:
            status_code = 200
            content = b"ID3audio"

        class FakeClient:
            calls = []

            def __init__(self, *a, **k):
                pass

            async def __aenter__(self):
                return self

            async def __aexit__(self, *a):
                return False

            async def post(self, url, content=None, headers=None):
                FakeClient.calls.append((url, content, headers))
                return FakeResponse()

        with mock.patch.object(settings, "AZURE_SPEECH_KEY", "clave-de-prueba"), \
                mock.patch("app.api.voice.httpx.AsyncClient", FakeClient):
            r = self.client.post(f"{API}/voice/tts", headers=self.h("estudianteA"),
                                 json={"text": "2 < 3 & 'hola'", "lang": "es"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.headers["content-type"], "audio/mpeg")
        url, body, headers = FakeClient.calls[0]
        self.assertEqual(headers["Ocp-Apim-Subscription-Key"], "clave-de-prueba")
        self.assertIn(b"2 &lt; 3 &amp; &apos;hola&apos;", body)       # texto escapado en el SSML
        self.assertNotIn("clave-de-prueba", r.text)

        frontend = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "hooks", "useVoiceTutor.ts")
        if os.path.exists(frontend):
            with open(frontend, encoding="utf-8") as fh:
                self.assertNotIn("VITE_AZURE_SPEECH_KEY", fh.read())

    # ── Configuración del sistema ────────────────────────────────────────────
    def test_configuracion_del_sistema_es_de_solo_lectura(self):
        admin = User(username="admin1", email="admin1@t.co", full_name="Admin", hashed_password="x",
                     role="admin", is_active=True)
        db = self.Session()
        db.add(admin)
        db.commit()
        db.close()
        self.assertEqual(self.client.get(f"{API}/admin/config", headers=self.h("admin1")).status_code, 200)
        self.assertEqual(self.client.patch(f"{API}/admin/config", headers=self.h("admin1"),
                                           json={"debug_mode": True}).status_code, 405)

    # ── Quizzes ──────────────────────────────────────────────────────────────
    def test_quiz_sin_respuestas_inventadas(self):
        async def local(*a, **k):
            return {"response": "sin conexión", "provider": "local"}

        with mock.patch.object(chat_api.ai_manager, "generate", local):
            r = self.client.post(f"{API}/chat/generate-quiz", headers=self.h("estudianteA"),
                                 json={"topic": "Fracciones", "num_questions": 3})
        self.assertEqual(r.status_code, 503, r.text)

        quiz = ('{"quiz_title": "Fracciones", "difficulty": "Medio", "questions": ['
                '{"id": 1, "question": "1/2 + 1/2", "options": ["1", "2"], "answer": "1", "explanation": "x"},'
                '{"id": 2, "question": "Sin respuesta", "options": ["a", "b"], "explanation": "x"},'
                '{"id": 3, "question": "Respuesta fuera", "options": ["a", "b"], "answer": "c"}]}')

        async def groq(*a, **k):
            return {"response": quiz, "provider": "groq"}

        with mock.patch.object(chat_api.ai_manager, "generate", groq):
            r = self.client.post(f"{API}/chat/generate-quiz", headers=self.h("estudianteA"),
                                 json={"topic": "Fracciones", "num_questions": 3})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual([q["question"] for q in r.json()["questions"]], ["1/2 + 1/2"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
