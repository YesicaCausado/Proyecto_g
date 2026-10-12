-- ================================================================
-- NeuroLearn IA — Migración 010
-- Consentimiento de cámara y micrófono
-- Fecha: octubre de 2026
-- ================================================================
--
-- CONTEXTO
--   Antes de activar la cámara (detección facial) o el micrófono (análisis
--   de voz y modo de voz) el usuario debe aceptar el texto vigente del
--   consentimiento (app/services/consent_service.py). Cada aceptación queda
--   registrada con usuario, tipo, versión, fecha y hora (UTC), IP y
--   navegador; retirarlo marca revoked_at.
--
--   El backend también crea la tabla al arrancar (create_all). Este script
--   es idempotente y puede ejecutarse antes o después del despliegue.
--
--   Después: mover a migrations/applied/ y hacer commit
--   ("chore(db): migración 010 - consentimientos").
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_consents (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER      NOT NULL REFERENCES users(id),
    consent_type  VARCHAR(30)  NOT NULL,
    version       VARCHAR(10)  NOT NULL,
    granted_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    revoked_at    TIMESTAMP,
    ip_address    VARCHAR(45),
    user_agent    VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS ix_user_consents_id      ON user_consents (id);
CREATE INDEX IF NOT EXISTS ix_user_consents_user_id ON user_consents (user_id);

-- Solo el backend accede a esta tabla (igual que en las migraciones 008 y 009).
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT COUNT(*) AS consentimientos FROM user_consents;
