"""
NeuroLearn AI - Proveedores de IA
Cadena de fallback: Groq → Gemini → Local
"""
from app.ai.providers.ai_manager import AIManager

__all__ = ["AIManager"]
