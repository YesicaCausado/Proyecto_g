# NeuroBots asignados y notificaciones — NeuroLearn IA

Parche 11B (octubre de 2026). Describe el flujo real, ya implementado y
probado, entre profesor y estudiante con los NeuroBots, y el sistema de
notificaciones persistentes que lo acompaña.

> **Migración requerida:** `backend/migrations/011_neurobots_notificaciones.sql`
> debe ejecutarse en Supabase **antes** de desplegar este código.

## 1. Flujo NeuroBot

```
Profesor crea NeuroBot ──► Asigna a grupos y/o estudiantes (con meta)
        │                         │  (misma transacción)
        │                         ▼
        │                 Notificación «Nuevo NeuroBot asignado» → /bots/{id}
        │                         │
        ▼                         ▼
 Súper Profesor recibe     Estudiante: menú «Mis NeuroBots» → detalle → chat
 «Nuevo NeuroBot»                 │
                                  ▼
                 Cada respuesta real de la IA = 1 interacción (se guarda)
                                  │
                                  ▼
               Al llegar a la meta → «Completado» + notificación al profesor
                                  │
                                  ▼
          Profesor: pestaña NeuroBots → «Progreso de tus estudiantes»
```

### Reglas de negocio

| Código | Regla |
|---|---|
| RN-NB-01 | Un NeuroBot se asigna a **grupos** (todos sus estudiantes activos, incluidos los que se unan después) o a **estudiantes concretos** de los grupos del propio profesor. |
| RN-NB-02 | Solo puede asignar el Profesor. Puede asignar NeuroBots propios o públicos de su institución, y solo a sus grupos y estudiantes; lo demás responde 403/404. |
| RN-NB-03 | La **meta** es un número de interacciones entre 1 y 200 (por defecto 10). Meta efectiva del estudiante = la de su asignación individual; si no tiene, la mayor de las asignaciones de sus grupos. |
| RN-NB-04 | Solo cuenta como interacción una respuesta **real** de un proveedor de IA. La respuesta de respaldo local (cuando no hay IA disponible) **no** cuenta. |
| RN-NB-05 | Estados derivados: **Asignado** (sin abrir), **Iniciado** (abrió el chat, 0 interacciones), **En progreso** (≥ 1), **Completado** (alcanzó la meta). El porcentaje se limita a 99 % hasta completar. |
| RN-NB-06 | El completado se registra una sola vez (actualización condicional), aunque lleguen mensajes simultáneos; el profesor recibe una única notificación. Si el profesor cambia la meta y un estudiante ya la alcanza, queda completado en ese momento. |
| RN-NB-07 | Al quitar una asignación, el estudiante deja de ver el NeuroBot (404 en el detalle); su progreso se conserva por si se vuelve a asignar. Al eliminar el NeuroBot se borran asignaciones y progreso. |
| RN-NB-08 | Resultados: el Profesor ve solo a sus estudiantes; el Súper Profesor, los de su institución; el Admin, todos. |
| RN-NB-09 | El Súper Profesor puede activar, desactivar y eliminar los NeuroBots de su institución, y ver su progreso. No puede editar su contenido. |

### Endpoints (`/api/v1`)

| Método y ruta | Rol | Uso |
|---|---|---|
| `GET /bots/assigned-to-me` | Estudiante | «Mis NeuroBots» con estado, progreso y origen (grupo o individual) |
| `GET /bots/assigned-to-me/{bot_id}` | Estudiante | Detalle; 404 si ya no está asignado. Incluye la última conversación para retomarla |
| `GET /bots/{bot_id}/assignments` | Profesor | Grupos y estudiantes asignados y metas |
| `POST /bots/{bot_id}/assignments` | Profesor | `{classroom_ids, student_ids, goal_interactions}`: asigna o actualiza la meta y notifica a los estudiantes nuevos |
| `DELETE /bots/{bot_id}/assignments/classrooms/{id}` | Profesor | Quita la asignación a un grupo |
| `DELETE /bots/{bot_id}/assignments/students/{id}` | Profesor | Quita la asignación individual |
| `GET /bots/{bot_id}/progress` | Profesor, Súper Profesor, Admin | Resultados por estudiante y resumen por estado |
| `POST /classrooms/{id}/bots` | Profesor | Endpoint previo; ahora usa el mismo servicio (meta opcional y notificación) |
| `POST /chat/start`, `POST /chat/message` | Estudiante | Registran el inicio y las interacciones; devuelven `metadata.neurobot_progress` |
| `PATCH /bots/{id}`, `DELETE /bots/{id}` | Creador, Admin, Súper Profesor de la institución | Moderación (el súper solo `is_active` o eliminar) |
| `GET /super/bots` | Súper Profesor | Lista de bots de la institución (también los inactivos), con documentos, consultas y grupos reales |

