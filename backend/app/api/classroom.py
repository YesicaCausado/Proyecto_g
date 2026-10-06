"""
NeuroLearn AI - API de Aulas y Grupos (MODIFICADO)
===================================================

Actualizado para usar permisos basados en rol en lugar de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, ClassroomUser
from app.models.institution import Institution
from app.services.license_service import require_active_license  # Mantener por compatibilidad

router = APIRouter(prefix="/classrooms", tags=["Aulas y Grupos"])


# ── Esquemas ────────────────────────────────────────────────────────────────

class ClassroomCreate(BaseModel):
    name: str
    subject_area: Optional[str] = None
    grade: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None

class ClassroomResponse(BaseModel):
    id: int
    name: str
    subject_area: Optional[str]
    grade: Optional[str]
    academic_year: Optional[str]
    description: Optional[str]
    teacher_id: int
    teacher_name: str
    student_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    subject_area: Optional[str] = None
    grade: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ClassroomUserResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    role: str  # student, teacher, etc.
    joined_at: datetime
    is_active: bool


# ── Funciones de ayuda ───────────────────────────────────────────────────────

def _require_classroom_access(user: User) -> None:
    """Valida si el usuario tiene acceso al módulo de aulas basado en su rol."""
    # Aulas está disponible para profesores, super profesores y admins
    if user.role not in {UserRole.SUPER_PROFESOR.value, UserRole.PROFESOR.value, UserRole.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para acceder a la gestión de aulas."
        )


def _get_user_institution_id(user: User, db: Session) -> Optional[int]:
    """Obtiene el ID de la institución del usuario."""
    return getattr(user, "institution_id", None)


def _can_manage_classroom(user: User, classroom: Classroom, db: Session) -> bool:
    """Verifica si el usuario puede gestionar un aula específica."""
    if user.role == UserRole.ADMIN.value:
        return True
    if user.role == UserRole.SUPER_PROFESOR.value:
        # Super profesor puede gestionar aulas de su institución
        return classroom.institution_id == getattr(user, "institution_id", None)
    if user.role == UserRole.PROFESOR.value:
        # Profesor solo puede gestionar sus propias aulas
        return classroom.teacher_id == user.id
    return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_classrooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    include_inactive: bool = Query(False, description="Incluir aulas inactivas")
):
    """
    Lista las aulas accesibles para el usuario según su rol.
    """
    _require_classroom_access(current_user)
    
    institution_id = _get_user_institution_id(current_user, db)
    if not institution_id:
        return []

    # Construir consulta base
    query = db.query(Classroom).filter(Classroom.institution_id == institution_id)
    
    if not include_inactive:
        query = query.filter(Classroom.is_active == True)
    
    # Filtrar según el rol
    if current_user.role == UserRole.PROFESOR.value:
        # Profesor solo ve sus propias aulas
        query = query.filter(Classroom.teacher_id == current_user.id)
    # Super Profesor y Admin ven todas las aulas de su institución
    # (ya filtrado por institution_id arriba)
    
    classrooms = query.all()
    
    results = []
    for classroom in classrooms:
        # Contar estudiantes activos
        student_count = db.query(ClassroomUser).filter(
            ClassroomUser.classroom_id == classroom.id,
            ClassroomUser.role == "student",
            ClassroomUser.is_active == True
        ).count()
        
        # Obtener nombre del profesor
        teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
        teacher_name = f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username if teacher else ""
        
        results.append(ClassroomResponse(
            id=classroom.id,
            name=classroom.name,
            subject_area=classroom.subject_area,
            grade=classroom.grade,
            academic_year=classroom.academic_year,
            description=classroom.description,
            teacher_id=classroom.teacher_id,
            teacher_name=teacher_name,
            student_count=student_count,
            is_active=classroom.is_active,
            created_at=classroom.created_at,
            updated_at=classroom.updated_at
        ))
    
    return results


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_classroom(
    classroom_data: ClassroomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Crea una nueva aula.
    """
    _require_classroom_access(current_user)
    
    institution_id = _get_user_institution_id(current_user, db)
    if not institution_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Usuario no asociado a ninguna institución."
        )
    
    # Solo super profesores, profesores y admins pueden crear aulas
    if current_user.role not in {UserRole.SUPER_PROFESOR.value, UserRole.PROFESOR.value, UserRole.ADMIN.value}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permisos para crear aulas."
        )
    
    # Validar que el usuario pueda crear aulas en la institución
    if current_user.role == UserRole.PROFESOR.value:
        # Los profesores crean aulas en su nombre
        pass
    elif current_user.role == UserRole.SUPER_PROFESOR.value:
        # Los super profesores crean aulas en su institución
        pass
    elif current_user.role == UserRole.ADMIN.value:
        # Los admins pueden crear aulas en cualquier institución (pero normalmente en su institución)
        pass
    
    # Crear el aula
    classroom = Classroom(
        name=classroom_data.name,
        subject_area=classroom_data.subject_area,
        grade=classroom_data.grade,
        academic_year=classroom_data.academic_year,
        description=classroom_data.description,
        teacher_id=current_user.id if current_user.role == UserRole.PROFESOR.value else None,
        institution_id=institution_id,
        is_active=True
    )
    
    # Para super profesores y admins, necesitamos especificar un profesor
    # En un sistema real, esto vendría en los datos de entrada o se asignaría después
    if classroom.teacher_id is None:
        # Asignar al creador como profesor temporalmente
        classroom.teacher_id = current_user.id
    
    db.add(classroom)
    db.commit()
    db.refresh(classroom)
    
    # Obtener nombre del profesor
    teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
    teacher_name = f"{teacher.first_name} {teacher.last_name}".strip() or teacher.username if teacher else ""
    
    return ClassroomResponse(
        id=classroom.id,
        name=classroom.name,
        subject_area=classroom.subject_area,
        grade=classroom.grade,
        academic_year=classroom.academic_year,
        description=classroom.description,
        teacher_id=classroom.teacher_id,
        teacher_name=teacher_name,
        student_count=0,
        is_active=classroom.is_active,
        created_at=classroom.created_at,
        updated_at=classroom.updated_at
    )


# Los demás endpoints (get, put, delete, etc.) seguirían un patrón similar...

# Mantener funciones de compatibilidad pero simplificadas
def _require_classroom_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    _require_classroom_access(user)