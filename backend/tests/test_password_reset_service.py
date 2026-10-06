"""
NeuroLearn IA — Pruebas unitarias de CU-03 «Recuperar contraseña».

Prueban el caso de uso (PasswordResetService), el adaptador de Brevo y las
reglas de direcciones SIN base de datos, FastAPI ni red: todas las
dependencias se reemplazan por dobles en memoria.

Ejecutar desde backend/:

    python -m pytest tests/test_password_reset_service.py -v
    # o sin pytest:
    python -m unittest tests.test_password_reset_service -v
"""
from __future__ import annotations

import os
import sys
import unittest
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.mail.addresses import (  # noqa: E402
    is_deliverable_email,
    parse_sender,
    placeholder_email_for,
)
from app.services.mail.brevo import BREVO_SEND_URL, BrevoEmailSender  # noqa: E402
from app.services.mail.ports import (  # noqa: E402
    EmailAddress,
    EmailConfigurationError,
    EmailDeliveryError,
    EmailMessage,
)
from app.services.mail.templates import render_password_reset_email  # noqa: E402
from app.services.password_reset_service import (  # noqa: E402
    InvalidResetTokenError,
    PasswordResetPolicy,
    PasswordResetService,
    PasswordReuseError,
    RequestOutcome,
    TokenProblem,
    WeakPasswordError,
    hash_reset_token,
)

T0 = datetime(2026, 10, 5, 12, 0, tzinfo=timezone.utc)


# ─── Dobles de prueba ────────────────────────────────────────────────────────

@dataclass
class FakeUser:
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str] = "Ana Pérez"
    role: str = "estudiante"
    institution_id: Optional[int] = 1
    is_active: bool = True
    hashed_password: str = "hash:Vieja#123"
    must_change_password: bool = True


@dataclass
class FakeToken:
    id: int
    user_id: int
    token: str
    expires_at: datetime
    created_at: datetime
    ip_address: Optional[str] = None
    used: bool = False


class FakeUsers:
    def __init__(self, *users: FakeUser) -> None:
        self.by_id = {u.id: u for u in users}

    def find_by_identifier(self, identifier: str) -> Optional[FakeUser]:
        for u in self.by_id.values():
            if u.username == identifier:
                return u
        for u in self.by_id.values():
            if u.email and u.email.lower() == identifier.lower():
                return u
        return None

    def get_by_id(self, user_id: int) -> Optional[FakeUser]:
        return self.by_id.get(user_id)


class FakeTokens:
    def __init__(self) -> None:
        self.rows: List[FakeToken] = []

    def add(self, *, user_id, token_hash, expires_at, created_at, ip_address) -> FakeToken:
        row = FakeToken(len(self.rows) + 1, user_id, token_hash, expires_at, created_at, ip_address)
        self.rows.append(row)
        return row

    def find_by_hash(self, token_hash: str, *, for_update: bool = False) -> Optional[FakeToken]:
        return next((r for r in self.rows if r.token == token_hash), None)

    def latest_created_at(self, user_id: int) -> Optional[datetime]:
        dates = [r.created_at for r in self.rows if r.user_id == user_id]
        return max(dates) if dates else None

    def count_created_since(self, user_id: int, since: datetime) -> int:
        return sum(1 for r in self.rows if r.user_id == user_id and r.created_at >= since)

    def invalidate_active(self, user_id: int) -> int:
        n = 0
        for r in self.rows:
            if r.user_id == user_id and not r.used:
                r.used = True
                n += 1
        return n


class FakeAudit:
    def __init__(self) -> None:
        self.actions: List[str] = []

    def record(self, *, action, user, ip_address, notes="") -> None:
        self.actions.append(action)


class FakeTx:
    def __init__(self) -> None:
        self.commits = 0
        self.rollbacks = 0

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        self.rollbacks += 1


class FakeSender:
    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.sent: List[EmailMessage] = []

    def send(self, message: EmailMessage) -> str:
        if self.fail:
            raise EmailDeliveryError("Brevo caído")
        self.sent.append(message)
        return f"msg-{len(self.sent)}"


class Clock:
    def __init__(self, now: datetime) -> None:
        self.now = now

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs) -> None:
        self.now += timedelta(**kwargs)


