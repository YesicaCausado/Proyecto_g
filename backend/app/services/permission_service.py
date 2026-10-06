"""
NeuroLearn AI - Servicio de permisos basado en roles
=====================================================

Este servicio reemplaza al servicio de licencias y proporciona
verificación de permisos basada únicamente en el rol del usuario.
"""

from typing import List, Set, Dict
from app.models.user import UserRole

# Mapeo de características a los roles que tienen acceso
# Este es el resultado de tomar la UNIÓN de acceso entre todos los niveles de licencia
# (basica, premium, pro) para cada rol
FEATURE_ROLES: Dict[str, Set[str]] = {
    # FUNCIONES TRANSVERSALES
    "perfil": {
        "super_profesor",
        "profesor",
        "estudiante",
    },
    "mensajes": {
        "super_profesor",
        "profesor",
        "estudiante",
    },
    "calendario": {
        "super_profesor",
        "profesor",
        "estudiante",
    },
    
    # SUPER PROFESOR
    "configuracion": {
        "super_profesor",
    },
    "licencia": {
        "super_profesor",
    },
    "gestion_profesores": {
        "super_profesor",
    },
    "gestion_estudiantes": {
        "super_profesor",
    },
    "gestion_grupos": {
        "super_profesor",
        "profesor",
    },
    
    # DASHBOARD Y ANALÍTICA
    "dashboard": {
        "super_profesor",
        "profesor",
        "estudiante",
    },
    "basic_analytics": {
        "super_profesor",
        "profesor",
        "estudiante",
    },
    "advanced_analytics": {
        "super_profesor",
        "profesor",
    },
    "predictive_analytics": {
        "super_profesor",
        "profesor",
    },
    "groups_compare": {
        "super_profesor",
        "profesor",
    },
    "risk_indicators": {
        "super_profesor",
        "profesor",
    },
    
    # CONTENIDO ACADÉMICO
    "recursos": {
        "profesor",
        "estudiante",
    },
    "evaluaciones": {
        "profesor",
        "estudiante",
    },
    "tareas": {
        "estudiante",
    },
    "anuncios": {
        "profesor",
    },
    
    # NEUROBOTS / NEUROALERTAS
    "neurobots": {
        "super_profesor",
        "profesor",
    },
    "neurobots_advanced": {
        "super_profesor",
        "profesor",
    },
    "neuroalertas": {
        "super_profesor",
        "profesor",
    },
    
    # NEURODIGITAL
    "neurodigital": {
        "profesor",
        "estudiante",
    },
    
    # REPORTES
    "reportes": {
        "super_profesor",
        "profesor",
    },
    "reportes_avanzados": {
        "super_profesor",
        "profesor",
    },
    
    # IA PARA ESTUDIANTES
    "tutor_ia": {
        "estudiante",
    },
    "tutor_ia_adaptive": {
        "estudiante",
    },
    "chat_history": {
        "estudiante",
    },
    "recommendations": {
        "estudiante",
    },
    "adaptive_feedback": {
        "estudiante",
    },
    "difficulty_detection": {
        "estudiante",
    },
    "skill_tracking": {
        "estudiante",
    },
    "learning_analytics": {
        "estudiante",
    },
    "tutor_ia_advanced": {
        "estudiante",
    },
    "personal_reports": {
        "estudiante",
    },
    "personal_analytics": {
        "estudiante",
    },
    "personalized_plans": {
        "estudiante",
    },
    
    # IA PARA PROFESORES
    "teacher_ai": {
        "profesor",
    },
    
    # AUTOMATIZACIÓN / INTEGRACIONES
    "automation": {
        "super_profesor",
        "profesor",
    },
    "integrations": {
        "super_profesor",
        "profesor",
    },
}

# Alias de módulos a características (mismo que en license_service.py)
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
    """
    module = (module or "").strip().lower()
    return MODULE_ALIASES.get(module, module)


def features_for_user(role: str) -> List[str]:
    """
    Devuelve las características permitidas para un rol.
    Ya no depende del tipo de licencia, solo del rol.
    """
    role = (role or "").strip().lower()
    
    # Admin tiene acceso a todo
    if role == "admin":
        return sorted(FEATURE_ROLES.keys())
    
    # Validar rol
    valid_roles = {
        "super_profesor",
        "profesor", 
        "estudiante",
    }
    if role not in valid_roles:
        return []
    
    # Devolver todas las características que el rol tiene acceso
    features: List[str] = []
    for feature, roles in FEATURE_ROLES.items():
        if role in roles:
            features.append(feature)
    
    return sorted(features)


def _modules_for_role(role: str) -> List[str]:
    """
    Genera los módulos compatibles con un rol.
    """
    features = set(features_for_user(role))
    
    modules: Set[str] = set()
    for module, feature in MODULE_ALIASES.items():
        if feature in features:
            modules.add(module)
    
    return sorted(modules)


# Funciones de compatibilidad con la antigua interfaz de license_service
def get_modules_for_role(role: str, license_type: str = "basica") -> List[str]:
    """Función de compatibilidad - ignora license_type"""
    return _modules_for_role(role)


def get_features_for_user(role: str, license_type: str = "basica") -> List[str]:
    """Función de compatibilidad - ignora license_type"""
    return features_for_user(role)


# Límites ilimitados (ya que eliminamos las restricciones de licencia)
UNLIMITED = 999999

TEACHER_LIMITS = {
    "basica": UNLIMITED,  # Mantener el nombre para compatibilidad pero con valor ilimitado
}

STUDENT_LIMITS = {
    "basica": UNLIMITED,
}

NEUROBOT_LIMITS = {
    "basica": UNLIMITED,
}

GROUP_LIMITS = {
    "basica": UNLIMITED,
}

EXPORT_FORMATS = {
    "basica": ["csv", "pdf", "excel"],
}

TEACHER_DASHBOARD_KPIS = {
    "basica": [
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