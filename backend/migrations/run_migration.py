"""
Script de migración: Agregar columnas adaptativas a quiz_history
Ejecutar: python backend/migrations/run_migration.py
"""
import os
import sys
from pathlib import Path

# Agregar el directorio backend al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.db.database import engine

def run_migration():
    """Ejecuta todas las migraciones requeridas del sistema: quizzes adaptativos + patrones neuroconductuales."""
    migration_files = [
        Path(__file__).parent / "applied" / "002_add_adaptive_quiz_columns.sql",
        Path(__file__).parent / "applied" / "003_add_chat_patterns_tables.sql",
    ]

    for migration_file in migration_files:
        if not migration_file.exists():
            print(f"❌ Archivo de migración no encontrado: {migration_file}")
            return False

        print(f"📋 Leyendo migración: {migration_file.name}")
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql_content = f.read()

        print(f"🔄 Ejecutando migración en la base de datos: {migration_file.name}")
        try:
            with engine.connect() as conn:
                for statement in sql_content.split(';'):
                    statement = statement.strip()
                    if statement and not statement.startswith('--'):
                        print(f"   Ejecutando: {statement[:60]}...")
                        conn.execute(text(statement))
                conn.commit()
        except Exception as e:
            print(f"❌ Error ejecutando migración {migration_file.name}: {e}")
            return False

    print("✅ Migraciones completadas exitosamente!")
    print("\nTablas/columnas garantizadas:")
    print("  - quiz_history adaptativo")
    print("  - cognitive_session_state")
    print("  - learning_sessions")
    print("  - cognitive_events")
    print("  - chat_messages")
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("MIGRACIÓN: Quizzes adaptativos + patrones neuroconductuales")
    print("=" * 60)
    
    if not engine:
        print("❌ No se pudo conectar a la base de datos")
        print("   Verifica tu DATABASE_URL en .env")
        sys.exit(1)
    
    success = run_migration()
    sys.exit(0 if success else 1)
