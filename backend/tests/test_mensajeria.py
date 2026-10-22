"""
Mensajería directa: envío sin adjuntos y eliminación «para mí» / «para todos».

Cada caso vuelve a leer la conversación desde la API (como al recargar la
página) para comprobar que el cambio quedó guardado, y lo mira desde los dos
participantes.
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
from app.models.institution import Institution  # noqa: E402
from app.models.messages import DirectMessage  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

API = "/api/v1"


class MensajeriaTests(unittest.TestCase):
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
        inst = Institution(name="Colegio M", dane_code="51100000111", is_active=True)
        db.add(inst)
        db.flush()
        self.ids = {}
        for username, role in (("profe", UserRole.PROFESOR), ("est1", UserRole.ESTUDIANTE),
                               ("est2", UserRole.ESTUDIANTE)):
            u = User(username=username, email=f"{username}@m.edu.co", full_name=username.title(),
                     hashed_password="x", role=role.value, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        c = Classroom(teacher_id=self.ids["profe"], name="Grupo M", subject="Matemáticas", grade="10",
                      invite_code="MENS0001", is_active=True, max_students=40)
        db.add(c)
        db.flush()
        db.add(Enrollment(student_id=self.ids["est1"], classroom_id=c.id, is_active=True))
        db.commit()
        db.close()

    def tearDown(self):
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def send(self, sender, receiver, text, **kwargs):
        return self.client.post(f"{API}/messages/conversations/{self.ids[receiver]}",
                                headers=self.h(sender), data={"content": text}, **kwargs)

    def thread(self, viewer, other):
        r = self.client.get(f"{API}/messages/conversations/{self.ids[other]}", headers=self.h(viewer))
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()
        return data["messages"] if isinstance(data, dict) else data

    def preview(self, viewer, other):
        convs = self.client.get(f"{API}/messages/conversations", headers=self.h(viewer)).json()
        convs = convs["conversations"] if isinstance(convs, dict) else convs
        return next(c for c in convs if c["other_user_id"] == self.ids[other])

    # ── Envío ──────────────────────────────────────────────────────────────
    def test_no_se_pueden_enviar_adjuntos(self):
        r = self.send("profe", "est1", "Te mando la guía",
                      files={"file": ("guia.pdf", b"%PDF-1.4", "application/pdf")})
        self.assertEqual(r.status_code, 400, r.text)
        self.assertIn("adjuntos", r.json()["detail"])
        db = self.Session()
        try:
            self.assertEqual(db.query(DirectMessage).count(), 0)   # no se guardó nada
        finally:
            db.close()
        self.assertEqual(self.send("profe", "est1", "   ").status_code, 400)

    def test_fecha_en_utc_explicita(self):
        r = self.send("profe", "est1", "Hola")
        self.assertEqual(r.status_code, 201, r.text)
        created = r.json()["created_at"]
        self.assertTrue(created.endswith("+00:00"), created)
        sent_at = datetime.fromisoformat(created)
        self.assertLess(abs((datetime.now(sent_at.tzinfo) - sent_at).total_seconds()), 60)

    # ── Eliminar para todos ────────────────────────────────────────────────
    def test_eliminar_para_todos(self):
        mid = self.send("profe", "est1", "SECRETO para borrar").json()["id"]
        # El receptor no puede eliminarlo para todos; un tercero, nada.
        self.assertEqual(self.client.delete(f"{API}/messages/{mid}", headers=self.h("est1"),
                                            params={"scope": "for_all"}).status_code, 403)
        self.assertEqual(self.client.delete(f"{API}/messages/{mid}", headers=self.h("est2"),
                                            params={"scope": "for_me"}).status_code, 403)
        r = self.client.delete(f"{API}/messages/{mid}", headers=self.h("profe"), params={"scope": "for_all"})
        self.assertEqual(r.status_code, 200, r.text)

        for viewer, other, label in (("profe", "est1", "Eliminaste este mensaje"),
                                     ("est1", "profe", "Se eliminó este mensaje")):
            msgs = self.thread(viewer, other)
            self.assertEqual(len(msgs), 1)
            self.assertEqual((msgs[0]["content"], msgs[0]["deleted_for_all"]), (label, True))
            self.assertNotIn("SECRETO", str(msgs))
            self.assertEqual(self.preview(viewer, other)["last_message"], "Se eliminó este mensaje")
        self.assertEqual(self.preview("est1", "profe")["unread_count"], 0)
        db = self.Session()
        try:
            self.assertEqual(db.get(DirectMessage, mid).content, "")
        finally:
            db.close()
        # Repetirlo no cambia nada (ya no está dentro de lo permitido para todos).
        again = self.client.delete(f"{API}/messages/{mid}", headers=self.h("profe"), params={"scope": "for_all"})
        self.assertIn(again.status_code, (200, 403))

    def test_eliminar_para_todos_fuera_de_los_15_minutos(self):
        mid = self.send("profe", "est1", "Mensaje viejo").json()["id"]
        db = self.Session()
        try:
            db.get(DirectMessage, mid).created_at = datetime.utcnow() - timedelta(minutes=16)
            db.commit()
        finally:
            db.close()
        msgs = self.thread("profe", "est1")
        self.assertFalse(msgs[0]["can_delete_for_all"])
        r = self.client.delete(f"{API}/messages/{mid}", headers=self.h("profe"), params={"scope": "for_all"})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.thread("est1", "profe")[0]["content"], "Mensaje viejo")   # intacto

    # ── Eliminar para mí ───────────────────────────────────────────────────
    def test_eliminar_para_mi_recibido_y_enviado(self):
        first = self.send("profe", "est1", "Primero").json()["id"]
        second = self.send("est1", "profe", "Segundo").json()["id"]

        # El estudiante borra para sí un mensaje RECIBIDO.
        r = self.client.delete(f"{API}/messages/{first}", headers=self.h("est1"), params={"scope": "for_me"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual([m["content"] for m in self.thread("est1", "profe")], ["Segundo"])
        self.assertEqual([m["content"] for m in self.thread("profe", "est1")], ["Primero", "Segundo"])

        # Y uno ENVIADO: la vista previa pasa a quedar vacía para él.
        r = self.client.delete(f"{API}/messages/{second}", headers=self.h("est1"), params={"scope": "for_me"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self.thread("est1", "profe"), [])
        self.assertIsNone(self.preview("est1", "profe")["last_message"])
        # El profesor sigue viendo ambos.
        self.assertEqual([m["content"] for m in self.thread("profe", "est1")], ["Primero", "Segundo"])
        self.assertEqual(self.preview("profe", "est1")["last_message"], "Segundo")


if __name__ == "__main__":
    unittest.main(verbosity=2)
