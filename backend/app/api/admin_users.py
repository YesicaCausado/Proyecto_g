"""
NeuroLearn AI - API de Administración de Usuarios
=================================================

Administración global del sistema.

El sistema YA NO utiliza licencias.
El acceso a módulos y funcionalidades depende únicamente
del rol y de la lógica actual de la aplicación.
"""

import secrets
import string
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, text
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, get_password_hash
from app.core.config import settings
from app.db.database import get_db
from app.models.institution import AuditLog, Institution
from app.models.user import User, UserRole
from app.services.account_purge import purge
from app.schemas.schemas import (
    AdminStats,
    CredentialItem,
    InstitutionCreate,
    InstitutionResponse,
    UserUpdate,
)


router = APIRouter(
    prefix="/admin",
    tags=["Administración"],
)


# ============================================================================
# DEPENDENCIAS
# ============================================================================

def _require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Verifica que el usuario autenticado tenga rol ADMIN.
    """

    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requiere rol de administrador para esta operación.",
        )

    return current_user


# ============================================================================
# GESTIÓN DE USUARIOS
# ============================================================================

def _user_row(user: User) -> dict:
    """Serializa los campos consumidos por el panel de administración."""
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name or "",
        "email": user.email or "",
        "role": user.role,
        "is_active": user.is_active,
        "institution_name": user.institution.name if user.institution else "",
        "institution_id": user.institution_id,
        "document_type": user.document_type or "",
        "document_number": user.document_number or "",
        "created_at": user.created_at,
        "last_login": user.last_login,
        "must_change_password": user.must_change_password,
    }


def _temporary_password() -> str:
    """Genera una contraseña temporal que cumple la política de autenticación."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    required = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    value = required + [secrets.choice(alphabet) for _ in range(8)]
    secrets.SystemRandom().shuffle(value)
    return "".join(value)


