"""
NeuroLearn AI - Servicio de licencias (MODIFICADO)
==================================================

Este archivo ha sido modificado para eliminar el sistema de licencias.
Ahora delega todos los permisos al servicio de permisos basado en roles.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.institution import Institution
from app.models.user import User
from app.api.auth import get_current_user
from app.services.permission_service import (
    features_for_user,
    get_modules_for_role,
    get_features_for_user,
    TEACHER_LIMITS,
    STUDENT_LIMITS,
    NEUROBOT_LIMITS,
    GROUP_LIMITS,
    EXPORT_FORMATS,
    TEACHER_DASHBOARD_KPIS,
    _module_feature,
    MODULE_ALIASES,
)


# ============================================================================
# FUNCIONALIDADES DE SOLO LECTURA (mantener por compatibilidad)
# ============================================================================

READONLY_FEATURES: Set[str] = {
    "perfil",
    "dashboard",
    "mensajes",
    "calendario",
    "recursos",
    "basic_analytics",
}


READONLY_MODULES: Dict[str, Set[str]] = {
    "teacher": {
        "dashboard",
        "cursos",
        "recursos",
        "calendario",
        "mensajes",
        "perfil",
        "estadisticas",
    },
    "student": {
        "inicio",
        "mis_cursos",
        "recursos",
        "calendario",
        "mensajes",
        "perfil",
        "estadisticas",
    },
    "super": {
        "dashboard",
        "reportes",
        "mensajeria",
        "calendario",
        "perfil",
    },
}


# ============================================================================
# CACHE DE INSTITUCIONES (mantener por compatibilidad, pero simplificado)
# ============================================================================

_INSTITUTION_CACHE: Dict[
    int,
    tuple[float, Institution],
] = {}

_CACHE_TTL_SECONDS = 30


def _invalidate_institution_cache(institution_id: Optional[int] = None) -> None:
    """
    Invalida el cache de instituciones.
    """
    if institution_id is None:
        _INSTITUTION_CACHE.clear()
        return

    _INSTITUTION_CACHE.pop(institution_id, None)


def _get_cached_institution(institution_id: int, db: Session) -> Optional[Institution]:
    """
    Obtiene una institución desde cache o DB.
    """
    import time

    now = time.time()
    cached = _INSTITUTION_CACHE.get(institution_id)

    if cached:
        timestamp, institution = cached
        if now - timestamp < _CACHE_TTL_SECONDS:
            return institution
        _INSTITUTION_CACHE.pop(institution_id, None)

    institution = (
        db.query(Institution)
        .filter(Institution.id == institution_id)
        .first()
    )

    if institution:
        _INSTITUTION_CACHE[institution_id] = (now, institution)

    return institution


# ============================================================================
# FECHAS DE LICENCIA (simplificado - siempre activo)
# ============================================================================

def _effective_expiry(institution: Institution) -> Optional[datetime]:
    """
    Siempre devuelve None (sin vencimiento) ya que eliminamos las licencias.
    """
    return None


def _resolve_license_state(institution: Institution) -> tuple[str, Optional[int]]:
    """
    Siempre devuelve activo y sin días de vencimiento.
    """
    if not institution.is_active:
        return "suspended", None
    
    # Siempre activo, sin vencimiento
    return "active", None


# ============================================================================
# LICENSE INFO
# ============================================================================

class LicenseInfo:
    """
    Representa la licencia efectiva del usuario autenticado.
    MODIFICADO: Ahora basada en roles, no en licencias.
    """

    def __init__(
        self,
        *,
        license_type: str,
        license_status: str,
        days_left: Optional[int],
        role: str,
        features: List[str],
        super_modules: List[str],
        teacher_modules: List[str],
        student_modules: List[str],
        teacher_dashboard_kpis: List[str],
        neurobot_limit: int,
        groups_limit: int,
        students_limit: int,
        teachers_limit: int,
        export_formats: List[str],
        institution_name: str,
        institution_id: Optional[int] = None,
    ):

        self.license_type = license_type
        self.license_status = license_status
        self.days_left = days_left
        self.role = role
        self.features = sorted(set(features))
        self.super_modules = sorted(set(super_modules))
        self.teacher_modules = sorted(set(teacher_modules))
        self.student_modules = sorted(set(student_modules))
        self.teacher_dashboard_kpis = sorted(set(teacher_dashboard_kpis))
        self.neurobot_limit = neurobot_limit
        self.groups_limit = groups_limit
        self.students_limit = students_limit
        self.teachers_limit = teachers_limit
        self.export_formats = sorted(set(export_formats))
        self.institution_name = institution_name
        self.institution_id = institution_id

    # ========================================================================
    # ESTADO
    # ========================================================================

    @property
    def is_active(self) -> bool:
        return self.license_status in {"active", "expiring_soon"}

    @property
    def is_expired(self) -> bool:
        return self.license_status == "expired"

    @property
    def is_suspended(self) -> bool:
        return self.license_status == "suspended"

    # ========================================================================
    # FUNCIONALIDADES EFECTIVAS
    # ========================================================================

    def effective_features(self) -> Set[str]:
        """
        Devuelve las funcionalidades realmente disponibles.
        Ahora todas las características son efectivas si el rol las tiene.
        """
        if self.is_suspended:
            return set()
        
        if self.is_expired:
            # En vencido, solo características de solo lectura
            return set(self.features).intersection(READONLY_FEATURES)
        
        return set(self.features)

    # ========================================================================
    # VERIFICAR FUNCIONALIDAD
    # ========================================================================

    def has_feature(self, feature: str) -> bool:
        feature = _module_feature(feature)
        if not feature:
            return False
        return feature in self.effective_features()

    # ========================================================================
    # VERIFICAR MÓDULO PROFESOR
    # ========================================================================

    def has_teacher_module(self, module: str) -> bool:
        # El rol SIEMPRE debe ser profesor.
        if self.role != "profesor":
            return False
        
        if self.is_suspended:
            return False
        
        module = (module or "").strip().lower()
        
        if self.is_expired:
            return module in READONLY_MODULES["teacher"]
        
        return self.has_feature(_module_feature(module))

    # ========================================================================
    # VERIFICAR MÓDULO ESTUDIANTE
    # ========================================================================

    def has_student_module(self, module: str) -> bool:
        # El rol SIEMPRE debe ser estudiante.
        if self.role != "estudiante":
            return False
        
        if self.is_suspended:
            return False
        
        module = (module or "").strip().lower()
        
        if self.is_expired:
            return module in READONLY_MODULES["student"]
        
        return self.has_feature(_module_feature(module))

    # ========================================================================
    # VERIFICAR MÓDULO SUPER PROFESOR
    # ========================================================================

    def has_super_module(self, module: str) -> bool:
        # El rol SIEMPRE debe ser super_profesor.
        if self.role != "super_profesor":
            return False
        
        if self.is_suspended:
            return False
        
        module = (module or "").strip().lower()
        
        if self.is_expired:
            return module in READONLY_MODULES["super"]
        
        return self.has_feature(_module_feature(module))

    # ========================================================================
    # KPI
    # ========================================================================

    def has_kpi(self, kpi: str) -> bool:
        if not self.is_active:
            return False
        return kpi in self.teacher_dashboard_kpis

    # ========================================================================
    # EXPORTACIONES
    # ========================================================================

    def has_export(self, export_format: str) -> bool:
        if not self.is_active:
            return False
        
        export_format = (export_format or "").strip().lower()
        return export_format in {item.lower() for item in self.export_formats}

    # ========================================================================
    # API
    # ========================================================================

    def to_dict(self) -> Dict[str, Any]:
        """
        Serializa la licencia para el frontend.
        """
        effective_features = sorted(self.effective_features())

        # MÓDULOS
        if self.is_active:
            effective_teacher_modules = self.teacher_modules
            effective_student_modules = self.student_modules
            effective_super_modules = self.super_modules
        elif self.is_expired:
            if self.role == "profesor":
                effective_teacher_modules = sorted(READONLY_MODULES["teacher"])
                effective_student_modules = []
                effective_super_modules = []
            elif self.role == "estudiante":
                effective_teacher_modules = []
                effective_student_modules = sorted(READONLY_MODULES["student"])
                effective_super_modules = []
            elif self.role == "super_profesor":
                effective_teacher_modules = []
                effective_student_modules = []
                effective_super_modules = sorted(READONLY_MODULES["super"])
            else:
                effective_teacher_modules = []
                effective_student_modules = []
                effective_super_modules = []
        else:
            effective_teacher_modules = []
            effective_student_modules = []
            effective_super_modules = []

        # LÍMITES Y EXPORTACIONES
        if self.is_active:
            neurobot_limit = self.neurobot_limit
            groups_limit = self.groups_limit
            students_limit = self.students_limit
            teachers_limit = self.teachers_limit
            export_formats = self.export_formats
        else:
            neurobot_limit = 0
            groups_limit = 0
            students_limit = 0
            teachers_limit = 0
            export_formats = []

        # RESPUESTA
        return {
            "license_type": self.license_type,
            "license_status": self.license_status,
            "days_left": self.days_left,
            "role": self.role,
            "features": effective_features,
            "super_modules": effective_super_modules,
            "teacher_modules": effective_teacher_modules,
            "student_modules": effective_student_modules,
            "teacher_dashboard_kpis": self.teacher_dashboard_kpis if self.is_active else [],
            "neurobot_limit": neurobot_limit,
            "groups_limit": groups_limit,
            "students_limit": students_limit,
            "teachers_limit": teachers_limit,
            "export_formats": export_formats,
            "institution_name": self.institution_name,
            "institution_id": self.institution_id,
        }


# ============================================================================
# LICENCIA POR DEFECTO
# ============================================================================

def _default_license_for_user(user: User) -> LicenseInfo:
    """
    Usuario sin institución.
    Asignamos licencia activa con permisos basados en rol.
    """
    return LicenseInfo(
        license_type="basica",  # Mantener para compatibilidad pero sin significado
        license_status="active",
        days_left=None,  # Sin vencimiento
        role=user.role,
        features=features_for_user(user.role),
        super_modules=get_modules_for_role("super_profesor", user.role),
        teacher_modules=get_modules_for_role("profesor", user.role),
        student_modules=get_modules_for_role("estudiante", user.role),
        teacher_dashboard_kpis=TEACHER_DASHBOARD_KPIS["basica"],
        neurobot_limit=NEUROBOT_LIMITS["basica"],
        groups_limit=GROUP_LIMITS["basica"],
        students_limit=STUDENT_LIMITS["basica"],
        teachers_limit=TEACHER_LIMITS["basica"],
        export_formats=EXPORT_FORMATS["basica"],
        institution_name="Sin institución",
        institution_id=None,
    )


# ============================================================================
# OBTENER LICENCIA
# ============================================================================

def get_license_for_user(user: User, db: Session) -> LicenseInfo:
    """
    Obtiene la licencia efectiva del usuario.
    MODIFICADO: Ahora basada en roles, no en licencias institucionales.
    """
    try:
        return _get_license_for_user_inner(user, db)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No fue posible consultar la información institucional.",
        ) from exc


def _get_license_for_user_inner(user: User, db: Session) -> LicenseInfo:
    role = (
        getattr(user, "role", "")
        or ""
    ).strip().lower()

    # ========================================================================
    # ADMIN
    # ========================================================================

    if role == "admin":
        all_features = sorted(FEATURE_ROLES.keys())
        return LicenseInfo(
            license_type="basica",
            license_status="active",
            days_left=None,
            role="admin",
            features=all_features,
            super_modules=get_modules_for_role("super_profesor", "basica"),
            teacher_modules=get_modules_for_role("profesor", "basica"),
            student_modules=get_modules_for_role("estudiante", "basica"),
            teacher_dashboard_kpis=TEACHER_DASHBOARD_KPIS["basica"],
            neurobot_limit=NEUROBOT_LIMITS["basica"],
            groups_limit=GROUP_LIMITS["basica"],
            students_limit=STUDENT_LIMITS["basica"],
            teachers_limit=TEACHER_LIMITS["basica"],
            export_formats=EXPORT_FORMATS["basica"],
            institution_name="Administración",
            institution_id=None,
        )

    # ========================================================================
    # USUARIO SIN INSTITUCIÓN
    # ========================================================================

    institution_id = getattr(user, "institution_id", None)
    if institution_id is None:
        return _default_license_for_user(user)

    # ========================================================================
    # BUSCAR INSTITUCIÓN
    # ========================================================================

    institution = _get_cached_institution(institution_id, db)
    if institution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La institución asociada al usuario no existe.",
        )

    # ========================================================================
    # PLAN - IGNORADO (ya no usamos license_type para permisos)
    # ========================================================================

    # Obtener el license_type real de la institución (para mantener en la respuesta)
    # Pero no lo usamos para determinar permisos
    plan = (
        getattr(institution, "license_type", None)
        or ""
    ).strip().lower()
    
    # Si no hay license_type o está vacío, usar "basica" por defecto para el campo
    if not plan:
        plan = "basica"

    # ========================================================================
    # ESTADO DE LICENCIA (siempre activo ahora)
    # ========================================================================

    license_status, days_left = _resolve_license_state(institution)
    # Forzar siempre activo ya que eliminamos las restricciones de licencia
    license_status = "active"
    days_left = None  # Sin vencimiento

    # ========================================================================
    # FUNCIONALIDADES (basadas en rol, no en licencia)
    # ========================================================================

    features = features_for_user(role)

    # ========================================================================
    # MÓDULOS
    # ========================================================================

    teacher_modules = get_modules_for_role("profesor", role)
    student_modules = get_modules_for_role("estudiante", role)
    super_modules = get_modules_for_role("super_profesor", role)

    # ========================================================================
    # KPIs
    # ========================================================================

    teacher_dashboard_kpis = TEACHER_DASHBOARD_KPIS["basica"]

    # ========================================================================
    # LICENCIA FINAL
    # ========================================================================

    return LicenseInfo(
        license_type=plan,  # Mantener el license_type real de la institución en la respuesta
        license_status=license_status,
        days_left=days_left,
        role=role,
        features=features,
        super_modules=super_modules,
        teacher_modules=teacher_modules,
        student_modules=student_modules,
        teacher_dashboard_kpis=teacher_dashboard_kpis,
        neurobot_limit=NEUROBOT_LIMITS["basica"],
        groups_limit=GROUP_LIMITS["basica"],
        students_limit=STUDENT_LIMITS["basica"],
        teachers_limit=TEACHER_LIMITS["basica"],
        export_formats=EXPORT_FORMATS["basica"],
        institution_name=institution.name,
        institution_id=institution.id,
    )


# ============================================================================
# DEPENDENCIA GENERAL DE LICENCIA
# ============================================================================

def get_license(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LicenseInfo:
    """
    Dependencia para obtener la licencia del usuario autenticado.
    """
    return get_license_for_user(current_user, db)


# ============================================================================
# DEPENDENCIA DE FUNCIONALIDAD
# ============================================================================

def require_feature(feature: str) -> Callable:
    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> LicenseInfo:
        license_info = get_license_for_user(current_user, db)
        if not license_info.has_feature(feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"La funcionalidad '{feature}' no está disponible para tu rol.",
            )
        return license_info
    return dependency


# ============================================================================
# DEPENDENCIA DE MÓDULO PROFESOR
# ============================================================================

def require_teacher_module(module: str) -> Callable:
    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> LicenseInfo:
        license_info = get_license_for_user(current_user, db)
        if not license_info.has_teacher_module(module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El módulo '{module}' no está disponible para tu rol.",
            )
        return license_info
    return dependency


# ============================================================================
# DEPENDENCIA DE MÓDULO ESTUDIANTE
# ============================================================================

def require_student_module(module: str) -> Callable:
    def dependency(
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> LicenseInfo:
        license_info = get_license_for_user(current_user, db)
        if not license_info.has_student_module(module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El módulo '{module}' no está disponible para tu rol.",
            )
        return license_info
    return dependency


# ============================================================================
# LICENCIA ACTIVA
# ============================================================================

def require_active_license(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LicenseInfo:
    license_info = get_license_for_user(current_user, db)
    if not license_info.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La licencia no está activa. Esta operación requiere una licencia vigente.",
        )
    return license_info


# ============================================================================
# ACCESO AL CHAT DE IA
# ============================================================================

def require_chat_access(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LicenseInfo:
    role = (
        getattr(current_user, "role", "")
        or ""
    ).strip().lower()

    if role == "admin":
        return get_license_for_user(current_user, db)

    if role == "estudiante":
        required_feature = "tutor_ia"
    elif role in {"profesor", "super_profesor"}:
        required_feature = "teacher_ai"
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol del usuario no permite utilizar el chat.",
        )

    license_info = get_license_for_user(current_user, db)
    if not license_info.has_feature(required_feature):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"El acceso al asistente de IA no está disponible para tu rol.",
        )
    return license_info


# ============================================================================
# INVALIDACIÓN MANUAL DEL CACHE
# ============================================================================

def invalidate_license_cache(institution_id: Optional[int] = None) -> None:
    """
    Debe llamarse cuando se modifica:
    - license_type
    - is_active
    - expiry_date
    """
    _invalidate_institution_cache(institution_id)