"""
NeuroLearn IA — NeuroBots asignados + notificaciones como un solo flujo (parche 11B).

Recorre por API el flujo completo del documento «Implementación y auditoría
específica — NeuroBots + Notificaciones»:

  Profesor asigna NeuroBot (grupo o estudiante, con meta)
    → asignación guardada + notificación al estudiante (misma transacción)
    → estudiante la ve, la abre (queda leída tras F5) y llega al NeuroBot
    → «Mis NeuroBots» solo muestra lo asignado
    → abre el chat (iniciado), interactúa (en progreso), alcanza la meta
      (completado) → el profesor recibe la notificación y ve el resultado real.

Además: cada evento que genera notificaciones (mensaje directo, evaluación
publicada, riesgo alto, actividad institucional, unión a un grupo, racha),
preferencias del perfil, marcar como leídas, aislamiento por rol e
institución y consistencia si falla la notificación.

SQLite en memoria; la IA se reemplaza por un doble.

Ejecutar desde backend/:

    python -m pytest tests/test_neurobots_notificaciones.py -v
"""
from __future__ import annotations

import os
import sys
import unittest
from datetime import datetime, timedelta
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401  (BD en memoria, correo a consola, sin IA real)

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.classroom import Classroom, ClassroomBot, Enrollment  # noqa: E402
from app.models.evaluation import TeacherEvaluation  # noqa: E402
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.learning import QuizHistory  # noqa: E402
from app.models.neurobot_assignment import NeuroBotProgress, StudentBotAssignment  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import notification_service  # noqa: E402
from app.services.enrollment_tracking_service import EnrollmentTrackingService  # noqa: E402

API = "/api/v1"


async def fake_generate(prompt, system_prompt="", **kwargs):
    return {"response": "Muy bien, sigamos con el siguiente concepto.", "provider": "groq",
            "fallback_used": False}


async def local_generate(prompt, system_prompt="", **kwargs):
    return {"response": "En este momento no puedo procesar tu mensaje.", "provider": "local",
            "fallback_used": True}


