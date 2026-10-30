"""Presentación y acuse del aviso de privacidad estudiantil."""
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_client_ip, get_current_user
from app.db.database import get_db
from app.models.user import User, UserRole
from app.services import student_privacy_service as privacy

router = APIRouter(prefix="/privacy-notice", tags=["Privacidad estudiantil"])


class NoticeAcknowledgement(BaseModel):
    version: str
    acknowledged: bool


def _iso(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.isoformat().replace("+00:00", "Z")


@router.get("/me")
def get_notice(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(status_code=403, detail="Este aviso aplica únicamente a estudiantes.")
    if current_user.must_change_password:
        raise HTTPException(status_code=403, detail="Primero debes cambiar tu contraseña temporal.")
    record = privacy.present(
        db, current_user.id, get_client_ip(request), request.headers.get("user-agent")
    )
    return {
        "notice": privacy.NOTICE,
        "presented_at": _iso(record.presented_at),
        "acknowledged_at": _iso(record.acknowledged_at),
        "acknowledged": record.acknowledged_at is not None,
    }


@router.post("/acknowledge")
def acknowledge_notice(
    payload: NoticeAcknowledgement,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(status_code=403, detail="Este aviso aplica únicamente a estudiantes.")
    if current_user.must_change_password:
        raise HTTPException(status_code=403, detail="Primero debes cambiar tu contraseña temporal.")
    if not payload.acknowledged:
        raise HTTPException(status_code=400, detail="Debes confirmar que leíste el aviso para continuar.")
    if payload.version != privacy.POLICY_VERSION:
        raise HTTPException(status_code=409, detail="El aviso cambió. Vuelve a consultarlo.")
    record = privacy.current_notice(db, current_user.id)
    if record is None:
        raise HTTPException(status_code=409, detail="Primero debes consultar el aviso de privacidad.")
    record = privacy.acknowledge(
        db, record, get_client_ip(request), request.headers.get("user-agent")
    )
    return {"acknowledged": True, "version": record.policy_version, "acknowledged_at": _iso(record.acknowledged_at)}
