# NeuroLearn IA — Migraciones de Base de Datos

## Estructura

migrations/
├── applied/          ← Scripts ya ejecutados en Supabase (NO volver a ejecutar)
│   ├── 001_b2b_schema.sql
│   ├── 002_add_adaptive_quiz_columns.sql
│   ├── 003_last_login.sql
│   ├── 004_password_reset_tokens.sql
│   └── 005_rls_multitenant.sql    ← Row Level Security multi-tenant
├── migrate.py        ← Script Python para quizzes adaptativos
├── run_migration.py  ← Runner que lee 002_add_adaptive_quiz_columns.sql
└── README.md         ← Este archivo

## Regla Importante

 Recordatorio: Cada vez que se realiza un cambio en Supabase se debe realizar el siguiente flujo:

1. Ejecutarlo en Supabase → SQL Editor
2. Crear un archivo `NNN_descripcion.sql` en `migrations/`
3. Moverlo a `migrations/applied/` inmediatamente
4. Hacer commit con mensaje `chore(db): migración NNN - descripción`


## Historial

| # | Archivo | Descripción | Fecha |
|---|---------|-------------|-------|
| 001 | `001_b2b_schema.sql` | Schema B2B completo — institutions, columnas B2B en users, audit_logs | Jul 2026 |
| 002 | `002_add_adaptive_quiz_columns.sql` | Columnas adaptativas en quiz_history | Jul 2026 |
| 003 | `003_last_login.sql` | Columna last_login en users | Jul 2026 |
| 004 | `004_password_reset_tokens.sql` | Tabla password_reset_tokens | Jul 2026 |
| 005 | `005_rls_multitenant.sql` | **RLS multi-tenant**: políticas de fila (institutions, users, classrooms, expert_bots, enrollments) | — |

## RLS multi-tenant (005)

Aplica aislamiento por institución a nivel de base de datos (no solo filtros
de backend). Ver `applied/005_rls_multitenant.sql`.

### Cómo aplicarla
1. Supabase → SQL Editor → pegar el contenido de `005_rls_multitenant.sql` → Run.
2. Verificar la query final (lista tablas con RLS habilitado).

### Importante — rol de conexión del backend
La API FastAPI se conecta con el **rol de servicio** (`service_role`/`postgres`)
que trae `BYPASSRLS`, así que las políticas NO bloquean esas consultas. Un atacante
que obtenga la `service_role key` no se detiene en RLS.

Para que RLS proteja realmente el backend:
- Use un rol dedicado sin `BYPASSRLS` (p. ej. `app_api`) en `DATABASE_URL`, o
- Enrute las consultas multi-tenant mediante PostgREST con el usuario `authenticated`.

Este entregable deja las **políticas** expresadas y listas para activar; la
configuración del rol de conexión es una decisión de despliegue. Ver el encabezado
del propio archivo SQL para la guía completa.