Se eliminó `POST /bots/{id}/share`: respondía éxito sin guardar nada.

### Base de datos

| Tabla | Contenido |
|---|---|
| `classroom_bots` (+2 columnas) | `goal_interactions` (meta del grupo), `assigned_by_id` (profesor que asignó) |
| `student_bot_assignments` | Asignación individual: bot, estudiante, profesor, meta, fecha. Único (bot, estudiante) |
| `neurobot_progress` | Interacciones, inicio, última actividad, completado y meta con la que se completó. Único (bot, estudiante) |

## 2. Notificaciones

Las notificaciones son **filas reales** en `notifications`, creadas en la
**misma transacción** que el evento que las origina. Si el evento falla, no
queda notificación, y al revés tampoco. No hay notificaciones de ejemplo ni
«tip del día».

| Tipo | Evento | Destinatario | Enlace |
|---|---|---|---|
| `neurobot_asignado` | Asignación a grupo/estudiante, o estudiante que se une a un grupo con NeuroBots | Estudiante | `/bots/{id}` |
| `neurobot_completado` | El estudiante alcanza la meta | Profesor(es) que asignaron | `/teacher?tab=neurobots&bot={id}` |
| `evaluacion_publicada` | El profesor publica una evaluación | Estudiantes del grupo | `/evaluations?id={id}` |
| `alerta_riesgo` | Un estudiante pasa a riesgo **alto** (solo en la transición) | Profesor del grupo y Súper Profesor | `/teacher?tab=alertas`, `/super?tab=alertas` |
| `actividad_institucional` | Se crea un grupo o un NeuroBot en la institución | Súper Profesor | `/super?tab=grupos`, `/super?tab=neurobots` |
| `mensaje_directo` | Mensaje directo recibido (se agrupan: «3 mensajes nuevos de …») | Destinatario | `/messages?with=…`, `/teacher?tab=mensajes&with=…`, `/super?tab=mensajeria&with=…` |
| `racha` | Racha en riesgo (estudió ayer y hoy no) o logro cada 7 días | Estudiante | `/quizzes`, `/performance` |
| `rendimiento` | Promedio semanal ≥ 80 % o < 50 % (mín. 2 quizzes) | Estudiante | `/performance` |

`racha` y `rendimiento` se calculan al consultar las notificaciones, pero se
**guardan** con una clave de deduplicación (`dedupe_key`, única por usuario),
así que aparecen una sola vez y conservan su estado de leída.

**Preferencias del perfil** (`notification_preferences`): «Nueva actividad»
(todos los tipos salvo mensajes) y «Mensaje directo». Antes solo se
guardaban en el navegador y no tenían efecto; ahora las respeta el backend.

### Endpoints

| Método y ruta | Uso |
|---|---|
| `GET /notifications?limit&offset&unread_only` | Lista paginada, `unread_count`, `total`, `has_more` |
| `GET /notifications/unread-count` | Contador del 🔔 (se consulta cada 60 s y al volver a la pestaña) |
| `POST /notifications/{id}/read` | Marca una como leída (404 si no es del usuario) |
| `POST /notifications/read-all` | Marca todas |
| `GET`/`PUT /notifications/preferences` | Preferencias del perfil |

### Frontend

- `context/NotificationsContext.tsx`: un único estado compartido por todas las campanas del usuario.
- `components/NotificationBell.tsx` y `NotificationsPanel.tsx`: 🔔 con contador real en Estudiante (barra lateral y cabecera móvil), Profesor, Súper Profesor y Admin. Al hacer clic se marca como leída y navega al recurso.
- Estudiante: menú «Mis NeuroBots» (`/bots`), detalle `/bots/{id}`, barra de progreso en el chat.
- Profesor: pestaña NeuroBots → «Asignar a grupos o estudiantes» y «Progreso de tus estudiantes».
- Súper Profesor: pestaña NeuroBots con datos reales, activar/desactivar, eliminar y «Ver progreso».

## 3. Limitaciones conocidas

- Las notificaciones llegan por **consulta periódica** (60 s), no por push ni WebSocket.
- La respuesta de respaldo local del chat sigue existiendo cuando no hay proveedor de IA; se muestra, pero no suma progreso. Se revisa en el parche 12.
- Las notificaciones ya enviadas de un NeuroBot eliminado se conservan; su enlace lleva a «ya no está asignado».
- No se envían correos ni notificaciones push del sistema operativo.

## 4. Pruebas

`backend/tests/test_neurobots_notificaciones.py` (13 pruebas). Ver
[PRUEBAS.md](PRUEBAS.md).
