"""
NeuroLearn IA — Auditoría del rol Súper Profesor (dashboard, grupos, NeuroBots,
NeuroAlertas, comunicados, configuración y auditoría de usuarios).

Cada prueba compara lo que devuelve la API con los registros que se crearon en
la base de datos, e intenta las mismas operaciones desde otra institución.

SQLite en memoria. Ejecutar desde backend/:

    python -m pytest tests/test_auditoria_super_profesor.py -v
"""
from __future__ import annotations

import json
import os
import sys
import unittest
import unittest.mock
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.alert_ack import AlertAcknowledgement  # noqa: E402
from app.models.classroom import Classroom, ClassroomBot, Enrollment  # noqa: E402
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import AuditLog, Institution  # noqa: E402
from app.models.messages import DirectMessage  # noqa: E402
from app.models.neurobot_assignment import StudentBotAssignment  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"


class SuperProfesorAuditTests(unittest.TestCase):
    def setUp(self):
        engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        Base.metadata.create_all(bind=engine)
        self.Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

        def _get_db():
            db = self.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = _get_db
        self.client = TestClient(app, raise_server_exceptions=False)

        db = self.Session()
        inst_a = Institution(name="Colegio A", dane_code="41100000001", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="41100000002", is_active=True)
        db.add_all([inst_a, inst_b])
        db.flush()
        self.inst_a, self.inst_b = inst_a.id, inst_b.id
        self.ids = {}
        for username, role, inst, name, grade, active in (
            ("super_a", UserRole.SUPER_PROFESOR, inst_a, "Rectora A", None, True),
            ("profe_a", UserRole.PROFESOR, inst_a, "Profe Ana", None, True),
            ("profe_a2", UserRole.PROFESOR, inst_a, "Profe Beto", None, True),
            ("profe_ex", UserRole.PROFESOR, inst_a, "Profe Retirado", None, False),
            ("est1", UserRole.ESTUDIANTE, inst_a, "Juan Pérez", "9", True),
            ("est2", UserRole.ESTUDIANTE, inst_a, "Laura Gómez", "9", True),
            ("est3", UserRole.ESTUDIANTE, inst_a, "Pedro Ruiz", "10", True),
            ("est_off", UserRole.ESTUDIANTE, inst_a, "Inactivo", "9", False),
            ("super_b", UserRole.SUPER_PROFESOR, inst_b, "Rector B", None, True),
            ("profe_b", UserRole.PROFESOR, inst_b, "Profe Carla", None, True),
            ("est_b", UserRole.ESTUDIANTE, inst_b, "Mario B", "9", True),
        ):
            u = User(username=username, email=f"{username}@test.edu.co", full_name=name, hashed_password="x",
                     role=role.value, institution_id=inst.id, is_active=active, grade=grade)
            db.add(u)
            db.flush()
            self.ids[username] = u.id

        now = datetime.utcnow()
        c_mat = Classroom(teacher_id=self.ids["profe_a"], name="Matemáticas 9A", subject="Matemáticas",
                          grade="9", invite_code="AUDMAT01", is_active=True, max_students=40)
        c_fis = Classroom(teacher_id=self.ids["profe_a2"], name="Física 10A", subject="Física",
                          grade="10", invite_code="AUDFIS01", is_active=True, max_students=40)
        c_old = Classroom(teacher_id=self.ids["profe_a"], name="Grupo cerrado", subject="Química",
                          grade="9", invite_code="AUDOLD01", is_active=False, max_students=40)
        c_b = Classroom(teacher_id=self.ids["profe_b"], name="Grupo B", subject="Química",
                        grade="9", invite_code="AUDB0001", is_active=True, max_students=40)
        db.add_all([c_mat, c_fis, c_old, c_b])
        db.flush()
        self.c_mat, self.c_fis, self.c_b = c_mat.id, c_fis.id, c_b.id
        enr = [
            # est1: activo, buen promedio, riesgo alto en Matemáticas
            Enrollment(student_id=self.ids["est1"], classroom_id=c_mat.id, total_sessions=5,
                       average_score=80, last_activity=now - timedelta(days=1),
                       risk_level="high", risk_factors=["fatiga"]),
            # est1 también en Física: riesgo medio (el peor es el alto)
            Enrollment(student_id=self.ids["est1"], classroom_id=c_fis.id, total_sessions=3,
                       average_score=30, last_activity=now - timedelta(days=2),
                       risk_level="medium", risk_factors=["frustración"]),
            # est2: inscrita sin sesiones (no debe bajar promedios a 0)
            Enrollment(student_id=self.ids["est2"], classroom_id=c_mat.id, total_sessions=0,
                       average_score=0, risk_level="none"),
            # est3: inactivo hace 20 días en Física
            Enrollment(student_id=self.ids["est3"], classroom_id=c_fis.id, total_sessions=2,
                       average_score=60, last_activity=now - timedelta(days=20), risk_level="none"),
            # est_off (cuenta desactivada): no cuenta en nada
            Enrollment(student_id=self.ids["est_off"], classroom_id=c_mat.id, total_sessions=4,
                       average_score=10, risk_level="high", risk_factors=["x"]),
            Enrollment(student_id=self.ids["est_b"], classroom_id=c_b.id, total_sessions=1,
                       average_score=50, risk_level="high"),
        ]
        db.add_all(enr)
        bot_ex = ExpertBot(creator_id=self.ids["profe_ex"], name="Bot de profe retirado", category="Química",
                           is_public=True, is_active=True)
        bot_a = ExpertBot(creator_id=self.ids["profe_a"], name="Tutor Álgebra", category="Matemáticas",
                          is_public=False, is_active=True)
        bot_b = ExpertBot(creator_id=self.ids["profe_b"], name="Bot B", category="Química", is_active=True)
        db.add_all([bot_ex, bot_a, bot_b])
        db.flush()
        self.bot_ex, self.bot_a, self.bot_b = bot_ex.id, bot_a.id, bot_b.id
        db.add(ClassroomBot(classroom_id=c_mat.id, bot_id=bot_a.id))
        db.add(StudentBotAssignment(bot_id=bot_a.id, student_id=self.ids["est3"], teacher_id=self.ids["profe_a"],
                                    goal_interactions=5))
        db.commit()
        db.close()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    # ── Dashboard ─────────────────────────────────────────────────────────
    def test_dashboard_counts_and_averages_match_records(self):
        r = self.client.get(f"{API}/super/stats/dashboard", headers=self.h("super_a"))
        self.assertEqual(r.status_code, 200, r.text)
        d = r.json()
        self.assertEqual(d["total_teachers"], 2)        # profe_ex desactivado no cuenta
        self.assertEqual(d["total_students"], 3)        # est_off no cuenta; est_b es de otra institución
        self.assertEqual(d["total_groups"], 2)          # el grupo cerrado no cuenta
        self.assertEqual(d["at_risk_count"], 1)         # solo est1 (est_off desactivado)
        self.assertIsNone(d["avg_score"])               # sin quizzes: sin dato, no 0
        risk = d["at_risk_detail"][0]
        self.assertEqual((risk["name"], risk["risk"], risk["subject"], risk["avg"]),
                         ("Juan Pérez", "high", "Matemáticas", 8.0))
        ranking = {t["name"]: t for t in d["teacher_ranking"]}
        # Matemáticas: solo est1 tiene sesiones → 8.0 (est2 sin sesiones no baja a 4.0)
        self.assertEqual(ranking["Profe Ana"]["avg"], 8.0)
        self.assertEqual(ranking["Profe Ana"]["students"], 2)
        self.assertEqual(ranking["Profe Ana"]["participation"], 50)
        self.assertEqual(ranking["Profe Beto"]["avg"], 4.5)  # (30 + 60) / 2
        perf = {a["label"]: a for a in d["areas_performance"]}
        self.assertEqual(perf["Matemáticas"]["avg_pct"], 80.0)
        self.assertEqual(perf["Física"]["avg_pct"], 45.0)
        self.assertEqual({a["label"]: a["groups"] for a in d["areas_data"]}, {"Matemáticas": 1, "Física": 1})
        self.assertNotIn("students_detail", d)

    # ── Grupos ────────────────────────────────────────────────────────────
    def test_classrooms_average_ignores_students_without_sessions(self):
        r = self.client.get(f"{API}/super/classrooms", headers=self.h("super_a"))
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        by_name = {c["name"]: c for c in data["classrooms"]}
        self.assertEqual(set(by_name), {"Matemáticas 9A", "Física 10A", "Grupo cerrado"})
        self.assertEqual(by_name["Matemáticas 9A"]["students"], 2)    # est_off excluido
        self.assertEqual(by_name["Matemáticas 9A"]["avg"], 8.0)
        self.assertIsNone(by_name["Grupo cerrado"]["avg"])
        self.assertEqual(data["unique_students"], 3)   # est1 está en dos grupos y cuenta una vez
        detail = self.client.get(f"{API}/super/classrooms/{self.c_mat}", headers=self.h("super_a")).json()
        avgs = {s["name"]: s["avg"] for s in detail["students"]}
        self.assertEqual(avgs, {"Juan Pérez": 8.0, "Laura Gómez": None})
        self.assertEqual(self.client.get(f"{API}/super/classrooms/{self.c_b}", headers=self.h("super_a")).status_code, 404)

    def test_super_creates_and_edits_groups_for_institution_teachers(self):
        h = self.h("super_a")
        body = {"name": "Lectura 11B", "subject": "Lectura crítica", "grade": "11", "teacher_id": self.ids["profe_a2"]}
        r = self.client.post(f"{API}/super/classrooms", headers=h, json=body)
        self.assertEqual(r.status_code, 201, r.text)
        cid = r.json()["id"]
        # El profesor asignado lo ve en sus grupos y recibe la notificación
        mine = self.client.get(f"{API}/classrooms/my-classes", headers=self.h("profe_a2")).json()["classrooms"]
        self.assertIn(cid, [c["id"] for c in mine])
        notes = self.client.get(f"{API}/notifications", headers=self.h("profe_a2")).json()
        items = notes.get("notifications", notes.get("items", []))
        self.assertTrue(any(n.get("resource_id") == cid for n in items))
        # Edición de datos
        r = self.client.patch(f"{API}/super/classrooms/{cid}", headers=h, json={"name": "Lectura 11C", "grade": "11"})
        self.assertEqual(r.status_code, 200, r.text)
        db = self.Session()
        self.assertEqual(db.get(Classroom, cid).name, "Lectura 11C")
        db.close()
        self.assertEqual(self.client.patch(f"{API}/super/classrooms/{cid}", headers=h, json={"name": " "}).status_code, 400)
        # Profesor de otra institución, inactivo o un estudiante: rechazado
        for tid in (self.ids["profe_b"], self.ids["profe_ex"], self.ids["est1"]):
            self.assertEqual(self.client.post(f"{API}/super/classrooms", headers=h,
                                              json={**body, "teacher_id": tid}).status_code, 400)
        self.assertEqual(self.client.post(f"{API}/super/classrooms", headers=self.h("profe_a"), json=body).status_code, 403)
        self.assertEqual(self.client.patch(f"{API}/super/classrooms/{cid}", headers=self.h("super_b"),
                                           json={"name": "X"}).status_code, 404)
        cats = self.client.get(f"{API}/super/audit", headers=h, params={"category": "create"}).json()
        self.assertIn("create_classroom", [lg["action"] for lg in cats["logs"]])

    # ── NeuroBots ─────────────────────────────────────────────────────────
    def test_bots_include_inactive_teachers_and_individual_assignments(self):
        r = self.client.get(f"{API}/super/bots", headers=self.h("super_a"))
        self.assertEqual(r.status_code, 200, r.text)
        bots = {b["id"]: b for b in r.json()["bots"]}
        self.assertEqual(set(bots), {self.bot_ex, self.bot_a})        # nunca el de la institución B
        self.assertFalse(bots[self.bot_ex]["teacherActive"])
        self.assertEqual(bots[self.bot_ex]["groups"], [])
        self.assertEqual(bots[self.bot_a]["groups"], ["Matemáticas 9A"])
        self.assertEqual(bots[self.bot_a]["individualAssignments"], 1)
        # El Súper Profesor modera bots de un profesor desactivado de su institución
        self.assertEqual(self.client.patch(f"{API}/bots/{self.bot_ex}", headers=self.h("super_a"),
                                           json={"is_active": False}).status_code, 200)
        self.assertEqual(self.client.patch(f"{API}/bots/{self.bot_ex}", headers=self.h("super_b"),
                                           json={"is_active": True}).status_code, 403)

    # ── NeuroAlertas ──────────────────────────────────────────────────────
    def test_super_alerts_resolve_persists_and_reopens_when_condition_changes(self):
        r = self.client.get(f"{API}/super/stats/alerts", headers=self.h("super_a"))
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        names = {a["studentName"] for a in data["alerts"]}
        self.assertNotIn("Inactivo", names)
        self.assertNotIn("Mario B", names)
        ids = [a["id"] for a in data["alerts"]]
        self.assertEqual(len(ids), len(set(ids)))
        self.assertEqual(data["active"], data["total"])
        self.assertEqual(sum(data["counts"].values()), data["active"])
        inact = next(a for a in data["alerts"] if a["category"] == "Inactividad")
        self.assertEqual(inact["studentName"], "Pedro Ruiz")
        self.assertEqual(inact["priority"], "alta")

        r = self.client.post(f"{API}/super/stats/alerts/{inact['id']}/resolve", headers=self.h("super_a"))
        self.assertEqual(r.status_code, 200, r.text)
        data = self.client.get(f"{API}/super/stats/alerts", headers=self.h("super_a")).json()
        self.assertTrue(next(a for a in data["alerts"] if a["id"] == inact["id"])["resolved"])
        self.assertEqual(data["active"], data["total"] - 1)
        # Otro usuario de la institución no hereda la marca; otra institución no puede marcarla
        self.assertEqual(self.client.post(f"{API}/super/stats/alerts/{inact['id']}/resolve",
                                          headers=self.h("super_b")).status_code, 404)
        self.assertEqual(self.client.post(f"{API}/super/stats/alerts/{inact['id']}/resolve",
                                          headers=self.h("profe_a")).status_code, 403)

        # La condición cambia (nueva actividad, aún > 7 días): la alerta vuelve a estar activa
        db = self.Session()
        e = db.query(Enrollment).filter_by(student_id=self.ids["est3"]).first()
        e.last_activity = datetime.utcnow() - timedelta(days=9)
        db.commit()
        db.close()
        data = self.client.get(f"{API}/super/stats/alerts", headers=self.h("super_a")).json()
        self.assertFalse(next(a for a in data["alerts"] if a["id"] == inact["id"])["resolved"])

        # Reabrir explícitamente
        self.client.post(f"{API}/super/stats/alerts/{inact['id']}/resolve", headers=self.h("super_a"))
        self.client.post(f"{API}/super/stats/alerts/{inact['id']}/resolve?resolved=false", headers=self.h("super_a"))
        db = self.Session()
        self.assertEqual(db.query(AlertAcknowledgement).count(), 0)
        db.close()

    def test_teacher_alerts_have_unique_ids_and_resolve_is_scoped(self):
        r = self.client.get(f"{API}/classrooms/{self.c_fis}/alerts", headers=self.h("profe_a2"))
        self.assertEqual(r.status_code, 200, r.text)
        alerts = r.json()["alerts"]
        ids = [a["id"] for a in alerts]
        self.assertEqual(len(ids), len(set(ids)))
        est1 = [a for a in alerts if a["student"] == "Juan Pérez"]
        self.assertEqual({a["type"] for a in est1}, {"low_performance", "cognitive_risk"})
        self.assertEqual(est1[0]["average_score"], 30.0)
        target = est1[0]["id"]
        self.assertEqual(self.client.post(f"{API}/classrooms/{self.c_fis}/alerts/{target}/resolve",
                                          headers=self.h("profe_a")).status_code, 403)
        self.assertEqual(self.client.post(f"{API}/classrooms/{self.c_fis}/alerts/{target}/resolve",
                                          headers=self.h("profe_a2")).status_code, 200)
        again = self.client.get(f"{API}/classrooms/{self.c_fis}/alerts", headers=self.h("profe_a2")).json()["alerts"]
        self.assertTrue(next(a for a in again if a["id"] == target)["resolved"])
        mat = self.client.get(f"{API}/classrooms/{self.c_mat}/alerts", headers=self.h("profe_a")).json()["alerts"]
        self.assertNotIn("Inactivo", {a["student"] for a in mat})
        self.assertIsNone(next(a for a in mat if a["student"] == "Laura Gómez")["average_score"])

    # ── Mis grupos del profesor ───────────────────────────────────────────
    def test_teacher_classes_average_and_regenerate_code(self):
        r = self.client.get(f"{API}/classrooms/my-classes", headers=self.h("profe_a"))
        self.assertEqual(r.status_code, 200, r.text)
        mat = next(c for c in r.json()["classrooms"] if c["id"] == self.c_mat)
        self.assertEqual(mat["avg"], 8.0)
        r = self.client.post(f"{API}/classrooms/{self.c_mat}/regenerate-code", headers=self.h("profe_a"))
        self.assertEqual(r.status_code, 200, r.text)
        new_code = r.json()["invite_code"]
        self.assertNotEqual(new_code, "AUDMAT01")
        db = self.Session()
        self.assertEqual(db.get(Classroom, self.c_mat).invite_code, new_code)
        db.close()
        self.assertEqual(self.client.post(f"{API}/classrooms/{self.c_mat}/regenerate-code",
                                          headers=self.h("profe_a2")).status_code, 403)
        self.assertEqual(self.client.post(f"{API}/classrooms/{self.c_mat}/regenerate-code",
                                          headers=self.h("est1")).status_code, 403)
        # El código anterior ya no sirve para unirse
        r = self.client.post(f"{API}/classrooms/join", headers=self.h("est3"), json={"invite_code": "AUDMAT01"})
        self.assertIn(r.status_code, (400, 404))

    # ── Comunicados ───────────────────────────────────────────────────────
    def test_broadcast_reads_count_only_its_own_messages(self):
        h = self.h("super_a")
        r = self.client.post(f"{API}/super/broadcasts", headers=h,
                             data={"subject": "Reunión", "body": "Viernes 7 a. m.", "recipient_type": "profesores"})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual(r.json()["total"], 2)         # profe_ex desactivado no recibe
        r2 = self.client.post(f"{API}/super/broadcasts", headers=h,
                              data={"subject": "Otro", "body": "Texto", "recipient_type": "profesores"})
        self.assertEqual(r2.status_code, 201)
        db = self.Session()
        for m in db.query(DirectMessage).filter(DirectMessage.content.like("%Otro%")).all():
            m.is_read = True
        db.commit()
        db.close()
        sent = {b["subject"]: b for b in self.client.get(f"{API}/super/broadcasts", headers=h).json()["broadcasts"]}
        self.assertEqual((sent["Otro"]["reads"], sent["Otro"]["total"]), (2, 2))
        self.assertEqual(sent["Reunión"]["reads"], 0)   # antes contaba también las lecturas de «Otro»

    def test_broadcast_by_grade_requires_grade_and_targets_students_only(self):
        h = self.h("super_a")
        r = self.client.post(f"{API}/super/broadcasts", headers=h,
                             data={"subject": "A", "body": "B", "recipient_type": "grado"})
        self.assertEqual(r.status_code, 400)
        db = self.Session()
        self.assertEqual(db.query(DirectMessage).count(), 0)   # antes iba a toda la institución
        db.close()
        r = self.client.post(f"{API}/super/broadcasts", headers=h,
                             data={"subject": "A", "body": "B", "recipient_type": "grado", "grade": "9"})
        self.assertEqual(r.status_code, 201, r.text)
        db = self.Session()
        receivers = {m.receiver_id for m in db.query(DirectMessage).all()}
        db.close()
        self.assertEqual(receivers, {self.ids["est1"], self.ids["est2"]})
        self.assertEqual(self.client.post(f"{API}/super/broadcasts", headers=self.h("profe_a"),
                                          data={"subject": "A", "body": "B"}).status_code, 403)

    # ── Configuración ─────────────────────────────────────────────────────
    def test_institution_dane_must_be_unique(self):
        r = self.client.patch(f"{API}/super/institution", headers=self.h("super_a"), json={"dane_code": "41100000002"})
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"{API}/super/institution", headers=self.h("super_a"), json={"name": "  "})
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"{API}/super/institution", headers=self.h("super_a"), json={"name": "Colegio A Renombrado"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["name"], "Colegio A Renombrado")

    def test_institution_logo_is_validated_and_shown_to_its_users(self):
        import base64
        png = "data:image/png;base64," + base64.b64encode(b"\x89PNG\r\n\x1a\n" + b"0" * 100).decode()
        h = self.h("super_a")
        for bad in ("https://otro.sitio/logo.png", "data:image/svg+xml;base64,PHN2Zz4=",
                    "data:image/png;base64,@@@", "data:image/png;base64,"
                    + base64.b64encode(b"0" * (2 * 1024 * 1024 + 1)).decode()):
            self.assertEqual(self.client.patch(f"{API}/super/institution", headers=h,
                                               json={"logo_url": bad}).status_code, 400, bad[:40])
        r = self.client.patch(f"{API}/super/institution", headers=h, json={"logo_url": png})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn("primary_color", r.json())
        for user in ("profe_a", "est1", "super_a"):
            b = self.client.get(f"{API}/auth/institution-branding", headers=self.h(user)).json()
            self.assertEqual((b["name"], b["logo_url"]), ("Colegio A", png))
        self.assertIsNone(self.client.get(f"{API}/auth/institution-branding", headers=self.h("est_b")).json()["logo_url"])
        self.assertEqual(self.client.patch(f"{API}/super/institution", headers=self.h("profe_a"),
                                           json={"logo_url": png}).status_code, 403)
        # Quitar el logo
        self.assertEqual(self.client.patch(f"{API}/super/institution", headers=h, json={"logo_url": ""}).status_code, 200)
        self.assertIsNone(self.client.get(f"{API}/auth/institution-branding", headers=self.h("est1")).json()["logo_url"])

    # ── Auditoría de usuarios ─────────────────────────────────────────────
    def test_user_edits_and_deactivations_are_audited(self):
        h = self.h("super_a")
        self.assertEqual(self.client.put(f"{API}/super/teachers/{self.ids['profe_a2']}", headers=h,
                                         json={"subject_area": "Física"}).status_code, 200)
        self.assertEqual(self.client.put(f"{API}/super/students/{self.ids['est2']}", headers=h,
                                         json={"grade": "10"}).status_code, 200)
        self.assertEqual(self.client.delete(f"{API}/super/students/{self.ids['est3']}", headers=h).status_code, 200)
        self.assertEqual(self.client.post(f"{API}/super/teachers/bulk-delete", headers=h,
                                          json={"ids": [self.ids["profe_a2"], self.ids["profe_b"]]}).json()["deleted"], 1)
        db = self.Session()
        actions = sorted((lg.action, lg.target_user_id) for lg in db.query(AuditLog).all())
        db.close()
        self.assertEqual(actions, sorted([
            ("update_teacher", self.ids["profe_a2"]),
            ("update_student", self.ids["est2"]),
            ("deactivate_student", self.ids["est3"]),
            ("deactivate_teacher", self.ids["profe_a2"]),
        ]))
        # La otra institución no puede tocar a estos usuarios
        self.assertEqual(self.client.put(f"{API}/super/students/{self.ids['est1']}", headers=self.h("super_b"),
                                         json={"grade": "11"}).status_code, 404)
        audit = self.client.get(f"{API}/super/audit", headers=h).json()
        self.assertEqual(audit["total"], 4)
        # Filtros en el servidor (antes solo sobre los 50 últimos, en el navegador)
        self.assertEqual(self.client.get(f"{API}/super/audit", headers=h,
                                         params={"category": "delete"}).json()["total"], 2)
        found = self.client.get(f"{API}/super/audit", headers=h, params={"q": "Laura"}).json()
        self.assertEqual([lg["action"] for lg in found["logs"]], ["update_student"])
        today = datetime.utcnow().strftime("%Y-%m-%d")
        self.assertEqual(self.client.get(f"{API}/super/audit", headers=h,
                                         params={"date_from": today, "date_to": today}).json()["total"], 4)
        self.assertEqual(self.client.get(f"{API}/super/audit", headers=h,
                                         params={"date_to": "2000-01-01"}).json()["total"], 0)
        self.assertEqual(self.client.get(f"{API}/super/audit", headers=h,
                                         params={"date_from": "ayer"}).status_code, 400)
        self.assertEqual(self.client.get(f"{API}/super/audit", headers=self.h("super_b")).json()["total"], 0)

    def test_audit_broadcast_description_is_readable(self):
        h = self.h("super_a")
        self.client.post(f"{API}/super/broadcasts", headers=h,
                         data={"subject": "Izada", "body": "Lunes", "recipient_type": "profesores"})
        log = self.client.get(f"{API}/super/audit", headers=h, params={"category": "broadcast"}).json()["logs"][0]
        self.assertEqual(log["description"], "Comunicado «Izada» a Solo profesores (2 destinatarios)")
        self.assertNotIn("recipient_ids", log["description"])

    # ── Carga masiva de estudiantes ───────────────────────────────────────
    def _csv(self, rows):
        head = "nombre_completo,tipo_documento,numero_documento,grado,correo\n"
        return {"file": ("lote.csv", head + "\n".join(rows) + "\n", "text/csv")}

    def test_bulk_students_enroll_in_group_and_validate_like_preview(self):
        rows = [
            "Ana Uno,TI,9000001,9,ana1@test.edu.co",
            "Beto Dos,TI,9000002,9,est1@test.edu.co",     # correo ya existe
            "Caro Tres,TI,9000003,9,ana1@test.edu.co",    # correo repetido en el archivo
            "Dani Cuatro,TI,9000001,9,",                  # documento repetido en el archivo
            "Eva Cinco,TI,9000005,9,",
        ]
        h = self.h("super_a")
        preview = self.client.post(f"{API}/super/students/preview", headers=h, files=self._csv(rows)).json()
        self.assertEqual((preview["total_valid"], preview["total_errors"]), (2, 3))
        with unittest.mock.patch("app.api.credentials.send_credentials_email") as sent:
            r = self.client.post(f"{API}/super/students/bulk", headers=h, files=self._csv(rows),
                                 data={"classroom_id": str(self.c_mat)})
        self.assertEqual(r.status_code, 201, r.text)
        d = r.json()
        # Lo que la vista previa marcó como válido es exactamente lo que se crea
        self.assertEqual((d["total_created"], d["total_errors"]), (preview["total_valid"], preview["total_errors"]))
        self.assertEqual((d["enrolled"], d["classroom"]), (2, "Matemáticas 9A"))
        self.assertEqual(sent.call_count, 1)    # solo la fila con correo real
        db = self.Session()
        ana = db.query(User).filter_by(document_number="9000001").one()
        self.assertEqual(db.query(Enrollment).filter_by(student_id=ana.id, classroom_id=self.c_mat).count(), 1)
        db.close()
        # El profesor del grupo ve a los nuevos estudiantes
        names = {s["student_name"] for s in self.client.get(f"{API}/classrooms/{self.c_mat}/students",
                                                             headers=self.h("profe_a")).json()}
        self.assertTrue({"Ana Uno", "Eva Cinco"} <= names)

    def test_bulk_students_rejects_foreign_or_inactive_group_and_full_group(self):
        h = self.h("super_a")
        rows = ["Fer Seis,TI,9000006,9,"]
        self.assertEqual(self.client.post(f"{API}/super/students/bulk", headers=h, files=self._csv(rows),
                                          data={"classroom_id": str(self.c_b)}).status_code, 404)
        db = self.Session()
        old = db.query(Classroom).filter_by(invite_code="AUDOLD01").one()
        old_id = old.id
        db.get(Classroom, self.c_fis).max_students = 2   # ya tiene 2 inscritos
        db.commit()
        db.close()
        self.assertEqual(self.client.post(f"{API}/super/students/bulk", headers=h, files=self._csv(rows),
                                          data={"classroom_id": str(old_id)}).status_code, 400)
        r = self.client.post(f"{API}/super/students/bulk", headers=h, files=self._csv(rows),
                             data={"classroom_id": str(self.c_fis)})
        self.assertEqual(r.status_code, 201, r.text)
        self.assertEqual((r.json()["total_created"], r.json()["enrolled"]), (0, 0))
        self.assertIn("cupos", r.json()["errors"][0]["error"])
        db = self.Session()
        self.assertIsNone(db.query(User).filter_by(document_number="9000006").first())
        db.close()


if __name__ == "__main__":
    unittest.main()
