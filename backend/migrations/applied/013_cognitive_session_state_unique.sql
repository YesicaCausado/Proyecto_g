CREATE UNIQUE INDEX IF NOT EXISTS uq_user_topic_state
    ON cognitive_session_state (user_id, topic);

ALTER TABLE cognitive_session_state
    ADD COLUMN IF NOT EXISTS neural_state JSONB DEFAULT '{}'::jsonb;
