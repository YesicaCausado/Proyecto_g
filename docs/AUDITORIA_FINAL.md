# Auditoría final de NeuroLearn IA (parche 14)

Fecha: 11 de octubre de 2026. Base revisada: `main` en el commit `ebef85d`
(después del parche 14D de la landing).

## Cómo se hizo

Primero se analizó todo sin modificar nada:

1. **Endpoints contra pantallas.** Se listaron los 179 endpoints del backend
   (esquema OpenAPI) y se compararon con las 152 llamadas distintas que hace el
   frontend. No hay llamadas a rutas que no existan (sin 404 por rutas
   inexistentes). Los endpoints sin pantalla se anotaron como pendientes.
2. **Prueba de aislamiento entre instituciones.** Un script crea dos colegios
   completos (Súper Profesor, profesor, estudiante, grupo, NeuroBot,
   documento, evaluación, entrega, publicación, evento, mensaje, material y
   conversación) y hace que los usuarios del colegio B llamen a **todos** los
   endpoints con los identificadores del colegio A, buscando respuestas
   exitosas o datos de A en la respuesta.
3. **Búsqueda de simulaciones.** Revisión del código de los cuatro paneles
   en busca de botones que solo cambian la pantalla, datos fijos o
   inventados, mensajes de «próximamente», errores que no se muestran y
   cambios que no se guardan.
4. **Revisión por flujo.** Administrador, Súper Profesor, Profesor,
   Estudiante, neurodigital (consentimiento, cámara, micrófono, métricas) y
   autenticación (login, sesión, recuperación, cambio de contraseña,
   permisos).

## 1. Funcionalidades auditadas

| Flujo | Resultado de la revisión |
|---|---|
| Administrador: instituciones, usuarios, NeuroBots base, auditoría | Funcionan con datos reales. La configuración del sistema guardaba cambios que se perdían (corregido). |
| Súper Profesor: profesores, estudiantes, carga CSV, NeuroBots, alertas, reportes, mensajería, calendario, configuración | Funcionan con datos reales. |
| Súper Profesor: grupos | Eliminar, activar/desactivar y transferir eran simulados; «Ver detalle» no existía (corregido). |
| Súper Profesor: seguridad | Sesiones con botones que no hacían nada, ubicación inventada, historial siempre vacío y 2FA decorativo (corregido). |
| Profesor: grupos, NeuroBots, documentos, uso del conocimiento, preguntas con IA, evaluaciones, resultados, reportes | Funcionan; ya los cubrían los parches 8 a 14C y sus pruebas. |
| Estudiante: dashboard, NeuroBots, chat, tablero, evaluaciones, quizzes, material, desempeño | Funcionan. Los quizzes podían inventar la respuesta correcta (corregido). |
| Neurodigital | Consentimiento, cámara, micrófono, teclado y métricas funcionan y solo se guardan indicadores. Faltaba la autorización del acudiente para menores (corregido). |
| Autenticación | Login, recuperación por correo, cambio de contraseña y permisos por rol funcionan. No existía forma de cerrar una sesión robada (corregido). |
| Aislamiento entre instituciones | Había fugas en grupos, publicaciones y mensajería del Súper Profesor (corregido). El resto de endpoints rechaza correctamente. |

## 2. Errores encontrados

| # | Gravedad | Error |
|---|---|---|
| E1 | Alta | La clave de Azure Speech (`VITE_AZURE_SPEECH_KEY`) quedaba dentro del JavaScript público. |
| E2 | Alta | Un Súper Profesor podía ver grupos de **otra** institución (con su código de invitación) y ver o reaccionar a sus publicaciones. |
| E3 | Media | Un Súper Profesor podía escribir a usuarios de otras instituciones, y cualquiera podía ver el nombre y rol de un usuario ajeno conociendo su número. |
| E4 | Alta | Menores de edad podían activar cámara y micrófono sin que constara la autorización del acudiente (Ley 1581 de 2012). |
| E5 | Media | La caché de lecturas del frontend (15 s) no distinguía usuarios: quien entraba después en el mismo equipo podía ver datos de la cuenta anterior. Además, tras guardar algo, la pantalla podía seguir mostrando el dato viejo. |
| E6 | Media | Grupos del Súper Profesor: «Eliminar», «Activar/Desactivar» y «Transferir» solo cambiaban la pantalla; «Ver detalle» decía «disponible próximamente»; los grupos inactivos no aparecían aunque existía el filtro «inactivo». |
| E7 | Media | Seguridad del Súper Profesor: «Cerrar sesión» solo mostraba un aviso; la ubicación decía «Colombia» para todos; el historial de accesos siempre estaba vacío porque el login no lo registraba; los intentos fallidos se habrían mostrado como «exitoso»; el interruptor de 2FA era decorativo. |
| E8 | Media | Configuración del sistema (Administrador): los cambios vivían en la memoria de una instancia de Vercel y se perdían; además permitía activar el modo debug en producción. |
| E9 | Media | Al generar un quiz, si la IA no daba la respuesta correcta (o no coincidía con las opciones) se marcaba como correcta la primera opción. |

