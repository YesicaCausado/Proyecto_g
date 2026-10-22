# Auditoría del rol Estudiante

> Fecha: 20 de octubre de 2026 · Rama `main` (base `c3cb7f8`) · Alcance: las 17
> rutas del estudiante, sus endpoints y su relación con Profesor y Súper Profesor.

## A. Estado general y evidencia

No se da un porcentaje. La evidencia es:

- **Backend:** 246 pruebas automáticas pasan (`python -m pytest`; antes de la
  auditoría eran 238). Las 8 nuevas están en `tests/test_auditoria_estudiante.py`.
- **Frontend:** `tsc` sin errores; `eslint` sin errores nuevos en los archivos
  tocados. En `QuizzesPage.tsx` quedan 4 `any` que ya existían.
- **No hubo pruebas en el navegador ni contra Supabase:** el entorno no tiene
  navegador, base PostgreSQL real ni clave de IA. Ninguna interacción visual
  se declara probada a mano. Los flujos se verificaron con el cliente HTTP de
  FastAPI sobre SQLite en memoria.

| Estado | Elementos |
|---|---|
| Verificado sin cambios | Inicio de sesión, cierre de sesión y protección de rutas (`ProtectedRoute` + 401 → login, caché por token), evaluaciones (intentos, tiempo, doble envío, corrección solo al cerrar), chat del tutor (propiedad de conversaciones, NeuroBot validado con `can_use_bot`), NeuroBots asignados, Material del profesor (descarga autorizada), calendario (permisos en el servidor), consentimientos, notificaciones (solo las propias) |
| Corregido y verificado con pruebas | Desafíos (quizzes), progreso por grupo, conversaciones con NeuroBot, inscripción por código, mensajería (eliminar mensajes y adjuntos), notificaciones del Tablero |
| Corregido (solo frontend, sin prueba automática) | Dashboard, Mis Clases, Detalle de clase, Mi Desempeño (mensaje de error) |
| Sin licencias | Comprobado: no queda ninguna verificación por plan o licencia. El único límite es el **cupo del grupo** (`max_students`), que es una regla del grupo, no comercial. |
| No verificable aquí | Respuestas reales de Groq/Gemini, cámara y micrófono en un navegador, migraciones en Supabase |

## B. Hallazgos y correcciones

