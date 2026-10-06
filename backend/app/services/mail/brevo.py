"""
NeuroLearn IA — Adaptador de correo para Brevo (antes Sendinblue).

Usa la API REST transaccional ``POST https://api.brevo.com/v3/smtp/email``
mediante ``httpx`` (ya incluido en ``api/requirements.txt``), sin SDK
adicional, para no aumentar el tamaño de la función serverless de Vercel.

Requisitos en la cuenta de Brevo:
- API key con permiso de envío transaccional (variable ``BREVO_API_KEY``).
- Remitente verificado (variable ``EMAIL_FROM``). No requiere dominio propio:
  basta con verificar una dirección individual.
- Desactivar el bloqueo por IP de las API keys o autorizar las IP de salida:
  Vercel no tiene IP fija.
"""
from __future__ import annotations

import logging
from typing import Any, Callable, Dict, Optional, Protocol

from app.services.mail.ports import (
    EmailAddress,
    EmailConfigurationError,
    EmailDeliveryError,
    EmailMessage,
)

logger = logging.getLogger(__name__)

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"


class HttpResponse(Protocol):
    """Subconjunto de ``httpx.Response`` que necesita el adaptador."""

    status_code: int
    text: str

    def json(self) -> Any: ...


#: Firma de la función HTTP inyectable (facilita pruebas sin red).
HttpPost = Callable[..., HttpResponse]


def _default_http_post(url: str, *, headers: Dict[str, str], json: Dict[str, Any], timeout: float) -> HttpResponse:
    import httpx  # import diferido: el módulo se puede probar sin httpx

    return httpx.post(url, headers=headers, json=json, timeout=timeout)


class BrevoEmailSender:
    """Implementación de ``EmailSender`` sobre la API v3 de Brevo."""

    def __init__(
        self,
        api_key: str,
        sender: EmailAddress,
        timeout_seconds: float = 10.0,
        http_post: Optional[HttpPost] = None,
    ) -> None:
        if not api_key:
            raise EmailConfigurationError("BREVO_API_KEY no está configurada.")
        self._api_key = api_key
        self._sender = sender
        self._timeout = timeout_seconds
        self._http_post: HttpPost = http_post or _default_http_post

    def build_payload(self, message: EmailMessage) -> Dict[str, Any]:
        """Cuerpo JSON esperado por Brevo."""
        recipient: Dict[str, str] = {"email": message.to.email}
        if message.to.name:
            recipient["name"] = message.to.name

        sender: Dict[str, str] = {"email": self._sender.email}
        if self._sender.name:
            sender["name"] = self._sender.name

        payload: Dict[str, Any] = {
            "sender": sender,
            "to": [recipient],
            "subject": message.subject,
            "htmlContent": message.html,
            "textContent": message.text,
        }
        if message.tags:
            payload["tags"] = list(message.tags)
        return payload

    def send(self, message: EmailMessage) -> str:
        headers = {
            "api-key": self._api_key,
            "accept": "application/json",
            "content-type": "application/json",
        }
        try:
            response = self._http_post(
                BREVO_SEND_URL,
                headers=headers,
                json=self.build_payload(message),
                timeout=self._timeout,
            )
        except Exception as exc:  # timeouts, DNS, TLS…
            raise EmailDeliveryError(f"No fue posible contactar a Brevo: {type(exc).__name__}") from exc

        if 200 <= response.status_code < 300:
            message_id = ""
            try:
                message_id = str(response.json().get("messageId", ""))
            except Exception:
                pass
            logger.info("Correo enviado vía Brevo (messageId=%s, tags=%s)", message_id, message.tags)
            return message_id

        raise EmailDeliveryError(self._describe_error(response))

    @staticmethod
    def _describe_error(response: HttpResponse) -> str:
        """Mensaje de error útil para logs (nunca incluye la API key)."""
        code = ""
        detail = ""
        try:
            body = response.json()
            code = str(body.get("code", ""))
            detail = str(body.get("message", ""))
        except Exception:
            detail = (response.text or "")[:300]

        hint = ""
        if response.status_code == 401:
            hint = (
                " Revise BREVO_API_KEY y, en Brevo > Seguridad > IP autorizadas, "
                "desactive el bloqueo por IP (Vercel no tiene IP fija)."
            )
        elif response.status_code == 400 and "sender" in detail.lower():
            hint = " Verifique que EMAIL_FROM sea un remitente validado en Brevo."

        return f"Brevo respondió {response.status_code} {code}: {detail}.{hint}".strip()
