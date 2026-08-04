"""
NeuroLearn AI - API de Chat
Stateless para Vercel. Siempre usa IA real (Groq → Gemini). Sin fallback local.
"""

from app.services.enrollment_tracking_service import EnrollmentTrackingService
from app.models.classroom import Enrollment
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.learning import LearningSession, CognitiveState
from app.schemas.schemas import (
    StartSessionRequest,
    ChatMessageRequest,
    ChatMessageResponse,
    SessionStatsResponse,
    QuizResponse,
    QuizRequest,
    QuizResponseGemini,
    QuizSubmission,
    QuizHistoryResponse,
    QuizHistoryEntry,
    QuizAnalysisResponse,
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

# Motor Neuroconductual: pool por usuario (claves "u{user_id}")
# Cada usuario mantiene su propio motor con baselines y estado acumulado
_user_engines: Dict[str, MultimodalCognitiveEngine] = {}
# Estadísticas por sesión de usuario {"u{id}": {...}}
_session_stats: Dict[str, dict] = {}


def _get_user_engine(user_id: int) -> MultimodalCognitiveEngine:
    """Devuelve (o crea) el motor neuroconductual propio de este usuario."""
    key = f"u{user_id}"
    if key not in _user_engines:
        _user_engines[key] = MultimodalCognitiveEngine()
        _session_stats[key] = {
            "msg_count": 0,
            "error_streak": 0,      # mensajes consecutivos con muchas correcciones
            "fast_replies": 0,      # respuestas muy rápidas (posible flujo)
            "slow_replies": 0,      # respuestas lentas (posible duda/fatiga)
            "total_rt_ms": 0.0,
            "quiz_error_rate": 0.0, # % de errores históricos en quizzes del tema
            "weak_concepts": [],
        }
    return _user_engines[key]


def _update_session_stats(user_id: int, response_time_ms: float, corrections: int,
                           quiz_error_rate: float = 0.0, weak_concepts: list = []) -> dict:
    """Actualiza las estadísticas acumuladas de la sesión."""
    key = f"u{user_id}"
    if key not in _session_stats:
        _get_user_engine(user_id)  # inicializa si no existe
    s = _session_stats[key]
    s["msg_count"] += 1
    s["total_rt_ms"] += response_time_ms
    s["quiz_error_rate"] = quiz_error_rate
    if weak_concepts:
        s["weak_concepts"] = weak_concepts
    # Detectar tendencias
    avg_rt = s["total_rt_ms"] / s["msg_count"] if s["msg_count"] else 3200
    if response_time_ms < avg_rt * 0.6:
        s["fast_replies"] += 1
    elif response_time_ms > avg_rt * 1.8:
        s["slow_replies"] += 1
    if corrections >= 5:
        s["error_streak"] += 1
    else:
        s["error_streak"] = max(0, s["error_streak"] - 1)
    return s

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


def _build_system_prompt(topic: str, cognitive_state: str = "normal",
                         session_stats: dict = None, error_risk: float = 0.0) -> str:
    """
    Genera el system prompt con instrucciones pedagógicas ULTRA-ESPECÍFICAS
    según el estado cognitivo inferido y las estadísticas reales de la sesión.
    """
    # Estadísticas de sesión para enriquecer el contexto
    stats = session_stats or {}
    msg_n      = stats.get("msg_count", 0)
    weak       = stats.get("weak_concepts", [])
    quiz_err   = stats.get("quiz_error_rate", 0.0)
    err_streak = stats.get("error_streak", 0)
    fast_r     = stats.get("fast_replies", 0)
    slow_r     = stats.get("slow_replies", 0)

    # Contexto de tendencia de sesión
    trend_ctx = ""
    if msg_n >= 3:
        if fast_r >= 2:
            trend_ctx = "📈 TENDENCIA: El estudiante responde rápido y con fluidez — probablemente está en flujo."
        elif slow_r >= 2:
            trend_ctx = "📉 TENDENCIA: El estudiante tarda más de lo habitual — posible duda o cansancio acumulado."
        if err_streak >= 2:
            trend_ctx += " ⚠️ Ha cometido muchas correcciones seguidas — señal de confusión o frustración."

    # Contexto de historial de quizzes (Patrón 5)
    quiz_ctx = ""
    if quiz_err > 0.5:
        concepts_str = ", ".join(weak[:3]) if weak else "conceptos del tema"
        quiz_ctx = (
            f"\n⚠️ HISTORIAL DE QUIZZES: El estudiante tiene {int(quiz_err*100)}% de errores "
            f"en evaluaciones de este tema, especialmente en: {concepts_str}. "
            f"Refuerza ACTIVAMENTE estos conceptos en tu respuesta actual."
        )
    elif quiz_err > 0.25 and weak:
        quiz_ctx = (
            f"\n📊 HISTORIAL: Errores moderados ({int(quiz_err*100)}%) en: {', '.join(weak[:2])}. "
            f"Verifica comprensión cuando sea pertinente."
        )

    # Instrucciones muy específicas por estado cognitivo
    state_instructions = {
        "fatigue": (
            "🔴 ESTADO: FATIGA COGNITIVA DETECTADA\n"
            "REGLAS OBLIGATORIAS (no negociables):\n"
            "• Respuesta MUY CORTA: máximo 2 párrafos o 4 bullet points\n"
            "• UN solo concepto nuevo como máximo\n"
            "• Sin listas largas, sin tablas, sin sub-secciones\n"
            "• Termina con: '🛑 Si necesitas una pausa, está bien tomarse 5 minutos.'\n"
            "• NO sugieras quiz ahora"
        ),
        "overload": (
            "🔴 ESTADO: SOBRECARGA COGNITIVA DETECTADA\n"
            "REGLAS OBLIGATORIAS:\n"
            "• Una sola idea, explicada muy simple, con una analogía cotidiana\n"
            "• Sin lista de pasos, sin múltiples conceptos, sin tecnicismos\n"
            "• Máximo 3 oraciones\n"
            "• Pregunta: '¿Tiene sentido hasta aquí? ¿Qué parte te genera más dudas?'\n"
            "• NO sugieras quiz ni profundices"
        ),
        "doubt": (
            "🟡 ESTADO: DUDA / INSEGURIDAD DETECTADA\n"
            "REGLAS:\n"
            "• Empieza con: '💡 Vamos a verlo desde otro ángulo...'\n"
            "• Da 2-3 ejemplos CONCRETOS del tema (no genéricos)\n"
            "• Explica el concepto paso a paso como si fuera la primera vez\n"
            "• Usa una analogía de la vida cotidiana\n"
            "• Al final: '¿Ahora tiene más sentido? ¿Cuál parte aún genera duda?'"
        ),
        "mastery": (
            "🟢 ESTADO: DOMINIO ALTO DETECTADO\n"
            "REGLAS:\n"
            "• El estudiante ya maneja lo básico — llévalo al siguiente nivel\n"
            "• Presenta un caso de aplicación REAL o complejo\n"
            "• Haz preguntas de análisis o síntesis (no solo de recordar)\n"
            "• Conecta este tema con otro relacionado\n"
            "• Puedes sugerir quiz desafiante si lo crees pertinente"
        ),
        "flow": (
            "🟢 ESTADO: FLUJO COGNITIVO — MOMENTO ÓPTIMO\n"
            "REGLAS:\n"
            "• Mantén el ritmo y la profundidad actual\n"
            "• Expande el tema con conceptos avanzados\n"
            "• Haz preguntas de pensamiento crítico y análisis\n"
            "• No simplifies — el estudiante puede con más\n"
            "• Ideal para sugerir quiz si el tema lo permite"
        ),
        "frustration": (
            "🔴 ESTADO: FRUSTRACIÓN DETECTADA\n"
            "REGLAS (críticas para mantener motivación):\n"
            "• PRIMERO valida la emoción: 'Entiendo que este tema puede ser complicado...'\n"
            "• LUEGO simplifica al máximo — explica solo 1 cosa\n"
            "• Refuerza lo que el estudiante SÍ sabe del tema\n"
            "• Usa frases motivadoras: 'Ya lo tienes casi, es cuestión de práctica'\n"
            "• Termina con una pregunta MUY fácil de responder para recuperar confianza\n"
            "• NO hagas preguntas difíciles ni sugieras quiz"
        ),
        "curiosity": (
            "🟣 ESTADO: CURIOSIDAD / EXPLORACIÓN\n"
            "REGLAS:\n"
            "• El estudiante quiere saber más — aliméntalo\n"
            "• Ofrece conexiones con temas relacionados\n"
            "• Menciona aplicaciones reales o datos interesantes\n"
            "• Haz preguntas abiertas que inviten a profundizar\n"
            "• Es buen momento para ampliar el tema"
        ),
        "normal": (
            "⚪ ESTADO: NORMAL — enseñanza estándar\n"
            "• Ritmo claro y motivador\n"
            "• Ejemplos concretos del tema\n"
            "• Verifica comprensión al final de cada bloque"
        ),
    }
    instruction = state_instructions.get(cognitive_state, state_instructions["normal"])

    error_risk_ctx = ""
    if error_risk > 0.45:
        error_risk_ctx = (
            f"\n🎯 RIESGO DE ERROR ALTO ({int(error_risk*100)}%): "
            f"El estudiante tiene alta probabilidad de cometer un error. "
            f"Refuerza la comprensión ANTES de avanzar al siguiente concepto."
        )

    # Construir el bloque de adaptación neuroconductual de forma explícita
    neuro_block = "\n".join(filter(None, [
        f"\n{'='*50}",
        f"ADAPTACIÓN NEUROCONDUCTUAL ACTIVA:",
        f"{'='*50}",
        instruction,
        quiz_ctx if quiz_ctx else "",
        error_risk_ctx if error_risk_ctx else "",
        f"\n{trend_ctx}" if trend_ctx else "",
    ]))

    return f"{_SYSTEM_PROMPT}\n\n📌 TEMA ACTUAL: **{topic}**\n{neuro_block}"


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
        confidence=1.0,
        suggestions=[],
        should_pause=False,
        metadata={"provider": result["provider"]},
    )


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Envía mensaje al tutor IA con análisis neuroconductual completo de 5 patrones.
    Motor por-usuario para acumulación de baselines y estado de sesión.
    """
    try:
        if not ai_manager.providers:
            raise HTTPException(
                status_code=503,
                detail="No hay proveedores de IA configurados. Añade GROQ_API_KEY en Vercel."
            )

        topic = request.topic or "Preparación Saber 11"
        cognitive_state = request.cognitive_state or "normal"
        active_modalities: List[str] = []
        error_risk = 0.0

        # ═══ PATRÓN 5: datos reales de quizzes (historial en DB) ═══
        quiz_error_rate = 0.0
        weak_concepts: List[str] = []
        try:
            from app.models.learning import QuizHistory
            prev_quizzes = db.query(QuizHistory).filter(
                QuizHistory.user_id == current_user.id,
                QuizHistory.topic.ilike(f"%{topic.split()[0]}%"),
                QuizHistory.completed_at.isnot(None),
            ).order_by(QuizHistory.completed_at.desc()).limit(5).all()

            if prev_quizzes:
                total_wrong = sum(q.wrong_answers or 0 for q in prev_quizzes)
                total_q    = sum(q.questions_count or 1 for q in prev_quizzes)
                quiz_error_rate = total_wrong / total_q if total_q else 0.0
                for pq in prev_quizzes:
                    if pq.weak_concepts:
                        weak_concepts.extend(pq.weak_concepts)
                weak_concepts = list(set(weak_concepts))[:5]
        except Exception as eq:
            logger.debug(f"Quiz history fetch failed (non-critical): {eq}")

        # ═══ ANÁLISIS NEUROCONDUCTUAL — 5 PATRONES ═══
        try:
            now = datetime.now()

            # Patrón 1 — Ritmo de Interacción (SIEMPRE activo, usa contenido como señal)
            behavioral_event = BehavioralEvent(
                timestamp=now,
                event_type="response",
                response_time_ms=request.response_time_ms or 3200.0,
                typing_speed_cpm=request.typing_speed_cpm or 140.0,
                # Patrón 2 — Secuencia de Decisión: correcciones reales
                correction_made=request.corrections > 0,
                error_occurred=request.corrections >= 5,  # muchas correcciones = confusión
                pause_duration_ms=request.pause_before_ms,
                content_length=len(request.message),
            )

            # Patrón 3 — Microexpresión Facial
            facial_event = None
            if request.facial_data:
                from app.ai.cognitive.neuroconductual_engine import EmotionEnum
                raw_emotion = request.facial_data.get("emotion", "neutral")
                try:
                    emotion_val = EmotionEnum(raw_emotion)
                except (ValueError, KeyError):
                    emotion_val = EmotionEnum.NEUTRAL
                facial_event = FacialData(
                    timestamp=now,
                    emotion=emotion_val,
                    valence=request.facial_data.get("valence", 0.0),
                    arousal=request.facial_data.get("arousal", 0.0),
                    attention_score=request.facial_data.get("attention_score", 0.5),
                    blink_rate=request.facial_data.get("blink_rate", 17.0),
                    emotion_confidence=request.facial_data.get("emotion_confidence", 0.5),
                    brow_furrow=request.facial_data.get("brow_furrow", 0.0),
                    smile_intensity=request.facial_data.get("smile_intensity", 0.0),
                )

            # Patrón 4 — Prosodia de Voz
            voice_event = None
            if request.voice_data:
                voice_event = VoiceProsodyData(
                    timestamp=now,
                    pitch_mean_hz=request.voice_data.get("pitch_mean_hz", 150.0),
                    volume_db=request.voice_data.get("volume_db", 60.0),
                    speech_rate_wpm=request.voice_data.get("speech_rate_wpm", 150.0),
                    filler_words_count=request.voice_data.get("filler_words_count", 0),
                    voice_tremor=request.voice_data.get("voice_tremor", 0.0),
                    energy_level=request.voice_data.get("energy_level", 0.5),
                    pause_ratio=request.voice_data.get("pause_ratio", 0.0),
                )

            # Motor por usuario — mantiene baselines individuales
            user_engine = _get_user_engine(current_user.id)
            analysis = user_engine.add_multimodal_event(
                behavioral=behavioral_event,
                facial=facial_event,
                voice=voice_event,
            )
            if analysis:
                cognitive_state = analysis.state.value
                active_modalities = analysis.active_modalities
                error_risk = analysis.error_risk

            # Patrón 5 — Predicción de Error: inyectar tasa histórica de errores
            # Si hay historial alto de errores, elevar el riesgo de error
            if quiz_error_rate > 0.4:
                error_risk = max(error_risk, quiz_error_rate * 0.8)

            # Actualizar estadísticas de sesión acumuladas
            session_stats = _update_session_stats(
                current_user.id,
                response_time_ms=request.response_time_ms,
                corrections=request.corrections,
                quiz_error_rate=quiz_error_rate,
                weak_concepts=weak_concepts,
            )

            logger.info(
                f"🧠 Estado: {cognitive_state} | P={analysis.probability:.2f} "
                f"error_risk={error_risk:.0%}  engagement={analysis.engagement:.2f} "
                f"[{', '.join(active_modalities)}]"
            )

        except Exception as e:
            logger.warning(f"⚠️ Análisis neuroconductual falló: {e}")
            session_stats = _session_stats.get(f"u{current_user.id}", {})

        system_prompt = _build_system_prompt(
            topic,
            cognitive_state,
            session_stats=session_stats,
            error_risk=error_risk,
        )

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
            should_pause=cognitive_state in ("fatigue", "overload", "frustration"),
            metadata={
                "provider": result["provider"],
                "fallback_used": result.get("fallback_used", False),
                "quiz_suggested": quiz_suggested,
                "active_modalities": active_modalities,
                "error_risk": round(error_risk, 3),
                # Datos reales de los 5 patrones para el CognitiveDashboard
                "patterns": {
                    "P1_interaction_rhythm": {
                        "response_time_ms": request.response_time_ms,
                        "typing_speed_cpm": request.typing_speed_cpm,
                        "pause_before_ms": request.pause_before_ms,
                        "active": True,
                    },
                    "P2_decision_sequence": {
                        "corrections": request.corrections,
                        "typing_bursts": request.typing_bursts,
                        "is_question": request.is_question,
                        "active": True,
                    },
                    "P3_facial": {
                        "active": bool(request.facial_data),
                        "data": request.facial_data or {},
                    },
                    "P4_voice": {
                        "active": bool(request.voice_data),
                        "data": request.voice_data or {},
                    },
                    "P5_error_prediction": {
                        "quiz_error_rate": round(quiz_error_rate, 3),
                        "weak_concepts": weak_concepts,
                        "active": quiz_error_rate > 0,
                    },
                },
                "session_stats": {
                    "msg_count": session_stats.get("msg_count", 1),
                    "error_streak": session_stats.get("error_streak", 0),
                    "fast_replies": session_stats.get("fast_replies", 0),
                    "slow_replies": session_stats.get("slow_replies", 0),
                },
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


@router.post("/generate-quiz", response_model=QuizResponseGemini)
async def generate_cognitive_quiz(
    request: QuizRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Genera un quiz ADAPTATIVO en formato Gemini que:
    1. Analiza el historial previo del usuario en el tema
    2. Identifica conceptos débiles de quizzes anteriores
    3. Ajusta la dificultad según el desempeño histórico
    4. Genera preguntas de refuerzo si hubo errores previos
    """
    from app.models.learning import QuizHistory
    from datetime import datetime
    
    import logging
    logger = logging.getLogger(__name__)
    
    # 1. ANÁLISIS DEL HISTORIAL - Buscar quizzes previos del mismo tema
    previous_quizzes = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.topic.ilike(f"%{request.topic}%"),
        QuizHistory.completed_at.isnot(None)  # Solo los completados
    ).order_by(QuizHistory.completed_at.desc()).limit(5).all()
    
    # Analizar desempeño histórico
    weak_concepts = []
    average_performance = 0
    last_mistakes = []
    
    if previous_quizzes:
        total_performance = 0
        for pq in previous_quizzes:
            if pq.performance_score:
                total_performance += pq.performance_score
            if pq.weak_concepts:
                weak_concepts.extend(pq.weak_concepts)
            if pq.mistakes and len(previous_quizzes) <= 2:  # Solo de los 2 últimos
                last_mistakes.extend([m.get('question', '') for m in pq.mistakes if isinstance(m, dict)])
        
        average_performance = total_performance / len(previous_quizzes) if previous_quizzes else 0
        weak_concepts = list(set(weak_concepts))[:5]  # Top 5 conceptos débiles únicos
    
    # 2. ADAPTACIÓN DE DIFICULTAD basada en desempeño
    adaptation_note = None
    
    if request.difficulty:
        # Usuario especificó dificultad manualmente
        difficulty = request.difficulty
        adaptation_note = f"Dificultad seleccionada manualmente: {difficulty}"
    else:
        # Ajuste dinámico según promedio histórico
        if average_performance >= 85:
            difficulty = "Difícil"
            adaptation_note = f"🚀 Subiendo a Difícil por promedio histórico del {round(average_performance, 1)}%"
        elif average_performance >= 60:
            difficulty = "Medio"
            adaptation_note = f"📊 Nivel Medio por promedio histórico del {round(average_performance, 1)}%"
        elif average_performance > 0:
            difficulty = "Fácil"
            adaptation_note = f"🔰 Nivel Fácil para reforzar bases (promedio: {round(average_performance, 1)}%)"
        else:
            # Sin historial, usar estado cognitivo de sesión
            last_session = db.query(LearningSession).filter(
                LearningSession.user_id == current_user.id,
                LearningSession.topic.ilike(f"%{request.topic}%")
            ).order_by(LearningSession.started_at.desc()).first()
            
            cognitive_level = last_session.last_cognitive_state if last_session else "normal"
            difficulty_mapping = {
                "mastery": "Difícil",
                "flow": "Medio",
                "normal": "Medio",
                "doubt": "Fácil",
                "fatigue": "Fácil",
                "overload": "Fácil"
            }
            difficulty = difficulty_mapping.get(cognitive_level, "Medio")
            adaptation_note = f"✨ Primer quiz en este tema - Nivel {difficulty} (estado: {cognitive_level})"
    
    num_questions = request.num_questions or 3  # Reducido de 5 a 3 para evitar truncamiento
    
    # 3. PROMPT ADAPTATIVO con enfoque en conceptos débiles
    reinforcement_context = ""
    if weak_concepts:
        concepts_str = ", ".join(weak_concepts)
        reinforcement_context = (
            f"\n\n🎯 REFUERZO DE CONCEPTOS DÉBILES:\n"
            f"El estudiante ha tenido dificultades con: {concepts_str}.\n"
            f"Genera al menos {min(2, num_questions)} preguntas enfocadas en estos conceptos, "
            f"con explicaciones concisas pero claras (máximo 2 oraciones)."
        )
        # Actualizar mensaje de adaptación
        if adaptation_note:
            adaptation_note += f" | Reforzando: {concepts_str}"
    
    if last_mistakes:
        reinforcement_context += (
            f"\n\nERRORES RECIENTES:\n"
            f"En quizzes anteriores falló preguntas similares a:\n" +
            "\n".join([f"- {m[:100]}" for m in last_mistakes[:3]]) +
            f"\nGenera preguntas que aborden estos temas desde ángulos diferentes."
        )
    
    system_instructions = (
        f"Eres un experto en evaluación educativa ADAPTATIVA tipo Saber 11 de Colombia. "
        f"Genera un quiz de {num_questions} preguntas sobre '{request.topic}' con dificultad '{difficulty}'. "
        f"{'Desempeño histórico del estudiante: ' + str(round(average_performance, 1)) + '%. ' if average_performance > 0 else ''}"
        f"Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni markdown. "
        f"Explicaciones CONCISAS (máximo 2 oraciones por pregunta). "
        f"CRÍTICO: Cada pregunta DEBE tener los campos: id, question, options, answer, explanation. "
        f"El campo 'answer' DEBE ser UNO de los valores en 'options'."
        f"{reinforcement_context}"
    )

    prompt = (
        f"Genera un quiz educativo ADAPTATIVO sobre '{request.topic}' con exactamente {num_questions} preguntas de selección múltiple. "
        f"Dificultad: {difficulty}. "
        f"{'REFUERZA los conceptos: ' + ', '.join(weak_concepts) + '. ' if weak_concepts else ''}"
        "Devuelve ÚNICAMENTE este JSON válido:\n"
        '{\n'
        f'  "quiz_title": "{request.topic}",\n'
        f'  "difficulty": "{difficulty}",\n'
        '  "questions": [\n'
        '    {\n'
        '      "id": 1,\n'
        '      "question": "Texto de la pregunta",\n'
        '      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],\n'
        '      "answer": "Opción A",\n'
        '      "explanation": "Explicación BREVE de por qué es correcta"\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        f"REGLAS CRÍTICAS:\n"
        f"1. Genera exactamente {num_questions} preguntas\n"
        f"2. CADA pregunta debe tener: id, question, options (4 strings), answer (DEBE estar en options), explanation\n"
        f"3. El answer DEBE ser UNO de los valores en la lista options\n"
        f"4. IDs deben ir del 1 al {num_questions}\n"
        f"5. Explicaciones máximo 2 oraciones\n"
        f"6. JSON debe ser válido y parseable"
    )

    # 4. GENERAR QUIZ CON IA
    import json
    import re
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        result = await ai_manager.generate(
            prompt=prompt,
            system_prompt=system_instructions,
            temperature=0.5,
            max_tokens=2000  # Aumentado para asegurar respuesta completa (antes 1024)
        )
    except Exception as ai_error:
        logger.error(f"Error llamando a AI manager: {ai_error}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al conectar con el servicio de IA: {str(ai_error)}"
        )
    
    try:
        # Limpiar respuesta de markdown o texto extra
        response_text = result["response"].strip()
        logger.info(f"Respuesta IA (primeros 200 chars): {response_text[:200]}")
        
        # Remover bloques de código markdown si existen
        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)
        
        # Extraer JSON si está envuelto en texto
        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            response_text = json_match.group(0)
        
        # Intentar parsear JSON
        try:
            quiz_data = json.loads(response_text)
        except json.JSONDecodeError as json_err:
            # Si falla, intentar completar el JSON truncado
            logger.error(f"Error JSON parsing: {json_err}")
            logger.error(f"Respuesta completa (primeros 2000 chars): {response_text[:2000]}")
            
            # Intentar extraer solo las preguntas completas que tengamos
            if '"questions"' in response_text:
                # Buscar hasta la última pregunta completa
                try:
                    # Encontrar el último cierre de llave de pregunta completo
                    last_complete_question_idx = response_text.rfind('      "explanation":')
                    if last_complete_question_idx != -1:
                        # Buscar el cierre de esa pregunta
                        next_closing_brace = response_text.find('\n    }', last_complete_question_idx)
                        if next_closing_brace != -1:
                            # Cerrar el array y el objeto
                            truncated_json = response_text[:next_closing_brace + 6] + '\n  ]\n}'
                            quiz_data = json.loads(truncated_json)
                            logger.info(f"✅ JSON recuperado con {len(quiz_data.get('questions', []))} preguntas")
                        else:
                            raise json_err
                    else:
                        raise json_err
                except:
                    raise json_err
            else:
                raise json_err
        
        # Validar estructura Gemini
        if "quiz_title" not in quiz_data or "questions" not in quiz_data:
            raise ValueError("Estructura de quiz inválida")
        
        if not quiz_data["questions"] or len(quiz_data["questions"]) == 0:
            raise ValueError("No se generaron preguntas")
        
        # 4b. VALIDAR Y COMPLETAR PREGUNTAS INCOMPLETAS
        for i, question in enumerate(quiz_data["questions"]):
            # Verificar campos requeridos
            if "answer" not in question or question["answer"] is None:
                # Si falta answer, usar la primera opción como fallback
                if "options" in question and len(question["options"]) > 0:
                    question["answer"] = question["options"][0]
                    logger.warning(f"Pregunta {i+1}: Falta 'answer', usando opción 1 como fallback")
                else:
                    raise ValueError(f"Pregunta {i+1} no tiene 'answer' ni 'options' válidos")
            
            # Validar que answer esté en options
            if "options" in question and isinstance(question["options"], list):
                if question["answer"] not in question["options"]:
                    logger.warning(f"Pregunta {i+1}: answer '{question['answer']}' no está en options, usando opción 1")
                    question["answer"] = question["options"][0]
            
            # Completar campos opcionales
            if "explanation" not in question:
                question["explanation"] = "Sin explicación disponible"
            if "id" not in question:
                question["id"] = i + 1
        
        # 4. Guardar en historial del usuario CON INFORMACIÓN DE ADAPTACIÓN
        try:
            quiz_history_entry = QuizHistory(
                user_id=current_user.id,
                session_id=None,
                quiz_title=quiz_data["quiz_title"],
                topic=request.topic,
                difficulty=quiz_data.get("difficulty", difficulty),
                questions_count=len(quiz_data["questions"]),
                quiz_data=quiz_data,
                created_at=datetime.utcnow(),
                # Campos de adaptación
                weak_concepts=weak_concepts if weak_concepts else None,
                adaptation_applied=adaptation_note if 'adaptation_note' in locals() else None,
                recommended_difficulty=difficulty
            )
            
            db.add(quiz_history_entry)
            db.commit()
            db.refresh(quiz_history_entry)
            
            logger.info(f"Quiz guardado con adaptación: {adaptation_note if 'adaptation_note' in locals() else 'Sin adaptación previa'}")
        except Exception as db_error:
            logger.warning(f"No se pudo guardar en historial: {db_error}. Quiz generado sin historial.")
            # Continuar sin guardar en historial si hay error de BD
        
        return quiz_data
        
    except json.JSONDecodeError as e:
        import logging
        logging.error(f"Error JSON parsing: {e}\nRespuesta: {result.get('response', '')}")
        raise HTTPException(
            status_code=500, 
            detail="Error al interpretar la respuesta de la IA. Intenta de nuevo."
        )
    except Exception as e:
        import logging
        logging.error(f"Error generando quiz: {e}\nRespuesta: {result.get('response', '')}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error al generar el quiz: {str(e)}"
        )


