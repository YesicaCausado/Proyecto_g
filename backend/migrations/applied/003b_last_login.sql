-- ================================================================
-- NeuroLearn IA — Migración 003
-- Agrega columna last_login a la tabla users
-- Ejecutada: Julio 2026
-- ================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
