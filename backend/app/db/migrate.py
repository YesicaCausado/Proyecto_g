"""
NeuroLearn AI — Preparación del esquema al arrancar.

En PostgreSQL, prepare_postgres_schema solo lee el catálogo y ejecuta DDL
para lo que falte (ver el comentario de esa sección). En SQLite (desarrollo),
_add_missing_sqlite_columns completa las columnas nuevas.
"""
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def _add_missing_sqlite_columns(engine) -> None:
    """
    SQLite no soporta `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Compara el
    esquema actual con los modelos (Base.metadata) y añade las columnas que
    falten.

    Repara bases de desarrollo creadas con versiones anteriores de la app:
    Base.metadata.create_all crea tablas NUEVAS pero nunca altera las que ya
    existen, así que al añadir columnas a los modelos (p.ej. users.photo,
    last_login, campos B2B) la base vieja quedaba desincronizada y cualquier
    query fallaba con "no such column".
    """
    from sqlalchemy import inspect, text
    from app.db.database import Base

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    added = 0
    errors = 0

    for table in Base.metadata.tables.values():
        if table.name not in existing_tables:
            continue  # tabla nueva: la crea Base.metadata.create_all
        existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
        for col in table.columns:
            if col.name in existing_cols:
                continue
            try:
                col_type = col.type.compile(engine.dialect)
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'
                if not col.nullable:
                    # ALTER TABLE de SQLite exige DEFAULT para NOT NULL sobre
                    # tablas con datos: se usa un valor neutro por tipo.
                    base_type = col_type.split("(")[0].upper()
                    neutral = {
                        "BOOLEAN": "0",
                        "INTEGER": "0",
                        "BIGINT": "0",
                        "FLOAT": "0.0",
                        "REAL": "0.0",
                        "NUMERIC": "0",
                    }.get(base_type, "''")
                    ddl += f" NOT NULL DEFAULT {neutral}"
                with engine.begin() as conn:
                    conn.execute(text(ddl))
                added += 1
                logger.info(f"SQLite: columna añadida {table.name}.{col.name}")
            except Exception as e:
                errors += 1
                logger.error(f"SQLite: no se pudo añadir {table.name}.{col.name}: {e}")

    if added or errors:
        logger.info(f"SQLite schema drift: {added} columnas añadidas, {errors} errores.")


# ─── Esquema al arrancar (PostgreSQL) ────────────────────────────────────────
#
# Antes, en CADA arranque en frío de Vercel se ejecutaban create_all (una
# consulta por tabla), tres ALTER TABLE sin lock_timeout, tres CREATE INDEX y
# un UPDATE de todas las aulas, y parte de ello en un hilo de fondo que Vercel
# congelaba a mitad de la transacción. ALTER TABLE toma un bloqueo exclusivo
# aunque la columna ya exista: si había una consulta larga sobre la tabla, el
# ALTER quedaba en cola y TODAS las consultas siguientes esperaban detrás de él
# hasta el statement_timeout → «se cae la base de datos».
#
# Ahora `prepare_postgres_schema` lee el catálogo con 3 consultas de solo
# lectura y solo ejecuta DDL para lo que de verdad falta, con lock_timeout
# corto. Los índices se crean CONCURRENTLY (no bloquean lecturas ni escrituras).

