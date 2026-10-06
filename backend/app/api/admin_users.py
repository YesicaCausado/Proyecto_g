"""
NeuroLearn AI - API de Administración de Usuarios (MODIFICADO)
=============================================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.schemas.schemas import (
    UserResponse,
    InstitutionResponse,
    InstitutionCreate,
    CredentialItem,
    AdminStats,
)

router = APIRouter(prefix="/admin", tags=["Administración"])


# ── Dependencias ────────────────────────────────────────────────────────────

def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Verifica que el usuario sea administrador."""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador para esta operación."
        )
    return current_user


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStats)
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene estadísticas generales del sistema para el panel de administración.
    NOTA: Ya no se tracks licencias - todos los valores relacionados con licencias 
    son compatibles pero no reflejan restricciones reales.
    """
    _require_admin(current_user)
    
    # Conteos de usuarios por rol
    role_counts = {}
    for role in UserRole:
        count = db.query(User).filter(User.role == role.value).count()
        role_counts[f"total_{role.value}s"] = count
    
    # Conteos de instituciones
    total_institutions = db.query(Institution).count()
    active_institutions = db.query(Institution).filter(Institution.is_active == True).count()
    
    # NOTA: Ya no se tracks estados de licencia - todos se consideran activos
    expired_licenses = 0
    expiring_soon = 0
    
    # NOTA: Ya no se tracks tipos de licencia - todos se consideran "basica" para compatibilidad
    license_breakdown: dict = {
        "basica": total_institutions  # Todas las instituciones cuentan como basica para compatibilidad
    }
    
    # Instituciones más grandes (por estudiantes)
    top_institutions = (
        db.query(
            Institution.id,
            Institution.name,
            Institution.is_active,
            func.count(User.id).label("student_count"),
        )
        .outerjoin(User, (User.institution_id == Institution.id) & (User.role == UserRole.ESTUDIANTE.value))
        .group_by(Institution.id, Institution.name, Institution.is_active)
        .order_by(desc("student_count"))
        .limit(5)
        .all()
    )
    
    return AdminStats(
        total_institutions=total_institutions,
        active_institutions=active_institutions,
        total_super_profesores=role_counts.get("total_super_profesores", 0),
        total_profesores=role_counts.get("total_profesores", 0),
        total_estudiantes=role_counts.get("total_estudiantes", 0),
        total_admins=role_counts.get("total_admins", 0),
    )


@router.get("/institutions", response_model=List[InstitutionResponse])
async def list_institutions_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_type: Optional[str] = Query(None, description="NOTA: Ignorado - el sistema ya no usa licencias"),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None, description="Buscar por nombre o código DANE"),
    limit: int = Query(50, gt=0, le=100),
    offset: int = Query(0, ge=0),
):
    """
    Lista instituciones con filtros opcionales.
    NOTA: El parámetro license_type es ignorado ya que el sistema ya no usa licencias.
    """
    _require_admin(current_user)
    
    query = db.query(Institution)
    
    if is_active is not None:
        query = query.filter(Institution.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Institution.name.ilike(search_term)) |
            (Institution.dane_code.ilike(search_term))
        )
    
    # NOTA: license_type parameter es ignorado ya que el sistema ya no usa licencias
    
    institutions = query.offset(offset).limit(limit).all()
    
    results = []
    for institution in institutions:
        results.append(InstitutionResponse(
            id=institution.id,
            name=institution.name,
            dane_code=institution.dane_code,
            # license_type eliminada - el sistema ya no usa licencias
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


@router.post("/institutions", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution_admin(
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva institución.
    NOTA: Ya no se almacena license_type porque el sistema no usa licencias.
    """
    _require_admin(current_user)
    
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
        from app.services.email_service import send_credentials_email
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
        # license_type eliminada - el sistema ya no usa licencias
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=credential,
    )


@router.put("/institutions/{institution_id}", response_model=InstitutionResponse)
async def update_institution_admin(
    institution_id: int,
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza una institución existente.
    """
    _require_admin(current_user)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
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
        # license_type eliminada - el sistema ya no usa licencias
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
    )


@router.delete("/institutions/{institution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_institution_admin(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una institución y todos sus datos asociados.
    """
    _require_admin(current_user)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Eliminar usuarios asociados primero (por foreign key)
    db.query(User).filter(User.institution_id == institution.id).delete()
    
    # Eliminar institución
    db.delete(institution)
    db.commit()
    
    return None


# Mantener funciones de compatibilidad pero simplificadas
def _require_admin_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    return user.role == UserRole.ADMIN.value