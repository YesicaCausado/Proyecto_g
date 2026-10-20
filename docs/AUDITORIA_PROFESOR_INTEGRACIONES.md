# Auditoría del rol Profesor e integraciones de Google

Fecha: 20 de octubre de 2026. Base: `main` en `8df466a`.

Alcance real de esta pasada: integraciones de Google Drive y Google Calendar
a fondo (código, OAuth, permisos, errores), accesos cruzados entre profesores
de la misma institución, materiales compartidos, eventos institucionales y
datos de Analítica. El resto de los módulos del profesor (evaluaciones,
reportes, NeuroBots, mensajería, notificaciones) se verificó con sus pruebas
automáticas existentes y una revisión puntual, no botón por botón.

**Ninguna prueba se hizo contra Google real.** El `backend/.env` tiene
credenciales OAuth, pero completar una autorización exige que una persona
inicie sesión en Google. Todas las respuestas de Google en las pruebas están
simuladas (`unittest.mock`).

## A. Estado general

| Estado | Funcionalidades |
|---|---|
| Corregido | Conexión de Google por usuario; flujo OAuth (state sin JWT, retorno completado por el usuario autenticado, permisos por proveedor, permisos desmarcados); caducidad y revocación; errores de Google; importación de Drive con metadatos reales y sin duplicados; eventos de día completo y de fin de día; hora y fecha inválidas; Analítica sin datos mostrada como 0; webhook desconectable por un profesor |
| Verificado con pruebas | Grupos, estudiantes, evaluaciones, materiales, NeuroBots, eventos del profesor frente a otro profesor de la misma institución (26 endpoints, todos rechazan y los datos quedan intactos); material visible solo para el grupo compartido; eventos institucionales protegidos; estudiante sin acceso a funciones del profesor |
| Funciona con limitaciones | Drive: solo enlaces, no copia ni gestiona permisos. Calendar: solo listar calendarios y crear eventos; sin lectura, edición, eliminación ni sincronización con el calendario interno |
| No verificable aquí | Flujo OAuth completo contra Google, comportamiento real de Drive/Calendar API, configuración de Google Cloud Console |
| Sin implementar (según requisitos) | Pantalla de integraciones del Súper Profesor (RF-12): la ruta `/teacher` solo admite el rol profesor |

## B. Páginas del profesor

Pestañas de `TeacherPanel.tsx`: dashboard, grupos, neurobots, alertas,
tablero, evaluaciones, materiales, mensajes, calendario, configuración,
analítica, ia, integraciones, automatizaciones. Rutas adicionales:
`/classrooms`, `/classrooms/new`, `/classrooms/:id`. No se encontraron datos
simulados (`mock`, `demo`, `Math.random`) en los componentes del profesor.
Dashboard y Analítica muestran un error claro si falla `/teacher/stats`.

## C. Google Drive

**Arquitectura.** `IntegracionesTab.tsx` → `api/integrations.py` →
`services/integration_service.py` → Drive API v3 por HTTP (`httpx`). Tokens
cifrados con Fernet (clave derivada de `SECRET_KEY`) en la tabla
`integrations`; nunca se devuelven al navegador.

**Flujo OAuth (nuevo).**
1. `POST /integrations/google/drive/connect` (con JWT) devuelve la URL de Google
   con un `state` firmado con HMAC: usuario, proveedor, nonce y caducidad de 15 min.
2. Google devuelve el navegador a `GET /integrations/google/callback`. El
   callback valida el `state` y **no guarda nada**: reenvía `code` y `state` a
   `FRONTEND_URL/#/teacher?tab=integraciones` (la parte tras `#` no viaja a
   servidores ni en `Referer`).
3. El frontend borra los parámetros de la barra de direcciones y llama a
   `POST /integrations/google/complete` con la sesión del usuario. El backend
   exige que el usuario autenticado sea el del `state`, canjea el código,
   comprueba los permisos concedidos y guarda la conexión **de ese usuario**.

**Scopes.** Drive: `openid email drive.readonly`. Antes se pedían también
los de Calendar, y sin `email` el perfil no traía el correo.

**Operaciones reales.** Listar carpetas (con paginación, hasta 1.000), listar
archivos de una carpeta, guardar la carpeta elegida, importar archivos como
enlace, desconectar (revoca el token en Google).

**Relación con Materiales.**
- Se guarda **solo una referencia**: el `webViewLink` real del archivo en
  `teacher_materials.original_name` con `mime_type = "drive-link"`. No se copia
  el binario.
