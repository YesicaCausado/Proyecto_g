"""
NeuroLearn AI - API de Chat
Stateless para Vercel. Siempre usa IA real (Groq → Gemini). Sin fallback local.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime

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
from app.ai.cognitive.neuroconductual_engine import (
    MultimodalCognitiveEngine,
    BehavioralEvent,
    FacialData,
    VoiceProsodyData,
)
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

# Motor Neuroconductual: análisis de patrones digitales
neuro_engine = MultimodalCognitiveEngine()

_SYSTEM_PROMPT = """Eres NeuroLearn, un tutor educativo de IA para estudiantes de bachillerato en Colombia.
Tu objetivo es preparar al estudiante para las pruebas Saber 11.

━━━ ANÁLISIS NEUROCONDUCTUAL PARA QUIZZES ━━━
NO incluyas quizzes directamente en tus respuestas.
En su lugar, ANALIZA cuándo el estudiante necesita verificación:

SUGIERE QUIZ (menciona "QUIZ_SUGERIDO" al inicio) SOLO SI:
✓ Acaba de aprender un concepto importante completo
✓ Respondió correctamente varias preguntas sobre el tema
✓ Muestra señales de dominio (estado cognitivo: mastery o focused)
✓ Ha pasado suficiente contenido sin verificación
✓ NO tiene señales de fatiga, sobrecarga o duda

NUNCA sugieras quiz si:
✗ Estado cognitivo: fatigue, overload, doubt, confusion, struggling
✗ Acaba de iniciar sesión (primeros 2-3 mensajes)
✗ Preguntó algo específico (responde primero)
✗ Dice que no entiende algo

Si sugieres quiz, inicia tu respuesta con: "QUIZ_SUGERIDO"

━━━ FORMATO VISUAL OBLIGATORIO ━━━
Estructura TODAS tus respuestas así:
• Usa **negritas** para los conceptos clave
• Usa emojis al inicio de cada bloque: 📚 explicación, 💡 tip, ⚠️ cuidado, 🔑 concepto clave, ✅ correcto
• Párrafos cortos (máx 2-3 líneas). Separa con línea en blanco.
• Listas con "•" para enumerar; pasos con "1. 2. 3."

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


def _has_automatic_quiz(response_text: str) -> bool:
    """Detecta si la IA decidió incluir un quiz automático en su respuesta."""
    import re
    # Busca patrón: ❓ + línea en blanco + A. B. C. D.
    quiz_pattern = r"❓\s*\*?\*?.*?\n\s*A[\.\)\:]\s+.+\n\s*B[\.\)\:]\s+.+\n\s*C[\.\)\:]\s+.+\n\s*D[\.\)\:]\s+.+"
    return bool(re.search(quiz_pattern, response_text, re.DOTALL))


def _quiz_suggested(response_text: str) -> bool:
    """Detecta si la IA sugirió hacer un quiz basado en análisis neuroconductual."""
    return response_text.strip().startswith("QUIZ_SUGERIDO")


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
    try:
        if not ai_manager.providers:
            raise HTTPException(
                status_code=503,
                detail="No hay proveedores de IA configurados. Añade GROQ_API_KEY en Vercel."
            )

        topic = request.topic or "Preparación Saber 11"
        cognitive_state = request.cognitive_state or "normal"
        active_modalities = []
        error_risk = 0.0
        quiz_recommended = False
        
        # ═══ ANÁLISIS NEUROCONDUCTUAL (PATRONES ACTIVOS) ═══
        try:
            # Procesar datos multimodales si están disponibles
            now = datetime.now()

            behavioral_event = None
            facial_event = None
            voice_event = None

            # Patrón 1: Ritmo de Interacción (datos de comportamiento)
            if request.response_time_ms > 0 or request.typing_speed_cpm > 0:
                behavioral_event = BehavioralEvent(
                    timestamp=now,
                    response_time_ms=request.response_time_ms,
                    typing_speed_cpm=request.typing_speed_cpm,
                    corrections=request.corrections,
                    pause_duration_ms=request.pause_before_ms,
                )

            # Patrón 3: Microexpresión Facial
            if request.facial_data:
                facial_event = FacialData(
                    timestamp=now,
                    emotion=request.facial_data.get("emotion", "neutral"),
                    valence=request.facial_data.get("valence", 0.0),
                    arousal=request.facial_data.get("arousal", 0.0),
                    attention_score=request.facial_data.get("attention_score", 0.5),
                    blink_rate=request.facial_data.get("blink_rate", 0.0),
                    gaze_direction=request.facial_data.get("gaze_direction", "screen"),
                )

            # Patrón 4: Prosodia de Voz
            if request.voice_data:
                voice_event = VoiceProsodyData(
                    timestamp=now,
                    pitch_mean_hz=request.voice_data.get("pitch_mean_hz", 0.0),
                    volume_db=request.voice_data.get("volume_db", 0.0),
                    speech_rate_wpm=request.voice_data.get("speech_rate_wpm", 0.0),
                    filler_words_count=request.voice_data.get("filler_words_count", 0),
                )

            # Inferencia multimodal (solo si hay al menos un dato)
            if behavioral_event or facial_event or voice_event:
                analysis = neuro_engine.add_multimodal_event(
                    behavioral=behavioral_event,
                    facial=facial_event,
                    voice=voice_event,
                )
                if analysis:
                    cognitive_state = analysis.state.value
                    active_modalities = analysis.active_modalities
                    error_risk = analysis.error_risk
                    logger.info(
                        f"🧠 Estado: {cognitive_state} | "
                        f"Modalidades: {active_modalities} | "
                        f"Riesgo: {error_risk:.2f}"
                    )

        except Exception as e:
            logger.warning(f"⚠️ Análisis neuroconductual falló: {e}")
            # Continuar sin análisis - usar estado del request

        system_prompt = _build_system_prompt(topic, cognitive_state)

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
        
        # Detectar si la IA sugirió hacer un quiz (análisis neuroconductual)
        quiz_suggested = _quiz_suggested(result["response"])
        
        # Limpiar el marcador QUIZ_SUGERIDO del mensaje
        clean_message = result["response"].replace("QUIZ_SUGERIDO", "").strip()

        return ChatMessageResponse(
            message=clean_message,
            action="teach",
            difficulty="medium",
            cognitive_state=cognitive_state,
            confidence=0.8,
            suggestions=[],
            should_pause=False,
            metadata={
                "provider": result["provider"],
                "fallback_used": result.get("fallback_used", False),
                "quiz_suggested": quiz_suggested,
                "active_modalities": active_modalities,
                "error_risk": error_risk,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error en /message: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error interno: {str(e)}"
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
