"""
NeuroLearn IA — Tiempo de respuesta y capacidad de crecimiento (RNF-12, RNF-13).

Prueba reproducible que se ejecuta en cada push (CI). Condiciones:

  - Backend en proceso (TestClient), SQLite en memoria, sin proveedores de IA
    ni correo reales: mide el tiempo del propio backend, sin red ni latencia de
    Supabase. Las respuestas del tutor de IA dependen de Groq/Gemini y quedan
    fuera (tienen su propio límite de tiempo y respaldo local).
  - Datos: 3 instituciones al empezar y 30 tras el crecimiento, cada una con
    1 Súper Profesor, 2 profesores, 2 grupos de 30 estudiantes, publicaciones,
    eventos y notificaciones.
  - Funcionalidades: inicio de sesión y las pantallas principales de los
    cuatro roles (ver ENDPOINTS). Cada una se llama una vez para calentar y
    luego MUESTRAS veces; se reporta p50/p95/máx.

Criterios:
  RNF-12  el p95 de cada funcionalidad es menor a 2,5 s.
  RNF-13  al multiplicar por 10 las instituciones, el p95 sigue bajo 2,5 s y
          cada pantalla hace el MISMO número de consultas a la BD (no depende
          del tamaño de la plataforma; las listas del admin van paginadas).

    python -m pytest tests/test_rendimiento_respuesta.py -v -s   (-s muestra el reporte)

Para carga concurrente contra un servidor real (local o Vercel) use
scripts/prueba_carga.py (ver docs/PRUEBAS.md).
"""
from __future__ import annotations

import os
import sys
import time
import unittest
from datetime import datetime, timedelta
from statistics import median

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token, get_password_hash  # noqa: E402
from app.core.security import failed_login_tracker, rate_limiter  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.events import ClassroomEvent  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.posts import Post  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import notification_service  # noqa: E402

API = "/api/v1"
LIMIT_SECONDS = 2.5
MUESTRAS = 8
PASSWORD = "Clave-Segura-2026"
STUDENTS_PER_CLASS = 30

ENDPOINTS = {
    "estudiante": [
        "/auth/me", "/classrooms/my-enrolled", "/stats/dashboard", "/stats/performance",
        "/notifications", "/events", "/posts", "/student/evaluations", "/student/materials",
        "/student/diagnostic", "/bots/assigned-to-me", "/chat/quiz-history", "/messages/conversations",
    ],
    "profesor": [
        "/classrooms/my-classes", "/teacher/stats", "/teacher/evaluations", "/teacher/materials",
        "/messages/contacts", "/bots/my-bots",
    ],
    "super": [
        "/super/stats/dashboard", "/super/teachers", "/super/students", "/super/classrooms",
        "/super/reports/overview", "/super/audit", "/super/bots",
    ],
    "admin": ["/admin/stats", "/admin/institutions", "/admin/users", "/admin/config"],
}


def _reset_limits():
    for obj in (rate_limiter, failed_login_tracker):
        for attr in ("_events", "_blocked_until", "_failures"):
            store = getattr(obj, attr, None)
            if hasattr(store, "clear"):
                store.clear()


def _p95(values):
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int(round(0.95 * (len(ordered) - 1))))]


class ResponseTimeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(bind=cls.engine, autoflush=False, autocommit=False)

        def _get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        cls.client = TestClient(app, raise_server_exceptions=False)
        cls.hashed = get_password_hash(PASSWORD)
        cls.institutions = 0
        cls.users = cls._seed(3)
        db = cls.Session()
        admin = User(username="admin_perf", email="admin_perf@x.co", full_name="Admin",
                     hashed_password=cls.hashed, role=UserRole.ADMIN.value, is_active=True)
        db.add(admin)
        db.commit()
        cls.users["admin"] = admin.username
        db.close()
        cls.headers = {role: {"Authorization": "Bearer " + create_access_token({"sub": username})}
                       for role, username in cls.users.items()}

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        _reset_limits()

    @classmethod
    def _seed(cls, count):
        """Agrega `count` instituciones completas; devuelve los usuarios de la primera."""
        db = cls.Session()
        first = None
        now = datetime.utcnow()
        for _ in range(count):
            cls.institutions += 1
            n = cls.institutions
            inst = Institution(name=f"Colegio {n}", dane_code=f"{880000000000 + n}", is_active=True)
            db.add(inst)
            db.flush()

            def user(name, role):
                u = User(username=f"{name}_{n}", email=f"{name}_{n}@x.co", full_name=f"{name} {n}",
                         hashed_password=cls.hashed, role=role, institution_id=inst.id, is_active=True)
                db.add(u)
                return u

            sup = user("super", UserRole.SUPER_PROFESOR.value)
            teachers = [user(f"profe{i}", UserRole.PROFESOR.value) for i in range(2)]
            db.flush()
            students = []
            for c, teacher in enumerate(teachers):
                room = Classroom(name=f"11{c}", subject="Matemáticas", grade="11", teacher_id=teacher.id,
                                 invite_code=f"P{n:04d}{c}", is_active=True)
                db.add(room)
                db.flush()
                for s in range(STUDENTS_PER_CLASS):
                    st = user(f"est{c}_{s}", UserRole.ESTUDIANTE.value)
                    db.flush()
                    students.append(st)
                    db.add(Enrollment(student_id=st.id, classroom_id=room.id, is_active=True))
                for p in range(5):
                    db.add(Post(classroom_id=room.id, teacher_id=teacher.id, title=f"Anuncio {p}",
                                content="Contenido"))
                    db.add(ClassroomEvent(classroom_id=room.id, teacher_id=teacher.id, institution_id=inst.id,
                                          title=f"Evento {p}",
                                          event_date=(now + timedelta(days=p)).strftime("%Y-%m-%d")))
            db.commit()
            for st in students[:10]:
                notification_service.notify(db, [st.id], "evaluacion_publicada", "Aviso", "Mensaje de prueba")
            db.commit()
            if first is None:
                first = {"estudiante": students[0].username, "profesor": teachers[0].username,
                         "super": sup.username}
        db.close()
        return first

    def _count_queries(self, path, headers):
        counter = {"n": 0}

        def before(*_a, **_k):
            counter["n"] += 1

        event.listen(self.engine, "before_cursor_execute", before)
        try:
            r = self.client.get(API + path, headers=headers)
        finally:
            event.remove(self.engine, "before_cursor_execute", before)
        return r, counter["n"]

    def _measure(self):
        """{funcionalidad: (p50, p95, máx, consultas)} con los datos actuales."""
        results = {}
        for role, paths in ENDPOINTS.items():
            for path in paths:
                r, queries = self._count_queries(path, self.headers[role])  # calentamiento
                self.assertEqual(r.status_code, 200, f"{role} {path}: {r.status_code} {r.text[:200]}")
                times = []
                for _ in range(MUESTRAS):
                    t0 = time.perf_counter()
                    r = self.client.get(API + path, headers=self.headers[role])
                    times.append(time.perf_counter() - t0)
                    self.assertEqual(r.status_code, 200, f"{role} {path}")
                results[f"{role} GET {path}"] = (median(times), _p95(times), max(times), queries)

        times = []
        for _ in range(MUESTRAS):
            _reset_limits()
            t0 = time.perf_counter()
            r = self.client.post(f"{API}/auth/login", headers={"Origin": "http://localhost:5173"},
                                 json={"username": self.users["estudiante"], "password": PASSWORD})
            times.append(time.perf_counter() - t0)
            self.assertEqual(r.status_code, 200, r.text)
        results["estudiante POST /auth/login"] = (median(times), _p95(times), max(times), None)
        return results

    @staticmethod
    def _report(title, results):
        print(f"\n{title}")
        print(f"{'Funcionalidad':55} {'p50 ms':>8} {'p95 ms':>8} {'máx ms':>8} {'consultas':>9}")
        for name, (p50, p95, worst, queries) in results.items():
            print(f"{name:55} {p50 * 1000:8.1f} {p95 * 1000:8.1f} {worst * 1000:8.1f} "
                  f"{'' if queries is None else queries:>9}")

    def _assert_under_limit(self, results):
        slow = {k: round(v[1], 3) for k, v in results.items() if v[1] >= LIMIT_SECONDS}
        self.assertFalse(slow, f"p95 ≥ {LIMIT_SECONDS} s: {slow}")

    def test_tiempo_de_respuesta_y_crecimiento(self):
        before = self._measure()
        self._report(f"RNF-12 · {self.institutions} instituciones", before)
        self._assert_under_limit(before)

        self._seed(27)
        after = self._measure()
        self._report(f"RNF-13 · {self.institutions} instituciones", after)
        self._assert_under_limit(after)

        grew = {
            name: (before[name][3], after[name][3])
            for name in before
            if before[name][3] is not None and after[name][3] != before[name][3]
        }
        self.assertFalse(grew, f"Consultas que crecen con el número de instituciones: {grew}")


if __name__ == "__main__":
    unittest.main()
