-- NeuroLearn IA — Migración 020: RLS en las tablas que no lo tenían (RNF-05)
--
-- Sin RLS, Supabase expone las tablas del esquema public por su API REST a
-- cualquiera con la clave anon. Igual que en las migraciones 008-015, solo el
-- backend accede a ellas: entra como el dueño de las tablas (postgres), que
-- ignora RLS, así que no necesita políticas. Desde esta versión el backend
-- también activa RLS en las tablas que crea al arrancar (app/db/migrate.py).
--
-- Idempotente. Reversible con ALTER TABLE ... DISABLE ROW LEVEL SECURITY.

BEGIN;

ALTER TABLE alert_acknowledgements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_executions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cognitive_session_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_state          ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_history            ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_memory          ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
