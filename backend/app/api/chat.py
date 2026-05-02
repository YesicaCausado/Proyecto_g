"""
NeuroLearn AI - API de Chat / Modo Aprender
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Dict, Optional

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.schemas.schemas import (
    StartSessionRequest,
    ChatMessageRequest,
    ChatMessageResponse,
    SessionStatsResponse,
)
from app.ai.chatbot.adaptive_chatbot import AdaptiveChatbot
from app.ai.providers.ai_manager import AIManager
from app.core.config import settings

router = APIRouter(prefix="/chat", tags=["Chat Adaptativo"])

# Almacén de sesiones activas (en producción usar Redis)
active_sessions: Dict[int, AdaptiveChatbot] = {}

# Crear instancia global del AIManager (Groq → Gemini → Local)
ai_manager = AIManager(
    groq_api_key=settings.GROQ_API_KEY,
    groq_model=settings.GROQ_MODEL,
    gemini_api_key=settings.GEMINI_API_KEY,
    gemini_model=settings.GEMINI_MODEL,
)


@router.post("/start", response_model=ChatMessageResponse)
async def start_session(
    request: StartSessionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Inicia una nueva sesión de aprendizaje adaptativo.
    
    El chatbot:
    - Se configura con el tema seleccionado
    - Establece la dificultad inicial
    - Si se especifica un bot_id, carga su conocimiento
    - Comienza a monitorear el comportamiento del usuario
    """
    # Crear instancia del chatbot con AIManager
    chatbot = AdaptiveChatbot(
        openai_api_key=settings.OPENAI_API_KEY,
        ai_manager=ai_manager,
    )
    
    # Cargar conocimiento del bot experto si se especificó
    bot_knowledge = None
    if request.bot_id:
        from app.models.expert_bot import ExpertBot
        bot = db.query(ExpertBot).filter(ExpertBot.id == request.bot_id).first()
        if bot:
            bot_knowledge = bot.knowledge_base
    
    # Iniciar sesión
    response = chatbot.start_session(
        topic=request.topic,
        user_id=current_user.id,
        difficulty=request.difficulty,
        bot_knowledge=bot_knowledge,
    )
    
    # Guardar sesión activa
    active_sessions[current_user.id] = chatbot
    
    return ChatMessageResponse(
        message=response.message,
        action=response.action.value,
        difficulty=response.difficulty.value,
        cognitive_state=response.cognitive_state.value,
        suggestions=response.suggestions,
        should_pause=response.should_pause,
        metadata=response.metadata,
    )


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Envía un mensaje al chatbot adaptativo.
    
    Incluye métricas de comportamiento:
    - response_time_ms: Tiempo que tardó el usuario en responder
    - typing_speed_cpm: Velocidad de escritura
    - corrections: Número de correcciones realizadas
    - pause_before_ms: Pausa antes de empezar a escribir
    
    El sistema usa estas métricas para inferir el estado cognitivo.
    """
    chatbot = active_sessions.get(current_user.id)
    if not chatbot:
        raise HTTPException(
            status_code=404,
            detail="No hay sesión de aprendizaje activa. Inicia una con /chat/start"
        )
    
    # Procesar mensaje
    response = await chatbot.process_message(
        user_message=request.message,
        response_time_ms=request.response_time_ms,
        typing_speed_cpm=request.typing_speed_cpm,
        corrections=request.corrections,
        pause_before_ms=request.pause_before_ms,
        facial_data=request.facial_data,
        voice_data=request.voice_data,
    )
    
    return ChatMessageResponse(
        message=response.message,
        action=response.action.value,
        difficulty=response.difficulty.value,
        cognitive_state=response.cognitive_state.value,
        confidence=response.metadata.get("cognitive_confidence", 0),
        suggestions=response.suggestions,
        should_pause=response.should_pause,
        metadata=response.metadata,
        emotional_state=response.metadata.get("emotional_state"),
        attention_level=response.metadata.get("attention_level", 1.0),
        engagement_score=response.metadata.get("engagement_score", 0.5),
        error_risk=response.metadata.get("error_risk", 0.0),
        active_modalities=response.metadata.get("active_modalities", []),
    )


@router.get("/stats", response_model=SessionStatsResponse)
async def get_session_stats(
    current_user: User = Depends(get_current_user),
):
    """Obtiene las estadísticas de la sesión de aprendizaje actual"""
    chatbot = active_sessions.get(current_user.id)
    if not chatbot:
        raise HTTPException(status_code=404, detail="No hay sesión activa")
    
    stats = chatbot.get_session_stats()
    return SessionStatsResponse(**stats)


@router.post("/end")
async def end_session(
    current_user: User = Depends(get_current_user),
):
    """Finaliza la sesión de aprendizaje actual"""
    chatbot = active_sessions.pop(current_user.id, None)
    if not chatbot:
        raise HTTPException(status_code=404, detail="No hay sesión activa")
    
    stats = chatbot.get_session_stats()
    return {
        "message": "Sesión de aprendizaje finalizada",
        "stats": stats,
    }
