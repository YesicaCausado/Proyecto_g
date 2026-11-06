-- NeuroLearn IA — Migración 019: evaluación del tutor en el diagnóstico (RF-13)
-- y bloqueo persistente de cuentas (RNF-04)
--
-- 1. diagnostic_results.tutor_feedback / feedback_provider: la evaluación que
--    el tutor de IA escribe sobre las respuestas del diagnóstico y quién la
--    generó (groq, gemini o local si la IA no respondió).
-- 2. Índice sobre audit_logs para contar rápido los «login_failed» recientes
--    de un usuario (el bloqueo de 15 min tras 20 fallos en 5 min se calcula
--    desde esa tabla, compartida por todas las instancias de Vercel).
--
-- Opcional: el backend agrega las columnas y el índice al arrancar si faltan
-- (app/db/migrate.py: prepare_postgres_schema). Idempotente. El índice usa
-- CREATE INDEX CONCURRENTLY: ejecutar esa sentencia fuera de una transacción.

ALTER TABLE diagnostic_results ADD COLUMN IF NOT EXISTS tutor_feedback    TEXT;
ALTER TABLE diagnostic_results ADD COLUMN IF NOT EXISTS feedback_provider VARCHAR(20);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_actor_action_created
    ON audit_logs (performed_by_id, action, created_at);
