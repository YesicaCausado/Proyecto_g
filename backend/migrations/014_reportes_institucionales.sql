-- NeuroLearn IA — Migración 014: reportes institucionales del Súper Profesor
--
-- Competencia explícita en aulas, evaluaciones y quizzes; períodos académicos;
-- gestión de casos de seguimiento; índices para los reportes.
--
-- Idempotente. El backend también aplica estas sentencias al arrancar en
-- PostgreSQL (app/db/migrate.py: ensure_reporting_schema), así que el
-- despliegue no falla si todavía no se ejecutó en Supabase.

ALTER TABLE classrooms          ADD COLUMN IF NOT EXISTS competency VARCHAR(30);
ALTER TABLE teacher_evaluations ADD COLUMN IF NOT EXISTS competency VARCHAR(30);
ALTER TABLE quiz_history        ADD COLUMN IF NOT EXISTS competency VARCHAR(30);

CREATE TABLE IF NOT EXISTS academic_periods (
    id             SERIAL PRIMARY KEY,
    institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    name           VARCHAR(120) NOT NULL,
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    created_by_id  INTEGER REFERENCES users(id),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academic_periods_institution ON academic_periods (institution_id);

CREATE TABLE IF NOT EXISTS followup_cases (
    id             SERIAL PRIMARY KEY,
    institution_id INTEGER NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    case_key       VARCHAR(120) NOT NULL,
    student_id     INTEGER NOT NULL REFERENCES users(id),
    rule           VARCHAR(40) NOT NULL,
    competency     VARCHAR(30),
    status         VARCHAR(20) NOT NULL DEFAULT 'abierto',
    assigned_to_id INTEGER REFERENCES users(id),
    created_by_id  INTEGER REFERENCES users(id),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    closed_at      TIMESTAMP,
    CONSTRAINT uq_followup_case UNIQUE (institution_id, case_key)
);
CREATE INDEX IF NOT EXISTS idx_followup_cases_institution ON followup_cases (institution_id);
CREATE INDEX IF NOT EXISTS idx_followup_cases_student     ON followup_cases (student_id);

CREATE TABLE IF NOT EXISTS followup_notes (
    id          SERIAL PRIMARY KEY,
    case_id     INTEGER NOT NULL REFERENCES followup_cases(id) ON DELETE CASCADE,
    author_id   INTEGER REFERENCES users(id),
    text        TEXT NOT NULL DEFAULT '',
    from_status VARCHAR(20),
    to_status   VARCHAR(20),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_followup_notes_case ON followup_notes (case_id);

-- Índices de las consultas de reportes
CREATE INDEX IF NOT EXISTS idx_eval_submissions_eval_student ON evaluation_submissions (evaluation_id, student_id);
CREATE INDEX IF NOT EXISTS idx_eval_submissions_submitted    ON evaluation_submissions (submitted_at);
CREATE INDEX IF NOT EXISTS idx_teacher_evaluations_classroom ON teacher_evaluations (classroom_id);

-- Backfill de la competencia de las aulas existentes por equivalencia exacta
-- con las opciones del formulario «Crear clase».
UPDATE classrooms SET competency = CASE lower(translate(subject, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
    WHEN 'matematicas' THEN 'matematicas'
    WHEN 'razonamiento cuantitativo' THEN 'matematicas'
    WHEN 'lenguaje' THEN 'lectora'
    WHEN 'lectura critica' THEN 'lectora'
    WHEN 'ingles' THEN 'ingles'
    WHEN 'ciencias naturales' THEN 'cientifico'
    WHEN 'ciencias sociales' THEN 'ciudadanas'
    WHEN 'competencias ciudadanas' THEN 'ciudadanas'
    ELSE NULL END
WHERE competency IS NULL;
