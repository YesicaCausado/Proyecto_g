"""
NeuroLearn IA — Nombre real de la institución del usuario (parche 7).

/auth/login y /auth/me devuelven `institution_name` con el nombre real de la
institución para Súper Profesor, Profesor y Estudiante, y null para el
Administrador (no pertenece a ninguna institución). El frontend lo muestra
en los encabezados y en Mi Perfil (frontend/src/utils/institution.ts).

Ejecutar desde backend/:

    python -m pytest tests/test_institucion_usuario.py -v
    # o sin pytest:
    python -m unittest tests.test_institucion_usuario -v
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

from app.api.auth import get_password_hash  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

PASSWORD = "Clave-Segura-2026"


def reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class InstitutionNameTests(unittest.TestCase):
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
        inst = Institution(name="Institución Educativa San José", dane_code="66600000001", is_active=True)
        db.add(inst)
        db.flush()
        hashed = get_password_hash(PASSWORD)
        for username, role, inst_id in (
            ("admin_inst", UserRole.ADMIN.value, None),
            ("super_inst", UserRole.SUPER_PROFESOR.value, inst.id),
            ("profe_inst", UserRole.PROFESOR.value, inst.id),
            ("est_inst", UserRole.ESTUDIANTE.value, inst.id),
            ("est_sin_inst", UserRole.ESTUDIANTE.value, None),
        ):
            db.add(User(username=username, email=f"{username}@test.edu.co", full_name=username,
                        hashed_password=hashed, role=role, institution_id=inst_id, is_active=True))
        db.commit()
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def login(self, username):
        reset_limits()
        r = self.client.post("/api/v1/auth/login", json={"username": username, "password": PASSWORD})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def test_each_role_gets_real_institution_name(self):
        expected = {
            "super_inst": "Institución Educativa San José",
            "profe_inst": "Institución Educativa San José",
            "est_inst": "Institución Educativa San José",
            "admin_inst": None,          # Administración global
            "est_sin_inst": None,        # sin institución asignada (estado real)
        }
        for username, name in expected.items():
            with self.subTest(username=username):
                token = self.login(username)
                self.assertEqual(token["institution_name"], name)
                me = self.client.get("/api/v1/auth/me",
                                     headers={"Authorization": f"Bearer {token['access_token']}"})
                self.assertEqual(me.status_code, 200, me.text)
                self.assertEqual(me.json()["institution_name"], name)

    def test_renamed_institution_is_reflected(self):
        db = self.Session()
        inst = db.query(Institution).filter_by(dane_code="66600000001").first()
        inst.name = "IE San José — Sede Norte"
        db.commit()
        db.close()
        token = self.login("profe_inst")
        me = self.client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token['access_token']}"})
        self.assertEqual(me.json()["institution_name"], "IE San José — Sede Norte")


if __name__ == "__main__":
    unittest.main(verbosity=2)
