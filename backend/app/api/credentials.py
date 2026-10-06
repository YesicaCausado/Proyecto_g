"""
NeuroLearn AI - API de Credenciales B2B (MODIFICADO)
====================================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from enum import Enum
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.services.license_service import require_active_license  # Mantener por compatibilidad

router = APIRouter(prefix="/credentials", tags=["Credenciales"])


def get_credential_service(
    db: Session = Depends(get_db),
) -> "CredentialService":
    """Placeholder for credential service dependency."""
    # This would normally return a service instance
    # For now, we'll return a dummy object
    class DummyCredentialService:
        def __init__(self):
            self.initialized = True
    return DummyCredentialService()


class CredentialItem(BaseModel):
    full_name: Optional[str] = None
    username: str
    temp_password: str
    role: str


class InstitutionResponse(BaseModel):
    id: int
    name: str
    dane_code: str
    license_type: Optional[str] = None  # Mantener para compatibilidad pero siempre None
    is_active: bool
    created_at: datetime
    credential: CredentialItem


class InstitutionCreate(BaseModel):
    name: str
    dane_code: str
    is_active: bool = True


@router.post("/institutions", response_model=InstitutionResponse)
async def create_institution(
    institution_data: InstitutionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crear una nueva institución.
    Solo administradores pueden crear instituciones.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    check_origin(request)
    check_rate_limit(request)
    
    # Verificar si ya existe una institución con el mismo código DANE
    existing_institution = (
        db.query(Institution)
        .filter(Institution.dane_code == institution_data.dane_code)
        .first()
    )
    
    if existing_institution:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe una institución con ese código DANE"
        )
    
    # Crear nueva institución
    db_institution = Institution(
        name=institution_data.name,
        dane_code=institution_data.dane_code,
        is_active=institution_data.is_active,
    )
    
    db.add(db_institution)
    db.commit()
    db.refresh(db_institution)
    
    return InstitutionResponse(
        id=db_institution.id,
        name=db_institution.name,
        dane_code=db_institution.dane_code,
        license_type=None,  # Eliminada - ya no se usa
        is_active=db_institution.is_active,
        created_at=db_institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
    )


@router.get("/institutions/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtener información de una institución por su ID.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    check_origin(request)
    check_rate_limit(request)
    
    institution = (
        db.query(Institution)
        .filter(Institution.id == institution_id)
        .first()
    )
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        license_type=None,  # Eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
    )


@router.get("/super/students")
async def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    students = (
        db.query(User)
        .filter(User.role == UserRole.ESTUDIANTE.value)
        .filter(User.institution_id == institution.id)
        .all()
    )
    
    return [
        {
            "id": student.id,
            "username": student.username,
            "full_name": student.full_name,
            "email": student.email,
            "is_active": student.is_active,
        }
        for student in students
    ]


@router.get("/super/teachers")
async def list_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    teachers = (
        db.query(User)
        .filter(User.role == UserRole.PROFESOR.value)
        .filter(User.institution_id == institution.id)
        .all()
    )
    
    return [
        {
            "id": teacher.id,
            "username": teacher.username,
            "full_name": teacher.full_name,
            "email": teacher.email,
            "is_active": teacher.is_active,
        }
        for teacher in teachers
    ]


# ─── Super Profesor: Estadísticas ──────────────────────────────────────────────
@router.get("/super/stats")
async def get_super_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    # Estadísticas básicas
    total_students = (
        db.query(User)
        .filter(User.role == UserRole.ESTUDIANTE.value)
        .filter(User.institution_id == institution.id)
        .count()
    )
    
    total_teachers = (
        db.query(User)
        .filter(User.role == UserRole.PROFESOR.value)
        .filter(User.institution_id == institution.id)
        .count()
    )
    
    total_super_teachers = (
        db.query(User)
        .filter(User.role == UserRole.SUPER_PROFESOR.value)
        .filter(User.institution_id == institution.id)
        .count()
    )
    
    total_admins = (
        db.query(User)
        .filter(User.role == UserRole.ADMIN.value)
        .filter(User.institution_id == institution.id)
        .count()
    )
    
    return {
        "institution": {
            "id": institution.id,
            "name": institution.name,
            "dane_code": institution.dane_code,
        },
        "counts": {
            "students": total_students,
            "teachers": total_teachers,
            "super_teachers": total_super_teachers,
            "admins": total_admins,
        }
    }


# ─── Super Profesor: Credenciales ──────────────────────────────────────────────
@router.post("/super/credentials", response_model=List[CredentialItem])
async def create_super_credentials(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    # En un entorno real, generaríamos credenciales reales
    # Por ahora, devolvemos una lista vacía o datos de ejemplo
    return [
        CredentialItem(
            full_name="Credencial de ejemplo",
            username="usuario1",
            temp_password="temp123",
            role="estudiante",
        ),
        CredentialItem(
            full_name="Credencial de ejemplo",
            username="usuario2",
            temp_password="temp456",
            role="profesor",
        ),
    ]


# ─── Endpoints de compatibilidad (Mantener pero sin funcionalidad real) ───────
@router.get("/license/{institution_id}")
async def get_license(
    institution_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Endpoint de compatibilidad - ya no devuelve información de licencia real
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    check_origin(request)
    check_rate_limit(request)
    
    institution = (
        db.query(Institution)
        .filter(Institution.id == institution_id)
        .first()
    )
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    # Devolver datos de compatibilidad pero sin información real de licencia
    return {
        "institution_id": institution.id,
        "name": institution.name,
        "dane_code": institution.dane_code,
        "license_type": None,  # Eliminada - ya no se usa
        "is_active": institution.is_active,
        "created_at:": institution.created_at,
        "message": "El sistema de licencias ha sido eliminado. Los permisos se basan en roles."
    }


@router.post("/license/{institution_id}/renew")
async def renew_license(
    institution_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Endpoint de compatibilidad - ya no funciona
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    check_origin(request)
    check_rate_limit(request)
    
    institution = (
        db.query(Institution)
        .filter(Institution.id == institution_id)
        .first()
    )
    
    if not institution:
        raise HTTPException(status_code=404, detail="Institución no encontrada")
    
    return {
        "message": "El sistema de licencias ha sido eliminado. No es necesario renovar.",
        "institution_id": institution.id,
        "name": institution.name,
        "dane_code": institution.dane_code,
    }


# ─── Endpoints de información ─────────────────────────────────────────────────
@router.get("/info")
async def get_credentials_info(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Información general sobre el sistema de credenciales
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    check_origin(request)
    check_rate_limit(request)
    
    return {
        "system": "NeuroLearn AI Credentials",
        "version": "2.0.0",
        "license_system": "Eliminado - permisos basados en roles",
        "supported_roles": [role.value for role in UserRole],
        "features": [
            "Creación de instituciones",
            "Gestión de usuarios por rol",
            "Credenciales temporales",
            "Información de institución"
        ]
    }