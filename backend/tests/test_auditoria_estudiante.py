"""
Auditoría del rol Estudiante (docs/AUDITORIA_ESTUDIANTE.md).

1. Aislamiento entre dos estudiantes de la MISMA institución: «est2» llama a
   los endpoints con los identificadores de los recursos de «est1»
   (conversaciones del tutor, evaluaciones, quizzes, mensajes, adjuntos,
   notificaciones, eventos personales, grupos, material, NeuroBots) y a los
   endpoints de profesor, Súper Profesor y administrador. Todo debe
   responder 4xx y los datos de est1 deben quedar intactos.
2. Regresiones de las correcciones de esta auditoría:
   - generate-quiz ya no entrega la respuesta correcta ni la explicación;
     submit-quiz devuelve la corrección y califica por id.
   - El progreso del grupo (Enrollment) se actualiza con el grupo que el
     servidor asignó al quiz.
   - Crear una conversación con un NeuroBot no autorizado → 403.
   - Unirse con un código de otra institución → 404; cupo al reactivar.
   - «Eliminar para todos» elimina también el adjunto.
"""
from __future__ import annotations

import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api import chat as chat_api  # noqa: E402
from app.api.auth import create_access_token  # noqa: E402
from app.api.teacher_materials import TeacherFolder, TeacherMaterial  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.adaptive import Conversation, ConversationMessage  # noqa: E402
from app.models.classroom import Classroom, Enrollment  # noqa: E402
from app.models.evaluation import EvaluationSubmission, TeacherEvaluation  # noqa: E402
from app.models.events import ClassroomEvent  # noqa: E402
from app.models.expert_bot import ExpertBot  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.learning import QuizHistory  # noqa: E402
from app.models.messages import DirectMessage  # noqa: E402
from app.models.notification import Notification  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"

QUIZ = {
    "quiz_title": "Fracciones",
    "difficulty": "Medio",
    "questions": [
        {"id": 1, "question": "1/2 + 1/2", "options": ["1", "2", "3", "4"], "answer": "1",
         "explanation": "Mitades iguales suman un entero."},
        {"id": 2, "question": "2 x 3", "options": ["5", "6", "7", "8"], "answer": "6",
         "explanation": "Producto."},
    ],
}


