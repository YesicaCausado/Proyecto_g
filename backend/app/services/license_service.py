"""
NeuroLearn AI — License Service
================================
Servicio centralizado para validar tipo y estado de licencia institucional.
Toda la lógica de permisos de módulos pasa por este archivo.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.models.institution import Institution


# ─────────────────────────────────────────────────────────────────────────────
# 1. Definición de módulos por plan y rol
# ─────────────────────────────────────────────────────────────────────────────

TEACHER_MODULES: dict[str, list[str]] = {
    "basica": [
        "dashboard", "cursos", "grupos", "estudiantes",
        "evaluaciones", "recursos", "calendario", "mensajes", "perfil",
    ],
    "premium": [
        "dashboard", "cursos", "grupos", "estudiantes",
        "evaluaciones", "recursos", "neurobots", "reportes",
        "calendario", "mensajes", "perfil", "ia", "analitica",
        "banco_preguntas",
    ],
    "pro": [
        "dashboard", "cursos", "grupos", "estudiantes",
        "evaluaciones", "recursos", "neurobots", "ia", "reportes",
        "analitica", "banco_preguntas", "integraciones",
        "automatizaciones", "configuracion", "perfil",
    ],
}

STUDENT_MODULES: dict[str, list[str]] = {
    "basica": [
        "inicio", "mis_cursos", "mis_tareas", "evaluaciones",
        "recursos", "calendario", "mensajes", "perfil",
    ],
    "premium": [
        "inicio", "mis_cursos", "mis_tareas", "evaluaciones",
        "recursos", "calendario", "mensajes", "perfil",
        "tutor_ia", "resumenes_ia", "generador_preguntas",
        "recomendaciones", "certificados", "progreso", "estadisticas",
    ],
    "pro": [
        "inicio", "mis_cursos", "mis_tareas", "evaluaciones",
        "recursos", "calendario", "mensajes", "perfil",
        "tutor_ia", "resumenes_ia", "generador_preguntas",
        "recomendaciones", "certificados", "progreso", "estadisticas",
        "chat_ia", "mapas_mentales", "generador_ejercicios",
        "planes_personalizados", "biblioteca_premium",
        "gamificacion", "analitica_personal", "objetivos", "asistente",
    ],
}

# KPI cards visibles en el Dashboard del profesor por licencia
TEACHER_DASHBOARD_KPIS: dict[str, list[str]] = {
    "basica": [
        "cursos_activos", "estudiantes", "evaluaciones_creadas",
        "actividades_pendientes",
    ],
    "premium": [
        "cursos_activos", "estudiantes", "evaluaciones_creadas",
        "actividades_pendientes", "neurobots_creados", "uso_ia",
        "promedio_academico", "participacion", "estudiantes_riesgo",
    ],
    "pro": [
        "cursos_activos", "estudiantes", "evaluaciones_creadas",
        "actividades_pendientes", "neurobots_creados", "uso_ia",
        "promedio_academico", "participacion", "estudiantes_riesgo",
        "estado_licencia", "consumo_ia", "usuarios_activos",
        "riesgo_academico", "prediccion_abandono",
    ],
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
        institution_name: str,
    ):
        self.license_type            = license_type
        self.license_status          = license_status
        self.days_left               = days_left
        self.teacher_modules         = teacher_modules
        self.student_modules         = student_modules
        self.teacher_dashboard_kpis  = teacher_dashboard_kpis
        self.neurobot_limit          = neurobot_limit
        self.export_formats          = export_formats
        self.institution_name        = institution_name

    def to_dict(self) -> dict:
        return {
            "license_type":           self.license_type,
            "license_status":         self.license_status,
            "days_left":              self.days_left,
            "teacher_modules":        self.teacher_modules,
            "student_modules":        self.student_modules,
            "teacher_dashboard_kpis": self.teacher_dashboard_kpis,
            "neurobot_limit":         self.neurobot_limit,
            "export_formats":         self.export_formats,
            "institution_name":       self.institution_name,
        }

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


# ─────────────────────────────────────────────────────────────────────────────
# 3. Función principal: obtener licencia del usuario
# ─────────────────────────────────────────────────────────────────────────────

def get_license_for_user(user: User, db: Session) -> LicenseInfo:
    """
    Devuelve el LicenseInfo correspondiente al usuario autenticado.
    Si el usuario no pertenece a ninguna institución, se devuelve
    licencia básica activa (ej: admin o usuarios sin institución).
    """
    institution: Optional[Institution] = None
    if user.institution_id:
        institution = db.query(Institution).filter(
            Institution.id == user.institution_id
        ).first()

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
            institution_name="Sin institución",
        )

    plan = institution.license_type  # "basica" | "premium" | "pro"

    # ── Calcular estado ──────────────────────────────────────────
    if not institution.is_active:
        lic_status = "suspended"
        days_left  = None
    else:
        # Fecha de vencimiento: se guarda en institution.expiry_date si existe
        expiry: Optional[datetime] = getattr(institution, "expiry_date", None)
        if expiry is None:
            lic_status = "active"
            days_left  = None
        else:
            now = datetime.now(timezone.utc)
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            delta = (expiry - now).days
            if delta < 0:
                lic_status = "expired"
                days_left  = 0
            elif delta <= 30:
                lic_status = "expiring_soon"
                days_left  = delta
            else:
                lic_status = "active"
                days_left  = delta

    return LicenseInfo(
        license_type=plan,
        license_status=lic_status,
        days_left=days_left,
        teacher_modules=TEACHER_MODULES.get(plan, TEACHER_MODULES["basica"]),
        student_modules=STUDENT_MODULES.get(plan, STUDENT_MODULES["basica"]),
        teacher_dashboard_kpis=TEACHER_DASHBOARD_KPIS.get(plan, TEACHER_DASHBOARD_KPIS["basica"]),
        neurobot_limit=NEUROBOT_LIMITS.get(plan, 1),
        export_formats=EXPORT_FORMATS.get(plan, ["csv"]),
        institution_name=institution.name,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. FastAPI Dependencies reutilizables
# ─────────────────────────────────────────────────────────────────────────────

from app.api.auth import get_current_user  # noqa: E402 — import aquí para evitar circular


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
