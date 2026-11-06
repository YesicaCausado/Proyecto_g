-- Registra separadamente la autorización del acudiente y el acuse del aviso
-- de privacidad del estudiante. El acuse no sustituye una autorización legal.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_consent_date VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_authorization_reference VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_confirmation_recorded_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_confirmation_by_id INTEGER;

CREATE TABLE IF NOT EXISTS student_privacy_notices (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_version VARCHAR(20) NOT NULL,
    presented_at TIMESTAMP NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    CONSTRAINT uq_student_privacy_notice_version UNIQUE (user_id, policy_version)
);

CREATE INDEX IF NOT EXISTS ix_student_privacy_notices_user_id
    ON student_privacy_notices (user_id);
ALTER TABLE student_privacy_notices ENABLE ROW LEVEL SECURITY;

COMMIT;
