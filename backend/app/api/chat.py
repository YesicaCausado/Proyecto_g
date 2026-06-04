"""
NeuroLearn AI - API de Chat
Stateless para Vercel. Siempre usa IA real (Groq → Gemini). Sin fallback local.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List, Optional

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.schemas.schemas import (
    StartSessionRequest,
    ChatMessageRequest,
    ChatMessageResponse,
    SessionStatsResponse,
)
from app.ai.providers.ai_manager import AIManager
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat Adaptativo"])

# AIManager global: Groq (principal) → Gemini (fallback). Sin modo local.
ai_manager = AIManager(
    groq_api_key=settings.GROQ_API_KEY,
    groq_model=settings.GROQ_MODEL,
    gemini_api_key=settings.GEMINI_API_KEY,
    gemini_model=settings.GEMINI_MODEL,
)

_SYSTEM_PROMPT = """Eres NeuroLearn, un tutor educativo de IA para estudiantes de bachillerato en Colombia.
Tu objetivo es preparar al estudiante para las pruebas Saber 11.

━━━ FORMATO VISUAL OBLIGATORIO ━━━
Estructura TODAS tus respuestas así:
• Usa **negritas** para los conceptos clave
• Usa emojis al inicio de cada bloque: 📚 explicación, 💡 tip, ⚠️ cuidado, 🔑 concepto clave, ✅ correcto
• Párrafos cortos (máx 2-3 líneas). Separa con línea en blanco.
• Listas con "•" para enumerar; pasos con "1. 2. 3."
• Termina SIEMPRE con una sección "❓ **Comprueba tu comprensión**" o un quiz.

━━━ QUIZZES (formato EXACTO y OBLIGATORIO) ━━━
Cuando hagas un quiz usa EXACTAMENTE este formato — ni más ni menos de 4 opciones:

❓ **[Escribe aquí la pregunta]**

A. [Opción A]
B. [Opción B]
C. [Opción C]
D. [Opción D]

Nunca pongas 2 ni 3 ni 5 opciones. Siempre exactamente A, B, C, D.

━━━ RECOMENDACIONES CONTEXTUALES ━━━
• Adapta ejemplos al TEMA ACTUAL (nunca uses ejemplos genéricos)
• Menciona conceptos reales del tema en tus recomendaciones
• Si el estudiante falla, indica exactamente QUÉ concepto repasar del tema

━━━ REGLAS PEDAGÓGICAS ━━━
• Responde SIEMPRE en español (salvo si el tema es Inglés)
• Si el tema es inglés, responde EN INGLÉS con traducciones entre paréntesis
• Sé cercano, motivador y positivo
• Máximo 4 bloques por respuesta"""


def _build_system_prompt(topic: str, cognitive_state: str = "normal") -> str:
    state_instructions = {
        "fatigue":     "⚠️ ESTADO: Estudiante cansado → respuesta MUY corta, un solo concepto, sugiere pausa.",
        "overload":    "⚠️ ESTADO: Sobrecarga cognitiva → UNA sola idea, sin listas largas, muy simple.",
        "doubt":       "⚠️ ESTADO: Tiene dudas sobre el tema → más ejemplos concretos del tema, analogías simples.",
        "mastery":     "⚠️ ESTADO: Domina el tema → desafíos avanzados, preguntas de pensamiento crítico del tema.",
        "flow":        "⚠️ ESTADO: En flujo → mantén ritmo, profundiza en conceptos avanzados del tema.",
        "frustration": "⚠️ ESTADO: Frustrado → mucha empatía, simplifica al máximo, refuerza lo que ya sabe del tema.",
        "normal":      "Estado normal → enseñanza estándar del tema, ritmo claro y motivador.",
    }
    instruction = state_instructions.get(cognitive_state, state_instructions["normal"])
    return (
        f"{_SYSTEM_PROMPT}\n\n"
        f"📌 TEMA ACTUAL (usa ejemplos ESPECÍFICOS de este tema): **{topic}**\n"
        f"{instruction}"
    )


@router.post("/start", response_model=ChatMessageResponse)
async def start_session(
    request: StartSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Inicia sesión: la IA genera un mensaje de bienvenida al tema."""
    if not ai_manager.providers:
        raise HTTPException(
            status_code=503,
            detail="No hay proveedores de IA configurados. Añade GROQ_API_KEY en Vercel."
        )

    system_prompt = _build_system_prompt(request.topic)
    result = await ai_manager.generate(
        prompt=f"El estudiante empieza a estudiar: {request.topic}. Preséntate brevemente y comienza con una introducción motivadora al tema. Luego haz la primera pregunta de diagnóstico.",
        system_prompt=system_prompt,
        temperature=0.7,
        max_tokens=512,
    )

    if not result["response"]:
        raise HTTPException(status_code=503, detail="La IA no respondió. Verifica GROQ_API_KEY.")

    return ChatMessageResponse(
        message=result["response"],
        action="teach",
        difficulty=request.difficulty,
        cognitive_state="normal",
        suggestions=[],
        should_pause=False,
        metadata={"provider": result["provider"]},
    )


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Envía mensaje al tutor IA.
    Stateless: recibe topic + history en cada request (compatible con Vercel).
    Siempre usa Groq o Gemini, nunca modo local.
    """
    if not ai_manager.providers:
        raise HTTPException(
            status_code=503,
            detail="No hay proveedores de IA configurados. Añade GROQ_API_KEY en Vercel."
        )

    topic = request.topic or "Preparación Saber 11"
    system_prompt = _build_system_prompt(topic)

    # Reconstruir historial de conversación
    context_messages: List[Dict] = []
    if request.history:
        for msg in request.history[-12:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if content and role in ("user", "assistant"):
                context_messages.append({"role": role, "content": content})

    result = await ai_manager.generate(
        prompt=request.message,
        system_prompt=system_prompt,
        context_messages=context_messages,
        temperature=0.7,
        max_tokens=1024,
    )

    if not result["response"]:
        raise HTTPException(
            status_code=503,
            detail="La IA no respondió. Puede que se hayan agotado los tokens de Groq. Verifica en console.groq.com"
        )

    logger.info(f"✅ Respuesta IA de: {result['provider']}")

    return ChatMessageResponse(
        message=result["response"],
        action="teach",
        difficulty="medium",
        cognitive_state="normal",
        confidence=0.8,
        suggestions=[],
        should_pause=False,
        metadata={"provider": result["provider"], "fallback_used": result.get("fallback_used", False)},
    )


@router.get("/stats", response_model=SessionStatsResponse)
async def get_session_stats(current_user: User = Depends(get_current_user)):
    return SessionStatsResponse(
        total_messages=0, correct_answers=0, wrong_answers=0,
        average_response_time=0, topics_covered=[], session_duration=0,
    )


@router.post("/end")
async def end_session(current_user: User = Depends(get_current_user)):
    return {"message": "Sesión finalizada", "stats": {}}
