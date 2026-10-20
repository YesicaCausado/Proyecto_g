"""
Google Drive y Google Calendar: auditoría del rol Profesor.

  * La conexión de Google es de cada usuario (RF-32): otro profesor de la
    misma institución no ve la cuenta, no navega su Drive, no crea eventos en
    su Calendar ni puede desconectarla.
  * El state OAuth ya no lleva el JWT de la sesión y cada proveedor pide solo
    sus permisos (más «email» para mostrar la cuenta).
  * El callback ya no guarda tokens: reenvía el código y la conexión la
    completa el usuario autenticado que la inició (CSRF de OAuth).
  * Si el usuario desmarca permisos en Google, la conexión no se guarda.
  * Un 401 de Google marca la integración como «token_expired».
  * Importar de Drive usa los metadatos reales y no duplica.
  * Eventos de día completo terminan el día siguiente (antes Google
    respondía 400) y una hora inválida ya no se convierte en «09:00».
  * El profesor no puede desconectar el webhook institucional.

Todas las respuestas de Google están simuladas con unittest.mock: no son
pruebas contra Google real.
"""
from __future__ import annotations

import base64
import json
import os
import sys
import unittest
from unittest import mock
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.api.auth import create_access_token  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.db.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.institution import Institution  # noqa: E402
from app.models.integration import Automation, Integration  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.services import integration_service as isvc  # noqa: E402

API = "/api/v1"


class _Resp:
    def __init__(self, status_code, data=None):
        self.status_code = status_code
        self._data = data or {}
        self.text = json.dumps(self._data)

    def json(self):
        return self._data


