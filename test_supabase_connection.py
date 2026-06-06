"""
NeuroLearn IA — Script de Verificación de Conexión Supabase
============================================================
Ejecutar desde la raíz del proyecto:
    python3 test_supabase_connection.py

Requiere: psycopg2-binary, sqlalchemy
    pip install psycopg2-binary sqlalchemy
"""
import os
import sys
import time
from urllib.parse import quote_plus

# ============================================================
# ⚙️  CONFIGURACIÓN 
# ============================================================
SUPABASE_PROJECT_ID = "sapozcwaspvibklyfldr"      # Tu Project ID (ya lo tenemos)
SUPABASE_PASSWORD   = "UntoD@wn2712"    
ENCODED_PASSWORD = quote_plus(SUPABASE_PASSWORD)     # Codifica caracteres especiales para URLs
SUPABASE_REGION     = "sa-east-1"                  # Ya confirmado en tus screenshots

# Construidas automáticamente:
DIRECT_URL = f"postgresql://postgres:{ENCODED_PASSWORD}@db.{SUPABASE_PROJECT_ID}.supabase.co:5432/postgres"
POOLER_URL = f"postgresql://postgres.{SUPABASE_PROJECT_ID}:{ENCODED_PASSWORD}@aws-1-{SUPABASE_REGION}.pooler.supabase.com:5432/postgres"
# ============================================================


def separador(titulo: str):
    print(f"\n{'='*55}")
    print(f"  {titulo}")
    print(f"{'='*55}")


def test_libreria():
    separador("PASO 1 — Verificando librerías")
    try:
        import sqlalchemy
        print(f"  ✅ SQLAlchemy  : {sqlalchemy.__version__}")
    except ImportError:
        print("  ❌ SQLAlchemy no instalada")
        print("     Ejecuta: pip install sqlalchemy")
        sys.exit(1)

    try:
        import psycopg2
        print(f"  ✅ psycopg2    : {psycopg2.__version__}")
    except ImportError:
        print("  ❌ psycopg2 no instalada")
        print("     Ejecuta: pip install psycopg2-binary")
        sys.exit(1)


