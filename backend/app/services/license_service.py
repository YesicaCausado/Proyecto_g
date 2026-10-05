"""
NeuroLearn AI - Servicio central de licencias
==============================================

Reglas:
- PRO contiene todas las funcionalidades.
- PREMIUM es un subconjunto de PRO.
- BÁSICA es un subconjunto de PREMIUM.
- El backend es la fuente de verdad.
- El frontend solo debe reflejar estas reglas.
- Una licencia vencida solo permite funcionalidades de lectura.
- Una licencia suspendida no permite funcionalidades.
- Un usuario institucional sin licencia válida queda bloqueado.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Set

from fastapi import Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.institution import Institution
from app.models.user import User


# ============================================================================
# CONFIGURACIÓN GENERAL
# ============================================================================

PLANS = ("basica", "premium", "pro")

ALL_ROLES = (
    "super_profesor",
    "profesor",
    "estudiante",
    "admin",
)

LICENSE_DURATION_DAYS = 365


# ============================================================================
# LÍMITES POR PLAN
# ============================================================================
#
# PRO es el plan completo.
# Los valores muy altos representan "sin límite práctico".
# ============================================================================

TEACHER_LIMITS: Dict[str, int] = {
    "basica": 20,
    "premium": 60,
    "pro": 9999,
}

STUDENT_LIMITS: Dict[str, int] = {
    "basica": 300,
    "premium": 1500,
    "pro": 999999,
}

NEUROBOT_LIMITS: Dict[str, int] = {
    "basica": 0,
    "premium": 10,
    "pro": 999999,
}

GROUP_LIMITS: Dict[str, int] = {
    "basica": 10,
    "premium": 30,
    "pro": 999999,
}

EXPORT_FORMATS: Dict[str, List[str]] = {
    "basica": ["csv"],
    "premium": ["csv", "pdf", "excel"],
    "pro": ["csv", "pdf", "excel"],
}


# ============================================================================
# KPIs POR PLAN
# ============================================================================

TEACHER_DASHBOARD_KPIS: Dict[str, List[str]] = {
    "basica": [
        "cursos_activos",
        "estudiantes",
        "evaluaciones_creadas",
        "actividades_pendientes",
    ],
    "premium": [
        "cursos_activos",
        "estudiantes",
        "evaluaciones_creadas",
        "actividades_pendientes",
        "neurobots_creados",
        "uso_ia",
        "promedio_academico",
        "participacion",
        "estudiantes_riesgo",
    ],
    "pro": [
        "cursos_activos",
        "estudiantes",
        "evaluaciones_creadas",
        "actividades_pendientes",
        "neurobots_creados",
        "uso_ia",
        "promedio_academico",
        "participacion",
        "estudiantes_riesgo",
        "estado_licencia",
        "consumo_ia",
        "usuarios_activos",
        "riesgo_academico",
        "prediccion_abandono",
    ],
}


# ============================================================================
# MATRIZ CENTRAL DE FUNCIONALIDADES
# ============================================================================
#
# Esta es la fuente principal de funcionalidades.
#
# La lógica es:
#
# PRO      = todas las funcionalidades
# PREMIUM  = funcionalidades de PRO menos las exclusivas de PRO
# BÁSICA   = funcionalidades de PREMIUM menos las exclusivas de PREMIUM
#
# No se crean matrices independientes para cada plan.
# ============================================================================

FEATURE_MATRIX: Dict[str, Dict[str, Set[str]]] = {

    # ------------------------------------------------------------------------
    # FUNCIONES TRANSVERSALES
    # ------------------------------------------------------------------------

    "perfil": {
        "basica": {"super_profesor", "profesor", "estudiante"},
        "premium": {"super_profesor", "profesor", "estudiante"},
        "pro": {"super_profesor", "profesor", "estudiante"},
    },

    "mensajes": {
        "basica": {"super_profesor", "profesor", "estudiante"},
        "premium": {"super_profesor", "profesor", "estudiante"},
        "pro": {"super_profesor", "profesor", "estudiante"},
    },

    "calendario": {
        "basica": {"super_profesor", "profesor", "estudiante"},
        "premium": {"super_profesor", "profesor", "estudiante"},
        "pro": {"super_profesor", "profesor", "estudiante"},
    },

    # ------------------------------------------------------------------------
    # SUPER PROFESOR
    # ------------------------------------------------------------------------

    "configuracion": {
        "basica": {"super_profesor"},
        "premium": {"super_profesor"},
        "pro": {"super_profesor"},
    },

    "licencia": {
        "basica": {"super_profesor"},
        "premium": {"super_profesor"},
        "pro": {"super_profesor"},
    },

    "gestion_profesores": {
        "basica": {"super_profesor"},
        "premium": {"super_profesor"},
        "pro": {"super_profesor"},
    },

    "gestion_estudiantes": {
        "basica": {"super_profesor"},
        "premium": {"super_profesor"},
        "pro": {"super_profesor"},
    },

    "gestion_grupos": {
        "basica": {"super_profesor", "profesor"},
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    # ------------------------------------------------------------------------
    # DASHBOARD Y ANALÍTICA
    # ------------------------------------------------------------------------

    "dashboard": {
        "basica": {"super_profesor", "profesor", "estudiante"},
        "premium": {"super_profesor", "profesor", "estudiante"},
        "pro": {"super_profesor", "profesor", "estudiante"},
    },

    "basic_analytics": {
        "basica": {"super_profesor", "profesor", "estudiante"},
        "premium": {"super_profesor", "profesor", "estudiante"},
        "pro": {"super_profesor", "profesor", "estudiante"},
    },

    "advanced_analytics": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    "predictive_analytics": {
        "basica": set(),
        "premium": set(),
        "pro": {"super_profesor", "profesor"},
    },

    "groups_compare": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    "risk_indicators": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    # ------------------------------------------------------------------------
    # CONTENIDO ACADÉMICO
    # ------------------------------------------------------------------------

    "recursos": {
        "basica": {"profesor", "estudiante"},
        "premium": {"profesor", "estudiante"},
        "pro": {"profesor", "estudiante"},
    },

    "evaluaciones": {
        "basica": {"profesor", "estudiante"},
        "premium": {"profesor", "estudiante"},
        "pro": {"profesor", "estudiante"},
    },

    "tareas": {
        "basica": {"estudiante"},
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "anuncios": {
        "basica": {"profesor"},
        "premium": {"profesor"},
        "pro": {"profesor"},
    },

    # ------------------------------------------------------------------------
    # NEUROBOTS / NEUROALERTAS
    # ------------------------------------------------------------------------

    "neurobots": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    "neurobots_advanced": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    "neuroalertas": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    # ------------------------------------------------------------------------
    # NEURODIGITAL
    # ------------------------------------------------------------------------

    "neurodigital": {
        "basica": set(),
        "premium": {"profesor", "estudiante"},
        "pro": {"profesor", "estudiante"},
    },

    # ------------------------------------------------------------------------
    # REPORTES
    # ------------------------------------------------------------------------

    "reportes": {
        "basica": set(),
        "premium": {"super_profesor", "profesor"},
        "pro": {"super_profesor", "profesor"},
    },

    "reportes_avanzados": {
        "basica": set(),
        "premium": set(),
        "pro": {"super_profesor", "profesor"},
    },

    # ------------------------------------------------------------------------
    # IA PARA ESTUDIANTES
    # ------------------------------------------------------------------------

    "tutor_ia": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "tutor_ia_adaptive": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "chat_history": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "recommendations": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "adaptive_feedback": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "difficulty_detection": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "skill_tracking": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "learning_analytics": {
        "basica": set(),
        "premium": {"estudiante"},
        "pro": {"estudiante"},
    },

    "tutor_ia_advanced": {
        "basica": set(),
        "premium": set(),
        "pro": {"estudiante"},
    },

    "personal_reports": {
        "basica": set(),
        "premium": set(),
        "pro": {"estudiante"},
    },

    "personal_analytics": {
        "basica": set(),
        "premium": set(),
        "pro": {"estudiante"},
    },

    "personalized_plans": {
        "basica": set(),
        "premium": set(),
        "pro": {"estudiante"},
    },

    # ------------------------------------------------------------------------
    # IA PARA PROFESORES
    # ------------------------------------------------------------------------

    "teacher_ai": {
        "basica": set(),
        "premium": {"profesor"},
        "pro": {"profesor"},
    },

    # ------------------------------------------------------------------------
    # AUTOMATIZACIÓN / INTEGRACIONES
    # ------------------------------------------------------------------------

    "automation": {
        "basica": set(),
        "premium": set(),
        "pro": {"super_profesor", "profesor"},
    },

    "integrations": {
        "basica": set(),
        "premium": set(),
        "pro": {"super_profesor", "profesor"},
    },
}


# ============================================================================
# ALIAS DE MÓDULOS
# ============================================================================
#
# Se mantienen para no romper el frontend existente.
# ============================================================================

MODULE_ALIASES: Dict[str, str] = {
    "inicio": "dashboard",
    "mis_cursos": "dashboard",
    "estadisticas": "basic_analytics",
    "cursos": "dashboard",
    "grupos": "gestion_grupos",
    "estudiantes": "gestion_estudiantes",
    "profesores": "gestion_profesores",
    "recursos": "recursos",
    "evaluaciones": "evaluaciones",
    "tareas": "tareas",
    "mensajes": "mensajes",
    "mensajeria": "mensajes",
    "calendario": "calendario",
    "perfil": "perfil",
    "reportes": "reportes",
    "licencia": "licencia",
    "configuracion": "configuracion",
    "neurobots": "neurobots",
    "neuroalertas": "neuroalertas",
    "neurodigital": "neurodigital",
}


def _module_feature(module: str) -> str:
    """
    Convierte un nombre de módulo frontend a la funcionalidad real.
    Si no existe alias, se utiliza el mismo nombre.
    """
    return MODULE_ALIASES.get(module, module)


# ============================================================================
# GENERACIÓN DE FUNCIONALIDADES
# ============================================================================

def features_for_user(
    role: str,
    license_type: str,
) -> List[str]:
    """
    Devuelve las funcionalidades permitidas para un rol y plan.

    PRO funciona como conjunto completo.
    PREMIUM y BÁSICA se restringen mediante FEATURE_MATRIX.
    """

    role = (role or "").lower()
    license_type = (license_type or "").lower()

    if role == "admin":
        return sorted(FEATURE_MATRIX.keys())

    if role not in ALL_ROLES:
        return []

    if license_type not in PLANS:
        return []

    features: List[str] = []

    for feature, plans in FEATURE_MATRIX.items():
        allowed_roles = plans.get(license_type, set())

        if role in allowed_roles:
            features.append(feature)

    return sorted(features)


# ============================================================================
# GENERACIÓN DE MÓDULOS COMPATIBLES
# ============================================================================

def _modules_for_role(
    role: str,
    license_type: str,
) -> List[str]:
    """
    Genera los módulos que puede utilizar un rol.

    Se mantienen los nombres antiguos para compatibilidad con el frontend.
    """

    features = set(features_for_user(role, license_type))
    modules: Set[str] = set()

    for module, feature in MODULE_ALIASES.items():
        if feature in features:
            modules.add(module)

    return sorted(modules)


# ============================================================================
# DICCIONARIOS DE COMPATIBILIDAD
# ============================================================================

TEACHER_MODULES: Dict[str, List[str]] = {
    plan: _modules_for_role("profesor", plan)
    for plan in PLANS
}

STUDENT_MODULES: Dict[str, List[str]] = {
    plan: _modules_for_role("estudiante", plan)
    for plan in PLANS
}

SUPER_MODULES: Dict[str, List[str]] = {
    plan: _modules_for_role("super_profesor", plan)
    for plan in PLANS
}


# ============================================================================
# FUNCIONES DE ESTADO
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
# CACHE DE INSTITUCIONES
# ============================================================================

_INSTITUTION_CACHE: Dict[
    int,
    tuple[float, Institution],
] = {}

_CACHE_TTL_SECONDS = 30


def _invalidate_institution_cache(
    institution_id: Optional[int] = None,
) -> None:
    """
    Invalida el cache.

    Si institution_id es None, limpia todo.
    """

    if institution_id is None:
        _INSTITUTION_CACHE.clear()
        return

    _INSTITUTION_CACHE.pop(institution_id, None)


def _get_cached_institution(
    institution_id: int,
    db: Session,
) -> Optional[Institution]:
    """
    Obtiene una institución del cache o de la base de datos.
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
        _INSTITUTION_CACHE[institution_id] = (
            now,
            institution,
        )

    return institution


