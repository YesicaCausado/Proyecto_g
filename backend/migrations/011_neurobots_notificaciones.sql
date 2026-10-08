-- ================================================================
-- NeuroLearn IA — Migración 011
-- NeuroBots asignados con meta y progreso + notificaciones persistentes
-- Fecha: octubre de 2026
-- ================================================================
--
-- CONTEXTO
--   * classroom_bots: el profesor fija una meta de interacciones al asignar
--     un NeuroBot a un aula y queda registrado quién lo asignó.
--   * student_bot_assignments: asignación de un NeuroBot a estudiantes
--     concretos de las aulas del profesor.
--   * neurobot_progress: avance real de cada estudiante con cada NeuroBot
--     asignado (interacciones, inicio, última actividad, completado).
--   * notifications: notificaciones persistentes generadas por eventos
--     (destinatario, tipo, título, mensaje, enlace al recurso, leída).
--   * notification_preferences: preferencias del perfil («Nueva actividad»,
--     «Mensaje directo»), antes guardadas solo en el navegador.
--
--   El backend también crea las tablas nuevas al arrancar (create_all), pero
--   NO agrega columnas a tablas existentes: ejecutar este script en Supabase
--   ANTES de desplegar el código (classroom_bots necesita sus dos columnas).
--   Es idempotente: puede ejecutarse más de una vez.
--
--   Después: mover a migrations/applied/ y hacer commit
--   ("chore(db): migración 011 - neurobots y notificaciones").
-- ================================================================

BEGIN;

-- ── Asignación por aula: meta y profesor que asigna ────────────────
ALTER TABLE classroom_bots ADD COLUMN IF NOT EXISTS goal_interactions INTEGER;
ALTER TABLE classroom_bots ADD COLUMN IF NOT EXISTS assigned_by_id    INTEGER REFERENCES users(id);

-- ── Asignación individual ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS student_bot_assignments (
    id                 SERIAL PRIMARY KEY,
    bot_id             INTEGER   NOT NULL REFERENCES expert_bots(id),
    student_id         INTEGER   NOT NULL REFERENCES users(id),
    teacher_id         INTEGER   NOT NULL REFERENCES users(id),
    goal_interactions  INTEGER   NOT NULL,
    assigned_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_student_bot_assignment UNIQUE (bot_id, student_id)
);
CREATE INDEX IF NOT EXISTS ix_student_bot_assignments_id         ON student_bot_assignments (id);
CREATE INDEX IF NOT EXISTS ix_student_bot_assignments_bot_id     ON student_bot_assignments (bot_id);
CREATE INDEX IF NOT EXISTS ix_student_bot_assignments_student_id ON student_bot_assignments (student_id);

-- ── Progreso por estudiante y NeuroBot ─────────────────────────────
CREATE TABLE IF NOT EXISTS neurobot_progress (
    id                SERIAL PRIMARY KEY,
    bot_id            INTEGER   NOT NULL REFERENCES expert_bots(id),
    student_id        INTEGER   NOT NULL REFERENCES users(id),
    interactions      INTEGER   NOT NULL DEFAULT 0,
    started_at        TIMESTAMP,
    last_activity_at  TIMESTAMP,
    completed_at      TIMESTAMP,
    completed_goal    INTEGER,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_neurobot_progress UNIQUE (bot_id, student_id)
);
CREATE INDEX IF NOT EXISTS ix_neurobot_progress_id         ON neurobot_progress (id);
CREATE INDEX IF NOT EXISTS ix_neurobot_progress_bot_id     ON neurobot_progress (bot_id);
CREATE INDEX IF NOT EXISTS ix_neurobot_progress_student_id ON neurobot_progress (student_id);

-- ── Notificaciones ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER      NOT NULL REFERENCES users(id),
    type           VARCHAR(40)  NOT NULL,
    title          VARCHAR(200) NOT NULL,
    message        TEXT         NOT NULL DEFAULT '',
    link           VARCHAR(300),
    resource_type  VARCHAR(40),
    resource_id    INTEGER,
    is_read        BOOLEAN      NOT NULL DEFAULT FALSE,
    read_at        TIMESTAMP,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    dedupe_key     VARCHAR(120),
    CONSTRAINT uq_notification_dedupe UNIQUE (user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS ix_notifications_id         ON notifications (id);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id    ON notifications (user_id);
CREATE INDEX IF NOT EXISTS ix_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS ix_notifications_user_read  ON notifications (user_id, is_read);

CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id          INTEGER   PRIMARY KEY REFERENCES users(id),
    nueva_actividad  BOOLEAN   NOT NULL DEFAULT TRUE,
    mensaje_directo  BOOLEAN   NOT NULL DEFAULT TRUE,
    updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Solo el backend accede a estas tablas (igual que en las migraciones 008-010).
ALTER TABLE student_bot_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE neurobot_progress        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications            ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT
    (SELECT COUNT(*) FROM classroom_bots)           AS asignaciones_por_aula,
    (SELECT COUNT(*) FROM student_bot_assignments)  AS asignaciones_individuales,
    (SELECT COUNT(*) FROM neurobot_progress)        AS progresos,
    (SELECT COUNT(*) FROM notifications)            AS notificaciones;
