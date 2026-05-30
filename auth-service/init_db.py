"""
Script para crear tablas en Neon PostgreSQL
"""
import sys
from sqlalchemy import create_engine, text
from app.db.database import Base, engine
import app.models.user  # noqa: F401

print("🔗 Conectando a Neon PostgreSQL...")

try:
    print("📋 Creando tablas...")
    
    # Crear tablas
    Base.metadata.create_all(bind=engine)
    
    print("✅ Tablas creadas exitosamente!")
    print()
    
    # Verificar tablas creadas
    from sqlalchemy import inspect
    inspector = inspect(engine)
    
    print("📊 Tablas en Neon:")
    tables = inspector.get_table_names()
    
    for table in sorted(tables):
        if table in ['users', 'permissions', 'refresh_tokens']:
            columns = inspector.get_columns(table)
            print(f"  ✓ {table}")
            for col in columns:
                nullable = "NULL" if col['nullable'] else "NOT NULL"
                print(f"    • {col['name']:<30} {str(col['type']):<20} {nullable}")
    
    print()
    print("✅ Inicialización de base de datos completada!")
    
except Exception as e:
    print(f"❌ Error: {type(e).__name__}")
    print(f"   {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
