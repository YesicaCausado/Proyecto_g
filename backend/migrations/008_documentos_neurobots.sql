-- ================================================================
-- NeuroLearn IA — Migración 008
-- Base de conocimiento de los NeuroBots (documentos subidos por el docente)
-- Fecha: octubre de 2026
-- ================================================================
--
-- CONTEXTO
--   El profesor sube documentos (PDF, DOCX, TXT, Markdown) a sus NeuroBots.
--   El backend extrae el texto, lo divide en fragmentos y los guarda para
--   que el NeuroBot los use al responder (app/services/bot_documents.py).
--
--   Tablas nuevas:
--     bot_documents        un registro por archivo (incluye el archivo original)
--     bot_document_chunks  fragmentos de texto indexados de cada documento
--
--   El backend también las crea solo al arrancar (Base.metadata.create_all),
--   así que este script es idempotente y sirve para dejar constancia del
--   esquema y crearlas antes del primer uso.
--
-- ORDEN
--   1. Ejecutar este archivo en Supabase → SQL Editor (antes o después del
--      despliegue: no rompe la versión anterior del backend).
--   2. Mover este archivo a migrations/applied/ y hacer commit
--      ("chore(db): migración 008 - documentos de NeuroBots").
-- ================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS bot_documents (
    id              SERIAL PRIMARY KEY,
    bot_id          INTEGER      NOT NULL REFERENCES expert_bots(id) ON DELETE CASCADE,
    uploaded_by_id  INTEGER      NOT NULL REFERENCES users(id),
    institution_id  INTEGER      REFERENCES institutions(id),
    filename        VARCHAR(255) NOT NULL,
    extension       VARCHAR(10)  NOT NULL,
    mime_type       VARCHAR(120) NOT NULL,
    size_bytes      INTEGER      NOT NULL,
    content_hash    VARCHAR(64)  NOT NULL,
    file_data       BYTEA        NOT NULL,
    text_chars      INTEGER      NOT NULL DEFAULT 0,
    chunk_count     INTEGER      NOT NULL DEFAULT 0,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_bot_documents_id             ON bot_documents (id);
CREATE INDEX IF NOT EXISTS ix_bot_documents_bot_id         ON bot_documents (bot_id);
CREATE INDEX IF NOT EXISTS ix_bot_documents_institution_id ON bot_documents (institution_id);

CREATE TABLE IF NOT EXISTS bot_document_chunks (
    id           SERIAL PRIMARY KEY,
    document_id  INTEGER NOT NULL REFERENCES bot_documents(id) ON DELETE CASCADE,
    bot_id       INTEGER NOT NULL,
    chunk_index  INTEGER NOT NULL,
    content      TEXT    NOT NULL,
    terms        TEXT    NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS ix_bot_document_chunks_id          ON bot_document_chunks (id);
CREATE INDEX IF NOT EXISTS ix_bot_document_chunks_document_id ON bot_document_chunks (document_id);
CREATE INDEX IF NOT EXISTS ix_bot_document_chunks_bot_id      ON bot_document_chunks (bot_id);

-- Las tablas solo se consultan desde el backend. Activar RLS sin políticas
-- bloquea el acceso directo por la API pública de Supabase (anon/authenticated);
-- el backend se conecta con el rol dueño de las tablas y no se ve afectado.
ALTER TABLE bot_documents       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_document_chunks ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verificación: deben aparecer las dos tablas.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('bot_documents', 'bot_document_chunks');
