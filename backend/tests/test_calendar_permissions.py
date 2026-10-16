import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas as entorno_pruebas  # noqa: F401

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.auth import create_access_token, get_password_hash
from app.db.database import Base, get_db
from app.main import app
from app.models.institution import Institution
from app.models.user import User, UserRole


class CalendarPermissionsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert entorno_pruebas.TEST_ENV
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        cls.session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def get_test_db():
            db = cls.session_factory()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = get_test_db
        cls.client = TestClient(app, raise_server_exceptions=False)

        db = cls.session_factory()
        institution = Institution(name="Institución calendario", dane_code="CAL20260001", is_active=True)
        db.add(institution)
        db.flush()
        password = get_password_hash("Calendar!2026")

        def add_user(username, role):
            user = User(
                username=username,
                email=f"{username}@calendar.test",
                full_name=username,
                hashed_password=password,
                role=role,
                institution_id=institution.id,
                is_active=True,
            )
            db.add(user)
            db.flush()
            return user

        cls.super = add_user("super_calendar", UserRole.SUPER_PROFESOR.value)
        cls.teacher = add_user("teacher_calendar", UserRole.PROFESOR.value)
        cls.other_teacher = add_user("other_teacher_calendar", UserRole.PROFESOR.value)
        cls.student = add_user("student_calendar", UserRole.ESTUDIANTE.value)
        cls.other_student = add_user("other_student_calendar", UserRole.ESTUDIANTE.value)
        db.commit()
        cls.institution_id = institution.id
        cls.tokens = {
            key: create_access_token({"sub": user.username})
            for key, user in {
                "super": cls.super,
                "teacher": cls.teacher,
                "other_teacher": cls.other_teacher,
                "student": cls.student,
                "other_student": cls.other_student,
            }.items()
        }
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def headers(self, role):
        return {"Authorization": f"Bearer {self.tokens[role]}"}

    def create(self, role, **payload):
        response = self.client.post("/api/v1/events", headers=self.headers(role), json={
            "title": payload.get("title", "Evento"),
            "event_type": "evento",
            "event_date": "2026-10-20",
            "description": "",
            "classroom_id": None,
        })
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()["id"]

    def test_roles_and_personal_calendar_permissions(self):
        institutional_id = self.create("super", title="Institucional")
        teacher_id = self.create("teacher", title="Evento del profesor")
        other_teacher_id = self.create("other_teacher", title="Evento de otro profesor")
        personal_id = self.create("student", title="Recordatorio personal")

        super_events = self.client.get(
            "/api/v1/events?month=2026-10",
            headers=self.headers("super"),
        ).json()["events"]
        self.assertTrue(any(event["id"] == institutional_id for event in super_events))
        self.assertTrue(any(event["id"] == other_teacher_id for event in super_events))
        self.assertFalse(any(event["id"] == personal_id for event in super_events))

        teacher_events = self.client.get(
            "/api/v1/events?month=2026-10",
            headers=self.headers("teacher"),
        ).json()["events"]
        self.assertTrue(any(event["id"] == institutional_id for event in teacher_events))
        self.assertTrue(any(event["id"] == teacher_id for event in teacher_events))
        self.assertFalse(any(event["id"] == other_teacher_id for event in teacher_events))

        other_student_events = self.client.get(
            "/api/v1/events?month=2026-10",
            headers=self.headers("other_student"),
        ).json()["events"]
        self.assertFalse(any(event["id"] == personal_id for event in other_student_events))

        self.assertEqual(
            self.client.put(
                f"/api/v1/events/{institutional_id}",
                headers=self.headers("teacher"),
                json={"title": "No autorizado"},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/v1/events/{institutional_id}",
                headers=self.headers("student"),
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.put(
                f"/api/v1/events/{teacher_id}",
                headers=self.headers("super"),
                json={"title": "El super no edita ajenos"},
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/v1/events/{teacher_id}",
                headers=self.headers("super"),
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.put(
                f"/api/v1/events/{personal_id}",
                headers=self.headers("student"),
                json={"title": "Recordatorio actualizado"},
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.delete(
                f"/api/v1/events/{personal_id}",
                headers=self.headers("student"),
            ).status_code,
            200,
        )

        student_events = self.client.get(
            "/api/v1/events?month=2026-10",
            headers=self.headers("student"),
        ).json()["events"]
        self.assertTrue(any(event["id"] == institutional_id for event in student_events))
        self.assertTrue(any(event["id"] == other_teacher_id for event in student_events))
        self.assertFalse(any(event["id"] == personal_id for event in student_events))


if __name__ == "__main__":
    unittest.main()
