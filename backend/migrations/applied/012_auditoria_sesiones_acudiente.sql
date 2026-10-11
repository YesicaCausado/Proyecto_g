-- ============================================================
-- 012 — Auditoría final (parche 14)
--
--   users.sessions_valid_after       cierre de sesiones (tokens emitidos
--                                    antes de esta fecha dejan de valer)
--   users.guardian_name              acudiente que firmó la autorización
--   users.guardian_authorized_at     fecha en que la institución la registró
--   users.guardian_authorized_by_id  Súper Profesor que la registró
--
-- Idempotente. El backend también agrega estas columnas al arrancar
-- (app/db/migrate.py), pero conviene ejecutarlo en Supabase → SQL Editor
-- ANTES de desplegar el parche 14, para que la primera petición no espere.
-- ============================================================
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after      TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_name             VARCHAR(150);
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_authorized_at    TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_authorized_by_id INTEGER;

COMMIT;

SELECT
    COUNT(*) FILTER (WHERE role = 'estudiante')                                     AS estudiantes,
    COUNT(*) FILTER (WHERE role = 'estudiante' AND guardian_authorized_at IS NULL)  AS sin_autorizacion_acudiente
FROM users;
