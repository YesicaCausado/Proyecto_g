"""
NeuroLearn IA — Borrado definitivo de usuarios e instituciones (Administrador).

La BD de prueba activa las claves foráneas de SQLite (PRAGMA foreign_keys=ON)
para comportarse como PostgreSQL: antes de app/services/account_purge.py,
DELETE /admin/users/{id} y DELETE /admin/institutions/{id} fallaban con 500
en cuanto el usuario tenía notificaciones, consentimientos, entregas de
evaluaciones, progreso de NeuroBots, materiales, etc.

    python -m pytest tests/test_borrado_definitivo.py -v
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import get_password_hash  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.institution import AuditLog, Institution  # noqa: E402
from app.models.learning import LearningSession  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"
NEW_PASSWORD = "Mi-Clave-Nueva-2026"


def reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class HardDeleteTest(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

        @event.listens_for(engine, "connect")
        def _fk_on(dbapi_connection, _record):
            dbapi_connection.execute("PRAGMA foreign_keys=ON")

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
        db.add(User(username="admin_borrado", email="admin@borrado.app", full_name="Admin",
                    hashed_password=get_password_hash("Admin-2026-borrado"), role=UserRole.ADMIN.value,
                    is_active=True))
        db.commit()
        db.close()
        self.admin = self.login("admin_borrado", "Admin-2026-borrado")
        self.a = self.seed_institution(1)
        self.b = self.seed_institution(2)

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def login(self, username, password):
        reset_limits()
        r = self.client.post(f"{API}/auth/login", json={"username": username, "password": password})
        self.assertEqual(r.status_code, 200, r.text)
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    def first_login(self, cred):
        h = self.login(cred["username"], cred["temp_password"])
        r = self.client.post(f"{API}/auth/change-password", headers=h,
                             json={"current_password": cred["temp_password"], "new_password": NEW_PASSWORD})
        self.assertEqual(r.status_code, 204, r.text)
        return self.login(cred["username"], NEW_PASSWORD)

    def ok(self, r):
        self.assertLess(r.status_code, 300, r.text)
        return r.json() if r.content else None

    def seed_institution(self, n):
        """Institución con actividad real en casi todas las tablas que apuntan a usuarios."""
        c = self.client
        letra = " ABCDEFGH"[n]   # los nombres de personas no admiten números
        r = self.ok(c.post(f"{API}/admin/institutions", headers=self.admin, json={
            "name": f"Colegio Borrado {n}", "dane_code": f"7770000000{n}", "sp_full_name": f"Rectora {letra}",
            "sp_document_type": "CC", "sp_document_number": f"810000{n}", "sp_email": f"rectora{n}@borrado.co"}))
        d = {"inst": r["id"], "sp": self.first_login(r["credential"])}
        t = self.ok(c.post(f"{API}/super/teachers", headers=d["sp"], json={
            "full_name": f"Docente {letra}", "document_type": "CC", "document_number": f"820000{n}",
            "email": f"docente{n}@borrado.co", "subject_area": "Matemáticas"}))
        s = self.ok(c.post(f"{API}/super/students", headers=d["sp"], json={
            "full_name": f"Estudiante {letra}", "document_type": "TI", "document_number": f"830000{n}"}))
        d["teacher"], d["student"] = self.first_login(t), self.first_login(s)
        d["teacher_id"] = c.get(f"{API}/auth/me", headers=d["teacher"]).json()["id"]
        d["student_id"] = c.get(f"{API}/auth/me", headers=d["student"]).json()["id"]

        cl = self.ok(c.post(f"{API}/classrooms/", headers=d["teacher"],
                            json={"name": f"Mate {n}", "subject": "Matemáticas", "grade": "9"}))
        d["classroom"] = cl["id"]
        bot = self.ok(c.post(f"{API}/bots/create", headers=d["teacher"], json={
            "name": f"Bot {n}", "description": "x", "category": "Matemáticas", "is_public": False}))
        self.ok(c.post(f"{API}/classrooms/{cl['id']}/bots", headers=d["teacher"], json={"bot_id": bot["id"]}))
        self.ok(c.post(f"{API}/classrooms/join", headers=d["student"], json={"invite_code": cl["invite_code"]}))

        conv = self.ok(c.post(f"{API}/chat/conversations", headers=d["student"], json={"bot_id": bot["id"], "topic": "Álgebra"}))

        async def fake_generate(prompt, system_prompt="", **kwargs):
            return {"response": "¡Hola! Empecemos.", "provider": "fake", "fallback_used": False}
        with mock.patch.object(chat_api.ai_manager, "generate", side_effect=fake_generate):
            self.ok(c.post(f"{API}/chat/start", headers=d["student"],
                           json={"topic": "Álgebra", "bot_id": bot["id"], "conversation_id": conv["id"]}))

        ev = self.ok(c.post(f"{API}/teacher/evaluations", headers=d["teacher"], json={
            "title": f"Quiz {n}", "classroom_id": cl["id"],
            "questions": [{"type": "truefalse", "text": "2+2=4", "correct": "Verdadero"}]}))
        self.ok(c.post(f"{API}/teacher/evaluations/{ev['id']}/publish", headers=d["teacher"]))
        attempt = self.ok(c.post(f"{API}/student/evaluations/{ev['id']}/start", headers=d["student"]))
        submission_id = attempt.get("submission_id") or attempt.get("submission", {}).get("id")
        self.ok(c.post(f"{API}/student/evaluations/{ev['id']}/submit", headers=d["student"],
                       json={"submission_id": submission_id, "answers": {"q1": "Verdadero"}}))

        self.ok(c.post(f"{API}/events", headers=d["teacher"], json={
            "classroom_id": cl["id"], "title": "Examen", "event_type": "examen", "event_date": "2026-11-05"}))
        post = self.ok(c.post(f"{API}/posts", headers=d["teacher"],
                              json={"classroom_id": cl["id"], "title": "Hola", "content": "x"}))
        self.ok(c.post(f"{API}/posts/{post['id']}/comments", headers=d["student"], json={"content": "¡Gracias!"}))
        self.ok(c.post(f"{API}/posts/{post['id']}/reactions", headers=d["student"]))
        self.ok(c.post(f"{API}/messages/conversations/{d['student_id']}", headers=d["teacher"], data={"content": "Hola"}))
        self.ok(c.post(f"{API}/teacher/materials/folders", headers=d["teacher"], json={"name": "Guías"}))
        self.ok(c.put(f"{API}/super/students/{d['student_id']}", headers=d["sp"],
                      json={"guardian_name": f"Acudiente {letra}", "guardian_authorized": True}))
        self.ok(c.post(f"{API}/consents", headers=d["student"],
                       json={"consent_type": "camara_facial", "version": "1.0", "accepted": True}))
        return d

    def count(self, model, **filters):
        db = self.Session()
        try:
            return db.query(model).filter_by(**filters).count()
        finally:
            db.close()

    def test_delete_student_with_activity(self):
        self.assertGreater(self.count(Notification, user_id=self.a["student_id"]), 0)
        r = self.client.delete(f"{API}/admin/users/{self.a['student_id']}", headers=self.admin)
        self.assertEqual(r.status_code, 204, r.text)
        self.assertEqual(self.count(User, id=self.a["student_id"]), 0)
        self.assertEqual(self.count(Enrollment, student_id=self.a["student_id"]), 0)
        # El grupo del profesor y la otra institución siguen intactos.
        self.assertEqual(self.count(Classroom, id=self.a["classroom"]), 1)
        self.assertEqual(self.client.get(f"{API}/teacher/evaluations", headers=self.a["teacher"]).status_code, 200)
        self.assertEqual(self.count(User, id=self.b["student_id"]), 1)

    def test_delete_teacher_keeps_student_history(self):
        sessions_before = self.count(LearningSession, user_id=self.a["student_id"])
        self.assertGreater(sessions_before, 0)
        r = self.client.delete(f"{API}/admin/users/{self.a['teacher_id']}", headers=self.admin)
        self.assertEqual(r.status_code, 204, r.text)
        self.assertEqual(self.count(User, id=self.a["teacher_id"]), 0)
        self.assertEqual(self.count(Classroom, teacher_id=self.a["teacher_id"]), 0)
        # El estudiante conserva su historial de estudio (sin el NeuroBot borrado).
        self.assertEqual(self.count(LearningSession, user_id=self.a["student_id"]), sessions_before)
        self.assertEqual(self.client.get(f"{API}/auth/me", headers=self.a["student"]).status_code, 200)

    def test_delete_teacher_with_legacy_tables(self):
        """Tablas heredadas que solo existen en BD antiguas (p. ej. producción):
        el borrado las descubre por reflexión, sin listarlas en el código."""
        from sqlalchemy import text
        db = self.Session()
        db.execute(text("CREATE TABLE classroom_users (user_id INTEGER NOT NULL REFERENCES users(id), "
                        "classroom_id INTEGER NOT NULL REFERENCES classrooms(id), PRIMARY KEY (user_id, classroom_id))"))
        db.execute(text("CREATE TABLE messages (id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id))"))
        db.execute(text("CREATE TABLE user_conversations (id INTEGER PRIMARY KEY, "
                        "last_message_id INTEGER REFERENCES messages(id))"))
        t, s, cl = self.a["teacher_id"], self.a["student_id"], self.a["classroom"]
        db.execute(text("INSERT INTO classroom_users VALUES (:s, :cl), (:t, :cl)"), {"s": s, "t": t, "cl": cl})
        db.execute(text("INSERT INTO messages VALUES (1, :t), (2, :s)"), {"t": t, "s": s})
        db.execute(text("INSERT INTO user_conversations VALUES (1, 1), (2, 2)"))
        db.commit()
        db.close()

        r = self.client.delete(f"{API}/admin/users/{t}", headers=self.admin)
        self.assertEqual(r.status_code, 204, r.text)
        db = self.Session()
        try:
            self.assertEqual(db.execute(text("SELECT COUNT(*) FROM classroom_users")).scalar(), 0)
            self.assertEqual(db.execute(text("SELECT id FROM messages")).scalars().all(), [2])
            # La conversación se conserva; solo pierde la referencia al mensaje borrado.
            self.assertEqual(db.execute(text("SELECT id, last_message_id FROM user_conversations ORDER BY id")).all(),
                             [(1, None), (2, 2)])
        finally:
            db.close()

    def test_delete_institution_with_activity(self):
        audit_before = self.count(AuditLog)
        r = self.client.delete(f"{API}/admin/institutions/{self.a['inst']}", headers=self.admin)
        self.assertEqual(r.status_code, 204, r.text)
        self.assertEqual(self.count(Institution, id=self.a["inst"]), 0)
        for key in ("teacher_id", "student_id"):
            self.assertEqual(self.count(User, id=self.a[key]), 0)
        # La otra institución no se toca y la auditoría se conserva.
        self.assertEqual(self.count(Institution, id=self.b["inst"]), 1)
        self.assertEqual(self.client.get(f"{API}/classrooms/my-classes", headers=self.b["teacher"]).status_code, 200)
        self.assertGreaterEqual(self.count(AuditLog), audit_before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