class NeuroBotsNotificationsTests(unittest.TestCase):
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
        self.ai = mock.patch.object(chat_api.ai_manager, "generate", side_effect=fake_generate)
        self.providers = mock.patch.object(chat_api.ai_manager, "providers", ["groq"])
        self.ai.start()
        self.providers.start()

        db = self.Session()
        inst_a = Institution(name="Colegio A", dane_code="31100000001", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="31100000002", is_active=True)
        db.add_all([inst_a, inst_b])
        db.flush()
        self.ids = {}
        for username, role, inst, name in (
            ("super_a", UserRole.SUPER_PROFESOR, inst_a, "Rectora A"),
            ("profe_a", UserRole.PROFESOR, inst_a, "Profe Ana"),
            ("profe_a2", UserRole.PROFESOR, inst_a, "Profe Beto"),
            ("est1", UserRole.ESTUDIANTE, inst_a, "Juan Pérez"),
            ("est2", UserRole.ESTUDIANTE, inst_a, "Laura Gómez"),
            ("est3", UserRole.ESTUDIANTE, inst_a, "Pedro Ruiz"),
            ("est4", UserRole.ESTUDIANTE, inst_a, "Sara Díaz"),
            ("est_nuevo", UserRole.ESTUDIANTE, inst_a, "Nora Vega"),
            ("super_b", UserRole.SUPER_PROFESOR, inst_b, "Rector B"),
            ("profe_b", UserRole.PROFESOR, inst_b, "Profe Carla"),
            ("est_b", UserRole.ESTUDIANTE, inst_b, "Mario B"),
        ):
            u = User(username=username, email=f"{username}@test.edu.co", full_name=name, hashed_password="x",
                     role=role.value, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        self.c9a = Classroom(teacher_id=self.ids["profe_a"], name="Matemáticas 9A", subject="Matemáticas",
                             grade="9", invite_code="CODE9A01", is_active=True, max_students=40)
        self.c9b = Classroom(teacher_id=self.ids["profe_a"], name="Matemáticas 9B", subject="Matemáticas",
                             grade="9", invite_code="CODE9B01", is_active=True, max_students=40)
        self.c10 = Classroom(teacher_id=self.ids["profe_a2"], name="Física 10A", subject="Física",
                             grade="10", invite_code="CODE10A1", is_active=True, max_students=40)
        self.cb = Classroom(teacher_id=self.ids["profe_b"], name="Grupo B", subject="Química",
                            grade="9", invite_code="CODEB001", is_active=True, max_students=40)
        db.add_all([self.c9a, self.c9b, self.c10, self.cb])
        db.flush()
        for student, classroom in (("est1", self.c9a), ("est2", self.c9a), ("est3", self.c9b),
                                   ("est4", self.c10), ("est_b", self.cb)):
            db.add(Enrollment(student_id=self.ids[student], classroom_id=classroom.id, is_active=True))
        self.private_a2 = ExpertBot(creator_id=self.ids["profe_a2"], name="Bot privado de Beto",
                                    category="Física", is_public=False, is_active=True)
        db.add(self.private_a2)
        db.commit()
        self.c9a_id, self.c9b_id, self.c10_id, self.cb_id = self.c9a.id, self.c9b.id, self.c10.id, self.cb.id
        self.private_a2_id = self.private_a2.id
        db.close()

    def tearDown(self):
        self.ai.stop()
        self.providers.stop()
        app.dependency_overrides.pop(get_db, None)

    # ── utilidades ────────────────────────────────────────────────────────
    def h(self, username):
        """Un token nuevo en cada llamada = una sesión nueva (cerrar y volver a entrar)."""
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def notifications(self, username, **params):
        r = self.client.get(f"{API}/notifications", headers=self.h(username), params=params)
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()

    def of_type(self, username, notif_type):
        return [n for n in self.notifications(username, limit=100)["notifications"] if n["type"] == notif_type]

    def create_bot(self, username="profe_a", name="Pensamiento lógico", public=False):
        r = self.client.post(f"{API}/bots/create", headers=self.h(username), json={
            "name": name, "description": "Razonamiento para el Saber 11", "category": "Matemáticas",
            "is_public": public})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["id"]

    def assign(self, bot_id, username="profe_a", classrooms=(), students=(), goal=3):
        return self.client.post(f"{API}/bots/{bot_id}/assignments", headers=self.h(username), json={
            "classroom_ids": list(classrooms), "student_ids": [self.ids[s] for s in students],
            "goal_interactions": goal})

    def open_chat(self, username, bot_id):
        h = self.h(username)
        conv = self.client.post(f"{API}/chat/conversations", headers=h,
                                json={"topic": "Pensamiento lógico", "bot_id": bot_id}).json()
        r = self.client.post(f"{API}/chat/start", headers=h, json={
            "topic": "Pensamiento lógico", "bot_id": bot_id, "conversation_id": conv.get("id")})
        self.assertEqual(r.status_code, 200, r.text)
        return conv.get("id"), r.json()

    def say(self, username, bot_id, conversation_id, text="¿Cómo resuelvo este problema?"):
        r = self.client.post(f"{API}/chat/message", headers=self.h(username), json={
            "message": text, "topic": "Pensamiento lógico", "bot_id": bot_id,
            "conversation_id": conversation_id})
        self.assertEqual(r.status_code, 200, r.text)
        return r.json()["metadata"]["neurobot_progress"]

    # ── 1. Flujo completo profesor → estudiante → resultado → profesor ──────
    def test_full_neurobot_flow_with_notifications(self):
        # Paso 1-2: el profesor crea el NeuroBot (actividad institucional → Súper Profesor)
        bot_id = self.create_bot()
        inst = self.of_type("super_a", "actividad_institucional")
        self.assertEqual(len(inst), 1)
        self.assertIn("Pensamiento lógico", inst[0]["message"])
        self.assertEqual(inst[0]["link"], "/super?tab=neurobots")
        self.assertEqual(self.of_type("super_b", "actividad_institucional"), [])

        overview = self.client.get(f"{API}/bots/{bot_id}/assignments", headers=self.h("profe_a")).json()
        self.assertEqual({c["name"] for c in overview["classrooms"]}, {"Matemáticas 9A", "Matemáticas 9B"})
        self.assertEqual({s["username"] for s in overview["students"]}, {"est1", "est2", "est3"})

        # Paso 3-5: asigna al grupo 9A y a est3 individualmente, meta 3
        r = self.assign(bot_id, classrooms=[self.c9a_id], students=["est3"], goal=3)
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["students_notified"], 3)
        db = self.Session()
        cb = db.query(ClassroomBot).filter_by(classroom_id=self.c9a_id, bot_id=bot_id).one()
        self.assertEqual((cb.goal_interactions, cb.assigned_by_id), (3, self.ids["profe_a"]))
        self.assertEqual(db.query(StudentBotAssignment).filter_by(bot_id=bot_id).one().student_id, self.ids["est3"])
        recipients = {n.user_id for n in db.query(Notification).filter_by(type="neurobot_asignado")}
        db.close()
        self.assertEqual(recipients, {self.ids["est1"], self.ids["est2"], self.ids["est3"]})

        # Paso 6-9: el estudiante entra y ve la notificación con datos reales
        data = self.notifications("est1")
        self.assertEqual(data["unread_count"], 1)
        note = data["notifications"][0]
        self.assertEqual(note["type"], "neurobot_asignado")
        self.assertIn('"Pensamiento lógico"', note["message"])
        self.assertIn("Profe Ana", note["message"])
        self.assertIn("Matemáticas 9A", note["message"])
        self.assertEqual((note["link"], note["resource_type"], note["resource_id"]),
                         (f"/bots/{bot_id}", "neurobot", bot_id))

        # Paso 10-11: la pulsa → leída (persiste tras F5) y lleva al NeuroBot exacto
        r = self.client.post(f"{API}/notifications/{note['id']}/read", headers=self.h("est1"))
        self.assertEqual(r.json()["unread_count"], 0)
        self.assertTrue(self.notifications("est1")["notifications"][0]["read"])
        detail = self.client.get(f"{API}/bots/assigned-to-me/{bot_id}", headers=self.h("est1"))
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["progress"]["status"], "asignado")
        self.assertEqual(detail.json()["progress"]["goal_interactions"], 3)
        self.assertEqual(detail.json()["sources"][0]["classroom_name"], "Matemáticas 9A")

        # Paso 12-13: «Mis NeuroBots» muestra solo lo asignado
        mine = self.client.get(f"{API}/bots/assigned-to-me", headers=self.h("est1")).json()
        self.assertEqual([b["id"] for b in mine["bots"]], [bot_id])
        self.assertEqual(self.client.get(f"{API}/bots/assigned-to-me", headers=self.h("est4")).json()["bots"], [])

        # Paso 14-16: abre (iniciado), interactúa (en progreso) y el progreso persiste
        conv_id, start = self.open_chat("est1", bot_id)
        self.assertEqual(start["metadata"]["neurobot_progress"]["status"], "iniciado")
        p = self.say("est1", bot_id, conv_id)
        self.assertEqual((p["status"], p["interactions"], p["percent"]), ("en_progreso", 1, 33))
        self.say("est1", bot_id, conv_id)
        again = self.client.get(f"{API}/bots/assigned-to-me/{bot_id}", headers=self.h("est1")).json()
        self.assertEqual((again["progress"]["interactions"], again["progress"]["percent"]), (2, 66))
        self.assertEqual(again["last_conversation_id"], conv_id)

        # Paso 17: alcanza la meta → completado y el profesor recibe la notificación
        p = self.say("est1", bot_id, conv_id)
        self.assertEqual((p["status"], p["percent"], p["just_completed"]), ("completado", 100, True))
        self.say("est1", bot_id, conv_id)  # seguir conversando no duplica el resultado
        done = self.of_type("profe_a", "neurobot_completado")
        self.assertEqual(len(done), 1)
        self.assertIn("Juan Pérez", done[0]["message"])
        self.assertEqual(done[0]["link"], f"/teacher?tab=neurobots&bot={bot_id}")

        # Paso 18-21: el profesor ve el resultado real; el estudiante conserva su estado
        res = self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("profe_a")).json()
        rows = {r["username"]: r for r in res["students"]}
        self.assertEqual(set(rows), {"est1", "est2", "est3"})
        self.assertEqual((rows["est1"]["status"], rows["est1"]["percent"], rows["est1"]["interactions"]),
                         ("completado", 100, 4))
        self.assertIsNotNone(rows["est1"]["completed_at"])
        self.assertEqual(rows["est2"]["status"], "asignado")
        self.assertEqual(rows["est3"]["sources"], ["Individual"])
        self.assertEqual(res["summary"], {"asignado": 2, "iniciado": 0, "en_progreso": 0, "completado": 1})
        final = self.client.get(f"{API}/bots/assigned-to-me/{bot_id}", headers=self.h("est1")).json()
        self.assertEqual(final["progress"]["status"], "completado")

    def test_local_fallback_does_not_count_as_interaction(self):
        bot_id = self.create_bot()
        self.assign(bot_id, classrooms=[self.c9a_id], goal=2)
        conv_id, _ = self.open_chat("est2", bot_id)
        with mock.patch.object(chat_api.ai_manager, "generate", side_effect=local_generate):
            r = self.client.post(f"{API}/chat/message", headers=self.h("est2"), json={
                "message": "hola", "topic": "Pensamiento lógico", "bot_id": bot_id, "conversation_id": conv_id})
        self.assertEqual(r.status_code, 200, r.text)
        db = self.Session()
        self.assertEqual(db.query(NeuroBotProgress).filter_by(student_id=self.ids["est2"]).one().interactions, 0)
        db.close()

    def test_goal_change_and_unassign(self):
        bot_id = self.create_bot()
        self.assign(bot_id, classrooms=[self.c9a_id], goal=5)
        conv_id, _ = self.open_chat("est2", bot_id)
        self.say("est2", bot_id, conv_id)
        self.say("est2", bot_id, conv_id)
        # Bajar la meta a 2: est2 ya la cumple → completado y aviso al profesor
        r = self.assign(bot_id, classrooms=[self.c9a_id], goal=2)
        self.assertEqual(r.json()["students_notified"], 0)        # no se renotifica la asignación
        self.assertEqual(r.json()["completed_after_goal_change"], 1)
        self.assertEqual(len(self.of_type("profe_a", "neurobot_completado")), 1)
        self.assertEqual(len(self.of_type("est2", "neurobot_asignado")), 1)
        # Quitar el grupo: el estudiante deja de verlo
        r = self.client.delete(f"{API}/bots/{bot_id}/assignments/classrooms/{self.c9a_id}", headers=self.h("profe_a"))
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.client.get(f"{API}/bots/assigned-to-me/{bot_id}", headers=self.h("est2")).status_code, 404)
        # Meta inválida
        self.assertEqual(self.assign(bot_id, classrooms=[self.c9a_id], goal=0).status_code, 422)
        self.assertEqual(self.assign(bot_id, goal=3).status_code, 422)   # sin destinatarios

    # ── 2. Seguridad y roles ──────────────────────────────────────────────
    def test_roles_and_institution_isolation(self):
        bot_id = self.create_bot()
        self.assign(bot_id, classrooms=[self.c9a_id], goal=3)
        # El estudiante no gestiona asignaciones ni ve resultados
        for method, url in (("get", f"/bots/{bot_id}/assignments"), ("get", f"/bots/{bot_id}/progress")):
            self.assertEqual(getattr(self.client, method)(API + url, headers=self.h("est1")).status_code, 403)
        self.assertEqual(self.assign(bot_id, username="est1", classrooms=[self.c9a_id]).status_code, 403)
        # Solo sus grupos y sus estudiantes
        self.assertEqual(self.assign(bot_id, classrooms=[self.c10_id]).status_code, 403)
        self.assertEqual(self.assign(bot_id, students=["est4"]).status_code, 403)
        # Bot privado de otro profesor (misma institución) y profesor de otra institución
        self.assertEqual(self.assign(self.private_a2_id, classrooms=[self.c9a_id]).status_code, 403)
        self.assertEqual(self.assign(bot_id, username="profe_b", classrooms=[self.cb_id]).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("profe_b")).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("super_b")).status_code, 403)
        # Súper Profesor de la institución ve todo; otro profesor de la misma, solo lo suyo (nada)
        self.assertEqual(self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("super_a")).json()["total"], 2)
        self.assertEqual(self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("profe_a2")).json()["total"], 0)
        # Un estudiante no ve NeuroBots ni notificaciones ajenas
        self.assertEqual(self.client.get(f"{API}/bots/assigned-to-me/{bot_id}", headers=self.h("est4")).status_code, 404)
        other = self.of_type("est2", "neurobot_asignado")[0]
        self.assertEqual(self.client.post(f"{API}/notifications/{other['id']}/read", headers=self.h("est1")).status_code, 404)
        self.assertFalse(self.of_type("est2", "neurobot_asignado")[0]["read"])
        self.assertEqual(self.client.get(f"{API}/notifications").status_code, 401)

    def test_individually_assigned_student_can_use_private_bot(self):
        bot_id = self.create_bot()
        self.assertEqual(self.client.post(f"{API}/chat/start", headers=self.h("est3"), json={
            "topic": "x", "bot_id": bot_id}).status_code, 403)
        self.assign(bot_id, students=["est3"], goal=1)
        conv_id, _ = self.open_chat("est3", bot_id)
        self.assertEqual(self.say("est3", bot_id, conv_id)["status"], "completado")

    def test_assignment_and_notification_are_atomic(self):
        bot_id = self.create_bot()
        with mock.patch.object(notification_service, "notify", side_effect=RuntimeError("fallo")):
            r = self.assign(bot_id, classrooms=[self.c9a_id], goal=3)
        self.assertEqual(r.status_code, 500)
        self.assertEqual(r.json()["detail"], "No fue posible asignar el NeuroBot.")
        db = self.Session()
        self.assertEqual(db.query(ClassroomBot).filter_by(bot_id=bot_id).count(), 0)
        self.assertEqual(db.query(Notification).filter_by(type="neurobot_asignado").count(), 0)
        db.close()

    # ── 3. Notificaciones: estado, contador y preferencias ────────────────
    def test_read_state_counter_and_no_hardcoded_notifications(self):
        # Sin eventos no hay notificaciones (ni tip del día ni bienvenida)
        self.assertEqual(self.notifications("est4")["notifications"], [])
        bot_id = self.create_bot()
        self.assign(bot_id, classrooms=[self.c9a_id])
        self.client.post(f"{API}/messages/conversations/{self.ids['est1']}", headers=self.h("profe_a"),
                         data={"content": "Revisa el NeuroBot nuevo"})
        self.assertEqual(self.client.get(f"{API}/notifications/unread-count", headers=self.h("est1")).json(),
                         {"unread_count": 2})
        r = self.client.post(f"{API}/notifications/read-all", headers=self.h("est1"))
        self.assertEqual(r.json()["updated"], 2)
        data = self.notifications("est1")
        self.assertEqual(data["unread_count"], 0)
        self.assertTrue(all(n["read"] for n in data["notifications"]))
        self.assertEqual(len(self.notifications("est1", unread_only=True)["notifications"]), 0)

    def test_direct_messages_group_and_respect_preferences(self):
        send = lambda text: self.client.post(  # noqa: E731
            f"{API}/messages/conversations/{self.ids['profe_a']}", headers=self.h("est1"), data={"content": text})
        self.assertEqual(send("Profe, tengo una duda").status_code, 201)
        send("¿Me puede ayudar?")
        msgs = self.of_type("profe_a", "mensaje_directo")
        self.assertEqual(len(msgs), 1)                                    # agrupadas mientras no se lea
        self.assertEqual(msgs[0]["title"], "2 mensajes nuevos de Juan Pérez")
        self.assertEqual(msgs[0]["message"], "¿Me puede ayudar?")
        self.assertEqual(msgs[0]["link"], f"/teacher?tab=mensajes&with={self.ids['est1']}")
        self.client.post(f"{API}/notifications/{msgs[0]['id']}/read", headers=self.h("profe_a"))
        send("Gracias")
        self.assertEqual(len(self.of_type("profe_a", "mensaje_directo")), 2)  # nueva tras leer
        # Preferencias del perfil (persisten en el servidor)
        r = self.client.put(f"{API}/notifications/preferences", headers=self.h("profe_a"),
                            json={"mensaje_directo": False})
        self.assertEqual(r.json(), {"nueva_actividad": True, "mensaje_directo": False})
        send("Otro mensaje")
        self.assertEqual(len(self.of_type("profe_a", "mensaje_directo")), 2)
        self.assertEqual(self.client.get(f"{API}/notifications/preferences", headers=self.h("profe_a")).json()
                         ["mensaje_directo"], False)
        # Al estudiante el enlace lo lleva a su página de mensajes
        self.client.post(f"{API}/messages/conversations/{self.ids['est1']}", headers=self.h("profe_a"),
                         data={"content": "Claro"})
        self.assertEqual(self.of_type("est1", "mensaje_directo")[0]["link"], f"/messages?with={self.ids['profe_a']}")

    # ── 4. Otros eventos reales ───────────────────────────────────────────
    def test_published_evaluation_notifies_classroom_students(self):
        db = self.Session()
        ev = TeacherEvaluation(teacher_id=self.ids["profe_a"], classroom_id=self.c9a_id, title="Fracciones",
                               group_name="Matemáticas 9A", status="borrador", date="", questions=[
                                   {"id": "q1", "type": "multiple", "text": "1/2 + 1/2", "options": ["1", "2"],
                                    "correct": "1", "points": 1}])
        db.add(ev)
        db.commit()
        ev_id = ev.id
        db.close()
        r = self.client.post(f"{API}/teacher/evaluations/{ev_id}/publish", headers=self.h("profe_a"))
        self.assertEqual(r.status_code, 200, r.text)
        for student in ("est1", "est2"):
            n = self.of_type(student, "evaluacion_publicada")
            self.assertEqual(len(n), 1)
            self.assertEqual(n[0]["link"], f"/evaluations?id={ev_id}")
            self.assertIn('"Fracciones"', n[0]["message"])
        self.assertEqual(self.of_type("est3", "evaluacion_publicada"), [])

    def test_high_risk_transition_notifies_teacher_and_super(self):
        db = self.Session()
        for score in (20.0, 30.0, 25.0, 10.0):
            EnrollmentTrackingService.register_quiz_completion(db, self.ids["est1"], self.c9a_id, score)
        db.close()
        teacher = self.of_type("profe_a", "alerta_riesgo")
        supers = self.of_type("super_a", "alerta_riesgo")
        self.assertEqual((len(teacher), len(supers)), (1, 1))         # solo al pasar a riesgo alto
        self.assertIn("Juan Pérez", teacher[0]["message"])
        self.assertEqual(teacher[0]["link"], "/teacher?tab=alertas")
        self.assertEqual(supers[0]["link"], "/super?tab=alertas")
        self.assertEqual(self.of_type("super_b", "alerta_riesgo"), [])

    def test_new_group_and_joining_student(self):
        r = self.client.post(f"{API}/classrooms/", headers=self.h("profe_a"),
                             json={"name": "Lógica 11", "subject": "Matemáticas", "grade": "11"})
        self.assertEqual(r.status_code, 201, r.text)
        group = self.of_type("super_a", "actividad_institucional")
        self.assertEqual(group[0]["link"], "/super?tab=grupos")
        self.assertIn('"Lógica 11"', group[0]["message"])
        bot_id = self.create_bot()
        self.assign(bot_id, classrooms=[r.json()["id"]], goal=4)
        # Un estudiante que se une después recibe el NeuroBot y su notificación
        r = self.client.post(f"{API}/classrooms/join", headers=self.h("est_nuevo"),
                             json={"invite_code": r.json()["invite_code"]})
        self.assertIn(r.status_code, (200, 201), r.text)
        n = self.of_type("est_nuevo", "neurobot_asignado")
        self.assertEqual(len(n), 1)
        self.assertEqual(n[0]["link"], f"/bots/{bot_id}")
        self.assertEqual(self.client.get(f"{API}/bots/assigned-to-me", headers=self.h("est_nuevo")).json()["total"], 1)

    def test_streak_notification_is_persisted_once(self):
        db = self.Session()
        yesterday = datetime.utcnow() - timedelta(days=1)
        db.add(QuizHistory(user_id=self.ids["est2"], quiz_title="Quiz", topic="Álgebra", difficulty="Medio",
                           questions_count=5, quiz_data={}, completed_at=yesterday, performance_score=90.0))
        db.commit()
        db.close()
        first = self.of_type("est2", "racha")
        self.assertEqual(len(first), 1)
        self.assertEqual(first[0]["title"], "¡Tu racha está en riesgo!")
        self.client.post(f"{API}/notifications/{first[0]['id']}/read", headers=self.h("est2"))
        again = self.of_type("est2", "racha")
        self.assertEqual(len(again), 1)
        self.assertTrue(again[0]["read"])

    # ── Moderación del Súper Profesor (pestaña NeuroBots) ──────────────────
    def test_super_lists_and_moderates_institution_bots(self):
        bot_id = self.create_bot()
        self.assertEqual(self.assign(bot_id, classrooms=[self.c9a_id]).status_code, 200)
        conv, _ = self.open_chat("est1", bot_id)
        self.say("est1", bot_id, conv)

        listed = self.client.get(f"{API}/super/bots", headers=self.h("super_a")).json()["bots"]
        row = next(b for b in listed if b["id"] == bot_id)
        self.assertEqual(row["group"], "Matemáticas 9A")
        self.assertEqual(row["docs"], 0)
        self.assertGreaterEqual(row["queries"], 1)
        self.assertNotIn(bot_id, [b["id"] for b in
                                  self.client.get(f"{API}/super/bots", headers=self.h("super_b")).json()["bots"]])

        # Activar/desactivar sí; editar contenido no; otra institución tampoco.
        r = self.client.patch(f"{API}/bots/{bot_id}", headers=self.h("super_a"), json={"is_active": False})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertFalse(r.json()["is_active"])
        inactive = self.client.get(f"{API}/super/bots", headers=self.h("super_a")).json()["bots"]
        self.assertEqual(next(b for b in inactive if b["id"] == bot_id)["status"], "inactivo")
        self.assertEqual(self.client.patch(f"{API}/bots/{bot_id}", headers=self.h("super_a"),
                                           json={"name": "Otro"}).status_code, 403)
        self.assertEqual(self.client.patch(f"{API}/bots/{bot_id}", headers=self.h("super_a"),
                                           json={"is_active": True, "is_public": True}).status_code, 403)
        self.assertEqual(self.client.patch(f"{API}/bots/{bot_id}", headers=self.h("super_b"),
                                           json={"is_active": True}).status_code, 403)
        self.assertEqual(self.client.patch(f"{API}/bots/{bot_id}", headers=self.h("profe_a2"),
                                           json={"is_active": True}).status_code, 403)

        # Progreso visible para el super de la institución, no para el de otra.
        self.assertEqual(self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("super_a")).status_code, 200)
        self.assertEqual(self.client.get(f"{API}/bots/{bot_id}/progress", headers=self.h("super_b")).status_code, 403)

        # Eliminar: el super de otra institución no; el de la institución sí, y limpia asignaciones.
        self.assertEqual(self.client.delete(f"{API}/bots/{bot_id}", headers=self.h("super_b")).status_code, 403)
        self.assertEqual(self.client.delete(f"{API}/bots/{bot_id}", headers=self.h("super_a")).status_code, 200)
        db = self.Session()
        self.assertEqual(db.query(ClassroomBot).filter_by(bot_id=bot_id).count(), 0)
        self.assertEqual(db.query(NeuroBotProgress).filter_by(bot_id=bot_id).count(), 0)
        db.close()
        self.assertEqual(self.client.get(f"{API}/bots/assigned-to-me", headers=self.h("est1")).json()["bots"], [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
