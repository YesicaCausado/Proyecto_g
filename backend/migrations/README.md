# NeuroLearn IA — Migraciones de Base de Datos

## Estructura

migrations/
├── applied/          ← Scripts ya ejecutados en Supabase (NO volver a ejecutar)
│   ├── 001_b2b_schema.sql
│   ├── 002_add_adaptive_quiz_columns.sql
│   ├── 003_last_login.sql
│   └── 004_password_reset_tokens.sql
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
