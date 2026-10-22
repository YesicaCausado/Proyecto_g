-- NeuroLearn IA — Migración 016: retiro de estudiantes y borrado de mensajes
--
-- 1. Retiro de un estudiante por su profesor: la inscripción queda inactiva y
--    guarda cuándo, quién y con qué código de invitación vigente se retiró.
--    Ningún código lo vuelve a inscribir: solo la reincorporación del
--    profesor. El historial no se borra.
-- 2. Columnas de borrado de mensajes (delete_fields.sql), por si ese archivo
--    no se ejecutó: el modelo DirectMessage las usa.
--
-- Idempotente. El backend también agrega estas columnas al arrancar
-- (app/db/migrate.py: RUNTIME_COLUMNS).

BEGIN;

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS removed_at TIMESTAMP;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS removed_by INTEGER REFERENCES users(id);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS removed_invite_code VARCHAR(8);

-- 3. Cómo se resolvió el grupo de cada quiz de práctica (grupo_unico,
--    varios_grupos, sin_grupo, sin_competencia).
ALTER TABLE quiz_history ADD COLUMN IF NOT EXISTS group_resolution VARCHAR(20);

ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_for_sender   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS deleted_for_all      BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;

SELECT COUNT(*) FILTER (WHERE removed_at IS NOT NULL) AS inscripciones_retiradas FROM enrollments;