def simple_policy_check(password: str) -> Optional[str]:
    return None if len(password) >= 8 and any(c.isdigit() for c in password) else "Contraseña débil."


@dataclass
class Harness:
    user: FakeUser
    users: FakeUsers
    tokens: FakeTokens = field(default_factory=FakeTokens)
    audit: FakeAudit = field(default_factory=FakeAudit)
    tx: FakeTx = field(default_factory=FakeTx)
    sender: FakeSender = field(default_factory=FakeSender)
    clock: Clock = field(default_factory=lambda: Clock(T0))
    issued: List[str] = field(default_factory=list)

    def service(self) -> PasswordResetService:
        def token_factory() -> str:
            raw = f"raw-token-{len(self.issued) + 1:04d}-xxxxxxxxxxxxxxxx"
            self.issued.append(raw)
            return raw

        return PasswordResetService(
            users=self.users,
            tokens=self.tokens,
            audit=self.audit,
            transaction=self.tx,
            email_sender=self.sender,
            hash_password=lambda p: f"hash:{p}",
            verify_password=lambda p, h: h == f"hash:{p}",
            check_password_policy=simple_policy_check,
            policy=PasswordResetPolicy(
                reset_page_url="https://neurolearnym.vercel.app/reset-password",
                login_url="https://neurolearnym.vercel.app/login",
            ),
            clock=self.clock,
            token_factory=token_factory,
        )


def make_harness(**user_kwargs) -> Harness:
    defaults: Dict[str, object] = {"id": 7, "username": "1023456789", "email": "ana@colegio.edu.co"}
    defaults.update(user_kwargs)
    user = FakeUser(**defaults)  # type: ignore[arg-type]
    return Harness(user=user, users=FakeUsers(user))


# ─── Paso 1: solicitar enlace ────────────────────────────────────────────────

class RequestResetTests(unittest.TestCase):
    def test_envia_enlace_por_documento_y_guarda_solo_el_hash(self):
        h = make_harness()
        outcome = h.service().request_reset("1023456789", ip_address="190.1.2.3")

        self.assertEqual(outcome, RequestOutcome.SENT)
        self.assertEqual(len(h.sender.sent), 1)
        raw = h.issued[0]
        self.assertEqual(h.tokens.rows[0].token, hash_reset_token(raw))
        self.assertNotIn(raw, [r.token for r in h.tokens.rows])
        self.assertIn(f"https://neurolearnym.vercel.app/reset-password?token={raw}", h.sender.sent[0].text)
        self.assertEqual(h.tokens.rows[0].expires_at, T0 + timedelta(minutes=15))
        self.assertEqual(h.audit.actions, ["password_reset_requested"])
        self.assertEqual(h.tx.commits, 1)

    def test_busca_por_correo_sin_distinguir_mayusculas(self):
        h = make_harness()
        self.assertEqual(h.service().request_reset("ANA@Colegio.edu.co"), RequestOutcome.SENT)

    def test_cuenta_inexistente_no_envia(self):
        h = make_harness()
        self.assertEqual(h.service().request_reset("999"), RequestOutcome.UNKNOWN_ACCOUNT)
        self.assertEqual(h.sender.sent, [])
        self.assertEqual(h.tokens.rows, [])

    def test_cuenta_inactiva_no_envia(self):
        h = make_harness(is_active=False)
        self.assertEqual(h.service().request_reset("1023456789"), RequestOutcome.INACTIVE_ACCOUNT)
        self.assertEqual(h.sender.sent, [])

    def test_correo_ficticio_neurolearn_local_no_envia(self):
        h = make_harness(email=placeholder_email_for("1023456789"))
        self.assertEqual(h.service().request_reset("1023456789"), RequestOutcome.NO_DELIVERABLE_EMAIL)
        self.assertEqual(h.sender.sent, [])
        self.assertEqual(h.tokens.rows, [])

    def test_cooldown_de_un_minuto(self):
        h = make_harness()
        svc = h.service()
        svc.request_reset("1023456789")
        h.clock.advance(seconds=30)
        self.assertEqual(svc.request_reset("1023456789"), RequestOutcome.THROTTLED)
        h.clock.advance(seconds=31)
        self.assertEqual(svc.request_reset("1023456789"), RequestOutcome.SENT)

    def test_maximo_tres_por_hora(self):
        h = make_harness()
        svc = h.service()
        for _ in range(3):
            self.assertEqual(svc.request_reset("1023456789"), RequestOutcome.SENT)
            h.clock.advance(minutes=2)
        self.assertEqual(svc.request_reset("1023456789"), RequestOutcome.THROTTLED)
        h.clock.advance(hours=1)
        self.assertEqual(svc.request_reset("1023456789"), RequestOutcome.SENT)

    def test_nuevo_enlace_invalida_los_anteriores(self):
        h = make_harness()
        svc = h.service()
        svc.request_reset("1023456789")
        h.clock.advance(minutes=2)
        svc.request_reset("1023456789")
        self.assertEqual([r.used for r in h.tokens.rows], [True, False])
        with self.assertRaises(InvalidResetTokenError) as ctx:
            svc.validate_token(h.issued[0])
        self.assertEqual(ctx.exception.problem, TokenProblem.USED)

    def test_si_falla_el_correo_el_token_queda_anulado(self):
        h = make_harness()
        h.sender.fail = True
        self.assertEqual(h.service().request_reset("1023456789"), RequestOutcome.DELIVERY_FAILED)
        self.assertTrue(h.tokens.rows[0].used)
        self.assertEqual(h.tx.commits, 2)


