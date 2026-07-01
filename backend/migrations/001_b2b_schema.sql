-- =============================================================
-- NeuroLearn AI — Migración B2B (001)
-- Ejecutar en: Supabase → SQL Editor → New query → Run
-- Es seguro ejecutar múltiples veces (IF NOT EXISTS / IF NOT)
-- =============================================================

-- ─── 1. Tabla institutions (debe crearse ANTES de agregar FK en users) ────────
CREATE TABLE IF NOT EXISTS institutions (
    id           SERIAL PRIMARY KEY,
    name         VARCHAR(200) NOT NULL,
    dane_code    VARCHAR(20)  NOT NULL,
    license_type VARCHAR(20)  NOT NULL DEFAULT 'basica',
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by   INTEGER
);

-- Índice único en dane_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_dane_code ON institutions (dane_code);

-- ─── 2. Nuevas columnas en users ─────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number      VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type        VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id       INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subject_area         VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade                VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date           VARCHAR(20);

-- Índice único en document_number (solo filas no-NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_document_number
    ON users (document_number)
    WHERE document_number IS NOT NULL;

-- ─── 3. Claves foráneas (solo si no existen) ──────────────────────────────────
DO $$
BEGIN
    -- users.institution_id → institutions.id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'users_institution_id_fkey'
          AND table_name = 'users'
    ) THEN
        ALTER TABLE users
            ADD CONSTRAINT users_institution_id_fkey
            FOREIGN KEY (institution_id) REFERENCES institutions(id);
    END IF;

    -- institutions.created_by → users.id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'institutions_created_by_fkey'
          AND table_name = 'institutions'
    ) THEN
        ALTER TABLE institutions
            ADD CONSTRAINT institutions_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
END $$;

-- ─── 4. Tabla audit_logs ─────────────────────────────────────────────────────
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
);

-- ─── Verificación final ───────────────────────────────────────────────────────
SELECT
    'users columns' AS check_name,
    COUNT(*) AS count
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN (
    'document_number','document_type','institution_id',
    'must_change_password','subject_area','grade','birth_date'
  )
UNION ALL
SELECT 'institutions table', COUNT(*)
  FROM information_schema.tables
 WHERE table_name = 'institutions'
UNION ALL
SELECT 'audit_logs table', COUNT(*)
  FROM information_schema.tables
 WHERE table_name = 'audit_logs';
