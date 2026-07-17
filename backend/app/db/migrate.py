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
        # columnas base que pueden faltar si la tabla se creó antes del modelo actual
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_expert   BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name   VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS cognitive_profile JSONB",

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

        # ── 5. Columna expiry_date en institutions (sistema de licencias) ───
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMP",

        # ── 6. Columnas que pueden faltar en institutions si la tabla fue
        #      creada antes de agregar estos campos ────────────────────────
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS license_type VARCHAR(20) NOT NULL DEFAULT 'basica'",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",

        # ── 7. Columnas legacy en institutions: hacerlas NULLABLE y quitar
        #      DEFAULT '' para que los inserts modernos no violen UNIQUE. ──
        """
        DO $$
        DECLARE
            col_rec RECORD;
        BEGIN
            FOR col_rec IN
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'institutions'
                  AND table_schema = 'public'
                  AND column_name NOT IN ('id','name','dane_code','license_type',
                                          'is_active','created_at','created_by',
                                          'expiry_date')
                  AND data_type IN ('character varying','text','character','integer',
                                    'bigint','boolean','numeric')
            LOOP
                -- Quitar restricción NOT NULL (idempotente si ya es nullable)
                EXECUTE format(
                    'ALTER TABLE institutions ALTER COLUMN %I DROP NOT NULL',
                    col_rec.column_name
                );
                -- Quitar DEFAULT '' que pusimos antes (evita UNIQUE con '')
                EXECUTE format(
                    'ALTER TABLE institutions ALTER COLUMN %I DROP DEFAULT',
                    col_rec.column_name
                );
                -- Limpiar filas que tienen '' para que no molesten
                EXECUTE format(
                    'UPDATE institutions SET %I = NULL WHERE %I = ''''',
                    col_rec.column_name, col_rec.column_name
                );
            END LOOP;
        END $$
        """,

        # ── 8. Eliminar UNIQUE constraints de columnas legacy que no son
        #      parte del nuevo modelo — admin_email, admin_document, etc.
        #      Un NULL puede repetirse, pero '' con UNIQUE falla. ──────────
        """
        DO $$
        DECLARE
            con_rec RECORD;
        BEGIN
            FOR con_rec IN
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                     ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_name      = tc.table_name
                WHERE tc.table_name       = 'institutions'
                  AND tc.table_schema     = 'public'
                  AND tc.constraint_type  = 'UNIQUE'
                  AND ccu.column_name NOT IN ('dane_code')
            LOOP
                EXECUTE format(
                    'ALTER TABLE institutions DROP CONSTRAINT IF EXISTS %I',
                    con_rec.constraint_name
                );
            END LOOP;
        END $$
        """,

        # ── 9. Columnas que pueden faltar en classrooms ───────────────────
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS color       VARCHAR(20)  DEFAULT '#0B6E99'",
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20)  DEFAULT NULL",
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS description TEXT         DEFAULT NULL",
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS max_students INTEGER     DEFAULT 40",

        # ── 10. Columnas que pueden faltar en audit_logs ──────────────────
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_type  VARCHAR(30)",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)",
    ]

    applied = 0
    errors  = 0
    is_pg   = engine.dialect.name == "postgresql"

    # Cada migración en su PROPIA transacción para que un fallo no
    # deje la transacción global en estado "aborted" en PostgreSQL.
    for i, sql in enumerate(migrations):
        sql = sql.strip()
        if not is_pg and sql.startswith("DO $$"):
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            applied += 1
        except Exception as e:
            err_str = str(e)
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
