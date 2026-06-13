"""
Script para verificar que las variables de entorno estén configuradas
"""
import os
from dotenv import load_dotenv

load_dotenv()

print("=" * 60)
print("VERIFICACIÓN DE VARIABLES DE ENTORNO")
print("=" * 60)

required_vars = {
    "GROQ_API_KEY": os.getenv("GROQ_API_KEY"),
    "GROQ_MODEL": os.getenv("GROQ_MODEL"),
    "DATABASE_URL": os.getenv("DATABASE_URL"),
    "SECRET_KEY": os.getenv("SECRET_KEY"),
}

optional_vars = {
    "GEMINI_API_KEY": os.getenv("GEMINI_API_KEY"),
    "GEMINI_MODEL": os.getenv("GEMINI_MODEL"),
}

print("\n✅ VARIABLES REQUERIDAS:")
for var, value in required_vars.items():
    if value:
        masked = value[:10] + "..." if len(value) > 10 else value
        print(f"  {var}: {masked} ✓")
    else:
        print(f"  {var}: ❌ NO CONFIGURADA")

print("\n⚙️ VARIABLES OPCIONALES:")
for var, value in optional_vars.items():
    if value:
        masked = value[:10] + "..." if len(value) > 10 else value
        print(f"  {var}: {masked} ✓")
    else:
        print(f"  {var}: (vacía)")

print("\n" + "=" * 60)

# Verificar si hay problemas
missing = [var for var, value in required_vars.items() if not value]
if missing:
    print(f"\n⚠️ FALTAN VARIABLES REQUERIDAS: {', '.join(missing)}")
    print("\nPara Vercel:")
    print("1. Ve a Settings → Environment Variables")
    print("2. Agrega las variables faltantes")
    print("3. Redeploy el proyecto")
else:
    print("\n✅ Todas las variables requeridas están configuradas")
