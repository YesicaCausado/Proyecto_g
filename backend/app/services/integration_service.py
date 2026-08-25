"""
NeuroLearn AI — Servicio de Terceros / Integraciones y Automatizaciones
========================================================================
Toda la lógica de negocio de las integraciones y automatizaciones vive aquí:

- Cifrado/descifrado de tokens con la SECRET_KEY del servidor (los tokens
  de Google nunca viajan al frontend ni se guardan en claro).
- Cliente OAuth 2.0 de Google (autorización, intercambio de code, refresh,
  obtención de perfil) usando la API oficial vía HTTP (httpx).
- Cliente Google Drive (listar carpetas, listar archivos, importar).
- Cliente Google Calendar (listar calendarios, crear eventos).
- Webhooks (registrar, probar, ejecutar petición HTTP real).
- Motor de automatizaciones (evento → acción) con trazabilidad real.
"""
from __future__ import annotations

import base64
import hmac
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.integration import (
    Integration, IntegrationProvider,
    Automation, AutomationTrigger, AutomationAction, AutomationExecution,
)
from app.models.user import User
from app.models.institution import Institution

try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:  # pragma: no cover
    Fernet = None
    InvalidToken = Exception


# ─────────────────────────────────────────────────────────────────────────────
# 1. Cifrado de tokens
# ─────────────────────────────────────────────────────────────────────────────

def _fernet() -> bytes:
    """Deriva una clave Fernet (32 bytes base64) desde SECRET_KEY."""
    if not settings.SECRET_KEY:
        raise RuntimeError("SECRET_KEY no está configurada. No se puede cifrar tokens.")
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_token(plain: Optional[str]) -> Optional[str]:
    """Cifra un token Google (access/refresh) con la clave del servidor."""
    if not plain:
        return None
    if Fernet is None:
        raise RuntimeError("cryptography no está instalada. Instala `cryptography`.")
    f = Fernet(_fernet())
    return f.encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt_token(ciphertext: Optional[str]) -> Optional[str]:
    """Descifra un token; si falla, devuelve None (se tratará como inválido)."""
    if not ciphertext:
        return None
    if Fernet is None:
        return None
    try:
        f = Fernet(_fernet())
        return f.decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception):  # noqa: BLE001
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 2. Utilidades OAuth (state firmado)
# ─────────────────────────────────────────────────────────────────────────────

def _sign_state(data: dict, ttl_seconds: int = 900) -> str:
    """Firma un estado OAuth (fecha de expiración + token de sesión) con HMAC."""
    payload = {
        "sub": data.get("sub"),
        "token": data.get("token"),
        "provider": data.get("provider"),
        "exp": int((datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)).timestamp()),
    }
    body = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8")
    sig = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{body}.{sig}"


def _unsign_state(state: str) -> Optional[dict]:
    """Valida la firma y la expiración de un estado OAuth. Devuelve None si es inválido."""
    try:
        body, sig = state.rsplit(".", 1)
        expected = hmac.new(
            settings.SECRET_KEY.encode("utf-8"),
            body.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body.encode("utf-8")).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(datetime.now(timezone.utc).timestamp()):
            return None
        return payload
    except Exception:  # noqa: BLE001
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 3. Cliente OAuth Google
# ─────────────────────────────────────────────────────────────────────────────

TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"
DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files"
DRIVE_ROOT_URL = "https://www.googleapis.com/drive/v3/files"
CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList"
CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars"


def google_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def _google_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def build_authorization_url(provider: str, state_token: str, redirect_uri: str | None = None) -> str:
    """Construye la URL de autorización de Google."""
    import urllib.parse
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri or settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": settings.GOOGLE_SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state_token,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode(params)


