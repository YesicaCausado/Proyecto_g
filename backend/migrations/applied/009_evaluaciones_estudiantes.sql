-- ================================================================
-- NeuroLearn IA — Migración 009
-- Evaluaciones profesor → estudiante (publicación, entregas y resultados)
-- Fecha: octubre de 2026
-- ================================================================
--
-- CONTEXTO
--   Hasta ahora las evaluaciones solo existían del lado del profesor y
--   guardaban el grupo como texto. Esta migración:
--     1. Agrega a teacher_evaluations el aula (classroom_id), el estado
--        (borrador / publicada / cerrada) y las fechas de publicación y cierre.
--     2. Asocia las evaluaciones existentes al aula del mismo profesor cuyo
--        nombre coincide con group_name. Todas quedan en BORRADOR: el profesor
--        las revisa y las publica. Las que no coinciden con ningún aula quedan
--        sin aula, en borrador, para que el profesor le asigne una al editarla.
--     3. Crea evaluation_submissions (intentos, respuestas y calificación).
--
-- ORDEN OBLIGATORIO
--   1. Ejecutar este archivo en Supabase → SQL Editor ANTES de desplegar el
--      código del parche 4 (el backend nuevo lee estas columnas).
--      La versión anterior del backend sigue funcionando con las columnas
--      nuevas, así que ejecutarlo primero es seguro.
--   2. Desplegar.
--   3. Mover este archivo a migrations/applied/ y hacer commit
--      ("chore(db): migración 009 - evaluaciones a estudiantes").
--
-- Idempotente: puede ejecutarse más de una vez sin error.
-- ================================================================

BEGIN;

-- 1. Nuevas columnas en teacher_evaluations
ALTER TABLE teacher_evaluations ADD COLUMN IF NOT EXISTS classroom_id INTEGER REFERENCES classrooms(id);
ALTER TABLE teacher_evaluations ADD COLUMN IF NOT EXISTS status       VARCHAR(20) NOT NULL DEFAULT 'borrador';
ALTER TABLE teacher_evaluations ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
ALTER TABLE teacher_evaluations ADD COLUMN IF NOT EXISTS closed_at    TIMESTAMP;
CREATE INDEX IF NOT EXISTS ix_teacher_evaluations_classroom_id ON teacher_evaluations (classroom_id);

-- 2. Evaluaciones existentes: asociar aula por nombre y dejar en borrador
UPDATE teacher_evaluations te
SET classroom_id = (
    SELECT MIN(c.id)
    FROM classrooms c
    WHERE c.teacher_id = te.teacher_id
      AND c.name = te.group_name
      AND c.is_active = TRUE
)
WHERE te.classroom_id IS NULL;

UPDATE teacher_evaluations
SET status = 'borrador', active = FALSE, submissions = 0
WHERE published_at IS NULL AND status = 'borrador';

-- 3. Entregas de los estudiantes
CREATE TABLE IF NOT EXISTS evaluation_submissions (
    id              SERIAL PRIMARY KEY,
    evaluation_id   INTEGER     NOT NULL REFERENCES teacher_evaluations(id) ON DELETE CASCADE,
    student_id      INTEGER     NOT NULL REFERENCES users(id),
    classroom_id    INTEGER     REFERENCES classrooms(id),
    institution_id  INTEGER     REFERENCES institutions(id),
    attempt_number  INTEGER     NOT NULL DEFAULT 1,
    status          VARCHAR(30) NOT NULL DEFAULT 'en_curso',
    answers         JSON,
    results         JSON,
    score           DOUBLE PRECISION,
    max_score       DOUBLE PRECISION,
    percentage      DOUBLE PRECISION,
    started_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMP   NOT NULL,
    submitted_at    TIMESTAMP,
    auto_submitted  BOOLEAN     NOT NULL DEFAULT FALSE,
    graded_at       TIMESTAMP,
    graded_by_id    INTEGER     REFERENCES users(id),
    CONSTRAINT uq_evaluation_submission_attempt UNIQUE (evaluation_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS ix_evaluation_submissions_id            ON evaluation_submissions (id);
CREATE INDEX IF NOT EXISTS ix_evaluation_submissions_evaluation_id ON evaluation_submissions (evaluation_id);
CREATE INDEX IF NOT EXISTS ix_evaluation_submissions_student_id    ON evaluation_submissions (student_id);

-- Solo el backend accede a esta tabla (igual que en la migración 008).
ALTER TABLE evaluation_submissions ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación
SELECT id, title, group_name, classroom_id, status
FROM teacher_evaluations
ORDER BY id;
-- Las filas con classroom_id NULL no coincidieron con ningún aula:
-- el profesor debe editarlas y elegir un grupo antes de publicarlas.
