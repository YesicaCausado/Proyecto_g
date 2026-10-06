"""
NeuroLearn AI — Control de Licenciamiento y Restricciones
===========================================================
Endpoints para gestión de licencias y control de acceso según plan
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.services.license_service import (
    get_license_for_user,
    TEACHER_LIMITS,
    STUDENT_LIMITS,
    features_for_user,
)

router = APIRouter(prefix="/license", tags=["License Control"])

# Feature keys expuestos por /license/info — derivados de la MATRIZ
# de funcionalidades (FEATURE_MATRIX). Para /info se usa la unión de features
# de los tres roles en ese plan (vista institucional), no de un rol concreto.
def _features_for_plan(plan: str) -> List[str]:
    """Unión de features disponibles en el plan para los tres roles."""
    roles = ("super_profesor", "profesor", "estudiante")
    acc: set = set()
    for r in roles:
        acc |= set(features_for_user(r, plan))
    return sorted(acc)


def _check_feature_access(
    institution_id: int,
    feature: str,
    db: Session,
    current_user: User
) -> bool:
    """
    Verifica si el usuario tiene acceso a una funcionalidad según su licencia.

    feature: nombre canónico de FEATURE_MATRIX (ej. "neuroalertas", "automation").
    Comprueba ROL + LICENCIA usando la lógica central de license_service.
    """
    lic = get_license_for_user(current_user, db)
    return lic.has_feature(feature)


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
    try:
        license_info = get_license_for_user(current_user, db)
    except HTTPException:
        raise
    except Exception as e:
        # La base de datos puede fallar/colgarse en serverless (causa del 500
        # en producción). Devolvemos un 503 controlado en lugar del 500 crudo.
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

    plan = institution.license_type or "basica"
    teachers_limit = TEACHER_LIMITS.get(plan, TEACHER_LIMITS["basica"])
    students_limit = STUDENT_LIMITS.get(plan, STUDENT_LIMITS["basica"])

    teachers = db.query(User).filter(
        User.institution_id == institution.id,
        User.role.in_([UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value])
    ).count()

    students = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value
    ).count()

    enabled_features = _features_for_plan(plan)
    # Funcionalidades bloqueadas = todo lo de PRO menos lo que sí tiene el plan
    # actual (modelo acumulativo: PRO es el superset de todas las features).
    all_features = _features_for_plan("pro")
    blocked_features = sorted(set(all_features) - set(enabled_features))

    total_cupos = teachers_limit + students_limit
    total_uso = teachers + students
    usage_percentage = (total_uso / total_cupos * 100) if total_cupos > 0 else 0

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
        usage_percentage=round(usage_percentage, 1)
    )


@router.get("/check-feature/{feature}")
async def check_feature_access(
    feature: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Verifica si el usuario tiene acceso a una funcionalidad (módulo) específica.

    Uso: GET /license/check-feature/neurobots
    Devuelve: {"has_access": true|false, "feature": "neurobots"}
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