# Auditoría Backend NeuroLearn AI — hallazgos (READ-ONLY, en progreso)

Estado: EN PROGRESO — se agregan hallazgos conforme se procesan los routers.
Convención: [BE-<n>] (CRITICO|IMPORTANTE|MENOR) descripción con archivo:línea.

## Hallazgos acumulados hasta ahora

### Crashes runtime / contratos rotos (verificados leyendo el código)

[BE-1] (CRITICO) `POST /api/v1/bots/` y `POST /api/v1/bots/create` crashean SIEMPRE para cualquier usuario.
Causa: `backend/app/api/expert_bot.py:319` construye `ExpertBot(..., language=payload.language, ...)` pero el modelo `ExpertBot` (`backend/app/models/expert_bot.py`) NO tiene columna `language`. SQLAlchemy lanza `TypeError: 'language' is an invalid keyword argument for ExpertBot()` → 500. Ningún profesor puede crear bots.
Fix: eliminar `language=payload.language` de la construcción (o añadir la columna al modelo).

[BE-2] (IMPORTANTE) Metadatos de `conversation_messages` NUNCA se persisten (pérdida silenciosa de datos).
Causa: `backend/app/api/chat.py:429-436` (`_save_conversation_message`) pasa `metadata=meta or {}` al constructor de `ConversationMessage`, pero el atributo Python del modelo es `meta` (`backend/app/models/adaptive.py:139`, columna llamada "metadata"). El constructor declarativo de SQLAlchemy solo acepta atributos mapeados; `metadata` coincide con el atributo reservado `Base.metadata`, por lo que se setea el atributo de instancia en vez de la columna → la columna `meta` queda NULL y no hay error. El GET `/api/v1/chat/conversations/{id}` (`conversations.py:115`) devuelve `m.meta or {}` → siempre `{}`.
Fix: usar `meta=meta or {}` en el constructor.

[BE-3] (IMPORTANTE) `POST /api/v1/chat/message` → 500 si `facial_data` trae valores no numéricos (UnboundLocalError diferido).
Causa: en `chat.py`, `voice_event`/`facial_event`/`behavioral_event` se inicializan DENTRO del try del análisis neuroconductual (líneas 1103/1117/1154). Las conversiones `float(request.facial_data.get("valence", 0.0) or 0.0)` (líneas 1144-1150) no están protegidas: un string tipo "abc" lanza ValueError → salta al `except` de la línea 1313 → al construir la respuesta, la línea 1484 lee `voice_event` (y 1480 `facial_event`) que quedaron sin asignar → `UnboundLocalError` → capturado por el try externo (1516-1523) → 500 "Error interno". El comentario de las líneas 1087-1090 solo protegió `verdict`/`grade_conf`, no estos.
Fix: inicializar `voice_event = facial_event = behavioral_event = None` antes del try (junto a `verdict`).

[BE-4] (IMPORTANTE) `DELETE /api/v1/bots/{bot_id}` → 500 en PostgreSQL cuando el bot tiene sesiones/asignaciones.
Causa: `expert_bot.py:434-435` hace `db.delete(bot)` sin limpiar `LearningSession.bot_id` ni `ClassroomBot.bot_id` (ninguna relación tiene cascade delete). En Postgres la FK viva lanza `IntegrityError` → 500 sin manejo. En SQLite (dev) pasa inadvertido por FKs no forzadas.
Fix: desasignar ClassroomBot y poner `bot_id=None` en LearningSessions (o `session.execute(delete(...))`) antes del delete.

### Seguridad

[BE-5] (IMPORTANTE) `GET /api/v1/bots/` filtra mal la visibilidad para no-admin: un estudiante puede ver TODOS los bots PRIVADOS.
Causa: `expert_bot.py:76-82`: si `role` no es super_profesor/admin y el cliente pasa `?is_public=false` explícitamente, `is_public` no es None → el filtro aplica `is_public == false` → lista todos los bots privados de todos los creadores (nombre, descripción, creator_id, conteos). Solo debería poder ver los suyos o públicos.
Fix: para no-admin forzar `or_(ExpertBot.is_public == True, ExpertBot.creator_id == current_user.id)` e ignorar el parámetro is_public del cliente.

[BE-6] (MENOR) `GET /api/v1/bots/{bot_id}` expone `knowledge_base` completo y stats de uso (unique_users) de cualquier bot público a cualquier usuario autenticado, sin filtro de institución (`expert_bot.py:235-266`). Riesgo bajo (bots públicos), pero sin scoping multi-tenant.

[BE-7] (MENOR) `POST /api/v1/bots/{bot_id}/share` con email es un stub que devuelve ok sin persistir nada (`expert_bot.py:477-494`): el frontend cree que compartió pero no hay tabla de compartición; además permite "compartir" con cualquier email del sistema sin validar institución.

### Menores / calidad

[BE-8] (MENOR) `expert_bot.py:111` `getattr(bot, "knowledge_base_size", 0)` — atributo inexistente en el modelo; siempre devuelve 0.
[BE-9] (MENOR) `expert_bot.py:252` devuelve `knowledge_base` como dict (el default del modelo), el frontend que espera lista de items puede romperse.
[BE-10] (MENOR) `POST /api/v1/auth/register` (`auth.py:153-163`) no asigna `institution_id` aunque el creador sea admin/super_profesor: los usuarios creados quedan sin institución (no se les puede aplicar scoping).

