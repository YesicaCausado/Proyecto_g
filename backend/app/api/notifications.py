"""
NeuroLearn AI - API de Notificaciones (MODIFICADO)
===================================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.services.license_service import require_active_license  # Mantener por compatibilidad
from pydantic import BaseModel

router = APIRouter(prefix="/notifications", tags=["Notificaciones"])


# ── Esquemas ────────────────────────────────────────────────────────────────

class NotificationBase(BaseModel):
    id: str
    type: str  # info, warning, error, success
    title: str
    message: str
    icon: str
    read: bool
    created_at: str  # ISO format datetime string

class NotificationCreate(NotificationBase):
    user_id: int

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna notificaciones contextuales del usuario autenticado.
    NOTA: Ya no se bloquean notificaciones por licencia suspendida 
    ya que el sistema ya no usa licencias.
    """
    try:
        notifs = _build_notifications(current_user, db)
    except Exception:
        notifs = [{
            "id": "fallback",
            "type": "info",
            "title": "¡Bienvenido a NeuroLearn!",
            "message": "Tu asistente Neuron está listo para ayudarte.",
            "icon": "bot",
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        }]
    
    return notifs


def _build_notifications(current_user: User, db: Session) -> List[dict]:
    """
    Construye notificaciones contextuales basado en el rol y estado del usuario.
    """
    notifs = []
    now = datetime.utcnow()
    
    # Notificaciones de bienvenida para nuevos usuarios
    if current_user.created_at and (now - current_user.created_at).days < 1:
        notifs.append({
            "id": "welcome",
            "type": "info",
            "title": "¡Bienvenido a NeuroLearn!",
            "message": "Comienza tu jornada explorando el tablero y descubriendo todas las herramientas disponibles.",
            "icon": "bot",
            "read": False,
            "created_at": current_user.created_at.isoformat(),
        })
    
    # Notificaciones específicas por rol
    if current_user.role == UserRole.ESTUDIANTE.value:
        # Notificaciones para estudiantes
        notifs.extend(_get_student_notifications(current_user, db))
    elif current_user.role == UserRole.PROFESOR.value:
        # Notificaciones para profesores
        notifs.extend(_get_teacher_notifications(current_user, db))
    elif current_user.role == UserRole.SUPER_PROFESOR.value:
        # Notificaciones para super profesores
        notifs.extend(_get_super_teacher_notifications(current_user, db))
    elif current_user.role == UserRole.ADMIN.value:
        # Notificaciones para administradores
        notifs.extend(_get_admin_notifications(current_user, db))
    
    # Notificaciones de sistema
    notifs.extend(_get_system_notifications(current_user, db))
    
    return notifs


def _get_student_notifications(current_user: User, db: Session) -> List[dict]:
    """Notificaciones específicas para estudiantes."""
    notifs = []
    # Ejemplo: notificaciones sobre tareas pendientes, etc.
    # Implementación simplificada
    return notifs


def _get_teacher_notifications(current_user: User, db: Session) -> List[dict]:
    """Notificaciones específicas para profesores."""
    notifs = []
    # Ejemplo: notificaciones sobre actividades para calificar, etc.
    # Implementación simplificada
    return notifs


def _get_super_teacher_notifications(current_user: User, db: Session) -> List[dict]:
    """Notificaciones específicas para super profesores."""
    notifs = []
    # Ejemplo: notificaciones sobre reportes institucionales, etc.
    # Implementación simplificada
    return notifs


def _get_admin_notifications(current_user: User, db: Session) -> List[dict]:
    """Notificaciones específicas para administradores."""
    notifs = []
    # Ejemplo: notificaciones sobre instituciones que necesitan atención, etc.
    # Implementación simplificada
    return notifs


def _get_system_notifications(current_user: User, db: Session) -> List[dict]:
    """Notificaciones de sistema aplicables a todos los usuarios."""
    notifs = []
    # Ejemplo: notificaciones de mantenimiento, actualizaciones, etc.
    # Implementación simplificada
    return notifs


# Mantener funciones de compatibilidad pero simplificadas
def _require_notifications_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    return True