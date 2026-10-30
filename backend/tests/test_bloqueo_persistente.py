"""
NeuroLearn IA — Bloqueo persistente de cuentas (RNF-04).

El contador en memoria no se comparte entre instancias de Vercel. Estas
pruebas vacían la memoria entre intentos (como si cada petición llegara a una
instancia nueva) y comprueban que la cuenta igual queda bloqueada 15 minutos
tras 20 fallos en 5 minutos, porque el bloqueo se calcula desde audit_logs.

Ejecutar desde backend/:

    python -m pytest tests/test_bloqueo_persistente.py -v
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import account_locked_until, get_password_hash  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.institution import AuditLog, Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"
PASSWORD = "Clave-Segura-2026"
HEADERS = {"Origin": "http://localhost:5173"}


def reset_memory():
    """Simula una instancia serverless nueva: sin contadores en memoria."""
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class PersistentLockoutTests(unittest.TestCase):
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
        inst = Institution(name="Colegio Bloqueo", dane_code="77700000091", is_active=True)
        db.add(inst)
        db.flush()
        for name in ("bloq_a", "bloq_b", "bloq_c"):
            db.add(User(username=name, email=f"{name}@colegio.edu.co", full_name=name,
                        hashed_password=get_password_hash(PASSWORD), role=UserRole.ESTUDIANTE.value,
                        institution_id=inst.id, is_active=True))
        db.commit()
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        reset_memory()

    def _login(self, username, password):
        reset_memory()
        return self.client.post(f"{API}/auth/login", json={"username": username, "password": password},
                                headers=HEADERS)

    def _user(self, db, username):
        return db.query(User).filter(User.username == username).one()

    def test_bloqueo_sobrevive_a_instancias_nuevas(self):
        limit = settings.RATE_LIMIT_MAX_REQUESTS
        for _ in range(limit - 1):
            self.assertEqual(self._login("bloq_a", "Mala-Clave-1").status_code, 401)
        # El fallo número 20 bloquea aunque la memoria esté vacía.
        r = self._login("bloq_a", "Mala-Clave-1")
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.headers.get("retry-after"), str(settings.RATE_LIMIT_LOCKOUT_SECONDS))
        # Ni la contraseña correcta entra mientras dura el bloqueo.
        self.assertEqual(self._login("bloq_a", PASSWORD).status_code, 429)

    def test_bloqueo_dura_15_minutos(self):
        db = self.Session()
        try:
            user = self._user(db, "bloq_b")
            start = datetime.utcnow() - timedelta(minutes=10)
            for i in range(settings.RATE_LIMIT_MAX_REQUESTS):
                db.add(AuditLog(action="login_failed", performed_by_id=user.id,
                                institution_id=user.institution_id, created_at=start + timedelta(seconds=i)))
            db.commit()
            locked = account_locked_until(db, user)
            self.assertIsNotNone(locked)
            self.assertIsNone(account_locked_until(db, user, now=locked + timedelta(seconds=1)))
        finally:
            db.close()
        self.assertEqual(self._login("bloq_b", PASSWORD).status_code, 429)

    def test_fallos_fuera_de_la_ventana_no_bloquean(self):
        db = self.Session()
        try:
            user = self._user(db, "bloq_c")
            start = datetime.utcnow() - timedelta(minutes=12)
            # 20 fallos repartidos en 10 minutos: nunca 20 dentro de 5 minutos.
            for i in range(settings.RATE_LIMIT_MAX_REQUESTS):
                db.add(AuditLog(action="login_failed", performed_by_id=user.id,
                                institution_id=user.institution_id, created_at=start + timedelta(seconds=30 * i)))
            db.commit()
            self.assertIsNone(account_locked_until(db, user))
        finally:
            db.close()
        self.assertEqual(self._login("bloq_c", PASSWORD).status_code, 200)


if __name__ == "__main__":
    unittest.main()