# Columnas que el código usa aunque el SQL de migrations/ no se haya ejecutado
# en Supabase. (tabla, columna, definición)
RUNTIME_COLUMNS = [
    # Registro verificable de autorización institucional del acudiente (021).
    ("users", "guardian_consent_date", "VARCHAR(10)"),
    ("users", "guardian_authorization_reference", "VARCHAR(100)"),
    ("users", "guardian_confirmation_recorded_at", "TIMESTAMP"),
    ("users", "guardian_confirmation_by_id", "INTEGER"),
    # Eliminación de mensajes (migrations/applied/delete_fields.sql)
    ("direct_messages", "deleted_for_sender", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("direct_messages", "deleted_for_receiver", "BOOLEAN NOT NULL DEFAULT FALSE"),
    ("direct_messages", "deleted_for_all", "BOOLEAN NOT NULL DEFAULT FALSE"),
    # Retiro de estudiantes (migrations/016_retiro_estudiantes.sql)
    ("enrollments", "removed_at", "TIMESTAMP"),
    ("enrollments", "removed_by", "INTEGER REFERENCES users(id)"),
    ("enrollments", "removed_invite_code", "VARCHAR(8)"),
    # Resolución del grupo de cada quiz (016)
    ("quiz_history", "group_resolution", "VARCHAR(20)"),
    # Reportes institucionales (014)
    ("classrooms", "competency", "VARCHAR(30)"),
    ("teacher_evaluations", "competency", "VARCHAR(30)"),
    ("quiz_history", "competency", "VARCHAR(30)"),
    # Evaluación del tutor de IA en el diagnóstico inicial (019)
    ("diagnostic_results", "tutor_feedback", "TEXT"),
    ("diagnostic_results", "feedback_provider", "VARCHAR(20)"),
]

# Índices que deben existir. (nombre, tabla, columnas). Los ix_* coinciden con
# los que crea SQLAlchemy para index=True, así una BD nueva no los duplica.
# Ver migrations/017_indices_rendimiento.sql.
REQUIRED_INDEXES = [
    # Reportes institucionales (014)
    ("idx_eval_submissions_eval_student", "evaluation_submissions", "evaluation_id, student_id"),
    ("idx_eval_submissions_submitted", "evaluation_submissions", "submitted_at"),
    ("idx_teacher_evaluations_classroom", "teacher_evaluations", "classroom_id"),
    # Rendimiento (017): claves foráneas que se filtran en casi todas las
    # páginas y que PostgreSQL no indexa por sí solo.
    ("ix_direct_messages_sender_id", "direct_messages", "sender_id"),
    ("ix_direct_messages_receiver_id", "direct_messages", "receiver_id"),
    ("ix_posts_classroom_id", "posts", "classroom_id"),
    ("ix_posts_teacher_id", "posts", "teacher_id"),
    ("ix_post_comments_post_id", "post_comments", "post_id"),
    ("ix_post_reactions_post_id", "post_reactions", "post_id"),
    ("ix_classroom_events_classroom_id", "classroom_events", "classroom_id"),
    ("ix_classroom_events_teacher_id", "classroom_events", "teacher_id"),
    ("ix_expert_bots_creator_id", "expert_bots", "creator_id"),
    ("ix_classroom_bots_bot_id", "classroom_bots", "bot_id"),
    ("ix_learning_sessions_bot_id", "learning_sessions", "bot_id"),
    ("ix_teacher_evaluations_teacher_id", "teacher_evaluations", "teacher_id"),
    ("ix_teacher_materials_teacher_id", "teacher_materials", "teacher_id"),
    ("ix_teacher_materials_folder_id", "teacher_materials", "folder_id"),
    ("ix_teacher_folders_teacher_id", "teacher_folders", "teacher_id"),
    ("ix_quiz_history_classroom_id", "quiz_history", "classroom_id"),
    ("ix_student_bot_assignments_teacher_id", "student_bot_assignments", "teacher_id"),
    # Bloqueo persistente de cuentas (019): fallos recientes de un usuario.
    ("idx_audit_logs_actor_action_created", "audit_logs", "performed_by_id, action, created_at"),
]

_DDL_LOCK_TIMEOUT = "3s"
_DDL_STATEMENT_TIMEOUT = "30s"


# Backfill de la migración 014: competencia de las aulas antiguas por
# equivalencia exacta con las opciones de «Crear clase». Va aquí y no se lee de
# migrations/014_*.sql porque vercel.json excluye migrations/ del despliegue.
_BACKFILL_CLASSROOM_COMPETENCY = """
UPDATE classrooms SET competency = CASE lower(translate(subject, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
    WHEN 'matematicas' THEN 'matematicas'
    WHEN 'razonamiento cuantitativo' THEN 'matematicas'
    WHEN 'lenguaje' THEN 'lectora'
    WHEN 'lectura critica' THEN 'lectora'
    WHEN 'ingles' THEN 'ingles'
    WHEN 'ciencias naturales' THEN 'cientifico'
    WHEN 'ciencias sociales' THEN 'ciudadanas'
    WHEN 'competencias ciudadanas' THEN 'ciudadanas'
    ELSE NULL END
WHERE competency IS NULL
"""


def _backfill_classroom_competency(engine) -> None:
    """Solo se ejecuta cuando la columna se acaba de crear, no en cada arranque."""
    with engine.begin() as conn:
        conn.execute(text(f"SET LOCAL statement_timeout = '{_DDL_STATEMENT_TIMEOUT}'"))
        conn.execute(text(_BACKFILL_CLASSROOM_COMPETENCY))


def prepare_postgres_schema(engine) -> None:
    """Crea tablas, columnas e índices que falten. Barato si no falta nada."""
    if engine is None or engine.dialect.name != "postgresql":
        return
    from app.db.database import Base

    try:
        with engine.connect() as conn:
            tables = {r[0] for r in conn.execute(text(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema()"))}
            columns = {(r[0], r[1]) for r in conn.execute(text(
                "SELECT table_name, column_name FROM information_schema.columns "
                "WHERE table_schema = current_schema()"))}
            indexes = {r[0]: r[1] for r in conn.execute(text(
                "SELECT c.relname, i.indisvalid FROM pg_index i "
                "JOIN pg_class c ON c.oid = i.indexrelid "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                "WHERE n.nspname = current_schema()"))}
    except Exception as e:  # noqa: BLE001
        logger.error(f"Esquema: no se pudo leer el catálogo: {str(e)[:200]}")
        return

    missing_tables = [t for t in Base.metadata.tables.values() if t.name not in tables]
    if missing_tables:
        try:
            Base.metadata.create_all(bind=engine, tables=missing_tables)
            logger.info("Tablas creadas al arrancar: %s", ", ".join(t.name for t in missing_tables))
            # Sin RLS, Supabase expondría la tabla nueva por su API REST. El
            # backend entra como dueño de las tablas y no se ve afectado.
            with engine.begin() as conn:
                for t in missing_tables:
                    conn.execute(text(f'ALTER TABLE "{t.name}" ENABLE ROW LEVEL SECURITY'))
        except Exception as e:  # noqa: BLE001
            logger.error(f"Esquema: no se pudieron crear tablas: {str(e)[:200]}")
    created = {t.name for t in missing_tables}
    tables |= created

    added = set()
    for table, column, definition in RUNTIME_COLUMNS:
        # Tabla recién creada: create_all ya la creó con la columna.
        if table not in tables or table in created or (table, column) in columns:
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(f"SET LOCAL lock_timeout = '{_DDL_LOCK_TIMEOUT}'"))
                conn.execute(text(f"SET LOCAL statement_timeout = '{_DDL_STATEMENT_TIMEOUT}'"))
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"))
            added.add((table, column))
            logger.info(f"Columna agregada al arrancar: {table}.{column}")
        except Exception as e:  # noqa: BLE001
            logger.error(f"Columna de arranque {table}.{column}: {str(e)[:200]}")

    if ("classrooms", "competency") in added:
        try:
            _backfill_classroom_competency(engine)
        except Exception as e:  # noqa: BLE001
            logger.error(f"Backfill de competencias: {str(e)[:200]}")

    pending = [(n, t, c) for n, t, c in REQUIRED_INDEXES if t in tables and indexes.get(n) is not True]
    if not pending:
        return
    # CREATE INDEX CONCURRENTLY no admite transacción: conexión en autocommit.
    try:
        with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            conn.execute(text(f"SET lock_timeout = '{_DDL_LOCK_TIMEOUT}'"))
            conn.execute(text(f"SET statement_timeout = '{_DDL_STATEMENT_TIMEOUT}'"))
            for name, table, cols in pending:
                try:
                    if indexes.get(name) is False:
                        # Un CONCURRENTLY interrumpido deja el índice inválido.
                        conn.execute(text(f"DROP INDEX CONCURRENTLY IF EXISTS {name}"))
                    conn.execute(text(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {table} ({cols})"))
                    logger.info(f"Índice creado al arrancar: {name}")
                except Exception as e:  # noqa: BLE001
                    logger.error(f"Índice {name}: {str(e)[:200]}")
    except Exception as e:  # noqa: BLE001
        logger.error(f"Índices de arranque: {str(e)[:200]}")


def run_migrations(engine) -> None:
    """
    Aplica todas las migraciones B2B pendientes.
    Seguro de ejecutar en cada arranque del servidor.
    """
    if engine is None:
        logger.warning("run_migrations: engine es None, omitiendo.")
        return

    # Las migraciones B2B están escritas con sintaxis específica de PostgreSQL
    # (SERIAL, JSONB, BYTEA, ALTER TABLE ... ADD COLUMN IF NOT EXISTS, índices
    # parciales). En SQLite el esquema completo se crea desde los modelos con
    # Base.metadata.create_all (las columnas B2B ya están en app/models), así
    # que aquí no hay nada que aplicar y ejecutarlas solo generaría errores.
    if engine.dialect.name != "postgresql":
        _add_missing_sqlite_columns(engine)
        return

    migrations = [
        # ── 1. Tabla institutions ────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS institutions (
            id           SERIAL PRIMARY KEY,
            name         VARCHAR(200) NOT NULL,
            dane_code    VARCHAR(20)  NOT NULL,
            is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
            created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
            created_by   INTEGER
        )
        """,
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_institutions_dane_code
            ON institutions (dane_code)
        """,

        # ── 2. Columnas B2B en users ─────────────────────────────────────────
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS document_number      VARCHAR(30)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS document_type        VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS institution_id       INTEGER",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS subject_area         VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS grade                VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date           VARCHAR(20)",
        # avatar del usuario (data URL base64 de la foto de perfil)
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT",
        # columnas base que pueden faltar si la tabla se creó antes del modelo actual
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_expert   BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name   VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS cognitive_profile JSONB",
        # Parche 14 (auditoría): cierre de sesiones y autorización del acudiente
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS sessions_valid_after      TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_name             VARCHAR(150)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_authorized_at    TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS guardian_authorized_by_id INTEGER",

        # Índice único parcial en document_number
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_document_number
            ON users (document_number)
            WHERE document_number IS NOT NULL
        """,

        # ── 3. Foreign keys (solo PostgreSQL, con bloque DO $$ anónimo) ──────
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'users_institution_id_fkey'
                  AND table_name = 'users'
            ) THEN
                ALTER TABLE users
                    ADD CONSTRAINT users_institution_id_fkey
                    FOREIGN KEY (institution_id) REFERENCES institutions(id);
            END IF;
        END $$
        """,
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'institutions_created_by_fkey'
                  AND table_name = 'institutions'
            ) THEN
                ALTER TABLE institutions
                    ADD CONSTRAINT institutions_created_by_fkey
                    FOREIGN KEY (created_by) REFERENCES users(id);
            END IF;
        END $$
        """,

        # ── 4. Tabla audit_logs ──────────────────────────────────────────────
        """
        CREATE TABLE IF NOT EXISTS audit_logs (
            id               SERIAL PRIMARY KEY,
            action           VARCHAR(100) NOT NULL,
            performed_by_id  INTEGER REFERENCES users(id),
            target_user_id   INTEGER REFERENCES users(id),
            institution_id   INTEGER REFERENCES institutions(id),
            user_type        VARCHAR(30),
            ip_address       VARCHAR(45),
            notes            TEXT,
            created_at       TIMESTAMP NOT NULL DEFAULT NOW()
        )
        """,

        # ── 5. Columnas de configuración institucional ─────────────────────
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS email VARCHAR(200)",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS phone VARCHAR(50)",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS address VARCHAR(255)",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS website VARCHAR(255)",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) DEFAULT 'America/Bogota'",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'es'",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS primary_color VARCHAR(20) DEFAULT '#6940A5'",
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS logo_url TEXT",
        "ALTER TABLE institutions ALTER COLUMN logo_url TYPE TEXT",

        # ── 6. Columnas que pueden faltar en institutions si la tabla fue
        #      creada antes de agregar estos campos ────────────────────────
        "ALTER TABLE institutions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",

        # ── 7. Columnas legacy en institutions: hacerlas NULLABLE y quitar
        #      DEFAULT '' para que los inserts modernos no violen UNIQUE. ──
        """
        DO $$
        DECLARE
            col_rec RECORD;
        BEGIN
            FOR col_rec IN
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'institutions'
                  AND table_schema = 'public'
                  AND column_name NOT IN ('id','name','dane_code',
                                          'is_active','created_at','created_by')
                  AND data_type IN ('character varying','text','character','integer',
                                    'bigint','boolean','numeric')
            LOOP
                -- Quitar restricción NOT NULL (idempotente si ya es nullable)
                EXECUTE format(
                    'ALTER TABLE institutions ALTER COLUMN %I DROP NOT NULL',
                    col_rec.column_name
                );
                -- Quitar DEFAULT '' que pusimos antes (evita UNIQUE con '')
                EXECUTE format(
                    'ALTER TABLE institutions ALTER COLUMN %I DROP DEFAULT',
                    col_rec.column_name
                );
                -- Limpiar filas que tienen '' para que no molesten
                EXECUTE format(
                    'UPDATE institutions SET %I = NULL WHERE %I = ''''',
                    col_rec.column_name, col_rec.column_name
                );
            END LOOP;
        END $$
        """,

        # ── 8. Eliminar UNIQUE constraints de columnas legacy que no son
        #      parte del nuevo modelo — admin_email, admin_document, etc.
        #      Un NULL puede repetirse, pero '' con UNIQUE falla. ──────────
        """
        DO $$
        DECLARE
            con_rec RECORD;
        BEGIN
            FOR con_rec IN
                SELECT tc.constraint_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.constraint_column_usage ccu
                     ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_name      = tc.table_name
                WHERE tc.table_name       = 'institutions'
                  AND tc.table_schema     = 'public'
                  AND tc.constraint_type  = 'UNIQUE'
                  AND ccu.column_name NOT IN ('dane_code')
            LOOP
                EXECUTE format(
                    'ALTER TABLE institutions DROP CONSTRAINT IF EXISTS %I',
                    con_rec.constraint_name
                );
            END LOOP;
        END $$
        """,

        # ── 9. Columnas que pueden faltar en classrooms ───────────────────
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS color       VARCHAR(20)  DEFAULT '#0B6E99'",
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS invite_code VARCHAR(20)  DEFAULT NULL",
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS description TEXT         DEFAULT NULL",
        "ALTER TABLE classrooms ADD COLUMN IF NOT EXISTS max_students INTEGER     DEFAULT 40",

        # ── 10. Columnas que pueden faltar en audit_logs ──────────────────
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_type  VARCHAR(30)",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45)",

        # ── 11. classroom_id en quiz_history — vínculo quiz ↔ clase para seguimiento ──
    "ALTER TABLE quiz_history ADD COLUMN IF NOT EXISTS classroom_id INTEGER REFERENCES classrooms(id)",

        # ── 12. teacher_materials: contenido binario real de los archivos ──────
    "ALTER TABLE teacher_materials ADD COLUMN IF NOT EXISTS mime_type     VARCHAR(80)",
    "ALTER TABLE teacher_materials ADD COLUMN IF NOT EXISTS original_name VARCHAR(255)",
    "ALTER TABLE teacher_materials ADD COLUMN IF NOT EXISTS has_file      BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE teacher_materials ADD COLUMN IF NOT EXISTS content BYTEA",

        # ── 13. chat_answers en cognitive_session_state — ventana móvil de
        #      veredictos del chat (Patrón 5 en tiempo real). El modelo
        #      `CognitiveSessionState.chat_answers` ya lo espera; sin esta
        #      columna, _load_session_stats() falla y deja la transacción en
        #      estado aborted, rompiendo /chat/message con 500. ──────────
    "ALTER TABLE cognitive_session_state ADD COLUMN IF NOT EXISTS chat_answers JSONB DEFAULT '[]'::jsonb",

        # ── 13b. neural_state en cognitive_session_state — estado compacto del
        #       motor neuroconductual (baselines + prior + EMA) para reconstruir
        #       la personalización entre cold starts serverless. El modelo
        #       `CognitiveSessionState.neural_state` ya lo espera. ──────────
        "ALTER TABLE cognitive_session_state ADD COLUMN IF NOT EXISTS neural_state JSONB DEFAULT '{}'::jsonb",
                # ── 10b. Sincronización de expert_bots ─────────────────────────────
        # El modelo ExpertBot contiene columnas que no existían en versiones
        # anteriores de la base de datos de producción.
        #
        # IMPORTANTE:
        # SQLAlchemy selecciona TODAS las columnas del modelo cuando ejecuta
        # db.query(ExpertBot). Por eso una sola columna faltante (por ejemplo
        # language) puede romper cualquier consulta de ExpertBot.
        # ── Sincronización de expert_bots ─────────────────────────────────────
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'es'",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS difficulty_range JSONB DEFAULT '{\"min\":\"beginner\",\"max\":\"expert\"}'::jsonb",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT ''",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS personality JSONB DEFAULT '{\"teaching_style\":\"balanced\",\"verbosity\":\"medium\",\"use_examples\":true,\"use_analogies\":true}'::jsonb",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS knowledge_base JSONB DEFAULT '{\"steps\":[],\"warnings\":[],\"rules\":[],\"tips\":[],\"scenarios\":[],\"faq\":[]}'::jsonb",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS total_users INTEGER NOT NULL DEFAULT 0",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS avg_rating DOUBLE PRECISION NOT NULL DEFAULT 0.0",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS total_sessions INTEGER NOT NULL DEFAULT 0",
"ALTER TABLE expert_bots ADD COLUMN IF NOT EXISTS effectiveness_score DOUBLE PRECISION NOT NULL DEFAULT 0.0",
        # ── 14. Índices secundarios de rendimiento ──────────────────────────
        # Las consultas agregadas (count/avg/group_by) sobre columnas calientes
        # hacían seq scan sobre tablas completas en PostgreSQL. Estos índices
        # aceleran los dashboards de profesor/estudiante y evitan N+1 en
        # enrollments, quiz_history, learning_sessions y cognitive_events.
        "CREATE INDEX IF NOT EXISTS idx_enrollments_student_id  ON enrollments (student_id)",
        "CREATE INDEX IF NOT EXISTS idx_enrollments_classroom_id ON enrollments (classroom_id) WHERE is_active = TRUE",
        "CREATE INDEX IF NOT EXISTS idx_quiz_history_user_id     ON quiz_history (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_quiz_history_completed   ON quiz_history (user_id, completed_at)",
        "CREATE INDEX IF NOT EXISTS idx_quiz_history_perf        ON quiz_history (user_id, performance_score)",
        "CREATE INDEX IF NOT EXISTS idx_classrooms_teacher_id    ON classrooms (teacher_id) WHERE is_active = TRUE",
        "CREATE INDEX IF NOT EXISTS idx_learning_sessions_user   ON learning_sessions (user_id)",
        "CREATE INDEX IF NOT EXISTS idx_cognitive_events_user_ts ON cognitive_events (user_id, timestamp)",
        "CREATE INDEX IF NOT EXISTS idx_classroom_bots_classroom ON classroom_bots (classroom_id)",
        "CREATE INDEX IF NOT EXISTS idx_users_institution_id     ON users (institution_id) WHERE institution_id IS NOT NULL",

        # ── 15. Adjuntos en mensajes directos (direct_messages) ───────────
        "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)",
        "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(80)",
        "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS attachment_size INTEGER",
        "ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS attachment_data BYTEA",

        # ── 16. institution_id en classroom_events — scope multi-tenant del
        #        calendario. Antes los eventos eran "globales" (classroom_id
        #        NULL) sin institución, por lo que un evento institucional de
        #        una institución podía aparecerle (o no) a estudiantes de otra.
        "ALTER TABLE classroom_events ADD COLUMN IF NOT EXISTS institution_id INTEGER",
        "CREATE INDEX IF NOT EXISTS idx_classroom_events_institution ON classroom_events (institution_id)"
        " WHERE institution_id IS NOT NULL",
        # Backfill: asociar eventos existentes a la institución de su profesor.
        "UPDATE classroom_events ce SET institution_id = u.institution_id"
        " FROM users u WHERE ce.teacher_id = u.id AND ce.institution_id IS NULL",
    ]

    applied = 0
    errors  = 0
    is_pg   = engine.dialect.name == "postgresql"

    # Cada migración en su PROPIA transacción para que un fallo no
    # deje la transacción global en estado "aborted" en PostgreSQL.
    for i, sql in enumerate(migrations):
        sql = sql.strip()
        if not is_pg and sql.startswith("DO $$"):
            continue
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
            applied += 1
        except Exception as e:
            err_str = str(e)
            ignore_phrases = [
                "already exists",
                "duplicate column",
                "ya existe",
                "DuplicateColumn",
            ]
            if any(p.lower() in err_str.lower() for p in ignore_phrases):
                logger.debug(f"Migración {i+1} omitida (ya existente): {err_str[:80]}")
            else:
                logger.error(f"Error en migración {i+1}: {err_str[:200]}")
                errors += 1

    if errors == 0:
        logger.info(f"✅ Migraciones B2B completadas: {applied} pasos aplicados.")
    else:
        logger.warning(
            f"⚠️ Migraciones B2B: {applied} OK, {errors} con errores (ver logs)."
        )
