
"""
NeuroLearn AI — Información de Acceso Institucional
====================================================

Endpoint para obtener información de la institución y
los permisos del usuario autenticado.

IMPORTANTE:
El sistema YA NO utiliza licencias.

El acceso se determina mediante:
    - Rol del usuario
    - Estado de la institución
    - Funcionalidades permitidas para cada rol
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.institution import Institution


router = APIRouter(
    prefix="/access",
    tags=["Access Information"],
)


# ============================================================================
# CONFIGURACIÓN DE FUNCIONALIDADES POR ROL
# ============================================================================

ROLE_FEATURES = {
    UserRole.ADMIN.value: [
        "admin",
        "institutions",
        "users",
        "statistics",
        "configuration",
    ],

    UserRole.SUPER_PROFESOR.value: [
        "institution",
        "teachers",
        "students",
        "groups",
        "reports",
        "statistics",
    ],

    UserRole.PROFESOR.value: [
        "students",
        "groups",
        "tasks",
        "reports",
        "neurodigital",
        "chat",
        "performance",
    ],

    UserRole.ESTUDIANTE.value: [
        "tasks",
        "chat",
        "neurodigital",
        "performance",
        "progress",
    ],
}


# ============================================================================
# SCHEMAS
# ============================================================================

class AccessInfo(BaseModel):
    """
    Información de acceso del usuario actual.
    """

    institution_id: int | None
    institution_name: str | None
    institution_active: bool

    user_id: int
    role: str

    available_features: List[str]


class FeatureAccessResponse(BaseModel):
    """
    Resultado de la comprobación de acceso a una funcionalidad.
    """

    has_access: bool
    feature: str


# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

def get_features_for_role(role: str) -> List[str]:
    """
    Devuelve las funcionalidades permitidas para un rol.
    """

    return ROLE_FEATURES.get(role, [])


def user_has_feature(
    user: User,
    feature: str,
) -> bool:
    """
    Comprueba si un usuario tiene acceso a una funcionalidad
    según su rol.
    """

    features = get_features_for_role(user.role)

    return feature in features


# ============================================================================
# INFORMACIÓN DE ACCESO
# ============================================================================

@router.get(
    "/me",
    response_model=AccessInfo,
)
async def get_my_access(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene la información de acceso del usuario autenticado.

    Ya no consulta ningún sistema de licencias.
    """

    institution = None

    if current_user.institution_id is not None:
        institution = (
            db.query(Institution)
            .filter(
                Institution.id == current_user.institution_id
            )
            .first()
        )

    # ------------------------------------------------------------------------
    # Verificar institución
    # ------------------------------------------------------------------------

    institution_active = True

    if institution:
        institution_active = bool(
            institution.is_active
        )

        if not institution_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La institución se encuentra inactiva.",
            )

    # ------------------------------------------------------------------------
    # Funcionalidades según rol
    # ------------------------------------------------------------------------

    features = get_features_for_role(
        current_user.role
    )

    return AccessInfo(
        institution_id=(
            institution.id
            if institution
            else current_user.institution_id
        ),

        institution_name=(
            institution.name
            if institution
            else None
        ),

        institution_active=institution_active,

        user_id=current_user.id,
        role=current_user.role,

        available_features=features,
    )


# ============================================================================
# COMPROBAR FUNCIONALIDAD
# ============================================================================

@router.get(
    "/check-feature/{feature}",
    response_model=FeatureAccessResponse,
)
async def check_feature_access(
    feature: str,
    current_user: User = Depends(get_current_user),
):
    """
    Comprueba si el usuario tiene acceso a una funcionalidad.

    El acceso depende únicamente del rol.
    """

    has_access = user_has_feature(
        current_user,
        feature,
    )

    return FeatureAccessResponse(
        has_access=has_access,
        feature=feature,
    )
