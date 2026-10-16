-- ============================================================
-- Migración: agregar campos de eliminación a direct_messages
-- NeuroLearn AI
-- ============================================================

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS deleted_for_sender   BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_for_receiver BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_for_all      BOOLEAN NOT NULL DEFAULT FALSE;