class AuditoriaEstudianteTests(unittest.TestCase):
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
        inst = Institution(name="Colegio A", dane_code="51100000088", is_active=True)
        inst_b = Institution(name="Colegio B", dane_code="51100000099", is_active=True)
        db.add_all([inst, inst_b])
        db.flush()
        self.ids = {}
        for username, role, institution in (
            ("super", UserRole.SUPER_PROFESOR, inst), ("profe", UserRole.PROFESOR, inst),
            ("est1", UserRole.ESTUDIANTE, inst), ("est2", UserRole.ESTUDIANTE, inst),
            ("profeB", UserRole.PROFESOR, inst_b),
        ):
            u = User(username=username, email=f"{username}@t.edu.co", full_name=username.title(),
                     hashed_password="x", role=role.value, institution_id=institution.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        c1 = Classroom(teacher_id=self.ids["profe"], name="Mate 11A", subject="Matemáticas",
                       competency="matematicas", grade="11", invite_code="ESTU0001",
                       is_active=True, max_students=40)
        c2 = Classroom(teacher_id=self.ids["profe"], name="Inglés 11B", subject="Inglés",
                       competency="ingles", grade="11", invite_code="ESTU0002",
                       is_active=True, max_students=40)
        cb = Classroom(teacher_id=self.ids["profeB"], name="Grupo ajeno", subject="Matemáticas",
                       grade="11", invite_code="OTROCOLE", is_active=True, max_students=40)
        db.add_all([c1, c2, cb])
        db.flush()
        db.add(Enrollment(student_id=self.ids["est1"], classroom_id=c1.id, is_active=True))
        db.add(Enrollment(student_id=self.ids["est2"], classroom_id=c2.id, is_active=True))

        ev = TeacherEvaluation(teacher_id=self.ids["profe"], classroom_id=c1.id, title="Parcial",
                               group_name=c1.name, status="publicada", attempts=1,
                               questions=[{"id": "q1", "type": "multiple", "text": "2+2",
                                           "options": ["3", "4"], "correct": "4", "points": 1}])
        bot = ExpertBot(creator_id=self.ids["profe"], name="Bot privado", category="Matemáticas",
                        is_public=False, is_active=True)
        folder = TeacherFolder(teacher_id=self.ids["profe"], name="Guías")
        db.add_all([ev, bot, folder])
        db.flush()
        sub = EvaluationSubmission(evaluation_id=ev.id, student_id=self.ids["est1"], classroom_id=c1.id,
                                   institution_id=inst.id, attempt_number=1, status="en_curso",
                                   answers={"q1": "4"})
        mat = TeacherMaterial(folder_id=folder.id, teacher_id=self.ids["profe"], name="Guía 1",
                              file_type="pdf", size="1 KB", shared_with=[c1.id], original_name="g.pdf",
                              mime_type="application/pdf", has_file=True, content=b"%PDF-1.4")
        conv = Conversation(student_id=self.ids["est1"], title="Mi chat", subject="Matemáticas")
        db.add_all([mat, conv])
        db.flush()
        from datetime import datetime, timedelta
        sub.started_at = datetime.utcnow()
        sub.expires_at = datetime.utcnow() + timedelta(hours=1)
        db.add(sub)
        db.add(ConversationMessage(conversation_id=conv.id, student_id=self.ids["est1"],
                                   role="user", content="SECRETO-EST1"))
        quiz = QuizHistory(user_id=self.ids["est1"], quiz_title="Quiz est1", topic="Matemáticas",
                           difficulty="Medio", questions_count=2, quiz_data=QUIZ)
        dm = DirectMessage(sender_id=self.ids["profe"], receiver_id=self.ids["est1"],
                           content="SECRETO-DM", attachment_name="nota.txt", attachment_mime="text/plain",
                           attachment_size=4, attachment_data=b"nota")
        notif = Notification(user_id=self.ids["est1"], type="mensaje_directo", title="Hola", message="x")
        personal = ClassroomEvent(classroom_id=None, institution_id=None, teacher_id=self.ids["est1"],
                                  title="Estudiar", event_type="evento", event_date="2026-10-30")
        db.add_all([quiz, dm, notif, personal])
        db.commit()
        self.r = {"c1": c1.id, "c2": c2.id, "cb": cb.id, "eval": ev.id, "sub": sub.id, "bot": bot.id,
                  "mat": mat.id, "conv": conv.id, "quiz": quiz.id, "dm": dm.id, "notif": notif.id,
                  "event": personal.id}
        db.close()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    # ── 1. Aislamiento ──────────────────────────────────────────────────────
    def test_otro_estudiante_no_accede_a_recursos_ajenos(self):
        r, s1 = self.r, self.ids["est1"]
        attempts = [
            ("get", f"/chat/conversations/{r['conv']}", None),
            ("post", f"/chat/conversations/{r['conv']}/rename", {"title": "Hackeado"}),
            ("delete", f"/chat/conversations/{r['conv']}", None),
            ("get", f"/student/evaluations/{r['eval']}", None),
            ("post", f"/student/evaluations/{r['eval']}/start", None),
            ("put", f"/student/evaluations/{r['eval']}/progress", {"submission_id": r["sub"], "answers": {"q1": "3"}}),
            ("post", f"/student/evaluations/{r['eval']}/submit", {"submission_id": r["sub"], "answers": {"q1": "3"}}),
            ("post", "/chat/submit-quiz", {"quiz_id": r["quiz"], "quiz_title": "Quiz est1", "user_answers": {"1": "A"}}),
            ("get", f"/messages/conversations/{s1}", None),
            ("post", f"/messages/conversations/{s1}", None),
            ("get", f"/messages/{r['dm']}/attachment", None),
            ("delete", f"/messages/{r['dm']}", None),
            ("post", f"/notifications/{r['notif']}/read", None),
            ("put", f"/events/{r['event']}", {"title": "Hackeado"}),
            ("delete", f"/events/{r['event']}", None),
            ("get", f"/classrooms/{r['c1']}", None),
            ("get", f"/classrooms/{r['c1']}/student-detail", None),
            ("get", f"/student/materials/{r['mat']}/download", None),
            ("get", f"/bots/{r['bot']}", None),
            ("get", f"/bots/assigned-to-me/{r['bot']}", None),
            ("post", "/chat/conversations", {"bot_id": r["bot"]}),
            # Endpoints de otros roles
            ("get", f"/classrooms/{r['c1']}/students", None),
            ("get", f"/classrooms/{r['c1']}/students/{s1}/progress", None),
            ("get", f"/teacher/evaluations/{r['eval']}/results", None),
            ("get", "/super/teachers", None),
            ("get", "/admin/users", None),
        ]
        for method, path, body in attempts:
            kwargs = {"json": body} if body is not None else {}
            if method == "post" and path.startswith("/messages/conversations/"):
                kwargs = {"data": {"content": "hola"}}
            resp = getattr(self.client, method)(f"{API}{path}", headers=self.h("est2"), **kwargs)
            self.assertIn(resp.status_code, (400, 403, 404, 405, 409, 422),
                          f"{method} {path}: {resp.status_code} {resp.text[:200]}")
            for secret in ("SECRETO-EST1", "SECRETO-DM", "ESTU0001"):
                self.assertNotIn(secret, resp.text, f"{method} {path} filtró {secret}")

        # Los listados de est2 no contienen nada de est1.
        for path in ("/chat/conversations", "/chat/quiz-history", "/student/evaluations",
                     "/student/materials", "/notifications", "/messages/conversations",
                     "/posts", "/classrooms/my-enrolled", "/bots/shared-with-me",
                     "/bots/assigned-to-me"):
            resp = self.client.get(f"{API}{path}", headers=self.h("est2"))
            self.assertEqual(resp.status_code, 200, f"{path}: {resp.text[:200]}")
            for secret in ("SECRETO-EST1", "SECRETO-DM", "Quiz est1", "Mi chat", "Guía 1", "Parcial", "ESTU0001"):
                self.assertNotIn(secret, resp.text, f"{path} filtró {secret}")

        # Los datos de est1 siguen intactos.
        db = self.Session()
        try:
            self.assertTrue(db.get(Conversation, r["conv"]).is_active)
            self.assertEqual(db.get(Conversation, r["conv"]).title, "Mi chat")
            sub = db.get(EvaluationSubmission, r["sub"])
            self.assertEqual((sub.status, sub.answers), ("en_curso", {"q1": "4"}))
            self.assertIsNone(db.get(QuizHistory, r["quiz"]).completed_at)
            self.assertFalse(db.get(Notification, r["notif"]).is_read)
            self.assertFalse(db.get(DirectMessage, r["dm"]).deleted_for_receiver)
            self.assertEqual(db.get(ClassroomEvent, r["event"]).title, "Estudiar")
        finally:
            db.close()

    # ── 2. Quizzes: sin respuestas antes de enviar; progreso del grupo ─────
    def _generate(self, user="est1"):
        async def groq(*a, **k):
            return {"response": json.dumps(QUIZ), "provider": "groq"}

        with mock.patch.object(chat_api.ai_manager, "generate", groq), \
                mock.patch.object(chat_api.ai_manager, "providers", ["groq"]):
            return self.client.post(f"{API}/chat/generate-quiz", headers=self.h(user),
                                    json={"topic": "Pensamiento Lógico-Matemático", "num_questions": 2,
                                          "competency": "matematicas"})

    def test_quiz_no_entrega_respuestas_y_actualiza_progreso_del_grupo(self):
        resp = self._generate()
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIsInstance(data["quiz_id"], int)
        for q in data["questions"]:
            self.assertEqual(set(q), {"id", "question", "options"})
        self.assertNotIn("Mitades iguales", resp.text)

        sent = self.client.post(f"{API}/chat/submit-quiz", headers=self.h("est1"), json={
            "quiz_id": data["quiz_id"], "quiz_title": data["quiz_title"],
            "user_answers": {"1": "A", "2": "A"}, "duration": 30})
        self.assertEqual(sent.status_code, 200, sent.text)
        body = sent.json()
        self.assertEqual((body["correct_answers"], body["percentage"]), (1, 50.0))
        review = {item["question_id"]: item for item in body["review"]}
        self.assertEqual((review[1]["correct_letter"], review[1]["is_correct"]), ("A", True))
        self.assertEqual((review[2]["correct_letter"], review[2]["is_correct"]), ("B", False))
        self.assertEqual(review[1]["explanation"], "Mitades iguales suman un entero.")

        # Doble envío: 409, no califica otro quiz pendiente.
        again = self.client.post(f"{API}/chat/submit-quiz", headers=self.h("est1"), json={
            "quiz_id": data["quiz_id"], "quiz_title": data["quiz_title"], "user_answers": {"1": "B"}})
        self.assertEqual(again.status_code, 409, again.text)

        db = self.Session()
        try:
            enr = db.query(Enrollment).filter_by(student_id=self.ids["est1"], classroom_id=self.r["c1"]).one()
            self.assertEqual((enr.total_sessions, enr.average_score), (1, 50.0))
            self.assertIsNotNone(enr.last_activity)
            self.assertGreater(enr.total_time_minutes, 0)
        finally:
            db.close()

        detail = self.client.get(f"{API}/classrooms/{self.r['c1']}/student-detail", headers=self.h("est1"))
        self.assertEqual((detail.json()["total_sessions"], detail.json()["average_score"]), (1, 50.0))

    def _submit(self, data, user="est1", answers=None):
        return self.client.post(f"{API}/chat/submit-quiz", headers=self.h(user), json={
            "quiz_id": data["quiz_id"], "quiz_title": data["quiz_title"],
            "user_answers": answers or {"1": "A", "2": "B"}, "duration": 20})

    def _enrollment(self, student, classroom_id):
        db = self.Session()
        try:
            e = db.query(Enrollment).filter_by(student_id=self.ids[student], classroom_id=classroom_id).one()
            return e.total_sessions, e.average_score
        finally:
            db.close()

    def test_quiz_con_varios_grupos_de_la_competencia(self):
        # est1 queda en dos grupos de Matemáticas (c1 y c3) y uno de Inglés (c2).
        db = self.Session()
        try:
            c3 = Classroom(teacher_id=self.ids["profe"], name="Mate refuerzo", subject="Matemáticas",
                           competency="matematicas", grade="11", invite_code="ESTU0003",
                           is_active=True, max_students=40)
            db.add(c3)
            db.flush()
            self.r["c3"] = c3.id
            db.add(Enrollment(student_id=self.ids["est1"], classroom_id=c3.id, is_active=True))
            db.add(Enrollment(student_id=self.ids["est1"], classroom_id=self.r["c2"], is_active=True))
            db.commit()
        finally:
            db.close()

        data = self._generate().json()
        self.assertEqual(self._submit(data).status_code, 200)
        db = self.Session()
        try:
            quiz = db.get(QuizHistory, data["quiz_id"])
            # No se elige un grupo arbitrariamente: queda registrado el caso.
            self.assertEqual((quiz.classroom_id, quiz.group_resolution), (None, "varios_grupos"))
        finally:
            db.close()
        # Cuenta una vez en cada grupo de Matemáticas y en ninguno de Inglés.
        self.assertEqual(self._enrollment("est1", self.r["c1"]), (1, 100.0))
        self.assertEqual(self._enrollment("est1", self.r["c3"]), (1, 100.0))
        self.assertEqual(self._enrollment("est1", self.r["c2"]), (0, 0.0))
        # Y una sola vez en su desempeño individual.
        perf = self.client.get(f"{API}/stats/performance", headers=self.h("est1")).json()
        self.assertEqual(perf["subjects"]["matematicas"]["quizzes"], 1)
        self.assertEqual(perf["overview"]["total_quizzes"], 1)
        dash = self.client.get(f"{API}/stats/dashboard", headers=self.h("est1")).json()
        self.assertEqual(dash["active_skills"], 1)

        # Un segundo quiz recalcula (no acumula de más) y el reenvío no duplica.
        data2 = self._generate().json()
        self.assertEqual(self._submit(data2, answers={"1": "B", "2": "A"}).status_code, 200)
        self.assertEqual(self._submit(data2).status_code, 409)
        self.assertEqual(self._enrollment("est1", self.r["c1"]), (2, 50.0))
        self.assertEqual(self._enrollment("est1", self.r["c3"]), (2, 50.0))

    def test_quiz_de_otra_competencia_no_cuenta_en_el_grupo(self):
        data = self._generate(user="est2").json()   # est2 solo está en Inglés (c2)
        self.assertEqual(self._submit(data, user="est2").status_code, 200)
        db = self.Session()
        try:
            self.assertEqual(db.get(QuizHistory, data["quiz_id"]).group_resolution, "sin_grupo")
        finally:
            db.close()
        self.assertEqual(self._enrollment("est2", self.r["c2"]), (0, 0.0))

    def test_practica_previa_cuenta_al_inscribirse(self):
        data = self._generate(user="est2").json()
        self.assertEqual(self._submit(data, user="est2").status_code, 200)
        join = self.client.post(f"{API}/classrooms/join", headers=self.h("est2"), json={"invite_code": "ESTU0001"})
        self.assertEqual(join.status_code, 200, join.text)
        self.assertEqual(self._enrollment("est2", self.r["c1"]), (1, 100.0))

    # ── Retiro por el profesor ──────────────────────────────────────────────
    def test_retiro_revoca_acceso_y_bloquea_el_codigo(self):
        r = self.r
        # est1 también está en c2 (no debe verse afectado) y tiene historial en c1.
        db = self.Session()
        try:
            db.add(Enrollment(student_id=self.ids["est1"], classroom_id=r["c2"], is_active=True))
            db.commit()
        finally:
            db.close()
        assign = self.client.post(f"{API}/bots/{r['bot']}/assignments", headers=self.h("profe"),
                                  json={"classroom_ids": [r["c1"]]})
        self.assertIn(assign.status_code, (200, 201), assign.text)
        post = self.client.post(f"{API}/posts", headers=self.h("profe"), json={
            "classroom_id": r["c1"], "post_type": "anuncio", "title": "AVISO-C1", "content": "x"})
        self.assertEqual(post.status_code, 201, post.text)

        # Solo el profesor del grupo puede retirar.
        self.assertIn(self.client.delete(f"{API}/classrooms/{r['c1']}/students/{self.ids['est1']}",
                                         headers=self.h("est2")).status_code, (403, 404))
        self.assertIn(self.client.delete(f"{API}/classrooms/{r['c1']}/students/{self.ids['est1']}",
                                         headers=self.h("profeB")).status_code, (403, 404))
        out = self.client.delete(f"{API}/classrooms/{r['c1']}/students/{self.ids['est1']}", headers=self.h("profe"))
        self.assertEqual(out.status_code, 200, out.text)

        h = self.h("est1")
        # Sin acceso a nada del grupo.
        self.assertEqual(self.client.get(f"{API}/classrooms/{r['c1']}/student-detail", headers=h).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/student/evaluations/{r['eval']}", headers=h).status_code, 404)
        self.assertEqual(self.client.post(f"{API}/student/evaluations/{r['eval']}/submit", headers=h,
                                          json={"submission_id": r["sub"], "answers": {}}).status_code, 404)
        self.assertEqual(self.client.get(f"{API}/student/materials/{r['mat']}/download", headers=h).status_code, 404)
        self.assertEqual(self.client.post(f"{API}/chat/conversations", headers=h,
                                          json={"bot_id": r["bot"]}).status_code, 403)
        self.assertEqual(self.client.get(f"{API}/bots/{r['bot']}", headers=h).status_code, 403)
        for path in ("/student/evaluations", "/student/materials", "/posts", "/classrooms/my-enrolled",
                     "/bots/shared-with-me"):
            body = self.client.get(f"{API}{path}", headers=h).text
            for secret in ("Parcial", "Guía 1", "AVISO-C1", "Mate 11A", "Bot privado"):
                self.assertNotIn(secret, body, f"{path} sigue mostrando {secret}")
        # Su otro grupo sigue intacto.
        enrolled = self.client.get(f"{API}/classrooms/my-enrolled", headers=h).json()["classrooms"]
        self.assertEqual([c["id"] for c in enrolled], [r["c2"]])

        # No puede volver con el código anterior ni con uno regenerado.
        self.assertEqual(self.client.post(f"{API}/classrooms/join", headers=h,
                                          json={"invite_code": "ESTU0001"}).status_code, 403)
        new_code = self.client.post(f"{API}/classrooms/{r['c1']}/regenerate-code", headers=self.h("profe"))
        self.assertEqual(new_code.status_code, 200, new_code.text)
        again = self.client.post(f"{API}/classrooms/join", headers=h,
                                 json={"invite_code": new_code.json()["invite_code"]})
        self.assertEqual(again.status_code, 403, again.text)
        # Otro estudiante sí entra con el código nuevo.
        self.assertEqual(self.client.post(f"{API}/classrooms/join", headers=self.h("est2"),
                                          json={"invite_code": new_code.json()["invite_code"]}).status_code, 200)

        # El historial se conserva.
        db = self.Session()
        try:
            self.assertIsNotNone(db.get(EvaluationSubmission, r["sub"]))
            self.assertIsNotNone(db.get(QuizHistory, r["quiz"]))
            e = db.query(Enrollment).filter_by(student_id=self.ids["est1"], classroom_id=r["c1"]).one()
            self.assertFalse(e.is_active)
            self.assertEqual((e.removed_by, e.removed_invite_code), (self.ids["profe"], "ESTU0001"))
        finally:
            db.close()
        self.assertEqual(self.client.get(f"{API}/chat/conversations/{r['conv']}", headers=h).status_code, 200)

        # El profesor lo ve en «Retirados» y lo reincorpora.
        removed = self.client.get(f"{API}/classrooms/{r['c1']}/removed-students", headers=self.h("profe"))
        self.assertEqual([x["student_id"] for x in removed.json()], [self.ids["est1"]])
        self.assertIn(self.client.get(f"{API}/classrooms/{r['c1']}/removed-students",
                                      headers=self.h("profeB")).status_code, (403, 404))
        self.assertIn(self.client.post(f"{API}/classrooms/{r['c1']}/students/{self.ids['est1']}/reinstate",
                                       headers=self.h("est1")).status_code, (403, 404))
        back = self.client.post(f"{API}/classrooms/{r['c1']}/students/{self.ids['est1']}/reinstate",
                                headers=self.h("profe"))
        self.assertEqual(back.status_code, 200, back.text)
        self.assertEqual(self.client.get(f"{API}/classrooms/{r['c1']}/student-detail", headers=h).status_code, 200)
        self.assertEqual(self.client.get(f"{API}/classrooms/{r['c1']}/removed-students",
                                         headers=self.h("profe")).json(), [])
        # Reincorporado, no puede reincorporarse dos veces.
        self.assertEqual(self.client.post(f"{API}/classrooms/{r['c1']}/students/{self.ids['est1']}/reinstate",
                                          headers=self.h("profe")).status_code, 404)

    # ── 3. Conversaciones con NeuroBot ─────────────────────────────────────
    def test_conversacion_con_bot_solo_si_esta_autorizado(self):
        denied = self.client.post(f"{API}/chat/conversations", headers=self.h("est1"),
                                  json={"bot_id": self.r["bot"]})
        self.assertEqual(denied.status_code, 403, denied.text)
        missing = self.client.post(f"{API}/chat/conversations", headers=self.h("est1"), json={"bot_id": 9999})
        self.assertEqual(missing.status_code, 404, missing.text)

        assign = self.client.post(f"{API}/bots/{self.r['bot']}/assignments", headers=self.h("profe"),
                                  json={"classroom_ids": [self.r["c1"]]})
        self.assertIn(assign.status_code, (200, 201), assign.text)
        ok = self.client.post(f"{API}/chat/conversations", headers=self.h("est1"), json={"bot_id": self.r["bot"]})
        self.assertEqual(ok.status_code, 200, ok.text)
        self.assertEqual(ok.json()["bot_id"], self.r["bot"])

    # ── 4. Inscripción por código ───────────────────────────────────────────
    def test_no_se_une_a_grupo_de_otra_institucion(self):
        resp = self.client.post(f"{API}/classrooms/join", headers=self.h("est1"), json={"invite_code": "OTROCOLE"})
        self.assertEqual(resp.status_code, 404, resp.text)
        ok = self.client.post(f"{API}/classrooms/join", headers=self.h("est1"), json={"invite_code": "ESTU0002"})
        self.assertEqual(ok.status_code, 200, ok.text)

    def test_reactivar_inscripcion_respeta_el_cupo(self):
        db = self.Session()
        try:
            c2 = db.get(Classroom, self.r["c2"])
            c2.max_students = 1  # est2 ya ocupa el cupo
            db.add(Enrollment(student_id=self.ids["est1"], classroom_id=c2.id, is_active=False))
            db.commit()
        finally:
            db.close()
        resp = self.client.post(f"{API}/classrooms/join", headers=self.h("est1"), json={"invite_code": "ESTU0002"})
        self.assertEqual(resp.status_code, 400, resp.text)
        self.assertIn("llena", resp.json()["detail"])

    # ── 5. Tablero: la publicación notifica a los estudiantes del grupo ─────
    def test_publicacion_en_tablero_notifica_al_grupo(self):
        resp = self.client.post(f"{API}/posts", headers=self.h("profe"), json={
            "classroom_id": self.r["c1"], "post_type": "tarea", "title": "Taller 3",
            "content": "Resolver 1 a 5", "due_date": "2026-10-30"})
        self.assertEqual(resp.status_code, 201, resp.text)
        notes = self.client.get(f"{API}/notifications", headers=self.h("est1")).json()["notifications"]
        board = [n for n in notes if n["type"] == "publicacion_tablero"]
        self.assertEqual(len(board), 1, notes)
        self.assertEqual(board[0]["link"], "/tablero")
        self.assertIn("Taller 3", board[0]["title"])
        # est2 no pertenece al grupo: no recibe nada.
        other = self.client.get(f"{API}/notifications", headers=self.h("est2")).json()["notifications"]
        self.assertFalse([n for n in other if n["type"] == "publicacion_tablero"])

    # ── 6. Mensajería: eliminar para todos borra el adjunto ─────────────────
    def test_eliminar_para_todos_borra_el_adjunto(self):
        attach = f"{API}/messages/{self.r['dm']}/attachment"
        self.assertEqual(self.client.get(attach, headers=self.h("est1")).status_code, 200)
        resp = self.client.delete(f"{API}/messages/{self.r['dm']}", headers=self.h("profe"),
                                  params={"scope": "for_all"})
        self.assertEqual(resp.status_code, 200, resp.text)
        self.assertEqual(self.client.get(attach, headers=self.h("est1")).status_code, 404)
        db = self.Session()
        try:
            msg = db.get(DirectMessage, self.r["dm"])
            self.assertIsNone(msg.attachment_data)
            self.assertIsNone(msg.attachment_name)
        finally:
            db.close()

    def test_eliminar_para_mi_oculta_el_adjunto_solo_a_mi(self):
        resp = self.client.delete(f"{API}/messages/{self.r['dm']}", headers=self.h("est1"),
                                  params={"scope": "for_me"})
        self.assertEqual(resp.status_code, 200, resp.text)
        attach = f"{API}/messages/{self.r['dm']}/attachment"
        self.assertEqual(self.client.get(attach, headers=self.h("est1")).status_code, 404)
        self.assertEqual(self.client.get(attach, headers=self.h("profe")).status_code, 200)

        # El borrado se guarda: al volver a abrir la conversación no reaparece,
        # ni en la vista previa de la lista; el profesor lo sigue viendo.
        thread = self.client.get(f"{API}/messages/conversations/{self.ids['profe']}", headers=self.h("est1"))
        self.assertEqual(thread.status_code, 200, thread.text)
        self.assertNotIn("SECRETO-DM", thread.text)
        listing = self.client.get(f"{API}/messages/conversations", headers=self.h("est1"))
        self.assertNotIn("SECRETO-DM", listing.text)
        other = self.client.get(f"{API}/messages/conversations/{self.ids['est1']}", headers=self.h("profe"))
        self.assertIn("SECRETO-DM", other.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