| # | Gravedad | Módulo | Problema | Corrección |
|---|---|---|---|---|
| E1 | Alta | Desafíos | `POST /chat/generate-quiz` enviaba al navegador la **respuesta correcta y la explicación** de cada pregunta antes de responder (visibles en las herramientas del navegador). Esas notas alimentan Desempeño, el progreso del grupo y los reportes del profesor y del Súper Profesor. Además, si la respuesta no coincidía con una opción, la pantalla marcaba la opción A como correcta. | El quiz llega sin respuestas (`QuizPublicResponse`: `quiz_id`, preguntas y opciones). `submit-quiz` devuelve `review` con la letra correcta, la explicación y si acertó; la pantalla muestra **la corrección del servidor**, la misma que se guarda. |
| E2 | Alta | Progreso por grupo | El avance, el promedio, las sesiones y el riesgo de cada inscripción (`Enrollment`) **nunca se actualizaban**: `submit-quiz` solo los recalculaba si el cliente enviaba `classroom_id`, y el frontend nunca lo envía, aunque el servidor ya había asignado el grupo al generar el quiz. «Tu progreso» del estudiante y el progreso que ve el profesor quedaban siempre en 0. | Se usa el grupo que el servidor asignó al quiz (tras volver a validar la inscripción activa). También se suma el tiempo medido (`total_time_minutes` tampoco cambiaba nunca). |
| E3 | Alta | Mensajes | El modelo `DirectMessage` **no declaraba** las columnas `deleted_for_sender/receiver/all`: el archivo solo las describía en un texto (que además se imprimía al importar). «Eliminar para mí» no se guardaba (el mensaje reaparecía al recargar) y «Eliminar para todos» solo vaciaba el texto. | Columnas declaradas (la migración `migrations/applied/delete_fields.sql` ya existía y se añadió también a `app/db/migrate.py`). Se quitó el texto suelto. |
| E4 | Media | Mensajes | Tras «Eliminar para todos», el **archivo adjunto** seguía descargable por el receptor en `/messages/{id}/attachment`. | Se borra el adjunto; la descarga responde 404 si el mensaje se eliminó para todos o para quien lo pide. La vista previa de la lista ya no muestra mensajes eliminados para mí y el contador de no leídos los excluye. |
| E5 | Media | Mis Clases | Un estudiante podía **unirse a un grupo de otra institución** con un código filtrado. Al reactivar una inscripción no se revisaba el cupo. | El código solo sirve para grupos de profesores de la propia institución (otro colegio responde igual que un código inexistente). El cupo se revisa también al reactivar. |
| E6 | Baja | Chat | `POST /chat/conversations` aceptaba cualquier `bot_id`, incluso de un NeuroBot no autorizado (el chat lo rechazaba después, pero la conversación quedaba creada y listada). | Misma validación que el chat: 404 si no existe, 403 si no lo puede usar. |
| E7 | Media | Tablero | Las publicaciones del profesor (tareas, anuncios, recordatorios) **no generaban notificación**: el estudiante solo se enteraba si abría el Tablero. | Nueva notificación `publicacion_tablero` para los estudiantes activos del grupo, en la misma transacción, con enlace a `/tablero` y fecha límite si la hay. Respeta la preferencia «Nueva actividad». |
| E8 | Media | Dashboard | NeuroInsights mostraba «Carga cognitiva» con el valor **invertido** (100 − sobrecarga: una carga alta aparecía baja) y «Dominio activo» era en realidad 100 − fatiga. | Mismos indicadores y escala que «Mi Desempeño › Análisis IA»: Dominio, Fatiga, Duda y Carga de trabajo, con la nota «Estimación experimental; no es un diagnóstico». |
| E9 | Media | Dashboard | Si fallaba la API se mostraba «Progreso 0 %» y «Estás a 100 % de tu meta»; una materia con nota real 0 % aparecía como «—»; las recomendaciones por fatiga/duda se evaluaban aunque no hubiera medición. Las «Clases recientes» parecían enlaces pero no navegaban. Se pedía `/bots/` y se descartaba el resultado. | Aviso de error en lugar de ceros; «—» solo cuando no hay quizzes; recomendaciones cognitivas solo con medición válida; «Completa tu primer quiz» lleva a Desafíos; las clases enlazan al detalle; se quitó la petición sobrante. |
| E10 | Baja | Desafíos | Si `submit-quiz` fallaba, la pantalla mostraba igual una nota calculada en el navegador (que no quedó guardada). Los errores se mostraban con `alert()` genérico. Si el quiz no se podía guardar, se entregaba igual y luego no se podía enviar (404). | Sin respuesta del servidor no hay nota: se muestra el error y se puede reintentar. El mensaje del servidor se ve en la página. Si no se guarda el quiz → 503 claro. El envío va por `quiz_id` y un doble envío responde 409 (antes podía calificar otro quiz pendiente con el mismo título). |
| E11 | Baja | Detalle de clase | Mostraba «Avance 0 %» y «Promedio 0.0» sin datos, y listaba NeuroBots desactivados (el chat los rechazaba). | Estado vacío explicativo; «Sesiones» pasa a «Quizzes» (es lo que cuenta); solo bots activos. La vista del profesor sigue viendo los desactivados para poder quitarlos. |
| E12 | Baja | Mis Clases / Desempeño | Un error de red se mostraba como «No estás inscrito en ninguna clase»; la petición se lanzaba durante el render. Desempeño decía «Verifica que el backend esté corriendo en localhost:8000». | Aviso de error con «Reintentar»; carga en `useEffect`; mensaje comprensible para el estudiante. |

También se quitaron dos `console.log` de depuración del chat.

## C. Inventario de rutas del estudiante

