"""
🤖 NeuroLearn AI - Chatbot Adaptativo (Modo Aprender)

Chatbot inteligente que NO solo responde preguntas, sino que:
- Decide cuándo enseñar, reforzar o detenerse
- Ajusta la dificultad automáticamente
- Detecta momentos críticos
- Recomienda pausas
- Proporciona retroalimentación personalizada

Funciona con o sin OpenAI API:
- Con API: Usa GPT como motor de generación
- Sin API: Usa templates inteligentes + lógica local
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
from dataclasses import dataclass, field
from enum import Enum
import json
import random

from app.ai.cognitive.neuroconductual_engine import (
    NeuroconductualEngine,
    BehavioralEvent,
    CognitiveStateEnum,
    CognitiveStateResult,
    FacialData,
    VoiceProsodyData,
    EmotionEnum,
)


class TeachingAction(str, Enum):
    """Acciones pedagógicas que el chatbot puede tomar"""
    TEACH = "teach"           # Enseñar nuevo concepto
    REINFORCE = "reinforce"   # Reforzar concepto previo
    QUIZ = "quiz"             # Evaluar comprensión
    EXAMPLE = "example"       # Mostrar ejemplo práctico
    SIMPLIFY = "simplify"     # Simplificar explicación
    CHALLENGE = "challenge"   # Aumentar dificultad
    PAUSE = "pause"           # Recomendar pausa
    SUMMARIZE = "summarize"   # Resumir lo aprendido
    ENCOURAGE = "encourage"   # Motivar al usuario
    REDIRECT = "redirect"     # Cambiar enfoque/tema


class DifficultyLevel(str, Enum):
    BEGINNER = "beginner"
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"

    @property
    def numeric(self) -> int:
        return {"beginner": 1, "easy": 2, "medium": 3, "hard": 4, "expert": 5}[self.value]


@dataclass
class ChatContext:
    """Contexto completo de la conversación"""
    session_id: Optional[int] = None
    user_id: Optional[int] = None
    topic: str = ""
    current_difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    messages: List[Dict[str, str]] = field(default_factory=list)
    concepts_taught: List[str] = field(default_factory=list)
    concepts_mastered: List[str] = field(default_factory=list)
    concepts_struggling: List[str] = field(default_factory=list)
    quiz_results: List[Dict] = field(default_factory=list)
    interaction_count: int = 0
    last_action: Optional[TeachingAction] = None
    cognitive_state: CognitiveStateEnum = CognitiveStateEnum.NORMAL
    pause_recommended: bool = False
    consecutive_errors: int = 0
    consecutive_correct: int = 0
    started_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ChatResponse:
    """Respuesta generada por el chatbot"""
    message: str
    action: TeachingAction
    difficulty: DifficultyLevel
    cognitive_state: CognitiveStateEnum
    metadata: Dict[str, Any] = field(default_factory=dict)
    suggestions: List[str] = field(default_factory=list)
    should_pause: bool = False


class AdaptiveChatbot:
    """
    Chatbot Adaptativo para Aprendizaje Inteligente.
    
    Este chatbot toma decisiones pedagógicas basadas en:
    1. El estado cognitivo inferido del usuario
    2. El historial de la conversación
    3. El rendimiento del usuario
    4. El perfil de aprendizaje acumulado
    """

    def __init__(self, openai_api_key: Optional[str] = None,
                 ai_manager=None):
        self.cognitive_engine = NeuroconductualEngine()
        self.context = ChatContext()
        self.openai_api_key = openai_api_key
        self._openai_client = None
        self.ai_manager = ai_manager  # AIManager con Groq/Gemini
        self.knowledge_base: Optional[Dict] = None
        self._current_step_index: int = 0
        self._topics_covered: List[str] = []
        
        # Inicializar cliente OpenAI si hay API key (legacy)
        if openai_api_key and not ai_manager:
            try:
                from openai import OpenAI
                self._openai_client = OpenAI(api_key=openai_api_key)
            except ImportError:
                print("⚠️ OpenAI no instalado. Usando modo local.")

    def start_session(self, topic: str, user_id: Optional[int] = None,
                      difficulty: str = "medium", 
                      bot_knowledge: Optional[Dict] = None) -> ChatResponse:
        """
        Inicia una nueva sesión de aprendizaje.
        
        Args:
            topic: Tema a aprender
            user_id: ID del usuario
            difficulty: Nivel inicial de dificultad
            bot_knowledge: Conocimiento del bot experto (si aplica)
        """
        self.cognitive_engine.reset()
        self.context = ChatContext(
            topic=topic,
            user_id=user_id,
            current_difficulty=DifficultyLevel(difficulty),
        )
        
        # Si hay conocimiento de bot experto, cargarlo
        if bot_knowledge:
            self.knowledge_base = bot_knowledge
            self.context.messages.append({
                "role": "system",
                "content": self._build_expert_system_prompt(bot_knowledge)
            })
        
        # Mensaje de bienvenida adaptado
        welcome = self._generate_welcome(topic, difficulty)
        
        self.context.messages.append({
            "role": "assistant",
            "content": welcome,
            "timestamp": datetime.utcnow().isoformat()
        })
        
        return ChatResponse(
            message=welcome,
            action=TeachingAction.TEACH,
            difficulty=self.context.current_difficulty,
            cognitive_state=CognitiveStateEnum.NORMAL,
            metadata={"session_started": True, "topic": topic},
            suggestions=[
                "Puedes preguntarme cualquier cosa sobre el tema",
                "Escribe 'ejemplo' para ver un caso práctico",
                "Escribe 'evaluar' para poner a prueba tu conocimiento",
            ]
        )

    async def process_message(self, user_message: str, 
                               response_time_ms: float = 0,
                               typing_speed_cpm: float = 0,
                               corrections: int = 0,
                               pause_before_ms: float = 0,
                               facial_data: Optional[Dict] = None,
                               voice_data: Optional[Dict] = None) -> ChatResponse:
        """
        Procesa un mensaje del usuario y genera respuesta adaptativa.
        
        Args:
            user_message: Mensaje del usuario
            response_time_ms: Tiempo que tardó en responder (ms)
            typing_speed_cpm: Velocidad de escritura (caracteres/min)
            corrections: Número de correcciones hechas
            pause_before_ms: Pausa antes de empezar a escribir (ms)
            facial_data: Datos de microexpresión facial (Patrón 3)
            voice_data: Datos de prosodia de voz (Patrón 4)
        """
        self.context.interaction_count += 1
        
        # 1. Registrar evento de comportamiento
        behavioral_event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=response_time_ms,
            typing_speed_cpm=typing_speed_cpm,
            correction_made=corrections > 0,
            pause_duration_ms=pause_before_ms,
            content_length=len(user_message),
            metadata={"corrections": corrections}
        )
        
        # 1b. Construir datos multimodales si están disponibles
        facial_obj = None
        if facial_data:
            try:
                emotion_str = facial_data.get("emotion", "neutral")
                emotion_enum = EmotionEnum(emotion_str) if emotion_str in [e.value for e in EmotionEnum] else EmotionEnum.NEUTRAL
                facial_obj = FacialData(
                    timestamp=datetime.utcnow(),
                    emotion=emotion_enum,
                    emotion_confidence=float(facial_data.get("emotion_confidence", 0.0)),
                    valence=float(facial_data.get("valence", 0.0)),
                    arousal=float(facial_data.get("arousal", 0.0)),
                    attention_score=float(facial_data.get("attention_score", 0.5)),
                    blink_rate=float(facial_data.get("blink_rate", 15.0)),
                    brow_furrow=float(facial_data.get("brow_furrow", 0.0)),
                    smile_intensity=float(facial_data.get("smile_intensity", 0.0)),
                    jaw_drop=float(facial_data.get("jaw_drop", 0.0)),
                    gaze_direction=facial_data.get("gaze_direction", "screen"),
                )
            except Exception:
                facial_obj = None

        voice_obj = None
        if voice_data:
            try:
                voice_obj = VoiceProsodyData(
                    timestamp=datetime.utcnow(),
                    pitch_mean_hz=float(voice_data.get("pitch_mean_hz", 0.0)),
                    pitch_variance=float(voice_data.get("pitch_variance", 0.0)),
                    volume_db=float(voice_data.get("volume_db", 0.0)),
                    volume_variance=float(voice_data.get("volume_variance", 0.0)),
                    speech_rate_wpm=float(voice_data.get("speech_rate_wpm", 0.0)),
                    voice_tremor=float(voice_data.get("voice_tremor", 0.0)),
                    energy_level=float(voice_data.get("energy_level", 0.0)),
                    emotion_confidence=float(voice_data.get("emotion_confidence", 0.0)),
                    filler_words_count=int(voice_data.get("filler_words_count", 0)),
                    silence_duration_ms=float(voice_data.get("silence_duration_ms", 0.0)),
                )
            except Exception:
                voice_obj = None
        
        # 2. Analizar estado cognitivo (multimodal si hay datos)
        if facial_obj or voice_obj:
            cognitive_result = self.cognitive_engine.add_multimodal_event(
                behavioral=behavioral_event,
                facial=facial_obj,
                voice=voice_obj,
                user_message=user_message,
            )
        else:
            cognitive_result = self.cognitive_engine.add_event(behavioral_event)
        self.context.cognitive_state = cognitive_result.state
        
        # 3. Decidir acción pedagógica
        action = self._decide_action(user_message, cognitive_result)
        
        # 4. Adaptar dificultad si es necesario
        if cognitive_result.should_adapt and cognitive_result.suggested_difficulty:
            new_difficulty = DifficultyLevel(cognitive_result.suggested_difficulty)
            self.context.current_difficulty = new_difficulty
        
        # 5. Detectar si el usuario respondió correctamente (si era quiz)
        if self.context.last_action == TeachingAction.QUIZ:
            self._evaluate_quiz_response(user_message)
        
        # 6. Guardar mensaje del usuario
        self.context.messages.append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.utcnow().isoformat(),
            "cognitive_state": cognitive_result.state.value,
            "response_time_ms": response_time_ms,
        })
        
        # 7. Generar respuesta
        response_text = await self._generate_response(user_message, action, cognitive_result)
        
        # 8. Guardar respuesta
        self.context.messages.append({
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow().isoformat(),
            "action": action.value,
        })
        
        self.context.last_action = action
        
        # 9. Verificar si se debe recomendar pausa
        should_pause = (
            cognitive_result.state == CognitiveStateEnum.FATIGUE
            and cognitive_result.confidence > 0.7
        )
        
        return ChatResponse(
            message=response_text,
            action=action,
            difficulty=self.context.current_difficulty,
            cognitive_state=cognitive_result.state,
            metadata={
                "cognitive_confidence": cognitive_result.confidence,
                "interaction_count": self.context.interaction_count,
                "cognitive_factors": cognitive_result.factors,
                "active_modalities": cognitive_result.active_modalities,
                "emotional_state": cognitive_result.emotional_state,
                "attention_level": cognitive_result.attention_level,
                "engagement_score": cognitive_result.engagement_score,
                "error_risk": cognitive_result.error_risk,
            },
            suggestions=cognitive_result.recommendations[:2],
            should_pause=should_pause,
        )

    def _decide_action(self, message: str, 
                        cognitive_result: CognitiveStateResult) -> TeachingAction:
        """
        Decide la acción pedagógica óptima basándose en múltiples factores.
        
        Esta es la lógica central que hace al chatbot INTELIGENTE:
        No solo responde, sino que DECIDE qué hacer.
        """
        state = cognitive_result.state
        confidence = cognitive_result.confidence
        
        # Comandos explícitos del usuario
        message_lower = message.lower().strip()
        if any(w in message_lower for w in ["ejemplo", "example", "muéstrame", "show me"]):
            return TeachingAction.EXAMPLE
        if any(w in message_lower for w in ["evaluar", "quiz", "test", "evalúame", "prueba"]):
            return TeachingAction.QUIZ
        if any(w in message_lower for w in ["resumen", "summary", "resume"]):
            return TeachingAction.SUMMARIZE
        
        # Decisiones basadas en estado cognitivo
        if state == CognitiveStateEnum.FATIGUE and confidence > 0.7:
            return TeachingAction.PAUSE
        
        if state == CognitiveStateEnum.OVERLOAD and confidence > 0.6:
            return TeachingAction.SIMPLIFY
        
        if state == CognitiveStateEnum.DOUBT:
            if self.context.consecutive_errors >= 2:
                return TeachingAction.SIMPLIFY
            return TeachingAction.REINFORCE
        
        if state == CognitiveStateEnum.MASTERY:
            if self.context.consecutive_correct >= 3:
                return TeachingAction.CHALLENGE
            return TeachingAction.QUIZ
        
        if state == CognitiveStateEnum.FLOW:
            # En flujo, mantener el ritmo actual
            return TeachingAction.TEACH
        
        # Lógica por patrones de interacción
        if self.context.consecutive_errors >= 3:
            return TeachingAction.REDIRECT
        
        if self.context.interaction_count % 5 == 0:
            # Cada 5 interacciones, hacer un quiz
            return TeachingAction.QUIZ
        
        if self.context.interaction_count % 10 == 0:
            # Cada 10 interacciones, motivar
            return TeachingAction.ENCOURAGE
        
        return TeachingAction.TEACH

    async def _generate_response(self, user_message: str, action: TeachingAction,
                                   cognitive_result: CognitiveStateResult) -> str:
        """
        Genera la respuesta del chatbot.
        Cadena: AIManager (Groq/Gemini) → OpenAI (legacy) → Local
        """
        # 1. Intentar con AIManager (Groq/Gemini gratuitos)
        if self.ai_manager:
            return await self._generate_with_ai_manager(user_message, action, cognitive_result)
        # 2. Fallback a OpenAI (legacy, si está configurado)
        elif self._openai_client:
            return await self._generate_with_openai(user_message, action, cognitive_result)
        # 3. Modo local (siempre funciona)
        else:
            return self._generate_local_response(user_message, action, cognitive_result)

    async def _generate_with_ai_manager(self, user_message: str, action: TeachingAction,
                                         cognitive_result: CognitiveStateResult) -> str:
        """Genera respuesta usando AIManager (Groq → Gemini → Local)"""
        # Construir system prompt pedagógico
        knowledge_context = ""
        if self.knowledge_base:
            contextual = self._search_knowledge(user_message, action)
            if contextual:
                knowledge_context = contextual

        system_prompt = self.ai_manager.build_tutor_system_prompt(
            topic=self.context.topic,
            difficulty=self.context.current_difficulty.value,
            cognitive_state=cognitive_result.state.value,
            knowledge_context=knowledge_context,
        )

        # Construir historial de contexto (últimos 10 mensajes)
        context_messages = []
        for msg in self.context.messages[-10:]:
            if msg["role"] in ("user", "assistant"):
                context_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        # Agregar instrucción de acción pedagógica
        action_instruction = self._get_action_instruction(action)
        enriched_prompt = f"[ACCIÓN PEDAGÓGICA: {action.value}] {action_instruction}\n\nMensaje del estudiante: {user_message}"

        # Llamar al AIManager
        result = await self.ai_manager.generate(
            prompt=enriched_prompt,
            system_prompt=system_prompt,
            context_messages=context_messages,
            temperature=0.7,
            max_tokens=1024,
        )

        if result["response"]:
            return result["response"]
        
        # Si la IA falló, usar respuesta local
        return self._generate_local_response(user_message, action, cognitive_result)

    def _get_action_instruction(self, action: TeachingAction) -> str:
        """Retorna instrucciones específicas para cada acción pedagógica"""
        instructions = {
            TeachingAction.TEACH: "Enseña un nuevo concepto paso a paso con ejemplos claros.",
            TeachingAction.REINFORCE: "Refuerza el concepto anterior desde otro ángulo o con otro ejemplo.",
            TeachingAction.QUIZ: "Haz una pregunta de evaluación sobre lo que se ha enseñado.",
            TeachingAction.EXAMPLE: "Muestra un ejemplo práctico y concreto del concepto.",
            TeachingAction.SIMPLIFY: "Simplifica la explicación, usa lenguaje más sencillo.",
            TeachingAction.CHALLENGE: "Presenta un desafío más avanzado para el estudiante.",
            TeachingAction.PAUSE: "Sugiere una pausa de descanso de forma amable.",
            TeachingAction.SUMMARIZE: "Resume los conceptos principales aprendidos hasta ahora.",
            TeachingAction.ENCOURAGE: "Motiva al estudiante, reconoce su esfuerzo y progreso.",
            TeachingAction.REDIRECT: "Cambia el enfoque a un subtema diferente o relacionado.",
        }
        return instructions.get(action, "Responde de forma pedagógica y adaptativa.")

    async def _generate_with_openai(self, user_message: str, action: TeachingAction,
                                      cognitive_result: CognitiveStateResult) -> str:
        """Genera respuesta usando la API de OpenAI"""
        system_prompt = self._build_adaptive_system_prompt(action, cognitive_result)
        
        messages = [{"role": "system", "content": system_prompt}]
        
        # Agregar contexto de la conversación (últimos 10 mensajes)
        for msg in self.context.messages[-10:]:
            messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        messages.append({"role": "user", "content": user_message})
        
        try:
            response = self._openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.7,
                max_tokens=1000,
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"Error con OpenAI: {e}")
            return self._generate_local_response(user_message, action, cognitive_result)

    def _generate_local_response(self, user_message: str, action: TeachingAction,
                                  cognitive_result: CognitiveStateResult) -> str:
        """
        Genera respuesta inteligente usando el conocimiento del bot experto.
        Busca en los datos de entrenamiento para dar respuestas REALES,
        no genéricas. Funciona sin conexión a APIs externas.
        """
        topic = self.context.topic
        difficulty = self.context.current_difficulty.value
        
        # Si tenemos conocimiento del bot, buscar respuesta contextual
        if self.knowledge_base:
            contextual = self._search_knowledge(user_message, action)
            if contextual:
                return contextual
        
        # Fallback: respuestas por acción (si no hay knowledge_base o no se encontró match)
        return self._fallback_response(action, topic, difficulty)

    def _search_knowledge(self, user_message: str, action: TeachingAction) -> Optional[str]:
        """
        Busca en el knowledge_base la respuesta más relevante al mensaje
        del usuario según la acción pedagógica decidida.
        """
        msg_lower = user_message.lower().strip()
        kb = self.knowledge_base
        topic = self.context.topic
        
        # ===== ACCIÓN: TEACH - Enseñar paso a paso =====
        if action == TeachingAction.TEACH:
            # Buscar en FAQ si la pregunta del usuario coincide
            faq_match = self._match_faq(msg_lower)
            if faq_match:
                return faq_match
            
            # Enseñar el siguiente paso del proceso
            steps = kb.get("steps", [])
            if steps and self._current_step_index < len(steps):
                step = steps[self._current_step_index]
                title = step.get("title", "")
                desc = step.get("description", "")
                details = step.get("details", "")
                tips = step.get("tips", [])
                errors = step.get("common_errors", [])
                is_critical = step.get("is_critical", False)
                
                response = f"📚 **{topic} - Paso {self._current_step_index + 1}: {title}**\n\n"
                response += f"{desc}\n\n"
                
                if details:
                    response += f"📝 **Detalle:** {details}\n\n"
                
                if is_critical:
                    response += f"⚠️ **¡PASO CRÍTICO!** Presta especial atención aquí.\n\n"
                
                if tips:
                    response += "💡 **Tips:**\n"
                    for tip in tips:
                        response += f"  • {tip}\n"
                    response += "\n"
                
                if errors:
                    response += "❌ **Errores comunes a evitar:**\n"
                    for err in errors:
                        response += f"  • {err}\n"
                    response += "\n"
                
                # Avanzar al siguiente paso
                self._current_step_index += 1
                self._topics_covered.append(title)
                
                remaining = len(steps) - self._current_step_index
                if remaining > 0:
                    response += f"📊 Quedan **{remaining}** pasos por cubrir. ¿Quieres continuar o tienes preguntas?"
                else:
                    response += "🎉 ¡Hemos cubierto todos los pasos! Escribe `evaluar` para poner a prueba tu conocimiento o `resumen` para repasar."
                
                return response
            
            # Si ya cubrimos todos los pasos, enseñar desde los tips/rules
            tips = kb.get("tips", [])
            rules = kb.get("rules", [])
            unused_tips = [t for t in tips if t not in self._topics_covered]
            
            if unused_tips:
                tip = unused_tips[0]
                self._topics_covered.append(tip)
                return (
                    f"💡 **Recomendación importante sobre {topic}:**\n\n"
                    f"{tip}\n\n"
                    f"¿Te queda claro? ¿Quieres un ejemplo o seguimos adelante?"
                )
            
            # Enseñar desde reglas
            unused_rules = [r for r in rules if r not in self._topics_covered]
            if unused_rules:
                rule = unused_rules[0]
                self._topics_covered.append(rule)
                return (
                    f"📋 **Regla importante en {topic}:**\n\n"
                    f"📌 {rule}\n\n"
                    f"Esta regla es fundamental para dominar el tema. ¿Alguna pregunta?"
                )
            
            return None  # Ir al fallback
        
        # ===== ACCIÓN: REINFORCE - Reforzar =====
        if action == TeachingAction.REINFORCE:
            faq_match = self._match_faq(msg_lower)
            if faq_match:
                return f"🔄 **Reforcemos este punto:**\n\n{faq_match}"
            
            # Repasar el último paso enseñado
            steps = kb.get("steps", [])
            if steps and self._current_step_index > 0:
                prev = steps[self._current_step_index - 1]
                return (
                    f"🔄 **Repasemos: {prev.get('title', '')}**\n\n"
                    f"{prev.get('description', '')}\n\n"
                    f"📝 {prev.get('details', 'Recuerda practicar este paso hasta que te sientas cómodo/a.')}\n\n"
                    f"¿Necesitas más claridad o avanzamos?"
                )
            return None
        
        # ===== ACCIÓN: QUIZ - Evaluar =====
        if action == TeachingAction.QUIZ:
            faq = kb.get("faq", [])
            steps = kb.get("steps", [])
            
            # Generar quiz desde Q&A
            unanswered = [qa for qa in faq if qa.get("question", "") not in self._topics_covered]
            if unanswered:
                qa = random.choice(unanswered)
                self.context.messages.append({
                    "role": "system",
                    "content": f"QUIZ_ANSWER:{qa['answer']}",
                    "timestamp": datetime.utcnow().isoformat(),
                })
                return (
                    f"🧪 **¡Momento de evaluación!**\n\n"
                    f"**Pregunta:** {qa['question']}\n\n"
                    f"Tómate tu tiempo para pensar y responde con tus propias palabras. 😊"
                )
            
            # Quiz desde pasos
            if steps and self._topics_covered:
                step = random.choice(steps)
                return (
                    f"🧪 **Evaluación:**\n\n"
                    f"Sobre el paso **\"{step.get('title', '')}\"**:\n"
                    f"**¿Puedes explicar en tus palabras qué se debe hacer y por qué es importante?**\n\n"
                    f"No te preocupes por ser perfecto/a, lo importante es que demuestres comprensión. 😊"
                )
            return None
        
        # ===== ACCIÓN: EXAMPLE - Ejemplo =====
        if action == TeachingAction.EXAMPLE:
            scenarios = kb.get("scenarios", [])
            steps = kb.get("steps", [])
            
            if scenarios:
                scenario = scenarios[0] if len(scenarios) == 1 else random.choice(scenarios)
                response = f"💡 **Ejemplo práctico: {scenario.get('title', '')}**\n\n"
                response += f"📋 {scenario.get('description', '')}\n\n"
                response += f"**Situación inicial:** {scenario.get('initial_situation', '')}\n\n"
                
                actions = scenario.get("expected_actions", [])
                if actions:
                    response += "**Pasos correctos:**\n"
                    for i, a in enumerate(actions, 1):
                        response += f"  {i}. {a}\n"
                    response += "\n"
                
                response += f"**Resultado esperado:** {scenario.get('correct_outcome', '')}\n\n"
                
                mistakes = scenario.get("common_mistakes", [])
                if mistakes:
                    response += "⚠️ **Errores comunes:**\n"
                    for m in mistakes:
                        response += f"  • {m}\n"
                    response += "\n"
                
                response += "¿Te gustaría intentarlo tú mismo/a? 🎯"
                return response
            
            # Ejemplo desde un paso
            if steps:
                step = steps[min(self._current_step_index, len(steps) - 1)]
                tips = step.get("tips", [])
                errors = step.get("common_errors", [])
                return (
                    f"💡 **Ejemplo sobre: {step.get('title', '')}**\n\n"
                    f"Veamos cómo se aplica en la práctica:\n\n"
                    f"**Lo que debes hacer:** {step.get('description', '')}\n"
                    f"**Detalle:** {step.get('details', 'Practica paso a paso.')}\n\n"
                    + (f"💡 **Tip:** {tips[0]}\n\n" if tips else "")
                    + (f"❌ **Evita:** {errors[0]}\n\n" if errors else "")
                    + "¿Quieres ver otro ejemplo o continuamos?"
                )
            return None
        
        # ===== ACCIÓN: SIMPLIFY - Simplificar =====
        if action == TeachingAction.SIMPLIFY:
            faq_match = self._match_faq(msg_lower)
            if faq_match:
                return (
                    f"🔽 **Vamos a simplificarlo:**\n\n"
                    f"{faq_match}\n\n"
                    f"Piénsalo así de simple. ¿Ahora tiene más sentido?"
                )
            
            steps = kb.get("steps", [])
            if steps and self._current_step_index > 0:
                prev = steps[self._current_step_index - 1]
                return (
                    f"🔽 **Simplifiquemos \"{prev.get('title', '')}\":**\n\n"
                    f"En resumen, lo único que necesitas hacer es:\n"
                    f"👉 {prev.get('description', '')}\n\n"
                    f"No te compliques con detalles por ahora. "
                    f"Lo importante es entender la idea general. ¿Ok?"
                )
            return None
        
        # ===== ACCIÓN: CHALLENGE - Desafío =====
        if action == TeachingAction.CHALLENGE:
            scenarios = kb.get("scenarios", [])
            if scenarios:
                s = random.choice(scenarios)
                return (
                    f"🚀 **¡Desafío avanzado!**\n\n"
                    f"**Escenario: {s.get('title', '')}**\n\n"
                    f"{s.get('initial_situation', '')}\n\n"
                    f"**Tu misión:** Explica paso a paso qué harías y por qué.\n"
                    f"Intenta considerar los posibles errores y cómo evitarlos.\n\n"
                    f"¡Confío en que puedes hacerlo! 💪"
                )
            return None
        
        # ===== ACCIÓN: SUMMARIZE - Resumen =====
        if action == TeachingAction.SUMMARIZE:
            steps = kb.get("steps", [])
            rules = kb.get("rules", [])
            warnings = kb.get("warnings", [])
            
            response = f"📋 **Resumen de {self.context.topic}:**\n\n"
            
            if steps:
                response += f"**Pasos del proceso ({len(steps)} total):**\n"
                for s in steps:
                    check = "✅" if s.get("title", "") in self._topics_covered else "⬜"
                    critical = " ⚠️CRÍTICO" if s.get("is_critical") else ""
                    response += f"  {check} {s.get('order', '?')}. {s.get('title', '')}{critical}\n"
                response += "\n"
            
            if warnings:
                response += "**⚠️ Advertencias:**\n"
                for w in warnings:
                    msg = w.get("message", w) if isinstance(w, dict) else w
                    response += f"  🔴 {msg}\n"
                response += "\n"
            
            if rules:
                response += "**📋 Reglas clave:**\n"
                for r in rules:
                    response += f"  📌 {r}\n"
                response += "\n"
            
            response += (
                f"\n📊 **Tu progreso:**\n"
                f"  • Interacciones: {self.context.interaction_count}\n"
                f"  • Nivel actual: {self.context.current_difficulty.value}\n"
                f"  • Temas cubiertos: {len(self._topics_covered)}\n"
                f"  • Pasos completados: {self._current_step_index}/{len(steps)}\n\n"
                f"¿Quieres repasar algo o continuamos? 😊"
            )
            return response
        
        # ===== ACCIÓN: PAUSE =====
        if action == TeachingAction.PAUSE:
            return (
                f"⏸️ **Momento de descanso recomendado**\n\n"
                f"He analizado tu comportamiento y noto señales de fatiga.\n"
                f"Es completamente normal después de concentrarte en **{self.context.topic}**.\n\n"
                f"📊 **Tu progreso hasta ahora:**\n"
                f"  • Pasos completados: {self._current_step_index}/{len(kb.get('steps', []))}\n"
                f"  • Interacciones: {self.context.interaction_count}\n\n"
                f"Te sugiero:\n"
                f"🔹 Descanso de 5-10 minutos\n"
                f"🔹 Hidratarte\n"
                f"🔹 Estirar un poco\n\n"
                f"Tu progreso está guardado. Cuando vuelvas, retomaremos en el paso {self._current_step_index + 1}. 😊"
            )
        
        # ENCOURAGE / REDIRECT
        if action == TeachingAction.ENCOURAGE:
            return (
                f"🌟 **¡Vas excelente!**\n\n"
                f"Llevas {self.context.interaction_count} interacciones aprendiendo "
                f"**{self.context.topic}** y ya cubriste {len(self._topics_covered)} temas.\n\n"
                f"Pasos completados: {self._current_step_index}/{len(kb.get('steps', []))}\n\n"
                f"Cada pregunta que haces te acerca más al dominio. ¡Sigue así! 💪🎯"
            )
        
        if action == TeachingAction.REDIRECT:
            warnings = kb.get("warnings", [])
            if warnings:
                w = warnings[0] if isinstance(warnings[0], str) else warnings[0].get("message", "")
                return (
                    f"↪️ **Cambiemos de enfoque un momento.**\n\n"
                    f"Antes de continuar, es importante que recuerdes:\n"
                    f"⚠️ {w}\n\n"
                    f"¿Qué parte te resulta más confusa? "
                    f"Así puedo adaptar mi explicación. 🎯"
                )
        
        return None  # Ir al fallback

    def _match_faq(self, user_message_lower: str) -> Optional[str]:
        """Busca en el FAQ del bot la pregunta más relevante"""
        if not self.knowledge_base:
            return None
        
        faq = self.knowledge_base.get("faq", [])
        if not faq:
            return None
        
        best_match = None
        best_score = 0
        
        # Tokenizar la pregunta del usuario
        user_words = set(user_message_lower.split())
        # Remover palabras muy comunes
        stop_words = {"que", "qué", "es", "un", "una", "el", "la", "los", "las", "de", "del",
                      "en", "para", "por", "como", "cómo", "se", "a", "y", "o", "no", "si",
                      "me", "te", "lo", "le", "nos", "con", "al", "su", "mi", "tu", "yo",
                      "hay", "son", "ser", "esta", "este", "eso", "esa", "más", "muy", "ya"}
        user_words = user_words - stop_words
        
        for qa in faq:
            question = qa.get("question", "").lower()
            question_words = set(question.split()) - stop_words
            
            if not question_words or not user_words:
                continue
            
            # Calcular similitud por palabras compartidas
            common = user_words & question_words
            score = len(common) / max(len(user_words | question_words), 1)
            
            # Bonus si la pregunta del usuario está contenida en la FAQ o viceversa
            if user_message_lower in question or question in user_message_lower:
                score += 0.5
            
            # Bonus por palabras clave exactas
            for word in user_words:
                if len(word) > 3 and word in question:
                    score += 0.15
            
            if score > best_score and score > 0.2:
                best_score = score
                best_match = qa
        
        if best_match:
            return (
                f"📖 **{best_match.get('question', '')}**\n\n"
                f"{best_match.get('answer', '')}\n\n"
                f"¿Esto responde tu pregunta o necesitas más detalle?"
            )
        
        return None

    def _fallback_response(self, action: TeachingAction, topic: str, difficulty: str) -> str:
        """Respuestas de respaldo cuando no hay conocimiento específico"""
        responses = {
            TeachingAction.TEACH: [
                f"📚 Sobre **{topic}**:\n\n"
                f"Vamos a explorar este concepto paso a paso. "
                f"En nivel {difficulty}, lo importante es entender que...\n\n"
                f"El concepto clave aquí es comprender la relación entre los elementos fundamentales. "
                f"¿Te gustaría que profundicemos en algún aspecto específico?",
                
                f"🎓 Continuemos con **{topic}**:\n\n"
                f"Un punto importante que debes recordar es que este tema se conecta "
                f"con lo que hemos visto anteriormente. La clave está en la práctica constante.\n\n"
                f"¿Quieres que te muestre un ejemplo práctico o prefieres que avancemos?",
            ],
            
            TeachingAction.REINFORCE: [
                f"🔄 Reforcemos lo aprendido sobre **{topic}**:\n\n"
                f"Recuerda los puntos clave que hemos cubierto:\n"
                f"1. Los fundamentos básicos del tema\n"
                f"2. Cómo se aplican en la práctica\n"
                f"3. Los errores más comunes a evitar\n\n"
                f"¿Hay algún punto que te gustaría repasar?",
            ],
            
            TeachingAction.QUIZ: [
                f"🧪 ¡Momento de evaluación!\n\n"
                f"Basándome en lo que hemos aprendido sobre **{topic}**, "
                f"responde la siguiente pregunta:\n\n"
                f"**¿Cuáles son los elementos principales que hemos discutido "
                f"y cómo se relacionan entre sí?**\n\n"
                f"Tómate tu tiempo para pensar. No hay prisa. 😊",
            ],
            
            TeachingAction.EXAMPLE: [
                f"💡 Aquí tienes un ejemplo práctico de **{topic}**:\n\n"
                f"Imagina un escenario real donde necesitas aplicar este concepto...\n\n"
                f"**Caso práctico:**\n"
                f"Situación: Tienes que resolver un problema relacionado con {topic}\n"
                f"Pasos a seguir:\n"
                f"1. Identificar el problema central\n"
                f"2. Aplicar los conceptos aprendidos\n"
                f"3. Verificar el resultado\n\n"
                f"¿Te queda más claro con este ejemplo?",
            ],
            
            TeachingAction.SIMPLIFY: [
                f"🔽 Vamos a simplificar **{topic}**:\n\n"
                f"Pensemos en esto de manera más sencilla. "
                f"En esencia, {topic} se trata de...\n\n"
                f"Imagínalo como algo cotidiano: "
                f"es como cuando organizas tus cosas en casa, "
                f"cada elemento tiene su lugar y su función.\n\n"
                f"¿Esto te ayuda a entender mejor?",
            ],
            
            TeachingAction.CHALLENGE: [
                f"🚀 ¡Excelente progreso! Subamos el nivel:\n\n"
                f"Ya que dominas los conceptos básicos de **{topic}**, "
                f"vamos a explorar un aspecto más avanzado.\n\n"
                f"**Desafío:** Intenta explicar cómo se aplica este concepto "
                f"en un escenario complejo donde hay múltiples variables.\n\n"
                f"¡Confío en que puedes hacerlo! 💪",
            ],
            
            TeachingAction.PAUSE: [
                f"⏸️ **Momento de descanso recomendado**\n\n"
                f"He notado que tu rendimiento ha cambiado. "
                f"Es completamente normal después de un período de concentración.\n\n"
                f"Te sugiero:\n"
                f"🔹 Tomar un descanso de 5-10 minutos\n"
                f"🔹 Hidratarte\n"
                f"🔹 Estirar un poco\n\n"
                f"Cuando vuelvas, retomaremos desde donde nos quedamos. "
                f"Tu progreso está guardado. 😊",
            ],
            
            TeachingAction.SUMMARIZE: [
                f"📋 **Resumen de lo aprendido sobre {topic}:**\n\n"
                f"Durante esta sesión hemos cubierto:\n"
                f"✅ Conceptos fundamentales\n"
                f"✅ Aplicaciones prácticas\n"
                f"✅ Errores comunes a evitar\n\n"
                f"Interacciones totales: {self.context.interaction_count}\n"
                f"Nivel actual: {difficulty}\n\n"
                f"¿Quieres continuar aprendiendo o revisamos algo?",
            ],
            
            TeachingAction.ENCOURAGE: [
                f"🌟 ¡Vas muy bien!\n\n"
                f"Llevas {self.context.interaction_count} interacciones "
                f"aprendiendo sobre **{topic}** y tu progreso es notable.\n\n"
                f"Recuerda: cada pregunta que haces te acerca más al dominio. "
                f"¡Sigue así! 💪🎯",
            ],
            
            TeachingAction.REDIRECT: [
                f"↪️ Cambiemos de enfoque un momento.\n\n"
                f"Noto que este aspecto de **{topic}** puede ser desafiante. "
                f"Intentemos abordarlo desde otro ángulo.\n\n"
                f"¿Qué parte te resulta más confusa? "
                f"Así puedo adaptar mi explicación a lo que necesitas. 🎯",
            ],
        }
        
        options = responses.get(action, responses[TeachingAction.TEACH])
        return random.choice(options)

    def _build_adaptive_system_prompt(self, action: TeachingAction,
                                       cognitive_result: CognitiveStateResult) -> str:
        """Construye el prompt del sistema adaptado al estado actual"""
        return f"""Eres un tutor inteligente especializado en "{self.context.topic}".

