"""
NeuroLearn IA — Alta del Administrador global (backend/scripts/crear_admin.py).

Reemplaza a reset_demo_passwords.py (contraseñas publicadas en el repositorio).
Comprueba que el Administrador creado por el script inicia sesión y puede
crear instituciones, que la contraseña cumple la política del sistema, que
no se pisan cuentas existentes ni se cambia el rol de nadie, y que el script
nunca imprime la contraseña.

Ejecutar desde backend/:

    python -m pytest tests/test_crear_admin.py -v
"""
from __future__ import annotations

import io
import os
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from scripts import crear_admin  # noqa: E402

API = "/api/v1"
CLAVE = "Admin-Segura-2026"


def reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class CrearAdminTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)

        def _get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        self.client = TestClient(app, raise_server_exceptions=False)
        reset_limits()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def crear(self, **kw):
        datos = dict(usuario="admin.neurolearn", password=CLAVE, correo="Admin@Colegio.edu.co",
                     nombre="Administración NeuroLearn")
        datos.update(kw)
        db = self.Session()
        try:
            return crear_admin.crear_o_restablecer_admin(db, **datos)
        finally:
            db.close()

    def login(self, usuario, clave):
        reset_limits()
        return self.client.post(f"{API}/auth/login", json={"username": usuario, "password": clave})

    def test_created_admin_logs_in_and_manages_institutions(self):
        admin, accion = self.crear()
        self.assertEqual(accion, "creado")
        db = self.Session()
        fila = db.query(User).filter_by(username="admin.neurolearn").one()
        self.assertEqual(fila.role, UserRole.ADMIN.value)
        self.assertIsNone(fila.institution_id)
        self.assertEqual(fila.email, "admin@colegio.edu.co")
        self.assertNotEqual(fila.hashed_password, CLAVE)
        self.assertFalse(fila.must_change_password)
        db.close()

        r = self.login("admin.neurolearn", CLAVE)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["role"], "admin")
        h = {"Authorization": f"Bearer {r.json()['access_token']}"}
        r = self.client.post(f"{API}/admin/institutions", headers=h, json={
            "name": "Colegio Inicial", "dane_code": "99900000001",
            "sp_full_name": "Rectora Inicial", "sp_document_type": "CC",
            "sp_document_number": "9100001", "sp_email": "rectora@inicial.edu.co",
        })
        self.assertIn(r.status_code, (200, 201), r.text)

    def test_weak_or_invalid_data_is_rejected_without_changes(self):
        casos = [
            dict(password="admin1234"),             # sin mayúscula ni carácter especial
            dict(password="Corta-1"),               # menos de 8 caracteres
            dict(usuario="a b"),                    # usuario inválido
            dict(correo="sin-arroba"),
            dict(nombre="  "),
        ]
        for kw in casos:
            with self.subTest(**kw):
                with self.assertRaises(crear_admin.AdminError):
                    self.crear(**kw)
        db = self.Session()
        self.assertEqual(db.query(User).count(), 0)
        db.close()

    def test_existing_accounts_are_protected(self):
        self.crear()
        # Repetir sin --restablecer no toca la cuenta.
        with self.assertRaises(crear_admin.AdminError):
            self.crear(password="Otra-Clave-2026")
        self.assertEqual(self.login("admin.neurolearn", CLAVE).status_code, 200)
        # No se puede convertir en Administrador una cuenta de otro rol.
        db = self.Session()
        db.add(User(username="profe1", email="profe1@colegio.edu.co", full_name="Profe",
                    hashed_password="x", role=UserRole.PROFESOR.value, is_active=True))
        db.commit()
        db.close()
        with self.assertRaises(crear_admin.AdminError):
            self.crear(usuario="profe1", restablecer=True)
        db = self.Session()
        self.assertEqual(db.query(User).filter_by(username="profe1").one().role, UserRole.PROFESOR.value)
        db.close()
        # Ni reutilizar el correo de otro usuario.
        with self.assertRaises(crear_admin.AdminError):
            self.crear(usuario="otro.admin", correo="profe1@colegio.edu.co")

    def test_reset_changes_password_and_reactivates(self):
        self.crear()
        db = self.Session()
        db.query(User).filter_by(username="admin.neurolearn").one().is_active = False
        db.commit()
        db.close()
        _, accion = self.crear(password="Nueva-Clave-2026", restablecer=True)
        self.assertEqual(accion, "restablecido")
        self.assertEqual(self.login("admin.neurolearn", CLAVE).status_code, 401)
        self.assertEqual(self.login("admin.neurolearn", "Nueva-Clave-2026").status_code, 200)
        with self.assertRaises(crear_admin.AdminError):
            self.crear(usuario="no.existe", restablecer=True)

    def test_cli_never_prints_the_password(self):
        import app.db.database as database
        salida, errores = io.StringIO(), io.StringIO()
        with mock.patch.object(database, "SessionLocal", self.Session), \
                mock.patch.object(database, "engine", self.engine), \
                mock.patch.dict(os.environ, {crear_admin.PASSWORD_ENV: CLAVE}), \
                redirect_stdout(salida), redirect_stderr(errores):
            codigo = crear_admin.main(["--usuario", "admin.cli", "--correo", "cli@colegio.edu.co",
                                       "--nombre", "Admin CLI"])
        self.assertEqual(codigo, 0, errores.getvalue())
        self.assertIn("admin.cli", salida.getvalue())
        self.assertNotIn(CLAVE, salida.getvalue() + errores.getvalue())
        self.assertEqual(self.login("admin.cli", CLAVE).status_code, 200)


if __name__ == "__main__":
    unittest.main(verbosity=2)
