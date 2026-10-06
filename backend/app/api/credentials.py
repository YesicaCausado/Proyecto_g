"""
NeuroLearn AI - API de Credenciales B2B (MODIFICADO)
=====================================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.schemas.schemas import (
    InstitutionCreate,
    InstitutionResponse,
    CredentialItem,
    BulkCreateResponse,
    AdminStats,
)
from app.services.email_service import send_credentials_email

router = APIRouter(tags=["Credenciales B2B"])


# ─── Módulos permitidos del panel Súper Profesor (todos habilitados ahora) ──────
# NOTA: Ya no usamos licencias, todos los módulos están disponibles según rol
SUPER_MODULES = {
    "basica": [  # Mantener para compatibilidad pero todos los módulos están disponibles
        "dashboard",
        "gestión_profesores",
        "gestión_estudiantes",
        "configuracion",
        "reportes",
    ]
}


def _require_role(user: User, *allowed_roles: UserRole) -> None:
    """Verifica si el usuario tiene uno de los roles permitidos."""
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Se requiere uno de los roles: {[r.value for r in allowed_roles]}",
        )


def _get_my_institution(db: Session, current_user: User) -> Optional[Institution]:
    """Obtiene la institución del usuario actual."""
    institution_id = getattr(current_user, "institution_id", None)
    if not institution_id:
        return None
    return db.query(Institution).filter(Institution.id == institution_id).first()


def _resolve_license_state(institution: Institution) -> tuple[str, Optional[int]]:
    """
    Función de compatibilidad - ya no verifica estado de licencia real.
    Siempre devuelve activo y sin vencimiento.
    """
    if not institution.is_active:
        return "suspended", None
    # Siempre activo, sin vencimiento
    return "active", None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva institución con sus credenciales de acceso inicial.
    NOTA: Ya no se almacena license_type porque el sistema no usa licencias.
    """
    _require_role(current_user, UserRole.ADMIN.value)

    # Verificar que el dane_code no exista
    existing = db.query(Institution).filter(
        Institution.dane_code == payload.dane_code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código DANE ya está registrado por otra institución."
        )

    # Crear institución (sin license_type ya que no se usa)
    institution = Institution(
        name=payload.name,
        dane_code=payload.dane_code,
        # license_type eliminada - campo removido del modelo
        created_by=current_user.id,
    )
    db.add(institution)
    db.flush()  # obtener institution.id

    # Generar credenciales para el Super Profesor
    sp_username = payload.sp_document_number
    sp_password = Institution._generate_temp_password()

    # Crear usuario Super Profesor
    sp_user = User(
        username=sp_username,
        email=payload.sp_email,
        full_name=payload.sp_full_name,
        role=UserRole.SUPER_PROFESOR.value,
        hashed_password=User._hash_password(sp_password),
        institution_id=institution.id,
        is_active=True,
    )
    db.add(sp_user)
    db.flush()

    # Credenciales para enviar por email
    credential = CredentialItem(
        full_name=sp_user.full_name,
        username=sp_user.username,
        temp_password=sp_password,
        role=sp_user.role,
    )

    # Enviar credenciales por email (en background)
    try:
        send_credentials_email(
            to_email=sp_user.email,
            credential=credential,
            institution_name=institution.name,
        )
    except Exception as e:
        # No fallar la creación si falla el email
        pass

    db.commit()
    db.refresh(institution)
    db.refresh(sp_user)

    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        # license_type eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=credential,
    )


@router.get("/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene los detalles de una institución.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Verificar que el usuario pertenece a esta institución
    if getattr(current_user, "institution_id", None) != institution.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a esta institución"
        )
    
    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        # license_type eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
    )


@router.get("", response_model=List[InstitutionResponse])
async def list_institutions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Lista todas las instituciones (solo para admins).
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institutions = db.query(Institution).all()
    
    results = []
    for institution in institutions:
        results.append(InstitutionResponse(
            id=institution.id,
            name=institution.name,
            dane_code=institution.dane_code,
            # license_type eliminada - ya no se usa
            is_active=institution.is_active,
            created_at=institution.created_at,
            credential=CredentialItem(
                full_name="",  # Se obtiene separadamente si es necesario
                username="",
                temp_password="",
                role="",
            ),
        ))
    
    return results


# NOTA: El endpoint /super/license-usage ha sido eliminado
# ya que el sistema ya no tracks uso por licencia


@router.put("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: int,
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza una institución existente.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Verificar que el usuario pertenece a esta institución
    if getattr(current_user, "institution_id", None) != institution.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a esta institución"
        )
    
    # Verificar que el nuevo dane_code no exista (si cambió)
    if payload.dane_code != institution.dane_code:
        existing = db.query(Institution).filter(
            Institution.dane_code == payload.dane_code
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código DANE ya está registrado por otra institución."
            )
    
    # Actualizar campos
    institution.name = payload.name
    institution.dane_code = payload.dane_code
    # license_type eliminada - ya no se usa
    
    db.commit()
    db.refresh(institution)
    
    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        # license_type eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
    )


@router.delete("/{institution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_institution(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una institución y todos sus datos asociados.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Verificar que el usuario pertenece a esta institución
    if getattr(current_user, "institution_id", None) != institution.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a esta institución"
        )
    
    # Eliminar usuarios asociados primero (por foreign key)
    db.query(User).filter(User.institution_id == institution.id).delete()
    
    # Eliminar institución
    db.delete(institution)
    db.commit()
    
    return None


# Mantener funciones de compatibilidad pero simplificadas
def _require_super_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    _require_role(user, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value)