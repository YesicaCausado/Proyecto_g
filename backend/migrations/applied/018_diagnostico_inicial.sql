-- NeuroLearn IA — Migración 018: diagnóstico inicial del estudiante (RF-13)
--
-- Un resultado por estudiante y competencia (10 preguntas por competencia,
-- banco en app/services/diagnostic_bank.py). El nivel va de 1 a 4 (niveles de
-- desempeño Saber 11) y el puntaje de 0 a 100, ponderado por dificultad.
--
-- Idempotente. El backend también crea la tabla al arrancar si falta
-- (app/db/migrate.py: prepare_postgres_schema).

BEGIN;

CREATE TABLE IF NOT EXISTS diagnostic_results (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER NOT NULL REFERENCES users(id),
    competency       VARCHAR(30) NOT NULL,
    correct_count    INTEGER NOT NULL DEFAULT 0,
    total_questions  INTEGER NOT NULL DEFAULT 0,
    score            DOUBLE PRECISION NOT NULL DEFAULT 0,
    level            INTEGER NOT NULL,
    answers          JSON,
    topic_results    JSON,
    duration_seconds INTEGER,
    completed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_diagnostic_user_competency UNIQUE (user_id, competency)
);

CREATE INDEX IF NOT EXISTS ix_diagnostic_results_id ON diagnostic_results (id);
CREATE INDEX IF NOT EXISTS ix_diagnostic_results_user_id ON diagnostic_results (user_id);

-- Solo el backend accede a esta tabla (igual que en las migraciones 008-015).
ALTER TABLE diagnostic_results ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT competency, COUNT(*) AS diagnosticos FROM diagnostic_results GROUP BY competency;
