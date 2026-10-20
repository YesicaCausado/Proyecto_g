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
import re
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
    """Firma un estado OAuth (usuario, proveedor, caducidad) con HMAC.

    El state viaja por la URL de Google: NUNCA lleva el JWT de la sesión
    (antes se incluía y quedaba en el historial y en los registros de Google).
    """
    payload = {
        "sub": data.get("sub"),
        "provider": data.get("provider"),
        "nonce": secrets.token_urlsafe(12),
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
CALENDAR_LIST_URL = "https://www.googleapis.com/calendar/v3/users/me/calendarList"
CALENDAR_EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars"

# Permisos que cada operación necesita de verdad. Si el usuario los desmarca
# en la pantalla de consentimiento de Google, la conexión no se guarda.
DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
CALENDAR_SCOPES_REQUIRED = (
    "https://www.googleapis.com/auth/calendar.readonly",   # calendarList.list
    "https://www.googleapis.com/auth/calendar.events",     # events.insert
)

_DRIVE_ID_RE = re.compile(r"[A-Za-z0-9_-]{10,200}")


class GoogleAPIError(RuntimeError):
    """Error de Google con un mensaje apto para mostrar al usuario."""

    def __init__(self, message: str, status_code: int = 502):
        super().__init__(message)
        self.status_code = status_code


def google_configured() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def scopes_for(provider: str) -> str:
    """Alcances que se piden para cada proveedor (antes se pedían Drive y
    Calendar juntos al conectar cualquiera de los dos)."""
    if provider == IntegrationProvider.GOOGLE_CALENDAR:
        return settings.GOOGLE_CALENDAR_SCOPES
    return settings.GOOGLE_DRIVE_SCOPES


def missing_scopes(provider: str, granted: str) -> list[str]:
    """Permisos imprescindibles que el usuario NO concedió."""
    got = set((granted or "").split())
    needed = (DRIVE_SCOPE,) if provider == IntegrationProvider.GOOGLE_DRIVE else CALENDAR_SCOPES_REQUIRED
    return [s for s in needed if s not in got]


def is_drive_id(value: str) -> bool:
    return bool(_DRIVE_ID_RE.fullmatch(value or ""))


def _google_headers(access_token: str) -> dict:
    return {"Authorization": f"Bearer {access_token}"}


def build_authorization_url(provider: str, state_token: str, redirect_uri: str | None = None) -> str:
    """Construye la URL de autorización de Google."""
    import urllib.parse
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri or settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": scopes_for(provider),
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


def refresh_access_token(refresh_token: str) -> dict:
    """Refresca el access token. Devuelve {access_token, expires_in}.

    Lanza GoogleAPIError(401) si Google rechaza el refresh token (revocado o
    caducado) y GoogleAPIError(503) si es un fallo pasajero de red/servidor.
    """
    import httpx
    try:
        resp = httpx.post(TOKEN_URL, data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }, timeout=30)
    except Exception as e:  # noqa: BLE001
        raise GoogleAPIError("No pudimos comunicarnos con Google. Intenta de nuevo.", 503) from e
    if resp.status_code in (400, 401):
        raise GoogleAPIError("Google rechazó la conexión (se revocó o caducó). Vuelve a conectar la cuenta.", 401)
    if resp.status_code != 200 or not resp.json().get("access_token"):
        raise GoogleAPIError("Google no respondió correctamente. Intenta de nuevo.", 503)
    data = resp.json()
    return {"access_token": data["access_token"], "expires_in": int(data.get("expires_in") or 3600)}


