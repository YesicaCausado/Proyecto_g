"""
NeuroLearn IA — Permisos por rol.

El acceso a cada módulo depende únicamente del ROL del usuario:

    Autenticación → Usuario → Rol → Permiso → Módulo

No existen planes ni licencias. Este módulo responde a la pregunta
"¿este rol puede hacer esto?" y nada más.

Los conjuntos de roles reproducen exactamente quién tenía acceso a cada
módulo antes de retirar las licencias (con todas las funcionalidades
habilitadas), para no cambiar el comportamiento de la aplicación.

Es Python puro (sin FastAPI ni SQLAlchemy) para poder probarse aislado.
La dependencia de FastAPI que lo usa es ``require_permission`` en
``app/api/auth.py``.
"""
from __future__ import annotations

import enum
from typing import Dict, FrozenSet

from app.models.user import UserRole

ADMIN = UserRole.ADMIN.value
SUPER = UserRole.SUPER_PROFESOR.value
PROFESOR = UserRole.PROFESOR.value
ESTUDIANTE = UserRole.ESTUDIANTE.value


class Permission(str, enum.Enum):
    """Acciones protegidas por rol."""

    # Profesor
    GESTIONAR_AULAS = "gestionar_aulas"            # crear/ver/eliminar sus aulas y estudiantes
    ASIGNAR_BOTS_AULA = "asignar_bots_aula"        # NeuroBots dentro de sus aulas
    GESTIONAR_EVALUACIONES = "gestionar_evaluaciones"
    GESTIONAR_MATERIALES = "gestionar_materiales"
    PUBLICAR_EN_TABLERO = "publicar_en_tablero"
    USAR_IA_DOCENTE = "usar_ia_docente"            # IA generativa para el docente
    GESTIONAR_DOCUMENTOS_NEUROBOT = "gestionar_documentos_neurobot"  # base de conocimiento de sus NeuroBots
    VER_RESULTADOS_NEUROBOT = "ver_resultados_neurobot"  # progreso de los estudiantes con un NeuroBot

    # Estudiante
    PARTICIPAR_EN_AULAS = "participar_en_aulas"    # unirse y ver sus aulas

    # Compartidos
    USAR_CHAT_IA = "usar_chat_ia"                  # tutor IA / asistente
    VER_NEUROALERTAS = "ver_neuroalertas"
    EXPORTAR_REPORTES = "exportar_reportes"
    GESTIONAR_INTEGRACIONES = "gestionar_integraciones"
    GESTIONAR_AUTOMATIZACIONES = "gestionar_automatizaciones"
    GESTIONAR_CALENDARIO = "gestionar_calendario"  # crear/editar/eliminar eventos


ROLE_PERMISSIONS: Dict[Permission, FrozenSet[str]] = {
    Permission.GESTIONAR_AULAS: frozenset({PROFESOR}),
    Permission.ASIGNAR_BOTS_AULA: frozenset({PROFESOR}),
    Permission.GESTIONAR_EVALUACIONES: frozenset({PROFESOR}),
    Permission.GESTIONAR_MATERIALES: frozenset({PROFESOR}),
    Permission.PUBLICAR_EN_TABLERO: frozenset({PROFESOR}),
    Permission.USAR_IA_DOCENTE: frozenset({ADMIN, PROFESOR}),
    # Mismos roles que pueden crear NeuroBots (POST /bots/create); además solo
    # el creador del bot (o el Administrador) gestiona sus documentos.
    Permission.GESTIONAR_DOCUMENTOS_NEUROBOT: frozenset({ADMIN, SUPER, PROFESOR}),
    # Profesor: sus asignaciones; Súper Profesor: su institución; Admin: todo
    # (filtrado en app/services/neurobot_service.py::results).
    Permission.VER_RESULTADOS_NEUROBOT: frozenset({ADMIN, SUPER, PROFESOR}),
    Permission.PARTICIPAR_EN_AULAS: frozenset({ESTUDIANTE}),
    Permission.USAR_CHAT_IA: frozenset({ADMIN, PROFESOR, ESTUDIANTE}),
    Permission.VER_NEUROALERTAS: frozenset({ADMIN, SUPER, PROFESOR}),
    Permission.EXPORTAR_REPORTES: frozenset({ADMIN, SUPER, PROFESOR}),
    Permission.GESTIONAR_INTEGRACIONES: frozenset({ADMIN, SUPER, PROFESOR}),
    Permission.GESTIONAR_AUTOMATIZACIONES: frozenset({ADMIN, SUPER, PROFESOR}),
    Permission.GESTIONAR_CALENDARIO: frozenset({SUPER, PROFESOR}),
}

#: Mensaje único para cualquier rechazo por permisos.
FORBIDDEN_MESSAGE = "No tienes permisos para realizar esta acción."


def has_permission(role: str | None, permission: Permission) -> bool:
    """True si el rol tiene el permiso indicado."""
    normalized = (role or "").strip().lower()
    return normalized in ROLE_PERMISSIONS[permission]
