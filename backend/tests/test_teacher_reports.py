"""
NeuroLearn IA — Pruebas de la exportación de reportes (parche 6).

GET /teacher/reports/export genera archivos reales (CSV y PDF) con datos de
la base: alcance por profesor / súper profesor e institución, filtros de
grupo y fechas, sin archivos vacíos, y cifras iguales a las del Centro de
Analítica (GET /teacher/stats). SQLite en memoria.

Ejecutar desde backend/:

    python -m pytest tests/test_teacher_reports.py -v
    # o sin pytest:
    python -m unittest tests.test_teacher_reports -v
"""
from __future__ import annotations

import csv
import io
import os
import sys
import unittest
from datetime import datetime, timedelta

os.environ.setdefault("SECRET_KEY", "test-secret-key-para-pruebas-0123456789")
# BD en memoria: la prueba nunca toca neurolearn.db ni la base de producción.
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:?check_same_thread=False")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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

URL = "/api/v1/teacher/reports/export"


def parse_csv(content: bytes):
    text = content.decode("utf-8")
    assert text.startswith("﻿"), "falta el BOM UTF-8"
    rows = list(csv.reader(io.StringIO(text[1:]), delimiter=";"))
    header_idx = next(i for i, r in enumerate(rows) if r and r[0] in ("Estudiante", "Fecha", "Evaluación"))
    return rows[:header_idx], rows[header_idx], rows[header_idx + 1:]


