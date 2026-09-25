-- Índices estratégicos para rendimiento de consultas en la B2B
CREATE INDEX IF NOT EXISTS idx_enrollments_student_id ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_classroom_id ON enrollments (classroom_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_quiz_history_user_id ON quiz_history (user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_history_completed ON quiz_history (user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_quiz_history_perf ON quiz_history (user_id, performance_score);
CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id ON classrooms (teacher_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_learning_sessions_user ON learning_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_cognitive_events_user_ts ON cognitive_events (user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_classroom_bots_classroom ON classroom_bots (classroom_id);
CREATE INDEX IF NOT EXISTS idx_users_institution_id ON users (institution_id) WHERE institution_id IS NOT NULL;