- Al importar, cada archivo se consulta en Drive (`files.get`) con la cuenta
  del profesor: el nombre es el real, un archivo inexistente, en la papelera
  o sin acceso se rechaza, y no se duplica un enlace ya importado.
- NeuroLearn **no cambia permisos en Drive**. El estudiante abre el enlace
  con su propia cuenta de Google; si el archivo no está compartido con él, Drive
  le pide acceso. Al importar, la interfaz avisa qué archivos no están
  compartidos («restricted»); si la cuenta no es propietaria no puede ver los
  permisos y también se avisa.
- Si se borra el original en Drive, el enlace queda roto (no hay sincronización).
- Retirar el material de un grupo o borrarlo no toca el archivo en Drive.
- Desconectar Drive conserva los materiales ya importados.

## D. Google Calendar

**Arquitectura y OAuth.** Igual que Drive. Scopes: `openid email
calendar.readonly` (necesario para `calendarList`) y `calendar.events`
(necesario para crear eventos).

**Lectura.** Solo la lista de calendarios (con zona horaria y si la cuenta
puede escribir). **No se leen eventos de Google.**

**Escritura.** Solo creación (`events.insert`), desde Integraciones o desde
una automatización «Google Calendar». No hay edición ni eliminación.
- Día completo: el fin es el día siguiente (Google lo exige; antes respondía 400).
- Con hora: duración de 1 h, puede terminar al día siguiente (antes 23:30
  generaba un fin anterior al inicio). Zona horaria: la del calendario en
  Google; si no se obtiene, la de la institución.
- Fecha u hora inválidas → 400 (antes una hora inválida se convertía en 09:00).
- Los calendarios de solo lectura ya no se ofrecen para crear eventos.

**Relación con el calendario de NeuroLearn: son independientes.** Los eventos
internos (`classroom_events`) no se envían a Google ni los de Google se
importan. No hay sincronización, ni detección de cambios, duplicados o
reintentos. Por eso la integración no puede modificar eventos institucionales
del Súper Profesor. Se corrigió el texto «sincroniza tus actividades», que no
era cierto.

**Automatizaciones.** La acción «Google Calendar» usa ahora el Calendar de
quien creó la automatización (antes el de cualquier docente de la institución).

## E. Botones y acciones de Integraciones

| Acción | Endpoint | Clasificación |
|---|---|---|
| Conectar Drive / Calendar | `POST /integrations/google/{p}/connect` + `/complete` | Funcional en código y pruebas simuladas; no verificable contra Google |
| Desconectar | `DELETE /integrations/{p}` | Funcional (avisa si Google no confirma la revocación) |
| Seleccionar carpeta / ver archivos | `GET …/drive/folders`, `…/folders/{id}/files` | Funcional (pruebas simuladas) |
| Importar | `POST …/drive/import` | Funcional (pruebas simuladas) |
| Cambiar calendario / Usar | `GET …/calendar/calendars`, `POST …/calendar/select` | Funcional (pruebas simuladas) |
| Nuevo evento | `POST …/calendar/events` | Funcional (pruebas simuladas) |
| Ir a Automatizaciones | navegación interna | Funcional |

## F. Matriz de permisos (integraciones)

| Recurso | Administrador | Súper Profesor | Profesor | Estudiante |
|---|---|---|---|---|
| Su propia conexión Drive/Calendar | API sí, sin pantalla | API sí, sin pantalla | Sí | No (403) |
| Conexión Google de otro usuario | No | No | No (no la ve; 400/404) | No |
| Webhook institucional | Sí | Sí | No (403, también al desconectar) | No |
| Sus automatizaciones | Sí, y las de su institución | Sí, y las de su institución | Solo las propias | No |
| Eventos institucionales | — | Crea y edita | Solo lectura | Solo lectura |

El resto de la matriz por rol está en `docs/MATRIZ_PERMISOS.md` y no cambió.

## G. Datos de Analítica

`GET /teacher/stats` (`api/teacher_stats.py`) calcula con `QuizHistory`,
`Enrollment`, `LearningSession` y `ExpertBot` de los grupos activos del
profesor. «Índice de Salud» = promedio de `performance_score`; sin quizzes el
backend devuelve `score: null` y ahora la pantalla dice que no hay datos en
vez de mostrar 0 y «0/10».

## H. Hallazgos