# ─── Pasos 2 y 3: validar y restablecer ──────────────────────────────────────

class ResetPasswordTests(unittest.TestCase):
    def setUp(self) -> None:
        self.h = make_harness()
        self.svc = self.h.service()
        self.svc.request_reset("1023456789")
        self.raw = self.h.issued[0]
        self.h.sender.sent.clear()

    def test_token_valido(self):
        self.svc.validate_token(self.raw)  # no lanza

    def test_token_inexistente(self):
        with self.assertRaises(InvalidResetTokenError) as ctx:
            self.svc.validate_token("token-que-no-existe-123")
        self.assertEqual(ctx.exception.problem, TokenProblem.NOT_FOUND)

    def test_token_expirado(self):
        self.h.clock.advance(minutes=15)
        with self.assertRaises(InvalidResetTokenError) as ctx:
            self.svc.validate_token(self.raw)
        self.assertEqual(ctx.exception.problem, TokenProblem.EXPIRED)

    def test_expiracion_con_fecha_sin_zona_horaria(self):
        self.h.tokens.rows[0].expires_at = (T0 + timedelta(minutes=15)).replace(tzinfo=None)
        self.svc.validate_token(self.raw)
        self.h.clock.advance(minutes=16)
        with self.assertRaises(InvalidResetTokenError):
            self.svc.validate_token(self.raw)

    def test_restablece_contrasena_y_consume_token(self):
        self.svc.reset_password(self.raw, "Nueva#2026", ip_address="190.1.2.3")
        user = self.h.user
        self.assertEqual(user.hashed_password, "hash:Nueva#2026")
        self.assertFalse(user.must_change_password)
        self.assertTrue(self.h.tokens.rows[0].used)
        self.assertEqual(self.h.audit.actions[-1], "password_reset_completed")
        # notificación de cambio
        self.assertEqual(len(self.h.sender.sent), 1)
        self.assertIn("contrasena-cambiada", self.h.sender.sent[0].tags)
        with self.assertRaises(InvalidResetTokenError) as ctx:
            self.svc.reset_password(self.raw, "OtraMas#2026")
        self.assertEqual(ctx.exception.problem, TokenProblem.USED)

    def test_rechaza_contrasena_debil_sin_consumir_token(self):
        with self.assertRaises(WeakPasswordError):
            self.svc.reset_password(self.raw, "debil")
        self.assertFalse(self.h.tokens.rows[0].used)
        self.assertEqual(self.h.tx.rollbacks, 1)

    def test_rechaza_reutilizar_la_contrasena_actual(self):
        with self.assertRaises(PasswordReuseError):
            self.svc.reset_password(self.raw, "Vieja#123")
        self.assertFalse(self.h.tokens.rows[0].used)

    def test_usuario_desactivado_despues_de_solicitar(self):
        self.h.user.is_active = False
        with self.assertRaises(InvalidResetTokenError):
            self.svc.reset_password(self.raw, "Nueva#2026")

    def test_fallo_de_notificacion_no_revierte_el_cambio(self):
        self.h.sender.fail = True
        self.svc.reset_password(self.raw, "Nueva#2026")
        self.assertEqual(self.h.user.hashed_password, "hash:Nueva#2026")