# ============================================================================
# FECHAS DE LICENCIA
# ============================================================================

def _effective_expiry(
    institution: Institution,
) -> Optional[datetime]:
    """
    Devuelve la fecha efectiva de vencimiento.

    IMPORTANTE:
    Si expiry_date es None, se interpreta como SIN VENCIMIENTO.

    Si quieres una licencia anual, la creación de la institución
    debe guardar explícitamente expiry_date.
    """

    if institution.expiry_date is not None:
        expiry = institution.expiry_date

        if expiry.tzinfo is None:
            return expiry.replace(tzinfo=timezone.utc)

        return expiry

    return None


def _resolve_license_state(
    institution: Institution,
) -> tuple[str, Optional[int]]:
    """
    Devuelve:

        active
        expiring_soon
        expired
        suspended

    junto con los días restantes.
    """

    if not institution.is_active:
        return "suspended", None

    expiry = _effective_expiry(institution)

    # None = sin vencimiento
    if expiry is None:
        return "active", None

    now = datetime.now(timezone.utc)

    if expiry <= now:
        return "expired", 0

    seconds_left = (expiry - now).total_seconds()

    days_left = max(
        1,
        int(seconds_left / 86400),
    )

    if days_left <= 30:
        return "expiring_soon", days_left

    return "active", days_left


