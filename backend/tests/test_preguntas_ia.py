"""
NeuroLearn IA — Pruebas de «Generar preguntas con IA» y guardado de evaluaciones (parche 3).

Flujo probado: Profesor → POST /teacher/ai/generate (kind "preguntas") → IA →
preguntas normalizadas → revisión → POST /teacher/evaluations → listado.

La IA se reemplaza por un doble que captura el prompt (para verificar materia,
grado, competencia, dificultad, cantidad y contexto) y devuelve el texto que
devolvería Groq/Gemini. BD SQLite en memoria.

Ejecutar desde backend/:

    python -m pytest tests/test_preguntas_ia.py -v
    # o sin pytest:
    python -m unittest tests.test_preguntas_ia -v
"""
from __future__ import annotations

import json
import os
from datetime import date, timedelta
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import teacher_ai  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.api.teacher_evaluations import TeacherEvaluation  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

AI_QUESTIONS = [
    {
        "type": "multiple",
        "text": "1. Si 2x + 3 = 11, ¿cuál es el valor de x?",
        "options": ["A) 4", "B) 7", "C) 3", "D) 5"],
        "correct": "A",
        "explanation": "2x = 8, entonces x = 4.",
        "points": 2,
    },
    {
        "text": "¿Qué propiedad se usa al pasar un término sumando al otro lado?",
        "options": ["Inverso aditivo", "Conmutativa", "Distributiva", "Asociativa"],
        "correct": "Inverso aditivo",
    },
    {   # inválida: la correcta no está entre las opciones
        "text": "Pregunta mal formada",
        "options": ["a", "b", "c", "d"],
        "correct": "e",
    },
    {   # inválida: solo 2 opciones
        "text": "Pregunta con pocas opciones",
        "options": ["Sí", "No"],
        "correct": "Sí",
    },
]


