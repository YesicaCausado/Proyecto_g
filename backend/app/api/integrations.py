"""
NeuroLearn AI — API de Integraciones y Automatizaciones
=========================================================
Endpoints del módulo de Integraciones (Administrador, Súper Profesor y Profesor):
  - Google Drive  (OAuth 2.0 real: conectar, listar carpetas, archivos, importar)
  - Google Calendar (OAuth: conectar, listar calendarios, crear eventos)
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
from fastapi import APIRouter, Depends, HTTPException, status, Request
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

@router.get("/integrations")
async def list_integrations(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Lista las integraciones de la institución del usuario (sin tokens)."""
    inst_id = _require_institution(current_user)
    try:
        rows = (
            db.query(Integration)
            .filter(Integration.institution_id == inst_id)
            .order_by(Integration.provider)
            .all()
        )
    except Exception as e:  # noqa: BLE001
        raise HTTPException(
            status_code=503,
            detail="No se pudieron cargar las integraciones en este momento. Intenta de nuevo.",
        ) from e
    if not _is_manager(current_user):
        rows = [r for r in rows if r.provider != IntegrationProvider.WEBHOOK]
    from app.core.config import settings as _settings
    return {
        "integrations": [_serialize_integration(r) for r in rows],
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

    calendar = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == IntegrationProvider.GOOGLE_CALENDAR,
        Integration.status == "connected",
    ).first()
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
            {"value": AutomationAction.GOOGLE_CALENDAR, "label": "Google Calendar", "available": calendar is not None},
        ] + ([
            {"value": AutomationAction.WEBHOOK, "label": "Webhook", "available": webhook is not None and bool((webhook.config or {}).get("url"))},
        ] if _is_manager(current_user) else []),
        "calendar_connected": calendar is not None,
        "webhook_configured": webhook is not None and bool((webhook.config or {}).get("url")),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Google OAuth: conectar
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/integrations/google/{provider}/connect")
async def connect_google(
    provider: str,
    request: "Request",
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Inicia el flujo OAuth de Google devolviendo la URL de autorización."""
    inst_id = _require_institution(current_user)
    if provider not in ("drive", "calendar"):
        raise HTTPException(status_code=400, detail="Proveedor Google no válido.")
    if not isvc.google_configured():
        raise HTTPException(
            status_code=503,
            detail="La integración de Google no está configurada en el servidor. Configura GOOGLE_CLIENT_ID en el backend.",
        )
    provider_id = (IntegrationProvider.GOOGLE_CALENDAR if provider == "calendar"
                   else IntegrationProvider.GOOGLE_DRIVE)

    # Extraer el JWT del header para firmar el estado OAuth (el callback de
    # Google no reenvía headers, así que el token viaja firmado en `state`).
    auth = request.headers.get("Authorization", "")
    jwt_token = auth[7:] if auth.lower().startswith("bearer ") else ""

    state_token = isvc._sign_state({
        "sub": str(current_user.id),
        "token": jwt_token,
        "provider": provider_id,
    })
    url = isvc.build_authorization_url(provider_id, state_token)
    return {"url": url}


@router.get("/integrations/google/callback")
async def google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Callback de Google OAuth. Intercambia el code, guarda los tokens cifrados
    y redirige al frontend.
    """
    from fastapi.responses import RedirectResponse
    # Con «#» (HashRouter): sin él, el regreso de Google abría la landing.
    from app.services.email_service import frontend_url
    fallback = frontend_url("/teacher")

    if error:
        return _redirect_with_params(fallback, {"integration_error": "El usuario canceló la autorización o hubo un error."})

    if not code or not state:
        return _redirect_with_params(fallback, {"integration_error": "Faltan parámetros en la respuesta de Google."})

    payload = isvc._unsign_state(state)
    if not payload:
        return _redirect_with_params(fallback, {"integration_error": "El estado OAuth es inválido o ha expirado. Intenta de nuevo."})

    provider = payload.get("provider")
    user_id = int(payload.get("sub", 0))

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.institution_id:
        return _redirect_with_params(fallback, {"integration_error": "Usuario no encontrado."})

    try:
        tokens = isvc.exchange_code_for_tokens(code)
    except Exception as e:  # noqa: BLE001
        logger.exception("Error al completar la conexión con Google")
        return _redirect_with_params(fallback, {"integration_error": "No pudimos conectar Google. Inténtalo de nuevo."})

    access = tokens.get("access_token")
    refresh = tokens.get("refresh_token")
    email = ""
    try:
        if access:
            email = isvc.get_user_email(access)
    except Exception:  # noqa: BLE001
        pass

    expires_in = tokens.get("expires_in", 3600)
    # Buscar/actualizar la integración existente.
    integ = db.query(Integration).filter(
        Integration.institution_id == user.institution_id,
        Integration.provider == provider,
    ).first()

    now = datetime.now(timezone.utc)
    config_kwargs = {}
    if not integ:
        integ = Integration(
            institution_id=user.institution_id,
            user_id=user.id,
            provider=provider,
            status="connected",
            account_email=email or None,
            access_token=isvc.encrypt_token(access),
            refresh_token=isvc.encrypt_token(refresh),
            token_expires_at=now + timedelta(seconds=expires_in),
            config=config_kwargs,
        )
        db.add(integ)
    else:
        integ.user_id = user.id
        integ.status = "connected"
        integ.account_email = email or None
        if access:
            integ.access_token = isvc.encrypt_token(access)
        if refresh:
            integ.refresh_token = isvc.encrypt_token(refresh)
        integ.token_expires_at = now + timedelta(seconds=expires_in)
        integ.config = config_kwargs or (integ.config or {})
    db.commit()

    return _redirect_with_params(fallback, {"integration": provider, "integration_ok": "1"})


@router.delete("/integrations/{provider}")
async def disconnect_integration(
    provider: str,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Desconecta una integración (elimina credenciales almacenadas)."""
    inst_id = _require_institution(current_user)
    integ = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == provider,
    ).first()
    if not integ:
        raise HTTPException(status_code=404, detail="Integración no encontrada.")

    if provider in (IntegrationProvider.GOOGLE_DRIVE, IntegrationProvider.GOOGLE_CALENDAR):
        # Remover las credenciales. (Opcional: revocar token de Google.)
        _try_revoke(integ)
    integ.access_token = None
    integ.refresh_token = None
    integ.status = "disconnected"
    integ.account_email = None
    integ.token_expires_at = None
    db.commit()
    return {"message": "Integración desconectada."}


def _try_revoke(integ: Integration) -> None:
    """Intenta revocar el token de Google (best-effort, sin romper el flujo)."""
    refresh = isvc.decrypt_token(integ.refresh_token)
    access = isvc.decrypt_token(integ.access_token)
    token = refresh or access
    if not token:
        return
    import httpx
    try:
        httpx.post(
            "https://oauth2.googleapis.com/revoke",
            data={"token": token},
            params={"token": token},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=10,
        )
    except Exception:  # noqa: BLE001
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Google Drive
# ─────────────────────────────────────────────────────────────────────────────

def _get_connected(db: Session, inst_id: int, provider: str) -> Integration:
    integ = db.query(Integration).filter(
        Integration.institution_id == inst_id,
        Integration.provider == provider,
    ).first()
    if not integ or integ.status != "connected":
        raise HTTPException(
            status_code=400,
            detail="Esta integración no está conectada. Conéctala primero.",
        )
    return integ


@router.get("/integrations/google/drive/folders")
async def drive_folders(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    inst_id = _require_institution(current_user)
    integ = _get_connected(db, inst_id, IntegrationProvider.GOOGLE_DRIVE)
    try:
        return {"folders": isvc.list_drive_folders(db, integ)}
    except isvc.RuntimeError:
        raise
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"No pudimos conectar Google Drive: {str(e)}")


@router.get("/integrations/google/drive/folders/{folder_id}/files")
async def drive_files(
    folder_id: str,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    inst_id = _require_institution(current_user)
    integ = _get_connected(db, inst_id, IntegrationProvider.GOOGLE_DRIVE)
    try:
        return {"files": isvc.list_drive_folder_files(db, integ, folder_id)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"No pudimos listar los archivos: {str(e)}")


@router.post("/integrations/google/drive/folder")
async def drive_select_folder(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Guarda la carpeta de Drive seleccionada en la configuración de la integración."""
    inst_id = _require_institution(current_user)
    folder_id = (body.get("folder_id") or "").strip()
    folder_name = (body.get("folder_name") or "").strip()
    if not folder_id:
        raise HTTPException(status_code=400, detail="folder_id es obligatorio.")
    integ = _get_connected(db, inst_id, IntegrationProvider.GOOGLE_DRIVE)
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
    Importa archivos seleccionados de Google Drive a los Materiales del docente.
    Registra cada archivo en teacher_materials (carpeta "Desde Drive" por defecto).
    """
    inst_id = _require_institution(current_user)
    files = body.get("files") or []  # [{id, name, type}]
    folder_id = (body.get("folder_id") or "").strip()

    from app.api.teacher_materials import TeacherFolder, TeacherMaterial

    if not files:
        raise HTTPException(status_code=400, detail="No se seleccionaron archivos.")

    # Carpeta destino: "Desde Google Drive".
    target = db.query(TeacherFolder).filter(
        TeacherFolder.teacher_id == current_user.id,
        TeacherFolder.name == "Desde Google Drive",
    ).first()
    if not target:
        target = TeacherFolder(teacher_id=current_user.id, name="Desde Google Drive", color="#0B6E99")
        db.add(target)
        db.flush()

    imported = []
    for f in files:
        file_id = str(f.get("id") or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9_-]{10,200}", file_id):
            raise HTTPException(status_code=400, detail="Archivo de Drive no válido.")
        # Se guarda como ENLACE al archivo en Drive (el binario no se copia):
        # «Abrir en Drive» desde Materiales. Antes se mezclaban metadatos con
        # shared_with («[object Object]») y el archivo no se podía abrir.
        mat = TeacherMaterial(
            folder_id=target.id,
            teacher_id=current_user.id,
            name=(f.get("name") or "Archivo de Drive")[:200],
            file_type="link",
            size="—",
            shared_with=[],
            original_name=f"https://drive.google.com/file/d/{file_id}/view",
            mime_type="drive-link",
            has_file=False,
        )
        db.add(mat)
        imported.append({"name": mat.name, "type": mat.file_type})
    db.commit()
    return {"ok": True, "imported": imported, "count": len(imported)}


# ─────────────────────────────────────────────────────────────────────────────
# Google Calendar
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/integrations/google/calendar/calendars")
async def calendar_calendars(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    inst_id = _require_institution(current_user)
    integ = _get_connected(db, inst_id, IntegrationProvider.GOOGLE_CALENDAR)
    try:
        return {"calendars": isvc.list_google_calendars(db, integ)}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"No pudimos consultar Google Calendar: {str(e)}")


@router.post("/integrations/google/calendar/select")
async def calendar_select(
    body: dict,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_INTEGRACIONES)),
    db: Session = Depends(get_db),
):
    """Guarda el calendario de Google seleccionado."""
    inst_id = _require_institution(current_user)
    calendar_id = (body.get("calendar_id") or "").strip()
    calendar_name = (body.get("calendar_name") or "").strip()
    if not calendar_id:
        raise HTTPException(status_code=400, detail="calendar_id es obligatorio.")
    integ = _get_connected(db, inst_id, IntegrationProvider.GOOGLE_CALENDAR)
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
    """Crea un evento real en el calendario de Google seleccionado."""
    inst_id = _require_institution(current_user)
    integ = _get_connected(db, inst_id, IntegrationProvider.GOOGLE_CALENDAR)
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
        raise HTTPException(status_code=500, detail=f"No pudimos crear el evento en Google: {str(e)}")


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