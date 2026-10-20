"""
NeuroLearn AI — API de Integraciones y Automatizaciones
=========================================================
Endpoints del módulo de Integraciones (Administrador, Súper Profesor y Profesor):
  - Google Drive  (OAuth 2.0 real: conectar, listar carpetas, archivos, importar)
  - Google Calendar (OAuth: conectar, listar calendarios, crear eventos)
  Las conexiones de Google son de cada usuario (no de la institución);
  el webhook sí es institucional.
  - Webhooks          (configurar, probar, activar/desactivar, ejecución real)
  - Automatizaciones  (CRUD, toggle, ejecución manual, historial)

Seguridad:
  - Todos los endpoints requieren JWT autenticado (get_current_user).
  - Proceso multi-tenant: se valida que institution_id del usuario coincida
    con los registros. Los tokens de Google se cifran y nunca viajan al frontend.
  - Acceso por rol: require_permission(Permission.GESTIONAR_INTEGRACIONES) /
    require_permission(Permission.GESTIONAR_AUTOMATIZACIONES) (app/core/permissions.py).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import logging
import re
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.models.integration import (
    Integration, IntegrationProvider,
    Automation, AutomationTrigger, AutomationAction, AutomationExecution,
)
from app.models.classroom import Classroom, Enrollment
from app.services import integration_service as isvc

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Integraciones y Automatizaciones"])


# ─────────────────────────────────────────────────────────────────────────────
# Schemas
# ─────────────────────────────────────────────────────────────────────────────

class WebhookConfig(BaseModel):
    url: str
    enabled: bool = True

class AutomationCreate(BaseModel):
    name: str
    trigger: str
    action: str
    configuration: dict = {}
    enabled: bool = True

class AutomationUpdate(BaseModel):
    name: Optional[str] = None
    trigger: Optional[str] = None
    action: Optional[str] = None
    configuration: Optional[dict] = None
    enabled: Optional[bool] = None

class CalendarEventCreate(BaseModel):
    title: str
    calendar_id: str
    event_date: str
    event_time: Optional[str] = None
    description: str = ""
    event_type: str = "clase"


def _require_institution(user: User) -> int:
    if not user.institution_id:
        raise HTTPException(status_code=403, detail="El usuario no pertenece a ninguna institución.")
    return user.institution_id


def _is_manager(user: User) -> bool:
    return user.role in (UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value)


def _require_webhook_manager(user: User) -> int:
    """El webhook es institucional: lo configura el Súper Profesor (o el
    Administrador). Se retiró de la interfaz del profesor."""
    inst_id = _require_institution(user)
    if not _is_manager(user):
        raise HTTPException(status_code=403,
                            detail="El webhook de la institución lo gestiona el Súper Profesor.")
    return inst_id


def _own_automation(db: Session, user: User, automation_id: int) -> Automation:
    """Editar, activar, ejecutar o eliminar: quien la creó (o el Súper
    Profesor / Administrador). Antes cualquier docente de la institución."""
    inst_id = _require_institution(user)
    autom = db.query(Automation).filter(
        Automation.id == automation_id, Automation.institution_id == inst_id).first()
    if not autom:
        raise HTTPException(status_code=404, detail="Automatización no encontrada.")
    if autom.created_by != user.id and not _is_manager(user):
        raise HTTPException(status_code=403,
                            detail="Solo quien creó la automatización puede modificarla.")
    return autom


def _check_action_allowed(user: User, action: str) -> None:
    if action == AutomationAction.WEBHOOK and not _is_manager(user):
        raise HTTPException(status_code=400,
                            detail="La acción Webhook no está disponible para el profesor.")


def _serialize_integration(integ: Integration, expose_tokens: bool = False) -> dict:
    cfg = dict(integ.config or {})
    cfg.pop("access_token", None)
    cfg.pop("refresh_token", None)
    return {
        "id": integ.id,
        "provider": integ.provider,
        "status": integ.status,
        "account_email": integ.account_email,
        "account_label": integ.account_label,
        "config": cfg,
        "created_at": integ.created_at.isoformat() if integ.created_at else None,
        "updated_at": integ.updated_at.isoformat() if integ.updated_at else None,
    }


def _serialize_automation(a: Automation, user: Optional[User] = None) -> dict:
    return {
        "id": a.id,
        "created_by": a.created_by,
        "can_edit": bool(user is not None and (a.created_by == user.id or _is_manager(user))),
        "name": a.name,
        "trigger": a.trigger,
        "action": a.action,
        "configuration": a.configuration or {},
        "enabled": a.enabled,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Estado global de integraciones
# ─────────────────────────────────────────────────────────────────────────────

_GOOGLE = (IntegrationProvider.GOOGLE_DRIVE, IntegrationProvider.GOOGLE_CALENDAR)


@router.get("/integrations")
async def list_integrations(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Integraciones visibles para el usuario (sin tokens): sus propias
    conexiones de Google y, solo para el Súper Profesor / Administrador, el
    webhook institucional."""
    inst_id = _require_institution(current_user)
    try:
        rows = (
            db.query(Integration)
            .filter(Integration.institution_id == inst_id)
            .order_by(Integration.provider, Integration.id.desc())
            .all()
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail="No se pudieron cargar las integraciones en este momento. Intenta de nuevo.",
        ) from e
    visible = []
    for r in rows:
        if r.provider in _GOOGLE:
            # Antes se devolvía la cuenta de Google de OTRO docente de la institución.
            if r.user_id == current_user.id and all(v.provider != r.provider for v in visible):
                visible.append(r)
        elif r.provider == IntegrationProvider.WEBHOOK and _is_manager(current_user):
            visible.append(r)
    from app.core.config import settings as _settings
    return {
        "integrations": [_serialize_integration(r) for r in visible],
        "google_configured": bool(getattr(_settings, "GOOGLE_CLIENT_ID", "") and
                                  getattr(_settings, "GOOGLE_CLIENT_SECRET", "")),
    }


