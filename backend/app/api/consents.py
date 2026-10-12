"""
NeuroLearn IA — API de consentimientos de cámara y micrófono.

    GET    /api/v1/consents/me                 estado + textos vigentes
    POST   /api/v1/consents                    aceptar {consent_type, version, accepted: true}
    DELETE /api/v1/consents/{consent_type}     retirar

Cualquier usuario autenticado gestiona solo sus propios consentimientos.
El backend además ignora `facial_data` / `voice_data` en el chat si el
usuario no tiene el consentimiento vigente (app/api/chat.py).
"""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_client_ip, get_current_user
from app.db.database import get_db
from app.models.consent import CONSENT_TYPES
from app.models.user import User, UserRole
from app.services import consent_service as svc
from app.services import notification_service

router = APIRouter(prefix="/consents", tags=["Consentimientos"])

ConsentType = Literal["camara_facial", "microfono_voz"]


class ConsentAccept(BaseModel):
    consent_type: ConsentType
    version: str
    accepted: bool


class ConsentRequest(BaseModel):
    consent_type: ConsentType


def _iso(dt):
    return dt.replace(microsecond=0).isoformat() + "Z" if dt else None


def _state(db: Session, user: User) -> dict:
    items = {}
    guardian = svc.guardian_status(user)
    blocked = guardian["required"] and not guardian["authorized"]
    for ctype in CONSENT_TYPES:
        record = svc.active_consent(db, user.id, ctype)
        items[ctype] = {
            # Sin autorización del acudiente el consentimiento no surte efecto.
            "granted": record is not None and not blocked,
            "version": record.version if record else None,
            "granted_at": _iso(record.granted_at) if record else None,
            "current_version": svc.current_version(ctype),
            "document": svc.CONSENT_DOCUMENTS[ctype],
        }
    return {
        "consents": items,
        "guardian": {**guardian, "blocked": blocked, "message": svc.GUARDIAN_MESSAGE if blocked else None},
    }


@router.get("/me")
async def my_consents(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Estado de los consentimientos del usuario y textos vigentes."""
    return _state(db, current_user)


@router.post("", status_code=201)
async def accept_consent(
    payload: ConsentAccept,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra la aceptación explícita de la versión vigente del texto."""
    if not payload.accepted:
        raise HTTPException(status_code=400, detail="Para activar la función debes aceptar explícitamente.")
    if payload.version != svc.current_version(payload.consent_type):
        raise HTTPException(
            status_code=409,
            detail="El texto del consentimiento cambió. Vuelve a leerlo y acéptalo de nuevo.",
        )
    try:
        svc.grant(
            db, current_user.id, payload.consent_type, payload.version,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
        )
    except svc.GuardianAuthorizationRequired as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    return _state(db, current_user)


@router.post("/request-authorization")
async def request_guardian_authorization(
    payload: ConsentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Notifica a los Súper Profesores que el estudiante necesita autorización."""
    guardian = svc.guardian_status(current_user)
    if current_user.role != UserRole.ESTUDIANTE.value or not (
        guardian["required"] and not guardian["authorized"]
    ):
        raise HTTPException(
            status_code=400,
            detail="Esta cuenta no tiene una autorización institucional pendiente.",
        )
    recipients = [
        row[0]
        for row in db.query(User.id).filter(
            User.role == UserRole.SUPER_PROFESOR.value,
            User.institution_id == current_user.institution_id,
            User.is_active.is_(True),
        ).all()
    ]
    if not recipients:
        raise HTTPException(
            status_code=409,
            detail="No hay un coordinador o Súper Profesor activo en tu institución.",
        )
    label = "cámara" if payload.consent_type == "camara_facial" else "micrófono"
    notification_service.notify(
        db,
        recipients,
        "solicitud_consentimiento",
        "Solicitud de autorización de acudiente",
        f"{current_user.full_name or current_user.username} solicita registrar la autorización "
        f"de acudiente para activar el {label}.",
        link="/super?tab=estudiantes",
        resource_type="usuario",
        resource_id=current_user.id,
        dedupe_key=f"consent-request:{current_user.id}:{payload.consent_type}",
    )
    db.commit()
    return {"requested": True, "message": "Solicitud enviada a tu institución."}


@router.delete("/{consent_type}")
async def revoke_consent(
    consent_type: ConsentType,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retira el consentimiento: la función deja de poder activarse."""
    svc.revoke(db, current_user.id, consent_type)
    return _state(db, current_user)