def test_conexion(nombre: str, url: str) -> bool:
    from sqlalchemy import create_engine, text

    url_log = url.replace(SUPABASE_PASSWORD, "***")
    print(f"\n  🔗 Intentando: {url_log}")

    try:
        t0 = time.time()
        engine = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})

        with engine.connect() as conn:
            latencia = round((time.time() - t0) * 1000)
            print(f"  ✅ Conectado ({latencia}ms)")

            # Verificar versión de PostgreSQL
            version = conn.execute(text("SELECT version()")).scalar()
            pg_ver = version.split(",")[0].replace("PostgreSQL ", "PG ")
            print(f"  ✅ PostgreSQL  : {pg_ver}")

            # Verificar tablas creadas
            result = conn.execute(text("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                ORDER BY tablename
            """))
            tablas = [row[0] for row in result]

            tablas_esperadas = [
                "admin_audit_logs", "bot_training_data", "chat_messages",
                "classroom_bots", "classrooms", "cognitive_events",
                "enrollments", "expert_bots", "institutions",
                "learning_sessions", "permissions", "refresh_tokens", "users"
            ]

            print(f"\n  📋 Tablas encontradas ({len(tablas)}):")
            todas_ok = True
            for t in tablas_esperadas:
                if t in tablas:
                    print(f"     ✅ {t}")
                else:
                    print(f"     ❌ {t}  ← FALTA (ejecutar scripts SQL)")
                    todas_ok = False

            tablas_extra = [t for t in tablas if t not in tablas_esperadas]
            if tablas_extra:
                print(f"\n  ℹ️  Tablas adicionales: {tablas_extra}")

            # Verificar usuarios admin
            print(f"\n  👥 Usuarios del sistema:")
            users = conn.execute(text("""
                SELECT username, email, role, is_active
                FROM users
                ORDER BY id
            """))
            rows = users.fetchall()
            if rows:
                for row in rows:
                    estado = "activo" if row[3] else "inactivo"
                    print(f"     {'✅' if row[3] else '⚠️'} {row[0]:15} | {row[2]:15} | {row[1]}")
            else:
                print("     ⚠️  No hay usuarios — ejecutar Script 9 (datos iniciales)")

            # Verificar bots pre-entrenados
            bots = conn.execute(text("SELECT COUNT(*) FROM expert_bots WHERE is_prebuilt = TRUE")).scalar()
            print(f"\n  🤖 Bots pre-entrenados: {'✅ ' + str(bots) + ' cargados' if bots > 0 else '⚠️  0 — ejecutar Script 9'}")

            engine.dispose()
            return todas_ok

    except Exception as e:
        error = str(e)
        print(f"  ❌ Error: {error[:120]}")

        # Diagnóstico de errores comunes
        if "password authentication failed" in error:
            print("\n  🔍 DIAGNÓSTICO: Contraseña incorrecta")
            print("     → Verifica SUPABASE_PASSWORD en este script")
        elif "could not connect to server" in error or "Connection refused" in error:
            print("\n  🔍 DIAGNÓSTICO: No se puede alcanzar el servidor")
            print("     → Verifica que el proyecto Supabase esté activo")
            print("     → Revisa el Project ID y la región")
        elif "SSL" in error:
            print("\n  🔍 DIAGNÓSTICO: Error SSL")
            print("     → Agrega ?sslmode=require al final de la URL")
        elif "timeout" in error.lower():
            print("\n  🔍 DIAGNÓSTICO: Timeout de conexión")
            print("     → El proyecto puede estar pausado (Free tier se pausa)")
            print("     → Entra a Supabase y actívalo manualmente")

        return False


def test_insertar_y_leer():
    """Prueba básica de lectura/escritura"""
    from sqlalchemy import create_engine, text

    separador("PASO 3 — Prueba de lectura de datos")
    try:
        engine = create_engine(POOLER_URL, pool_pre_ping=True)
        with engine.connect() as conn:
            # Contar registros por tabla
            tablas_test = ["users", "institutions", "expert_bots", "permissions"]
            for tabla in tablas_test:
                try:
                    count = conn.execute(text(f"SELECT COUNT(*) FROM {tabla}")).scalar()
                    print(f"  ✅ {tabla:20} → {count} registros")
                except Exception as e:
                    print(f"  ❌ {tabla:20} → Error: {str(e)[:50]}")
        engine.dispose()
    except Exception as e:
        print(f"  ❌ No se pudo conectar: {e}")


def mostrar_env():
    """Muestra las variables de entorno a configurar"""
    separador("PASO 4 — Variables de entorno listas para copiar")
    print("\n  📄 Copia esto en tu archivo .env y en los config.py:\n")
    print(f"  # Desarrollo local (conexión directa):")
    print(f"  DATABASE_URL={DIRECT_URL.replace(SUPABASE_PASSWORD, 'TU_PASSWORD')}\n")
    print(f"  # Producción / Vercel (transaction pooler):")
    print(f"  DATABASE_URL={POOLER_URL.replace(SUPABASE_PASSWORD, 'TU_PASSWORD')}")
    print(f"\n  Project ID  : {SUPABASE_PROJECT_ID}")
    print(f"  Región      : {SUPABASE_REGION}")
    print(f"  Host directo: db.{SUPABASE_PROJECT_ID}.supabase.co")
    print(f"  Host pooler : aws-0-{SUPABASE_REGION}.pooler.supabase.com")


def main():
    print("\n" + "🧠 "*10)
    print("  NeuroLearn IA — Test de Conexión Supabase")
    print("🧠 "*10)

    # Validar que se editó la contraseña
    if SUPABASE_PASSWORD == "AQUI_TU_PASSWORD":
        print("\n  ⛔  ERROR: No has configurado tu contraseña.")
        print("  Abre este archivo y cambia la línea:")
        print('  SUPABASE_PASSWORD = "AQUI_TU_PASSWORD"')
        print('  Por tu contraseña real de Supabase.')
        sys.exit(1)

    # Test 1: Librerías
    test_libreria()

    # Test 2: Conexión directa
    separador("PASO 2A — Conexión Directa (desarrollo local)")
    ok_direct = test_conexion("Directa", DIRECT_URL)

    # Test 2b: Pooler
    separador("PASO 2B — Transaction Pooler (producción/Vercel)")
    ok_pooler = test_conexion("Pooler", POOLER_URL)

    # Test 3: Datos
    if ok_direct or ok_pooler:
        test_insertar_y_leer()

    # Resumen
    separador("RESUMEN FINAL")
    print(f"  Conexión directa  : {'✅ OK' if ok_direct else '❌ FALLO'}")
    print(f"  Conexión pooler   : {'✅ OK' if ok_pooler else '❌ FALLO'}")

    if ok_direct or ok_pooler:
        print("\n  ✅ ¡Supabase conectado correctamente!")
        print("  📌 Usa el Pooler URL en producción (Vercel)")
        print("  📌 Usa el Direct URL en desarrollo local")
        mostrar_env()
    else:
        print("\n  ❌ No se pudo conectar. Revisa los diagnósticos arriba.")
        print("  💡 También puedes probar desde Supabase:")
        print("     Database → SQL Editor → ejecuta: SELECT NOW();")

    print("\n" + "="*55 + "\n")


if __name__ == "__main__":
    main()