| ID | Gravedad | Módulo | Ubicación | Causa raíz e impacto | Corrección | Prueba |
|---|---|---|---|---|---|---|
| P1 | Crítica | Integraciones | `api/integrations.py` (todas las consultas de Google) | Las conexiones de Google se buscaban solo por institución. Un profesor veía el correo de otro, navegaba su Drive, importaba sus archivos, creaba eventos en su Calendar y podía desconectarlo; al reconectar, sobrescribía la conexión del otro | Consultas por `institution_id` + `user_id` (`user_google_integration`) | `test_la_conexion_de_google_es_de_cada_profesor` |
| P2 | Alta | OAuth | `connect_google`, `_sign_state` | El JWT de la sesión viajaba dentro del `state` hacia Google (URL, historial, registros) | El `state` ya no lleva el token | `test_state_sin_jwt_y_permisos_por_proveedor` |
| P3 | Alta | OAuth | `google_callback` | El callback guardaba los tokens a nombre de quien figuraba en el `state`: enviando su enlace de autorización a otra persona, un usuario podía quedarse con el Drive/Calendar de la víctima (CSRF de OAuth) | El callback solo reenvía el código; `POST /integrations/google/complete` exige que el usuario autenticado sea el que inició el flujo | `test_callback_no_guarda_y_reenvia_el_codigo`, `test_completar_solo_quien_inicio` |
| P4 | Media | OAuth | `config.py` `GOOGLE_SCOPES` | Conectar Drive pedía permisos de Calendar y viceversa; sin `email` no se mostraba la cuenta | `GOOGLE_DRIVE_SCOPES` / `GOOGLE_CALENDAR_SCOPES` | misma |
| P5 | Media | OAuth | `google_callback` | Si el usuario desmarcaba permisos en Google, la integración quedaba «conectada» y todo fallaba | Se comprueba `scope`; si falta alguno se revoca y no se guarda | `test_permisos_desmarcados_no_quedan_conectados` |
| P6 | Media | Integraciones | `_get_valid_access_token`, llamadas a Google | Un token revocado seguía «Conectado»; fallos de red marcaban la conexión como caducada; los errores devolvían la respuesta cruda de Google | `GoogleAPIError` y `_google_request`: 401 → `token_expired` (409 al frontend para no cerrar la sesión de NeuroLearn), 403/404/429 con mensajes claros | `test_401_de_google_marca_token_expirado`, `test_refresh_revocado_marca_token_expirado` |
| P7 | Media | Drive | `drive_folders` | `except isvc.RuntimeError` no existe: cualquier error terminaba en un 500 sin mensaje | Manejo uniforme con `_google_http_error` | idem |
| P8 | Media | Drive | `drive_import_files` | Se importaba sin Drive conectado, con nombres enviados por el cliente, sin comprobar que el archivo existiera, y con duplicados | Consulta real `files.get`, deduplicación, aviso de archivos no compartidos | `test_importar_usa_metadatos_reales_y_no_duplica` |
| P9 | Baja | Drive | `list_drive_*` | Sin paginación (solo 100); `folder_id` sin validar dentro de la consulta `q` | Paginación y validación | `test_drive_pagina_y_valida_carpeta` |
| P10 | Media | Calendar | `create_google_calendar_event` | Eventos de día completo con fin = inicio (Google responde 400); 23:30 + 1 h con fecha errónea; hora inválida → 09:00; zona fija | `build_event_body` y zona del calendario | `test_cuerpo_de_eventos`, `test_crear_evento_usa_la_zona_del_calendario` |
| P11 | Media | Automatizaciones | `_action_google_calendar` | Usaba el Calendar de cualquier docente de la institución | Calendar del autor | `test_automatizacion_usa_el_calendar_de_quien_la_creo` |
| P12 | Media | Webhook | `disconnect_integration` | Un profesor podía desconectar el webhook institucional | Solo Súper Profesor / Administrador | `test_profesor_no_desconecta_el_webhook` |
| P13 | Baja | Analítica | `AnaliticaTab.tsx` | Sin datos se mostraba índice 0 y «0/10» | Estado vacío | revisión + `tsc` |
| P14 | Baja | Integraciones (UI) | `IntegracionesTab.tsx` | «Sincroniza tus actividades» no era cierto; no se avisaba de conexiones caducadas | Textos exactos y aviso de reconexión | revisión |
| O1 | Observación | NeuroBots | `GET /bots/{id}/progress` | Otro profesor de la institución obtiene el nombre de un bot privado ajeno (sin datos de estudiantes). Es el comportamiento que fija `test_neurobots_notificaciones`; no se cambió | — | `test_otro_profesor_no_accede_a_recursos_ajenos` |
| O2 | Observación | PWA | `vite.config.ts` | El error `/api/v1/integrations/google/assets/*.css` con `application/json` ya estaba corregido (parche 14A: `navigateFallbackDenylist`) y cubierto por `test_google_oauth_retorno.py`. Causa: `base: './'` + el service worker devolvía `index.html` en la ruta del callback | — | test existente |