## 3. Errores corregidos

| # | Corrección |
|---|---|
| E1 | Nuevo `POST /api/v1/voice/tts`: el backend pide el audio a Azure con la clave guardada en el servidor (límite de 30 solicitudes por minuto y por usuario). El frontend ya no lee ninguna variable de Azure. Sin clave o si Azure falla, el tutor usa la voz del navegador como antes. |
| E2 | `can_manage_classroom` y el acceso a publicaciones solo dejan pasar al Súper Profesor si el profesor del grupo es de su institución. |
| E3 | La mensajería del Súper Profesor queda dentro de su institución; ver una conversación con alguien con quien no se puede hablar responde 404. |
| E4 | Autorización del acudiente: el Súper Profesor la registra (nombre del acudiente, fecha y quién la registró). Sin ella, un estudiante menor o sin fecha de nacimiento no puede aceptar el consentimiento (403) y el chat ignora sus datos de cámara y micrófono. El estudiante ve el motivo en el chat y en Mi Perfil; la lista de estudiantes marca «Falta autorización del acudiente». |
| E5 | La caché incluye el token del usuario, se vacía en cada escritura, al cerrar sesión y ante un 401. |
| E6 | Nuevos `GET` y `PATCH /super/classrooms/{id}`: detalle con profesor y estudiantes; activar o desactivar; transferir solo a profesores activos de la misma institución. Todo queda en la auditoría. Se quitó «Eliminar», porque en el sistema eliminar un grupo ya equivale a desactivarlo y así no se pierden evaluaciones ni conversaciones. |
| E7 | Cierre real de sesiones: los tokens llevan su fecha de emisión y `users.sessions_valid_after` invalida los anteriores. `POST /auth/logout-all` («Cerrar mis otras sesiones») y `POST /super/users/{id}/revoke-sessions`. Al restablecer la contraseña por correo se cierran todas las sesiones. El login registra los accesos exitosos y fallidos. Se quitó la ubicación inventada y el interruptor de 2FA. |
| E8 | Se eliminó `PATCH /admin/config`; la pantalla muestra los valores reales y explica que se cambian con variables de entorno en Vercel. |
| E9 | Se descartan las preguntas sin respuesta válida; si no queda ninguna, o si no hay proveedor de IA, se responde con un error claro (503) en vez de un quiz inventado. |

## 4. Archivos modificados

Backend:
`app/api/auth.py`, `app/api/chat.py`, `app/api/classroom.py`,
`app/api/consents.py`, `app/api/credentials.py`, `app/api/messages.py`,
`app/api/posts.py`, `app/api/super_stats.py`, `app/api/admin_users.py`,
`app/api/voice.py` (nuevo), `app/core/config.py`, `app/db/migrate.py`,
`app/main.py`, `app/models/user.py`, `app/schemas/schemas.py`,
`app/services/consent_service.py`, `app/services/password_reset_service.py`,
`migrations/applied/012_auditoria_sesiones_acudiente.sql` (nuevo),
`migrations/README.md`, `tests/test_auditoria_final.py` (nuevo),
`tests/test_consentimientos.py`.

Frontend:
`services/api.ts`, `context/AuthContext.tsx`, `hooks/useVoiceTutor.ts`,
`hooks/useConsents.ts`, `components/ConsentModal.tsx`,
`components/PrivacyConsents.tsx`, `pages/student/ChatPage.tsx`,
`pages/admin/SystemConfig.tsx`, `pages/super/SuperDashboard.tsx`,
`pages/super/components/GruposTab.tsx`,
`pages/super/components/SeguridadTab.tsx`,
`pages/super/components/UsersTabs.tsx`.

Documentación: `PLAN.md`, `docs/AUDITORIA_FINAL.md` (este archivo),
`docs/PRIVACIDAD_CONSENTIMIENTO.md`, `docs/VARIABLES_ENTORNO.md`,
`docs/PRUEBAS.md`, `docs/RECUPERACION_CONTRASENA_BREVO.md`.

## 5. Endpoints creados o modificados

