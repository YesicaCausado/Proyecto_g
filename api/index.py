"""
Vercel Serverless Entry Point — NeuroLearn AI Backend
Adapta la app FastAPI para correr como función serverless en Vercel.

Vercel busca el objeto `app` en este archivo.
"""
import sys
import os

# Añadir el directorio backend al path para que los imports funcionen
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from app.main import app  # noqa: F401 — Vercel usa este objeto ASGI