# ─── Adaptador Brevo ─────────────────────────────────────────────────────────

class FakeResponse:
    def __init__(self, status_code: int, body: Optional[dict] = None, text: str = "") -> None:
        self.status_code = status_code
        self._body = body
        self.text = text

    def json(self):
        if self._body is None:
            raise ValueError("sin JSON")
        return self._body


class BrevoSenderTests(unittest.TestCase):
    MESSAGE = EmailMessage(
        to=EmailAddress("ana@colegio.edu.co", "Ana"),
        subject="Asunto",
        html="<p>Hola</p>",
        text="Hola",
        tags=("recuperar-contrasena",),
    )

    def _sender(self, response: FakeResponse, calls: list) -> BrevoEmailSender:
        def http_post(url, *, headers, json, timeout):
            calls.append({"url": url, "headers": headers, "json": json, "timeout": timeout})
            return response

        return BrevoEmailSender("xkeysib-test", EmailAddress("soporte@gmail.com", "NeuroLearn IA"), 7.0, http_post)

    def test_payload_y_cabeceras(self):
        calls: list = []
        message_id = self._sender(FakeResponse(201, {"messageId": "<abc@relay>"}), calls).send(self.MESSAGE)
        self.assertEqual(message_id, "<abc@relay>")
        call = calls[0]
        self.assertEqual(call["url"], BREVO_SEND_URL)
        self.assertEqual(call["headers"]["api-key"], "xkeysib-test")
        self.assertEqual(call["timeout"], 7.0)
        self.assertEqual(
            call["json"],
            {
                "sender": {"email": "soporte@gmail.com", "name": "NeuroLearn IA"},
                "to": [{"email": "ana@colegio.edu.co", "name": "Ana"}],
                "subject": "Asunto",
                "htmlContent": "<p>Hola</p>",
                "textContent": "Hola",
                "tags": ["recuperar-contrasena"],
            },
        )

    def test_401_explica_bloqueo_por_ip_sin_exponer_la_key(self):
        response = FakeResponse(401, {"code": "unauthorized", "message": "unrecognised IP address"})
        with self.assertRaises(EmailDeliveryError) as ctx:
            self._sender(response, []).send(self.MESSAGE)
        self.assertIn("IP", str(ctx.exception))
        self.assertNotIn("xkeysib-test", str(ctx.exception))

    def test_error_de_red(self):
        def boom(*a, **kw):
            raise TimeoutError()

        sender = BrevoEmailSender("k", EmailAddress("a@b.co"), http_post=boom)
        with self.assertRaises(EmailDeliveryError):
            sender.send(self.MESSAGE)

    def test_sin_api_key(self):
        with self.assertRaises(EmailConfigurationError):
            BrevoEmailSender("", EmailAddress("a@b.co"))


# ─── Reglas de direcciones y plantillas ──────────────────────────────────────

class AddressAndTemplateTests(unittest.TestCase):
    def test_correo_entregable(self):
        self.assertTrue(is_deliverable_email("ana@colegio.edu.co"))
        self.assertFalse(is_deliverable_email(None))
        self.assertFalse(is_deliverable_email(""))
        self.assertFalse(is_deliverable_email("1023@neurolearn.local"))
        self.assertFalse(is_deliverable_email("1023@NEUROLEARN.LOCAL"))
        self.assertFalse(is_deliverable_email("sin-arroba"))

    def test_parse_sender(self):
        self.assertEqual(parse_sender("NeuroLearn IA <soporte@gmail.com>"), EmailAddress("soporte@gmail.com", "NeuroLearn IA"))
        self.assertEqual(parse_sender("soporte@gmail.com"), EmailAddress("soporte@gmail.com", None))
        with self.assertRaises(EmailConfigurationError):
            parse_sender("")

    def test_plantilla_escapa_html(self):
        rendered = render_password_reset_email("<script>x</script>", "https://a.co/r?token=t", 15)
        self.assertNotIn("<script>", rendered.html)
        self.assertIn("&lt;script&gt;", rendered.html)
        self.assertIn("15 minutos", rendered.text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
