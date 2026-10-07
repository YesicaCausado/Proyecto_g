"""
NeuroLearn IA — Flujo institucional completo de los 4 roles (prueba automática).

Convierte la prueba de humo manual por roles en una prueba que verifica datos:

  Administrador crea la institución → recibe credenciales del Súper Profesor
  → el Súper Profesor crea un profesor y un estudiante (contraseñas temporales)
  → cada uno inicia sesión y cambia su contraseña temporal
  → el profesor crea un aula y un NeuroBot y lo asigna
  → el estudiante se une con el código de invitación
  → cada rol ve los datos que le corresponden (y no los de otros)
  → el Administrador desactiva la institución: se bloquean tokens y login
  → la reactiva: vuelven a entrar.

Ejecutar desde backend/:

    python -m pytest tests/test_flujo_institucional.py -v
    # o sin pytest:
    python -m unittest tests.test_flujo_institucional -v
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import get_password_hash  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"
NEW_PASSWORD = "Mi-Clave-Nueva-2026"


def reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class InstitutionalFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def _get_db():
            db = Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        cls.client = TestClient(app, raise_server_exceptions=False)
        db = Session()
        db.add(User(username="admin_flujo", email="admin@neurolearn.app", full_name="Admin",
                    hashed_password=get_password_hash("Admin-2026-flujo"), role=UserRole.ADMIN.value,
                    is_active=True))
        db.commit()
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def login(self, username, password):
        reset_limits()
        return self.client.post(f"{API}/auth/login", json={"username": username, "password": password})

    def bearer(self, token):
        return {"Authorization": f"Bearer {token}"}

    def first_login(self, username, temp_password):
        """Login con contraseña temporal → cambio obligatorio → nuevo login."""
        r = self.login(username, temp_password)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertTrue(r.json()["must_change_password"])
        h = self.bearer(r.json()["access_token"])
        r = self.client.post(f"{API}/auth/change-password", headers=h,
                             json={"current_password": temp_password, "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 204, r.text)
        self.assertEqual(self.login(username, temp_password).status_code, 401)
        r = self.login(username, NEW_PASSWORD)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["must_change_password"])
        return self.bearer(r.json()["access_token"])

    def test_full_flow(self):
        c = self.client
        admin = self.bearer(self.login("admin_flujo", "Admin-2026-flujo").json()["access_token"])

        # 1. Administrador crea la institución
        r = c.post(f"{API}/admin/institutions", headers=admin, json={
            "name": "Colegio Flujo", "dane_code": "88800000001",
            "sp_full_name": "Rectora Flujo", "sp_document_type": "CC",
            "sp_document_number": "5100001", "sp_email": "rectora@flujo.edu.co",
        })
        self.assertIn(r.status_code, (200, 201), r.text)
        inst_id = r.json()["id"]
        sp_cred = r.json()["credential"]
        sp = self.first_login(sp_cred["username"], sp_cred["temp_password"])
        self.assertEqual(c.get(f"{API}/auth/me", headers=sp).json()["institution_name"], "Colegio Flujo")

        # 2. Súper Profesor crea profesor y estudiante
        r = c.post(f"{API}/super/teachers", headers=sp, json={
            "full_name": "Docente Flujo", "document_type": "CC", "document_number": "6100001",
            "email": "docente@flujo.edu.co", "subject_area": "Matemáticas",
        })
        self.assertIn(r.status_code, (200, 201), r.text)
        t_cred = r.json()
        r = c.post(f"{API}/super/students", headers=sp, json={
            "full_name": "Estudiante Flujo", "document_type": "TI", "document_number": "7100001",
        })
        self.assertIn(r.status_code, (200, 201), r.text)
        s_cred = r.json()
        teacher = self.first_login(t_cred["username"], t_cred["temp_password"])
        student = self.first_login(s_cred["username"], s_cred["temp_password"])

        teachers = c.get(f"{API}/super/teachers", headers=sp).json()
        teacher_list = teachers if isinstance(teachers, list) else teachers.get("teachers", [])
        self.assertIn(t_cred["username"], {t.get("username") for t in teacher_list})

        # 3. Profesor crea aula y NeuroBot, y lo asigna
        r = c.post(f"{API}/classrooms/", headers=teacher, json={"name": "Matemáticas 9A", "subject": "Matemáticas", "grade": "9"})
        self.assertIn(r.status_code, (200, 201), r.text)
        classroom = r.json()
        r = c.post(f"{API}/bots/create", headers=teacher, json={
            "name": "Bot Álgebra", "description": "Apoyo", "category": "Matemáticas", "is_public": False})
        self.assertEqual(r.status_code, 200, r.text)
        bot_id = r.json()["id"]
        r = c.post(f"{API}/classrooms/{classroom['id']}/bots", headers=teacher, json={"bot_id": bot_id})
        self.assertIn(r.status_code, (200, 201), r.text)

        # 4. Estudiante se une con el código y ve su aula y el bot asignado
        r = c.post(f"{API}/classrooms/join", headers=student, json={"invite_code": classroom["invite_code"]})
        self.assertIn(r.status_code, (200, 201), r.text)
        enrolled = c.get(f"{API}/classrooms/my-enrolled", headers=student).json()
        self.assertIn(classroom["id"], {cl["id"] for cl in enrolled["classrooms"]})
        shared = c.get(f"{API}/bots/shared-with-me", headers=student).json()
        self.assertIn(bot_id, {b["id"] for b in shared["bots"]})
        roster = c.get(f"{API}/classrooms/{classroom['id']}/students", headers=teacher).json()
        self.assertEqual([(s["student_username"], s["student_name"]) for s in roster],
                         [(s_cred["username"], "Estudiante Flujo")])

        # 5. Acciones que cada rol NO puede hacer
        self.assertEqual(c.post(f"{API}/classrooms/", headers=student, json={"name": "X", "subject": "Y"}).status_code, 403)
        self.assertEqual(c.post(f"{API}/classrooms/join", headers=teacher,
                                json={"invite_code": classroom["invite_code"]}).status_code, 403)
        self.assertEqual(c.post(f"{API}/chat/start", headers=sp, json={"topic": "matemáticas"}).status_code, 403)
        self.assertEqual(c.get(f"{API}/super/stats/alerts", headers=student).status_code, 403)
        self.assertEqual(c.get(f"{API}/admin/users", headers=sp).status_code, 403)

        # 6. El estudiante sí conversa con el bot de su aula (IA reemplazada por un doble)
        async def fake_generate(prompt, system_prompt="", **kwargs):
            return {"response": "¡Hola! Empecemos.", "provider": "fake", "fallback_used": False}
        with mock.patch.object(chat_api.ai_manager, "generate", side_effect=fake_generate):
            r = c.post(f"{API}/chat/start", headers=student, json={"topic": "Álgebra", "bot_id": bot_id})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["message"], "¡Hola! Empecemos.")

        # 7. Desactivar la institución bloquea tokens y login de sus usuarios
        r = c.patch(f"{API}/admin/institutions/{inst_id}", headers=admin, json={"is_active": False})
        self.assertEqual(r.status_code, 200, r.text)
        for h in (sp, teacher, student):
            r = c.get(f"{API}/auth/me", headers=h)
            self.assertEqual(r.status_code, 403)
            self.assertIn("institución está desactivada", r.json()["detail"])
        self.assertEqual(self.login(t_cred["username"], NEW_PASSWORD).status_code, 403)
        self.assertEqual(c.get(f"{API}/auth/me", headers=admin).status_code, 200)

        # 8. Reactivar
        self.assertEqual(c.patch(f"{API}/admin/institutions/{inst_id}", headers=admin,
                                 json={"is_active": True}).status_code, 200)
        self.assertEqual(c.get(f"{API}/auth/me", headers=teacher).status_code, 200)
        institutions = c.get(f"{API}/admin/institutions", headers=admin).json()["institutions"]
        row = next(i for i in institutions if i["id"] == inst_id)
        self.assertNotIn("license_type", row)


if __name__ == "__main__":
    unittest.main(verbosity=2)