class GooglePorUsuarioTests(unittest.TestCase):
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
        self._cfg = mock.patch.multiple(settings, GOOGLE_CLIENT_ID="cid.apps.googleusercontent.com",
                                        GOOGLE_CLIENT_SECRET="csecret")
        self._cfg.start()
        db = self.Session()
        inst = Institution(name="Colegio A", dane_code="51100000009", is_active=True)
        db.add(inst)
        db.flush()
        self.inst_id = inst.id
        self.ids = {}
        for username, role in (("profe", UserRole.PROFESOR), ("profe2", UserRole.PROFESOR),
                               ("super", UserRole.SUPER_PROFESOR)):
            u = User(username=username, email=f"{username}@t.edu.co", full_name=username.title(),
                     hashed_password="x", role=role.value, institution_id=inst.id, is_active=True)
            db.add(u)
            db.flush()
            self.ids[username] = u.id
        db.commit()
        db.close()

    def tearDown(self):
        self._cfg.stop()
        app.dependency_overrides.pop(get_db, None)

    def h(self, username):
        return {"Authorization": "Bearer " + create_access_token({"sub": username})}

    def connect_row(self, username, provider, **extra):
        db = self.Session()
        integ = Integration(institution_id=self.inst_id, user_id=self.ids[username], provider=provider,
                            status="connected", account_email=f"{username}@gmail.com",
                            access_token=isvc.encrypt_token("access-" + username),
                            refresh_token=isvc.encrypt_token("refresh-" + username), config={}, **extra)
        db.add(integ)
        db.commit()
        iid = integ.id
        db.close()
        return iid

    def row(self, iid):
        db = self.Session()
        try:
            return db.query(Integration).get(iid)
        finally:
            db.close()

    # ── Aislamiento entre profesores ───────────────────────────────────────
    def test_la_conexion_de_google_es_de_cada_profesor(self):
        drive = self.connect_row("profe", "google_drive")
        cal = self.connect_row("profe", "google_calendar")

        mine = self.client.get(f"{API}/integrations", headers=self.h("profe")).json()["integrations"]
        self.assertEqual({i["provider"] for i in mine}, {"google_drive", "google_calendar"})
        self.assertEqual(self.client.get(f"{API}/integrations", headers=self.h("profe2")).json()["integrations"], [])

        with mock.patch.object(isvc, "_google_request") as google:
            for method, path, body in (
                ("get", "/integrations/google/drive/folders", None),
                ("get", "/integrations/google/drive/folders/1AbCdEfGhIjK/files", None),
                ("post", "/integrations/google/drive/import", {"files": [{"id": "1AbCdEfGhIjK"}]}),
                ("get", "/integrations/google/calendar/calendars", None),
                ("post", "/integrations/google/calendar/events",
                 {"title": "x", "calendar_id": "primary", "event_date": "2026-10-21"}),
            ):
                kwargs = {"json": body} if body is not None else {}
                r = getattr(self.client, method)(f"{API}{path}", headers=self.h("profe2"), **kwargs)
                self.assertEqual(r.status_code, 400, f"{method} {path}: {r.text}")
            google.assert_not_called()          # nunca se usó el token de «profe»

        self.assertEqual(self.client.delete(f"{API}/integrations/google_drive", headers=self.h("profe2")).status_code, 404)
        self.assertEqual(self.row(drive).status, "connected")
        self.assertEqual(self.row(cal).status, "connected")

        options = self.client.get(f"{API}/automation-options", headers=self.h("profe2")).json()
        self.assertFalse(options["calendar_connected"])

    def test_automatizacion_usa_el_calendar_de_quien_la_creo(self):
        self.connect_row("profe", "google_calendar")
        db = self.Session()
        autom = Automation(institution_id=self.inst_id, created_by=self.ids["profe2"], name="Cal",
                           trigger="nueva_actividad", action="google_calendar", configuration={}, enabled=True)
        db.add(autom)
        db.commit()
        db.refresh(autom)
        with mock.patch.object(isvc, "create_google_calendar_event") as create:
            res = isvc.run_automation_action(db, autom, db.query(User).get(self.ids["profe2"]), "x", {})
        db.close()
        self.assertFalse(res["ok"])
        create.assert_not_called()

    def test_profesor_no_desconecta_el_webhook(self):
        db = self.Session()
        db.add(Integration(institution_id=self.inst_id, user_id=self.ids["super"], provider="webhook",
                           status="connected", config={"url": "https://example.org/h"}))
        db.commit()
        db.close()
        self.assertEqual(self.client.delete(f"{API}/integrations/webhook", headers=self.h("profe")).status_code, 403)

    # ── OAuth ──────────────────────────────────────────────────────────────
    def connect_url(self, provider, who="profe"):
        r = self.client.post(f"{API}/integrations/google/{provider}/connect", headers=self.h(who))
        self.assertEqual(r.status_code, 200, r.text)
        return parse_qs(urlparse(r.json()["url"]).query)

    def test_state_sin_jwt_y_permisos_por_proveedor(self):
        q = self.connect_url("drive")
        state = q["state"][0]
        payload = json.loads(base64.urlsafe_b64decode(state.rsplit(".", 1)[0]))
        self.assertNotIn("token", payload)
        self.assertNotIn(create_access_token({"sub": "profe"}).split(".")[0], state)
        drive_scopes = q["scope"][0].split()
        self.assertIn("email", drive_scopes)
        self.assertIn(isvc.DRIVE_SCOPE, drive_scopes)
        self.assertFalse(any("calendar" in s for s in drive_scopes))
        cal_scopes = self.connect_url("calendar")["scope"][0].split()
        self.assertFalse(any("drive" in s for s in cal_scopes))
        self.assertEqual(self.client.post(f"{API}/integrations/google/otro/connect",
                                          headers=self.h("profe")).status_code, 400)

    def test_callback_no_guarda_y_reenvia_el_codigo(self):
        state = self.connect_url("drive")["state"][0]
        with mock.patch.object(isvc, "exchange_code_for_tokens") as exchange:
            r = self.client.get(f"{API}/integrations/google/callback",
                                params={"code": "4/abc", "state": state}, follow_redirects=False)
        exchange.assert_not_called()
        loc = r.headers["location"]
        self.assertIn("/#/teacher?tab=integraciones&google_code=4/abc", loc.replace("%2F", "/"))
        db = self.Session()
        self.assertEqual(db.query(Integration).count(), 0)
        db.close()
        bad = self.client.get(f"{API}/integrations/google/callback",
                              params={"code": "4/abc", "state": state + "x"}, follow_redirects=False)
        self.assertIn("integration_error=", bad.headers["location"])
        self.assertNotIn("google_code", bad.headers["location"])

    def tokens(self, scope):
        return {"access_token": "ya29.real", "refresh_token": "1//r", "expires_in": 3599, "scope": scope}

    def test_completar_solo_quien_inicio(self):
        state = self.connect_url("drive", who="profe")["state"][0]
        with mock.patch.object(isvc, "exchange_code_for_tokens") as exchange:
            r = self.client.post(f"{API}/integrations/google/complete", headers=self.h("profe2"),
                                 json={"code": "4/abc", "state": state})
        self.assertEqual(r.status_code, 403, r.text)
        exchange.assert_not_called()

    def test_completar_guarda_cifrado_y_sin_tokens_en_la_respuesta(self):
        state = self.connect_url("drive")["state"][0]
        with mock.patch.object(isvc, "exchange_code_for_tokens",
                               return_value=self.tokens(f"openid email {isvc.DRIVE_SCOPE}")), \
             mock.patch.object(isvc, "get_user_email", return_value="docente@gmail.com"):
            r = self.client.post(f"{API}/integrations/google/complete", headers=self.h("profe"),
                                 json={"code": "4/abc", "state": state})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertNotIn("ya29.real", r.text)
        self.assertNotIn("1//r", r.text)
        db = self.Session()
        integ = db.query(Integration).one()
        db.close()
        self.assertEqual((integ.user_id, integ.provider, integ.status, integ.account_email),
                         (self.ids["profe"], "google_drive", "connected", "docente@gmail.com"))
        self.assertNotEqual(integ.access_token, "ya29.real")
        self.assertEqual(isvc.decrypt_token(integ.refresh_token), "1//r")

    def test_permisos_desmarcados_no_quedan_conectados(self):
        state = self.connect_url("calendar")["state"][0]
        with mock.patch.object(isvc, "exchange_code_for_tokens",
                               return_value=self.tokens("openid email https://www.googleapis.com/auth/calendar.readonly")), \
             mock.patch.object(isvc, "_try_revoke_token", return_value=True) as revoke:
            r = self.client.post(f"{API}/integrations/google/complete", headers=self.h("profe"),
                                 json={"code": "4/abc", "state": state})
        self.assertEqual(r.status_code, 400, r.text)
        revoke.assert_called_once()
        db = self.Session()
        self.assertEqual(db.query(Integration).count(), 0)
        db.close()

    # ── Errores de Google ──────────────────────────────────────────────────
    def test_401_de_google_marca_token_expirado(self):
        iid = self.connect_row("profe", "google_drive")
        with mock.patch("httpx.request", return_value=_Resp(401, {"error": {"status": "UNAUTHENTICATED"}})):
            r = self.client.get(f"{API}/integrations/google/drive/folders", headers=self.h("profe"))
        self.assertEqual(r.status_code, 409, r.text)        # 401 cerraría la sesión de NeuroLearn
        self.assertEqual(self.row(iid).status, "token_expired")
        listed = self.client.get(f"{API}/integrations", headers=self.h("profe")).json()["integrations"]
        self.assertEqual(listed[0]["status"], "token_expired")

    def test_refresh_revocado_marca_token_expirado(self):
        from datetime import datetime, timedelta
        iid = self.connect_row("profe", "google_calendar", token_expires_at=datetime.utcnow() - timedelta(hours=2))
        with mock.patch("httpx.post", return_value=_Resp(400, {"error": "invalid_grant"})):
            r = self.client.get(f"{API}/integrations/google/calendar/calendars", headers=self.h("profe"))
        self.assertEqual(r.status_code, 409, r.text)
        self.assertEqual(self.row(iid).status, "token_expired")

    def test_drive_pagina_y_valida_carpeta(self):
        self.connect_row("profe", "google_drive")
        pages = [_Resp(200, {"files": [{"id": "a" * 12, "name": "A"}], "nextPageToken": "p2"}),
                 _Resp(200, {"files": [{"id": "b" * 12, "name": "B"}]})]
        with mock.patch("httpx.request", side_effect=pages):
            r = self.client.get(f"{API}/integrations/google/drive/folders", headers=self.h("profe"))
        self.assertEqual([f["name"] for f in r.json()["folders"]], ["A", "B"])
        r = self.client.get(f"{API}/integrations/google/drive/folders/abcdefghij' or name contains 'a/files", headers=self.h("profe"))
        self.assertEqual(r.status_code, 400)

    def test_importar_usa_metadatos_reales_y_no_duplica(self):
        self.connect_row("profe", "google_drive")
        meta = _Resp(200, {"id": "1AbCdEfGhIjK", "name": "Taller real.pdf", "mimeType": "application/pdf",
                           "webViewLink": "https://drive.google.com/file/d/1AbCdEfGhIjK/view",
                           "permissions": [{"type": "user", "role": "owner"}]})
        body = {"files": [{"id": "1AbCdEfGhIjK", "name": "Nombre inventado"}]}
        with mock.patch("httpx.request", return_value=meta):
            first = self.client.post(f"{API}/integrations/google/drive/import", headers=self.h("profe"), json=body).json()
            second = self.client.post(f"{API}/integrations/google/drive/import", headers=self.h("profe"), json=body).json()
        self.assertEqual(first["imported"][0]["name"], "Taller real.pdf")
        self.assertEqual(first["restricted"], ["Taller real.pdf"])   # sin compartir en Drive
        self.assertEqual((second["count"], second["skipped"]), (0, ["Taller real.pdf"]))
        with mock.patch("httpx.request", return_value=_Resp(404, {"error": {"errors": [{"reason": "notFound"}]}})):
            r = self.client.post(f"{API}/integrations/google/drive/import", headers=self.h("profe"),
                                 json={"files": [{"id": "1NoExisteXYZ"}]})
        self.assertEqual(r.status_code, 404, r.text)

    # ── Calendar ───────────────────────────────────────────────────────────
    def test_cuerpo_de_eventos(self):
        allday = isvc.build_event_body("Examen", "", "2026-10-31", None, "UTC")
        self.assertEqual((allday["start"], allday["end"]), ({"date": "2026-10-31"}, {"date": "2026-11-01"}))
        late = isvc.build_event_body("Clase", "", "2026-10-31", "23:30", "America/Bogota")
        self.assertEqual(late["end"]["dateTime"], "2026-11-01T00:30:00")
        self.assertEqual(late["start"]["timeZone"], "America/Bogota")
        for date, time in (("31/10/2026", None), ("2026-10-31", "25:99")):
            with self.assertRaises(isvc.GoogleAPIError):
                isvc.build_event_body("x", "", date, time, "UTC")

    def test_crear_evento_usa_la_zona_del_calendario(self):
        self.connect_row("profe", "google_calendar")
        calls = []

        def fake(method, url, **kw):
            calls.append((method, url, kw))
            if method == "GET":
                return _Resp(200, {"timeZone": "America/Lima"})
            return _Resp(200, {"id": "ev1", "summary": kw["json"]["summary"], "htmlLink": "https://calendar.google.com/x"})

        with mock.patch("httpx.request", side_effect=fake):
            r = self.client.post(f"{API}/integrations/google/calendar/events", headers=self.h("profe"),
                                 json={"title": "Parcial", "calendar_id": "primary",
                                       "event_date": "2026-10-21", "event_time": "10:00"})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(r.json()["id"], "ev1")
        self.assertEqual(calls[-1][2]["json"]["start"]["timeZone"], "America/Lima")
        bad = self.client.post(f"{API}/integrations/google/calendar/events", headers=self.h("profe"),
                               json={"title": "Parcial", "calendar_id": "primary", "event_date": "mañana"})
        self.assertEqual(bad.status_code, 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