| Ruta | Página | Endpoints | Resultado |
|---|---|---|---|
| `/dashboard` | `StudentDashboard` | `/classrooms/my-enrolled`, `/stats/dashboard`, `/stats/performance` | Corregido (E8, E9) |
| `/chat`, `/chat/:slug` | `ChatPage` | `/chat/start`, `/chat/message`, `/chat/conversations*`, `/chat/patterns*`, `/consents/me` | Verificado; E6 |
| `/bots`, `/bots/:botId` | `BotsPage`, `NeuroBotDetailPage` | `/bots/assigned-to-me*`, `/bots/shared-with-me` | Verificado |
| `/quizzes`, `/quizzes/history` | `QuizzesPage` | `/chat/generate-quiz`, `/chat/submit-quiz`, `/chat/quiz-history` | Corregido (E1, E2, E10) |
| `/performance` | `DesempenoPage` | `/stats/performance` | Verificado (indicadores con `null` sin datos); E12 |
| `/material` | `MaterialPage` + `TeacherMaterials` | `/student/materials*` | Verificado. Los 6 PDF de la biblioteca Saber 11 existen en `public/material/`; los enlaces externos son a ICFES, Khan Academy y Colombia Aprende |
| `/my-classes`, `/my-classes/:id` | `MyClassesPage`, `ClassroomPage` | `/classrooms/my-enrolled`, `/classrooms/join`, `/classrooms/{id}/student-detail`, `/student/evaluations` | Corregido (E5, E11, E12) |
| `/evaluations` | `EvaluationsPage` | `/student/evaluations*` | Verificado (guardado automático, temporizador del servidor, envío atómico) |
| `/tablero` | `TableroPage` | `/posts`, reacciones, comentarios, descarga de adjuntos | Verificado; E7 |
| `/calendar` | `CalendarPage` | `/events` (solo eventos personales editables) | Verificado (`test_calendar_permissions.py`) |
| `/messages` | `Messaging` | `/messages/*` | Corregido (E3, E4) |
| `/settings` | `ProfileSettings` + `PrivacyConsents` | `/auth/me`, `/auth/change-password`, `/notifications/preferences`, `/consents*` | Verificado |
| Campana | `NotificationsPanel` | `/notifications*` | Verificado: los enlaces de las notificaciones del estudiante (`/evaluations?id=`, `/material`, `/bots/{id}`, `/quizzes`, `/performance`, `/messages?with=`, `/tablero`) existen y abren el elemento |

## D. Aislamiento entre estudiantes (prueba G del encargo)

`test_otro_estudiante_no_accede_a_recursos_ajenos`: con dos estudiantes de la
misma institución en grupos distintos, el segundo intenta 26 operaciones con
los identificadores del primero (leer/renombrar/eliminar su conversación del
tutor; ver, iniciar, guardar y enviar su evaluación; enviar su quiz; leer y
escribir sus mensajes; descargar su adjunto; marcar su notificación; editar su
evento personal; ver su grupo y su material; usar un NeuroBot no asignado) y
endpoints de profesor, Súper Profesor y administrador. Todas responden 4xx,
ninguna respuesta contiene datos del primero y sus registros quedan intactos.
Los 10 listados del segundo estudiante tampoco contienen nada del primero.

## E. Pendientes y decisiones

- **Migración en Supabase:** comprobar que `direct_messages` tenga las tres
  columnas `deleted_for_*` (`delete_fields.sql`; `app/db/migrate.py` las añade
  si faltan). Si no estaban, los borrados anteriores no quedaron guardados.
- **Quizzes y grupos:** un quiz se asocia a un grupo solo si el estudiante está
  en **un único** grupo de esa competencia. Con dos o más, el resultado cuenta
  en su desempeño, pero no en el progreso de ningún grupo. Decidir si se pide al
  estudiante que elija el grupo.
- **Reingreso tras ser retirado:** un estudiante retirado por el profesor puede
  volver con el mismo código. El profesor puede generar un código nuevo
  («Nuevo código»). Decidir si el retiro debe bloquear el reingreso.
- **Panel neuroconductual y patrones neurodigitales:** no se volvieron a
  auditar a fondo. Su última revisión es `docs/AUDITORIA_PATRONES_NEURODIGITALES.md`
  y sus pruebas (`test_patrones_neurodigitales.py`, `test_patterns.py`,
  `test_consentimientos.py`) siguen pasando.
- **Pruebas de extremo a extremo en navegador** (flujos A a F del encargo): no
  ejecutadas por falta de navegador, base real y clave de IA. Se necesitan un
  despliegue de prueba, un profesor y dos estudiantes de prueba, y `GROQ_API_KEY`.

## F. Archivos modificados

Backend: `app/api/chat.py`, `app/api/classroom.py`, `app/api/conversations.py`,
`app/api/messages.py`, `app/api/posts.py`, `app/db/migrate.py`,
`app/models/messages.py`, `app/schemas/schemas.py`,
`app/services/enrollment_tracking_service.py`,
`app/services/notification_service.py`, `tests/test_auditoria_estudiante.py` (nuevo).

Frontend: `pages/student/QuizzesPage.tsx`, `StudentDashboard.tsx`,
`ClassroomPage.tsx`, `MyClassesPage.tsx`, `DesempenoPage.tsx`, `ChatPage.tsx`.
