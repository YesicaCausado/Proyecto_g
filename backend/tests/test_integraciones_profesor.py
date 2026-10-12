"""
Integraciones, automatizaciones y analítica del profesor.

  * El webhook ya no está en la interfaz del profesor y el backend lo
    restringe al Súper Profesor / Administrador.
  * «Crear alerta» y «Enviar notificación» crean notificaciones reales.
  * «Evaluar bajo rendimiento» ya no falla con 500, usa el umbral de cada
    automatización e ignora a estudiantes sin actividad.
  * «Reporte generado» se dispara al exportar; solo las automatizaciones
    del propio docente.
  * Las automatizaciones solo las modifica quien las creó.
  * Importar de Drive guarda un enlace (sin «[object Object]»).
  * El regreso de Google OAuth lleva «#» (HashRouter).
  * Analítica: riesgo y uso de NeuroBots calculados con datos reales.
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta

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
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.learning import LearningSession, QuizHistory  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"


class IntegracionesProfesorTests(unittest.TestCase):
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
        inst = Institution(name="Colegio A", dane_code="51100000001", is_active=True)
        db.add(inst)
        db.flush()
        self.ids = {}
        for username, role in (("super", UserRole.SUPER_PROFESOR), ("profe", UserRole.PROFESOR),
                               ("profe2", UserRole.PROFESOR), ("est1", UserRole.ESTUDIANTE),
                               ("est2", UserRole.ESTUDIANTE), ("est3", UserRole.ESTUDIANTE)):
            u = User(username=username, email=f"{username}@t.edu.co", full_name=username.title(),
                     hashed_password="x", role=role.value, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        c = Classroom(teacher_id=self.ids["profe"], name="Matemáticas 9A", subject="Matemáticas",
                      grade="9", invite_code="INTEG001", is_active=True, max_students=40)
        db.add(c)
        db.flush()
        self.classroom_id = c.id
        # est1: bajo rendimiento (30 %), est2: bien (90 %), est3: sin actividad.
        for student, avg, sessions in (("est1", 30.0, 4), ("est2", 90.0, 4), ("est3", 0.0, 0)):
            db.add(Enrollment(student_id=self.ids[student], classroom_id=c.id, is_active=True,
                              average_score=avg, total_sessions=sessions))
        db.commit()
        db.close()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def create_automation(self, who="profe", **body):
        payload = {"name": "Prueba", "trigger": "bajo_rendimiento", "action": "crear_alerta",
                   "configuration": {}, "enabled": True, **body}
        r = self.client.post(f"{API}/automations", headers=self.h(who), json=payload)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()["id"]

    def notifications_of(self, username):
        db = self.Session()
        try:
            return db.query(Notification).filter_by(user_id=self.ids[username]).all()
        finally:
            db.close()

    # ── Webhook ────────────────────────────────────────────────────────────
    def test_webhook_fuera_del_profesor(self):
        h = self.h("profe")
        for method, path, body in (("get", "/integrations/webhook", None),
                                   ("post", "/integrations/webhook", {"url": "https://example.org/h"}),
                                   ("post", "/integrations/webhook/test", {"url": "https://example.org/h"}),
                                   ("post", "/integrations/webhook/toggle", {"enabled": True})):
            kwargs = {"json": body} if body is not None else {}
            r = getattr(self.client, method)(f"{API}{path}", headers=h, **kwargs)
            self.assertEqual(r.status_code, 403, f"{method} {path}: {r.text}")
        self.assertEqual(self.client.get(f"{API}/integrations/webhook", headers=self.h("super")).status_code, 200)

        options = self.client.get(f"{API}/automation-options", headers=h).json()
        self.assertNotIn("webhook", [a["value"] for a in options["actions"]])
        r = self.client.post(f"{API}/automations", headers=h, json={
            "name": "x", "trigger": "nueva_actividad", "action": "webhook"})
        self.assertEqual(r.status_code, 400)
        info = self.client.get(f"{API}/integrations", headers=h).json()
        self.assertIn("google_configured", info)

    # ── Acciones reales y autoría ──────────────────────────────────────────
    def test_crear_alerta_y_notificacion_son_reales(self):
        alerta = self.create_automation(action="crear_alerta", trigger="nueva_actividad")
        aviso = self.create_automation(action="enviar_notificacion", trigger="nueva_actividad")
        for aid in (alerta, aviso):
            r = self.client.post(f"{API}/automations/{aid}/run", headers=self.h("profe"))
            self.assertEqual(r.status_code, 200, r.text)
            self.assertTrue(r.json()["ok"], r.json())
        notifs = self.notifications_of("profe")
        self.assertEqual(len(notifs), 2)
        self.assertEqual({n.type for n in notifs}, {"automatizacion"})
        self.assertEqual({n.link for n in notifs}, {"/teacher?tab=alertas", "/teacher?tab=automatizaciones"})

    def test_solo_el_autor_modifica(self):
        aid = self.create_automation()
        for method, path, body in (("post", f"/automations/{aid}/run", None),
                                   ("post", f"/automations/{aid}/toggle", {"enabled": False}),
                                   ("put", f"/automations/{aid}", {"name": "otro"}),
                                   ("delete", f"/automations/{aid}", None)):
            kwargs = {"json": body} if body is not None else {}
            r = getattr(self.client, method)(f"{API}{path}", headers=self.h("profe2"), **kwargs)
            self.assertEqual(r.status_code, 403, f"{method} {path}: {r.text}")
        listed = self.client.get(f"{API}/automations", headers=self.h("profe2")).json()["automations"]
        self.assertFalse(listed[0]["can_edit"])
        r = self.client.put(f"{API}/automations/{aid}", headers=self.h("profe"),
                            json={"name": "Renombrada", "configuration": {"threshold": 50}})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["name"], "Renombrada")
        self.assertEqual(self.client.put(f"{API}/automations/{aid}", headers=self.h("profe"),
                                         json={"trigger": "inventado"}).status_code, 400)

    # ── Bajo rendimiento ───────────────────────────────────────────────────
    def test_bajo_rendimiento_sin_500_y_con_umbral_propio(self):
        r = self.client.post(f"{API}/automations/check-low-performance", headers=self.h("profe"), json={})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["count"], 0)          # aún no hay automatizaciones

        self.create_automation(configuration={"threshold": 40})
        r = self.client.post(f"{API}/automations/check-low-performance", headers=self.h("profe"), json={})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        # est1 (30 %) sí; est2 (90 %) no; est3 sin actividad no cuenta como bajo rendimiento.
        self.assertEqual([d["student_id"] for d in body["detected"]], [self.ids["est1"]])
        self.assertTrue(all(x["ok"] for x in body["executions"]))
        self.assertEqual(len(self.notifications_of("profe")), 1)

        # La automatización de otro docente no se ejecuta con el botón de este.
        self.create_automation(who="profe2", configuration={"threshold": 95})
        self.client.post(f"{API}/automations/check-low-performance", headers=self.h("profe"), json={})
        self.assertEqual(self.notifications_of("profe2"), [])

    # ── Reporte generado ───────────────────────────────────────────────────
    def test_reporte_generado_dispara_solo_las_del_docente(self):
        self.create_automation(trigger="reporte_generado", action="enviar_notificacion")
        self.create_automation(who="profe2", trigger="reporte_generado", action="enviar_notificacion")
        r = self.client.get(f"{API}/teacher/reports/export", headers=self.h("profe"),
                            params={"report": "resumen", "format": "csv"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(self.notifications_of("profe")), 1)
        self.assertEqual(self.notifications_of("profe2"), [])

    # ── Drive y OAuth ──────────────────────────────────────────────────────
    def test_importar_de_drive_guarda_enlace(self):
        r = self.client.post(f"{API}/integrations/google/drive/import", headers=self.h("profe"),
                             json={"files": [{"id": "1AbCdEfGhIjKlMnOp", "name": "Guía.pdf", "type": "pdf"}]})
        self.assertEqual(r.status_code, 200, r.text)
        folders = self.client.get(f"{API}/teacher/materials", headers=self.h("profe")).json()
        files = [f for folder in (folders.get("folders") if isinstance(folders, dict) else folders) for f in folder["files"]]
        self.assertEqual(len(files), 1)
        self.assertEqual(files[0]["sharedWith"], [])
        self.assertEqual(files[0]["url"], "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view")
        self.assertEqual(self.client.post(f"{API}/integrations/google/drive/import", headers=self.h("profe"),
                                          json={"files": [{"id": "../x", "name": "x"}]}).status_code, 400)

    def test_regreso_de_google_con_hash(self):
        r = self.client.get(f"{API}/integrations/google/callback", params={"error": "access_denied"},
                            follow_redirects=False)
        self.assertIn(r.status_code, (302, 307))
        location = r.headers["location"]
        self.assertIn("/#/teacher?tab=integraciones&integration_error=", location)

    # ── Analítica ──────────────────────────────────────────────────────────
    def test_analitica_riesgo_y_uso_de_neurobots_reales(self):
        db = self.Session()
        now = datetime.utcnow()
        for student, score, days_ago in (("est1", 30.0, 1), ("est1", 35.0, 1), ("est1", 20.0, 1),
                                         ("est2", 90.0, 1)):
            db.add(QuizHistory(user_id=self.ids[student], quiz_title="Quiz", topic="Álgebra", difficulty="Medio",
                               questions_count=5, quiz_data={}, user_score="1/5",
                               completed_at=now - timedelta(days=days_ago), performance_score=score))
        bot = ExpertBot(creator_id=self.ids["profe"], name="Álgebra Bot", category="Matemáticas",
                        is_public=False, is_active=True)
        db.add(bot)
        db.flush()
        for student in ("est1", "est2", "est1"):
            db.add(LearningSession(user_id=self.ids[student], bot_id=bot.id, topic="Álgebra"))
        db.commit()
        db.close()

        stats = self.client.get(f"{API}/teacher/stats", headers=self.h("profe")).json()
        self.assertEqual(stats["risk_dist"], {"bajo": 1, "medio": 0, "alto": 1, "sin_actividad": 1})
        self.assertEqual(stats["ai_usage"][0]["name"], "Álgebra Bot")
        self.assertEqual(stats["ai_usage"][0]["users"], 2)
        self.assertEqual(stats["ai_usage"][0]["pct"], 100)


if __name__ == "__main__":
    unittest.main(verbosity=2)
