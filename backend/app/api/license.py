"""
NeuroLearn AI — Control de Licenciamiento y Restricciones
===========================================================
Endpoints para gestión de licencias y control de acceso según plan
"""
import os
from typing import Optional, List, Dict
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.services.license_service import get_license_for_user

router = APIRouter(prefix="/license", tags=["License Control"])

# Límites de licencia (configurables)
LICENSE_LIMITS = {
    "basica": {"teachers": 10, "students": 100, "features": ["chat_basic", "basic_dashboard"]},
    "premium": {"teachers": 50, "students": 500, "features": ["chat_basic", "chat_advanced", "bots_private", "advanced_reports"]},
    "pro": {"teachers": 200, "students": 2000, "features": ["chat_basic", "chat_advanced", "bots_private", "advanced_reports", "ai_analysis", "voice_detection"]}
}

def _check_feature_access(
    institution_id: int,
    feature: str,
    db: Session,
    current_user: User
) -> bool:
    """
    Verifica si el usuario tiene acceso a una funcionalidad según su licencia.
    
    feature: "chat_basic", "chat_advanced", "bots_private", "advanced_reports", "ai_analysis", "voice_detection"
    """
    institution = db.query(Institution).filter(
        Institution.id == institution_id,
        Institution.is_active == True
    ).first()
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")

    # Verificar si institución está activa
    if not institution.is_active:
        raise HTTPException(status_code=403, detail="Institución no activa")

    # Verificar si licencia ha vencido
    if institution.expiry_date and institution.expiry_date < datetime.utcnow():
        raise HTTPException(status_code=403, detail="Licencia vencida")

    # Obtener límites actuales (pueden ser dinámicos)
    limits = LICENSE_LIMITS.get(institution.license_type or "basica")
    if not limits:
        limits = LICENSE_LIMITS["basica"]

    # Verificar si la feature está habilitada en la licencia
    enabled_features = limits.get("features", [])
    if feature not in enabled_features:
        return False

    # Verificar cupos
    teachers = db.query(User).filter(
        User.institution_id == institution_id,
        User.role.in_([UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value])
    ).count()

    students = db.query(User).filter(
        User.institution_id == institution_id,
        User.role == UserRole.ESTUDIANTE.value
    ).count()

    if teachers > limits["teachers"] or students > limits["students"]:
        return False

    return True


class LicenseInfo(BaseModel):
    institution_id: int
    license_type: str
    is_active: bool
    expiry_date: Optional[str]
    teachers_limit: int
    students_limit: int
    teachers_current: int
    students_current: int
    available_features: List[str]
    blocked_features: List[str]
    usage_percentage: float


@router.get("/my-license")
async def get_my_license(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Licencia del usuario autenticado, en el formato que consume el frontend.

    Reutiliza la lógica central de `license_service.get_license_for_user`, que
    calcula el estado (active/expiring_soon/expired/suspended), los módulos
    disponibles por plan y rol, límites, etc.

    Formato de respuesta (LicenseInfo.to_dict):
      license_type, license_status, days_left, teacher_modules, student_modules,
      teacher_dashboard_kpis, neurobot_limit, export_formats, groups_limit,
      students_limit, institution_name

    Este es el endpoint canónico que la UI debe usar (ver LicenseContext.tsx).
    """
    license_info = get_license_for_user(current_user, db)
    return license_info.to_dict()


@router.get("/info")
async def get_license_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene información completa de la licencia de la institución del usuario.
    
    Retorna:
    - Tipo de licencia activa
    - Fecha de vencimiento
    - Límites de cupos (docentes y estudiantes)
    - Uso actual
    - Funcionalidades habilitadas
    - Funcionalidades bloqueadas
    - Porcentaje de uso
    """
    institution = db.query(Institution).filter(
        Institution.id == current_user.institution_id,
        Institution.is_active == True
    ).first()

    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")

    limits = LICENSE_LIMITS.get(institution.license_type or "basica")
    if not limits:
        limits = LICENSE_LIMITS["basica"]

    teachers = db.query(User).filter(
        User.institution_id == institution.id,
        User.role.in_([UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value])
    ).count()

    students = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value
    ).count()

    enabled_features = limits.get("features", [])
    blocked_features = []

    # Identificar funcionalidades bloqueadas según licencia
    if institution.license_type == "basica":
        blocked_features = [f for f in LICENSE_LIMITS["premium"]["features"] if f not in enabled_features]
    elif institution.license_type == "premium":
        blocked_features = [f for f in LICENSE_LIMITS["pro"]["features"] if f not in enabled_features]

    total_cupos = limits["teachers"] + limits["students"]
    total_uso = teachers + students
    usage_percentage = (total_uso / total_cupos * 100) if total_cupos > 0 else 0

    return LicenseInfo(
        institution_id=institution.id,
        license_type=institution.license_type or "basica",
        is_active=institution.is_active,
        expiry_date=institution.expiry_date.strftime("%Y-%m-%d") if institution.expiry_date else None,
        teachers_limit=limits["teachers"],
        students_limit=limits["students"],
        teachers_current=teachers,
        students_current=students,
        available_features=enabled_features,
        blocked_features=blocked_features,
        usage_percentage=round(usage_percentage, 1)
    )


@router.get("/check-feature/{feature}")
async def check_feature_access(
    feature: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifica si el usuario tiene acceso a una funcionalidad específica.
    
    Uso: GET /license/check-feature/chat_advanced
    Devuelve: true/false
    """
    try:
        has_access = _check_feature_access(
            institution_id=current_user.institution_id,
            feature=feature,
            db=db,
            current_user=current_user
        )
        return {"has_access": has_access, "feature": feature}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))