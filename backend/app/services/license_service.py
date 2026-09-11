"""
NeuroLearn AI — License Service
================================
Servicio centralizado para validar tipo y estado de licencia institucional.
Toda la lógica de permisos de módulos pasa por este archivo.
"""
from __future__ import annotations

import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.institution import Institution

# ─────────────────────────────────────────────────────────────────────────────
# Caché TTL de instituciones (evita 1 query a Postgres por petición)
# -----------------------------------------------------------------------------
# Cada endpoint autenticado dispara get_current_user (1 query) + get_license
# (1 query a institutions). La licencia/institucion cambia muy poco, así que
# cacheamos el objeto Institution por institution_id durante un TTL corto.
# El estado suspenso/vencido se sigue respetando porque la caché expira y se
# revalida en cada ventana TTL (además _resolve_license_state se recalcula
# SIEMPRE con la fecha actual, por lo que el vencimiento no queda "congelado").
# ─────────────────────────────────────────────────────────────────────────────
_INSTITUTION_CACHE: dict[int, tuple[float, Institution]] = {}
_INSTITUTION_CACHE_LOCK = threading.Lock()
_INSTITUTION_CACHE_TTL = float(__import__("os").getenv("LICENSE_CACHE_TTL_SECONDS", "30"))


def _get_cached_institution(institution_id: int) -> Optional[Institution]:
    """Devuelve la Institution cacheada si aún no expiró su TTL."""
    with _INSTITUTION_CACHE_LOCK:
        entry = _INSTITUTION_CACHE.get(institution_id)
        if entry is None:
            return None
        ts, institution = entry
        if time.monotonic() - ts > _INSTITUTION_CACHE_TTL:
            _INSTITUTION_CACHE.pop(institution_id, None)
            return None
        return institution


def _cache_institution(institution: Institution) -> None:
    """Guarda la Institution en caché; borra la entrada si se convierte en None."""
    if institution is None:
        return
    with _INSTITUTION_CACHE_LOCK:
        _INSTITUTION_CACHE[institution.id] = (time.monotonic(), institution)


def _invalidate_institution_cache(institution_id: int) -> None:
    """Invalida el caché cuando cambia el estado de la institución."""
    with _INSTITUTION_CACHE_LOCK:
        _INSTITUTION_CACHE.pop(institution_id, None)

# ─────────────────────────────────────────────────────────────────────────────
# LICENCIA ANUAL
# Cada plan es ANUAL: la vigencia dura 365 días desde la fecha de inicio
# (institution.created_at). Si existe una fecha de vencimiento explícita
# (institution.expiry_date), ésta prevalece; en caso contrario la licencia
# vence automáticamente un año después de su creación y cada día se resta uno.
# ─────────────────────────────────────────────────────────────────────────────
LICENSE_DURATION_DAYS = 365


# ─────────────────────────────────────────────────────────────────────────────
# 1. MATRIZ DE FUNCIONALIDADES (ÚNICA FUENTE DE VERDAD)
#
# φ(feature, plan) = conjunto de ROLES que la tienen disponible en ese plan.
#
# Reglas:
#   - Los planes son ACUMULATIVOS: premium hereda básica, pro hereda premium.
#   - El ACCESO final = (rol tiene permiso a la feature) AND (la licencia de la
#     institución la incluye). Ambas condiciones deben ser ciertas.
#   - ADMIN es un rol administrativo independiente de la licencia institucional:
#     no participa de esta matriz (acceso global, gestionado aparte).
#   - Funcionalidades TRANSVERSALES (perfil, configuracion, mensajes,
#     autenticación/logout) están en los 3 planes para los 3 roles.
#
# Nombres de feature canónicos (usan el mismo vocabulario en frontend y backend):
#   dashboard, basic_analytics, advanced_analytics, predictive_analytics,
#   neurobots, neurobots_advanced, neuroalertas, neurodigital, risk_indicators,
#   reportes, reportes_avanzados, automation, integrations, groups_compare,
#   personalized_plans, tutor_ia, tutor_ia_adaptive, tutor_ia_advanced,
#   chat_history, recommendations, adaptive_feedback, difficulty_detection,
#   skill_tracking, personal_reports, learning_analytics, personal_analytics,
#   perfil, configuracion, mensajes,
#   calendario, recursos, evaluaciones, tareas, anuncios, licencia.
# ─────────────────────────────────────────────────────────────────────────────

