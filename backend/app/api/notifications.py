"""
NeuroLearn IA — Notificaciones persistentes del usuario autenticado.

    GET   /notifications                  Lista (más recientes primero) + no leídas
    GET   /notifications/unread-count     Solo el contador (para la campana)
    POST  /notifications/{id}/read        Marca una como leída (persiste)
    POST  /notifications/read-all         Marca todas como leídas
    GET   /notifications/preferences      Preferencias del perfil
    PUT   /notifications/preferences

Las notificaciones se crean desde los eventos reales del sistema
(app/services/notification_service.py). Cada usuario solo ve y modifica las
suyas. Para el estudiante, al consultar se evalúan además la racha y el
rendimiento de sus quizzes; se guardan una sola vez por condición.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.notification import Notification
from app.models.user import User
from app.services import notification_service as svc

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Notificaciones"])


class PreferencesPayload(BaseModel):
    nueva_actividad: Optional[bool] = None
    mensaje_directo: Optional[bool] = None


@router.get("/notifications")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        if svc.ensure_activity_notifications(db, current_user):
            db.commit()
    except Exception:  # la lista no depende de estas notificaciones derivadas
        db.rollback()
        logger.exception("No se pudieron evaluar racha/rendimiento del usuario %s", current_user.id)

    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)  # noqa: E712
    total = q.count()
    rows = q.order_by(Notification.created_at.desc(), Notification.id.desc()).offset(offset).limit(limit).all()
    return {
        "notifications": [svc.serialize(n) for n in rows],
        "unread_count": svc.unread_count(db, current_user.id),
        "total": total,
        "has_more": offset + len(rows) < total,
    }


@router.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return {"unread_count": svc.unread_count(db, current_user.id)}


@router.post("/notifications/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False,  # noqa: E712
    ).update({Notification.is_read: True, Notification.read_at: svc.utcnow()}, synchronize_session=False)
    db.commit()
    return {"updated": updated, "unread_count": 0}


@router.post("/notifications/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    n = db.query(Notification).filter(
        Notification.id == notification_id, Notification.user_id == current_user.id).first()
    if n is None:  # inexistente o de otro usuario: misma respuesta
        raise HTTPException(status_code=404, detail="Notificación no encontrada")
    if not n.is_read:
        n.is_read = True
        n.read_at = svc.utcnow()
        db.commit()
        db.refresh(n)
    return {"notification": svc.serialize(n), "unread_count": svc.unread_count(db, current_user.id)}


@router.get("/notifications/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return svc.get_preferences(db, current_user.id)


@router.put("/notifications/preferences")
def update_preferences(
    payload: PreferencesPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prefs = svc.set_preferences(db, current_user.id, payload.model_dump())
    db.commit()
    return prefs
