"""
NeuroLearn IA — Regresiones de rendimiento de base de datos.

Protege las optimizaciones que evitaban que Supabase se saturara:

  - La foto del usuario (data URL de hasta ~3 MB) y el logo de la institución
    (hasta 2 MB) son columnas diferidas: la autenticación de cada petición no
    los trae de la BD.
  - Tablero (GET /posts) y calendario (GET /events) hacen un número FIJO de
    consultas, sin importar cuántos posts, comentarios o eventos haya (antes
    eran varias consultas por elemento).
  - La sesión de la app no expira los objetos en cada commit.

    python -m pytest tests/test_rendimiento_bd.py -v
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token, get_password_hash  # noqa: E402
from app.db import database  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.events import ClassroomEvent  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.posts import Post, PostComment, PostReaction  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"
BIG_PHOTO = "data:image/png;base64," + "A" * 200_000


class DatabasePerformanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=cls.engine)
        # Igual que la app (app/db/database.py).
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False, expire_on_commit=False)

        def _get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        cls.client = TestClient(app, raise_server_exceptions=False)

        db = cls.Session()
        inst = Institution(name="Colegio Rendimiento", dane_code="REND0000001", is_active=True, logo_url=BIG_PHOTO)
        db.add(inst)
        db.flush()
        pw = get_password_hash("Rendimiento-2026")

        def user(username, role):
            u = User(username=username, email=f"{username}@rend.test", full_name=username.title(), hashed_password=pw,
                     role=role, institution_id=inst.id, is_active=True, photo=BIG_PHOTO)
            db.add(u)
            db.flush()
            return u

        teacher = user("profe_rend", UserRole.PROFESOR.value)
        students = [user(f"est_rend_{i}", UserRole.ESTUDIANTE.value) for i in range(6)]
        classroom = Classroom(teacher_id=teacher.id, name="Mate 9A", subject="Matemáticas", invite_code="REND0001")
        db.add(classroom)
        db.flush()
        for s in students:
            db.add(Enrollment(student_id=s.id, classroom_id=classroom.id))
        db.commit()
        cls.teacher_id, cls.classroom_id, cls.institution_id = teacher.id, classroom.id, inst.id
        cls.student_ids = [s.id for s in students]
        cls.headers = {"Authorization": f"Bearer {create_access_token({'sub': teacher.username})}"}
        cls.student_headers = {"Authorization": f"Bearer {create_access_token({'sub': students[0].username})}"}
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def capture(self, method, url, headers):
        statements = []

        def _log(conn, cursor, statement, *args):
            statements.append(statement)

        event.listen(self.engine, "before_cursor_execute", _log)
        try:
            r = self.client.request(method, API + url, headers=headers)
        finally:
            event.remove(self.engine, "before_cursor_execute", _log)
        self.assertEqual(r.status_code, 200, r.text)
        return r, statements

    def add_posts(self, n):
        db = self.Session()
        for i in range(n):
            p = Post(classroom_id=self.classroom_id, teacher_id=self.teacher_id, title=f"Post {i}", content="x")
            db.add(p)
            db.flush()
            for sid in self.student_ids:
                db.add(PostComment(post_id=p.id, author_id=sid, content="¡Gracias!"))
                db.add(PostReaction(post_id=p.id, user_id=sid))
        db.commit()
        db.close()

    def add_events(self, n):
        db = self.Session()
        for i in range(n):
            db.add(ClassroomEvent(classroom_id=self.classroom_id, teacher_id=self.teacher_id, institution_id=self.institution_id,
                                  title=f"Evento {i}", event_date=f"2026-11-{i + 1:02d}"))
        db.commit()
        db.close()

    def test_app_session_does_not_expire_on_commit(self):
        self.assertFalse(database.SessionLocal.kw.get("expire_on_commit", True))

    def test_auth_does_not_load_photo_or_logo(self):
        _, statements = self.capture("GET", "/notifications/unread-count", self.headers)
        sql = " ".join(statements).lower()
        self.assertNotIn("users.photo", sql)
        self.assertNotIn("institutions.logo_url", sql)
        # Donde sí se necesita, la foto sigue llegando.
        r, _ = self.capture("GET", "/auth/me", self.headers)
        self.assertEqual(r.json()["photo"], BIG_PHOTO)

    def test_board_query_count_is_constant(self):
        self.add_posts(2)
        r, few = self.capture("GET", "/posts", self.headers)
        self.add_posts(8)
        r, many = self.capture("GET", "/posts", self.student_headers)
        posts = r.json()["posts"]
        self.assertEqual(len(posts), 10)
        self.assertTrue(all(p["comments_count"] == 6 and p["reactions_count"] == 6 for p in posts))
        self.assertTrue(all(p["user_reacted"] for p in posts))
        self.assertLessEqual(len(many), len(few) + 1, "GET /posts vuelve a hacer consultas por post")

    def test_calendar_query_count_is_constant(self):
        self.add_events(2)
        r, few = self.capture("GET", "/events?month=2026-11", self.headers)
        self.add_events(10)
        r, many = self.capture("GET", "/events?month=2026-11", self.headers)
        self.assertEqual(len(r.json()["events"]), 12)
        self.assertTrue(all(e["teacher_name"] == "Profe_Rend" for e in r.json()["events"]))
        self.assertEqual(len(many), len(few), "GET /events vuelve a hacer consultas por evento")


if __name__ == "__main__":
    unittest.main(verbosity=2)
