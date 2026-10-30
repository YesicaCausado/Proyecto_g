import unittest

import tests.entorno_pruebas  # noqa: F401
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.auth import get_current_user
from app.db.database import Base, get_db
from app.main import app
from app.models.user import User


class TutorialStateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(bind=engine)
        cls.Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def db_dependency():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        db = cls.Session()
        cls.user = User(
            username="tutorial_user",
            hashed_password="not-used",
            role="profesor",
        )
        cls.other_user = User(
            username="tutorial_other_user",
            hashed_password="not-used",
            role="profesor",
        )
        db.add_all([cls.user, cls.other_user])
        db.commit()
        db.refresh(cls.user)
        db.refresh(cls.other_user)
        db.close()

        app.dependency_overrides[get_db] = db_dependency
        cls.active_user = cls.user
        app.dependency_overrides[get_current_user] = lambda: cls.active_user
        cls.client = TestClient(app, raise_server_exceptions=False)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)

    def test_tutorial_progress_is_saved_per_user(self):
        initial = self.client.get("/api/v1/tutorial/state")
        self.assertEqual(initial.status_code, 200, initial.text)
        self.assertEqual(initial.json(), {"completed": False, "role": None, "step": 0})

        saved = self.client.put(
            "/api/v1/tutorial/state",
            json={"role": "profesor", "step": 4},
        )
        self.assertEqual(saved.status_code, 200, saved.text)
        self.assertEqual(saved.json(), {"completed": False, "role": "profesor", "step": 4})

        self.__class__.active_user = self.other_user
        other_user_state = self.client.get("/api/v1/tutorial/state")
        self.assertEqual(other_user_state.json(), {"completed": False, "role": None, "step": 0})
        self.__class__.active_user = self.user

        completed = self.client.put(
            "/api/v1/tutorial/state",
            json={"role": "profesor", "step": 0, "completed": True},
        )
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertTrue(completed.json()["completed"])
        self.assertEqual(self.client.get("/api/v1/tutorial/state").json()["step"], 0)

    def test_tutorial_cannot_save_a_different_role(self):
        response = self.client.put(
            "/api/v1/tutorial/state",
            json={"role": "admin", "step": 1},
        )
        self.assertEqual(response.status_code, 400, response.text)

    def test_tutorial_step_is_bounded(self):
        response = self.client.put(
            "/api/v1/tutorial/state",
            json={"role": "profesor", "step": 51},
        )
        self.assertEqual(response.status_code, 422, response.text)
