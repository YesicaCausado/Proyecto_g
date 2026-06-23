"""
Script de migración automática para Supabase
Agrega columnas adaptativas a quiz_history
"""
import sys
import os
from pathlib import Path

# Agregar backend al path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

def run_migration():
    try:
        from app.db.database import engine
        from sqlalchemy import text
        
        if not engine:
            print("❌ No se pudo conectar a la base de datos")
            print("   Verifica DATABASE_URL en .env")
            return False
        
        print("🔄 Conectando a Supabase PostgreSQL...")
        
        with engine.connect() as conn:
            print("✅ Conexión establecida")
            print("\n📝 Ejecutando migración...")
            
            # Paso 1: Agregar columnas
            print("\n1️⃣ Agregando columnas...")
            alter_table_sql = """
            ALTER TABLE quiz_history 
            ADD COLUMN IF NOT EXISTS mistakes JSONB,
            ADD COLUMN IF NOT EXISTS weak_concepts JSONB,
            ADD COLUMN IF NOT EXISTS adaptation_applied VARCHAR(500),
            ADD COLUMN IF NOT EXISTS performance_score FLOAT,
            ADD COLUMN IF NOT EXISTS recommended_difficulty VARCHAR(20);
            """
            conn.execute(text(alter_table_sql))
            conn.commit()
            print("   ✓ Columnas agregadas")
            
            # Paso 2: Crear índices
            print("\n2️⃣ Creando índices...")
            index_sql = """
            CREATE INDEX IF NOT EXISTS idx_quiz_history_performance ON quiz_history(performance_score);
            CREATE INDEX IF NOT EXISTS idx_quiz_history_recommended_difficulty ON quiz_history(recommended_difficulty);
            CREATE INDEX IF NOT EXISTS idx_quiz_history_completed_at ON quiz_history(completed_at);
            """
            for statement in index_sql.split(';'):
                statement = statement.strip()
                if statement:
                    conn.execute(text(statement))
            conn.commit()
            print("   ✓ Índices creados")
            
            print("✅ Migración completada exitosamente!")
            print("\n📋 Columnas agregadas:")
            print("   ✓ mistakes (JSONB)")
            print("   ✓ weak_concepts (JSONB)")
            print("   ✓ adaptation_applied (VARCHAR)")
            print("   ✓ performance_score (FLOAT)")
            print("   ✓ recommended_difficulty (VARCHAR)")
            print("\n🎯 Sistema de quizzes adaptativos listo!")
            
            return True
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("MIGRACIÓN: Sistema de Quizzes Adaptativos")
    print("=" * 60)
    success = run_migration()
    sys.exit(0 if success else 1)
