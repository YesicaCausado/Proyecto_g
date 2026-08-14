"""
NeuroLearn AI - API de Chat
Stateless para Vercel. Siempre usa IA real (Groq → Gemini). Sin fallback local.

═══════════════════════════════════════════════════════════════════════════
CAMBIOS EN ESTA VERSIÓN (correcciones)
═══════════════════════════════════════════════════════════════════════════
1. /stats ahora devuelve datos REALES leídos de la base de datos
   (antes devolvía ceros hardcodeados).
2. El estado neuroconductual de sesión (_session_stats) YA NO vive en un
   diccionario global en memoria de proceso -- en Vercel (serverless) ese
   diccionario se pierde en cada cold start / instancia distinta, así que
   los "patrones" de comportamiento casi nunca se acumulaban de verdad.
   Ahora se persiste en la tabla `cognitive_session_state` (ver el modelo
   nuevo que debes agregar en app/models/learning.py, incluido más abajo
   como referencia).
3. El motor MultimodalCognitiveEngine se mantiene como caché en memoria por
   proceso (por rendimiento), pero su ausencia ya no rompe el análisis:
   si no existe (cold start), se reconstruye y se re-siembra con el
   contexto real almacenado en DB (msg_count, error_streak, etc.).
4. Null-safety: response_time_ms / corrections ya no pueden romper
   _update_session_stats con TypeError si llegan en None.
5. logger.info ya no puede lanzar AttributeError si `analysis` es None.
6. Eliminado el commit + log duplicado en submit_quiz_answers.
7. Unificado el criterio de búsqueda de historial de quizzes por tema
   (antes /message usaba solo la primera palabra del tema y /generate-quiz
   usaba el tema completo -> resultados inconsistentes).
8. submit_quiz_answers ahora reconoce user_answers con claves int o str
   (antes fallaba silenciosamente si el JSON llegaba con claves string).
9. _has_automatic_quiz() ahora se usa de verdad: si la IA ignora la
   instrucción de no incluir quizzes automáticos, se registra un warning
   (antes la función estaba definida pero nunca invocada).

REQUIERE (agregar en app/models/learning.py) -- ver bloque comentado al
final de este archivo con el modelo `CognitiveSessionState` sugerido y
la migración correspondiente.
═══════════════════════════════════════════════════════════════════════════
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
from app.services.license_service import require_chat_access, LicenseInfo
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
    ChatPatternPayload,
    ChatPatternHistoryResponse,
    ChatPatternHistoryEntry,
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

# Caché de motor neuroconductual EN MEMORIA (por proceso).
# ⚠️ En Vercel esto es solo una optimización de latencia dentro de la misma
# instancia "caliente"; NO es la fuente de verdad. La fuente de verdad de
# las estadísticas de sesión es la base de datos (tabla
# cognitive_session_state), leída/escrita en cada request.
_user_engines: Dict[str, MultimodalCognitiveEngine] = {}


def _get_user_engine(user_id: int) -> MultimodalCognitiveEngine:
    """Devuelve (o crea) el motor neuroconductual en caché de este proceso.

    Si el proceso es nuevo (cold start), el motor se crea vacío. Su
    calibración fina de baseline se reconstruye con el tiempo, pero las
    estadísticas de sesión (mensajes, rachas de error, etc.) siempre se
    leen de la base de datos, así que no se pierden aunque el motor sí
    "olvide" su baseline entre cold starts.
    """
    key = f"u{user_id}"
    if key not in _user_engines:
        _user_engines[key] = MultimodalCognitiveEngine()
    return _user_engines[key]


def _default_stats_row() -> dict:
    return {
        "msg_count": 0,
        "error_streak": 0,
        "fast_replies": 0,
        "slow_replies": 0,
        "total_rt_ms": 0.0,
        "quiz_error_rate": 0.0,
        "weak_concepts": [],
    }


def _normalize_cognitive_state(value: Optional[str]) -> str:
    """Mapea aliases del frontend a los valores válidos del enum del backend."""
    valid_states = {
        "normal",
        "fatigue",
        "overload",
        "doubt",
        "mastery",
        "flow",
        "frustration",
        "curiosity",
    }
    raw = (value or "normal").strip().lower()
    aliases = {
        "focused": "flow",
        "confused": "doubt",
        "confusion": "doubt",
        "struggling": "overload",
        "stressed": "fatigue",
        "bored": "fatigue",
        "happy": "mastery",
        "curious": "curiosity",
        "neutral": "normal",
    }
    normalized = aliases.get(raw, raw)
    return normalized if normalized in valid_states else "normal"


def _get_or_create_learning_session(db: Session, user_id: int, topic: str,
                                   bot_id: Optional[int] = None) -> "LearningSession":
    """Crea o reutiliza la sesión activa por usuario y tema."""
    from app.models.learning import LearningSession

    session = db.query(LearningSession).filter(
        LearningSession.user_id == user_id,
        LearningSession.topic == topic,
        LearningSession.ended_at.is_(None),
    ).order_by(LearningSession.started_at.desc()).first()

    if session is not None:
        return session

    session = LearningSession(
        user_id=user_id,
        topic=topic,
        bot_id=bot_id,
        current_difficulty="medium",
        total_interactions=0,
        correct_responses=0,
        errors_count=0,
        avg_response_time_ms=0.0,
        last_cognitive_state=CognitiveState.NORMAL.value,
        cognitive_state_history=[],
        session_summary={},
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _save_cognitive_event(db: Session, user_id: int, session_id: int,
                         event_type: str, event_data: dict,
                         response_time_ms: Optional[float] = None,
                         typing_speed_cpm: Optional[float] = None,
                         error_rate: Optional[float] = None,
                         correction_count: int = 0,
                         pause_duration_ms: Optional[float] = None,
                         inferred_state: str = "normal",
                         confidence_score: float = 0.0) -> None:
    """Guarda un evento cognitivo real en DB para reconstruir contexto cuando vuelva el estudiante."""
    from app.models.learning import CognitiveEvent

    db.add(CognitiveEvent(
        user_id=user_id,
        session_id=session_id,
        timestamp=datetime.utcnow(),
        event_type=event_type,
        event_data=event_data or {},
        response_time_ms=response_time_ms,
        typing_speed_cpm=typing_speed_cpm,
        error_rate=error_rate,
        correction_count=correction_count,
        pause_duration_ms=pause_duration_ms,
        inferred_state=inferred_state,
        confidence_score=confidence_score,
    ))
    db.commit()


def _save_chat_message(db: Session, session_id: int, role: str, content: str,
                      response_time_ms: Optional[float] = None,
                      cognitive_state: Optional[str] = None,
                      difficulty: Optional[str] = None,
                      extra_data: Optional[dict] = None) -> None:
    """Guarda el texto de la conversación junto con metadata del estado cognitivo."""
    from app.models.learning import ChatMessage

    db.add(ChatMessage(
        session_id=session_id,
        role=role,
        content=content,
        timestamp=datetime.utcnow(),
        response_time_ms=response_time_ms,
        cognitive_state_at_time=cognitive_state,
        difficulty_at_time=difficulty,
        extra_data=extra_data or {},
    ))
    db.commit()


def _load_session_stats(db: Session, user_id: int, topic: str) -> dict:
    """Lee el estado de sesión REAL desde la base de datos.

    Requiere el modelo CognitiveSessionState (ver bloque al final del
    archivo). Si la tabla/modelo aún no existe, degrada de forma segura
    a un estado en memoria por request (no crashea la app), mostrando un
    warning para que se note que falta la migración.
    """
    try:
        from app.models.learning import CognitiveSessionState

        row = db.query(CognitiveSessionState).filter(
            CognitiveSessionState.user_id == user_id,
            CognitiveSessionState.topic == topic,
        ).first()

        if row is None:
            return _default_stats_row()

        return {
            "msg_count": row.msg_count or 0,
            "error_streak": row.error_streak or 0,
            "fast_replies": row.fast_replies or 0,
            "slow_replies": row.slow_replies or 0,
            "total_rt_ms": row.total_rt_ms or 0.0,
            "quiz_error_rate": row.quiz_error_rate or 0.0,
            "weak_concepts": row.weak_concepts or [],
        }
    except ImportError:
        logger.warning(
            "⚠️ CognitiveSessionState no existe todavía en app.models.learning. "
            "Las estadísticas de sesión NO se están persistiendo. "
            "Agrega el modelo (ver comentario al final de chat.py) y corre la migración."
        )
        return _default_stats_row()
    except Exception as e:
        logger.warning(f"⚠️ No se pudo leer CognitiveSessionState: {e}")
        return _default_stats_row()


def _save_session_stats(db: Session, user_id: int, topic: str, stats: dict) -> None:
    """Persiste el estado de sesión actualizado en la base de datos."""
    try:
        from app.models.learning import CognitiveSessionState

        row = db.query(CognitiveSessionState).filter(
            CognitiveSessionState.user_id == user_id,
            CognitiveSessionState.topic == topic,
        ).first()

        if row is None:
            row = CognitiveSessionState(user_id=user_id, topic=topic)
            db.add(row)

        row.msg_count = stats["msg_count"]
        row.error_streak = stats["error_streak"]
        row.fast_replies = stats["fast_replies"]
        row.slow_replies = stats["slow_replies"]
        row.total_rt_ms = stats["total_rt_ms"]
        row.quiz_error_rate = stats["quiz_error_rate"]
        row.weak_concepts = stats["weak_concepts"]
        row.updated_at = datetime.utcnow()

        db.commit()
    except ImportError:
        # Ya se avisó en _load_session_stats; no volvemos a spamear logs.
        pass
    except Exception as e:
        logger.warning(f"⚠️ No se pudo guardar CognitiveSessionState: {e}")
        db.rollback()


def _update_session_stats(stats: dict, response_time_ms: Optional[float], corrections: Optional[int],
                           quiz_error_rate: float = 0.0, weak_concepts: Optional[list] = None) -> dict:
    """Actualiza las estadísticas acumuladas usando solo señales reales.

    Si el frontend no manda timing o correcciones, el mensaje cuenta pero no
    se inventan valores de referencia ni métricas artificiales.
    """
    response_time_ms = float(response_time_ms) if response_time_ms is not None else 0.0
    corrections = corrections if corrections is not None else 0
    weak_concepts = weak_concepts or []

    stats["msg_count"] += 1
    if response_time_ms > 0:
        stats["total_rt_ms"] += response_time_ms
    stats["quiz_error_rate"] = quiz_error_rate
    if weak_concepts:
        stats["weak_concepts"] = weak_concepts

    total_rt = stats["total_rt_ms"]
    avg_rt = total_rt / stats["msg_count"] if stats["msg_count"] and total_rt > 0 else 0.0
    if response_time_ms > 0 and avg_rt > 0:
        if response_time_ms < avg_rt * 0.6:
            stats["fast_replies"] += 1
        elif response_time_ms > avg_rt * 1.8:
            stats["slow_replies"] += 1

    if corrections >= 5:
        stats["error_streak"] += 1
    else:
        stats["error_streak"] = max(0, stats["error_streak"] - 1)

    return stats


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
    stats = session_stats or {}
    msg_n      = stats.get("msg_count", 0)
    weak       = stats.get("weak_concepts", [])
    quiz_err   = stats.get("quiz_error_rate", 0.0)
    err_streak = stats.get("error_streak", 0)
    fast_r     = stats.get("fast_replies", 0)
    slow_r     = stats.get("slow_replies", 0)

    trend_ctx = ""
    if msg_n >= 3:
        if fast_r >= 2:
            trend_ctx = "📈 TENDENCIA: El estudiante responde rápido y con fluidez — probablemente está en flujo."
        elif slow_r >= 2:
            trend_ctx = "📉 TENDENCIA: El estudiante tarda más de lo habitual — posible duda o cansancio acumulado."
        if err_streak >= 2:
            trend_ctx += " ⚠️ Ha cometido muchas correcciones seguidas — señal de confusión o frustración."

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


def _topic_match_filter(QuizHistoryModel, topic: str):
    """Criterio ÚNICO de coincidencia de tema, usado tanto en /message como
    en /generate-quiz para evitar resultados inconsistentes entre ambos
    endpoints. Usa el tema completo (no solo la primera palabra)."""
    return QuizHistoryModel.topic.ilike(f"%{topic.strip()}%")


def _has_automatic_quiz(response_text: str) -> bool:
    """Detecta si la IA decidió incluir un quiz automático en su respuesta
    a pesar de la instrucción explícita de no hacerlo."""
    import re
    quiz_pattern = r"❓\s*\*?\*?.*?\n\s*A[\.\)\:]\s+.+\n\s*B[\.\)\:]\s+.+\n\s*C[\.\)\:]\s+.+\n\s*D[\.\)\:]\s+.+"
    return bool(re.search(quiz_pattern, response_text, re.DOTALL))


def _quiz_suggested(response_text: str) -> bool:
    """Detecta si la IA sugirió hacer un quiz basado en análisis neuroconductual."""
    return response_text.strip().startswith("QUIZ_SUGERIDO")


@router.post("/patterns/save")
async def save_pattern_data(
    payload: ChatPatternPayload,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_chat_access()),
    db: Session = Depends(get_db),
):
    """Guarda los datos de los 5 patrones por usuario y tema."""
    normalized_state = _normalize_cognitive_state(payload.cognitive_state)
    session = _get_or_create_learning_session(db, current_user.id, payload.topic)
    event_data = {
        "topic": payload.topic,
        "cognitive_state": normalized_state,
        "response_time_ms": payload.response_time_ms,
        "typing_speed_cpm": payload.typing_speed_cpm,
        "pause_before_ms": payload.pause_before_ms,
        "corrections": payload.corrections,
        "typing_bursts": payload.typing_bursts,
        "is_question": payload.is_question,
        "message_length": payload.message_length,
        "facial_data": payload.facial_data,
        "voice_data": payload.voice_data,
        "confidence": payload.confidence,
        "metadata": payload.metadata,
    }
    _save_cognitive_event(
        db,
        user_id=current_user.id,
        session_id=session.id,
        event_type="pattern_snapshot",
        event_data=event_data,
        response_time_ms=payload.response_time_ms,
        typing_speed_cpm=payload.typing_speed_cpm,
        error_rate=0.0,
        correction_count=payload.corrections or 0,
        pause_duration_ms=payload.pause_before_ms,
        inferred_state=normalized_state,
        confidence_score=payload.confidence or 0.0,
    )
    return {
        "ok": True,
        "topic": payload.topic,
        "session_id": session.id,
        "saved_at": datetime.utcnow().isoformat(),
    }


@router.get("/patterns", response_model=ChatPatternHistoryResponse)
async def get_pattern_history(
    topic: Optional[str] = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_chat_access()),
    db: Session = Depends(get_db),
):
    """Trae los patrones guardados del usuario por tema."""
    from app.models.learning import CognitiveEvent, LearningSession

    query = db.query(CognitiveEvent).filter(CognitiveEvent.user_id == current_user.id)

    if topic:
        session_ids = db.query(LearningSession.id).filter(
            LearningSession.user_id == current_user.id,
            LearningSession.topic == topic,
        ).subquery()
        query = query.filter(CognitiveEvent.session_id.in_(session_ids))

    rows = query.order_by(CognitiveEvent.timestamp.desc()).limit(limit).all()
    items: List[ChatPatternHistoryEntry] = []
    for row in rows:
        data = row.event_data or {}
        items.append(ChatPatternHistoryEntry(
            timestamp=row.timestamp or datetime.utcnow(),
            topic=data.get("topic") or topic or "general",
            cognitive_state=data.get("cognitive_state"),
            response_time_ms=data.get("response_time_ms"),
            typing_speed_cpm=data.get("typing_speed_cpm"),
            pause_before_ms=data.get("pause_before_ms"),
            corrections=data.get("corrections"),
            typing_bursts=data.get("typing_bursts"),
            is_question=data.get("is_question"),
            message_length=data.get("message_length"),
            facial_data=data.get("facial_data"),
            voice_data=data.get("voice_data"),
            confidence=data.get("confidence"),
            metadata=data.get("metadata"),
        ))

    return ChatPatternHistoryResponse(
        topic=topic,
        total=len(items),
        items=items,
    )


@router.post("/start", response_model=ChatMessageResponse)
async def start_session(
    request: StartSessionRequest,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_chat_access()),
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

    session = _get_or_create_learning_session(db, current_user.id, request.topic, request.bot_id)
    _save_chat_message(
        db,
        session.id,
        role="assistant",
        content=result["response"],
        cognitive_state="normal",
        difficulty=request.difficulty,
        extra_data={"provider": result["provider"], "source": "start_session"},
    )

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
    license_info: LicenseInfo = Depends(require_chat_access()),
    db: Session = Depends(get_db),
):
    """
    Envía mensaje al tutor IA con análisis neuroconductual completo de 5 patrones.
    El estado de sesión se lee y persiste en la base de datos (real, no en
    memoria de proceso).
    """
    try:
        if not ai_manager.providers:
            raise HTTPException(
                status_code=503,
                detail="No hay proveedores de IA configurados. Añade GROQ_API_KEY en Vercel."
            )

        topic = request.topic or "Preparación Saber 11"
        cognitive_state = _normalize_cognitive_state(request.cognitive_state)
        active_modalities: List[str] = []
        error_risk = 0.0

        # ═══ PATRÓN 5: datos reales de quizzes (historial en DB) ═══
        quiz_error_rate = 0.0
        weak_concepts: List[str] = []
        try:
            from app.models.learning import QuizHistory
            prev_quizzes = db.query(QuizHistory).filter(
                QuizHistory.user_id == current_user.id,
                _topic_match_filter(QuizHistory, topic),
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

        # ═══ Cargar estado de sesión REAL desde la base de datos ═══
        session_stats = _load_session_stats(db, current_user.id, topic)

        # ═══ ANÁLISIS NEUROCONDUCTUAL — 5 PATRONES ═══
        analysis = None
        try:
            now = datetime.now()

            has_behavioral_signal = (
                (request.response_time_ms is not None and request.response_time_ms > 0)
                or (request.typing_speed_cpm is not None and request.typing_speed_cpm > 0)
                or (request.pause_before_ms is not None and request.pause_before_ms > 0)
                or (request.corrections is not None and request.corrections > 0)
            )

            behavioral_event = None
            if has_behavioral_signal:
                behavioral_event = BehavioralEvent(
                    timestamp=now,
                    event_type="response",
                    response_time_ms=float(request.response_time_ms or 0.0),
                    typing_speed_cpm=float(request.typing_speed_cpm or 0.0),
                    correction_made=(request.corrections or 0) > 0,
                    error_occurred=(request.corrections or 0) >= 5,
                    pause_duration_ms=float(request.pause_before_ms or 0.0),
                    content_length=len(request.message),
                )

            # Patrón 3 — Microexpresión Facial
            facial_event = None
            if request.facial_data and any(
                value not in (None, 0, "", "neutral") for value in request.facial_data.values()
            ):
                from app.ai.cognitive.neuroconductual_engine import EmotionEnum
                raw_emotion = request.facial_data.get("emotion", "neutral")
                try:
                    emotion_val = EmotionEnum(raw_emotion)
                except (ValueError, KeyError):
                    emotion_val = EmotionEnum.NEUTRAL
                facial_event = FacialData(
                    timestamp=now,
                    emotion=emotion_val,
                    valence=float(request.facial_data.get("valence", 0.0) or 0.0),
                    arousal=float(request.facial_data.get("arousal", 0.0) or 0.0),
                    attention_score=float(request.facial_data.get("attention_score", 0.5) or 0.5),
                    blink_rate=float(request.facial_data.get("blink_rate", 17.0) or 17.0),
                    emotion_confidence=float(request.facial_data.get("emotion_confidence", 0.5) or 0.5),
                    brow_furrow=float(request.facial_data.get("brow_furrow", 0.0) or 0.0),
                    smile_intensity=float(request.facial_data.get("smile_intensity", 0.0) or 0.0),
                )

            # Patrón 4 — Prosodia de Voz
            voice_event = None
            if request.voice_data and any(value not in (None, 0, "") for value in request.voice_data.values()):
                voice_event = VoiceProsodyData(
                    timestamp=now,
                    pitch_mean_hz=float(request.voice_data.get("pitch_mean_hz", 0.0) or 0.0),
                    volume_db=float(request.voice_data.get("volume_db", 0.0) or 0.0),
                    speech_rate_wpm=float(request.voice_data.get("speech_rate_wpm", 0.0) or 0.0),
                    filler_words_count=int(request.voice_data.get("filler_words_count", 0) or 0),
                    voice_tremor=float(request.voice_data.get("voice_tremor", 0.0) or 0.0),
                    energy_level=float(request.voice_data.get("energy_level", 0.5) or 0.5),
                    pause_ratio=float(request.voice_data.get("pause_ratio", 0.0) or 0.0),
                )

            session = _get_or_create_learning_session(db, current_user.id, topic)

            user_engine = _get_user_engine(current_user.id)
            analysis = user_engine.add_multimodal_event(
                behavioral=behavioral_event,
                facial=facial_event,
                voice=voice_event,
                user_message=request.message,
            )
            if analysis:
                cognitive_state = analysis.state.value
                active_modalities = analysis.active_modalities
                error_risk = analysis.error_risk

            _save_cognitive_event(
                db,
                user_id=current_user.id,
                session_id=session.id,
                event_type="response",
                event_data={
                    "topic": topic,
                    "message": request.message,
                    "response_time_ms": request.response_time_ms,
                    "typing_speed_cpm": request.typing_speed_cpm,
                    "pause_before_ms": request.pause_before_ms,
                    "corrections": request.corrections,
                    "typing_bursts": request.typing_bursts,
                    "is_question": request.is_question,
                    "message_length": len(request.message),
                    "facial_data": request.facial_data,
                    "voice_data": request.voice_data,
                    "cognitive_state": cognitive_state,
                    "quiz_error_rate": quiz_error_rate,
                    "weak_concepts": weak_concepts,
                },
                response_time_ms=request.response_time_ms,
                typing_speed_cpm=request.typing_speed_cpm,
                error_rate=quiz_error_rate,
                correction_count=request.corrections or 0,
                pause_duration_ms=request.pause_before_ms,
                inferred_state=cognitive_state,
                confidence_score=analysis.probability if analysis else 0.0,
            )
            _save_chat_message(
                db,
                session.id,
                role="user",
                content=request.message,
                response_time_ms=request.response_time_ms,
                cognitive_state=cognitive_state,
                difficulty="medium",
                extra_data={
                    "topic": topic,
                    "response_time_ms": request.response_time_ms,
                    "typing_speed_cpm": request.typing_speed_cpm,
                    "corrections": request.corrections,
                    "pause_before_ms": request.pause_before_ms,
                    "facial_data": request.facial_data,
                    "voice_data": request.voice_data,
                },
            )

            # Patrón 5 — Predicción de Error: inyectar tasa histórica de errores
            if quiz_error_rate > 0.4:
                error_risk = max(error_risk, quiz_error_rate * 0.8)

            # Actualizar estadísticas de sesión (en memoria de request) y
            # persistirlas en DB de inmediato.
            session_stats = _update_session_stats(
                session_stats,
                response_time_ms=request.response_time_ms,
                corrections=request.corrections,
                quiz_error_rate=quiz_error_rate,
                weak_concepts=weak_concepts,
            )
            _save_session_stats(db, current_user.id, topic, session_stats)

            if analysis:
                logger.info(
                    f"🧠 Estado: {cognitive_state} | P={analysis.probability:.2f} "
                    f"error_risk={error_risk:.0%}  engagement={analysis.engagement:.2f} "
                    f"[{', '.join(active_modalities)}]"
                )
            else:
                logger.info(
                    f"🧠 Estado: {cognitive_state} (sin resultado de motor multimodal) "
                    f"error_risk={error_risk:.0%}"
                )

        except Exception as e:
            logger.warning(f"⚠️ Análisis neuroconductual falló: {e}")
            # session_stats ya viene cargado de DB arriba; lo dejamos tal cual
            # en vez de perder el contexto real del usuario.

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

        # Detectar si, a pesar de la instrucción, la IA incluyó un quiz
        # automático embebido en el texto -- esto no debería pasar.
        if _has_automatic_quiz(result["response"]):
            logger.warning(
                "⚠️ La IA incluyó un quiz automático embebido en la respuesta "
                "pese a la instrucción de no hacerlo (topic=%s, user_id=%s).",
                topic, current_user.id,
            )

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
async def get_session_stats(
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_chat_access()),
    db: Session = Depends(get_db),
):
    """
    Devuelve estadísticas REALES del usuario, leídas de la base de datos:
    - total_messages: suma de mensajes acumulados en cognitive_session_state
    - correct_answers / wrong_answers: agregados de QuizHistory
    - average_response_time: promedio ponderado real de tiempos de respuesta
    - topics_covered: temas distintos con actividad registrada
    - session_duration: tiempo total invertido en quizzes completados (segundos)

    (Antes este endpoint devolvía ceros hardcodeados sin consultar nada.)
    """
    from app.models.learning import QuizHistory

    total_messages = 0
    total_rt_ms = 0.0
    topics_covered: List[str] = []

    try:
        from app.models.learning import CognitiveSessionState

        rows = db.query(CognitiveSessionState).filter(
            CognitiveSessionState.user_id == current_user.id
        ).all()

        for row in rows:
            total_messages += row.msg_count or 0
            total_rt_ms += row.total_rt_ms or 0.0
            if row.topic and row.topic not in topics_covered:
                topics_covered.append(row.topic)
    except ImportError:
        logger.warning(
            "⚠️ CognitiveSessionState no existe todavía; /stats no puede "
            "reportar total_messages / average_response_time reales. "
            "Agrega el modelo (ver comentario al final de chat.py)."
        )
    except Exception as e:
        logger.warning(f"⚠️ Error leyendo CognitiveSessionState en /stats: {e}")

    average_response_time = (total_rt_ms / total_messages) if total_messages else 0.0

    quiz_rows = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.completed_at.isnot(None),
    ).all()

    correct_answers = sum(q.correct_answers or 0 for q in quiz_rows)
    wrong_answers = sum(q.wrong_answers or 0 for q in quiz_rows)
    session_duration = sum(q.time_spent_seconds or 0 for q in quiz_rows)

    for q in quiz_rows:
        if q.topic and q.topic not in topics_covered:
            topics_covered.append(q.topic)

    return SessionStatsResponse(
        total_messages=total_messages,
        correct_answers=correct_answers,
        wrong_answers=wrong_answers,
        average_response_time=round(average_response_time, 1),
        topics_covered=topics_covered,
        session_duration=session_duration,
    )


@router.post("/generate-quiz", response_model=QuizResponseGemini)
async def generate_cognitive_quiz(
    request: QuizRequest,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_chat_access()),
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

    # 1. ANÁLISIS DEL HISTORIAL - Buscar quizzes previos del mismo tema
    #    (mismo criterio de match que /message, ver _topic_match_filter)
    previous_quizzes = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        _topic_match_filter(QuizHistory, request.topic),
        QuizHistory.completed_at.isnot(None)
    ).order_by(QuizHistory.completed_at.desc()).limit(5).all()

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
            if pq.mistakes and len(previous_quizzes) <= 2:
                last_mistakes.extend([m.get('question', '') for m in pq.mistakes if isinstance(m, dict)])

        average_performance = total_performance / len(previous_quizzes) if previous_quizzes else 0
        weak_concepts = list(set(weak_concepts))[:5]

    # 2. ADAPTACIÓN DE DIFICULTAD basada en desempeño
    adaptation_note = None

    if request.difficulty:
        difficulty = request.difficulty
        adaptation_note = f"Dificultad seleccionada manualmente: {difficulty}"
    else:
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

    num_questions = request.num_questions or 3

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

    import json
    import re

    try:
        result = await ai_manager.generate(
            prompt=prompt,
            system_prompt=system_instructions,
            temperature=0.5,
            max_tokens=2000
        )
    except Exception as ai_error:
        logger.error(f"Error llamando a AI manager: {ai_error}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al conectar con el servicio de IA: {str(ai_error)}"
        )

    try:
        response_text = result["response"].strip()
        logger.info(f"Respuesta IA (primeros 200 chars): {response_text[:200]}")

        response_text = re.sub(r'```json\s*', '', response_text)
        response_text = re.sub(r'```\s*', '', response_text)

        json_match = re.search(r'\{[\s\S]*\}', response_text)
        if json_match:
            response_text = json_match.group(0)

        try:
            quiz_data = json.loads(response_text)
        except json.JSONDecodeError as json_err:
            logger.error(f"Error JSON parsing: {json_err}")
            logger.error(f"Respuesta completa (primeros 2000 chars): {response_text[:2000]}")

            if '"questions"' in response_text:
                try:
                    last_complete_question_idx = response_text.rfind('      "explanation":')
                    if last_complete_question_idx != -1:
                        next_closing_brace = response_text.find('\n    }', last_complete_question_idx)
                        if next_closing_brace != -1:
                            truncated_json = response_text[:next_closing_brace + 6] + '\n  ]\n}'
                            quiz_data = json.loads(truncated_json)
                            logger.info(f"✅ JSON recuperado con {len(quiz_data.get('questions', []))} preguntas")
                        else:
                            raise json_err
                    else:
                        raise json_err
                except json.JSONDecodeError:
                    raise json_err
            else:
                raise json_err

        if "quiz_title" not in quiz_data or "questions" not in quiz_data:
            raise ValueError("Estructura de quiz inválida")

        if not quiz_data["questions"] or len(quiz_data["questions"]) == 0:
            raise ValueError("No se generaron preguntas")

        for i, question in enumerate(quiz_data["questions"]):
            if "answer" not in question or question["answer"] is None:
                if "options" in question and len(question["options"]) > 0:
                    question["answer"] = question["options"][0]
                    logger.warning(f"Pregunta {i+1}: Falta 'answer', usando opción 1 como fallback")
                else:
                    raise ValueError(f"Pregunta {i+1} no tiene 'answer' ni 'options' válidos")

            if "options" in question and isinstance(question["options"], list):
                if question["answer"] not in question["options"]:
                    logger.warning(f"Pregunta {i+1}: answer '{question['answer']}' no está en options, usando opción 1")
                    question["answer"] = question["options"][0]

            if "explanation" not in question:
                question["explanation"] = "Sin explicación disponible"
            if "id" not in question:
                question["id"] = i + 1

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
                weak_concepts=weak_concepts if weak_concepts else None,
                adaptation_applied=adaptation_note,
                recommended_difficulty=difficulty
            )

            db.add(quiz_history_entry)
            db.commit()
            db.refresh(quiz_history_entry)

            logger.info(f"Quiz guardado con adaptación: {adaptation_note or 'Sin adaptación previa'}")
        except Exception as db_error:
            logger.warning(f"No se pudo guardar en historial: {db_error}. Quiz generado sin historial.")
            db.rollback()

        return quiz_data

    except json.JSONDecodeError as e:
        logger.error(f"Error JSON parsing: {e}\nRespuesta: {result.get('response', '')}")
        raise HTTPException(
            status_code=500,
            detail="Error al interpretar la respuesta de la IA. Intenta de nuevo."
        )
    except Exception as e:
        logger.error(f"Error generando quiz: {e}\nRespuesta: {result.get('response', '')}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar el quiz: {str(e)}"
        )


@router.post("/submit-quiz", response_model=QuizAnalysisResponse)
async def submit_quiz_answers(
    submission: QuizSubmission,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_chat_access()),
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

    quiz_entry = db.query(QuizHistory).filter(
        QuizHistory.user_id == current_user.id,
        QuizHistory.quiz_title == submission.quiz_title,
        QuizHistory.completed_at == None
    ).order_by(QuizHistory.created_at.desc()).first()

    if not quiz_entry:
        raise HTTPException(status_code=404, detail="Quiz no encontrado en el historial")

    quiz_data = quiz_entry.quiz_data
    correct = 0
    total = len(quiz_data["questions"])
    mistakes_detail = []
    weak_concepts = []

    for question in quiz_data["questions"]:
        question_id = question["id"]
        correct_answer = question["answer"]

        # user_answers puede llegar con claves int o string dependiendo de
        # cómo lo serializó el cliente (JSON siempre usa strings como
        # claves de objeto). Probamos ambas formas para no perder
        # respuestas válidas.
        user_answer = submission.user_answers.get(question_id)
        if user_answer is None:
            user_answer = submission.user_answers.get(str(question_id))

        if user_answer and user_answer.strip() == correct_answer.strip():
            correct += 1
        else:
            mistake_info = {
                "question_id": question_id,
                "question": question["question"],
                "user_answer": user_answer or "Sin respuesta",
                "correct_answer": correct_answer,
                "explanation": question.get("explanation", "")
            }
            mistakes_detail.append(mistake_info)

            question_text = question["question"].lower()

            stop_words = {'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'por', 'con', 'su', 'para', 'como', 'es', 'al', 'lo', 'del', 'las', 'una', 'está', 'este', 'tiene', 'más', 'cuando', 'pero', 'sus', 'les', 'cual', 'cuál', 'cómo', 'qué', 'dónde'}

            words = question_text.replace('¿', '').replace('?', '').split()
            keywords = [word.strip('.,;:()[]') for word in words if len(word) > 5 and word not in stop_words]

            if keywords:
                weak_concepts.extend(keywords[:2])

    percentage = round((correct / total) * 100, 1) if total > 0 else 0

    current_difficulty = quiz_entry.difficulty or "Medio"

    if percentage >= 85:
        if current_difficulty == "Fácil":
            recommended_difficulty = "Medio"
            adaptation_message = "🎉 ¡Excelente desempeño! Subiendo a nivel Medio para continuar tu progreso."
        elif current_difficulty == "Medio":
            recommended_difficulty = "Difícil"
            adaptation_message = "🌟 ¡Dominio sobresaliente! Subiendo a nivel Difícil para desafiarte más."
        else:
            recommended_difficulty = "Difícil"
            adaptation_message = "🏆 ¡Nivel experto! Mantén el desafío en Difícil para consolidar tu maestría."

    elif percentage >= 60:
        recommended_difficulty = current_difficulty
        if percentage >= 75:
            adaptation_message = f"👍 Buen progreso ({percentage}%). Mantén nivel {current_difficulty} para consolidar."
        else:
            adaptation_message = f"📚 Progreso adecuado ({percentage}%). Sigue practicando en nivel {current_difficulty}."

    else:
        if current_difficulty == "Difícil":
            recommended_difficulty = "Medio"
            adaptation_message = f"💡 Bajando a nivel Medio para reforzar conceptos fundamentales ({percentage}%)."
        elif current_difficulty == "Medio":
            recommended_difficulty = "Fácil"
            adaptation_message = f"📖 Bajando a nivel Fácil para consolidar las bases ({percentage}%)."
        else:
            recommended_difficulty = "Fácil"
            adaptation_message = f"🔰 Mantén nivel Fácil para dominar los fundamentos ({percentage}%). ¡Tú puedes!"

    weak_concepts = list(set(weak_concepts))[:5]

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

    # ── Validar y registrar seguimiento (Enrollment) ─────────────
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
        QuizHistory.user_id == current_user.id,
        QuizHistory.completed_at.isnot(None),
        QuizHistory.performance_score.isnot(None),
        QuizHistory.user_score.isnot(None),
    ).order_by(QuizHistory.completed_at.desc(), QuizHistory.created_at.desc()).all()

    history_list = []
    for entry in history_entries:
        mistakes_list = None
        if entry.mistakes:
            mistakes_list = [m.get('question', '')[:100] for m in entry.mistakes if isinstance(m, dict)]

        quiz_questions = []
        quiz_payload = entry.quiz_data or {}
        if isinstance(quiz_payload, dict):
            quiz_questions = quiz_payload.get("questions", []) or []

        user_answers_map = {}
        if isinstance(entry.user_answers, dict):
            user_answers_map = {str(k): v for k, v in entry.user_answers.items()}
        elif isinstance(entry.user_answers, list):
            for item in entry.user_answers:
                if not isinstance(item, dict):
                    continue
                qid = item.get("question_id", item.get("id"))
                value = item.get("selected_answer", item.get("answer", item.get("user_answer")))
                if qid is not None and value is not None:
                    user_answers_map[str(qid)] = value

        question_details = []
        for question in quiz_questions:
            if not isinstance(question, dict):
                continue
            qid = question.get("id")
            selected = user_answers_map.get(str(qid), user_answers_map.get(qid))
            correct_answer = question.get("answer") or question.get("correct_answer")
            question_details.append({
                "id": qid,
                "question": question.get("question", ""),
                "selected_answer": selected,
                "correct_answer": correct_answer,
                "is_correct": selected == correct_answer,
                "explanation": question.get("explanation", ""),
            })

        history_list.append(QuizHistoryEntry(
            id=entry.id,
            date=entry.created_at.strftime("%Y-%m-%d"),
            title=entry.quiz_title,
            questions_count=entry.questions_count,
            user_score=entry.user_score,
            difficulty=entry.difficulty,
            mistakes=mistakes_list,
            adaptation=entry.adaptation_applied,
            performance_score=entry.performance_score,
            recommended_difficulty=entry.recommended_difficulty,
            details=question_details or None,
        ))

    return QuizHistoryResponse(
        history=history_list,
        total_quizzes=len(history_list)
    )


# ═══════════════════════════════════════════════════════════════════════════
# MODELO NUEVO REQUERIDO -- agregar en app/models/learning.py
# ═══════════════════════════════════════════════════════════════════════════
# from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, ForeignKey
# from app.db.database import Base
#
# class CognitiveSessionState(Base):
#     __tablename__ = "cognitive_session_state"
#
#     id = Column(Integer, primary_key=True, index=True)
#     user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
#     topic = Column(String, nullable=False, index=True)
#
#     msg_count = Column(Integer, default=0)
#     error_streak = Column(Integer, default=0)
#     fast_replies = Column(Integer, default=0)
#     slow_replies = Column(Integer, default=0)
#     total_rt_ms = Column(Float, default=0.0)
#     quiz_error_rate = Column(Float, default=0.0)
#     weak_concepts = Column(JSON, default=list)
#
#     updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
#
#     __table_args__ = (
#         # un registro por usuario+tema
#         # UniqueConstraint("user_id", "topic", name="uq_user_topic_state"),
#     )
#
# Migración (ejemplo con Alembic):
#   alembic revision --autogenerate -m "add cognitive_session_state"
#   alembic upgrade head
#
# Sin este modelo, chat.py sigue funcionando (degrada de forma segura con
# warnings en logs), pero NO persistirá estadísticas de sesión reales entre
# invocaciones serverless, y /stats no podrá reportar total_messages ni
# average_response_time reales.
# ═══════════════════════════════════════════════════════════════════════════