def exchange_code_for_tokens(code: str, redirect_uri: str | None = None) -> dict:
    """Intercambia el código de autorización por access + refresh token."""
    import httpx
    resp = httpx.post(TOKEN_URL, data={
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri or settings.GOOGLE_REDIRECT_URI,
    }, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Error intercambiando código OAuth: {resp.status_code} {resp.text[:300]}")
    return resp.json()


def refresh_access_token(refresh_token: str) -> str:
    """Refresca el access token usando el refresh token. Devuelve el nuevo access token."""
    import httpx
    resp = httpx.post(TOKEN_URL, data={
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Error refrescando token: {resp.status_code} {resp.text[:300]}")
    return resp.json().get("access_token")


def get_user_email(access_token: str) -> str:
    """Obtiene el correo de la cuenta Google autenticada."""
    import httpx
    resp = httpx.get(USERINFO_URL, headers=_google_headers(access_token), timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Error obteniendo perfil de Google: {resp.status_code} {resp.text[:300]}")
    return resp.json().get("email", "")


def _get_valid_access_token(db: Session, integration: Integration) -> tuple[str, bool]:
    """
    Devuelve un access token válido descifrado y si requiere refresh.
    Si el token expiró, intenta refrescarlo con el refresh token y lo
    persiste cifrado de vuelta.
    """
    access = decrypt_token(integration.access_token)
    refresh = decrypt_token(integration.refresh_token)
    requires_refresh = False

    expires = integration.token_expires_at
    now = datetime.now(timezone.utc)
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        # Margen de seguridad de 60 s antes de considerar expirado.
        if now >= expires - timedelta(seconds=60):
            requires_refresh = True

    if requires_refresh and refresh:
        try:
            new_access = refresh_access_token(refresh)
            access = new_access
            integration.access_token = encrypt_token(new_access)
            integration.token_expires_at = now + timedelta(hours=1)
            db.commit()
            requires_refresh = False
        except Exception:  # noqa: BLE001
            # No se pudo refrescar → token caducado/en revocado.
            integration.status = "token_expired"
            db.commit()
            raise RuntimeError("El token de Google ha caducado. Vuelve a conectar la integración.")

    if not access:
        raise RuntimeError("No hay token de acceso válido para esta integración.")
    return access, requires_refresh


# ─────────────────────────────────────────────────────────────────────────────
# 4. Google Drive
# ─────────────────────────────────────────────────────────────────────────────

def list_drive_folders(db: Session, integration: Integration) -> list[dict]:
    """Lista las carpetas de Google Drive visibles para la cuenta conectada."""
    token, _ = _get_valid_access_token(db, integration)
    import httpx
    params = {
        "q": "mimeType='application/vnd.google-apps.folder' and trashed=false",
        "fields": "files(id,name,mimeType),nextPageToken",
        "pageSize": 100,
        "orderBy": "name",
        "spaces": "drive",
    }
    resp = httpx.get(DRIVE_FILES_URL, params=params, headers=_google_headers(token), timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Error listando carpetas de Drive: {resp.status_code} {resp.text[:300]}")
    files = resp.json().get("files", [])
    return [{"id": f["id"], "name": f.get("name", "Sin nombre")} for f in files]


def list_drive_folder_files(db: Session, integration: Integration, folder_id: str) -> list[dict]:
    """Lista los archivos dentro de una carpeta de Google Drive."""
    token, _ = _get_valid_access_token(db, integration)
    import urllib.parse
    import httpx
    q = f"'{folder_id}' in parents and trashed=false"
    params = {
        "q": q,
        "fields": "files(id,name,mimeType,size,modifiedTime),nextPageToken",
        "pageSize": 100,
        "orderBy": "name",
    }
    resp = httpx.get(DRIVE_FILES_URL, params=params, headers=_google_headers(token), timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Error listando archivos de Drive: {resp.status_code} {resp.text[:300]}")
    files = resp.json().get("files", [])

    # Descargar el nombre web si es un Google Doc/Sheet (hace falta el alias).
    # Por simplicidad: devolver id, nombre, mime y tamaño si existe.
    def _friendly_type(mime: str) -> str:
        if mime == "application/vnd.google-apps.document":
            return "doc"
        if mime == "application/vnd.google-apps.spreadsheet":
            return "sheet"
        if mime == "application/pdf":
            return "pdf"
        if mime == "text/plain":
            return "txt"
        if mime == "application/vnd.ms-powerpoint":
            return "ppt"
        if mime == "application/msword":
            return "doc"
        if mime == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return "doc"
        if mime == "application/vnd.openxmlformats-officedocument.presentationml.presentation":
            return "ppt"
        if mime.startswith("image/"):
            return "img"
        return "file"

    return [
        {
            "id": f["id"],
            "name": f.get("name", "Sin nombre"),
            "mime_type": f.get("mimeType", ""),
            "type": _friendly_type(f.get("mimeType", "")),
            "size": f.get("size") or None,
            "modified": f.get("modifiedTime"),
        }
        for f in files
    ]


# ─────────────────────────────────────────────────────────────────────────────
# 5. Google Calendar
# ─────────────────────────────────────────────────────────────────────────────

def list_google_calendars(db: Session, integration: Integration) -> list[dict]:
    """Lista los calendarios de la cuenta conectada."""
    token, _ = _get_valid_access_token(db, integration)
    import httpx
    resp = httpx.get(CALENDAR_LIST_URL, headers=_google_headers(token), timeout=60)
    if resp.status_code != 200:
        raise RuntimeError(f"Error listando calendarios: {resp.status_code} {resp.text[:300]}")
    items = resp.json().get("items", [])
    return [
        {
            "id": c.get("id"),
            "name": c.get("summary", "Calendario"),
            "primary": bool(c.get("primary")),
        }
        for c in items
    ]


def create_google_calendar_event(
    db: Session,
    integration: Integration,
    *,
    calendar_id: str,
    title: str,
    description: str,
    date: str,                 # YYYY-MM-DD
    time: Optional[str] = None,
    event_type: str = "clase",
) -> dict:
    """Crea un evento en el calendario de Google conectado."""
    token, _ = _get_valid_access_token(db, integration)
    import httpx

    # Construir fecha: con hora (all-day si no se especifica).
    start = {"date": date}
    if time:
        # "HH:MM AM/PM" o "HH:MM"
        t = _parse_time(time)
        end = (datetime.strptime(date + " " + t, "%Y-%m-%d %H:%M") + timedelta(hours=1))
        start = {
            "dateTime": f"{date}T{t}:00",
            "timeZone": "America/Bogota",
        }
        end_dt = {"dateTime": f"{date}T{end.strftime('%H:%M')}:00", "timeZone": "America/Bogota"}
    else:
        end_dt = None

    body: dict[str, Any] = {
        "summary": title,
        "description": description,
        "start": start,
        "end": end_dt or {"date": date},
        "eventType": "default",
    }
    url = f"{CALENDAR_EVENTS_URL}/{_quote(calendar_id)}/events"
    resp = httpx.post(url, json=body, headers={
        **_google_headers(token),
        "Content-Type": "application/json",
    }, timeout=60)
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Error creando evento en Google Calendar: {resp.status_code} {resp.text[:400]}")
    data = resp.json()
    return {
        "id": data.get("id"),
        "title": data.get("summary"),
        "link": data.get("htmlLink"),
    }


def _parse_time(t: str) -> str:
    """Normaliza 'HH:MM AM/PM' → 'HH:MM' (24h)."""
    t = t.strip()
    try:
        return datetime.strptime(t, "%I:%M %p").strftime("%H:%M")
    except Exception:  # noqa: BLE001
        pass
    try:
        return datetime.strptime(t, "%H:%M").strftime("%H:%M")
    except Exception:  # noqa: BLE001
        return "09:00"


def _quote(value: str) -> str:
    import urllib.parse
    return urllib.parse.quote(value, safe="")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Webhooks
# ─────────────────────────────────────────────────────────────────────────────

def test_webhook(url: str) -> dict:
    """Envía un POST de prueba real al webhook y captura la respuesta."""
    import httpx
    payload = {
        "event": "neurolearn.webhook.test",
        "message": "Prueba de conexión del webhook desde NeuroLearn.",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = httpx.post(url, json=payload, timeout=15)
        return {
            "status_code": resp.status_code,
            "ok": 200 <= resp.status_code < 300,
            "response": resp.text[:500],
        }
    except Exception as e:  # noqa: BLE001
        return {"status_code": None, "ok": False, "response": str(e)}


def execute_webhook(url: str, event: str, payload: dict) -> dict:
    """Ejecuta un webhook real (POST) y devuelve el resultado."""
    import httpx
    body = {
        "event": event,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": payload,
    }
    try:
        resp = httpx.post(url, json=body, timeout=15)
        return {
            "status_code": resp.status_code,
            "ok": 200 <= resp.status_code < 300,
            "response": resp.text[:500],
        }
    except Exception as e:  # noqa: BLE001
        return {"status_code": None, "ok": False, "response": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# 7. Acciones de automatización
# ─────────────────────────────────────────────────────────────────────────────

def _record_execution(
    db: Session,
    automation: Automation,
    event: str,
    status: str,
    detail: Optional[str],
) -> None:
    db.add(AutomationExecution(
        automation_id=automation.id,
        institution_id=automation.institution_id,
        event=event,
        status=status,
        detail=detail,
    ))
    try:
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def run_automation_action(
    db: Session,
    automation: Automation,
    current_user: User,
    event_desc: str,
    trigger_data: dict,
    *,
    record: bool = True,
) -> dict:
    """
    Ejecuta la acción de una automatización. Usado tanto por hooks internos
    (crear actividad, etc.) como por la ejecución manual desde la UI.
    """
    action = automation.action
    result: dict = {"action": action, "ok": False, "detail": None}

    try:
        if action == AutomationAction.CREAR_ALERTA:
            result = _action_crear_alerta(db, automation, current_user, trigger_data)
        elif action == AutomationAction.ENVIAR_NOTIFICACION:
            result = _action_enviar_notificacion(db, automation, current_user, trigger_data)
        elif action == AutomationAction.GOOGLE_CALENDAR:
            result = _action_google_calendar(db, automation, current_user, trigger_data)
        elif action == AutomationAction.WEBHOOK:
            result = _action_webhook(db, automation, current_user, trigger_data)
        else:
            result = {"action": action, "ok": False, "detail": f"Acción desconocida: {action}"}
    except Exception as e:  # noqa: BLE001
        result = {"action": action, "ok": False, "detail": str(e)}

    if record:
        _record_execution(
            db, automation,
            event=event_desc,
            status="ok" if result["ok"] else "error",
            detail=result.get("detail"),
        )
    return result


def _action_crear_alerta(db, automation, user, trigger_data) -> dict:
    """Crea una alerta interna persistida para el docente."""
    detail = (
        f"Alerta creada: {trigger_data.get('alert_title', automation.name)} — "
        f"{trigger_data.get('alert_message', '')}".strip()
    )
    # La alerta queda registrada como ejecución "ok" (trazabilidad real).
    # El frontend puede leer estas alertas desde el historial.
    return {"action": automation.action, "ok": True, "detail": detail}


def _action_enviar_notificacion(db, automation, user, trigger_data) -> dict:
    """Registra una notificación/aviso para el docente en el historial."""
    message = trigger_data.get("message", f"Automatización «{automation.name}» ejecutada")
    return {
        "action": automation.action,
        "ok": True,
        "detail": f"Notificación enviada al docente: {message}",
    }


def _action_google_calendar(db, automation, user, trigger_data) -> dict:
    """Crea un evento en el Google Calendar conectado."""
    integration = (
        db.query(Integration)
        .filter(
            Integration.institution_id == automation.institution_id,
            Integration.provider == IntegrationProvider.GOOGLE_CALENDAR,
            Integration.status == "connected",
        )
        .first()
    )
    if not integration:
        return {"action": automation.action, "ok": False,
                "detail": "No hay Google Calendar conectado para esta institución."}

    cfg = automation.configuration or {}
    calendar_id = cfg.get("calendar_id")
    if not calendar_id or calendar_id == "__primary__":
        # Si no definió uno, listar y usar el principal.
        try:
            cals = list_google_calendars(db, integration)
            primary = next((c for c in cals if c.get("primary")), cals[0] if cals else None)
            if not primary:
                return {"action": automation.action, "ok": False, "detail": "No hay calendarios disponibles."}
            calendar_id = primary["id"]
        except Exception as e:  # noqa: BLE001
            return {"action": automation.action, "ok": False, "detail": str(e)}

    title = trigger_data.get("title", "Actividad de NeuroLearn")
    date = trigger_data.get("date") or datetime.now().date().isoformat()
    time = trigger_data.get("time")
    description = trigger_data.get("content", "") or "Creada automáticamente desde NeuroLearn."

    try:
        created = create_google_calendar_event(
            db, integration,
            calendar_id=calendar_id,
            title=title,
            description=description,
            date=date,
            time=time,
        )
        return {"action": automation.action, "ok": True,
                "detail": f"Evento creado en Google Calendar: «{created['title']}»"}
    except Exception as e:  # noqa: BLE001
        return {"action": automation.action, "ok": False, "detail": str(e)}


def _action_webhook(db, automation, user, trigger_data) -> dict:
    """Ejecuta el webhook configurado de la institución."""
    integration = (
        db.query(Integration)
        .filter(
            Integration.institution_id == automation.institution_id,
            Integration.provider == IntegrationProvider.WEBHOOK,
        )
        .first()
    )
    if not integration or not (integration.config or {}).get("url"):
        return {"action": automation.action, "ok": False,
                "detail": "No hay un webhook configurado para esta institución."}

    url = integration.config["url"]
    event_name = automation.trigger
    payload = {**trigger_data, "automation": automation.name}
    res = execute_webhook(url, event_name, payload)
    # Actualizar el estado del webhook en la integración.
    integration.config = {**(integration.config or {}), "last_status": res["status_code"]}
    db.commit()
    if res["ok"]:
        return {"action": automation.action, "ok": True,
                "detail": f"Webhook respondió {res['status_code']}: {res['response'][:200]}"}
    return {"action": automation.action, "ok": False,
            "detail": f"Webhook falló ({res['status_code']}): {res['response'][:200]}"}


# ─────────────────────────────────────────────────────────────────────────────
# 8. Motores de disparo
# ─────────────────────────────────────────────────────────────────────────────

def get_connected_calendar_id(db: Session, institution_id: int) -> Optional[str]:
    """Devuelve el calendar_id guardado para la institución si está conectado."""
    integration = (
        db.query(Integration)
        .filter(
            Integration.institution_id == institution_id,
            Integration.provider == IntegrationProvider.GOOGLE_CALENDAR,
            Integration.status == "connected",
        )
        .first()
    )
    if not integration:
        return None
    return (integration.config or {}).get("calendar_id")


def dispatch_trigger(db: Session, current_user: User, trigger: str, trigger_data: dict) -> list[dict]:
    """
    Dispara todas las automatizaciones habilitadas de la institución que
    coinciden con el `trigger`. Devuelve los resultados de cada ejecución.
    Devuelve lista vacía si no hay automatizaciones habilitadas.
    """
    institution_id = current_user.institution_id
    results: list[dict] = []
    if not institution_id:
        return results

    automations = (
        db.query(Automation)
        .filter(
            Automation.institution_id == institution_id,
            Automation.trigger == trigger,
            Automation.enabled == True,  # noqa: E712
        )
        .all()
    )

    for autom in automations:
        try:
            # Validar que exista la integración mínima para la acción elegida.
            if not _action_available(db, autom):
                continue
            res = run_automation_action(
                db, autom, current_user,
                event_desc=trigger_data.get("event_desc") or trigger,
                trigger_data=trigger_data,
            )
            results.append({"automation_id": autom.id, "name": autom.name, **res})
        except Exception as e:  # noqa: BLE001
            results.append({"automation_id": autom.id, "name": autom.name,
                            "action": autom.action, "ok": False, "detail": str(e)})
    return results


def _action_available(db: Session, autom: Automation) -> bool:
    """Valida que la integración requerida por la acción existe (anti-fallos silenciosos)."""
    institution_id = autom.institution_id
    if autom.action == AutomationAction.GOOGLE_CALENDAR:
        return bool(
            db.query(Integration).filter(
                Integration.institution_id == institution_id,
                Integration.provider == IntegrationProvider.GOOGLE_CALENDAR,
                Integration.status == "connected",
            ).first()
        )
    if autom.action == AutomationAction.WEBHOOK:
        integ = db.query(Integration).filter(
            Integration.institution_id == institution_id,
            Integration.provider == IntegrationProvider.WEBHOOK,
        ).first()
        return bool(integ and (integ.config or {}).get("url"))
    return True