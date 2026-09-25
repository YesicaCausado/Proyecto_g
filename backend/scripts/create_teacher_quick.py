"""
Script para crear un usuario profesor de forma rápida (no-interactivo)
Uso: python create_teacher_quick.py <username> <email> <full_name> <password>

FIX de seguridad: las credenciales Supabase (host/usuario/contraseña) estaban
hardcodeadas en el código fuente. Ahora la conexión se toma de DATABASE_URL
(backend/.env o variable de entorno), igual que el resto de la aplicación.
"""
import sys
from pathlib import Path

_SCRIPTS_DIR = Path(__file__).parent
_BACKEND_DIR = _SCRIPTS_DIR.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
if str(_SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRIPTS_DIR))

from passlib.context import CryptContext

from create_teacher import create_teacher_sql, hash_password  # helper compartido

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


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
