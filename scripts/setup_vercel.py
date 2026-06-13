#!/usr/bin/env python3
"""
🚀 Script para configurar variables de entorno en Vercel
Requiere: vercel CLI instalada (npm install -g vercel)
"""

import subprocess
import sys
from typing import Dict, Tuple

# Variables requeridas: (nombre, valor, descripción)
REQUIRED_VARS: Dict[str, Tuple[str, str]] = {
    "DATABASE_URL": (
        "postgresql://postgres.sapozcwaspvibklyfldr:UntoD%40wn2712@aws-1-sa-east-1.pooler.supabase.com:5432/postgres",
        "URL de conexión a Supabase (usar pooler)"
    ),
    "SECRET_KEY": (
        "sb_secret_baKWiCpN8miI3ruhEzQ85g_-m2w13nd",
        "Clave secreta para JWT"
    ),
    "GROQ_API_KEY": (
        "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",
        "API key de Groq (LLM principal)"
    ),
    "GROQ_MODEL": (
        "qwen/qwen3-32b",
        "Modelo de Groq a usar"
    ),
    "GEMINI_API_KEY": (
        "",  # Dejar vacío si no tienes
        "API key de Gemini (fallback)"
    ),
    "GEMINI_MODEL": (
        "gemini-2.0-flash",
        "Modelo de Gemini"
    ),
    "VITE_AZURE_SPEECH_KEY": (
        "",  # Dejar vacío si no tienes
        "API key de Azure Cognitive Services (TTS)"
    ),
    "VITE_AZURE_SPEECH_REGION": (
        "eastus",
        "Región de Azure"
    ),
    "FATIGUE_THRESHOLD": (
        "0.7",
        "Umbral de fatiga cognitiva"
    ),
    "OVERLOAD_THRESHOLD": (
        "0.8",
        "Umbral de sobrecarga"
    ),
    "DOUBT_THRESHOLD": (
        "0.6",
        "Umbral de duda"
    ),
    "MASTERY_THRESHOLD": (
        "0.85",
        "Umbral de dominio"
    ),
    "APP_NAME": (
        "NeuroLearn AI",
        "Nombre de la aplicación"
    ),
    "APP_VERSION": (
        "1.0.0",
        "Versión de la aplicación"
    ),
    "DEBUG": (
        "false",
        "Modo debug (false en producción)"
    ),
}

def check_vercel_installed() -> bool:
    """Verifica que vercel CLI esté instalada"""
    try:
        subprocess.run(["vercel", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def run_command(cmd: list) -> Tuple[int, str, str]:
    """Ejecuta un comando y retorna (exit_code, stdout, stderr)"""
    result = subprocess.run(cmd, capture_output=True, text=True)
    return result.returncode, result.stdout, result.stderr


def set_env_var(name: str, value: str, environments: list = None) -> bool:
    """
    Configura una variable de entorno en Vercel
    
    Args:
        name: Nombre de la variable
        value: Valor de la variable
        environments: Lista de ambientes ['production', 'preview', 'development']
    """
    if not value:
        print(f"⏭️  Saltando {name} (valor vacío)")
        return True
    
    if environments is None:
        environments = ["production", "preview", "development"]
    
    print(f"🔧 Configurando {name}...", end=" ", flush=True)
    
    for env in environments:
        cmd = ["vercel", "env", "add", name, env]
        # Pasar el valor por stdin
        result = subprocess.run(
            cmd,
            input=f"{value}\n",
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"❌\n   Error en {env}: {result.stderr}")
            return False
    
    print("✅")
    return True


def main():
    """Función principal"""
    print("=" * 60)
    print("🚀 CONFIGURADOR DE VERCEL PARA NEUROLEARN AI")
    print("=" * 60)
    print()
    
    # Verificar vercel CLI
    if not check_vercel_installed():
        print("❌ Error: Vercel CLI no está instalada")
        print("\n📦 Instálala con:")
        print("   npm install -g vercel")
        print("\nO en Windows:")
        print("   npm install -g vercel")
        sys.exit(1)
    
    print("✅ Vercel CLI detectada")
    print()
    
    # Solicitar confirmación
    print("Este script configurará las siguientes variables en Vercel:")
    print()
    for name, (value, desc) in REQUIRED_VARS.items():
        status = "✓" if value else "⚠ (vacía)"
        print(f"  {status} {name:<30} → {desc}")
    print()
    
    confirm = input("¿Continuar? (s/n): ").strip().lower()
    if confirm != "s":
        print("❌ Cancelado")
        sys.exit(0)
    
    print()
    print("Configurando variables...")
    print("-" * 60)
    
    # Configurar cada variable
    failed = []
    for name, (value, _) in REQUIRED_VARS.items():
        if not set_env_var(name, value):
            failed.append(name)
    
    print("-" * 60)
    print()
    
    if failed:
        print(f"❌ {len(failed)} variable(s) fallaron:")
        for name in failed:
            print(f"   - {name}")
        sys.exit(1)
    else:
        print("✅ Todas las variables configuradas exitosamente!")
        print()
        print("📝 Próximos pasos:")
        print("   1. Espera 30 segundos para que Vercel procese los cambios")
        print("   2. Redeploy: git push origin feat-neuroconductual-patterns")
        print("   3. O manualmente: vercel --prod")
        print()
        print("🎉 ¡Listo para desplegar!")
        sys.exit(0)


if __name__ == "__main__":
    main()
