"""
NeuroLearn IA — Pruebas del módulo Reportes del Súper Profesor.

Siembra una institución con resultados conocidos (quizzes adaptativos y
evaluaciones docentes) y comprueba contra esos registros: fórmulas de las
tarjetas, competencias, grupos, profesores, evolución, seguimiento,
evaluaciones, filtros, aislamiento entre instituciones, permisos, casos sin
datos y exportaciones CSV/PDF. SQLite en memoria.

Ejecutar desde backend/:

    python -m pytest tests/test_super_reports.py -v
"""
from __future__ import annotations

import csv
import io
import os
import sys
import unittest
from datetime import datetime, timedelta
from statistics import mean

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

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
from app.models.learning import QuizHistory  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import evaluation_service  # noqa: E402
from app.services.super_report_service import classify_competency, interpretation  # noqa: E402

BASE = "/api/v1/super/reports"
MATH = "Razonamiento cuantitativo y matemáticas para Saber 11"
ENG = "Competencia comunicativa en inglés para Saber 11"
READ = "Comprensión lectora y lectura crítica para Saber 11"
SCI = "Pensamiento científico y ciencias naturales para Saber 11"


def r1(v):
    return round(v, 1)


class SuperReportsTests(unittest.TestCase):
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
        a = Institution(name="Colegio Andino", dane_code="55500000001", is_active=True)
        b = Institution(name="Colegio Bravo", dane_code="55500000002", is_active=True)
        db.add_all([a, b])
        db.flush()

        def user(username, full_name, role, inst):
            u = User(username=username, email=f"{username}@test.edu.co", full_name=full_name,
                     hashed_password="x", role=role, institution_id=inst.id, is_active=True)
            db.add(u)
            return u

        E, P = UserRole.ESTUDIANTE.value, UserRole.PROFESOR.value
        sp = user("sr_super", "Rectora Andina", UserRole.SUPER_PROFESOR.value, a)
        t1 = user("sr_t1", "Tomás Uribe", P, a)
        t2 = user("sr_t2", "Lucía Prada", P, a)
        t3 = user("sr_t3", "Sin Grupos", P, a)
        s = {i: user(f"sr_s{i}", name, E, a) for i, name in (
            (1, "Ana Muñoz"), (2, "Beto Pérez"), (3, "Carolina Díaz"), (4, "Daniel Ríos"),
            (5, "Elena Gómez"), (6, "Fabio Sin Grupo"), (7, "Gina Torres"), (8, "Hugo Inactivo"))}
        sp_b = user("sr_super_b", "Rector B", UserRole.SUPER_PROFESOR.value, b)
        tb = user("sr_tb", "Profe B", P, b)
        sb = user("sr_sb", "Estudiante B", E, b)
        db.flush()

        c1 = Classroom(name="Mat 9A", subject="Matemáticas", grade="9", teacher_id=t1.id, invite_code="SRC001")
        c2 = Classroom(name="Inglés 9A", subject="Inglés", grade="9", teacher_id=t1.id, invite_code="SRC002")
        c3 = Classroom(name="Ciencias 10A", subject="Ciencias Naturales", grade="10", teacher_id=t2.id,
                       invite_code="SRC003")
        cb = Classroom(name="Grupo B", subject="Matemáticas", grade="9", teacher_id=tb.id, invite_code="SRCB01")
        db.add_all([c1, c2, c3, cb])
        db.flush()
        for st, cl in ((1, c1), (2, c1), (3, c1), (1, c2), (2, c2), (8, c2), (4, c3), (5, c3), (7, c3)):
            db.add(Enrollment(student_id=s[st].id, classroom_id=cl.id, is_active=True))
        db.add(Enrollment(student_id=sb.id, classroom_id=cb.id, is_active=True))

        now = datetime.utcnow()
        cls.now = now

        def quiz(st, score, days_ago, topic, completed=True):
            done = now - timedelta(days=days_ago)
            db.add(QuizHistory(user_id=st.id, quiz_title="Quiz", topic=topic, difficulty="medio",
                               questions_count=10, correct_answers=int(score / 10), wrong_answers=10 - int(score / 10),
                               quiz_data={}, performance_score=score if completed else None, created_at=done,
                               completed_at=done if completed else None, time_spent_seconds=300))

        # Período actual (últimos 30 días)
        quiz(s[1], 50.0, 10, MATH)
        quiz(s[1], 45.0, 8, MATH)
        quiz(s[1], 40.0, 6, MATH)
        quiz(s[1], 60.0, 2, ENG)
        quiz(s[2], 80.0, 5, MATH)
        quiz(s[2], 90.0, 3, MATH)
        quiz(s[2], 100.0, 1, READ)
        quiz(s[3], 70.0, 4, MATH)
        quiz(s[4], 85.0, 5, SCI)
        quiz(s[5], 75.0, 5, SCI)
        quiz(s[7], 70.0, 5, SCI)
        quiz(s[2], 0.0, 1, MATH, completed=False)         # generado sin completar
        # Período anterior
        quiz(s[2], 60.0, 40, MATH)
        quiz(s[3], 50.0, 45, MATH)
        quiz(s[4], 65.0, 40, SCI)
        # Otra institución
        quiz(sb, 10.0, 3, MATH)

        q = [{"id": "q1", "type": "multiple", "text": "x", "options": ["a", "b"], "correct": "a", "points": 10}]
        ev1 = TeacherEvaluation(teacher_id=t1.id, classroom_id=c1.id, title="Parcial álgebra", group_name=c1.name,
                                questions=q, status="publicada", published_at=now - timedelta(days=12),
                                created_at=now - timedelta(days=13), attempts=2)
        today = evaluation_service.today_colombia()
        ev2 = TeacherEvaluation(teacher_id=t2.id, classroom_id=c3.id, title="Laboratorio 1", group_name=c3.name,
                                questions=q, status="publicada", published_at=now - timedelta(days=9),
                                created_at=now - timedelta(days=9), date=(today - timedelta(days=3)).isoformat())
        ev3 = TeacherEvaluation(teacher_id=t2.id, classroom_id=c3.id, title="Laboratorio 2", group_name=c3.name,
                                questions=q, status="publicada", published_at=now - timedelta(days=9),
                                created_at=now - timedelta(days=9), date=(today - timedelta(days=2)).isoformat())
        ev4 = TeacherEvaluation(teacher_id=t1.id, classroom_id=c1.id, title="Borrador taller", group_name=c1.name,
                                questions=q, status="borrador", created_at=now - timedelta(days=2))
        evb = TeacherEvaluation(teacher_id=tb.id, classroom_id=cb.id, title="Eval B", group_name=cb.name,
                                questions=q, status="publicada", published_at=now - timedelta(days=5))
        db.add_all([ev1, ev2, ev3, ev4, evb])
        db.flush()

        def sub(ev, st, attempt, status, pct, days_ago, expired=True):
            started = now - timedelta(days=days_ago, hours=1)
            db.add(EvaluationSubmission(
                evaluation_id=ev.id, student_id=st.id, classroom_id=ev.classroom_id, attempt_number=attempt,
                status=status, score=None if pct is None else pct / 10, max_score=10.0, percentage=pct,
                started_at=started, expires_at=started + timedelta(minutes=30) if expired else now + timedelta(hours=1),
                submitted_at=None if status == "en_curso" else started + timedelta(minutes=20)))

        sub(ev1, s[3], 1, "calificada", 60.0, 8)
        sub(ev1, s[3], 2, "calificada", 80.0, 7)           # oficial: mejor intento (80)
        sub(ev1, s[2], 1, "pendiente_revision", None, 6)   # sin nota final
        sub(ev1, s[1], 1, "en_curso", None, 5)             # abandonado (tiempo agotado)
        sub(ev2, s[4], 1, "calificada", 90.0, 4)
        sub(evb, sb, 1, "calificada", 20.0, 2)
        db.commit()

        cls.ids = {"c1": c1.id, "c2": c2.id, "c3": c3.id, "cb": cb.id, "t1": t1.id, "t2": t2.id, "t3": t3.id,
                   "tb": tb.id, "sb": sb.id, "ev1": ev1.id, "evb": evb.id, **{f"s{i}": u.id for i, u in s.items()}}
        cls.start = (today - timedelta(days=29)).isoformat()
        cls.end = today.isoformat()
        tokens = {"super": sp, "super_b": sp_b, "profe": t1, "student": s[1]}
        cls.h = {k: {"Authorization": "Bearer " + create_access_token({"sub": u.username})} for k, u in tokens.items()}
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def get(self, path="/overview", who="super", period=True, **params):
        if period:
            params.setdefault("start_date", self.start)
            params.setdefault("end_date", self.end)
        return self.client.get(BASE + path, headers=self.h[who], params=params)

    def ok(self, path="/overview", **params):
        r = self.get(path, **params)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    # ── Clasificación ──────────────────────────────────────────────────────
    def test_00_classify(self):
        self.assertEqual(classify_competency(MATH), "matematicas")
        self.assertEqual(classify_competency(ENG), "ingles")
        self.assertEqual(classify_competency(READ), "lectora")
        self.assertEqual(classify_competency("Competencias ciudadanas y sociales para Saber 11"), "ciudadanas")
        self.assertEqual(classify_competency(SCI), "cientifico")
        self.assertEqual(classify_competency("Ciencias Sociales"), "ciudadanas")
        self.assertEqual(classify_competency("Lenguaje"), "lectora")
        self.assertIsNone(classify_competency("Otra"))

    # ── Resumen ejecutivo ──────────────────────────────────────────────────
    def test_01_cards_match_source_records(self):
        d = self.ok()
        c = d["cards"]
        self.assertEqual(d["meta"]["institution"]["name"], "Colegio Andino")
        # 8 estudiantes registrados; 6 con resultados (s6 sin grupo y s8 inactivo no tienen)
        self.assertEqual(c["evaluated_students"]["registered"], 8)
        self.assertEqual(c["evaluated_students"]["evaluated"], 6)
        self.assertEqual(c["evaluated_students"]["participation"], 75.0)
        per_student = {1: [50, 45, 40, 60], 2: [80, 90, 100], 3: [70, 80], 4: [85, 90], 5: [75], 7: [70]}
        expected = r1(mean(mean(v) for v in per_student.values()))
        self.assertEqual(c["average"]["value"], expected)
        self.assertEqual(c["average"]["results"], 13)
        prev = r1(mean([60, 50, 65]))
        self.assertEqual(c["average"]["previous"], prev)
        self.assertEqual(c["average"]["change"], r1(expected - prev))
        # Competencias: solo matemáticas y científico tienen ≥3 estudiantes
        self.assertEqual(c["strongest_competency"]["key"], "cientifico")
        self.assertEqual(c["strongest_competency"]["average"], r1(mean([87.5, 75, 70])))
        self.assertEqual(c["weakest_competency"]["key"], "matematicas")
        math_avg = r1(mean([45, 85, 75]))
        self.assertEqual(c["weakest_competency"]["average"], math_avg)
        self.assertEqual(c["weakest_competency"]["gap_to_reference"], r1(math_avg - 60))
        self.assertEqual(c["followup"]["students"], 1)            # Ana (rendimiento)
        self.assertEqual(c["followup"]["activity_students"], 3)   # Elena, Gina (vencidas), Hugo (inactivo)
        act = c["activity"]
        self.assertEqual(act["completed_quizzes"], 11)
        self.assertEqual(act["completed_submissions"], 4)
        self.assertEqual(act["completed"], 15)
        self.assertEqual(act["open_submissions"], 1)
        self.assertEqual(act["pending_quizzes"], 1)
        self.assertEqual(act["previous_completed"], 3)
        self.assertEqual(act["change_pct"], 400.0)

    def test_02_competencies_and_interpretation(self):
        d = self.ok()
        comps = {c["key"]: c for c in d["competencies"]}
        self.assertEqual(list(comps), ["matematicas", "lectora", "ingles", "ciudadanas", "cientifico"])
        m = comps["matematicas"]
        self.assertEqual((m["students"], m["results"]), (3, 7))   # Ana 3 + Beto 2 + Carolina 1 quiz y 1 evaluación
        self.assertEqual(m["previous_average"], r1(mean([60, 50])))
        self.assertIsNone(comps["ciudadanas"]["average"])          # sin datos → null, nunca 0
        self.assertEqual(comps["ciudadanas"]["results"], 0)
        self.assertFalse(comps["ingles"]["sufficient"])
        types = {(i["type"], i["competency"]) for i in d["interpretation"]}
        self.assertIn(("sin_datos", "ciudadanas"), types)
        self.assertIn(("insuficiente", "ingles"), types)
        # 68,3 y 77,5 quedan a 4,6 pp de su media (< margen de 5 pp): ninguna es «relativamente» alta/baja
        self.assertFalse({t for t, _ in types} & {"alta", "baja"})
        self.assertIn(("mejora", "matematicas"), types)            # 55,0 → 68,3
        self.assertIn(("mejora", "cientifico"), types)             # 65,0 → 77,5
        rows = [{"key": k, "name": k, "average": avg, "students": 5, "results": 9, "sufficient": True,
                 "change": None, "previous_average": None} for k, avg in (("a", 80.0), ("b", 70.0), ("c", 60.0))]
        types = {(i["type"], i["competency"]) for i in interpretation(rows, has_previous=False)}
        self.assertEqual(types, {("alta", "a"), ("baja", "c")})    # media 70: ±10 pp; «b» no se menciona

    def test_03_groups_and_teachers(self):
        d = self.ok()
        g = {x["name"]: x for x in d["groups"]}
        self.assertEqual(set(g), {"Mat 9A", "Inglés 9A", "Ciencias 10A"})
        # En un grupo solo cuentan los quizzes de su competencia
        # (quiz_counts_for_group): el de inglés (60) y el de lectura (100) no
        # entran en Matemáticas.
        self.assertEqual(g["Mat 9A"]["average"], r1(mean([mean([50, 45, 40]), mean([80, 90]), 75])))
        self.assertEqual((g["Mat 9A"]["enrolled"], g["Mat 9A"]["evaluated"]), (3, 3))
        # Inglés 9A (est1, est2, est8): solo est1 practicó inglés; los quizzes
        # de matemáticas y lectura de est2 no cuentan en este grupo.
        self.assertEqual(g["Inglés 9A"]["participation"], r1(1 / 3 * 100))
        self.assertEqual(g["Ciencias 10A"]["teacher"]["name"], "Lucía Prada")
        t = {x["name"]: x for x in d["teachers"]}
        self.assertIn("Sin Grupos", t)
        self.assertEqual(t["Sin Grupos"]["groups"], 0)
        self.assertIsNone(t["Sin Grupos"]["average"])
        self.assertEqual(t["Tomás Uribe"]["groups"], 2)
        self.assertEqual(t["Tomás Uribe"]["students"], 4)
        self.assertEqual(t["Tomás Uribe"]["evaluations_published"], 1)   # el borrador no cuenta
        self.assertEqual(t["Lucía Prada"]["evaluations_published"], 2)
        self.assertNotIn("Profe B", t)

    def test_04_evolution_and_quality(self):
        d = self.ok()
        evo = d["evolution"]
        self.assertEqual(evo["granularity"], "week")
        keys = [s["key"] for s in evo["series"]]
        self.assertIn("general", keys)
        self.assertNotIn("ciudadanas", keys)
        total = sum(p["results"] for s in evo["series"] if s["key"] == "general" for p in s["points"])
        self.assertEqual(total, 13)
        empty_points = [p for s in evo["series"] for p in s["points"] if p["results"] == 0]
        self.assertTrue(all(p["average"] is None for p in empty_points))
        q = d["quality"]
        self.assertEqual(q["registered_students"], 8)
        self.assertEqual(q["students_without_results"], 2)
        self.assertEqual(q["students_without_group"], 1)
        self.assertEqual(q["pending_review"], 1)
        self.assertEqual(q["graded_results"], 2)
        self.assertEqual(q["quiz_results"], 11)
        self.assertIn("Competencias Ciudadanas y Sociales", q["competencies_without_data"])

    # ── Filtros ────────────────────────────────────────────────────────────
    def test_05_filters_change_results(self):
        d = self.ok(classroom_id=self.ids["c3"])
        self.assertEqual(d["cards"]["evaluated_students"]["registered"], 3)
        self.assertEqual(d["cards"]["average"]["value"], r1(mean([87.5, 75, 70])))
        self.assertEqual([g["name"] for g in d["groups"]], ["Ciencias 10A"])

        d = self.ok(teacher_id=self.ids["t1"])
        self.assertEqual({g["name"] for g in d["groups"]}, {"Mat 9A", "Inglés 9A"})
        self.assertEqual(d["cards"]["evaluated_students"]["registered"], 4)

        d = self.ok(competency="matematicas")
        self.assertEqual(d["cards"]["average"]["value"], r1(mean([45, 85, 75])))
        self.assertEqual([c["key"] for c in d["competencies"]], ["matematicas"])

        d = self.ok(source="evaluacion")
        self.assertEqual(d["cards"]["average"]["value"], r1(mean([80, 90])))
        self.assertEqual(d["cards"]["activity"]["completed_quizzes"], 0)

        d = self.ok(student_id=self.ids["s1"])
        self.assertEqual(d["cards"]["evaluated_students"]["registered"], 1)
        self.assertEqual(d["cards"]["average"]["value"], r1(mean([50, 45, 40, 60])))

        # Sin rango cerrado no hay período anterior
        d = self.ok(period=False)
        self.assertIsNone(d["cards"]["average"]["change"])
        self.assertIsNone(d["meta"]["previous_period"])

    def test_06_invalid_filters(self):
        self.assertEqual(self.get(start_date=self.end, end_date=self.start).status_code, 400)
        self.assertEqual(self.get(competency="artes").status_code, 400)
        self.assertEqual(self.get(source="otra").status_code, 400)
        self.assertEqual(self.get(start_date="19-10-2026").status_code, 400)
        # Estudiante que no pertenece al grupo seleccionado
        self.assertEqual(self.get(classroom_id=self.ids["c1"], student_id=self.ids["s4"]).status_code, 404)

    def test_07_empty_period_returns_nulls_not_zeros(self):
        d = self.ok(start_date="2020-01-01", end_date="2020-01-31")
        c = d["cards"]
        self.assertEqual(c["evaluated_students"]["evaluated"], 0)
        self.assertIsNone(c["average"]["value"])
        self.assertIsNone(c["strongest_competency"])
        self.assertTrue(all(x["average"] is None for x in d["competencies"]))
        self.assertTrue(all(g["average"] is None for g in d["groups"]))
        self.assertTrue(any("No hay resultados" in w for w in d["quality"]["warnings"]))
        r = self.get("/export", start_date="2020-01-01", end_date="2020-01-31", section="resumen", format="pdf")
        self.assertEqual(r.status_code, 404)                       # nunca archivos vacíos

    # ── Aislamiento y permisos ─────────────────────────────────────────────
    def test_08_institution_isolation(self):
        self.assertEqual(self.get(classroom_id=self.ids["cb"]).status_code, 404)
        self.assertEqual(self.get(teacher_id=self.ids["tb"]).status_code, 404)
        self.assertEqual(self.get(f"/students/{self.ids['sb']}").status_code, 404)
        self.assertEqual(self.get(f"/groups/{self.ids['cb']}").status_code, 404)
        self.assertEqual(self.get(f"/evaluations/{self.ids['evb']}").status_code, 404)
        names = {s["name"] for s in self.ok("/students", size=100)["items"]}
        self.assertNotIn("Estudiante B", names)
        b = self.ok(who="super_b")
        self.assertEqual(b["cards"]["evaluated_students"]["registered"], 1)
        self.assertEqual(b["cards"]["average"]["value"], r1(mean([10, 20])))
        self.assertEqual([g["name"] for g in b["groups"]], ["Grupo B"])
        self.assertEqual(self.get(f"/groups/{self.ids['c1']}", who="super_b").status_code, 404)

    def test_09_roles(self):
        self.assertEqual(self.get(who="profe").status_code, 403)
        self.assertEqual(self.get(who="student").status_code, 403)
        self.assertEqual(self.get("/export", who="student", section="resumen").status_code, 403)
        self.assertEqual(self.client.get(BASE + "/overview").status_code, 401)

    # ── Detalles ───────────────────────────────────────────────────────────
    def test_10_filters_endpoint(self):
        d = self.ok("/filters", period=False)
        self.assertEqual({g["name"] for g in d["groups"]}, {"Mat 9A", "Inglés 9A", "Ciencias 10A"})
        self.assertEqual(len(d["competencies"]), 5)
        self.assertNotIn("Profe B", {t["name"] for t in d["teachers"]})

    def test_11_students_search_and_pagination(self):
        d = self.ok("/students", q="ana")
        self.assertEqual([s["name"] for s in d["items"]], ["Ana Muñoz"])
        d = self.ok("/students", classroom_id=self.ids["c1"])
        self.assertEqual({s["name"] for s in d["items"]}, {"Ana Muñoz", "Beto Pérez", "Carolina Díaz"})
        p1 = self.ok("/students", size=3, page=1)
        p3 = self.ok("/students", size=3, page=3)
        self.assertEqual((p1["total"], p1["pages"]), (8, 3))
        self.assertEqual(len(p3["items"]), 2)
        self.assertFalse({s["id"] for s in p1["items"]} & {s["id"] for s in p3["items"]})
        hugo = self.ok("/students", q="hugo")["items"][0]
        self.assertIsNone(hugo["average"])

    def test_12_student_detail(self):
        d = self.ok(f"/students/{self.ids['s1']}")
        self.assertEqual(d["summary"]["results"], 4)
        self.assertEqual(d["student"]["groups"], ["Mat 9A", "Inglés 9A"])
        comps = {c["key"]: c for c in d["competencies"]}
        self.assertEqual(comps["matematicas"]["status"], "refuerzo")
        self.assertEqual(comps["matematicas"]["change"], -10.0)
        self.assertEqual(comps["ingles"]["status"], "insuficiente")
        hist = {h["pct"]: h for h in d["history"]}
        self.assertEqual(hist[45.0]["change_vs_previous"], -5.0)
        self.assertIsNone(hist[50.0]["change_vs_previous"])
        self.assertEqual(len(d["points"]), 4)
        self.assertEqual({c["rule"] for c in d["followup"]}, {"bajo_desempeno", "descenso"})
        d3 = self.ok(f"/students/{self.ids['s3']}")
        ev = [h for h in d3["history"] if h["source"] == "evaluacion"][0]
        self.assertEqual((ev["pct"], ev["attempts"], ev["max_score"]), (80.0, 2, 10.0))

    def test_13_group_teacher_competency_detail(self):
        g = self.ok(f"/groups/{self.ids['c1']}")
        bands = {b["key"]: b["students"] for b in g["distribution"]}
        self.assertEqual(bands, {"bajo": 1, "basico": 1, "alto": 1, "superior": 0})
        st = {s["name"]: s for s in g["students"]}
        self.assertTrue(st["Ana Muñoz"]["followup"])
        self.assertFalse(st["Beto Pérez"]["followup"])
        self.assertEqual(g["summary"]["completed_evaluations"], 1)
        t = self.ok(f"/teachers/{self.ids['t1']}")
        self.assertEqual(len(t["groups"]), 2)
        self.assertEqual({e["title"] for e in t["evaluations"]}, {"Parcial álgebra", "Borrador taller"})
        self.assertIsNotNone(t["comparison_note"])
        t3 = self.ok(f"/teachers/{self.ids['t3']}")
        self.assertEqual(t3["teacher"]["groups"], 0)
        c = self.ok("/competencies/cientifico")
        self.assertEqual(c["competency"]["students"], 3)
        self.assertEqual([s["average"] for s in c["students"]], [70.0, 75.0, 87.5])
        self.assertEqual(self.get("/competencies/artes").status_code, 404)

    def test_14_evaluations_report(self):
        d = self.ok("/evaluations")
        rows = {e["title"]: e for e in d["items"]}
        self.assertEqual(set(rows), {"Parcial álgebra", "Laboratorio 1", "Laboratorio 2", "Borrador taller"})
        p = rows["Parcial álgebra"]
        self.assertEqual((p["assigned"], p["started"], p["completed"], p["abandoned"], p["pending_review"]),
                         (3, 3, 2, 1, 1))
        self.assertEqual(p["completion_rate"], r1(2 / 3 * 100))
        self.assertEqual(p["average"], 80.0)
        self.assertEqual(p["competency"], "matematicas")
        self.assertIsNone(rows["Laboratorio 2"]["average"])
        ind = d["indicators"]
        self.assertEqual((ind["assigned"], ind["started"], ind["completed"]), (12, 4, 3))
        self.assertEqual(ind["abandonment_rate"], 25.0)
        self.assertEqual(ind["average"], 85.0)
        d = self.ok("/evaluations", eval_status="borrador")
        self.assertEqual([e["title"] for e in d["items"]], ["Borrador taller"])
        det = self.ok(f"/evaluations/{self.ids['ev1']}")
        st = {s["name"]: s for s in det["students"]}
        self.assertEqual(st["Carolina Díaz"]["pct"], 80.0)
        self.assertEqual(st["Beto Pérez"]["status"], "Por calificar")
        self.assertEqual(st["Ana Muñoz"]["status"], "En curso")

    def test_15_followup_rules(self):
        d = self.ok("/followup", size=100)
        got = {(c["student"]["name"], c["rule"]) for c in d["items"]}
        self.assertEqual(got, {
            ("Ana Muñoz", "bajo_desempeno"), ("Ana Muñoz", "descenso"),
            ("Elena Gómez", "vencidas"), ("Gina Torres", "vencidas"),
            ("Hugo Inactivo", "inactividad"),
        })
        ana = next(c for c in d["items"] if c["rule"] == "bajo_desempeno")
        self.assertEqual([e["pct"] for e in ana["considered"]], [50.0, 45.0, 40.0])
        self.assertEqual(ana["evolution"], {"first": 50.0, "last": 40.0, "change": -10.0, "results": 3})
        self.assertTrue(ana["recommendations"])
        # Daniel solo dejó vencer una evaluación: no alcanza el mínimo
        self.assertNotIn("Daniel Ríos", {c["student"]["name"] for c in d["items"]})
        # Umbral configurable: con 40 % Ana ya no cumple la regla de bajo desempeño
        d = self.ok("/followup", threshold=40, size=100)
        self.assertNotIn(("Ana Muñoz", "bajo_desempeno"), {(c["student"]["name"], c["rule"]) for c in d["items"]})
        d = self.ok("/followup", rule="inactividad")
        self.assertEqual(d["total"], 1)
        self.assertEqual(self.get("/followup", rule="otra").status_code, 400)

    # ── Exportaciones ──────────────────────────────────────────────────────
    def test_16_exports(self):
        r = self.get("/export", section="resumen", format="csv")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("text/csv", r.headers["content-type"])
        text = r.content.decode("utf-8")
        self.assertTrue(text.startswith("﻿"))
        rows = list(csv.reader(io.StringIO(text[1:]), delimiter=";"))
        flat = [row for row in rows if row]
        self.assertTrue(any("Colegio Andino" in row[0] for row in flat))
        self.assertTrue(any(row[0].startswith("Filtros:") for row in flat))
        evaluated = next(row for row in flat if row[0] == "Estudiantes evaluados")
        self.assertEqual(evaluated[1], "6")
        math = next(row for row in flat if row[0] == "Pensamiento Lógico-Matemático")
        self.assertEqual(math[1], f"{r1(mean([45, 85, 75])):.1f}".replace(".", ","))
        self.assertIn('filename="reporte_resumen_institucion_', r.headers["content-disposition"])

        for section in ("resumen", "competencias", "grupos", "profesores", "evaluaciones", "seguimiento",
                        "evolucion", "calidad", "completo"):
            r = self.get("/export", section=section, format="pdf")
            self.assertEqual(r.status_code, 200, f"{section}: {r.text}")
            self.assertTrue(r.content.startswith(b"%PDF-1.4"), section)
            self.assertGreater(int(r.headers["X-Report-Rows"]), 0, section)

        r = self.get("/export", section="estudiante", format="pdf")
        self.assertEqual(r.status_code, 400)                       # requiere estudiante
        r = self.get("/export", section="estudiante", format="csv", student_id=self.ids["s1"])
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("Ana Muñoz", r.content.decode("utf-8"))
        r = self.get("/export", section="grupos", format="csv", classroom_id=self.ids["c3"])
        body = r.content.decode("utf-8")
        self.assertIn("Grupo: Ciencias 10A", body)
        self.assertNotIn("Mat 9A", body)
        self.assertEqual(self.get("/export", section="otra").status_code, 400)


if __name__ == "__main__":
    unittest.main()
