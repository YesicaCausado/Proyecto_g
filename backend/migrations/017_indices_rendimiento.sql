-- NeuroLearn IA — Migración 017: índices de rendimiento
--
-- PostgreSQL NO crea índices sobre las claves foráneas. Estas columnas se
-- filtran en casi todas las páginas (mensajes, tablero, calendario, NeuroBots,
-- materiales, evaluaciones) y sin índice cada consulta recorre la tabla
-- completa: con más datos, las páginas se vuelven lentas y las consultas
-- llegan al statement_timeout.
--
-- CONCURRENTLY: no bloquea lecturas ni escrituras mientras se crea el índice.
-- Por eso NO va dentro de BEGIN/COMMIT: ejecuta el archivo tal cual en
-- Supabase -> SQL Editor. Idempotente.
--
-- El backend también crea estos índices al arrancar si faltan
-- (app/db/migrate.py: REQUIRED_INDEXES), así que ejecutar este archivo es
-- opcional; hacerlo a mano evita que el primer arranque tras el despliegue
-- tarde más.

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_direct_messages_sender_id ON direct_messages (sender_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_direct_messages_receiver_id ON direct_messages (receiver_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_posts_classroom_id ON posts (classroom_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_posts_teacher_id ON posts (teacher_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_post_comments_post_id ON post_comments (post_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_post_reactions_post_id ON post_reactions (post_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_classroom_events_classroom_id ON classroom_events (classroom_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_classroom_events_teacher_id ON classroom_events (teacher_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_expert_bots_creator_id ON expert_bots (creator_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_classroom_bots_bot_id ON classroom_bots (bot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_learning_sessions_bot_id ON learning_sessions (bot_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_teacher_evaluations_teacher_id ON teacher_evaluations (teacher_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_teacher_materials_teacher_id ON teacher_materials (teacher_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_teacher_materials_folder_id ON teacher_materials (folder_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_teacher_folders_teacher_id ON teacher_folders (teacher_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_quiz_history_classroom_id ON quiz_history (classroom_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_student_bot_assignments_teacher_id ON student_bot_assignments (teacher_id);