@router.get("/users")
async def list_users_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None, max_length=100),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    query = db.query(User)
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            User.username.ilike(search_term)
            | User.email.ilike(search_term)
            | User.full_name.ilike(search_term)
        )
    if role:
        query = query.filter(User.role == role)
    if is_active is not None:
        query = query.filter(User.is_active.is_(is_active))

    total = query.count()
    users = (
        query.order_by(desc(User.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {"users": [_user_row(user) for user in users], "total": total}


@router.patch("/users/{user_id}")
async def update_user_admin(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    if user.id == current_user.id and payload.is_active is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes desactivar tu propia cuenta.")

    changes = payload.model_dump(exclude_unset=True)
    if "email" in changes and changes["email"] != user.email:
        duplicate = db.query(User).filter(User.email == changes["email"], User.id != user.id).first()
        if duplicate:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="El correo ya está registrado.")
    for field, value in changes.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return _user_row(user)


@router.post("/users/{user_id}/reset-password")
async def reset_user_password_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    temporary_password = _temporary_password()
    user.hashed_password = get_password_hash(temporary_password)
    user.must_change_password = True
    db.commit()
    return {"temp_password": temporary_password}


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_admin(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
    if user.id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puedes eliminar tu propia cuenta.")
    if user.role not in (UserRole.PROFESOR.value, UserRole.ESTUDIANTE.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se pueden eliminar usuarios con rol profesor o estudiante.",
        )

    # Borra al usuario y sus datos dependientes según las FK reales de la BD.
    # La auditoría se conserva (sus FK son SET NULL).
    purge(db, "users", [user.id])
    db.commit()


# ============================================================================
# ESTADÍSTICAS
# ============================================================================

@router.get(
    "/stats",
    response_model=AdminStats,
)
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene estadísticas generales del sistema.

    Las estadísticas relacionadas con licencias fueron eliminadas.
    """

    _require_admin(current_user)

    # ------------------------------------------------------------------------
    # Usuarios por rol
    # ------------------------------------------------------------------------

    role_counts = {}

    for role in UserRole:
        count = (
            db.query(User)
            .filter(User.role == role.value)
            .count()
        )

        role_counts[role.value] = count

    # ------------------------------------------------------------------------
    # Instituciones
    # ------------------------------------------------------------------------

    total_institutions = (
        db.query(Institution)
        .count()
    )

    active_institutions = (
        db.query(Institution)
        .filter(Institution.is_active.is_(True))
        .count()
    )

    # ------------------------------------------------------------------------
    # Respuesta
    # ------------------------------------------------------------------------

    return AdminStats(
        total_institutions=total_institutions,
        active_institutions=active_institutions,

        total_super_profesores=role_counts.get(
            UserRole.SUPER_PROFESOR.value,
            0,
        ),

        total_profesores=role_counts.get(
            UserRole.PROFESOR.value,
            0,
        ),

        total_estudiantes=role_counts.get(
            UserRole.ESTUDIANTE.value,
            0,
        ),

        total_admins=role_counts.get(
            UserRole.ADMIN.value,
            0,
        ),
    )


# ============================================================================
# LISTAR INSTITUCIONES
# ============================================================================

@router.get(
    "/institutions",
)
async def list_institutions_admin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    is_active: Optional[bool] = Query(
        None,
        description="Filtrar por estado activo/inactivo.",
    ),
    search: Optional[str] = Query(
        None,
        description="Buscar por nombre o código DANE.",
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
):
    """
    Lista las instituciones registradas en el sistema.

    Ya no existe filtro por tipo de licencia.
    """

    _require_admin(current_user)

    query = db.query(Institution)

    # ------------------------------------------------------------------------
    # Filtro por estado
    # ------------------------------------------------------------------------

    if is_active is not None:
        query = query.filter(
            Institution.is_active == is_active
        )

    # ------------------------------------------------------------------------
    # Búsqueda
    # ------------------------------------------------------------------------

    if search:
        search_term = f"%{search}%"

        query = query.filter(
            Institution.name.ilike(search_term)
            | Institution.dane_code.ilike(search_term)
        )

    # ------------------------------------------------------------------------
    # Paginación
    # ------------------------------------------------------------------------

    total = query.count()
    institutions = query.order_by(desc(Institution.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    # ------------------------------------------------------------------------
    # Respuesta
    # ------------------------------------------------------------------------

    results = []
    for institution in institutions:
        teachers_count = db.query(User).filter(
            User.institution_id == institution.id,
            User.role == UserRole.PROFESOR.value,
        ).count()
        students_count = db.query(User).filter(
            User.institution_id == institution.id,
            User.role == UserRole.ESTUDIANTE.value,
        ).count()
        results.append({
            "id": institution.id,
            "name": institution.name,
            "dane_code": institution.dane_code,
            "is_active": institution.is_active,
            "created_at": institution.created_at,
            "teachers_count": teachers_count,
            "students_count": students_count,
        })

    return {
        "institutions": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/audit-logs")
async def list_audit_logs_admin(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: Optional[str] = Query(None, max_length=100),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action.strip()}%"))
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at < date_to + timedelta(days=1))

    total = query.count()
    logs = query.order_by(desc(AuditLog.created_at)).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "logs": [
            {
                "id": log.id,
                "action": log.action,
                "performed_by": log.performed_by.full_name if log.performed_by else "",
                "performed_by_id": log.performed_by_id,
                "target_user": log.target_user.full_name if log.target_user else "",
                "target_user_id": log.target_user_id,
                "institution_name": log.institution.name if log.institution else "",
                "institution_id": log.institution_id,
                "user_type": log.user_type or "",
                "ip_address": log.ip_address or "",
                "notes": log.notes or "",
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


# ============================================================================
# CREAR INSTITUCIÓN
# ============================================================================

@router.post(
    "/institutions",
    response_model=InstitutionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_institution_admin(
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva institución y su Super Profesor.
    """

    _require_admin(current_user)

    # ------------------------------------------------------------------------
    # Verificar código DANE
    # ------------------------------------------------------------------------

    existing = (
        db.query(Institution)
        .filter(
            Institution.dane_code == payload.dane_code
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código DANE ya está registrado por otra institución.",
        )

    # ------------------------------------------------------------------------
    # Crear institución
    # ------------------------------------------------------------------------

    institution = Institution(
        name=payload.name,
        dane_code=payload.dane_code,
        created_by=current_user.id,
    )

    db.add(institution)
    db.flush()

    # ------------------------------------------------------------------------
    # Generar credenciales del Super Profesor
    # ------------------------------------------------------------------------

    sp_username = payload.sp_document_number
    sp_password = Institution._generate_temp_password()

    sp_user = User(
        username=sp_username,
        email=payload.sp_email,
        full_name=payload.sp_full_name,
        role=UserRole.SUPER_PROFESOR.value,
        hashed_password=get_password_hash(sp_password),
        institution_id=institution.id,
        is_active=True,
    )

    db.add(sp_user)
    db.flush()

    # ------------------------------------------------------------------------
    # Credenciales
    # ------------------------------------------------------------------------

    credential = CredentialItem(
        full_name=sp_user.full_name,
        username=sp_user.username,
        temp_password=sp_password,
        role=sp_user.role,
    )

    # ------------------------------------------------------------------------
    # Enviar credenciales por correo
    # ------------------------------------------------------------------------

    try:
        from app.services.email_service import send_credentials_email

        send_credentials_email(
            to_email=sp_user.email,
            credential=credential,
            institution_name=institution.name,
        )

    except Exception:
        # El fallo del correo NO debe impedir la creación
        # de la institución.
        pass

    # ------------------------------------------------------------------------
    # Guardar
    # ------------------------------------------------------------------------

    db.commit()

    db.refresh(institution)
    db.refresh(sp_user)

    # ------------------------------------------------------------------------
    # Respuesta
    # ------------------------------------------------------------------------

    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=credential,
    )


# ============================================================================
# ACTUALIZAR INSTITUCIÓN
# ============================================================================

@router.put(
    "/institutions/{institution_id}",
    response_model=InstitutionResponse,
)
async def update_institution_admin(
    institution_id: int,
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza los datos básicos de una institución.
    """

    _require_admin(current_user)

    institution = (
        db.query(Institution)
        .filter(
            Institution.id == institution_id
        )
        .first()
    )

    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada.",
        )

    # ------------------------------------------------------------------------
    # Verificar que el nuevo DANE no pertenezca a otra institución
    # ------------------------------------------------------------------------

    duplicate = (
        db.query(Institution)
        .filter(
            Institution.dane_code == payload.dane_code,
            Institution.id != institution_id,
        )
        .first()
    )

    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código DANE ya está registrado por otra institución.",
        )

    # ------------------------------------------------------------------------
    # Actualizar
    # ------------------------------------------------------------------------

    institution.name = payload.name
    institution.dane_code = payload.dane_code

    db.commit()
    db.refresh(institution)

    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=None,
    )


class InstitutionPatchPayload(BaseModel):
    """Campos que el panel puede actualizar sin recrear la institución."""

    name: Optional[str] = Field(None, min_length=2, max_length=200)
    dane_code: Optional[str] = Field(None, min_length=3, max_length=20)
    is_active: Optional[bool] = None


@router.patch(
    "/institutions/{institution_id}",
)
async def patch_institution_admin(
    institution_id: int,
    payload: InstitutionPatchPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Actualiza parcialmente una institución, incluida su activación."""

    _require_admin(current_user)
    institution = db.query(Institution).filter(Institution.id == institution_id).first()
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada.",
        )

    changes = payload.model_dump(exclude_unset=True)
    if "dane_code" in changes:
        duplicate = (
            db.query(Institution)
            .filter(
                Institution.dane_code == changes["dane_code"],
                Institution.id != institution_id,
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código DANE ya está registrado por otra institución.",
            )

    for field_name, value in changes.items():
        setattr(institution, field_name, value)
    db.commit()
    db.refresh(institution)

    return {
        "id": institution.id,
        "name": institution.name,
        "dane_code": institution.dane_code,
        "is_active": institution.is_active,
        "created_at": institution.created_at,
    }


# ============================================================================
# CONFIGURACIÓN DEL SISTEMA
# ============================================================================

@router.get("/config")
async def admin_get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Devuelve la configuración global del sistema.

    IMPORTANTE:
    Ya no devuelve información relacionada con licencias.
    """

    _require_admin(current_user)

    from app.services.mail.factory import is_email_configured
    import os

    # ------------------------------------------------------------------------
    # Estadísticas
    # ------------------------------------------------------------------------

    total_users = (
        db.query(User)
        .count()
    )

    active_users = (
        db.query(User)
        .filter(User.is_active.is_(True))
        .count()
    )

    total_institutions = (
        db.query(Institution)
        .count()
    )

    # ------------------------------------------------------------------------
    # Estado de la base de datos
    # ------------------------------------------------------------------------

    db_connected = True

    try:
        db.execute(text("SELECT 1"))

    except Exception:
        db_connected = False

    # ------------------------------------------------------------------------
    # Proveedores de IA
    # ------------------------------------------------------------------------

    ai_providers = []

    if os.getenv("GROQ_API_KEY"):
        ai_providers.append(
            {
                "name": "Groq",
                "model": settings.GROQ_MODEL,
                "active": True,
            }
        )

    if os.getenv("GEMINI_API_KEY"):
        ai_providers.append(
            {
                "name": "Gemini",
                "model": settings.GEMINI_MODEL,
                "active": True,
            }
        )

    if os.getenv("OPENAI_API_KEY"):
        ai_providers.append(
            {
                "name": "OpenAI",
                "model": "gpt-4o-mini",
                "active": True,
            }
        )

    if not ai_providers:
        ai_providers.append(
            {
                "name": "Sin proveedor configurado",
                "model": "—",
                "active": False,
            }
        )

    # ------------------------------------------------------------------------
    # Respuesta
    # ------------------------------------------------------------------------

    return {
        # Sistema
        "app_name": settings.APP_NAME,
        "app_version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "debug_mode": settings.DEBUG,

        # Base de datos
        "db_connected": db_connected,
        "db_url_configured": bool(settings.DATABASE_URL),

        # Seguridad
        "token_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
        "algorithm": settings.ALGORITHM,

        # Email
        "email_configured": is_email_configured(),
        "email_provider": settings.EMAIL_PROVIDER,
        "email_from": settings.EMAIL_FROM,

        # IA
        "ai_providers": ai_providers,

        # Estadísticas
        "total_users": total_users,
        "active_users": active_users,
        "total_institutions": total_institutions,
    }


# ============================================================================
# ELIMINAR INSTITUCIÓN
# ============================================================================

@router.delete(
    "/institutions/{institution_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_institution_admin(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una institución y sus usuarios asociados.
    """

    _require_admin(current_user)

    institution = (
        db.query(Institution)
        .filter(
            Institution.id == institution_id
        )
        .first()
    )

    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada.",
        )

    # Usuarios de la institución y todos sus datos, según las FK reales de
    # la BD (antes un DELETE masivo de users fallaba en PostgreSQL por FK).
    purge(db, "institutions", [institution.id])
    db.commit()

    return None