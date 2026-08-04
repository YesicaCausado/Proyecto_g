-- Migración: Agregar columnas adaptativas a quiz_history
-- Fecha: 2026-06-22
-- Descripción: Agregar campos para sistema de quizzes adaptativos

-- Agregar columnas de adaptación a la tabla quiz_history
ALTER TABLE quiz_history 
ADD COLUMN IF NOT EXISTS mistakes JSONB,
ADD COLUMN IF NOT EXISTS weak_concepts JSONB,
ADD COLUMN IF NOT EXISTS adaptation_applied VARCHAR(500),
ADD COLUMN IF NOT EXISTS performance_score FLOAT,
ADD COLUMN IF NOT EXISTS recommended_difficulty VARCHAR(20);

-- Crear índices para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_quiz_history_performance ON quiz_history(performance_score);
CREATE INDEX IF NOT EXISTS idx_quiz_history_recommended_difficulty ON quiz_history(recommended_difficulty);
CREATE INDEX IF NOT EXISTS idx_quiz_history_completed_at ON quiz_history(completed_at);

-- Comentarios para documentación
COMMENT ON COLUMN quiz_history.mistakes IS 'Detalles JSON de preguntas falladas con respuestas del usuario';
COMMENT ON COLUMN quiz_history.weak_concepts IS 'Array JSON de conceptos identificados como débiles';
COMMENT ON COLUMN quiz_history.adaptation_applied IS 'Descripción de cómo se ajustó el siguiente quiz';
COMMENT ON COLUMN quiz_history.performance_score IS 'Porcentaje de aciertos (0-100)';
COMMENT ON COLUMN quiz_history.recommended_difficulty IS 'Dificultad sugerida para el próximo quiz (Fácil/Medio/Difícil)';
