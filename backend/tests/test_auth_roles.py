"""
NeuroLearn IA — Autenticación, roles, permisos y aislamiento por institución.

Reemplaza las pruebas de humo manuales (scripts de login, recorridos por rol
y _audit_live_tests.ps1) por pruebas automáticas que verifican comportamiento
real contra la app (FastAPI + SQLite en memoria):

  - Login correcto e incorrecto de los 4 roles, usuario desactivado,
    institución desactivada, bloqueo por intentos fallidos.
  - Token: ausente, alterado, firmado con otra clave, vencido, usuario borrado.
  - Matriz de permisos por endpoint y rol.
  - Aislamiento: nadie lee ni modifica datos de otra institución.
  - Recuperación de contraseña de punta a punta (correo capturado).

Ejecutar desde backend/:

    python -m pytest tests/test_auth_roles.py -v
    # o sin pytest:
    python -m unittest tests.test_auth_roles -v
"""
from __future__ import annotations

import os
import re
import sys
import unittest
from datetime import timedelta
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from jose import jwt  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import auth as auth_api  # noqa: E402
from app.api.auth import create_access_token, get_password_hash  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"
PASSWORD = "Clave-Segura-2026"


def reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


class CapturingEmailSender:
    """Doble del servicio de correo: guarda los mensajes en memoria."""

    def __init__(self):
        self.messages = []

    def send(self, message):
        self.messages.append(message)
        return f"prueba-{len(self.messages)}"