class NormalizeTests(unittest.TestCase):
    def test_normalizes_letters_prefixes_and_drops_invalid(self):
        result = teacher_ai.normalize_questions(AI_QUESTIONS, count=10)
        self.assertEqual(len(result), 2)
        first = result[0]
        self.assertEqual(first["text"], "Si 2x + 3 = 11, ¿cuál es el valor de x?")
        self.assertEqual(first["options"], ["4", "7", "3", "5"])
        self.assertEqual(first["correct"], "4")
        self.assertEqual(first["explanation"], "2x = 8, entonces x = 4.")
        self.assertEqual(result[1]["correct"], "Inverso aditivo")
        self.assertTrue(all(q["type"] == "multiple" and len(q["options"]) == 4 for q in result))

    def test_respects_count_and_index_answers(self):
        items = [
            {"text": f"Pregunta {i}", "options": ["w", "x", "y", "z"], "correct": 2}
            for i in range(6)
        ]
        result = teacher_ai.normalize_questions({"questions": items}, count=3)
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]["correct"], "y")

    def test_extract_json_with_surrounding_text(self):
        text = "Claro, aquí están las preguntas:\n" + json.dumps(AI_QUESTIONS[:2], ensure_ascii=False) + "\n¡Éxitos!"
        parsed = teacher_ai._extract_json(text, "preguntas")
        self.assertIsInstance(parsed, list)
        self.assertEqual(len(parsed), 2)


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
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
        inst_a = Institution(name="Colegio A", dane_code="22200000001", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="22200000002", is_active=True)
        db.add_all([inst_a, inst_b])
        db.flush()

        def user(username, role, inst):
            u = User(username=username, email=f"{username}@test.edu.co", full_name=username,
                     hashed_password="x", role=role, institution_id=inst.id if inst else None,
                     is_active=True)
            db.add(u)
            return u

        profe = user("profe_eval", UserRole.PROFESOR.value, inst_a)
        alumno = user("alumno_eval", UserRole.ESTUDIANTE.value, inst_a)
        sp = user("super_eval", UserRole.SUPER_PROFESOR.value, inst_a)
        profe_b = user("profe_eval_b", UserRole.PROFESOR.value, inst_b)
        db.flush()
        own = Classroom(name="Matemáticas 9A", subject="Matemáticas", grade="9°",
                        teacher_id=profe.id, invite_code="MAT9A1", is_active=True)
        other = Classroom(name="Física 10B", subject="Física", grade="10°",
                          teacher_id=profe_b.id, invite_code="FIS10B", is_active=True)
        db.add_all([own, other])
        db.commit()
        cls.own_classroom, cls.other_classroom = own.id, other.id
        cls.headers = {
            name: {"Authorization": "Bearer " + create_access_token({"sub": u.username})}
            for name, u in {"profe": profe, "alumno": alumno, "super": sp, "profe_b": profe_b}.items()
        }
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    PAYLOAD = {
        "kind": "preguntas",
        "topic": "Ecuaciones de primer grado",
        "level": "9°",
        "subject": "Matemáticas",
        "competency": "Pensamiento Lógico-Matemático",
        "difficulty": "avanzado",
        "count": 5,
        "extra": "usar situaciones de compras en una tienda",
    }

    def generate(self, who="profe", ai_response=None, provider="groq", providers=("groq",), payload=None):
        captured = {}

        async def fake_generate(prompt, system_prompt="", **kwargs):
            captured["prompt"] = prompt
            captured["system"] = system_prompt
            return {"response": ai_response, "provider": provider, "fallback_used": False}

        with mock.patch.object(teacher_ai.ai_manager, "generate", side_effect=fake_generate), \
                mock.patch.object(teacher_ai.ai_manager, "providers", list(providers)):
            resp = self.client.post("/api/v1/teacher/ai/generate", headers=self.headers[who],
                                    json=payload or self.PAYLOAD)
        return resp, captured

    def test_01_generates_real_questions_with_form_data(self):
        resp, captured = self.generate(ai_response=json.dumps(AI_QUESTIONS, ensure_ascii=False))
        self.assertEqual(resp.status_code, 200, resp.text)
        body = resp.json()
        questions = body["content"]["questions"]
        self.assertEqual(len(questions), 2)
        self.assertTrue(body["ai_used"])
        self.assertEqual(body["provider"], "groq")
        prompt = captured["prompt"]
        for expected in ("Ecuaciones de primer grado", "9°", "Matemáticas",
                         "Pensamiento Lógico-Matemático", "avanzado", "NÚMERO DE ÍTEMS: 5",
                         "compras en una tienda"):
            self.assertIn(expected, prompt)
        self.assertIn("Saber 11", captured["system"])

    def test_02_no_fake_content_when_ai_fails(self):
        # Gestor de IA en modo local (todos los proveedores fallaron)
        resp, _ = self.generate(ai_response="respuesta de plantilla", provider="local")
        self.assertEqual(resp.status_code, 503)
        # Sin proveedores configurados
        resp, _ = self.generate(ai_response="x", providers=())
        self.assertEqual(resp.status_code, 503)
        # Texto que no es JSON
        resp, _ = self.generate(ai_response="No puedo generar eso ahora.")
        self.assertEqual(resp.status_code, 502)
        # JSON sin ninguna pregunta válida
        resp, _ = self.generate(ai_response=json.dumps(AI_QUESTIONS[2:]))
        self.assertEqual(resp.status_code, 502)

    def test_03_validations_and_permissions(self):
        resp, _ = self.generate(payload={**self.PAYLOAD, "count": 50}, ai_response="[]")
        self.assertEqual(resp.status_code, 422)
        resp, _ = self.generate(payload={**self.PAYLOAD, "difficulty": "imposible"}, ai_response="[]")
        self.assertEqual(resp.status_code, 422)
        resp, _ = self.generate(payload={**self.PAYLOAD, "topic": "   "}, ai_response="[]")
        self.assertEqual(resp.status_code, 422)
        for who in ("alumno", "super"):
            resp, _ = self.generate(who=who, ai_response=json.dumps(AI_QUESTIONS))
            self.assertEqual(resp.status_code, 403, who)

    def _evaluation(self, questions, classroom_id=None):
        future = (date.today() + timedelta(days=10)).isoformat()
        return {"title": "Parcial ecuaciones", "classroom_id": classroom_id or self.own_classroom,
                "type": "examen", "date": future, "duration": 45, "attempts": 1, "questions": questions}

    def test_04_save_generated_questions(self):
        resp, _ = self.generate(ai_response=json.dumps(AI_QUESTIONS, ensure_ascii=False))
        generated = resp.json()["content"]["questions"]
        manual_tf = {"type": "truefalse", "text": "x = 4 cumple 2x + 3 = 11", "correct": "Verdadero", "points": 1}
        manual_open = {"type": "open", "text": "Explica cómo despejaste x.", "points": 3}
        r = self.client.post("/api/v1/teacher/evaluations", headers=self.headers["profe"],
                             json=self._evaluation(generated + [manual_tf, manual_open]))
        self.assertEqual(r.status_code, 201, r.text)
        saved = r.json()
        self.assertEqual(len(saved["questions"]), 4)
        self.assertEqual(saved["questions"][0]["explanation"], "2x = 8, entonces x = 4.")
        self.assertEqual(saved["questions"][2]["options"], ["Verdadero", "Falso"])
        self.assertNotIn("options", saved["questions"][3])

        listed = self.client.get("/api/v1/teacher/evaluations", headers=self.headers["profe"]).json()
        self.assertIn(saved["id"], [e["id"] for e in listed["evaluations"]])
        db = self.Session()
        self.assertEqual(db.query(TeacherEvaluation).filter_by(id=saved["id"]).count(), 1)
        db.close()

    def test_05_save_rejects_invalid_data(self):
        good = {"type": "multiple", "text": "¿2+2?", "options": ["3", "4", "5", "6"], "correct": "4"}
        cases = [
            (self._evaluation([good], classroom_id=self.other_classroom), 400),  # grupo de otro profesor
            (self._evaluation([good], classroom_id=99999), 400),               # grupo inexistente
            (self._evaluation([]), 400),
            (self._evaluation([{**good, "correct": "7"}]), 422),           # correcta fuera de las opciones
            (self._evaluation([{**good, "options": ["4", "4"]}]), 422),    # opciones repetidas
            (self._evaluation([{**good, "text": "  "}]), 422),
            (self._evaluation([{**good, "points": 50}]), 422),
            ({**self._evaluation([good]), "date": "20/10/2026"}, 422),
        ]
        for payload, status in cases:
            with self.subTest(payload=payload):
                r = self.client.post("/api/v1/teacher/evaluations", headers=self.headers["profe"], json=payload)
                self.assertEqual(r.status_code, status, r.text)
        r = self.client.post("/api/v1/teacher/evaluations", headers=self.headers["alumno"],
                             json=self._evaluation([good]))
        self.assertEqual(r.status_code, 403)


if __name__ == "__main__":
    unittest.main(verbosity=2)
