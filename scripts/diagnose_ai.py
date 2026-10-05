"""
🩺 Diagnóstico rápido de IA — NeuroLearn AI
Prueba la conectividad real con Groq y Gemini usando las claves de backend/.env.
NO imprime claves: solo códigos de estado y modelos disponibles.

Uso:
    backend\\.venv\\Scripts\\python.exe scripts\\diagnose_ai.py
"""
import json
import os
import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Consola Windows (cp1252) no puede imprimir emojis → forzar UTF-8.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / "backend" / ".env")

GROQ_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
TIMEOUT = 15.0

results = []


def add(name, ok, detail):
    mark = "✅" if ok else "❌"
    results.append((name, ok, detail))
    print(f"{mark} {name}: {detail}")


print("=" * 62)
print("DIAGNÓSTICO DE PROVEEDORES DE IA")
print("=" * 62)

# ── 1. Groq: listar modelos disponibles con esta clave ──────────────
if not GROQ_KEY:
    add("Groq clave", False, "GROQ_API_KEY no configurada")
else:
    add("Groq clave", True, f"configurada ({GROQ_KEY[:6]}...)")
    try:
        r = httpx.get(
            "https://api.groq.com/openai/v1/models",
            headers={"Authorization": f"Bearer {GROQ_KEY}"},
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            ids = sorted(m["id"] for m in r.json().get("data", []))
            add("Groq autenticación", True, f"{len(ids)} modelos disponibles")
            chat_models = [m for m in ids if any(k in m for k in ("gpt-oss", "llama", "qwen", "deepseek", "moonshot"))]
            print("   Modelos de chat principales:")
            for m in chat_models:
                mark = "  →" if m == GROQ_MODEL else "    "
                print(f"   {mark} {m}")
            if GROQ_MODEL in ids:
                add("Groq modelo", True, GROQ_MODEL)
            else:
                add("Groq modelo", False, f"'{GROQ_MODEL}' NO existe para esta clave (404 en cada llamada → fallback)")
        else:
            add("Groq autenticación", False, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        add("Groq autenticación", False, f"Error de red: {type(e).__name__}: {e}")

    # ── 2. Groq: llamada mínima de chat con el modelo configurado ────
    if GROQ_MODEL:
        try:
            r = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
                json={
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": "Responde solo: OK"}],
                    "max_tokens": 5,
                },
                timeout=TIMEOUT,
            )
            if r.status_code == 200:
                content = r.json()["choices"][0]["message"]["content"]
                add("Groq generación", True, f"modelo {GROQ_MODEL} respondió: {content.strip()[:40]!r}")
            elif r.status_code == 429:
                add("Groq generación", False, "HTTP 429 rate-limit (cuota diaria o por minuto agotada)")
            else:
                add("Groq generación", False, f"HTTP {r.status_code}: {r.text[:200]}")
        except Exception as e:
            add("Groq generación", False, f"Error de red: {type(e).__name__}: {e}")

# ── 3. Gemini: llamada mínima con el modelo configurado ─────────────
if not GEMINI_KEY:
    add("Gemini clave", False, "GEMINI_API_KEY no configurada (fallback secundario INACTIVO)")
else:
    add("Gemini clave", True, "configurada")
    try:
        r = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
            params={"key": GEMINI_KEY},
            json={
                "contents": [{"role": "user", "parts": [{"text": "Responde solo: OK"}]}],
                "generationConfig": {"maxOutputTokens": 5},
            },
            timeout=TIMEOUT,
        )
        if r.status_code == 200:
            cands = r.json().get("candidates", [])
            text = ""
            if cands:
                parts = cands[0].get("content", {}).get("parts", [])
                text = parts[0].get("text", "") if parts else ""
            add("Gemini generación", True, f"modelo {GEMINI_MODEL} respondió: {text.strip()[:40]!r}")
        elif r.status_code == 404:
            add("Gemini generación", False, f"HTTP 404: el modelo '{GEMINI_MODEL}' NO existe → fallback roto")
        elif r.status_code == 429:
            add("Gemini generación", False, "HTTP 429 rate-limit (cuota gratuita agotada)")
        else:
            add("Gemini generación", False, f"HTTP {r.status_code}: {r.text[:200]}")
    except Exception as e:
        add("Gemini generación", False, f"Error de red: {type(e).__name__}: {e}")

# ── Resumen ──────────────────────────────────────────────────────────
print("=" * 62)
failures = [r for r in results if not r[1]]
if not failures:
    print("RESULTADO: Todos los proveedores funcionan. La IA no debería fallar.")
else:
    print(f"RESULTADO: {len(failures)} problema(s) detectado(s):")
    for name, _, detail in failures:
        print(f"  • {name}: {detail}")
    print("\nSoluciones rápidas:")
    print("  1. Si el modelo de Groq no existe → cambia GROQ_MODEL en backend/.env")
    print("     y en Vercel por uno de la lista de arriba (p.ej. openai/gpt-oss-120b).")
    print("  2. Si Gemini 404 → cambia GEMINI_MODEL por un modelo vigente")
    print("     (p.ej. gemini-2.0-flash) o agrega GEMINI_API_KEY en Vercel.")
    print("  3. Si 429 → cuota gratuita agotada: espera el reset diario o sube de plan.")
    print("  4. Tras cambiar variables en Vercel → REDEPLOY para que apliquen.")
