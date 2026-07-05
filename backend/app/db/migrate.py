"""
NeuroLearn AI — Auto-migración B2B para Supabase / PostgreSQL
Se ejecuta en cada startup. Usa ALTER TABLE ... ADD COLUMN IF NOT EXISTS
que es idempotente y seguro para correr múltiples veces.
"""
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def run_migrations(engine) -> None:
    """
    Aplica todas las migraciones B2B pendientes.
    Seguro de ejecutar en cada arranque del servidor.
    """
    if engine is None:
        logger.warning("run_migrations: engine es None, omitiendo.")
        return

    migrations = [
        # ── 1. Tabla institutions ────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS institutions (
            id           SERIAL PRIMARY KEY,
            name         VARCHAR(200) NOT NULL,
            dane_code    VARCHAR(20)  NOT NULL,
            license_type VARCHAR(20)  NOT NULL DEFAULT 'basica',
            is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
            created_by   INTEGER
        )
        """,
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_dane_code
            ON institutions (dane_code)
        """,

        # ── 2. Columnas B2B en users ─────────────────────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number      VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type        VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id       INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subject_area         VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS grade                VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date           VARCHAR(20)",

        # Índice único parcial en document_number
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_document_number
            ON users (document_number)
            WHERE document_number IS NOT NULL
        """,

        # ── 3. Foreign keys (solo PostgreSQL, con bloque DO $$ anónimo) ──────
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'users_institution_id_fkey'
                  AND table_name = 'users'
            ) THEN
                ALTER TABLE users
                    ADD CONSTRAINT users_institution_id_fkey
                    FOREIGN KEY (institution_id) REFERENCES institutions(id);
            END IF;
        END $$
        """,
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'institutions_created_by_fkey'
                  AND table_name = 'institutions'
            ) THEN
                ALTER TABLE institutions
                    ADD CONSTRAINT institutions_created_by_fkey
                    FOREIGN KEY (created_by) REFERENCES users(id);
            END IF;
        END $$
        """,

        # ── 4. Tabla audit_logs ──────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id               SERIAL PRIMARY KEY,
            action           VARCHAR(100) NOT NULL,
            performed_by_id  INTEGER REFERENCES users(id),
            target_user_id   INTEGER REFERENCES users(id),
            institution_id   INTEGER REFERENCES institutions(id),
            user_type        VARCHAR(30),
            ip_address       VARCHAR(45),
            notes            TEXT,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,
    ]

    applied = 0
    errors  = 0

    with engine.begin() as conn:
        # Solo ejecutar en PostgreSQL (Supabase); SQLite no soporta DO $$
        dialect = engine.dialect.name
        is_pg   = dialect == "postgresql"

        for i, sql in enumerate(migrations):
            sql = sql.strip()
            # Saltar bloques DO $$ en SQLite
            if not is_pg and sql.startswith("DO $$"):
                continue
            try:
                conn.execute(text(sql))
                applied += 1
            except Exception as e:
                err_str = str(e)
                # Ignorar errores de "ya existe" (no es un problema real)
                ignore_phrases = [
                    "already exists",
                    "duplicate column",
                    "ya existe",
                    "DuplicateColumn",
                ]
                if any(p.lower() in err_str.lower() for p in ignore_phrases):
                    logger.debug(f"Migración {i+1} omitida (ya existente): {err_str[:80]}")
                else:
                    logger.error(f"Error en migración {i+1}: {err_str[:200]}")
                    errors += 1

    if errors == 0:
        logger.info(f"✅ Migraciones B2B completadas: {applied} pasos aplicados.")
    else:
        logger.warning(
            f"⚠️ Migraciones B2B: {applied} OK, {errors} con errores (ver logs)."
        )