## Lote: classroom.py, credentials.py, posts.py, events.py, messages.py, super_stats.py, teacher_stats.py, teacher_materials.py, teacher_evaluations.py

### Seguridad

[BE-11] (IMPORTANTE) `GET /api/v1/classrooms/{classroom_id}/students/{student_id}/progress` SIN verificación de dueño — cualquier profesor lee datos+cognitive_profile de estudiantes de OTROS profesores/instituciones.
Causa: `backend/app/api/classroom.py:739-771` — `require_teacher(current_user)` solo valida rol; la query (750-754) filtra por `classroom_id + student_id` sin comprobar `Classroom.teacher_id == current_user.id` ni pertenencia institucional. Un profesor de la institución A puede leer el progreso y el perfil cognitivo de cualquier estudiante de la institución B (enumeración de IDs secuenciales).
Fix: cargar el Classroom y exigir `teacher_id == current_user.id` (o misma institución para super).

[BE-12] (IMPORTANTE) `DELETE /api/v1/classrooms/{classroom_id}/students/{student_id}` y `DELETE /api/v1/classrooms/{classroom_id}/bots/{bot_id}` sin verificación de dueño.
Causa: `classroom.py:476-498` y `classroom.py:625-646` — solo `require_teacher`; el enrollment/assignment se busca por IDs sin comprobar que la clase pertenezca al profesor actual. Cualquier profesor puede desinscribir estudiantes o quitar bots de clases ajenas (multi-institución).
Fix: validar `Classroom.teacher_id == current_user.id` antes de mutar.

[BE-13] (IMPORTANTE) `GET /api/v1/classrooms/{classroom_id}/bots` sin control de acceso al aula.
Causa: `classroom.py:591-622` — no llama `require_teacher` ni valida ownership: cualquier usuario autenticado (estudiante incluido, si su licencia trae el módulo 'neurobots') lista los bots de cualquier classroom.
Fix: exigir dueño o inscrito (como hace GET /classrooms/{id}).

[BE-14] (CRITICO) `GET /api/v1/posts/{post_id}`, `POST /posts/{post_id}/reactions`, `GET/POST /posts/{post_id}/comments` sin verificación de pertenencia al aula — fuga cross-tenant.
Causa: `backend/app/api/posts.py:198-214`, `217-251`, `254-287`, `290-329` — solo validan rol/licencia; el post se busca por ID global. Cualquier usuario de cualquier institución puede LEER posts ajenos, comentar y reaccionar en clases ajenas (IDs secuenciales). `create_post`/`delete_post` sí validan ownership.
Fix: resolver el classroom del post y exigir dueño o inscripción activa.

[BE-15] (MENOR) `POST /api/v1/classrooms/{classroom_id}/bots` (`classroom.py:522-524`) permite asignar CUALQUIER bot (incluidos bots privados de otros creadores) a la propia clase: no valida `is_public` ni `creator_id`.

[BE-16] (MENOR) Mensajes directos: el rol `admin` no tiene ninguna regla en `_can_message` (`messages.py:87-125`): un admin no puede escribir ni recibir DMs (todos los envíos a admin devuelven 403). Brecha funcional.

### Crashes runtime / datos

[BE-17] (IMPORTANTE) Hard-delete de usuarios en B2B → 500 en PostgreSQL.
Causa: `backend/app/api/credentials.py:316-317` (`DELETE /super/teachers/{id}`), `339-344` (`bulk-delete`), `698-699` (`DELETE /super/students/{id}`), `721-726` (`bulk-delete` teachers/students) hacen `db.delete(user)` sin limpiar FKs vivas (enrollments.student_id, classrooms.teacher_id, posts.teacher_id, direct_messages, learning_sessions, integrations.user_id…). En Postgres → `IntegrityError` → 500 sin manejo; en SQLite dev pasa inadvertido.
Fix: soft-delete (is_active=False) o limpieza/anonimización de registros dependientes en la misma transacción con manejo de IntegrityError.

[BE-18] (MENOR) `PATCH /api/v1/super/institution` (`super_stats.py:89-136`) permite cambiar `dane_code` sin validar unicidad → `IntegrityError` → 500 (columna unique). Falta pre-check como en `create_institution`.

[BE-19] (MENOR) `POST /api/v1/teacher/evaluations` (`teacher_evaluations.py:93-94`) `int(data.get("duration", 30))` / `int(data.get("attempts", 1))` sin validación: un string no numérico lanza ValueError → 500.

[BE-20] (MENOR) `POST /api/v1/teacher/materials/files` (`teacher_materials.py:222-262`) SIN límite de tamaño (DirectMessage limita 25 MB; aquí no hay límite): un usuario puede meter binarios de cualquier tamaño en la DB (DoS/costo).

[BE-21] (MENOR) `GET /api/v1/super/stats/security` (`super_stats.py:523-527`) filtra `AuditLog.action.in_(["login","login_success","login_failed"])` pero NINGÚN código escribe logs de auditoría con esas acciones (auth.py no registra logins) → `login_history` siempre vacío (feature muerta).