# ============================================================================
# LICENCE INFO
# ============================================================================

class LicenseInfo:
    """
    Objeto central que representa la licencia efectiva del usuario.
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

        self.teacher_dashboard_kpis = sorted(
            set(teacher_dashboard_kpis)
        )

        self.neurobot_limit = neurobot_limit
        self.groups_limit = groups_limit
        self.students_limit = students_limit
        self.teachers_limit = teachers_limit

        self.export_formats = sorted(
            set(export_formats)
        )

        self.institution_name = institution_name
        self.institution_id = institution_id

    # ------------------------------------------------------------------------
    # Estado
    # ------------------------------------------------------------------------

    @property
    def is_active(self) -> bool:
        return self.license_status in {
            "active",
            "expiring_soon",
        }

    @property
    def is_expired(self) -> bool:
        return self.license_status == "expired"

    @property
    def is_suspended(self) -> bool:
        return self.license_status == "suspended"

    # ------------------------------------------------------------------------
    # Funcionalidades efectivas
    # ------------------------------------------------------------------------

    def effective_features(self) -> Set[str]:
        """
        Funcionalidades realmente disponibles según el estado.

        active / expiring_soon:
            funcionalidades normales del plan.

        expired:
            solamente lectura.

        suspended:
            ninguna.
        """

        if self.is_suspended:
            return set()

        if self.is_expired:
            return self.features.intersection(
                READONLY_FEATURES
            )

        return set(self.features)

    # ------------------------------------------------------------------------
    # Verificar funcionalidad
    # ------------------------------------------------------------------------

    def has_feature(
        self,
        feature: str,
    ) -> bool:

        if not feature:
            return False

        feature = _module_feature(feature)

        return feature in self.effective_features()

    # ------------------------------------------------------------------------
    # Verificar módulos
    # ------------------------------------------------------------------------

    def has_teacher_module(
        self,
        module: str,
    ) -> bool:

        if self.is_suspended:
            return False

        if self.is_expired:
            return module in READONLY_MODULES["teacher"]

        return (
            self.role == "profesor"
            and self.has_feature(
                _module_feature(module)
            )
        )

    def has_student_module(
        self,
        module: str,
    ) -> bool:

        if self.is_suspended:
            return False

        if self.is_expired:
            return module in READONLY_MODULES["student"]

        return (
            self.role == "estudiante"
            and self.has_feature(
                _module_feature(module)
            )
        )

    def has_super_module(
        self,
        module: str,
    ) -> bool:

        if self.is_suspended:
            return False

        if self.is_expired:
            return module in READONLY_MODULES["super"]

        return (
            self.role == "super_profesor"
            and self.has_feature(
                _module_feature(module)
            )
        )

    # ------------------------------------------------------------------------
    # KPI
    # ------------------------------------------------------------------------

    def has_kpi(
        self,
        kpi: str,
    ) -> bool:

        if not self.is_active:
            return False

        return kpi in self.teacher_dashboard_kpis

    # ------------------------------------------------------------------------
    # Exportaciones
    # ------------------------------------------------------------------------

    def has_export(
        self,
        export_format: str,
    ) -> bool:

        if not self.is_active:
            return False

        return (
            export_format.lower()
            in {
                item.lower()
                for item in self.export_formats
            }
        )

    # ------------------------------------------------------------------------
    # Diccionario para API
    # ------------------------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """
        Convierte la licencia en el formato que consume el frontend.

        IMPORTANTE:
        No se envían las funcionalidades originales cuando la licencia
        está vencida o suspendida.

        Así evitamos que el frontend crea que tiene permisos que el
        backend realmente no le concede.
        """

        effective_features = sorted(
            self.effective_features()
        )

        effective_teacher_modules = (
            self.teacher_modules
            if self.is_active
            else sorted(
                READONLY_MODULES["teacher"]
            )
            if self.is_expired
            else []
        )

        effective_student_modules = (
            self.student_modules
            if self.is_active
            else sorted(
                READONLY_MODULES["student"]
            )
            if self.is_expired
            else []
        )

        effective_super_modules = (
            self.super_modules
            if self.is_active
            else sorted(
                READONLY_MODULES["super"]
            )
            if self.is_expired
            else []
        )

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

        return {
            "license_type": self.license_type,
            "license_status": self.license_status,
            "days_left": self.days_left,

            "role": self.role,

            "features": effective_features,

            "super_modules": effective_super_modules,
            "teacher_modules": effective_teacher_modules,
            "student_modules": effective_student_modules,

            "teacher_dashboard_kpis": (
                self.teacher_dashboard_kpis
                if self.is_active
                else []
            ),

            "neurobot_limit": neurobot_limit,
            "groups_limit": groups_limit,
            "students_limit": students_limit,
            "teachers_limit": teachers_limit,

            "export_formats": export_formats,

            "institution_name": self.institution_name,
            "institution_id": self.institution_id,
        }


# ============================================================================
# LICENCIA POR DEFECTO PARA USUARIOS SIN INSTITUCIÓN
# ============================================================================

def _default_license_for_user(
    user: User,
) -> LicenseInfo:
    """
    Usuario sin institución.

    NO se asigna una Básica artificial.

    Se devuelve una licencia suspendida y sin permisos.
    """

    return LicenseInfo(
        license_type="basica",
        license_status="suspended",
        days_left=None,

        role=user.role,

        features=[],

        super_modules=[],
        teacher_modules=[],
        student_modules=[],

        teacher_dashboard_kpis=[],

        neurobot_limit=0,
        groups_limit=0,
        students_limit=0,
        teachers_limit=0,

        export_formats=[],

        institution_name="Sin institución",
        institution_id=None,
    )


# ============================================================================
# OBTENER LICENCIA DEL USUARIO
# ============================================================================

def get_license_for_user(
    user: User,
    db: Session,
) -> LicenseInfo:
    """
    Obtiene la licencia efectiva del usuario.

    Los errores de base de datos se convierten en HTTP 503.
    """

    try:
        return _get_license_for_user_inner(
            user,
            db,
        )

    except HTTPException:
        raise

    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No fue posible consultar la licencia.",
        ) from exc


def _get_license_for_user_inner(
    user: User,
    db: Session,
) -> LicenseInfo:

    role = (
        getattr(user, "role", "")
        or ""
    ).lower()

    # ========================================================================
    # ADMIN
    # ========================================================================

    if role == "admin":

        all_features = sorted(
            FEATURE_MATRIX.keys()
        )

        return LicenseInfo(
            license_type="pro",
            license_status="active",
            days_left=None,

            role="admin",

            features=all_features,

            super_modules=_modules_for_role(
                "super_profesor",
                "pro",
            ),

            teacher_modules=_modules_for_role(
                "profesor",
                "pro",
            ),

            student_modules=_modules_for_role(
                "estudiante",
                "pro",
            ),

            teacher_dashboard_kpis=(
                TEACHER_DASHBOARD_KPIS["pro"]
            ),

            neurobot_limit=NEUROBOT_LIMITS["pro"],
            groups_limit=GROUP_LIMITS["pro"],
            students_limit=STUDENT_LIMITS["pro"],
            teachers_limit=TEACHER_LIMITS["pro"],

            export_formats=EXPORT_FORMATS["pro"],

            institution_name="Administración",
            institution_id=None,
        )

    # ========================================================================
    # USUARIO SIN INSTITUCIÓN
    # ========================================================================

    institution_id = getattr(
        user,
        "institution_id",
        None,
    )

    if institution_id is None:
        return _default_license_for_user(user)

    # ========================================================================
    # INSTITUCIÓN
    # ========================================================================

    institution = _get_cached_institution(
        institution_id,
        db,
    )

    if institution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La institución asociada al usuario no existe.",
        )

    plan = (
        getattr(
            institution,
            "license_type",
            None,
        )
        or ""
    ).lower()

    # ------------------------------------------------------------------------
    # Plan inválido
    # ------------------------------------------------------------------------
    #
    # No hacemos downgrade silencioso a Básica.
    # Si la base de datos tiene un plan inválido, se bloquea.
    # ------------------------------------------------------------------------

    if plan not in PLANS:
        return LicenseInfo(
            license_type="basica",
            license_status="suspended",
            days_left=None,

            role=role,

            features=[],

            super_modules=[],
            teacher_modules=[],
            student_modules=[],

            teacher_dashboard_kpis=[],

            neurobot_limit=0,
            groups_limit=0,
            students_limit=0,
            teachers_limit=0,

            export_formats=[],

            institution_name=institution.name,
            institution_id=institution.id,
        )

    # ========================================================================
    # ESTADO
    # ========================================================================

    license_status, days_left = _resolve_license_state(
        institution
    )

    # ========================================================================
    # FUNCIONALIDADES
    # ========================================================================

    features = features_for_user(
        role,
        plan,
    )

    # ========================================================================
    # MÓDULOS
    # ========================================================================

    teacher_modules = _modules_for_role(
        "profesor",
        plan,
    )

    student_modules = _modules_for_role(
        "estudiante",
        plan,
    )

    super_modules = _modules_for_role(
        "super_profesor",
        plan,
    )

    # ========================================================================
    # KPIs
    # ========================================================================

    teacher_dashboard_kpis = (
        TEACHER_DASHBOARD_KPIS.get(
            plan,
            [],
        )
    )

    # ========================================================================
    # LÍMITES
    # ========================================================================

    return LicenseInfo(
        license_type=plan,
        license_status=license_status,
        days_left=days_left,

        role=role,

        features=features,

        super_modules=super_modules,
        teacher_modules=teacher_modules,
        student_modules=student_modules,

        teacher_dashboard_kpis=teacher_dashboard_kpis,

        neurobot_limit=NEUROBOT_LIMITS[plan],
        groups_limit=GROUP_LIMITS[plan],
        students_limit=STUDENT_LIMITS[plan],
        teachers_limit=TEACHER_LIMITS[plan],

        export_formats=EXPORT_FORMATS[plan],

        institution_name=institution.name,
        institution_id=institution.id,
    )


# ============================================================================
# DEPENDENCIA GENERAL DE LICENCIA
# ============================================================================

def get_license(
    current_user: User = Depends(...),
    db: Session = Depends(get_db),
) -> LicenseInfo:
    """
    Dependencia para obtener la licencia del usuario actual.

    NOTA:
    El proyecto puede reemplazar Depends(...) por la dependencia
    real de autenticación que ya tenga implementada.
    """

    return get_license_for_user(
        current_user,
        db,
    )


# ============================================================================
# DEPENDENCIA DE FUNCIONALIDAD
# ============================================================================

def require_feature(
    feature: str,
) -> Callable:

    def dependency(
        current_user: User = Depends(...),
        db: Session = Depends(get_db),
    ) -> LicenseInfo:

        license_info = get_license_for_user(
            current_user,
            db,
        )

        if not license_info.has_feature(feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"La funcionalidad '{feature}' "
                    f"no está disponible para tu licencia."
                ),
            )

        return license_info

    return dependency


# ============================================================================
# DEPENDENCIA DE MÓDULO PROFESOR
# ============================================================================

def require_teacher_module(
    module: str,
) -> Callable:

    def dependency(
        current_user: User = Depends(...),
        db: Session = Depends(get_db),
    ) -> LicenseInfo:

        license_info = get_license_for_user(
            current_user,
            db,
        )

        if not license_info.has_teacher_module(
            module
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"El módulo '{module}' "
                    "no está disponible."
                ),
            )

        return license_info

    return dependency


# ============================================================================
# DEPENDENCIA DE MÓDULO ESTUDIANTE
# ============================================================================

def require_student_module(
    module: str,
) -> Callable:

    def dependency(
        current_user: User = Depends(...),
        db: Session = Depends(get_db),
    ) -> LicenseInfo:

        license_info = get_license_for_user(
            current_user,
            db,
        )

        if not license_info.has_student_module(
            module
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"El módulo '{module}' "
                    "no está disponible."
                ),
            )

        return license_info

    return dependency


# ============================================================================
# LICENCIA ACTIVA
# ============================================================================

def require_active_license(
    current_user: User = Depends(...),
    db: Session = Depends(get_db),
) -> LicenseInfo:

    license_info = get_license_for_user(
        current_user,
        db,
    )

    if not license_info.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "La licencia no está activa. "
                "Esta operación requiere una licencia vigente."
            ),
        )

    return license_info


# ============================================================================
# ACCESO AL CHAT DE IA
# ============================================================================

def require_chat_access(
    current_user: User = Depends(...),
    db: Session = Depends(get_db),
) -> LicenseInfo:

    role = (
        getattr(
            current_user,
            "role",
            "",
        )
        or ""
    ).lower()

    # Admin tiene acceso administrativo.
    if role == "admin":
        return get_license_for_user(
            current_user,
            db,
        )

    if role == "estudiante":
        required_feature = "tutor_ia"

    elif role in {
        "profesor",
        "super_profesor",
    }:
        required_feature = "teacher_ai"

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="El rol del usuario no permite utilizar el chat.",
        )

    license_info = get_license_for_user(
        current_user,
        db,
    )

    if not license_info.has_feature(
        required_feature
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "El acceso al asistente de IA "
                "no está disponible para tu licencia."
            ),
        )

    return license_info


# ============================================================================
# INVALIDACIÓN MANUAL DEL CACHE
# ============================================================================

def invalidate_license_cache(
    institution_id: Optional[int] = None,
) -> None:
    """
    Debe llamarse cuando se modifica:

    - license_type
    - is_active
    - expiry_date

    de una institución.
    """

    _invalidate_institution_cache(
        institution_id
    )