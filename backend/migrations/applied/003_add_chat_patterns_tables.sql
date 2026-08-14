-- Script para crear/asegurar tablas necesarias para persistencia del chat neuroconductual
-- Ejecutar: python backend/migrations/run_migration.py

CREATE TABLE IF NOT EXISTS cognitive_session_state (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    topic VARCHAR NOT NULL,
    msg_count INTEGER DEFAULT 0,
    error_streak INTEGER DEFAULT 0,
    fast_replies INTEGER DEFAULT 0,
    slow_replies INTEGER DEFAULT 0,
    total_rt_ms DOUBLE PRECISION DEFAULT 0.0,
    quiz_error_rate DOUBLE PRECISION DEFAULT 0.0,
    weak_concepts JSON DEFAULT '[]'::json,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cognitive_session_state_user_topic
    ON cognitive_session_state (user_id, topic);

CREATE TABLE IF NOT EXISTS learning_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    bot_id INTEGER,
    topic VARCHAR(200),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    current_difficulty VARCHAR(20) DEFAULT 'medium',
    total_interactions INTEGER DEFAULT 0,
    correct_responses INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    avg_response_time_ms DOUBLE PRECISION DEFAULT 0.0,
    last_cognitive_state VARCHAR(20) DEFAULT 'normal',
    cognitive_state_history JSON DEFAULT '[]'::json,
    session_summary JSON DEFAULT '{}'::json
);

CREATE TABLE IF NOT EXISTS cognitive_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    session_id INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(50),
    event_data JSON DEFAULT '{}'::json,
    response_time_ms DOUBLE PRECISION,
    typing_speed_cpm DOUBLE PRECISION,
    error_rate DOUBLE PRECISION,
    correction_count INTEGER DEFAULT 0,
    pause_duration_ms DOUBLE PRECISION,
    inferred_state VARCHAR(20) DEFAULT 'normal',
    confidence_score DOUBLE PRECISION DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    role VARCHAR(20),
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_time_ms DOUBLE PRECISION,
    cognitive_state_at_time VARCHAR(20),
    difficulty_at_time VARCHAR(20),
    metadata JSON DEFAULT '{}'::json
);

CREATE INDEX IF NOT EXISTS idx_learning_sessions_user_topic
    ON learning_sessions (user_id, topic);

CREATE INDEX IF NOT EXISTS idx_cognitive_events_user_session
    ON cognitive_events (user_id, session_id, timestamp);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
    ON chat_messages (session_id, timestamp);
