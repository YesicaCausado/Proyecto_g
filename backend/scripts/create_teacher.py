"""
Script para crear un usuario profesor usando SQL directo.

FIX de seguridad: las credenciales Supabase (host/usuario/contraseña) estaban
hardcodeadas en el código fuente. Ahora la conexión se toma de DATABASE_URL
(backend/.env o variable de entorno), igual que el resto de la aplicación.
"""
import sys
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from passlib.context import CryptContext
from datetime import datetime, timezone

# Configurar contexto de hash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hashear contraseña"""
    return pwd_context.hash(password)


def _build_db_config() -> dict:
    """Construye la config de conexión psycopg2 desde DATABASE_URL del entorno."""
    from app.core.config import settings

    url = settings.DATABASE_URL
    if not url:
        raise RuntimeError(
            "DATABASE_URL no está configurada (backend/.env o variable de entorno)."
        )
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    from urllib.parse import urlparse, parse_qsl, unquote

    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query))
    config = {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path.lstrip("/"),
        "user": unquote(parsed.username or ""),
        "password": unquote(parsed.password or ""),
    }
    # sslmode se pasa por la URL en psycopg2 ≥2.9 vía dsn; para simplificar,
    # si la URL trae sslmode=require lo dejamos en la cadena de conexión.
    if "sslmode" in query:
        config["sslmode"] = query["sslmode"]
    return config


def create_teacher_sql(username: str, email: str, full_name: str, password: str):
    """Crear profesor usando SQL directo"""
    import psycopg2
    import json

    try:
        DB_CONFIG = _build_db_config()
    except RuntimeError as e:
        print(f"❌ Error: {e}")
        return False

    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()

        # Verificar si el usuario ya existe
        cursor.execute(
            "SELECT id FROM users WHERE username = %s OR email = %s",
            (username, email),
        )
        if cursor.fetchone():
            print(f"❌ Error: El usuario '{username}' o el email '{email}' ya existe")
            cursor.close()
            conn.close()
            return False

        # Insertar nuevo profesor
        hashed_pwd = hash_password(password)
        cognitive_profile = json.dumps({
            "learning_speed": 0.5,
            "error_tolerance": 0.5,
            "preferred_difficulty": "medium",
            "fatigue_pattern": [],
            "strong_areas": [],
            "weak_areas": [],
            "total_sessions": 0,
            "avg_session_duration": 0,
        })
        now_utc = datetime.now(timezone.utc)

        cursor.execute("""
            INSERT INTO users (
                username, email, hashed_password, full_name,
                role, is_active, is_expert, created_at, updated_at, cognitive_profile
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            RETURNING id, username, email, full_name, role, is_active, is_expert
        """, (
            username, email, hashed_pwd, full_name,
            'profesor', True, True, now_utc, now_utc,
            cognitive_profile
        ))

        new_teacher = cursor.fetchone()
        conn.commit()

        print(f"""
✅ ¡Profesor creado exitosamente!

📋 Información del Profesor:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Usuario:        {new_teacher[1]}
📧 Email:          {new_teacher[2]}
👤 Nombre:         {new_teacher[3]}
👨‍🏫 Rol:            {new_teacher[4].upper()}
✓ Activo:          {new_teacher[5]}
🧠 Acceso Experto:  {new_teacher[6]}
📝 ID:             {new_teacher[0]}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        """)

        cursor.close()
        conn.close()
        return True

    except Exception as e:
        print(f"❌ Error al crear el profesor: {str(e)}")
        return False


def main():
    """Función principal"""
    print("""
╔════════════════════════════════════════╗
║  CREAR NUEVO USUARIO PROFESOR         ║
║  NeuroLearn AI                         ║
╚════════════════════════════════════════╝
    """)

    # Solicitar datos
    username = input("👤 Usuario (username): ").strip()
    if not username:
        print("❌ El usuario no puede estar vacío")
        return

    email = input("📧 Email: ").strip()
    if not email or "@" not in email:
        print("❌ Email inválido")
        return

    full_name = input("👨‍🏫 Nombre completo: ").strip()
    if not full_name:
        print("❌ El nombre no puede estar vacío")
        return

    password = input("🔐 Contraseña: ").strip()
    if not password or len(password) < 6:
        print("❌ La contraseña debe tener al menos 6 caracteres")
        return

    confirm_password = input("🔐 Confirmar contraseña: ").strip()
    if password != confirm_password:
        print("❌ Las contraseñas no coinciden")
        return

    # Crear profesor
    if create_teacher_sql(username, email, full_name, password):
        print("✨ ¡Profesor registrado correctamente!")
    else:
        print("🚫 No se pudo crear el profesor")


if __name__ == "__main__":
    main()