ESTADO ACTUAL DEL ESTUDIANTE:
- Estado cognitivo detectado: {cognitive_result.state.value}
- Confianza en la detección: {cognitive_result.confidence}
- Nivel de dificultad actual: {self.context.current_difficulty.value}
- Interacciones en esta sesión: {self.context.interaction_count}
- Errores consecutivos: {self.context.consecutive_errors}
- Aciertos consecutivos: {self.context.consecutive_correct}

ACCIÓN PEDAGÓGICA DECIDIDA: {action.value}

INSTRUCCIONES SEGÚN LA ACCIÓN:
- Si es TEACH: Enseña un nuevo concepto de forma clara y adaptada al nivel.
- Si es REINFORCE: Refuerza lo ya aprendido con diferentes perspectivas.
- Si es QUIZ: Haz una pregunta evaluativa apropiada al nivel.
- Si es EXAMPLE: Proporciona un ejemplo práctico y contextualizado.
- Si es SIMPLIFY: Simplifica la explicación, usa analogías cotidianas.
- Si es CHALLENGE: Presenta un desafío más avanzado.
- Si es PAUSE: Recomienda amablemente un descanso.
- Si es SUMMARIZE: Resume lo aprendido hasta ahora.
- Si es ENCOURAGE: Motiva al estudiante.
- Si es REDIRECT: Cambia el enfoque para abordar el tema diferente.

