-- NeuroLearn IA — Migración 015: NeuroAlertas marcadas como resueltas
--
-- Las NeuroAlertas se calculan en cada consulta; esta tabla solo guarda que
-- un profesor o Súper Profesor revisó una alerta concreta. Si la condición
-- que la originó cambia (firma distinta), la alerta vuelve a mostrarse.
--
-- Idempotente. El backend también crea la tabla al arrancar (create_all),
-- así que el despliegue no falla si todavía no se ejecutó en Supabase.

BEGIN;

CREATE TABLE IF NOT EXISTS alert_acknowledgements (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER      NOT NULL REFERENCES users(id),
    alert_key  VARCHAR(80)  NOT NULL,
    signature  VARCHAR(200) NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_alert_ack_user_key UNIQUE (user_id, alert_key)
);
CREATE INDEX IF NOT EXISTS ix_alert_acknowledgements_user_id ON alert_acknowledgements (user_id);

-- Solo el backend accede a esta tabla (igual que en las migraciones 008-011).
ALTER TABLE alert_acknowledgements ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT COUNT(*) AS alertas_resueltas FROM alert_acknowledgements;
