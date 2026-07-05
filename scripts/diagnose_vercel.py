#!/usr/bin/env python3
"""
🔧 Script para diagnosticar problemas en Vercel
Verifica que todas las variables de entorno necesarias estén configuradas
"""

import subprocess
import sys
from typing import Dict, Tuple

def run_command(cmd: str) -> Tuple[int, str, str]:
    """Ejecuta comando y retorna (exit_code, stdout, stderr)"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


def check_vercel_env() -> Dict[str, bool]:
    """Verifica qué variables están en Vercel"""
    print("🔍 Verificando variables de entorno en Vercel...")
    print("-" * 60)
    
    # Ejecutar `vercel env list`
    _, stdout, stderr = run_command("vercel env list")
    
    if "Error" in stderr or not stdout:
        print("❌ No se pudo conectar a Vercel")
        print("   Asegúrate de estar autenticado: vercel login")
        return {}
    
    # Parse output
    required_vars = [
        "DATABASE_URL",
        "SECRET_KEY",
        "GROQ_API_KEY",
        "GROQ_MODEL",
    ]
    
    env_status = {}
    for var in required_vars:
        is_present = var in stdout
        status = "✅" if is_present else "❌"
        env_status[var] = is_present
        print(f"{status} {var:<25} {'CONFIGURADA' if is_present else 'FALTA'}")
    
    print("-" * 60)
    return env_status


def main():
    print("=" * 60)
    print("🚀 DIAGNOSTICADOR DE VERCEL - NeuroLearn AI")
    print("=" * 60)
    print()
    
    # Verificar Vercel CLI
    _, stdout, _ = run_command("vercel --version")
    if not stdout:
        print("❌ Vercel CLI no está instalada")
        print("\n   Instálala con: npm install -g vercel")
        sys.exit(1)
    
    print(f"✅ Vercel CLI: {stdout.strip()}")
    print()
    
    # Verificar ambiente
    env_status = check_vercel_env()
    
    print()
    missing = [v for v, present in env_status.items() if not present]
    
    if missing:
        print("⚠️  FALTA CONFIGURAR:")
        for var in missing:
            print(f"   • {var}")
        
        print()
        print("📋 SOLUCIONES:")
        print()
        print("Opción A: Dashboard (UI)")
        print("  1. Ve a: https://vercel.com/dashboard")
        print("  2. Settings → Environment Variables")
        print("  3. Añade cada variable faltante")
        print("  4. Redeploy")
        print()
        print("Opción B: CLI (Comando)")
        for var in missing:
            print(f"  vercel env add {var} production")
            print(f"  # Pega el valor y presiona Enter")
        print()
        print("Opción C: Script automático")
        print("  python scripts/setup_vercel.py")
        
        sys.exit(1)
    
    else:
        print("✅ Todas las variables requeridas están configuradas!")
        print()
        print("📝 Próximos pasos:")
        print("  1. Redeploy la aplicación")
        print("     vercel --prod")
        print()
        print("  2. Ver logs en tiempo real")
        print("     vercel logs --follow")
        print()
        print("  3. Probar endpoint de auth")
        print("     curl -X POST https://tu-proyecto.vercel.app/api/v1/auth/register \\")
        print("       -H 'Content-Type: application/json' \\")
        print("       -d '{\"username\":\"test\",\"email\":\"test@test.com\",\"password\":\"Test123!\"}'")
        
        sys.exit(0)


if __name__ == "__main__":
    main()