| Método | Ruta | Cambio |
|---|---|---|
| POST | `/api/v1/voice/tts` | Nuevo. Audio del tutor desde Azure por el servidor. |
| POST | `/api/v1/auth/logout-all` | Nuevo. Cierra las sesiones en los demás dispositivos y devuelve un token nuevo. |
| POST | `/api/v1/super/users/{id}/revoke-sessions` | Nuevo. El Súper Profesor cierra las sesiones de un usuario de su institución. |
| GET | `/api/v1/super/classrooms/{id}` | Nuevo. Detalle del grupo. |
| PATCH | `/api/v1/super/classrooms/{id}` | Nuevo. Activar, desactivar o transferir. |
| GET | `/api/v1/super/classrooms` | Incluye grupos inactivos y el id del profesor. |
| GET | `/api/v1/super/stats/security` | Datos reales; sin ubicación inventada; marca al usuario actual y las sesiones cerradas. |
| POST | `/api/v1/auth/login` | Registra el acceso (exitoso o fallido) y el token incluye `iat`. |
| PUT | `/api/v1/super/students/{id}` | Acepta `guardian_name` y `guardian_authorized`. |
| GET | `/api/v1/super/students` | Devuelve `guardian_required`, `guardian_authorized` y `guardian_name`. |
| GET/POST | `/api/v1/consents/me`, `/api/v1/consents` | Informan y aplican la autorización del acudiente (403 si falta). |
| POST | `/api/v1/chat/generate-quiz` | 503 sin IA; descarta preguntas sin respuesta válida. |
| GET/POST | `/api/v1/classrooms/{id}…`, `/api/v1/posts/{id}…`, `/api/v1/messages/…` | Aislamiento por institución para el Súper Profesor. |
| PATCH | `/api/v1/admin/config` | **Eliminado.** |

## 6. Modelos modificados

`users` (migración 012):

- `sessions_valid_after` (TIMESTAMP): tokens emitidos antes no valen.
- `guardian_name` (VARCHAR 150), `guardian_authorized_at` (TIMESTAMP),
  `guardian_authorized_by_id` (INTEGER): autorización del acudiente.

## 7. Pruebas realizadas

- Suite del backend completa: `python -m pytest -q`.
- Nueva `tests/test_auditoria_final.py` (10 pruebas) con un caso por cada
  corrección, incluidos los intentos desde la otra institución.
- Prueba de aislamiento contra todos los endpoints con parámetros, repetida
  después de las correcciones.
- Comprobación de tipos del frontend (TypeScript) contra la base: sin errores
  nuevos.
- El parche se aplicó con `git am` sobre una copia limpia de `main`.

## 8. Resultados

- Backend: **169 pruebas pasan** (antes 159).
- Prueba de aislamiento: sin fugas entre instituciones. Solo queda
  `POST /messages/conversations/{id}/read`, que responde 200 pero no lee ni
  cambia nada de otra institución (solo marca mensajes dirigidos al propio
  usuario).
- TypeScript: 0 errores nuevos.
- **No se pudo** compilar el frontend (`npm run build`) ni probar en un
  navegador desde el entorno de trabajo, porque no tiene acceso al registro
  de npm. Hay que hacerlo en Codespaces y después del despliegue.
- **No se hicieron** pruebas en producción: se necesitan las credenciales de
  Vercel y Supabase, que solo tiene el equipo.

## 9. Funcionalidades pendientes

| Pendiente | Motivo exacto |
|---|---|
| Verificación en dos pasos (2FA) | No está implementada. Se quitó el interruptor que la simulaba. Requiere TOTP, códigos de recuperación y cambios en el login; no es parte de los objetivos centrales del proyecto. |
| Ejecutar la migración 012 en Supabase | Solo puede hacerlo el equipo con acceso a Supabase. Debe hacerse **antes** de desplegar: el código nuevo consulta esas columnas. |
| Renombrar las variables de Azure y rotar la clave | La clave anterior estuvo expuesta en el navegador. Rotarla solo se puede hacer desde el portal de Azure. El backend acepta los nombres antiguos mientras tanto. |
| Registrar las autorizaciones de los acudientes | Es un trámite de cada institución: hasta que el Súper Profesor las registre, los estudiantes menores o sin fecha de nacimiento no pueden usar cámara ni micrófono. |
| Compilación y prueba manual del frontend | El entorno de la auditoría no tiene acceso a npm ni a un navegador con el proyecto instalado. |
| Pruebas en producción | Requieren las credenciales del despliegue. |
| Pantalla de webhook del Súper Profesor | Los endpoints `/integrations/webhook` siguen en el backend sin pantalla. Hay que decidir si se agrega la pantalla o se retiran. |
| Endpoints del backend sin pantalla | `PUT /events/{id}`, `POST /chat/conversations/{id}/rename`, `GET /classrooms/{id}/students/{id}/progress` y otros no los usa el frontend. No afectan a los usuarios; se anotan para decidir si se usan o se retiran. |
| Formato legal de la autorización | El documento físico y su archivo dependen de cada institución y de la asesoría jurídica. |

## 10. Criterio final

No se declara NeuroLearn «100 % funcional». Lo que la aplicación muestra como
disponible funciona y guarda los datos en el código revisado y en las pruebas
automáticas. Falta confirmarlo en el navegador y en producción después de
ejecutar la migración 012 y de configurar las variables de Azure.