@router.post("/submit-quiz", response_model=QuizAnalysisResponse)
async def submit_quiz_answers(
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Recibe las respuestas del usuario, calcula el puntaje y realiza ANÁLISIS ADAPTATIVO:
    1. Identifica preguntas falladas
    2. Extrae conceptos débiles
    3. Recomienda dificultad para el próximo quiz
    4. Guarda toda la información para adaptación futura
    """
    from app.models.learning import QuizHistory
    from datetime import datetime
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Buscar el quiz más reciente del usuario con ese título
    quiz_entry = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.quiz_title == submission.quiz_title,
        QuizHistory.completed_at == None
    ).order_by(QuizHistory.created_at.desc()).first()
    
    if not quiz_entry:
        raise HTTPException(status_code=404, detail="Quiz no encontrado en el historial")
    
    # 1. CALCULAR PUNTAJE Y DETECTAR ERRORES
    quiz_data = quiz_entry.quiz_data
    correct = 0
    total = len(quiz_data["questions"])
    mistakes_detail = []
    weak_concepts = []
    
    for question in quiz_data["questions"]:
        question_id = question["id"]
        correct_answer = question["answer"]
        user_answer = submission.user_answers.get(question_id)
        
        if user_answer and user_answer.strip() == correct_answer.strip():
            correct += 1
        else:
            # REGISTRAR ERROR DETALLADO
            mistake_info = {
                "question_id": question_id,
                "question": question["question"],
                "user_answer": user_answer or "Sin respuesta",
                "correct_answer": correct_answer,
                "explanation": question.get("explanation", "")
            }
            mistakes_detail.append(mistake_info)
            
            # EXTRAER CONCEPTOS DÉBILES (mejorado - palabras clave más relevantes)
            question_text = question["question"].lower()
            explanation_text = question.get("explanation", "").lower()
            
            # Palabras comunes a filtrar (stop words en español)
            stop_words = {'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'por', 'con', 'su', 'para', 'como', 'es', 'al', 'lo', 'del', 'las', 'una', 'está', 'este', 'tiene', 'más', 'cuando', 'pero', 'sus', 'les', 'cual', 'cuál', 'cómo', 'qué', 'dónde'}
            
            # Extraer palabras significativas (más de 5 letras, no stop words)
            words = question_text.replace('¿', '').replace('?', '').split()
            keywords = [word.strip('.,;:()[]') for word in words if len(word) > 5 and word not in stop_words]
            
            # Agregar hasta 2 conceptos clave por pregunta fallada
            if keywords:
                weak_concepts.extend(keywords[:2])
    
    # 2. CALCULAR MÉTRICAS DE DESEMPEÑO
    percentage = round((correct / total) * 100, 1) if total > 0 else 0
    
    # 3. RECOMENDAR DIFICULTAD PARA PRÓXIMO QUIZ (Lógica Adaptativa Mejorada)
    current_difficulty = quiz_entry.difficulty or "Medio"
    
    # Normalizar dificultad actual
    difficulty_levels = ["Fácil", "Medio", "Difícil"]
    
    if percentage >= 85:
        # Excelente desempeño (85%+) → Incrementar dificultad
        if current_difficulty == "Fácil":
            recommended_difficulty = "Medio"
            adaptation_message = "🎉 ¡Excelente desempeño! Subiendo a nivel Medio para continuar tu progreso."
        elif current_difficulty == "Medio":
            recommended_difficulty = "Difícil"
            adaptation_message = "🌟 ¡Dominio sobresaliente! Subiendo a nivel Difícil para desafiarte más."
        else:  # Difícil
            recommended_difficulty = "Difícil"
            adaptation_message = "🏆 ¡Nivel experto! Mantén el desafío en Difícil para consolidar tu maestría."
            
    elif percentage >= 60:
        # Buen desempeño (60-84%) → Mantener nivel actual
        recommended_difficulty = current_difficulty
        if percentage >= 75:
            adaptation_message = f"👍 Buen progreso ({percentage}%). Mantén nivel {current_difficulty} para consolidar."
        else:
            adaptation_message = f"📚 Progreso adecuado ({percentage}%). Sigue practicando en nivel {current_difficulty}."
            
    else:
        # Desempeño bajo (<60%) → Reducir dificultad
        if current_difficulty == "Difícil":
            recommended_difficulty = "Medio"
            adaptation_message = f"💡 Bajando a nivel Medio para reforzar conceptos fundamentales ({percentage}%)."
        elif current_difficulty == "Medio":
            recommended_difficulty = "Fácil"
            adaptation_message = f"📖 Bajando a nivel Fácil para consolidar las bases ({percentage}%)."
        else:  # Fácil
            recommended_difficulty = "Fácil"
            adaptation_message = f"🔰 Mantén nivel Fácil para dominar los fundamentos ({percentage}%). ¡Tú puedes!"
    
    # Limpiar conceptos débiles (únicos, primeros 5)
    weak_concepts = list(set(weak_concepts))[:5]
    
    # 4. ACTUALIZAR HISTORIAL CON ANÁLISIS COMPLETO
    quiz_entry.user_answers = submission.user_answers
    quiz_entry.correct_answers = correct
    quiz_entry.wrong_answers = total - correct
    quiz_entry.user_score = f"{correct}/{total}"
    quiz_entry.completed_at = datetime.utcnow()
    quiz_entry.performance_score = percentage
    quiz_entry.mistakes = mistakes_detail
    quiz_entry.weak_concepts = weak_concepts
    quiz_entry.recommended_difficulty = recommended_difficulty
    quiz_entry.adaptation_applied = adaptation_message
    
    if quiz_entry.created_at:
        time_diff = datetime.utcnow() - quiz_entry.created_at
        quiz_entry.time_spent_seconds = int(time_diff.total_seconds())
    
    db.commit()
    
    logger.info(f"Quiz analizado: {percentage}% - Conceptos débiles: {weak_concepts}")

    db.commit()
    logger.info(f"Quiz analizado: {percentage}% - Conceptos débiles: {weak_concepts}")

    # ── NUEVO: validar y registrar seguimiento (Enrollment) ─────────────
    validated_classroom_id = None
    if submission.classroom_id is not None:
        active_enrollment = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.classroom_id == submission.classroom_id,
            Enrollment.is_active == True,
        ).first()
        if active_enrollment:
            validated_classroom_id = submission.classroom_id
            quiz_entry.classroom_id = validated_classroom_id
            db.commit()
        else:
            logger.warning(
                f"submit_quiz_answers: classroom_id={submission.classroom_id} "
                f"no corresponde a un Enrollment activo de user_id={current_user.id}. Se ignora."
            )

    if validated_classroom_id is not None:
        EnrollmentTrackingService.register_quiz_completion(
            db=db,
            student_id=current_user.id,
            classroom_id=validated_classroom_id,
            score_percentage=percentage,
        )
    
    return QuizAnalysisResponse(
        score=f"{correct}/{total}",
        correct_answers=correct,
        wrong_answers=total - correct,
        percentage=percentage,
        mistakes=mistakes_detail,
        weak_concepts=weak_concepts,
        recommended_difficulty=recommended_difficulty,
        adaptation_message=adaptation_message
    )


@router.get("/quiz-history", response_model=QuizHistoryResponse)
async def get_quiz_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Devuelve el historial completo de quizzes con información de adaptación.
    Incluye: errores, conceptos débiles, y recomendaciones de dificultad.
    """
    from app.models.learning import QuizHistory
    
    history_entries = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id
    ).order_by(QuizHistory.created_at.desc()).all()
    
    history_list = []
    for entry in history_entries:
        # Preparar lista de errores (solo preguntas)
        mistakes_list = None
        if entry.mistakes:
            mistakes_list = [m.get('question', '')[:100] for m in entry.mistakes if isinstance(m, dict)]
        
        history_list.append(QuizHistoryEntry(
            date=entry.created_at.strftime("%Y-%m-%d"),
            title=entry.quiz_title,
            questions_count=entry.questions_count,
            user_score=entry.user_score,
            difficulty=entry.difficulty,
            mistakes=mistakes_list,
            adaptation=entry.adaptation_applied,
            performance_score=entry.performance_score,
            recommended_difficulty=entry.recommended_difficulty
        ))
    
    return QuizHistoryResponse(
        history=history_list,
        total_quizzes=len(history_list)
    )
