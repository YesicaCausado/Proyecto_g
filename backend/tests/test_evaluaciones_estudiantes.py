"""
NeuroLearn IA — Pruebas del flujo de evaluaciones profesor → estudiante (parche 4).

Profesor: crear (borrador) → publicar → ver resultados → calificar abiertas → cerrar.
Estudiante: ver evaluaciones → abrir intento → guardar → enviar → confirmación → resultado.

Valida institución, grupos, inscripción, publicación, permisos, envíos
duplicados, intentos, tiempo agotado (envío automático), fecha límite,
puntuación (mejor intento) y visibilidad de la corrección. SQLite en memoria.

Ejecutar desde backend/:

    python -m pytest tests/test_evaluaciones_estudiantes.py -v
    # o sin pytest:
    python -m unittest tests.test_evaluaciones_estudiantes -v
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.evaluation import EvaluationSubmission, TeacherEvaluation  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import evaluation_service as svc  # noqa: E402

QUESTIONS = [
    {"id": "q1", "type": "multiple", "text": "¿Cuánto es 2 + 2?", "options": ["3", "4", "5", "6"],
     "correct": "4", "points": 2, "explanation": "2 + 2 = 4"},
    {"id": "q2", "type": "truefalse", "text": "El 7 es primo.", "correct": "Verdadero", "points": 1},
    {"id": "q3", "type": "open", "text": "Explica qué es un número primo.", "points": 3},
]
PERFECT_AUTO = {"q1": "4", "q2": "Verdadero"}


class EvaluationFlowTests(unittest.TestCase):
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
        inst_a = Institution(name="Colegio A", dane_code="33300000001", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="33300000002", is_active=True)
        db.add_all([inst_a, inst_b])
        db.flush()

        def user(username, role, inst):
            u = User(username=username, email=f"{username}@test.edu.co", full_name=username.title(),
                     hashed_password="x", role=role, institution_id=inst.id, is_active=True)
            db.add(u)
            return u

        cls.users = {
            "profe": user("profe_ev", UserRole.PROFESOR.value, inst_a),
            "s1": user("ana_ev", UserRole.ESTUDIANTE.value, inst_a),
            "s2": user("beto_ev", UserRole.ESTUDIANTE.value, inst_a),
            "s3": user("caro_ev", UserRole.ESTUDIANTE.value, inst_a),      # otra aula
            "profe_b": user("profe_ev_b", UserRole.PROFESOR.value, inst_b),
            "sb": user("dani_ev_b", UserRole.ESTUDIANTE.value, inst_b),    # otra institución
        }
        db.flush()
        u = cls.users
        c9 = Classroom(name="Matemáticas 9A", subject="Matemáticas", grade="9°", teacher_id=u["profe"].id,
                       invite_code="EV9A01", is_active=True)
        c10 = Classroom(name="Matemáticas 10A", subject="Matemáticas", grade="10°", teacher_id=u["profe"].id,
                        invite_code="EV10A1", is_active=True)
        cb = Classroom(name="Matemáticas 9A", subject="Matemáticas", grade="9°", teacher_id=u["profe_b"].id,
                       invite_code="EVB9A1", is_active=True)
        db.add_all([c9, c10, cb])
        db.flush()
        for student, classroom in (("s1", c9), ("s2", c9), ("s3", c10), ("sb", cb)):
            db.add(Enrollment(student_id=u[student].id, classroom_id=classroom.id, is_active=True))
        db.commit()
        cls.c9, cls.c10, cls.cb = c9.id, c10.id, cb.id
        cls.ids = {k: v.id for k, v in u.items()}
        cls.h = {k: {"Authorization": "Bearer " + create_access_token({"sub": v.username})} for k, v in u.items()}
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    # ── helpers ──
    def create(self, who="profe", **overrides):
        payload = {"title": "Parcial 1", "classroom_id": self.c9, "type": "examen", "date": "",
                   "duration": 30, "attempts": 1, "questions": QUESTIONS}
        payload.update(overrides)
        return self.client.post("/api/v1/teacher/evaluations", headers=self.h[who], json=payload)

    def publish(self, ev_id, who="profe"):
        return self.client.post(f"/api/v1/teacher/evaluations/{ev_id}/publish", headers=self.h[who])

    def student_list(self, who):
        return self.client.get("/api/v1/student/evaluations", headers=self.h[who])

    def start(self, who, ev_id):
        return self.client.post(f"/api/v1/student/evaluations/{ev_id}/start", headers=self.h[who])

    def submit(self, who, ev_id, sid, answers):
        return self.client.post(f"/api/v1/student/evaluations/{ev_id}/submit", headers=self.h[who],
                                json={"submission_id": sid, "answers": answers})

    def results(self, ev_id, who="profe"):
        return self.client.get(f"/api/v1/teacher/evaluations/{ev_id}/results", headers=self.h[who])

    # ── pruebas ──
    def test_01_full_flow(self):
        r = self.create()
        self.assertEqual(r.status_code, 201, r.text)
        ev = r.json()
        self.assertEqual(ev["status"], "borrador")
        self.assertEqual(ev["group"], "Matemáticas 9A")
        # Borrador: invisible para los estudiantes
        self.assertEqual(self.student_list("s1").json()["evaluations"], [])

        r = self.publish(ev["id"])
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["status"], "publicada")
        self.assertEqual(self.publish(ev["id"]).status_code, 409)   # ya publicada

        # Visibilidad por aula e institución
        listed = self.student_list("s1").json()["evaluations"]
        self.assertEqual([e["id"] for e in listed], [ev["id"]])
        self.assertEqual(listed[0]["state"], "pendiente")
        self.assertTrue(listed[0]["can_start"])
        for other in ("s3", "sb"):
            self.assertEqual(self.student_list(other).json()["evaluations"], [], other)
            self.assertEqual(self.start(other, ev["id"]).status_code, 404, other)

        # Abrir intento: preguntas sin respuesta correcta ni explicación
        r = self.start("s1", ev["id"])
        self.assertEqual(r.status_code, 200, r.text)
        att = r.json()
        self.assertGreater(att["remaining_seconds"], 29 * 60)
        for q in att["questions"]:
            self.assertNotIn("correct", q)
            self.assertNotIn("explanation", q)
        # Retomar no duplica el intento
        self.assertEqual(self.start("s1", ev["id"]).json()["submission_id"], att["submission_id"])

        # Guardar progreso y enviar
        r = self.client.put(f"/api/v1/student/evaluations/{ev['id']}/progress", headers=self.h["s1"],
                            json={"submission_id": att["submission_id"], "answers": {"q1": "4"}})
        self.assertEqual(r.status_code, 200, r.text)
        answers = {**PERFECT_AUTO, "q3": "Un número que solo es divisible por 1 y por sí mismo."}
        r = self.submit("s1", ev["id"], att["submission_id"], answers)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["attempt"]["status"], "pendiente_revision")
        self.assertIn("calificar las preguntas abiertas", r.json()["message"])
        # Envío duplicado
        self.assertEqual(self.submit("s1", ev["id"], att["submission_id"], answers).status_code, 409)
        # Sin más intentos
        self.assertEqual(self.start("s1", ev["id"]).status_code, 409)

        # La corrección no se muestra mientras está publicada
        detail = self.client.get(f"/api/v1/student/evaluations/{ev['id']}", headers=self.h["s1"]).json()
        self.assertFalse(detail["corrections_available"])
        self.assertIsNone(detail["review"])

        # Resultados del profesor
        res = self.results(ev["id"]).json()
        by_name = {s["username"]: s for s in res["students"]}
        self.assertEqual(by_name["ana_ev"]["status"], "pendiente_revision")
        self.assertEqual(by_name["beto_ev"]["status"], "sin_entregar")
        self.assertEqual(res["summary"]["students_total"], 2)
        sub_id = by_name["ana_ev"]["official"]["id"]

        # Calificar la abierta
        base = f"/api/v1/teacher/evaluations/{ev['id']}/submissions/{sub_id}"
        self.assertEqual(self.client.post(base + "/grade", headers=self.h["profe"],
                                          json={"grades": {"q3": {"points": 9}}}).status_code, 400)
        self.assertEqual(self.client.post(base + "/grade", headers=self.h["profe"],
                                          json={"grades": {"q1": {"points": 1}}}).status_code, 400)
        r = self.client.post(base + "/grade", headers=self.h["profe"],
                             json={"grades": {"q3": {"points": 2, "feedback": "Falta un ejemplo."}}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["submission"]["status"], "calificada")
        self.assertEqual(r.json()["submission"]["score"], 5.0)             # 2 + 1 + 2
        self.assertAlmostEqual(r.json()["submission"]["percentage"], 83.3)  # 5 / 6

        res = self.results(ev["id"]).json()
        self.assertEqual(res["summary"]["average_percentage"], 83.3)
        q_stats = {q["id"]: q for q in res["questions"]}
        self.assertEqual(q_stats["q1"]["correct_rate"], 100.0)

        # Cerrar: ya no se responde y el estudiante ve la corrección
        r = self.client.post(f"/api/v1/teacher/evaluations/{ev['id']}/close", headers=self.h["profe"])
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.start("s2", ev["id"]).status_code, 409)
        detail = self.client.get(f"/api/v1/student/evaluations/{ev['id']}", headers=self.h["s1"]).json()
        self.assertTrue(detail["corrections_available"])
        self.assertEqual(detail["official"]["percentage"], 83.3)
        review = {i["question"]["id"]: i for i in detail["review"]}
        self.assertEqual(review["q1"]["question"]["correct"], "4")
        self.assertEqual(review["q3"]["result"]["feedback"], "Falta un ejemplo.")
        # Cerrada: no se edita
        self.assertEqual(self.client.put(f"/api/v1/teacher/evaluations/{ev['id']}", headers=self.h["profe"],
                                         json={"title": "x", "classroom_id": self.c9,
                                               "questions": QUESTIONS}).status_code, 409)

    def test_02_attempts_timeout_and_best_score(self):
        ev = self.create(title="Quiz con 2 intentos", attempts=2,
                         questions=[q for q in QUESTIONS if q["type"] != "open"]).json()
        self.publish(ev["id"])
        att = self.start("s2", ev["id"]).json()
        # Respuestas guardadas y tiempo agotado sin enviar
        self.client.put(f"/api/v1/student/evaluations/{ev['id']}/progress", headers=self.h["s2"],
                        json={"submission_id": att["submission_id"], "answers": {"q1": "4"}})
        db = self.Session()
        sub = db.get(EvaluationSubmission, att["submission_id"])
        sub.expires_at = svc.utcnow() - timedelta(minutes=5)
        db.commit()
        db.close()
        r = self.submit("s2", ev["id"], att["submission_id"], PERFECT_AUTO)
        self.assertEqual(r.status_code, 409)                      # fuera de tiempo
        detail = self.client.get(f"/api/v1/student/evaluations/{ev['id']}", headers=self.h["s2"]).json()
        first = detail["attempts"][0]
        self.assertTrue(first["auto_submitted"])
        self.assertEqual(first["status"], "calificada")
        self.assertAlmostEqual(first["percentage"], 66.7)        # solo q1 (2 de 3 puntos)
        # Segundo intento perfecto → nota oficial = mejor intento
        att2 = self.start("s2", ev["id"]).json()
        self.assertEqual(att2["attempt_number"], 2)
        r = self.submit("s2", ev["id"], att2["submission_id"], PERFECT_AUTO)
        self.assertEqual(r.json()["attempt"]["percentage"], 100.0)
        detail = self.client.get(f"/api/v1/student/evaluations/{ev['id']}", headers=self.h["s2"]).json()
        self.assertEqual(detail["official"]["percentage"], 100.0)
        self.assertEqual(self.start("s2", ev["id"]).status_code, 409)
        # Con entregas ya no se puede editar
        r = self.client.put(f"/api/v1/teacher/evaluations/{ev['id']}", headers=self.h["profe"],
                            json={"title": "Otro", "classroom_id": self.c9, "questions": QUESTIONS})
        self.assertEqual(r.status_code, 409)

    def test_03_deadline(self):
        self.assertEqual(self.create(date="2020-01-01").status_code, 400)   # fecha pasada
        ev = self.create(title="Con fecha", date=svc.today_colombia().isoformat()).json()
        self.publish(ev["id"])
        db = self.Session()
        row = db.get(TeacherEvaluation, ev["id"])
        row.date = (svc.today_colombia() - timedelta(days=1)).isoformat()   # venció ayer
        db.commit()
        db.close()
        self.assertEqual(self.start("s1", ev["id"]).status_code, 409)
        item = next(e for e in self.student_list("s1").json()["evaluations"] if e["id"] == ev["id"])
        self.assertEqual(item["state"], "no_entregada")
        self.assertTrue(item["corrections_available"])
        self.assertFalse(item["can_start"])

    def test_04_validations_and_permissions(self):
        self.assertEqual(self.create(classroom_id=self.cb).status_code, 400)       # aula de otro profesor
        self.assertEqual(self.create(questions=[{**QUESTIONS[0], "type": "match"}]).status_code, 422)
        ev = self.create(title="Privada").json()
        # Edición en borrador: cambia de aula
        r = self.client.put(f"/api/v1/teacher/evaluations/{ev['id']}", headers=self.h["profe"],
                            json={"title": "Privada 10A", "classroom_id": self.c10, "questions": QUESTIONS})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["group"], "Matemáticas 10A")
        # Profesor de otra institución no ve ni publica
        self.assertEqual(self.results(ev["id"], who="profe_b").status_code, 404)
        self.assertEqual(self.publish(ev["id"], who="profe_b").status_code, 404)
        # Roles
        self.assertEqual(self.client.get("/api/v1/teacher/evaluations", headers=self.h["s1"]).status_code, 403)
        self.assertEqual(self.student_list("profe").status_code, 403)
        # Sin aula no se publica
        db = self.Session()
        row = db.get(TeacherEvaluation, ev["id"])
        row.classroom_id = None
        db.commit()
        db.close()
        self.assertEqual(self.publish(ev["id"]).status_code, 400)

    def test_05_legacy_match_question_is_graded(self):
        db = self.Session()
        ev = TeacherEvaluation(teacher_id=self.ids["profe"], classroom_id=self.c9, title="Antigua",
                               group_name="Matemáticas 9A", questions=[
                                   {"id": "m1", "type": "match", "text": "Capital de Colombia",
                                    "options": ["Bogotá", "Lima"], "correct": "Bogotá", "points": 2}],
                               status="publicada", active=True, duration=10, attempts=1)
        db.add(ev)
        db.commit()
        ev_id = ev.id
        db.close()
        att = self.start("s3", ev_id)
        self.assertEqual(att.status_code, 404)                    # s3 no está en 9A
        att = self.start("s2", ev_id).json()
        r = self.submit("s2", ev_id, att["submission_id"], {"m1": "Bogotá"})
        self.assertEqual(r.json()["attempt"]["percentage"], 100.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
