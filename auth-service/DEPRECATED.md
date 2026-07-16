# ⚠️ Auth Service — DEPRECADO

## Estado

Este microservicio está **deprecado y desconectado** del flujo principal.
No debe levantarse en producción ni en desarrollo activo.

## Por qué fue deprecado

El backend principal (`/backend`) asumió todas las responsabilidades
de autenticación directamente, eliminando la necesidad de este servicio
como microservicio separado:

| Funcionalidad | Antes | Ahora |
|---|---|---|
| Login / JWT | auth-service :8002 | backend :8000 `/api/v1/auth/login` |
| Registro | auth-service :8002 | backend :8000 `/api/v1/auth/register` |
| Perfil `/me` | auth-service :8002 | backend :8000 `/api/v1/auth/me` |
| Cambio de contraseña | No existía | backend :8000 `/api/v1/auth/change-password` |
| Recuperación de contraseña | No existía | backend :8000 `/api/v1/auth/forgot-password` |
| Crear instituciones | No existía | backend :8000 `/api/v1/admin/institutions` |
| Crear profesores | No existía | backend :8000 `/api/v1/super/teachers` |
| Crear estudiantes | No existía | backend :8000 `/api/v1/super/students` |

## Problemas conocidos al momento de deprecar

- Usaba **Neon PostgreSQL** en vez de **Supabase** — DB diferente al backend
- Modelo `User` sin campos B2B: `document_number`, `document_type`,
  `institution_id`, `must_change_password`, `subject_area`, `grade`, `birth_date`
- Schema `Token` incompatible: tiene `expires_in` en vez de
  `role`, `user_id`, `full_name`, `must_change_password`
- `SECRET_KEY` diferente al backend — tokens JWT incompatibles entre servicios
- El frontend nunca llamó a este servicio

## Si se quiere reactivar en el futuro

1. Apuntar `DATABASE_URL` a Supabase (misma que el backend)
2. Usar el mismo `SECRET_KEY` que el backend
3. Sincronizar `app/models/user.py` con `backend/app/models/user.py`
4. Sincronizar `app/schemas/schemas.py` con `backend/app/schemas/schemas.py`
5. Descomentar el servicio en `docker-compose.yml`

## Fecha de deprecación

Julio 2026 — Sprint feat-neuroconductual-patterns