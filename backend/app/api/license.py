"""
NeuroLearn AI — Información de Licencia (MODIFICADO)
=====================================================

Endpoint para obtener información de licencia adaptado al nuevo sistema
sin restricciones de licencia.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.services.license_service import get_license_for_user

router = APIRouter(prefix="/license", tags=["License Information"])


class LicenseInfo(BaseModel):
    institution_id: int
    license_type: str  # Mantenido para compatibilidad frontend
    is_active: bool
    expiry_date: Optional[str]
    teachers_limit: int
    students_limit: int
    teachers_current: int
    students_current: int
    available_features: List[str]
    blocked_features: List[str]  # Siempre vacío ahora
    usage_percentage: float  # Siempre 0 ahora (sin límites)
    institution_name: str


@router.get("/my-license")
async def get_my_license(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Información de licencia del usuario autenticado.
    MODIFICADO: Ahora refleja permisos basados en rol, no en restricciones de licencia.
    """
    try:
        license_info = get_license_for_user(current_user, db)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo obtener la licencia (base de datos). {str(e)[:160]}",
        )
    return license_info.to_dict()


@router.get("/info")
async def get_license_info(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene información completa de la licencia de la institución del usuario.
    MODIFICADO: Todos los límites son ilimitados, todas las características disponibles según rol.
    """
    institution = db.query(Institution).filter(
        Institution.id == current_user.institution_id,
        Institution.is_active == True
    ).first()

    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")

    # Usar el license_type real de la institución para el campo, pero no para permisos
    plan = institution.license_type or "basica"
    
    # Todos los límites son ilimitados ahora
    teachers_limit = 999999
    students_limit = 999999

    # Contar usuarios actuales
    teachers = db.query(User).filter(
        User.institution_id == institution.id,
        User.role.in_([UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value])
    ).count()

    students = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value
    ).count()

    # Obtener características disponibles según el rol del usuario
    from app.services.license_service import get_license_for_user
    license_info = get_license_for_user(current_user, db)
    enabled_features = license_info.features
    
    # Sin características bloqueadas (todo disponible según rol)
    blocked_features = []

    # Sin uso porcentual (sin límites)
    usage_percentage = 0.0

    return LicenseInfo(
        institution_id=institution.id,
        license_type=plan,
        is_active=institution.is_active,
        expiry_date=institution.expiry_date.strftime("%Y-%m-%d") if institution.expiry_date else None,
        teachers_limit=teachers_limit,
        students_limit=students_limit,
        teachers_current=teachers,
        students_current=students,
        available_features=enabled_features,
        blocked_features=blocked_features,
        usage_percentage=usage_percentage,
        institution_name=institution.name,
    )


@router.get("/check-feature/{feature}")
async def check_feature_access(
    feature: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifica si el usuario tiene acceso a una funcionalidad basada en su rol.
    """
    try:
        license_info = get_license_for_user(current_user, db)
        has_access = license_info.has_feature(feature)
        return {"has_access": has_access, "feature": feature}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))