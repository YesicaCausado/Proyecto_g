-- ================================================================
-- NeuroLearn IA — Migración 004
-- Tabla para tokens de recuperación de contraseña
-- Ejecutada: Julio 2026
-- ================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token      VARCHAR(128)  NOT NULL,
    expires_at TIMESTAMPTZ   NOT NULL,
    used       BOOLEAN       NOT NULL DEFAULT FALSE,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token
    ON password_reset_tokens(token);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
    ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
    ON password_reset_tokens(expires_at);
