"""
NeuroLearn IA — NeuroBots base de las cinco competencias (RF-74).

El Administrador consulta los tutores base (uno por competencia) con sus
temas preentrenados y su uso real; nadie más puede verlos por esta ruta.

Ejecutar desde backend/:

    python -m pytest tests/test_bots_base_admin.py -v
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.learning import LearningSession  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services.competencies import COMP_KEYS  # noqa: E402

URL = "/api/v1/admin/bots/base"


class BaseBotsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        cls.Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def _get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        cls.client = TestClient(app, raise_server_exceptions=False)

        db = cls.Session()
        inst = Institution(name="Colegio Base", dane_code="77700000092", is_active=True)
        db.add(inst)
        db.flush()
        admin = User(username="admin_base", email="admin_base@x.co", full_name="Admin",
                     hashed_password="x", role=UserRole.ADMIN.value, is_active=True)
        st1 = User(username="est_base1", email="e1@x.co", full_name="E1", hashed_password="x",
                   role=UserRole.ESTUDIANTE.value, institution_id=inst.id, is_active=True)
        st2 = User(username="est_base2", email="e2@x.co", full_name="E2", hashed_password="x",
                   role=UserRole.ESTUDIANTE.value, institution_id=inst.id, is_active=True)
        db.add_all([admin, st1, st2])
        db.flush()
        db.add_all([
            LearningSession(user_id=st1.id, topic="Razonamiento cuantitativo y matemáticas para Saber 11"),
            LearningSession(user_id=st1.id, topic="Razonamiento cuantitativo y matemáticas para Saber 11"),
            LearningSession(user_id=st2.id, topic="Matemáticas"),
            LearningSession(user_id=st2.id, topic="Inglés Comunicativo"),
        ])
        db.commit()
        cls.h_admin = {"Authorization": "Bearer " + create_access_token({"sub": admin.username})}
        cls.h_student = {"Authorization": "Bearer " + create_access_token({"sub": st1.username})}
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def test_cinco_bots_base_con_uso_real(self):
        r = self.client.get(URL, headers=self.h_admin)
        self.assertEqual(r.status_code, 200, r.text)
        bots = {b["key"]: b for b in r.json()["bots"]}
        self.assertEqual(list(bots), list(COMP_KEYS))
        mat = bots["matematicas"]
        self.assertTrue(mat["is_base"])
        self.assertTrue(mat["topics"])
        self.assertEqual(mat["diagnostic_questions"], 10)
        self.assertEqual(mat["total_sessions"], 3)
        self.assertEqual(mat["total_students"], 2)
        self.assertEqual(bots["ingles"]["total_sessions"], 1)
        self.assertEqual(bots["cientifico"]["total_sessions"], 0)
        self.assertIsNone(bots["cientifico"]["last_activity_at"])

    def test_solo_administrador(self):
        self.assertEqual(self.client.get(URL, headers=self.h_student).status_code, 403)
        self.assertEqual(self.client.get(URL).status_code, 401)


if __name__ == "__main__":
    unittest.main()