## I. Archivos modificados

- `backend/app/services/integration_service.py`: conexión por usuario, state, scopes, errores de Google, paginación, metadatos de Drive, eventos, revocación, automatizaciones.
- `backend/app/api/integrations.py`: endpoints por usuario, nuevo `POST /integrations/google/complete`, callback sin efectos, desconexión.
- `backend/app/core/config.py`, `.env.example`, `docs/VARIABLES_ENTORNO.md`: scopes por proveedor.
- `frontend/src/pages/teacher/components/IntegracionesTab.tsx`: completar la conexión, avisos de permisos y caducidad, calendarios de solo lectura, textos.
- `frontend/src/pages/teacher/TeacherPanel.tsx`: abre Integraciones al volver de Google.
- `frontend/src/pages/teacher/components/AnaliticaTab.tsx`: estado vacío.
- `backend/tests/test_google_por_usuario.py` (nuevo, 14 pruebas), `backend/tests/test_profesor_accesos_cruzados.py` (nuevo, 4), `backend/tests/test_integraciones_profesor.py` (importar exige Drive conectado).

No hay migraciones: la tabla ya tenía `user_id`.

## J. Pruebas ejecutadas

| Comando | Resultado |
|---|---|
| `cd backend && .venv\Scripts\python.exe -m pytest` (antes) | 220 pasan |
| `cd backend && .venv\Scripts\python.exe -m pytest` (después) | 238 pasan, 0 fallan |
| `cd frontend && npx tsc -b` | Sin errores |
| `cd frontend && npm run build` | Compila |
| `npx eslint` en los 3 archivos tocados | Mismos errores que en `HEAD` (8, 2 y 7, todos previos, sobre todo `no-explicit-any`) |

No realizadas: OAuth y operaciones reales con Google, pruebas en navegador
(consola y red), pruebas E2E (el proyecto no tiene).

## K. Configuración externa pendiente (Google Cloud Console)

1. Habilitar **Google Drive API** y **Google Calendar API** en el proyecto.
2. En «Credenciales», URI de redireccionamiento autorizado exactamente igual a
   `GOOGLE_REDIRECT_URI` (producción: `https://<dominio>/api/v1/integrations/google/callback`;
   local: `http://localhost:8000/api/v1/integrations/google/callback`).
3. Pantalla de consentimiento: declarar `openid`, `email`, `drive.readonly`,
   `calendar.readonly` y `calendar.events`. `drive.readonly` es un alcance
   restringido: en producción con usuarios externos exige verificación de
   Google; mientras tanto, modo «Prueba» con usuarios de prueba registrados.
4. En Vercel: `FRONTEND_URL` con el dominio público; se puede borrar
   `GOOGLE_SCOPES` si existe.

## L. Pendientes reales

- Prueba manual de extremo a extremo con una cuenta de prueba de Google (escenarios C y D del plan).
- Las conexiones existentes pasan a ser de quien las hizo; los demás profesores deben conectar su propia cuenta.
- El código de autorización de Google pasa por la URL del frontend unos instantes (se borra al cargar; es de un solo uso y requiere el secreto del servidor).
- App Android (Capacitor): el retorno de Google va a `FRONTEND_URL` web, no a la app.
- Súper Profesor sin pantalla de integraciones (RF-12).
- Calendar sin lectura de eventos ni sincronización con el calendario interno; Drive sin gestión de permisos. Son decisiones de alcance, no errores.
- `frontend/public/sw.js` no se usa (lo reemplaza el `sw.js` que genera vite-plugin-pwa).
- Si un promedio real fuera exactamente 0, `teacher_stats` lo trata como «sin datos».

## M. Criterios de aceptación

Cumplidos: aislamiento entre profesores en el backend, credenciales cifradas y
fuera del navegador, errores de Google claros, sin datos inventados en
Integraciones y Analítica, rutas y recursos del retorno OAuth correctos,
pruebas ejecutables completadas. **No cumplido:** verificación real contra
Google, que depende de la configuración y de una cuenta de prueba (apartado K).
No se afirma que el rol Profesor esté al 100 %.
