# 🟢 CORRECCIONES APLICADAS — NeuroLearn AI (log incremental)

> Este archivo se actualiza conforme se corrigen problemas durante la auditoría.

---

## [CRIT-01]
- **Funcionalidad:** Autenticación — login de los 4 roles demo
- **Pantalla:** LoginPage
- **Problema:** Las credenciales documentadas en `docs/CREDENTIALS_DEMO.md` (`demo/demo`, `profesor/profesor`, `superprofesor/superprofesor`, `admin/admin1234`) fallaban todas con 401 "Usuario o contraseña incorrectos". La BD local solo tenía 9 usuarios de prueba (todos estudiantes) sin profesor/super/admin y la contraseña de `demo` era desconocida. Sin admin, la cadena B2B completa (admin → super → profesores/estudiantes) era inutilizable.
- **Causa:** La BD local no estaba sembrada con los usuarios demo documentados.
- **Archivo(s) afectado(s):** `backend/reset_demo_passwords.py`, `docs/CREDENTIALS_DEMO.md`
- **Solución aplicada:**
  - Backend: `reset_demo_passwords.py` convertido en script idempotente de siembra que crea los usuarios demo documentados si no existen y restaura sus contraseñas. Ejecutado contra la BD real → `demo` (id=8, restaurado), `profesor` (id=10, creado), `superprofesor` (id=11, creado), `admin` (id=12, creado).
- **Base de datos:** 4 usuarios demo con roles correctos y contraseñas hasheadas con bcrypt.
- **Resultado de la prueba:** LOGIN OK para los 4 roles vía `POST /api/v1/auth/login`.
- **Estado: CORREGIDO**

## [CRIT-02]
- **Funcionalidad:** Ubicación de la base de datos SQLite
- **Pantalla:** N/A (infraestructura)
- **Problema:** El path por defecto de SQLite era relativo (`neurolearn.db`) — la ubicación de la BD dependía del CWD desde el que se lanzara uvicorn o los scripts. Se creaban BD distintas (raíz del proyecto vs `backend/`) y los datos "desaparecían" al cambiar el directorio de trabajo.
- **Causa:** `sqlite:///neurolearn.db` resuelve contra el CWD del proceso.
- **Archivo(s) afectado(s):** `backend/app/db/database.py`
- **Solución aplicada:**
  - Backend: ruta ABSOLUTA anclada a `backend/` (3 dirname desde `app/db/database.py`), con override opcional vía `SQLITE_DB_PATH`. Eliminadas 2 BD huérfanas creadas durante la auditoría.
- **Resultado de la prueba:** Backend reiniciado conectando siempre a `backend/neurolearn.db` sin importar el CWD.
- **Estado: CORREGIDO**

## [CRIT-03]
- **Funcionalidad:** Estadísticas de chat
- **Pantalla:** (endpoint `/api/v1/chat/stats`)
- **Problema:** `GET /chat/stats` devolvía **500 Internal Server Error** en cada consulta. `pydantic ValidationError: 7 validation errors for SessionStatsResponse`.
- **Causa:** El `response_model=SessionStatsResponse` quedó desactualizado: el esquema esperaba `session_id/topic/duration_minutes/avg_response_time/mastery_level/concepts_learned/cognitive_evolution`, pero el endpoint (ya corregido para devolver datos reales) devuelve `total_messages/correct_answers/wrong_answers/average_response_time/topics_covered/session_duration`.
- **Archivo(s) afectado(s):** `backend/app/schemas/schemas.py` (línea ~251), `backend/app/api/chat.py` (línea ~1584)
- **Solución aplicada:**
  - Backend: `SessionStatsResponse` actualizado para reflejar la respuesta real del endpoint (con docstring explicando el fix).
- **Resultado de la prueba:** `GET /chat/stats` → 200 con datos reales (vacíos para usuario nuevo, correctos).
- **Estado: CORREGIDO**

## [CRIT-04]
- **Funcionalidad:** Seguridad — permisos por rol en backend
- **Pantalla:** Panel Profesor (endpoint `/api/v1/teacher/stats`)
- **Problema:** Un usuario **estudiante** podía llamar `GET /teacher/stats` y recibir la respuesta de estadísticas de docente (sin validación de rol en el backend). Confirmado en vivo: student → 200 OK.
- **Causa:** `get_teacher_stats` solo requería `get_current_user`, sin chequeo de rol.
- **Archivo(s) afectado(s):** `backend/app/api/teacher_stats.py` (línea ~57)
- **Solución aplicada:**
  - Backend: validación de rol añadida (profesor/super_profesor/admin); estudiantes → 403 con mensaje claro.
- **Resultado de la prueba:** student → 403 "Las estadísticas de docente solo están disponibles para profesores."; profesor → 200 OK.
- **Estado: CORREGIDO**

## [IMP-01]
- **Funcionalidad:** Próximos eventos (Dashboard Profesor)
- **Pantalla:** DashboardTab / AnaliticaTab
- **Problema:** `strftime("%-d %b")` no es válido en Windows (solo Linux/glibc): lanzaba ValueError y el fallback mostraba la fecha ISO cruda ("2026-09-25") en lugar de "25 Sep".
- **Causa:** Flag de formato plataforma-específico.
- **Archivo(s) afectado(s):** `backend/app/api/teacher_stats.py` (línea ~376)
- **Solución aplicada:**
  - Backend: `d.strftime("%d %b").lstrip("0").capitalize()` — portable en Windows/Linux.
- **Estado: CORREGIDO**

## [IMP-02]
- **Funcionalidad:** Seguridad — credenciales en código fuente
- **Pantalla:** N/A (scripts)
- **Problema:** `backend/scripts/create_teacher.py` contiene credenciales Supabase hardcodeadas con contraseña real en texto plano (`DB_CONFIG = {host: 'aws-1-sa-east-1.pooler.supabase.com', ..., password: 'UntoD@wn2712'}`).
- **Causa:** Script antiguo con credenciales embebidas.
- **Archivo(s) afectado(s):** `backend/scripts/create_teacher.py`, `backend/scripts/create_teacher_quick.py`
- **Solución aplicada:**
  - Backend: ambos scripts leen la conexión desde `DATABASE_URL` (backend/.env) vía `_build_db_config()`; credenciales embebidas eliminadas por completo (verificado con grep: 0 matches de host/contraseña).
- **Resultado de la prueba:** grep de credenciales en backend/*.py → sin coincidencias.
- **Estado: CORREGIDO**

## [MEN-01]
- **Funcionalidad:** Teacher stats
- **Pantalla:** (endpoint)
- **Problema:** Constante muerta `WEEK_LABELS` sin uso (código residual).
- **Archivo(s) afectado(s):** `backend/app/api/teacher_stats.py`
- **Solución aplicada:** Constante eliminada.
- **Estado: CORREGIDO**
