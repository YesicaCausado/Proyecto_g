"""
Escenario E de la auditoría del rol Profesor: accesos cruzados entre dos
profesores de la MISMA institución (la auditoría anterior ya cubre otra
institución). «profe2» llama a los endpoints con los identificadores de los
recursos de «profe» manipulando la URL: todo debe responder 4xx y los datos
deben quedar intactos. También comprueba que un estudiante ajeno al grupo no
ve el material compartido y que el profesor no edita eventos institucionales.
"""
from __future__ import annotations

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token  # noqa: E402
from app.api.teacher_materials import TeacherFolder, TeacherMaterial  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.evaluation import TeacherEvaluation  # noqa: E402
from app.models.events import ClassroomEvent  # noqa: E402
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.posts import Post  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"


class ProfesorAccesosCruzadosTests(unittest.TestCase):
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
        inst = Institution(name="Colegio A", dane_code="51100000077", is_active=True)
        db.add(inst)
        db.flush()
        self.ids = {}
        for username, role in (("super", UserRole.SUPER_PROFESOR), ("profe", UserRole.PROFESOR),
                               ("profe2", UserRole.PROFESOR), ("est1", UserRole.ESTUDIANTE),
                               ("est2", UserRole.ESTUDIANTE)):
            u = User(username=username, email=f"{username}@t.edu.co", full_name=username.title(),
                     hashed_password="x", role=role.value, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        c = Classroom(teacher_id=self.ids["profe"], name="Física 10A", subject="Física", grade="10",
                      invite_code="CRUCE001", is_active=True, max_students=40)
        c2 = Classroom(teacher_id=self.ids["profe2"], name="Química 10B", subject="Química", grade="10",
                       invite_code="CRUCE002", is_active=True, max_students=40)
        db.add_all([c, c2])
        db.flush()
        db.add(Enrollment(student_id=self.ids["est1"], classroom_id=c.id, is_active=True))
        db.add(Enrollment(student_id=self.ids["est2"], classroom_id=c2.id, is_active=True))
        ev = TeacherEvaluation(teacher_id=self.ids["profe"], classroom_id=c.id, title="Parcial",
                               group_name=c.name, questions=[], status="borrador")
        folder = TeacherFolder(teacher_id=self.ids["profe"], name="Guías")
        db.add_all([ev, folder])
        db.flush()
        mat = TeacherMaterial(folder_id=folder.id, teacher_id=self.ids["profe"], name="Guía 1", file_type="pdf",
                              size="1 KB", shared_with=[c.id], original_name="guia.pdf",
                              mime_type="application/pdf", has_file=True, content=b"%PDF-1.4")
        bot = ExpertBot(creator_id=self.ids["profe"], name="Bot Física", category="Física",
                        is_public=False, is_active=True)
        event = ClassroomEvent(classroom_id=c.id, teacher_id=self.ids["profe"], institution_id=inst.id,
                               title="Laboratorio", event_type="clase", event_date="2026-10-30")
        inst_event = ClassroomEvent(classroom_id=None, teacher_id=self.ids["super"], institution_id=inst.id,
                                    title="Izada de bandera", event_type="evento", event_date="2026-10-31")
        post = Post(classroom_id=c.id, teacher_id=self.ids["profe"], title="Tarea 1", content="x")
        db.add_all([mat, bot, event, inst_event, post])
        db.commit()
        self.r = {"c": c.id, "eval": ev.id, "folder": folder.id, "mat": mat.id, "bot": bot.id,
                  "event": event.id, "inst_event": inst_event.id, "post": post.id}
        db.close()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def test_otro_profesor_no_accede_a_recursos_ajenos(self):
        r, s1 = self.r, self.ids["est1"]
        attempts = [
            ("get", f"/classrooms/{r['c']}", None),
            ("get", f"/classrooms/{r['c']}/student-detail", None),
            ("get", f"/classrooms/{r['c']}/students", None),
            ("get", f"/classrooms/{r['c']}/stats", None),
            ("get", f"/classrooms/{r['c']}/students/{s1}/progress", None),
            ("get", f"/classrooms/{r['c']}/alerts", None),
            ("post", f"/classrooms/{r['c']}/regenerate-code", None),
            ("delete", f"/classrooms/{r['c']}/students/{s1}", None),
            ("delete", f"/classrooms/{r['c']}", None),
            ("get", f"/teacher/evaluations/{r['eval']}/results", None),
            ("put", f"/teacher/evaluations/{r['eval']}", {"title": "Hackeada"}),
            ("post", f"/teacher/evaluations/{r['eval']}/publish", None),
            ("post", f"/teacher/evaluations/{r['eval']}/close", None),
            ("delete", f"/teacher/evaluations/{r['eval']}", None),
            ("get", f"/teacher/materials/files/{r['mat']}/download", None),
            ("patch", f"/teacher/materials/files/{r['mat']}", {"sharedWith": []}),
            ("delete", f"/teacher/materials/files/{r['mat']}", None),
            ("delete", f"/teacher/materials/folders/{r['folder']}", None),
            ("put", f"/bots/{r['bot']}", {"name": "Hackeado"}),
            ("delete", f"/bots/{r['bot']}", None),
            ("get", f"/bots/{r['bot']}/assignments", None),
            ("post", f"/bots/{r['bot']}/assignments", {"classroom_ids": [r["c"]]}),
            ("get", f"/bots/{r['bot']}/documents", None),
            ("put", f"/events/{r['event']}", {"title": "Hackeado"}),
            ("delete", f"/events/{r['event']}", None),
        ]
        for method, path, body in attempts:
            kwargs = {"json": body} if body is not None else {}
            resp = getattr(self.client, method)(f"{API}{path}", headers=self.h("profe2"), **kwargs)
            self.assertIn(resp.status_code, (400, 403, 404, 405, 422), f"{method} {path}: {resp.status_code} {resp.text[:200]}")
            self.assertNotIn("CRUCE001", resp.text, f"{method} {path} filtró el código de invitación")

        # Resultados de un bot ajeno: diseño vigente (test_neurobots_notificaciones):
        # 200 pero sin ningún estudiante (solo ve sus propias asignaciones).
        prog = self.client.get(f"{API}/bots/{r['bot']}/progress", headers=self.h("profe2"))
        self.assertEqual((prog.status_code, prog.json()["students"]), (200, []))

        db = self.Session()
        try:
            self.assertEqual(db.query(Classroom).get(r["c"]).is_active, True)
            self.assertEqual(db.query(Classroom).get(r["c"]).invite_code, "CRUCE001")
            self.assertEqual(db.query(TeacherEvaluation).get(r["eval"]).title, "Parcial")
            self.assertEqual(db.query(TeacherMaterial).get(r["mat"]).shared_with, [r["c"]])
            self.assertEqual(db.query(ExpertBot).get(r["bot"]).name, "Bot Física")
            self.assertEqual(db.query(ClassroomEvent).get(r["event"]).title, "Laboratorio")
            self.assertTrue(db.query(Enrollment).filter_by(student_id=self.ids["est1"]).first().is_active)
        finally:
            db.close()

    def test_material_solo_lo_ve_el_grupo_compartido(self):
        mine = self.client.get(f"{API}/student/materials", headers=self.h("est1")).json()["materials"]
        self.assertEqual([m["name"] for m in mine], ["Guía 1"])
        other = self.client.get(f"{API}/student/materials", headers=self.h("est2")).json()["materials"]
        self.assertEqual(other, [])
        self.assertEqual(self.client.get(f"{API}/student/materials/{self.r['mat']}/download",
                                         headers=self.h("est2")).status_code, 404)
        self.assertEqual(self.client.get(f"{API}/student/materials/{self.r['mat']}/download",
                                         headers=self.h("est1")).status_code, 200)
        # Compartir con un grupo ajeno se rechaza en el backend.
        db = self.Session()
        c2 = db.query(Classroom).filter_by(invite_code="CRUCE002").first().id
        db.close()
        resp = self.client.patch(f"{API}/teacher/materials/files/{self.r['mat']}", headers=self.h("profe"),
                                 json={"sharedWith": [c2]})
        self.assertEqual(resp.status_code, 400, resp.text)

    def test_profesor_no_modifica_eventos_institucionales(self):
        for method, body in (("put", {"title": "Cambiado"}), ("delete", None)):
            kwargs = {"json": body} if body is not None else {}
            resp = getattr(self.client, method)(f"{API}/events/{self.r['inst_event']}",
                                                headers=self.h("profe"), **kwargs)
            self.assertIn(resp.status_code, (403, 404), f"{method}: {resp.text}")
        db = self.Session()
        ev = db.query(ClassroomEvent).get(self.r["inst_event"])
        self.assertEqual((ev.title, ev.is_active), ("Izada de bandera", True))
        db.close()

    def test_estudiante_no_usa_funciones_del_profesor(self):
        for method, path in (("get", "/teacher/materials"), ("get", "/teacher/evaluations"),
                             ("get", "/teacher/stats"), ("get", "/integrations"),
                             ("get", f"/teacher/evaluations/{self.r['eval']}/results")):
            resp = getattr(self.client, method)(f"{API}{path}", headers=self.h("est1"))
            self.assertIn(resp.status_code, (403, 404), f"{method} {path}: {resp.status_code}")
        # est2 no está inscrito en el grupo de «profe».
        for method, path in (("get", f"/classrooms/{self.r['c']}/student-detail"),):
            resp = getattr(self.client, method)(f"{API}{path}", headers=self.h("est2"))
            self.assertIn(resp.status_code, (403, 404), f"{method} {path}: {resp.status_code}")
        self.assertEqual(self.client.get(f"{API}/teacher/materials").status_code, 401)


if __name__ == "__main__":
    unittest.main(verbosity=2)