ALL_ROLES = ("super_profesor", "profesor", "estudiante")

# feature → {plan: [roles]}
FEATURE_MATRIX: dict[str, dict[str, list[str]]] = {
    # ── Transversales (los 3 planes, los 3 roles) ──
    "perfil":          {"basica": list(ALL_ROLES), "premium": list(ALL_ROLES), "pro": list(ALL_ROLES)},
    "configuracion":   {"basica": list(ALL_ROLES), "premium": list(ALL_ROLES), "pro": list(ALL_ROLES)},
    "mensajes":        {"basica": list(ALL_ROLES), "premium": list(ALL_ROLES), "pro": list(ALL_ROLES)},
    "calendario":      {"basica": list(ALL_ROLES), "premium": list(ALL_ROLES), "pro": list(ALL_ROLES)},

    # ── Comunes por rol (presentes en los 3 planes) ──
    "dashboard":       {"basica": ["super_profesor", "profesor", "estudiante"], "premium": ["super_profesor", "profesor", "estudiante"], "pro": ["super_profesor", "profesor", "estudiante"]},
    "recursos":        {"basica": ["profesor", "estudiante"], "premium": ["profesor", "estudiante"], "pro": ["profesor", "estudiante"]},
    "evaluaciones":    {"basica": ["profesor", "estudiante"], "premium": ["profesor", "estudiante"], "pro": ["profesor", "estudiante"]},
    "tareas":          {"basica": ["estudiante"], "premium": ["estudiante"], "pro": ["estudiante"]},
    "anuncios":        {"basica": ["profesor"], "premium": ["profesor"], "pro": ["profesor"]},
    "licencia":        {"basica": ["super_profesor"], "premium": ["super_profesor"], "pro": ["super_profesor"]},

    # ── Gestión institucional (Súper Profesor) ──
    "gestion_profesores": {"basica": ["super_profesor"], "premium": ["super_profesor"], "pro": ["super_profesor"]},
    "gestion_estudiantes": {"basica": ["super_profesor"], "premium": ["super_profesor"], "pro": ["super_profesor"]},
    "gestion_grupos":     {"basica": ["super_profesor"], "premium": ["super_profesor"], "pro": ["super_profesor"]},

    # ── Analítica / estadísticas (acumulativo) ──
    "basic_analytics":       {"basica": ["super_profesor", "profesor", "estudiante"], "premium": ["super_profesor", "profesor", "estudiante"], "pro": ["super_profesor", "profesor", "estudiante"]},
    "advanced_analytics":    {"basica": [], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},
    "predictive_analytics":  {"basica": [], "premium": [], "pro": ["super_profesor", "profesor"]},
    "groups_compare":        {"basica": [], "premium": [], "pro": ["super_profesor", "profesor"]},

    # ── NeuroBots ──
    "neurobots":          {"basica": ["super_profesor", "profesor"], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},
    "neurobots_advanced": {"basica": [], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},

    # ── NeuroAlertas / riesgo ──
    "neuroalertas":     {"basica": [], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},
    "risk_indicators":  {"basica": [], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},

    # ── Neurodigital (análisis conductual en tiempo real) ──
    "neurodigital":     {"basica": [], "premium": ["profesor", "estudiante"], "pro": ["profesor", "estudiante"]},

    # ── Reportes ──
    # La licencia Básica expone SOLO 6 reportes básicos (export CSV). Los 2
    # reportes comparativos (mensual y anual) son exclusivos Premium+ y, junto
    # con los PDF/Excel, quedan detrás de "reportes_avanzados". El frontend
    # (ReportesTab) aplica la misma regla: 6 básicos en Básica, 8 en Premium/Pro.
    "reportes":          {"basica": ["super_profesor", "profesor"], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},
    "reportes_avanzados":{"basica": [], "premium": ["super_profesor", "profesor"], "pro": ["super_profesor", "profesor"]},

    # ── IA / tutoría ──
    "tutor_ia":             {"basica": ["estudiante"], "premium": ["estudiante"], "pro": ["estudiante"]},
    "tutor_ia_adaptive":    {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "tutor_ia_advanced":    {"basica": [], "premium": [], "pro": ["estudiante"]},
    "chat_history":         {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "recommendations":      {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "adaptive_feedback":    {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "difficulty_detection": {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "skill_tracking":       {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "personal_reports":     {"basica": [], "premium": [], "pro": ["estudiante"]},

    # ── Análisis del aprendizaje del estudiante ──
    "learning_analytics":   {"basica": [], "premium": ["estudiante"], "pro": ["estudiante"]},
    "personal_analytics":   {"basica": [], "premium": [], "pro": ["estudiante"]},

    # ── IA docente (contenido generativo) ──
    "teacher_ai":        {"basica": [], "premium": ["profesor"], "pro": ["profesor"]},

    # ── Pro: automatizaciones / integraciones ──
    "automation":        {"basica": [], "premium": [], "pro": ["super_profesor", "profesor"]},
    "integrations":      {"basica": [], "premium": ["profesor", "super_profesor"], "pro": ["profesor", "super_profesor"]},
    "personalized_plans":{"basica": [], "premium": [], "pro": ["estudiante"]},
}


def has_feature(role: str, license_type: str, feature: str) -> bool:
    """
    Comprueba acceso a una funcionalidad según ROL + LICENCIA.

    Devuelve True solo si:
      1. el rol está habilitado para esa feature, Y
      2. el plan de la institución la incluye.

    La matriz FEATURE_MATRIX ya enumera, para cada feature, los roles de cada
    plan con el modelo ACUMULATIVO aplicado (premium incluye los roles de
    básica, pro incluye los de premium). Por eso basta una consulta exacta al
    plan del usuario.
    """
    if role == "admin":
        # Admin es independiente de la licencia institucional.
        return True
    entry = FEATURE_MATRIX.get(feature)
    if entry is None:
        return False
    roles = entry.get(license_type) or entry.get("basica") or []
    return role in roles


def features_for_user(role: str, license_type: str) -> list[str]:
    """Lista de features disponibles para un rol + plan determinados."""
    return sorted(f for f in FEATURE_MATRIX if has_feature(role, license_type, f))


# ─────────────────────────────────────────────────────────────────────────────
# 2. Módulos por plan y rol (derivados de FEATURE_MATRIX por compatibilidad)
#    Mantenidos como listas explícitas para que los endpoints existentes que
#    usan require_teacher_module / require_student_module sigan funcionando.
# ─────────────────────────────────────────────────────────────────────────────

TEACHER_MODULES: dict[str, list[str]] = {
    "basica": [
        "dashboard", "cursos", "grupos", "estudiantes",
        "evaluaciones", "recursos", "calendario", "mensajes",
        "perfil",
    ],
    "premium": [
        "dashboard", "cursos", "grupos", "estudiantes",
        "evaluaciones", "recursos", "calendario", "mensajes",
        "perfil",
        # ── exclusivos Premium ──
        "ia", "neurobots", "alertas", "reportes", "analitica", "banco_preguntas",
    ],
    "pro": [
        "dashboard", "cursos", "grupos", "estudiantes",
        "evaluaciones", "recursos", "calendario", "mensajes",
        "perfil",
        # ── exclusivos Premium ──
        "ia", "neurobots", "alertas", "reportes", "analitica", "banco_preguntas",
        # ── exclusivos Pro ──
        "integraciones", "automatizaciones", "configuracion",
    ],
}

STUDENT_MODULES: dict[str, list[str]] = {
    "basica": [
        "inicio", "mis_cursos", "mis_tareas", "evaluaciones",
        "recursos", "calendario", "mensajes", "perfil",
        "tutor_ia", "estadisticas",
    ],
    "premium": [
        "inicio", "mis_cursos", "mis_tareas", "evaluaciones",
        "recursos", "calendario", "mensajes", "perfil",
        "tutor_ia", "estadisticas",
        # ── exclusivos Premium ──
        "resumenes_ia", "generador_preguntas", "recomendaciones",
        "certificados", "progreso",
    ],
    "pro": [
        "inicio", "mis_cursos", "mis_tareas", "evaluaciones",
        "recursos", "calendario", "mensajes", "perfil",
        "tutor_ia", "estadisticas",
        # ── exclusivos Premium ──
        "resumenes_ia", "generador_preguntas", "recomendaciones",
        "certificados", "progreso",
        # ── exclusivos Pro ──
        "chat_ia", "mapas_mentales", "generador_ejercicios",
        "planes_personalizados", "biblioteca_premium",
        "gamificacion", "analitica_personal", "objetivos", "asistente",
    ],
}

# Módulos del panel del Súper Profesor (Rector) por licencia — acumulativo.
# Alineado con FEATURE_MATRIX: el Súper Profesor BÁSICO ya tiene NeuroBots
# (básicos) y Reportes (básicos); NeuroAlertas/alertas es exclusivo Premium+.
# "perfil" es común y está siempre presente.
SUPER_MODULES: dict[str, list[str]] = {
    "basica": [
        "dashboard", "profesores", "estudiantes", "grupos",
        "neurobots", "reportes",
        "mensajeria", "calendario", "auditoria",
        "configuracion", "licencia", "seguridad", "perfil",
    ],
    "premium": [
        "dashboard", "profesores", "estudiantes", "grupos",
        "neurobots", "reportes",
        "mensajeria", "calendario", "auditoria",
        "configuracion", "licencia", "seguridad", "perfil",
        # ── exclusivos Premium ──
        "alertas",
    ],
    "pro": [
        "dashboard", "profesores", "estudiantes", "grupos",
        "neurobots", "reportes",
        "mensajeria", "calendario", "auditoria",
        "configuracion", "licencia", "seguridad", "perfil",
        # ── exclusivos Premium ──
        "alertas",
    ],
}

# KPI cards visibles en el Dashboard del profesor por licencia — acumulativo.
TEACHER_DASHBOARD_KPIS: dict[str, list[str]] = {
    "basica": [
        "cursos_activos", "estudiantes", "evaluaciones_creadas",
        "actividades_pendientes",
    ],
    "premium": [
        "cursos_activos", "estudiantes", "evaluaciones_creadas",
        "actividades_pendientes",
        "neurobots_creados", "uso_ia",
        "promedio_academico", "participacion", "estudiantes_riesgo",
    ],
    "pro": [
        "cursos_activos", "estudiantes", "evaluaciones_creadas",
        "actividades_pendientes",
        "neurobots_creados", "uso_ia",
        "promedio_academico", "participacion", "estudiantes_riesgo",
        "estado_licencia", "consumo_ia", "usuarios_activos",
        "riesgo_academico", "prediccion_abandono",
    ],
}

# ── Límites de recursos por plan (única fuente de verdad) ─────────────────────
TEACHER_LIMITS: dict[str, int] = {
    "basica":  20,
    "premium": 60,
    "pro":     9999,
}

STUDENT_LIMITS: dict[str, int] = {
    "basica":  300,
    "premium": 1500,
    "pro":     999_999,
}

# Límite de NeuroBots por profesor según plan
NEUROBOT_LIMITS: dict[str, int] = {
    "basica":  1,
    "premium": 10,
    "pro":     999_999,
}

# Formatos de exportación disponibles por plan
EXPORT_FORMATS: dict[str, list[str]] = {
    "basica":  ["csv"],
    "premium": ["csv", "pdf", "excel"],
    "pro":     ["csv", "pdf", "excel"],
}

GROUP_LIMITS: dict[str, int] = {
    "basica":  10,
    "premium": 30,
    "pro":     999_999,
}


# ─────────────────────────────────────────────────────────────────────────────
# 2. Clase de resultado de licencia
# ─────────────────────────────────────────────────────────────────────────────

class LicenseInfo:
    def __init__(
        self,
        license_type: str,
        license_status: str,          # "active" | "expiring_soon" | "expired" | "suspended"
        days_left: Optional[int],
        teacher_modules: list[str],
        student_modules: list[str],
        teacher_dashboard_kpis: list[str],
        neurobot_limit: int,
        export_formats: list[str],
        groups_limit: int,
        students_limit: int,
        institution_name: str,
        role: str = "estudiante",
        features: Optional[list[str]] = None,
        super_modules: Optional[list[str]] = None,
    ):
        self.license_type            = license_type
        self.license_status          = license_status
        self.days_left               = days_left
        self.teacher_modules         = teacher_modules
        self.student_modules         = student_modules
        self.teacher_dashboard_kpis  = teacher_dashboard_kpis
        self.neurobot_limit          = neurobot_limit
        self.export_formats          = export_formats
        self.groups_limit            = groups_limit
        self.students_limit          = students_limit
        self.institution_name        = institution_name
        self.role                    = role
        # Funcionalidades habilitadas por la matriz (rol + plan).
        self.features                = features if features is not None else features_for_user(role, license_type)
        self.super_modules           = super_modules if super_modules is not None else SUPER_MODULES.get(license_type, SUPER_MODULES["basica"])

    def to_dict(self) -> dict:
        return {
            "license_type":           self.license_type,
            "license_status":         self.license_status,
            "days_left":              self.days_left,
            "role":                   self.role,
            "features":               self.features,
            "super_modules":          self.super_modules,
            "teacher_modules":        self.teacher_modules,
            "student_modules":        self.student_modules,
            "teacher_dashboard_kpis": self.teacher_dashboard_kpis,
            "neurobot_limit":         self.neurobot_limit,
            "export_formats":         self.export_formats,
            "groups_limit":           self.groups_limit,
            "students_limit":         self.students_limit,
            "institution_name":       self.institution_name,
        }

    def has_feature(self, feature: str) -> bool:
        """
        Acceso a una funcionalidad según ROL + LICENCIA (matriz acumulativa).
        Respeta el estado de la licencia (suspended/expired → bloquea).
        """
        if self.license_status == "suspended":
            return False
        if self.license_status == "expired":
            # Solo lectura: sólo funcionalidades transversales mínimas.
            return feature in ("perfil", "configuracion", "mensajes", "calendario")
        return has_feature(self.role, self.license_type, feature)

    def has_teacher_module(self, module: str) -> bool:
        if self.license_status == "suspended":
            return False
        if self.license_status == "expired":
            # Solo lectura: módulos básicos sin IA ni creación
            READONLY = {"dashboard", "cursos", "grupos", "estudiantes", "recursos"}
            return module in READONLY
        return module in self.teacher_modules

    def has_student_module(self, module: str) -> bool:
        if self.license_status == "suspended":
            return False
        if self.license_status == "expired":
            READONLY = {"inicio", "mis_cursos", "recursos"}
            return module in READONLY
        return module in self.student_modules

    def has_super_module(self, module: str) -> bool:
        if self.license_status == "suspended":
            return False
        if self.license_status == "expired":
            READONLY = {"dashboard", "reportes", "mensajeria", "calendario"}
            return module in READONLY
        return module in self.super_modules


# ─────────────────────────────────────────────────────────────────────────────
# 3. Función principal: obtener licencia del usuario
# ─────────────────────────────────────────────────────────────────────────────

def _effective_expiry(institution: Institution) -> datetime:
    """
    Fecha de vencimiento efectiva de la licencia.

    Regla de negocio (licencia ANUAL):
      - Si institution.expiry_date está fijada, ésta prevalece tal cual.
      - Si NO hay expiry_date, la licencia dura LICENSE_DURATION_DAYS (365 días)
        desde institution.created_at. Cada día transcurrido resta un día.
    """
    if institution.expiry_date is not None:
        return institution.expiry_date
    base = institution.created_at or datetime.now(timezone.utc)
    return base + timedelta(days=LICENSE_DURATION_DAYS)


def _resolve_license_state(
    institution: Institution,
) -> Tuple[str, Optional[int]]:
    """
    Calcula (license_status, days_left) para una institución activa.

    - "suspended"   → institución suspendida (is_active False) → sin días.
    - "expired"     → fecha de vencimiento en el pasado → days_left 0.
    - "expiring_soon" → quedan entre 1 y 30 días.
    - "active"      → resto de casos (incluida la licencia anual aún vigente).
    """
    if not institution.is_active:
        return "suspended", None

    expiry = _effective_expiry(institution)
    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    # created_at sin timezone se asume UTC (coherente con el resto del sistema).
    # Comparamos instantes con precisión (no `.days`, que trunca hacia cero y
    # hacía reportar "expiring_soon" en lugar de "expired" cuando la licencia
    # venció hace menos de 24 h).
    if expiry <= now:
        return "expired", 0
    days_left = (expiry - now).days
    # Si aún no ha pasado un día completo pero ya vence hoy, contar como 1 día
    # restante (evita "expiring_soon" con 0 días).
    if days_left == 0:
        days_left = 1
    if days_left <= 30:
        return "expiring_soon", days_left
    return "active", days_left


def get_license_for_user(user: User, db: Session) -> LicenseInfo:
    """
    Devuelve el LicenseInfo correspondiente al usuario autenticado.
    Si el usuario no pertenece a ninguna institución, se devuelve
    licencia básica activa (ej: admin o usuarios sin institución).
    """
    try:
        return _get_license_for_user_inner(user, db)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Fallo de base de datos (Supabase lento/caído en serverless) se
        # traduce en 503 controlado en lugar del 500 crudo que rompía
        # /license/my-license, /messages/* e /integrations.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"No se pudo consultar la licencia (base de datos). {str(e)[:160]}",
        ) from e


def _get_license_for_user_inner(user: User, db: Session) -> LicenseInfo:
    institution: Optional[Institution] = None
    if user.institution_id:
        # 1º intenta caché (evita 1 query por petición); 2º consulta DB.
        institution = _get_cached_institution(user.institution_id)
        if institution is None:
            institution = db.query(Institution).filter(
                Institution.id == user.institution_id
            ).first()
            _cache_institution(institution)

    if institution is None:
        # Sin institución → licencia básica activa (para admin / testing)
        return LicenseInfo(
            license_type="basica",
            license_status="active",
            days_left=None,
            teacher_modules=TEACHER_MODULES["basica"],
            student_modules=STUDENT_MODULES["basica"],
            teacher_dashboard_kpis=TEACHER_DASHBOARD_KPIS["basica"],
            neurobot_limit=NEUROBOT_LIMITS["basica"],
            export_formats=EXPORT_FORMATS["basica"],
            groups_limit=GROUP_LIMITS["basica"],
            students_limit=STUDENT_LIMITS["basica"],
            institution_name="Sin institución",
            role=user.role,
        )

    plan = institution.license_type  # "basica" | "premium" | "pro"

    # ── Calcular estado (licencia anual: vence a los 365 días de su inicio) ──
    lic_status, days_left = _resolve_license_state(institution)

    return LicenseInfo(
        license_type=plan,
        license_status=lic_status,
        days_left=days_left,
        teacher_modules=TEACHER_MODULES.get(plan, TEACHER_MODULES["basica"]),
        student_modules=STUDENT_MODULES.get(plan, STUDENT_MODULES["basica"]),
        teacher_dashboard_kpis=TEACHER_DASHBOARD_KPIS.get(plan, TEACHER_DASHBOARD_KPIS["basica"]),
        neurobot_limit=NEUROBOT_LIMITS.get(plan, 1),
        export_formats=EXPORT_FORMATS.get(plan, ["csv"]),
        groups_limit=GROUP_LIMITS.get(plan, GROUP_LIMITS["basica"]),
        students_limit=STUDENT_LIMITS.get(plan, STUDENT_LIMITS["basica"]),
        institution_name=institution.name,
        role=user.role,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. FastAPI Dependencies reutilizables
# ─────────────────────────────────────────────────────────────────────────────

from app.api.auth import get_current_user  # no circular: auth.py doesn't import license_service
from app.models.user import UserRole


def get_license(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> LicenseInfo:
    """Dependency que devuelve la LicenseInfo del usuario autenticado."""
    return get_license_for_user(current_user, db)


def require_teacher_module(module: str):
    """
    Dependency factory. Uso:
        @router.get("/neurobots")
        async def list_bots(lic = Depends(require_teacher_module("neurobots"))):
    """
    def _check(license_info: LicenseInfo = Depends(get_license)):
        if not license_info.has_teacher_module(module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El módulo '{module}' no está disponible en tu licencia ({license_info.license_type}).",
            )
        return license_info
    return _check


def require_student_module(module: str):
    """
    Dependency factory para rutas de estudiante.
    """
    def _check(license_info: LicenseInfo = Depends(get_license)):
        if not license_info.has_student_module(module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El módulo '{module}' no está disponible en tu licencia ({license_info.license_type}).",
            )
        return license_info
    return _check


def require_active_license():
    """
    Bloquea completamente si la licencia está suspendida o vencida.
    Úsalo en endpoints de escritura (POST/PUT/DELETE).
    """
    def _check(license_info: LicenseInfo = Depends(get_license)):
        if license_info.license_status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La licencia institucional está suspendida. Contacta al administrador.",
            )
        if license_info.license_status == "expired":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La licencia institucional ha expirado. El panel está en modo solo lectura.",
            )
        return license_info
    return _check


def require_chat_access():
    """
    Permite acceso a la IA de chat según el rol y la licencia.
    Profesores requieren el módulo "ia"; estudiantes requieren "tutor_ia".
    """
    def _check(
        current_user: User = Depends(get_current_user),
        license_info: LicenseInfo = Depends(get_license),
    ):
        if current_user.role in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value):
            if not license_info.has_teacher_module("ia"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"El módulo 'ia' no está disponible en tu licencia ({license_info.license_type}).",
                )
        else:
            if not license_info.has_student_module("tutor_ia"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"El módulo 'tutor_ia' no está disponible en tu licencia ({license_info.license_type}).",
                )
        if license_info.license_status == "suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La licencia institucional está suspendida. Contacta al administrador.",
            )
        if license_info.license_status == "expired":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="La licencia institucional ha expirado. El panel está en modo solo lectura.",
            )
        return license_info
    return _check


def require_feature(feature: str):
    """
    Dependency factory basada en la MATRIZ de funcionalidades (rol + licencia).

    Uso:
        @router.get("/analitica")
        async def analytics(lic = Depends(require_feature("advanced_analytics"))):

    Comprueba que el ROL tiene permiso Y que la LICENCIA de la institución
    incluye la funcionalidad; rechaza con 403 en caso contrario.
    """
    def _check(license_info: LicenseInfo = Depends(get_license)):
        if not license_info.has_feature(feature):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"La funcionalidad '{feature}' no está disponible para tu rol "
                    f"({license_info.role}) con tu licencia ({license_info.license_type}). "
                    "Actualiza tu plan para desbloquearla."
                ),
            )
        return license_info
    return _check