def get_user_email(access_token: str) -> str:
    """Obtiene el correo de la cuenta Google autenticada (alcance «email»)."""
    import httpx
    resp = httpx.get(USERINFO_URL, headers=_google_headers(access_token), timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Error obteniendo perfil de Google: {resp.status_code}")
    return resp.json().get("email", "")


def _mark(db: Session, integration: Integration, status: str) -> None:
    integration.status = status
    try:
        db.commit()
    except Exception:  # noqa: BLE001
        db.rollback()


def _get_valid_access_token(db: Session, integration: Integration) -> tuple[str, bool]:
    """
    Devuelve un access token válido descifrado. Si expiró, lo refresca con el
    refresh token y lo persiste cifrado. Si Google rechaza el refresh token,
    la integración pasa a «token_expired» (la UI deja de mostrarla conectada).
    """
    access = decrypt_token(integration.access_token)
    refresh = decrypt_token(integration.refresh_token)

    expires = integration.token_expires_at
    now = datetime.now(timezone.utc)
    expired = False
    if expires is not None:
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        # Margen de seguridad de 60 s antes de considerar expirado.
        expired = now >= expires - timedelta(seconds=60)

    if (expired or not access) and refresh:
        try:
            fresh = refresh_access_token(refresh)
        except GoogleAPIError as e:
            if e.status_code == 401:
                _mark(db, integration, "token_expired")
            raise
        access = fresh["access_token"]
        integration.access_token = encrypt_token(access)
        integration.token_expires_at = (now + timedelta(seconds=fresh["expires_in"])).replace(tzinfo=None)
        db.commit()
    elif expired or not access:
        _mark(db, integration, "token_expired")
        raise GoogleAPIError("La conexión con Google caducó. Vuelve a conectar la cuenta.", 401)
    return access, False


def _google_request(db: Session, integration: Integration, method: str, url: str, **kwargs):
    """Llamada real a una API de Google con traducción de errores.

    401 → la integración queda «token_expired»; 403 → permisos insuficientes,
    API deshabilitada o cuota; 404 → recurso inexistente o sin acceso.
    """
    import httpx
    token, _ = _get_valid_access_token(db, integration)
    try:
        resp = httpx.request(method, url, headers=_google_headers(token), timeout=60, **kwargs)
    except Exception as e:  # noqa: BLE001
        raise GoogleAPIError("No pudimos comunicarnos con Google. Intenta de nuevo.", 503) from e
    if resp.status_code in (200, 201, 204):
        return resp
    reason = ""
    try:
        err = resp.json().get("error") or {}
        if isinstance(err, dict):
            reason = ((err.get("errors") or [{}])[0].get("reason") or err.get("status") or "")
    except Exception:  # noqa: BLE001
        pass
    if resp.status_code == 401:
        _mark(db, integration, "token_expired")
        raise GoogleAPIError("La conexión con Google caducó o se revocó. Vuelve a conectar la cuenta.", 401)
    if resp.status_code == 429 or reason in ("rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"):
        raise GoogleAPIError("Google limitó temporalmente las solicitudes. Intenta en unos minutos.", 429)
    if resp.status_code == 403:
        if reason in ("accessNotConfigured", "SERVICE_DISABLED"):
            raise GoogleAPIError("La API de Google no está habilitada en el proyecto de Google Cloud.", 503)
        raise GoogleAPIError("La cuenta de Google conectada no tiene permiso para esta operación.", 403)
    if resp.status_code == 404:
        raise GoogleAPIError("El recurso no existe en Google o la cuenta conectada no tiene acceso.", 404)
    if resp.status_code == 400:
        raise GoogleAPIError("Google rechazó los datos enviados.", 400)
    raise GoogleAPIError("Google no respondió correctamente. Intenta de nuevo.", 502)


# ─────────────────────────────────────────────────────────────────────────────
# 4. Google Drive
# ─────────────────────────────────────────────────────────────────────────────

_MAX_PAGES = 10   # 10 × 100 = hasta 1 000 elementos por listado


def _list_drive(db: Session, integration: Integration, params: dict) -> list[dict]:
    """files.list con paginación real (antes solo llegaban los 100 primeros)."""
    out: list[dict] = []
    page_token = None
    for _ in range(_MAX_PAGES):
        p = dict(params)
        if page_token:
            p["pageToken"] = page_token
        data = _google_request(db, integration, "GET", DRIVE_FILES_URL, params=p).json()
        out.extend(data.get("files", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break
    return out


def list_drive_folders(db: Session, integration: Integration) -> list[dict]:
    """Lista las carpetas de Google Drive visibles para la cuenta conectada."""
    files = _list_drive(db, integration, {
        "q": "mimeType='application/vnd.google-apps.folder' and trashed=false",
        "fields": "files(id,name),nextPageToken",
        "pageSize": 100,
        "orderBy": "name",
        "spaces": "drive",
    })
    return [{"id": f["id"], "name": f.get("name", "Sin nombre")} for f in files]


def _friendly_type(mime: str) -> str:
    if mime in ("application/vnd.google-apps.document", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"):
        return "doc"
    if mime == "application/vnd.google-apps.spreadsheet":
        return "sheet"
    if mime == "application/pdf":
        return "pdf"
    if mime == "text/plain":
        return "txt"
    if mime in ("application/vnd.ms-powerpoint", "application/vnd.google-apps.presentation",
                "application/vnd.openxmlformats-officedocument.presentationml.presentation"):
        return "ppt"
    if mime.startswith("image/"):
        return "img"
    return "file"


def list_drive_folder_files(db: Session, integration: Integration, folder_id: str) -> list[dict]:
    """Lista los archivos (no subcarpetas) dentro de una carpeta de Google Drive."""
    if not is_drive_id(folder_id):
        raise GoogleAPIError("Carpeta de Drive no válida.", 400)
    files = _list_drive(db, integration, {
        # folder_id validado: no puede romper la consulta con comillas.
        "q": (f"'{folder_id}' in parents and trashed=false "
              "and mimeType != 'application/vnd.google-apps.folder'"),
        "fields": "files(id,name,mimeType,size,modifiedTime),nextPageToken",
        "pageSize": 100,
        "orderBy": "name",
    })
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


def get_drive_file(db: Session, integration: Integration, file_id: str) -> dict:
    """Metadatos reales de un archivo (files.get). Comprueba que exista, que la
    cuenta conectada lo vea y si está compartido para que otros lo abran."""
    if not is_drive_id(file_id):
        raise GoogleAPIError("Archivo de Drive no válido.", 400)
    f = _google_request(db, integration, "GET", f"{DRIVE_FILES_URL}/{file_id}", params={
        "fields": "id,name,mimeType,trashed,webViewLink,permissions(type,role,domain)",
        "supportsAllDrives": "true",
    }).json()
    if f.get("trashed"):
        raise GoogleAPIError(f"«{f.get('name', file_id)}» está en la papelera de Drive.", 404)
    if f.get("mimeType") == "application/vnd.google-apps.folder":
        raise GoogleAPIError("Solo se pueden importar archivos, no carpetas.", 400)
    perms = f.get("permissions")
    if perms is None:
        access = "unknown"        # la cuenta no puede ver los permisos (no es propietaria)
    elif any(p.get("type") == "anyone" for p in perms):
        access = "anyone"
    elif any(p.get("type") == "domain" for p in perms):
        access = "domain"
    else:
        access = "restricted"
    return {
        "id": f["id"],
        "name": f.get("name") or "Archivo de Drive",
        "mime_type": f.get("mimeType", ""),
        "type": _friendly_type(f.get("mimeType", "")),
        "url": f.get("webViewLink") or f"https://drive.google.com/file/d/{f['id']}/view",
        "link_access": access,
    }


# ─────────────────────────────────────────────────────────────────────────────
# 5. Google Calendar
# ─────────────────────────────────────────────────────────────────────────────

def list_google_calendars(db: Session, integration: Integration) -> list[dict]:
    """Lista los calendarios de la cuenta conectada (con su zona horaria y si
    la cuenta puede crear eventos en ellos)."""
    data = _google_request(db, integration, "GET", CALENDAR_LIST_URL,
                           params={"maxResults": 250}).json()
    return [
        {
            "id": c.get("id"),
            "name": c.get("summaryOverride") or c.get("summary", "Calendario"),
            "primary": bool(c.get("primary")),
            "time_zone": c.get("timeZone"),
            "writable": c.get("accessRole") in ("owner", "writer"),
        }
        for c in data.get("items", [])
    ]


def _calendar_time_zone(db: Session, integration: Integration, calendar_id: str) -> Optional[str]:
    try:
        url = f"{CALENDAR_LIST_URL}/{_quote(calendar_id)}"
        return _google_request(db, integration, "GET", url).json().get("timeZone")
    except GoogleAPIError as e:
        if e.status_code == 401:
            raise
        return None


def _parse_time(t: str) -> Optional[str]:
    """Normaliza 'HH:MM AM/PM' o 'HH:MM' → 'HH:MM' (24 h). None si no es una hora."""
    t = (t or "").strip()
    for fmt in ("%I:%M %p", "%H:%M"):
        try:
            return datetime.strptime(t, fmt).strftime("%H:%M")
        except ValueError:
            pass
    return None


def build_event_body(title: str, description: str, date: str, time: Optional[str],
                     time_zone: str, duration_minutes: int = 60) -> dict:
    """Cuerpo de events.insert. Valida la fecha y la hora en vez de inventar
    una («09:00») cuando llegan mal."""
    title = (title or "").strip()
    if not title:
        raise GoogleAPIError("El título del evento es obligatorio.", 400)
    try:
        day = datetime.strptime((date or "").strip(), "%Y-%m-%d")
    except ValueError:
        raise GoogleAPIError("La fecha debe tener el formato AAAA-MM-DD.", 400)
    if time:
        hhmm = _parse_time(time)
        if hhmm is None:
            raise GoogleAPIError("La hora no es válida (usa HH:MM).", 400)
        start_dt = datetime.strptime(f"{date} {hhmm}", "%Y-%m-%d %H:%M")
        end_dt = start_dt + timedelta(minutes=duration_minutes)   # puede pasar al día siguiente
        start = {"dateTime": start_dt.strftime("%Y-%m-%dT%H:%M:00"), "timeZone": time_zone}
        end = {"dateTime": end_dt.strftime("%Y-%m-%dT%H:%M:00"), "timeZone": time_zone}
    else:
        # Día completo: Google exige que el fin sea el día SIGUIENTE (exclusivo).
        # Con fin = inicio respondía 400 «The specified time range is empty».
        start = {"date": day.strftime("%Y-%m-%d")}
        end = {"date": (day + timedelta(days=1)).strftime("%Y-%m-%d")}
    return {"summary": title[:250], "description": description or "", "start": start, "end": end}


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
    """Crea un evento en el calendario de Google conectado (no se guarda en el
    calendario interno de NeuroLearn: son independientes)."""
    calendar_id = (calendar_id or "").strip()
    if not calendar_id:
        raise GoogleAPIError("Selecciona un calendario.", 400)
    tz = None
    if time:
        tz = _calendar_time_zone(db, integration, calendar_id)
        if not tz:
            inst = db.query(Institution).filter(Institution.id == integration.institution_id).first()
            tz = getattr(inst, "timezone", None) or "America/Bogota"
    body = build_event_body(title, description, date, time, tz or "UTC")
    url = f"{CALENDAR_EVENTS_URL}/{_quote(calendar_id)}/events"
    data = _google_request(db, integration, "POST", url, json=body).json()
    if not data.get("id"):
        raise GoogleAPIError("Google no confirmó la creación del evento.", 502)
    return {
        "id": data.get("id"),
        "title": data.get("summary"),
        "link": data.get("htmlLink"),
    }


def _try_revoke_token(token: Optional[str]) -> Optional[bool]:
    """Revoca un token en Google. True: revocado; False: Google no lo
    confirmó; None: no había token. Nunca lanza (desconectar no debe fallar)."""
    if not token:
        return None
    import httpx
    try:
        resp = httpx.post(
            "https://oauth2.googleapis.com/revoke",
            data={"token": token},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
        # 400 invalid_token: ya estaba revocado/caducado → el acceso ya no existe.
        return resp.status_code in (200, 400)
    except Exception:  # noqa: BLE001
        return False


def _quote(value: str) -> str:
    import urllib.parse
    return urllib.parse.quote(value, safe="")


def user_google_integration(db: Session, institution_id: int, user_id: int,
                            provider: str) -> Optional[Integration]:
    """La conexión de Google es de cada usuario (RF-32: «sus cuentas»). Antes
    era una por institución y cualquier profesor usaba el Drive del último
    que se había conectado."""
    return (
        db.query(Integration)
        .filter(
            Integration.institution_id == institution_id,
            Integration.user_id == user_id,
            Integration.provider == provider,
        )
        .order_by(Integration.id.desc())
        .first()
    )


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


def _automation_recipients(automation) -> list:
    """Destinatario de las acciones internas: quien creó la automatización."""
    return [automation.created_by] if getattr(automation, "created_by", None) else []


def _action_crear_alerta(db, automation, user, trigger_data) -> dict:
    """Crea una alerta real (notificación persistente con enlace a NeuroAlertas)
    para el docente que configuró la automatización."""
    from app.services import notification_service
    title = (trigger_data.get("alert_title") or f"Alerta: {automation.name}")[:200]
    message = trigger_data.get("alert_message") or trigger_data.get("event_desc") or automation.name
    created = notification_service.notify(
        db, _automation_recipients(automation), "automatizacion", title, message,
        link="/teacher?tab=alertas", resource_type="automatizacion", resource_id=automation.id,
    )
    if not created:
        return {"action": automation.action, "ok": False,
                "detail": "No se creó la alerta: el destinatario desactivó «Nueva actividad» en su perfil."}
    return {"action": automation.action, "ok": True, "detail": f"Alerta creada: {title} — {message}"}


def _action_enviar_notificacion(db, automation, user, trigger_data) -> dict:
    """Envía una notificación real (campana 🔔) al docente que configuró la
    automatización, con enlace a Automatizaciones."""
    from app.services import notification_service
    message = trigger_data.get("message") or trigger_data.get("event_desc") or f"Automatización «{automation.name}» ejecutada"
    created = notification_service.notify(
        db, _automation_recipients(automation), "automatizacion", automation.name[:200], message,
        link="/teacher?tab=automatizaciones", resource_type="automatizacion", resource_id=automation.id,
    )
    if not created:
        return {"action": automation.action, "ok": False,
                "detail": "No se envió: el destinatario desactivó «Nueva actividad» en su perfil."}
    return {"action": automation.action, "ok": True, "detail": f"Notificación enviada: {message}"}


def _action_google_calendar(db, automation, user, trigger_data) -> dict:
    """Crea un evento en el Google Calendar de quien creó la automatización."""
    integration = user_google_integration(db, automation.institution_id, automation.created_by,
                                          IntegrationProvider.GOOGLE_CALENDAR)
    if not integration or integration.status != "connected":
        return {"action": automation.action, "ok": False,
                "detail": "Quien creó la automatización no tiene Google Calendar conectado."}

    cfg = automation.configuration or {}
    calendar_id = cfg.get("calendar_id") or (integration.config or {}).get("calendar_id")
    if not calendar_id or calendar_id == "__primary__":
        # Si no definió uno, listar y usar el principal.
        try:
            cals = list_google_calendars(db, integration)
            primary = next((c for c in cals if c.get("primary")), cals[0] if cals else None)
            if not primary:
                return {"action": automation.action, "ok": False, "detail": "No hay calendarios disponibles."}
            calendar_id = primary["id"]
        except GoogleAPIError as e:
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

def get_connected_calendar_id(db: Session, institution_id: int, user_id: int) -> Optional[str]:
    """Devuelve el calendar_id elegido por el usuario si tiene Calendar conectado."""
    integration = user_google_integration(db, institution_id, user_id,
                                          IntegrationProvider.GOOGLE_CALENDAR)
    if not integration or integration.status != "connected":
        return None
    return (integration.config or {}).get("calendar_id")


def dispatch_trigger(db: Session, current_user: User, trigger: str, trigger_data: dict,
                     owner_id: Optional[int] = None) -> list[dict]:
    """
    Dispara las automatizaciones habilitadas de la institución que coinciden
    con el `trigger`. Con `owner_id`, solo las de ese docente (el evento es
    de su grupo o lo generó él): así un profesor no recibe avisos por la
    actividad de los grupos de otro. Devuelve los resultados de cada ejecución.
    """
    institution_id = current_user.institution_id
    results: list[dict] = []
    if not institution_id:
        return results

    q = db.query(Automation).filter(
        Automation.institution_id == institution_id,
        Automation.trigger == trigger,
        Automation.enabled == True,  # noqa: E712
    )
    if owner_id is not None:
        q = q.filter(Automation.created_by == owner_id)
    automations = q.all()

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
        integ = user_google_integration(db, institution_id, autom.created_by,
                                        IntegrationProvider.GOOGLE_CALENDAR)
        return bool(integ and integ.status == "connected")
    if autom.action == AutomationAction.WEBHOOK:
        integ = db.query(Integration).filter(
            Integration.institution_id == institution_id,
            Integration.provider == IntegrationProvider.WEBHOOK,
        ).first()
        return bool(integ and (integ.config or {}).get("url"))
    return True