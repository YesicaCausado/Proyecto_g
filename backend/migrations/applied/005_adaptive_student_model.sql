-- NeuroLearn AI — Sistema Neurodigital Adaptativo
-- Tablas del Student Model + memoria entre conversaciones + conversaciones.
-- Ejecutar: python backend/migrations/run_migration.py (o vía migrate.py)

CREATE TABLE IF NOT EXISTS student_mastery (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(60) NOT NULL,
    skill VARCHAR(120) NOT NULL,
    topic VARCHAR(200) DEFAULT '',
    mastery DOUBLE PRECISION DEFAULT 0.0,
    attempts INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    consecutive_wrong INTEGER DEFAULT 0,
    weak_concepts JSON DEFAULT '[]'::json,
    strength_concepts JSON DEFAULT '[]'::json,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_student_mastery_student ON student_mastery (student_id, skill);
CREATE INDEX IF NOT EXISTS idx_student_mastery_student_subj ON student_mastery (student_id, subject);

CREATE TABLE IF NOT EXISTS learning_state (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    subject VARCHAR(60) NOT NULL,
    skill VARCHAR(120) NOT NULL,
    topic VARCHAR(200) DEFAULT '',
    current_step VARCHAR(200) DEFAULT '',
    difficulty VARCHAR(20) DEFAULT 'medium',
    mastery DOUBLE PRECISION DEFAULT 0.0,
    last_activity VARCHAR(300) DEFAULT '',
    last_result VARCHAR(20) DEFAULT '',
    detected_difficulty VARCHAR(300) DEFAULT '',
    next_recommended_action VARCHAR(300) DEFAULT '',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_learning_state_student_skill ON learning_state (student_id, skill);

CREATE TABLE IF NOT EXISTS student_memory (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    memory_type VARCHAR(20) DEFAULT 'episodio',
    subject VARCHAR(60) DEFAULT '',
    skill VARCHAR(120) DEFAULT '',
    content TEXT NOT NULL,
    source VARCHAR(60) DEFAULT '',
    importance DOUBLE PRECISION DEFAULT 0.5,
    confidence DOUBLE PRECISION DEFAULT 0.5,
    event_ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_student_memory_student_skill ON student_memory (student_id, skill, memory_type);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES users(id),
    bot_id INTEGER REFERENCES expert_bots(id),
    title VARCHAR(200) DEFAULT 'Nueva conversación',
    subject VARCHAR(60) DEFAULT '',
    skill VARCHAR(120) DEFAULT '',
    topic VARCHAR(200) DEFAULT '',
    current_learning_goal VARCHAR(300) DEFAULT '',
    current_progress VARCHAR(300) DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_conversations_student ON conversations (student_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    student_id INTEGER NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON DEFAULT '{}'::json
);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conv ON conversation_messages (conversation_id, timestamp);