@router.get("/automation-options")
async def automation_options(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    """Devuelve qué acciones están disponibles según integraciones conectadas."""
    inst_id = _require_institution(current_user)

    cal = isvc.user_google_integration(db, inst_id, current_user.id, IntegrationProvider.GOOGLE_CALENDAR)
    calendar_ok = bool(cal and cal.status == "connected")
    webhook = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == IntegrationProvider.WEBHOOK,
    ).first()

    return {
        "triggers": [
            {"value": AutomationTrigger.NUEVO_ESTUDIANTE, "label": "Nuevo estudiante"},
            {"value": AutomationTrigger.NUEVA_ACTIVIDAD, "label": "Nueva actividad"},
            {"value": AutomationTrigger.BAJO_RENDIMIENTO, "label": "Bajo rendimiento"},
            {"value": AutomationTrigger.REPORTE_GENERADO, "label": "Reporte generado"},
        ],
        "actions": [
            {"value": AutomationAction.CREAR_ALERTA, "label": "Crear alerta", "available": True},
            {"value": AutomationAction.ENVIAR_NOTIFICACION, "label": "Enviar notificación", "available": True},
            {"value": AutomationAction.GOOGLE_CALENDAR, "label": "Google Calendar", "available": calendar_ok},
        ] + ([
            {"value": AutomationAction.WEBHOOK, "label": "Webhook", "available": webhook is not None and bool((webhook.config or {}).get("url"))},
        ] if _is_manager(current_user) else []),
        "calendar_connected": calendar_ok,
        "webhook_configured": webhook is not None and bool((webhook.config or {}).get("url")),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth: conectar
# ─────────────────────────────────────────────────────────────────────────────
#
# Flujo (OAuth 2.0 «authorization code»):
#   1. POST /integrations/google/{drive|calendar}/connect  (con JWT)
#        → URL de Google con un `state` firmado (usuario, proveedor, 15 min).
#   2. Google → GET /integrations/google/callback?code&state  (sin JWT)
#        Solo valida el state y reenvía code+state al frontend (#/…).
#   3. El frontend, con la sesión del usuario, llama a
#      POST /integrations/google/complete {code, state}: aquí se comprueba que
#      quien termina es quien empezó, se canjea el código y se guardan los
#      tokens cifrados.
# El paso 3 impide que alguien envíe a otra persona su propio enlace de
# autorización y se quede con el Drive/Calendar de la víctima (CSRF de
# OAuth): antes el callback guardaba los tokens a nombre de quien figuraba
# en el state, sin importar quién hubiera autorizado.

def _google_provider(provider: str) -> str:
    if provider == "drive":
        return IntegrationProvider.GOOGLE_DRIVE
    if provider == "calendar":
        return IntegrationProvider.GOOGLE_CALENDAR
    raise HTTPException(status_code=400, detail="Proveedor Google no válido.")


@router.post("/integrations/google/{provider}/connect")
async def connect_google(
    provider: str,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Inicia el flujo OAuth de Google devolviendo la URL de autorización."""
    _require_institution(current_user)
    provider_id = _google_provider(provider)
    if not isvc.google_configured():
        raise HTTPException(
            status_code=503,
            detail="La integración de Google no está configurada en el servidor. Configura GOOGLE_CLIENT_ID en el backend.",
        )
    state_token = isvc._sign_state({"sub": str(current_user.id), "provider": provider_id})
    return {"url": isvc.build_authorization_url(provider_id, state_token)}


@router.get("/integrations/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Regreso de Google. No guarda nada: reenvía el código al frontend para
    que el usuario autenticado complete la conexión (ver arriba)."""
    from app.services.email_service import frontend_url
    payload = isvc._unsign_state(state) if state else None
    # Con «#» (HashRouter): sin él, el regreso de Google abría la landing.
    # La pantalla de Integraciones solo existe en el panel del profesor.
    target = frontend_url("/teacher")

    if error:
        msg = ("Cancelaste la autorización en Google." if error == "access_denied"
               else "Google devolvió un error durante la autorización.")
        return _redirect_with_params(target, {"integration_error": msg})
    if not code or not state:
        return _redirect_with_params(target, {"integration_error": "Faltan parámetros en la respuesta de Google."})
    if not payload:
        return _redirect_with_params(target, {"integration_error": "El estado OAuth es inválido o ha expirado. Intenta de nuevo."})
    return _redirect_with_params(target, {"google_code": code, "google_state": state})


class GoogleComplete(BaseModel):
    code: str
    state: str


@router.post("/integrations/google/complete")
async def complete_google(
    body: GoogleComplete,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Canjea el código de Google y guarda la conexión del usuario autenticado."""
    inst_id = _require_institution(current_user)
    payload = isvc._unsign_state(body.state)
    if not payload or payload.get("provider") not in _GOOGLE:
        raise HTTPException(status_code=400, detail="El estado OAuth es inválido o ha expirado. Intenta de nuevo.")
    if str(payload.get("sub")) != str(current_user.id):
        raise HTTPException(status_code=403,
                            detail="Esta autorización de Google se inició con otra cuenta de NeuroLearn.")
    provider = payload["provider"]

    try:
        tokens = isvc.exchange_code_for_tokens(body.code)
    except Exception:  # noqa: BLE001
        logger.exception("Error al canjear el código de Google")
        raise HTTPException(status_code=502,
                            detail="No pudimos conectar Google (el código caducó o ya se usó). Inténtalo de nuevo.")

    access = tokens.get("access_token")
    refresh = tokens.get("refresh_token")
    if not access:
        raise HTTPException(status_code=502, detail="Google no entregó credenciales. Inténtalo de nuevo.")
    missing = isvc.missing_scopes(provider, tokens.get("scope", ""))
    if missing:
        # La pantalla de Google permite desmarcar permisos: sin ellos la
        # integración aparecería «conectada» pero todas las operaciones fallarían.
        isvc._try_revoke_token(refresh or access)
        raise HTTPException(status_code=400,
                            detail="No concediste todos los permisos necesarios en Google. Vuelve a conectar y marca todas las casillas.")

    email = ""
    try:
        email = isvc.get_user_email(access)
    except Exception:  # noqa: BLE001
        logger.warning("No se pudo leer el correo de la cuenta de Google conectada")

    integ = isvc.user_google_integration(db, inst_id, current_user.id, provider)
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=int(tokens.get("expires_in") or 3600))).replace(tzinfo=None)
    if not integ:
        integ = Integration(institution_id=inst_id, user_id=current_user.id, provider=provider, config={})
        db.add(integ)
    elif integ.account_email and email and integ.account_email != email:
        integ.config = {}   # otra cuenta de Google: la carpeta/calendario elegidos ya no aplican
    integ.status = "connected"
    integ.account_email = email or None
    integ.access_token = isvc.encrypt_token(access)
    if refresh:
        integ.refresh_token = isvc.encrypt_token(refresh)
    integ.token_expires_at = expires_at
    db.commit()
    db.refresh(integ)
    return {"ok": True, "integration": _serialize_integration(integ)}


@router.delete("/integrations/{provider}")
async def disconnect_integration(
    provider: str,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Desconecta una integración propia (revoca y elimina credenciales)."""
    inst_id = _require_institution(current_user)
    if provider in _GOOGLE:
        integ = isvc.user_google_integration(db, inst_id, current_user.id, provider)
    elif provider == IntegrationProvider.WEBHOOK:
        _require_webhook_manager(current_user)
        integ = db.query(Integration).filter(
            Integration.institution_id == inst_id,
            Integration.provider == provider,
        ).first()
    else:
        integ = None
    if not integ:
        raise HTTPException(status_code=404, detail="Integración no encontrada.")

    revoked = None
    if provider in _GOOGLE:
        revoked = isvc._try_revoke_token(isvc.decrypt_token(integ.refresh_token)
                                         or isvc.decrypt_token(integ.access_token))
    integ.access_token = None
    integ.refresh_token = None
    integ.status = "disconnected"
    integ.account_email = None
    integ.token_expires_at = None
    db.commit()
    if revoked is False:
        return {"message": "Integración desconectada en NeuroLearn. Google no confirmó la revocación: "
                           "puedes quitar el acceso en myaccount.google.com/permissions.",
                "revoked": False}
    return {"message": "Integración desconectada.", "revoked": revoked}


# ─────────────────────────────────────────────────────────────────────────────
# Google Drive
# ─────────────────────────────────────────────────────────────────────────────

def _get_connected(db: Session, user: User, provider: str) -> Integration:
    """Conexión de Google DEL USUARIO autenticado (nunca la de otro docente)."""
    inst_id = _require_institution(user)
    integ = isvc.user_google_integration(db, inst_id, user.id, provider)
    if integ and integ.status == "token_expired":
        raise HTTPException(status_code=409,
                            detail="La conexión con Google caducó o se revocó. Vuelve a conectar la cuenta.")
    if not integ or integ.status != "connected":
        raise HTTPException(
            status_code=400,
            detail="Esta integración no está conectada. Conéctala primero.",
        )
    return integ


def _google_http_error(e: Exception, default: str) -> HTTPException:
    """Traduce un fallo de Google a una respuesta clara (sin volcar la
    respuesta cruda del proveedor). 401 de Google → 409 aquí: un 401 haría que
    el frontend cerrara la sesión de NeuroLearn."""
    if isinstance(e, isvc.GoogleAPIError):
        code = 409 if e.status_code == 401 else e.status_code
        return HTTPException(status_code=code, detail=str(e))
    logger.exception(default)
    return HTTPException(status_code=502, detail=default)


@router.get("/integrations/google/drive/folders")
async def drive_folders(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_DRIVE)
    try:
        return {"folders": isvc.list_drive_folders(db, integ)}
    except Exception as e:  # noqa: BLE001
        raise _google_http_error(e, "No pudimos consultar Google Drive.")


@router.get("/integrations/google/drive/folders/{folder_id}/files")
async def drive_files(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_DRIVE)
    try:
        return {"files": isvc.list_drive_folder_files(db, integ, folder_id)}
    except Exception as e:  # noqa: BLE001
        raise _google_http_error(e, "No pudimos listar los archivos.")


@router.post("/integrations/google/drive/folder")
async def drive_select_folder(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Guarda la carpeta de Drive seleccionada en la configuración de la integración."""
    folder_id = (body.get("folder_id") or "").strip()
    folder_name = (body.get("folder_name") or "").strip()[:200]
    if not isvc.is_drive_id(folder_id):
        raise HTTPException(status_code=400, detail="folder_id es obligatorio.")
    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_DRIVE)
    cfg = dict(integ.config or {})
    cfg["folder_id"] = folder_id
    cfg["folder_name"] = folder_name
    integ.config = cfg
    db.commit()
    return {"ok": True, "config": cfg}


@router.post("/integrations/google/drive/import")
async def drive_import_files(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """
    Importa archivos de Google Drive a los Materiales del docente como ENLACE
    (el binario no se copia a NeuroLearn; «Abrir en Drive» desde Materiales).
    Cada archivo se consulta en Drive con la cuenta del propio docente: el
    nombre y el enlace son los reales y no se aceptan identificadores que la
    cuenta no puede ver. No cambia los permisos del archivo en Drive.
    """
    from app.api.teacher_materials import TeacherFolder, TeacherMaterial, DRIVE_MIME

    files = body.get("files") or []  # [{id}] (el nombre se toma de Drive)
    if not isinstance(files, list) or not files:
        raise HTTPException(status_code=400, detail="No se seleccionaron archivos.")
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Importa como máximo 50 archivos a la vez.")
    ids = []
    for f in files:
        file_id = str((f.get("id") if isinstance(f, dict) else f) or "").strip()
        if not isvc.is_drive_id(file_id):
            raise HTTPException(status_code=400, detail="Archivo de Drive no válido.")
        if file_id not in ids:
            ids.append(file_id)

    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_DRIVE)
    metas = []
    try:
        for file_id in ids:
            metas.append(isvc.get_drive_file(db, integ, file_id))
    except Exception as e:  # noqa: BLE001
        raise _google_http_error(e, "No pudimos consultar el archivo en Google Drive.")

    # Carpeta destino: "Desde Google Drive".
    target = db.query(TeacherFolder).filter(
        TeacherFolder.teacher_id == current_user.id,
        TeacherFolder.name == "Desde Google Drive",
    ).first()
    if not target:
        target = TeacherFolder(teacher_id=current_user.id, name="Desde Google Drive", color="#0B6E99")
        db.add(target)
        db.flush()

    existing = {m.original_name for m in db.query(TeacherMaterial).filter(
        TeacherMaterial.teacher_id == current_user.id, TeacherMaterial.mime_type == DRIVE_MIME).all()}
    imported, skipped, restricted = [], [], []
    for meta in metas:
        url = meta["url"][:255]
        if url in existing:
            skipped.append(meta["name"])          # ya estaba importado: no se duplica
            continue
        mat = TeacherMaterial(
            folder_id=target.id,
            teacher_id=current_user.id,
            name=meta["name"][:200],
            file_type="link",
            size="—",
            shared_with=[],
            original_name=url,
            mime_type=DRIVE_MIME,
            has_file=False,
        )
        db.add(mat)
        existing.add(url)
        imported.append({"name": mat.name, "type": meta["type"], "link_access": meta["link_access"]})
        if meta["link_access"] in ("restricted", "unknown"):
            restricted.append(meta["name"])
    db.commit()
    return {"ok": True, "imported": imported, "count": len(imported),
            "skipped": skipped, "restricted": restricted}


# ─────────────────────────────────────────────────────────────────────────────
# Google Calendar
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/integrations/google/calendar/calendars")
async def calendar_calendars(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_CALENDAR)
    try:
        return {"calendars": isvc.list_google_calendars(db, integ)}
    except Exception as e:  # noqa: BLE001
        raise _google_http_error(e, "No pudimos consultar Google Calendar.")


@router.post("/integrations/google/calendar/select")
async def calendar_select(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Guarda el calendario de Google seleccionado."""
    calendar_id = (body.get("calendar_id") or "").strip()
    calendar_name = (body.get("calendar_name") or "").strip()[:200]
    if not calendar_id or len(calendar_id) > 300:
        raise HTTPException(status_code=400, detail="calendar_id es obligatorio.")
    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_CALENDAR)
    cfg = dict(integ.config or {})
    cfg["calendar_id"] = calendar_id
    cfg["calendar_name"] = calendar_name
    integ.config = cfg
    db.commit()
    return {"ok": True, "config": cfg}


@router.post("/integrations/google/calendar/events")
async def calendar_create_event(
    body: CalendarEventCreate,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Crea un evento real en un calendario de Google del usuario. No se
    copia al calendario interno de NeuroLearn (no hay sincronización)."""
    integ = _get_connected(db, current_user, IntegrationProvider.GOOGLE_CALENDAR)
    try:
        created = isvc.create_google_calendar_event(
            db, integ,
            calendar_id=body.calendar_id,
            title=body.title,
            description=body.description,
            date=body.event_date,
            time=body.event_time,
            event_type=body.event_type,
        )
        return {"ok": True, **created}
    except Exception as e:  # noqa: BLE001
        raise _google_http_error(e, "No pudimos crear el evento en Google Calendar.")


# ─────────────────────────────────────────────────────────────────────────────
# Webhooks
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/integrations/webhook")
async def get_webhook(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Devuelve la integración webhook de la institución (sin secretos)."""
    inst_id = _require_webhook_manager(current_user)
    integ = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == IntegrationProvider.WEBHOOK,
    ).first()
    if not integ:
        # Devolver una integración "no configurada" para que la UI muestre estado inicial.
        return {
            "configured": False,
            "url": None,
            "status": "not_configured",
            "config": {},
        }
    return {
        "configured": True,
        "url": (integ.config or {}).get("url"),
        "status": integ.status,
        "account_label": integ.account_label,
        "config": {k: v for k, v in (integ.config or {}).items() if k not in ("secret", "token")},
    }


@router.post("/integrations/webhook")
async def save_webhook(
    body: WebhookConfig,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Guarda o crea la configuración de webhook de la institución."""
    inst_id = _require_webhook_manager(current_user)
    url = (body.url or "").strip()
    if not url.startswith(("https://", "http://")):
        raise HTTPException(status_code=400, detail="La URL del webhook debe empezar por http(s)://")

    # Validar que el webhook responde antes de guardar (conexión real).
    test = isvc.test_webhook(url)

    integ = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == IntegrationProvider.WEBHOOK,
    ).first()
    if not integ:
        integ = Integration(
            institution_id=inst_id,
            user_id=current_user.id,
            provider=IntegrationProvider.WEBHOOK,
            account_label="Webhook",
            status="connected" if body.enabled else "disconnected",
            config={"url": url, "last_status": test["status_code"]},
        )
        db.add(integ)
    else:
        cfg = dict(integ.config or {})
        cfg["url"] = url
        cfg["last_status"] = test["status_code"]
        if test.get("response"):
            cfg["last_response"] = test["response"]
        integ.config = cfg
        integ.status = "connected" if body.enabled else "disconnected"
        integ.account_label = "Webhook"
    db.commit()
    return {
        "configured": True,
        "url": url,
        "status": integ.status,
        "test": test,
    }


@router.post("/integrations/webhook/test")
async def test_webhook_endpoint(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Envía un POST real de prueba al webhook configurado y captura la respuesta."""
    inst_id = _require_webhook_manager(current_user)
    integ = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == IntegrationProvider.WEBHOOK,
    ).first()
    # Resolver URL: preferir el body, o el config almacenado.
    url = (body.get("url") or (((integ.config or {}).get("url")) if integ else None)) or ""
    if not url:
        raise HTTPException(status_code=400, detail="URL de webhook no configurada.")
    result = isvc.test_webhook(url)
    if integ:
        cfg = dict(integ.config or {})
        cfg["last_status"] = result["status_code"]
        cfg["last_response"] = result["response"]
        integ.config = cfg
        db.commit()
    return result


@router.post("/integrations/webhook/toggle")
async def toggle_webhook(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Activa/desactiva el webhook configurado."""
    inst_id = _require_webhook_manager(current_user)
    enabled = bool(body.get("enabled", True))
    integ = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == IntegrationProvider.WEBHOOK,
    ).first()
    if not integ:
        raise HTTPException(status_code=404, detail="Webhook no configurado.")
    integ.status = "connected" if enabled else "disconnected"
    db.commit()
    return {"status": integ.status}


# ─────────────────────────────────────────────────────────────────────────────
# Automatizaciones
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/automations")
async def list_automations(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    inst_id = _require_institution(current_user)
    items = (
        db.query(Automation)
        .filter(Automation.institution_id == inst_id)
        .order_by(Automation.created_at.desc())
        .all()
    )
    return {"automations": [_serialize_automation(a, current_user) for a in items]}


@router.post("/automations", status_code=status.HTTP_201_CREATED)
async def create_automation(
    body: AutomationCreate,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    inst_id = _require_institution(current_user)
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio.")
    if body.trigger not in _TRIGGERS:
        raise HTTPException(status_code=400, detail="Trigger no válido.")
    if body.action not in _ACTIONS:
        raise HTTPException(status_code=400, detail="Acción no válida.")
    _check_action_allowed(current_user, body.action)

    autom = Automation(
        institution_id=inst_id,
        created_by=current_user.id,
        name=name,
        trigger=body.trigger,
        action=body.action,
        configuration=body.configuration or {},
        enabled=body.enabled,
    )
    db.add(autom)
    db.commit()
    db.refresh(autom)
    return _serialize_automation(autom, current_user)


@router.put("/automations/{automation_id}")
async def update_automation(
    automation_id: int,
    body: AutomationUpdate,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    autom = _own_automation(db, current_user, automation_id)
    if body.name is not None:
        autom.name = body.name.strip() or autom.name
    if body.trigger is not None and body.trigger in _TRIGGERS:
        autom.trigger = body.trigger
    if body.trigger is not None and body.trigger not in _TRIGGERS:
        raise HTTPException(status_code=400, detail="Disparador no válido.")
    if body.action is not None:
        if body.action not in _ACTIONS:
            raise HTTPException(status_code=400, detail="Acción no válida.")
        if body.action != autom.action:
            _check_action_allowed(current_user, body.action)
        autom.action = body.action
    if body.configuration is not None:
        autom.configuration = body.configuration
    if body.enabled is not None:
        autom.enabled = body.enabled
    db.commit()
    db.refresh(autom)
    return _serialize_automation(autom, current_user)


@router.delete("/automations/{automation_id}")
async def delete_automation(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    autom = _own_automation(db, current_user, automation_id)
    db.delete(autom)
    db.commit()
    return {"message": "Automatización eliminada."}


@router.post("/automations/{automation_id}/toggle")
async def toggle_automation(
    automation_id: int,
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    autom = _own_automation(db, current_user, automation_id)
    autom.enabled = bool(body.get("enabled", not autom.enabled))
    db.commit()
    db.refresh(autom)
    return _serialize_automation(autom, current_user)


@router.get("/automations/{automation_id}/executions")
async def automation_history(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    inst_id = _require_institution(current_user)
    history = (
        db.query(AutomationExecution)
        .filter(
            AutomationExecution.automation_id == automation_id,
            AutomationExecution.institution_id == inst_id,
        )
        .order_by(AutomationExecution.executed_at.desc())
        .limit(50)
        .all()
    )
    return {
        "executions": [
            {
                "id": e.id,
                "event": e.event,
                "status": e.status,
                "detail": e.detail,
                "executed_at": e.executed_at.isoformat() if e.executed_at else None,
            }
            for e in history
        ]
    }


@router.post("/automations/{automation_id}/run")
async def run_automation_manual(
    automation_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    """Ejecuta una automatización manualmente (útil para probar)."""
    autom = _own_automation(db, current_user, automation_id)
    trigger_data = {"event_desc": f"Ejecución manual de «{autom.name}»", "title": autom.name}
    result = isvc.run_automation_action(db, autom, current_user, trigger_data["event_desc"], trigger_data)
    return {"ok": result["ok"], "action": result["action"], "detail": result.get("detail")}


@router.post("/automations/check-low-performance")
async def check_low_performance(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AUTOMATIZACIONES)),
    db: Session = Depends(get_db),
):
    """
    Evaluación real: comprueba el rendimiento de los estudiantes de las clases
    del profesor y dispara las automatizaciones de tipo "bajo_rendimiento".
    Cada estudiante con promedio por debajo del umbral genera una ejecución
    de la alerta (usa datos reales de Enrollment.average_score / quiz_history).
    """
    inst_id = _require_institution(current_user)
    try:
        default_threshold = float(body.get("threshold", 60.0))
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="El umbral debe ser un número entre 0 y 100.")

    # Grupos del profesor.
    classrooms = db.query(Classroom).filter(
        Classroom.teacher_id == current_user.id,
        Classroom.is_active == True,  # noqa: E712
    ).all()
    cids = [c.id for c in classrooms]

    # Solo las automatizaciones del propio profesor (no las de otros docentes).
    automations = db.query(Automation).filter(
        Automation.institution_id == inst_id,
        Automation.created_by == current_user.id,
        Automation.trigger == AutomationTrigger.BAJO_RENDIMIENTO,
        Automation.enabled == True,  # noqa: E712
    ).all()

    if not automations:
        return {"ok": True, "detected": [], "count": 0, "executions": [],
                "message": "No tienes automatizaciones de bajo rendimiento activas."}

    # Promedio real por estudiante (solo quienes tienen actividad: un
    # estudiante sin quizzes no tiene «bajo rendimiento», no tiene datos).
    avg_by_student: dict = {}
    if cids:
        enrolls = db.query(Enrollment).filter(
            Enrollment.classroom_id.in_(cids),
            Enrollment.is_active == True,  # noqa: E712
        ).all()
        for e in enrolls:
            if (e.total_sessions or 0) > 0:
                avg_by_student[e.student_id] = min(avg_by_student.get(e.student_id, 100.0),
                                                   float(e.average_score or 0.0))
    students = db.query(User).filter(
        User.id.in_(list(avg_by_student.keys())),
        User.role == UserRole.ESTUDIANTE.value,
        User.is_active == True,  # noqa: E712
    ).all() if avg_by_student else []

    def threshold_of(autom) -> float:
        try:
            return float((autom.configuration or {}).get("threshold", default_threshold))
        except (TypeError, ValueError):
            return default_threshold

    found = []
    found_by_autom: dict = {}
    for autom in automations:
        limit = threshold_of(autom)
        rows = [{"student_id": s.id, "name": s.full_name or s.username,
                 "score": round(avg_by_student[s.id], 1), "threshold": limit}
                for s in students if avg_by_student[s.id] < limit]
        found_by_autom[autom.id] = rows
        for r in rows:
            if all(f["student_id"] != r["student_id"] for f in found):
                found.append(r)

    all_results = []
    for autom in automations:
        for stu in found_by_autom.get(autom.id, [])[:20]:
            res = isvc.run_automation_action(
                db, autom, current_user,
                event_desc=f"Bajo rendimiento: {stu['name']} ({stu['score']}%)",
                trigger_data={**stu, "resolution": "automatización de alerta",
                              "alert_title": f"Bajo rendimiento: {stu['name']}",
                              "alert_message": f"{stu['name']} tiene un promedio de {stu['score']}% "
                                               f"(umbral {stu['threshold']:g}%)."},
            )
            all_results.append({"automation_id": autom.id, "automation": autom.name, **res})

    return {
        "ok": True,
        "detected": found,
        "count": len(found),
        "executions": all_results,
    }


_TRIGGERS = {
    AutomationTrigger.NUEVO_ESTUDIANTE,
    AutomationTrigger.NUEVA_ACTIVIDAD,
    AutomationTrigger.BAJO_RENDIMIENTO,
    AutomationTrigger.REPORTE_GENERADO,
}
_ACTIONS = {
    AutomationAction.CREAR_ALERTA,
    AutomationAction.ENVIAR_NOTIFICACION,
    AutomationAction.GOOGLE_CALENDAR,
    AutomationAction.WEBHOOK,
}


def _redirect_with_params(base: str, params: dict) -> "RedirectResponse":
    from fastapi.responses import RedirectResponse
    import urllib.parse
    params = {"tab": "integraciones", **params}
    qs = "&".join(f"{urllib.parse.quote(k)}={urllib.parse.quote(str(v))}" for k, v in params.items() if v)
    return RedirectResponse(f"{base}?{qs}" if qs else base)


def settings_frontend() -> str:
    from app.core.config import settings as _s
    return _s.FRONTEND_URL