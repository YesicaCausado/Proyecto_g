# Matriz de permisos por rol — NeuroLearn IA

> **Fuente de verdad en código:** `backend/app/core/permissions.py`
> (`Permission`, `ROLE_PERMISSIONS`, `has_permission()`), aplicada en los
> endpoints con la dependencia `require_permission(...)` de `backend/app/api/auth.py`.
>
> Este documento reemplaza a `MATRIZ_LICENCIAS.md`. NeuroLearn IA ya **no tiene
> licencias ni planes** (Básica / Premium / Pro): es un único producto y cada
> usuario accede a todos los módulos que corresponden a su rol.

## 1. Modelo de acceso

```
Autenticación (JWT) → Usuario → Rol → Permiso → Módulo
```

Además del rol, se aplican dos reglas transversales:

- **Aislamiento por institución:** cada consulta filtra por la institución del usuario.
- **Institución desactivada:** si el Administrador desactiva una institución
  (`institutions.is_active = false`), sus usuarios no pueden iniciar sesión y sus
  tokens dejan de ser válidos (`ensure_institution_active` en `auth.py`).
  El Administrador no pertenece a ninguna institución y no se ve afectado.

Rechazo por permisos: HTTP 403 con el mensaje
«No tienes permisos para realizar esta acción.»

## 2. Roles

| Rol | Clave backend |
|-----|---------------|
| Administrador | `admin` |
| Súper Profesor | `super_profesor` |
| Profesor | `profesor` |
| Estudiante | `estudiante` |

## 3. Permisos

| Permiso | Admin | Súper Profesor | Profesor | Estudiante | Endpoints que lo exigen |
|---------|:-----:|:--------------:|:--------:|:----------:|-------------------------|
| `gestionar_aulas` | | | ✅ | | `api/classroom.py` (aulas del docente, estudiantes del aula) |
| `asignar_bots_aula` | | | ✅ | | `api/classroom.py` (NeuroBots del aula), `api/neurobot_assignments.py` (asignar a grupos o estudiantes, quitar asignaciones; solo NeuroBots propios o públicos de su institución y solo sus grupos/estudiantes) |
| `ver_resultados_neurobot` | ✅ | ✅ | ✅ | | `api/neurobot_assignments.py` (`GET /bots/{id}/progress`): el Profesor ve solo a sus estudiantes; el Súper Profesor, los de su institución; el Admin, todos |
| `gestionar_evaluaciones` | | | ✅ | | `api/teacher_evaluations.py` (crear, publicar, cerrar, resultados, calificar) |
| `gestionar_materiales` | | | ✅ | | `api/teacher_materials.py` |
| `publicar_en_tablero` | | | ✅ | | `api/posts.py` (crear publicación) |
| `usar_ia_docente` | ✅ | | ✅ | | `api/teacher_ai.py` |
| `gestionar_documentos_neurobot` | ✅ | ✅ | ✅ | | `api/bot_documents.py` (además, solo el creador del NeuroBot o el Admin) |
| `participar_en_aulas` | | | | ✅ | `api/classroom.py` (unirse / mis aulas), `api/student_evaluations.py` (responder evaluaciones), `api/neurobot_assignments.py` (Mis NeuroBots) |
| `usar_chat_ia` | ✅ | | ✅ | ✅ | `api/chat.py`, `api/conversations.py` |
| `ver_neuroalertas` | ✅ | ✅ | ✅ | | `api/super_stats.py` |
| `exportar_reportes` | ✅ | ✅ | ✅ | | `api/teacher_reports.py` |
| `gestionar_integraciones` | ✅ | ✅ | ✅ | | `api/integrations.py` (Google Drive/Calendar, webhooks) |
| `gestionar_automatizaciones` | ✅ | ✅ | ✅ | | `api/integrations.py` (automatizaciones) |
| `gestionar_calendario` | | ✅ | ✅ | | `api/events.py` (crear/editar/eliminar eventos) |

Los demás endpoints protegen el acceso con las dependencias de rol ya existentes
(`require_teacher` en `api/classroom.py`, `_require_super` en `api/super_stats.py`,
`_require_admin` en `api/admin_users.py` y `api/admin_bots.py`, etc.) y con `get_current_user`.

**Notificaciones** (`api/notifications.py`): cualquier usuario autenticado, y
solo sobre sus propias notificaciones (marcar como leída otra ajena → 404).

**Moderación de NeuroBots por el Súper Profesor** (`api/expert_bot.py`): puede
activar o desactivar (`PATCH /bots/{id}` solo con `is_active`) y eliminar los
NeuroBots creados por profesores de su institución; no puede editar su
contenido ni actuar sobre bots de otra institución (403).

## 4. Cómo añadir un permiso

1. Agregar el valor en `Permission` y su conjunto de roles en `ROLE_PERMISSIONS`.
2. Proteger el endpoint con
   `_authorized: User = Depends(require_permission(Permission.NUEVO))`.
3. Actualizar esta tabla.
