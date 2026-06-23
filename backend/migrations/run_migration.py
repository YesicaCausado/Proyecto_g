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
    """Ejecuta la migración para agregar columnas adaptativas"""
    
    migration_file = Path(__file__).parent / "add_adaptive_quiz_columns.sql"
    
    if not migration_file.exists():
        print(f"❌ Archivo de migración no encontrado: {migration_file}")
        return False
    
    print("📋 Leyendo archivo de migración...")
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("🔄 Ejecutando migración en la base de datos...")
    
    try:
        with engine.connect() as conn:
            # Ejecutar cada statement SQL
            for statement in sql_content.split(';'):
                statement = statement.strip()
                if statement and not statement.startswith('--'):
                    print(f"   Ejecutando: {statement[:60]}...")
                    conn.execute(text(statement))
            
            conn.commit()
        
        print("✅ Migración completada exitosamente!")
        print("\nColumnas agregadas:")
        print("  - mistakes (JSONB)")
        print("  - weak_concepts (JSONB)")
        print("  - adaptation_applied (VARCHAR(500))")
        print("  - performance_score (FLOAT)")
        print("  - recommended_difficulty (VARCHAR(20))")
        return True
        
    except Exception as e:
        print(f"❌ Error ejecutando migración: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("MIGRACIÓN: Sistema de Quizzes Adaptativos")
    print("=" * 60)
    
    if not engine:
        print("❌ No se pudo conectar a la base de datos")
        print("   Verifica tu DATABASE_URL en .env")
        sys.exit(1)
    
    success = run_migration()
    sys.exit(0 if success else 1)