REGLAS:
1. Adapta tu lenguaje al nivel de dificultad.
2. Sé empático y paciente.
3. Usa emojis moderadamente para hacer la interacción amigable.
4. Si detectas fatiga, sé breve y sugiere descanso.
5. Si detectas dominio, desafía al estudiante.
6. Siempre termina con una pregunta o invitación a interactuar.
7. Responde en español.
"""

    def _build_expert_system_prompt(self, knowledge: Dict) -> str:
        """Construye el prompt del sistema basado en conocimiento experto"""
        parts = [
            f"Eres un tutor experto con el siguiente conocimiento especializado:\n"
        ]
        
        if knowledge.get("steps"):
            parts.append("PASOS DEL PROCESO:")
            for i, step in enumerate(knowledge["steps"], 1):
                parts.append(f"  {i}. {step}")
        
        if knowledge.get("warnings"):
            parts.append("\n⚠️ ADVERTENCIAS CRÍTICAS:")
            for w in knowledge["warnings"]:
                parts.append(f"  - {w}")
        
        if knowledge.get("rules"):
            parts.append("\n📋 REGLAS OPERATIVAS:")
            for r in knowledge["rules"]:
                parts.append(f"  - {r}")
        
        if knowledge.get("tips"):
            parts.append("\n💡 RECOMENDACIONES:")
            for t in knowledge["tips"]:
                parts.append(f"  - {t}")
        
        if knowledge.get("faq"):
            parts.append("\n❓ PREGUNTAS FRECUENTES:")
            for qa in knowledge["faq"]:
                parts.append(f"  P: {qa.get('question', '')}")
                parts.append(f"  R: {qa.get('answer', '')}")
        
        return "\n".join(parts)

    def _evaluate_quiz_response(self, response: str):
        """Evalúa la respuesta del usuario a un quiz (lógica básica)"""
        # En la versión con OpenAI, esto se evaluaría de forma más sofisticada
        # Aquí usamos heurísticas simples
        response_length = len(response.strip())
        
        if response_length < 10:
            # Respuesta muy corta, probablemente incorrecta o evasiva
            self.context.consecutive_errors += 1
            self.context.consecutive_correct = 0
        elif response_length > 50:
            # Respuesta elaborada, probablemente correcta
            self.context.consecutive_correct += 1
            self.context.consecutive_errors = 0
        
        self.context.quiz_results.append({
            "response": response,
            "length": response_length,
            "timestamp": datetime.utcnow().isoformat(),
            "cognitive_state": self.context.cognitive_state.value,
        })

    def _generate_welcome(self, topic: str, difficulty: str) -> str:
        """Genera un mensaje de bienvenida personalizado"""
        return (
            f"👋 ¡Hola! Soy tu tutor inteligente de **NeuroLearn AI**.\n\n"
            f"Vamos a aprender sobre **{topic}** juntos. "
            f"He configurado el nivel inicial en **{difficulty}**, "
            f"pero lo ajustaré automáticamente según tu progreso.\n\n"
            f"🧠 **¿Cómo funciono?**\n"
            f"- Analizo tu comportamiento digital para entender tu estado cognitivo\n"
            f"- Adapto la dificultad y el estilo de enseñanza en tiempo real\n"
            f"- Te recomiendo pausas cuando detecto fatiga\n"
            f"- Te desafío cuando veo que dominas el tema\n\n"
            f"📝 **Comandos útiles:**\n"
            f"- `ejemplo` - Ver un caso práctico\n"
            f"- `evaluar` - Poner a prueba tu conocimiento\n"
            f"- `resumen` - Ver un resumen de lo aprendido\n\n"
            f"¿Estás listo/a para comenzar? ¿Qué sabes ya sobre **{topic}**? 😊"
        )

    def get_session_stats(self) -> Dict:
        """Retorna estadísticas de la sesión actual"""
        cognitive_profile = self.cognitive_engine.get_cognitive_profile()
        
        return {
            "topic": self.context.topic,
            "difficulty": self.context.current_difficulty.value,
            "interactions": self.context.interaction_count,
            "cognitive_state": self.context.cognitive_state.value,
            "concepts_taught": len(self.context.concepts_taught),
            "concepts_mastered": len(self.context.concepts_mastered),
            "quiz_results": len(self.context.quiz_results),
            "consecutive_errors": self.context.consecutive_errors,
            "consecutive_correct": self.context.consecutive_correct,
            "cognitive_profile": cognitive_profile,
            "duration_minutes": (datetime.utcnow() - self.context.started_at).total_seconds() / 60,
        }
