"""
NeuroLearn IA — Pruebas del diagnóstico inicial (RF-13).

Casos: banco de 10 preguntas por competencia, las preguntas no exponen la
respuesta, calificación ponderada y niveles, validación del envío, una sola
presentación por competencia, solo estudiantes, y vista del profesor limitada
a sus aulas. SQLite en memoria.

Ejecutar desde backend/:

    python -m pytest tests/test_diagnostico_inicial.py -v
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api import student_diagnostic as diag_api  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import diagnostic_service as svc  # noqa: E402
from app.services.competencies import COMP_KEYS  # noqa: E402
from app.services.diagnostic_bank import BANK, QUESTIONS_PER_COMPETENCY  # noqa: E402


def _answers(key: str, correct: bool = True) -> dict:
    return {q["id"]: (q["correct"] if correct else (q["correct"] + 1) % 4) for q in BANK[key]}


class DiagnosticBankTests(unittest.TestCase):
    def test_diez_preguntas_por_competencia(self):
        self.assertEqual(set(BANK), set(COMP_KEYS))
        ids = set()
        for key, questions in BANK.items():
            self.assertEqual(len(questions), QUESTIONS_PER_COMPETENCY, key)
            levels = [q["difficulty"] for q in questions]
            self.assertEqual((levels.count("basico"), levels.count("intermedio"), levels.count("avanzado")),
                             (4, 3, 3), key)
            for q in questions:
                self.assertEqual(len(q["options"]), 4, q["id"])
                self.assertIn(q["correct"], range(4), q["id"])
                self.assertTrue(q["explanation"], q["id"])
                ids.add(q["id"])
        self.assertEqual(len(ids), 5 * QUESTIONS_PER_COMPETENCY, "ids repetidos")

    def test_niveles(self):
        self.assertEqual(svc.level_for(0), 1)
        self.assertEqual(svc.level_for(39.9), 1)
        self.assertEqual(svc.level_for(40), 2)
        self.assertEqual(svc.level_for(60), 3)
        self.assertEqual(svc.level_for(80), 4)
        self.assertEqual(svc.grade("matematicas", _answers("matematicas"))["level"], 4)
        self.assertEqual(svc.grade("matematicas", {})["score"], 0)

    def test_solo_basicas_no_da_nivel_avanzado(self):
        answers = {q["id"]: q["correct"] for q in BANK["ingles"] if q["difficulty"] == "basico"}
        graded = svc.grade("ingles", answers)
        self.assertEqual(graded["correct_count"], 4)
        self.assertEqual(graded["level"], 1)  # 4/19 ≈ 21 %


class DiagnosticApiTests(unittest.TestCase):
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
        db = cls.Session()
        inst = Institution(name="Colegio D", dane_code="44400000002", is_active=True)
        db.add(inst)
        db.flush()

        def user(username, role):
            u = User(username=username, email=f"{username}@test.edu.co", full_name=username.title(),
                     hashed_password="x", role=role, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            return u

        student = user("est_diag", UserRole.ESTUDIANTE.value)
        teacher = user("prof_diag", UserRole.PROFESOR.value)
        other_teacher = user("prof_otro", UserRole.PROFESOR.value)
        classroom = Classroom(name="11A", subject="Matemáticas", teacher_id=teacher.id,
                              invite_code="DIAG0001")
        db.add(classroom)
        db.flush()
        db.add(Enrollment(student_id=student.id, classroom_id=classroom.id, is_active=True))
        db.commit()
        cls.classroom_id = classroom.id

        def headers(u):
            return {"Authorization": "Bearer " + create_access_token({"sub": u.username})}

        cls.h_student, cls.h_teacher, cls.h_other = headers(student), headers(teacher), headers(other_teacher)
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def test_flujo_completo(self):
        status = self.client.get("/api/v1/student/diagnostic", headers=self.h_student).json()
        self.assertEqual(status["total"], 5)
        self.assertFalse(next(c for c in status["competencies"] if c["key"] == "lectora")["completed"])

        detail = self.client.get("/api/v1/student/diagnostic/lectora", headers=self.h_student).json()
        self.assertFalse(detail["completed"])
        self.assertEqual(len(detail["questions"]), 10)
        for q in detail["questions"]:
            self.assertNotIn("correct", q)
            self.assertNotIn("explanation", q)

        # Incompleto → 400
        partial = dict(list(_answers("lectora").items())[:9])
        r = self.client.post("/api/v1/student/diagnostic/lectora", headers=self.h_student, json={"answers": partial})
        self.assertEqual(r.status_code, 400)
        # Opción fuera de rango → 400
        bad = {**_answers("lectora"), "lec-01": 7}
        r = self.client.post("/api/v1/student/diagnostic/lectora", headers=self.h_student, json={"answers": bad})
        self.assertEqual(r.status_code, 400)

        r = self.client.post("/api/v1/student/diagnostic/lectora", headers=self.h_student,
                             json={"answers": _answers("lectora", correct=False), "duration_seconds": 300})
        self.assertEqual(r.status_code, 201, r.text)
        body = r.json()
        self.assertEqual(body["result"]["level"], 1)
        self.assertEqual(body["result"]["correct_count"], 0)
        self.assertEqual(len(body["review"]), 10)
        self.assertTrue(body["result"]["weak_topics"])
        # Sin IA configurada, el tutor evalúa con los datos calificados (local).
        self.assertEqual(body["result"]["feedback_provider"], "local")
        self.assertIn("0 de 10 correctas", body["result"]["tutor_feedback"])

        # Segunda vez → 409
        r = self.client.post("/api/v1/student/diagnostic/lectora", headers=self.h_student,
                             json={"answers": _answers("lectora")})
        self.assertEqual(r.status_code, 409)

        detail = self.client.get("/api/v1/student/diagnostic/lectora", headers=self.h_student).json()
        self.assertTrue(detail["completed"])
        self.assertEqual(detail["result"]["level"], 1)

    def test_tutor_de_ia_evalua_las_respuestas(self):
        calls = []

        async def groq(**kwargs):
            calls.append(kwargs)
            return {"response": "Dominas lo básico; reforzaremos los temas avanzados.", "provider": "groq"}

        with mock.patch.object(diag_api.ai_manager, "generate", groq),                 mock.patch.object(diag_api.ai_manager, "providers", ["groq"]):
            r = self.client.post("/api/v1/student/diagnostic/cientifico", headers=self.h_student,
                                 json={"answers": _answers("cientifico", correct=False)})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["result"]["feedback_provider"], "groq")
        self.assertIn("reforzaremos", r.json()["result"]["tutor_feedback"])
        # El tutor recibe las preguntas falladas con la opción elegida y la correcta.
        prompt = calls[0]["prompt"]
        first = BANK["cientifico"][0]
        self.assertIn(first["text"], prompt)
        self.assertIn(first["options"][first["correct"]], prompt)
        # Queda guardada con el diagnóstico.
        detail = self.client.get("/api/v1/student/diagnostic/cientifico", headers=self.h_student).json()
        self.assertIn("reforzaremos", detail["result"]["tutor_feedback"])

    def test_tutor_parte_del_nivel_diagnosticado(self):
        r = self.client.post("/api/v1/student/diagnostic/ingles", headers=self.h_student,
                             json={"answers": _answers("ingles")})
        self.assertEqual(r.status_code, 201, r.text)
        prompts = []

        async def groq(**kwargs):
            prompts.append(kwargs["system_prompt"])
            return {"response": "Hello!", "provider": "groq"}

        with mock.patch.object(chat_api.ai_manager, "generate", groq):
            r = self.client.post("/api/v1/chat/start", headers=self.h_student,
                                 json={"topic": "Inglés Comunicativo", "difficulty": "medium"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["difficulty"], "hard")  # nivel 4 Avanzado
        self.assertIn("DIAGNÓSTICO INICIAL", prompts[0])

    def test_competencia_inexistente(self):
        r = self.client.get("/api/v1/student/diagnostic/artes", headers=self.h_student)
        self.assertEqual(r.status_code, 404)

    def test_solo_estudiantes(self):
        r = self.client.get("/api/v1/student/diagnostic", headers=self.h_teacher)
        self.assertEqual(r.status_code, 403)

    def test_vista_profesor(self):
        self.client.post("/api/v1/student/diagnostic/matematicas", headers=self.h_student,
                         json={"answers": _answers("matematicas")})
        r = self.client.get(f"/api/v1/teacher/classrooms/{self.classroom_id}/diagnostics", headers=self.h_teacher)
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body["competency"], "matematicas")
        self.assertEqual(body["students"][0]["diagnostics"]["matematicas"]["level"], 4)

        r = self.client.get(f"/api/v1/teacher/classrooms/{self.classroom_id}/diagnostics", headers=self.h_other)
        self.assertEqual(r.status_code, 404)


if __name__ == "__main__":
    unittest.main()
