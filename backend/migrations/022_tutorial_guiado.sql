-- Progreso del tutorial guiado por usuario. No modifica datos académicos.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS tutorial_role VARCHAR(20),
    ADD COLUMN IF NOT EXISTS tutorial_step INTEGER NOT NULL DEFAULT 0;
