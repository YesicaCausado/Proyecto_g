"""
Script para crear un usuario profesor de forma rápida (no-interactivo)
Uso: python create_teacher_quick.py <username> <email> <full_name> <password>
"""
import sys
from passlib.context import CryptContext
from datetime import datetime
import psycopg2
import json

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Hashear contraseña"""
    return pwd_context.hash(password)

def create_teacher_sql(username: str, email: str, full_name: str, password: str):
    """Crear profesor usando SQL directo"""
    
    # Datos de conexión Supabase
    DB_CONFIG = {
        'host': 'aws-1-sa-east-1.pooler.supabase.com',
        'port': 5432,
        'database': 'postgres',
        'user': 'postgres.sapozcwaspvibklyfldr',
        'password': 'UntoD@wn2712'
    }
    
    try:
        # Conectar a la base de datos
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Verificar si el usuario ya existe
        cursor.execute(
            "SELECT id FROM users WHERE username = %s OR email = %s",
            (username, email)
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
        
        cursor.execute("""
            INSERT INTO users (
                username, email, hashed_password, full_name, 
                role, is_active, is_expert, created_at, updated_at, cognitive_profile
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            RETURNING id, username, email, full_name, role, is_active, is_expert
        """, (
            username, email, hashed_pwd, full_name,
            'profesor', True, True, datetime.utcnow(), datetime.utcnow(),
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
    if len(sys.argv) != 5:
        print("""
╔════════════════════════════════════════╗
║  CREAR PROFESOR - MODO RÁPIDO         ║
║  NeuroLearn AI                         ║
╚════════════════════════════════════════╝

Uso: python create_teacher_quick.py <username> <email> <nombre_completo> <contraseña>

Ejemplo:
  python create_teacher_quick.py "juan" "juan@gmail.com" "Juan Pérez" "securepass123"
        """)
        sys.exit(1)
    
    username = sys.argv[1]
    email = sys.argv[2]
    full_name = sys.argv[3]
    password = sys.argv[4]
    
    # Validaciones básicas
    if not username or len(username) < 3:
        print("❌ El usuario debe tener al menos 3 caracteres")
        sys.exit(1)
    
    if not email or "@" not in email:
        print("❌ Email inválido")
        sys.exit(1)
    
    if not full_name:
        print("❌ El nombre no puede estar vacío")
        sys.exit(1)
    
    if not password or len(password) < 6:
        print("❌ La contraseña debe tener al menos 6 caracteres")
        sys.exit(1)
    
    # Crear profesor
    if create_teacher_sql(username, email, full_name, password):
        print("✨ ¡Profesor registrado correctamente!")
        sys.exit(0)
    else:
        print("🚫 No se pudo crear el profesor")
        sys.exit(1)

if __name__ == "__main__":
    main()