class ReportExportTests(unittest.TestCase):
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

        profe = user("profe_rep", "Profe Reportes", UserRole.PROFESOR.value, a)
        sp = user("super_rep", "Rectora", UserRole.SUPER_PROFESOR.value, a)
        s1 = user("ana_rep", "Ana Muñoz", UserRole.ESTUDIANTE.value, a)
        s2 = user("beto_rep", "Beto Pérez", UserRole.ESTUDIANTE.value, a)
        s3 = user("caro_rep", "Carolina Díaz", UserRole.ESTUDIANTE.value, a)
        profe_b = user("profe_rep_b", "Profe B", UserRole.PROFESOR.value, b)
        sb = user("dani_rep_b", "Daniel Bravo", UserRole.ESTUDIANTE.value, b)
        db.flush()
        c9 = Classroom(name="Matemáticas 9A", subject="Matemáticas", grade="9", teacher_id=profe.id,
                       invite_code="REP9A1", is_active=True)
        c10 = Classroom(name="Física 10A", subject="Física", grade="10", teacher_id=profe.id,
                        invite_code="REP10A", is_active=True)
        cb = Classroom(name="Grupo B", subject="Mat", grade="9", teacher_id=profe_b.id,
                       invite_code="REPB01", is_active=True)
        db.add_all([c9, c10, cb])
        db.flush()
        for st, cl, risk in ((s1, c9, "medium"), (s2, c9, "none"), (s3, c10, "low"), (sb, cb, "high")):
            db.add(Enrollment(student_id=st.id, classroom_id=cl.id, is_active=True, risk_level=risk,
                              overall_progress=40.0))
        now = datetime.utcnow()
        # Día (hora de Colombia, UTC-5) del quiz de hace 20 días: los filtros usan hora local.
        cls.old_day = (now - timedelta(days=20) - timedelta(hours=5)).date()

        def quiz(st, score, days_ago, topic="Razonamiento cuantitativo"):
            done = now - timedelta(days=days_ago)
            db.add(QuizHistory(user_id=st.id, quiz_title="Quiz", topic=topic, difficulty="medio",
                               questions_count=5, correct_answers=int(score / 20), wrong_answers=5 - int(score / 20),
                               quiz_data={}, performance_score=score, created_at=done, completed_at=done,
                               time_spent_seconds=300))
        quiz(s1, 80.0, 1)
        quiz(s1, 60.0, 20, topic="Lectura crítica")
        quiz(s2, 100.0, 2)
        quiz(sb, 50.0, 1)                     # otra institución: nunca debe aparecer
        ev = TeacherEvaluation(teacher_id=profe.id, classroom_id=c9.id, title="Parcial fracciones",
                               group_name=c9.name, questions=[{"id": "q1", "type": "multiple", "text": "x",
                                                               "options": ["a", "b"], "correct": "a", "points": 4}],
                               status="publicada", published_at=now, duration=30, attempts=2)
        db.add(ev)
        db.flush()
        db.add(EvaluationSubmission(evaluation_id=ev.id, student_id=s1.id, classroom_id=c9.id, attempt_number=1,
                                    status="calificada", score=3.0, max_score=4.0, percentage=75.0,
                                    started_at=now - timedelta(hours=2), expires_at=now - timedelta(hours=1),
                                    submitted_at=now - timedelta(hours=1)))
        db.commit()
        cls.c9, cls.c10, cls.cb = c9.id, c10.id, cb.id
        tokens = {"profe": profe, "super": sp, "s1": s1, "profe_b": profe_b}
        cls.h = {k: {"Authorization": "Bearer " + create_access_token({"sub": u.username})} for k, u in tokens.items()}
        db.close()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)

    def get(self, who="profe", **params):
        return self.client.get(URL, headers=self.h[who], params=params)

    def test_01_summary_csv_matches_dashboard(self):
        r = self.get()
        self.assertEqual(r.status_code, 200, r.text)
        self.assertIn("text/csv", r.headers["content-type"])
        self.assertIn('filename="reporte_resumen_todos.csv"', r.headers["content-disposition"])
        meta, header, rows = parse_csv(r.content)
        self.assertEqual(header[0], "Estudiante")
        by_name = {row[0]: row for row in rows}
        self.assertEqual(set(by_name), {"Ana Muñoz", "Beto Pérez", "Carolina Díaz"})   # sin la otra institución
        ana = by_name["Ana Muñoz"]
        self.assertEqual(ana[3], "2")            # quizzes
        self.assertEqual(ana[4], "70,0")         # promedio con coma decimal
        self.assertEqual(ana[5], "1 / 1")        # evaluaciones entregadas
        self.assertEqual(ana[6], "75,0")
        self.assertEqual(ana[8], "Medio")
        self.assertEqual(by_name["Carolina Díaz"][5], "0 / 0")
        self.assertTrue(any("Colegio Andino" in line[0] for line in meta))

        # Mismas cifras que el Centro de Analítica
        stats = self.client.get("/api/v1/teacher/stats", headers=self.h["profe"]).json()
        self.assertEqual(stats["total_students"], len(rows))
        self.assertEqual(stats["total_groups"], 2)
        avg_pct = (80 + 60 + 100) / 3
        self.assertAlmostEqual(stats["avg_global"], round(avg_pct / 10, 1))
        self.assertTrue(any(f"Promedio quizzes: {avg_pct:.1f}%" in line[0] for line in meta))

    def test_02_filters(self):
        _, _, rows = parse_csv(self.get(classroom_id=self.c9).content)
        self.assertEqual({r[0] for r in rows}, {"Ana Muñoz", "Beto Pérez"})
        self.assertEqual(self.get(classroom_id=self.cb).status_code, 404)        # grupo de otro profesor
        recent = (datetime.utcnow() - timedelta(days=5)).date().isoformat()
        r = self.get(report="quizzes", start_date=recent)
        _, header, rows = parse_csv(r.content)
        self.assertEqual(len(rows), 2)                                          # se excluye el quiz de hace 20 días
        self.assertIn(f"reporte_quizzes_todos_", r.headers["content-disposition"])
        r = self.get(report="quizzes", start_date=self.old_day.isoformat(), end_date=self.old_day.isoformat())
        _, _, rows = parse_csv(r.content)
        self.assertEqual([row[4] for row in rows], ["Lectura crítica"])

    def test_03_no_empty_files_and_validation(self):
        future = (datetime.utcnow() + timedelta(days=30)).date().isoformat()
        r = self.get(report="quizzes", start_date=future)
        self.assertEqual(r.status_code, 404)
        self.assertIn("No hay quizzes", r.json()["detail"])
        r = self.get(report="evaluaciones", classroom_id=self.c10)
        self.assertEqual(r.status_code, 404)
        self.assertEqual(self.get(start_date="2026-10-10", end_date="2026-10-01").status_code, 400)
        self.assertEqual(self.get(start_date="10/10/2026").status_code, 400)
        self.assertEqual(self.get(format="xlsx").status_code, 422)

    def test_04_pdf_is_real_and_readable(self):
        from pypdf import PdfReader
        r = self.get(report="evaluaciones", format="pdf")
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.headers["content-type"], "application/pdf")
        self.assertTrue(r.content.startswith(b"%PDF-1.4"))
        text = "\n".join(page.extract_text() for page in PdfReader(io.BytesIO(r.content)).pages)
        for expected in ("Reporte de evaluaciones", "Parcial fracciones", "Ana Muñoz", "Sin entregar", "75.0"):
            self.assertIn(expected, text)

    def test_05_pdf_paginates_many_rows(self):
        from pypdf import PdfReader
        db = self.Session()
        s1 = db.query(User).filter_by(username="ana_rep").first()
        for i in range(80):
            db.add(QuizHistory(user_id=s1.id, quiz_title="Q", topic=f"Tema {i}", difficulty="facil",
                               questions_count=5, correct_answers=3, wrong_answers=2, quiz_data={},
                               performance_score=60.0, completed_at=datetime.utcnow(), time_spent_seconds=60))
        db.commit()
        db.close()
        r = self.get(report="quizzes", format="pdf")
        reader = PdfReader(io.BytesIO(r.content))
        self.assertGreater(len(reader.pages), 1)
        self.assertIn("Página 1 de", reader.pages[0].extract_text())

    def test_06_permissions_and_institution(self):
        self.assertEqual(self.get(who="s1").status_code, 403)
        _, _, rows = parse_csv(self.get(who="super").content)                   # toda su institución
        self.assertEqual({r[0] for r in rows}, {"Ana Muñoz", "Beto Pérez", "Carolina Díaz"})
        _, _, rows = parse_csv(self.get(who="profe_b").content)
        self.assertEqual({r[0] for r in rows}, {"Daniel Bravo"})
        self.assertEqual(self.get(who="profe_b", classroom_id=self.c9).status_code, 404)


if __name__ == "__main__":
    unittest.main(verbosity=2)
