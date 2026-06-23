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
                    event_type="response",
                    response_time_ms=request.response_time_ms,
                    typing_speed_cpm=request.typing_speed_cpm,
                    correction_made=bool(getattr(request, "corrections", 0)),
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
        f"Explicaciones CONCISAS (máximo 2 oraciones por pregunta)."
        f"{reinforcement_context}"
    )

    prompt = (
        f"Genera un quiz educativo ADAPTATIVO sobre '{request.topic}' con exactamente {num_questions} preguntas de selección múltiple. "
        f"Dificultad: {difficulty}. "
        f"{'REFUERZA los conceptos: ' + ', '.join(weak_concepts) + '. ' if weak_concepts else ''}"
        "Devuelve ÚNICAMENTE este JSON exacto:\n"
        '{\n'
        f'  "quiz_title": "{request.topic}",\n'
        f'  "difficulty": "{difficulty}",\n'
        '  "questions": [\n'
        '    {\n'
        '      "id": 1,\n'
        '      "question": "Texto de la pregunta",\n'
        '      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],\n'
        '      "answer": "Opción correcta (debe estar en la lista de options)",\n'
        '      "explanation": "Explicación BREVE (máximo 2 oraciones) de por qué es correcta"\n'
        '    }\n'
        '  ]\n'
        '}\n'
        f"Asegúrate de generar exactamente {num_questions} preguntas con IDs del 1 al {num_questions}. "
        f"IMPORTANTE: Mantén las explicaciones breves y concisas para evitar exceder límites de tokens."
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
