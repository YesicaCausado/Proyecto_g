-- Migración: chat_answers para Predicción de Error (P5) en tiempo real desde el chat
-- Fecha: 2026-06-23
-- Descripción: Agrega la ventana móvil de veredictos de respuestas del chat para que
--   la predicción de error se calcule en tiempo real (no solo con historial de quizzes).

ALTER TABLE cognitive_session_state
ADD COLUMN IF NOT EXISTS chat_answers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN cognitive_session_state.chat_answers
IS 'Ventana móvil de veredictos (correcto/incorrecto) de respuestas del chat: [{c: 1|0|None, ts, len}]';