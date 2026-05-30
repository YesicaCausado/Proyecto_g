"""
Script para probar conexión a Neon PostgreSQL
"""
import sys
from sqlalchemy import create_engine, text, inspect

DATABASE_URL = "postgresql://neondb_owner:npg_MAed8LuD7yOz@ep-restless-river-am0m57yj-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

print("🔗 Probando conexión a Neon PostgreSQL...")
print(f"Host: ep-restless-river-am0m57yj-pooler.c-5.us-east-1.aws.neon.tech")
print(f"Database: neondb")
print()

try:
    # Crear motor
    print("📊 Creando engine...")
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        echo=False
    )
    
    # Probar conexión
    print("🔌 Conectando...")
    with engine.connect() as conn:
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        print(f"✅ Conexión exitosa!")
        print(f"PostgreSQL: {version[:50]}...")
    
    print()
    print("📋 Tablas existentes:")
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if not tables:
        print("  (Sin tablas aún)")
    else:
        for table in tables:
            columns = inspector.get_columns(table)
            print(f"  • {table}")
            for col in columns:
                print(f"    - {col['name']} ({col['type']})")
    
    print()
    print("✅ Prueba completada exitosamente!")
    
except Exception as e:
    print(f"❌ Error: {type(e).__name__}")
    print(f"   {str(e)}")
    sys.exit(1)