class AuthRolesTests(unittest.TestCase):
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
        inst_a = Institution(name="Colegio A", dane_code="77700000001", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="77700000002", is_active=True)
        inst_off = Institution(name="Colegio Inactivo", dane_code="77700000003", is_active=False)
        db.add_all([inst_a, inst_b, inst_off])
        db.flush()
        hashed = get_password_hash(PASSWORD)

        def user(key, role, inst, **extra):
            u = User(username=key, email=f"{key}@colegio.edu.co", full_name=key.replace("_", " ").title(),
                     hashed_password=hashed, role=role, institution_id=inst.id if inst else None,
                     is_active=extra.pop("is_active", True), **extra)
            db.add(u)
            return u

        users = {
            "admin": user("admin_t", UserRole.ADMIN.value, None),
            "super": user("super_a", UserRole.SUPER_PROFESOR.value, inst_a),
            "profe": user("profe_a", UserRole.PROFESOR.value, inst_a),
            "estudiante": user("est_a", UserRole.ESTUDIANTE.value, inst_a),
            "super_b": user("super_b", UserRole.SUPER_PROFESOR.value, inst_b),
            "profe_b": user("profe_b", UserRole.PROFESOR.value, inst_b),
            "estudiante_b": user("est_b", UserRole.ESTUDIANTE.value, inst_b),
            "desactivado": user("est_off", UserRole.ESTUDIANTE.value, inst_a, is_active=False),
            "inst_inactiva": user("profe_off", UserRole.PROFESOR.value, inst_off),
            "temporal": user("est_tmp", UserRole.ESTUDIANTE.value, inst_a, must_change_password=True),
        }
        db.flush()
        classroom_a = Classroom(name="9A", subject="Mat", grade="9", teacher_id=users["profe"].id,
                                invite_code="AUTH9A", is_active=True)
        db.add(classroom_a)
        db.flush()
        db.add(Enrollment(student_id=users["estudiante"].id, classroom_id=classroom_a.id, is_active=True))
        private_bot = ExpertBot(creator_id=users["profe"].id, name="Bot privado A", is_public=False, is_active=True)
        public_bot = ExpertBot(creator_id=users["profe"].id, name="Bot público A", is_public=True, is_active=True)
        db.add_all([private_bot, public_bot])
        db.commit()
        cls.ids = {k: u.id for k, u in users.items()}
        cls.usernames = {k: u.username for k, u in users.items()}
        cls.classroom_a = classroom_a.id
        cls.private_bot, cls.public_bot = private_bot.id, public_bot.id
        db.close()
        cls.tokens = {}

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    # ── helpers ──
    def login(self, key, password=PASSWORD):
        reset_limits()
        return self.client.post(f"{API}/auth/login",
                                json={"username": self.usernames.get(key, key), "password": password})

    def headers(self, key):
        if key not in self.tokens:
            r = self.login(key)
            self.assertEqual(r.status_code, 200, r.text)
            self.tokens[key] = r.json()["access_token"]
        return {"Authorization": f"Bearer {self.tokens[key]}"}

    # ── Login ────────────────────────────────────────────────────────────────
    def test_login_success_each_role(self):
        for key, role in (("admin", "admin"), ("super", "super_profesor"),
                          ("profe", "profesor"), ("estudiante", "estudiante")):
            with self.subTest(role=role):
                r = self.login(key)
                self.assertEqual(r.status_code, 200, r.text)
                body = r.json()
                self.assertEqual(body["role"], role)
                self.assertEqual(body["user_id"], self.ids[key])
                claims = jwt.decode(body["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
                self.assertEqual(claims["sub"], self.usernames[key])
                me = self.client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
                self.assertEqual(me.status_code, 200)
                self.assertEqual(me.json()["username"], self.usernames[key])

    def test_login_failures(self):
        wrong = self.login("profe", "otra-clave")
        unknown = self.login("no_existe")
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(unknown.status_code, 401)
        # Mismo mensaje: no revela si el usuario existe.
        self.assertEqual(wrong.json()["detail"], unknown.json()["detail"])
        self.assertEqual(self.login("desactivado").status_code, 403)
        r = self.login("inst_inactiva")
        self.assertEqual(r.status_code, 403)
        self.assertIn("institución está desactivada", r.json()["detail"])
        self.assertTrue(self.login("temporal").json()["must_change_password"])

    def test_brute_force_lockout(self):
        reset_limits()
        username = self.usernames["estudiante"]
        statuses = [
            self.client.post(f"{API}/auth/login", json={"username": username, "password": "mala"}).status_code
            for _ in range(settings.RATE_LIMIT_MAX_REQUESTS + 1)
        ]
        self.assertIn(429, statuses)
        # Bloqueado: ni siquiera la contraseña correcta entra.
        r = self.client.post(f"{API}/auth/login", json={"username": username, "password": PASSWORD})
        self.assertEqual(r.status_code, 429)
        reset_limits()

    # ── Token ────────────────────────────────────────────────────────────────
    def test_token_validation(self):
        me = f"{API}/auth/me"
        self.assertEqual(self.client.get(me).status_code, 401)
        self.assertEqual(self.client.get(me, headers={"Authorization": "Bearer basura"}).status_code, 401)
        good = self.headers("estudiante")["Authorization"].split()[1]
        tampered = good[:-3] + ("aaa" if not good.endswith("aaa") else "bbb")
        self.assertEqual(self.client.get(me, headers={"Authorization": f"Bearer {tampered}"}).status_code, 401)
        foreign = jwt.encode({"sub": self.usernames["admin"]}, "otra-clave-secreta", algorithm="HS256")
        self.assertEqual(self.client.get(me, headers={"Authorization": f"Bearer {foreign}"}).status_code, 401)
        expired = create_access_token({"sub": self.usernames["admin"]}, expires_delta=timedelta(minutes=-1))
        self.assertEqual(self.client.get(me, headers={"Authorization": f"Bearer {expired}"}).status_code, 401)
        ghost = create_access_token({"sub": "usuario_borrado"})
        self.assertEqual(self.client.get(me, headers={"Authorization": f"Bearer {ghost}"}).status_code, 401)

    def test_token_rejected_after_deactivation(self):
        token = create_access_token({"sub": self.usernames["temporal"]})
        h = {"Authorization": f"Bearer {token}"}
        self.assertEqual(self.client.get(f"{API}/auth/me", headers=h).status_code, 200)
        db = self.Session()
        db.get(User, self.ids["temporal"]).is_active = False
        db.commit()
        db.close()
        try:
            self.assertEqual(self.client.get(f"{API}/auth/me", headers=h).status_code, 403)
        finally:
            db = self.Session()
            db.get(User, self.ids["temporal"]).is_active = True
            db.commit()
            db.close()

    # ── Permisos por rol ─────────────────────────────────────────────────────
    PERMISSIONS = [
        # (método, ruta, roles permitidos)
        ("GET", "/admin/users", {"admin"}),
        ("GET", "/admin/institutions", {"admin"}),
        ("GET", "/admin/config", {"admin"}),
        ("GET", "/super/teachers", {"super"}),            # el Admin gestiona desde /admin
        ("GET", "/super/stats/dashboard", {"admin", "super"}),
        ("GET", "/teacher/stats", {"admin", "super", "profe"}),
        ("GET", "/teacher/evaluations", {"profe"}),
        ("GET", "/classrooms/my-classes", {"profe"}),
        ("GET", "/classrooms/my-enrolled", {"estudiante"}),
        ("GET", "/student/evaluations", {"estudiante"}),
        ("GET", "/teacher/reports/export", {"super", "profe"}),
        ("GET", "/consents/me", {"admin", "super", "profe", "estudiante"}),
        ("GET", "/auth/me", {"admin", "super", "profe", "estudiante"}),
    ]

    def test_permission_matrix(self):
        for method, path, allowed in self.PERMISSIONS:
            for role in ("admin", "super", "profe", "estudiante"):
                with self.subTest(path=path, role=role):
                    r = self.client.request(method, f"{API}{path}", headers=self.headers(role))
                    if role in allowed:
                        self.assertNotIn(r.status_code, (401, 403), f"{role} debería acceder: {r.text[:200]}")
                    else:
                        self.assertEqual(r.status_code, 403, f"{role} no debería acceder: {r.status_code}")

    def test_ai_generation_only_for_teachers_and_admin(self):
        body = {"kind": "preguntas", "topic": "Fracciones", "count": 3}
        with mock.patch.object(auth_api.settings, "GROQ_API_KEY", ""):
            for role in ("super", "estudiante"):
                r = self.client.post(f"{API}/teacher/ai/generate", headers=self.headers(role), json=body)
                self.assertEqual(r.status_code, 403, role)

    def test_unauthenticated_requests_rejected(self):
        for method, path, _ in self.PERMISSIONS:
            with self.subTest(path=path):
                self.assertEqual(self.client.request(method, f"{API}{path}").status_code, 401)

    # ── Aislamiento por institución ──────────────────────────────────────────
    def test_institution_isolation(self):
        teachers_b = self.client.get(f"{API}/super/teachers", headers=self.headers("super_b")).json()
        usernames_b = {t.get("username") for t in (teachers_b if isinstance(teachers_b, list) else teachers_b.get("teachers", []))}
        self.assertNotIn(self.usernames["profe"], usernames_b)

        students_a = self.client.get(f"{API}/super/students", headers=self.headers("super")).json()
        usernames_a = {s.get("username") for s in (students_a if isinstance(students_a, list) else students_a.get("students", []))}
        self.assertIn(self.usernames["estudiante"], usernames_a)
        self.assertNotIn(self.usernames["estudiante_b"], usernames_a)

        # Profesor de otra institución no ve los estudiantes del aula ajena
        r = self.client.get(f"{API}/classrooms/{self.classroom_a}/students", headers=self.headers("profe_b"))
        self.assertIn(r.status_code, (403, 404))
        # Súper profesor B no puede modificar a un profesor de A
        r = self.client.put(f"{API}/super/teachers/{self.ids['profe']}", headers=self.headers("super_b"),
                            json={"full_name": "Hackeado"})
        self.assertIn(r.status_code, (403, 404))
        # Bots: privado ajeno inaccesible; público de otra institución invisible
        r = self.client.get(f"{API}/bots/{self.private_bot}", headers=self.headers("profe_b"))
        self.assertEqual(r.status_code, 403)
        shared = self.client.get(f"{API}/bots/shared-with-me", headers=self.headers("estudiante_b")).json()
        self.assertNotIn(self.public_bot, {b["id"] for b in shared["bots"]})
        shared_a = self.client.get(f"{API}/bots/shared-with-me", headers=self.headers("estudiante")).json()
        self.assertIn(self.public_bot, {b["id"] for b in shared_a["bots"]})
        # Reportes: el grupo de otra institución no existe para el profesor B
        r = self.client.get(f"{API}/teacher/reports/export", headers=self.headers("profe_b"),
                            params={"classroom_id": self.classroom_a})
        self.assertEqual(r.status_code, 404)

    def test_admin_sees_all_institutions(self):
        r = self.client.get(f"{API}/admin/institutions", headers=self.headers("admin"))
        self.assertEqual(r.status_code, 200)
        body = r.json()
        items = body if isinstance(body, list) else body.get("institutions", [])
        names = {i["name"] for i in items}
        self.assertTrue({"Colegio A", "Colegio B"} <= names)

    # ── Recuperación de contraseña ───────────────────────────────────────────
    def test_password_recovery_end_to_end(self):
        sender = CapturingEmailSender()
        key = "profe"
        new_password = "Nueva#Clave2026x"
        with mock.patch.object(auth_api, "get_email_sender", return_value=sender), \
                mock.patch.object(settings, "PASSWORD_RESET_MIN_RESPONSE_SECONDS", 0):
            reset_limits()
            r = self.client.post(f"{API}/auth/forgot-password", json={"username": self.usernames[key]})
            self.assertEqual(r.status_code, 200, r.text)
            generic = r.json()
            # Usuario inexistente: misma respuesta y ningún correo
            reset_limits()
            r2 = self.client.post(f"{API}/auth/forgot-password", json={"username": "no_existe"})
            self.assertEqual(r2.status_code, 200)
            self.assertEqual(r2.json(), generic)
            self.assertEqual(len(sender.messages), 1)

            msg = sender.messages[0]
            body = " ".join(str(getattr(msg, attr, "")) for attr in ("text", "html", "text_body", "html_body"))
            match = re.search(r"token=([A-Za-z0-9_\-]+)", body)
            self.assertIsNotNone(match, "el correo debe traer el enlace con el token")
            token = match.group(1)

            reset_limits()
            self.assertEqual(self.client.post(f"{API}/auth/reset-password/validate",
                                              json={"token": token}).status_code, 200)
            reset_limits()
            self.assertEqual(self.client.post(f"{API}/auth/reset-password/validate",
                                              json={"token": "token-falso"}).status_code, 400)
            reset_limits()
            r = self.client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": new_password})
            self.assertEqual(r.status_code, 200, r.text)
            # El token es de un solo uso
            reset_limits()
            r = self.client.post(f"{API}/auth/reset-password", json={"token": token, "new_password": "Otra#Clave2026y"})
            self.assertEqual(r.status_code, 400)

        self.assertEqual(self.login(key, PASSWORD).status_code, 401)        # la anterior ya no sirve
        self.assertEqual(self.login(key, new_password).status_code, 200)
        # Restaurar para las demás pruebas
        db = self.Session()
        db.get(User, self.ids[key]).hashed_password = get_password_hash(PASSWORD)
        db.commit()
        db.close()
        self.tokens.pop(key, None)


if __name__ == "__main__":
    unittest.main(verbosity=2)
