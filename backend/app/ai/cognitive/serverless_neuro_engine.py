"""
🧠 NeuroLearn AI - Motor Neuroconductual SERVERLESS (Optimizado para Vercel)

Versión STATELESS y ULTRA-RÁPIDA del análisis multimodal.
No usa numpy/scipy pesados - solo lógica heurística eficiente.

Procesa datos de UNA SOLA REQUEST sin historial persistente.
"""
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass


@dataclass
class QuickAnalysisInput:
    """Datos de entrada para análisis rápido"""
    # Comportamiento
    response_time_ms: float = 0.0
    typing_speed_cpm: int = 0
    corrections: int = 0
    pause_before_ms: float = 0.0
    
    # Facial (si está disponible)
    emotion: Optional[str] = None
    attention_score: float = 0.5
    blink_rate: float = 0.0
    
    # Voz (si está disponible)
    pitch_mean_hz: float = 0.0
    volume_db: float = 0.0
    speech_rate_wpm: float = 0.0
    filler_words_count: int = 0
    
    # Contexto
    is_correct_answer: Optional[bool] = None
    difficulty_level: str = "medium"


class ServerlessNeuroEngine:
    """
    Motor neuroconductual serverless - sin estado, ultra rápido.
    Análisis heurístico basado en umbrales calibrados.
    """
    
    def __init__(
        self,
        fatigue_threshold: float = 0.7,
        overload_threshold: float = 0.6,
        doubt_threshold: float = 0.5,
        mastery_threshold: float = 0.8,
    ):
        self.fatigue_threshold = fatigue_threshold
        self.overload_threshold = overload_threshold
        self.doubt_threshold = doubt_threshold
        self.mastery_threshold = mastery_threshold
    
    def analyze(self, data: QuickAnalysisInput) -> Dict[str, Any]:
        """
        Análisis ultra-rápido de estado cognitivo.
        
        Returns:
            {
                "state": str,  # normal, fatigue, overload, doubt, mastery, flow, frustration, curiosity
                "confidence": float,  # 0.0 - 1.0
                "active_modalities": List[str],  # qué datos se usaron
                "error_risk": float,  # 0.0 - 1.0
                "quiz_recommended": bool,
                "reasoning": str  # explicación breve
            }
        """
        
        signals = []
        active_modalities = []
        
        # ══════════════════════════════════════════════════════
        # 1️⃣ ANÁLISIS DE COMPORTAMIENTO (siempre disponible)
        # ══════════════════════════════════════════════════════
        if data.response_time_ms > 0:
            active_modalities.append("behavioral")
            
            # Respuesta muy lenta + pausas largas = FATIGA o DUDA
            if data.response_time_ms > 8000 and data.pause_before_ms > 3000:
                signals.append(("fatigue", 0.7))
                
            # Respuesta lenta + muchas correcciones = DUDA
            elif data.response_time_ms > 5000 and data.corrections >= 3:
                signals.append(("doubt", 0.8))
                
            # Respuesta muy rápida + sin correcciones = DOMINIO
            elif data.response_time_ms < 2000 and data.corrections == 0:
                signals.append(("mastery", 0.75))
                
            # Velocidad de escritura muy baja = SOBRECARGA o FATIGA
            if data.typing_speed_cpm > 0 and data.typing_speed_cpm < 60:
                signals.append(("overload", 0.6))
        
        # ══════════════════════════════════════════════════════
        # 2️⃣ ANÁLISIS FACIAL (si está disponible)
        # ══════════════════════════════════════════════════════
        if data.emotion:
            active_modalities.append("facial")
            
            emotion_map = {
                "confused": ("doubt", 0.85),
                "frustrated": ("frustration", 0.9),
                "bored": ("fatigue", 0.7),
                "focused": ("flow", 0.8),
                "happy": ("mastery", 0.7),
                "surprised": ("curiosity", 0.8),
            }
            
            if data.emotion.lower() in emotion_map:
                signals.append(emotion_map[data.emotion.lower()])
            
            # Atención muy baja = FATIGA
            if data.attention_score < 0.3:
                signals.append(("fatigue", 0.75))
            
            # Atención muy alta = FLUJO
            elif data.attention_score > 0.8:
                signals.append(("flow", 0.7))
            
            # Parpadeo excesivo = SOBRECARGA
            if data.blink_rate > 25:  # >25 parpadeos/min
                signals.append(("overload", 0.65))
        
        # ══════════════════════════════════════════════════════
        # 3️⃣ ANÁLISIS DE VOZ (si está disponible)
        # ══════════════════════════════════════════════════════
        if data.speech_rate_wpm > 0:
            active_modalities.append("voice")
            
            # Habla muy rápida = ANSIEDAD/SOBRECARGA
            if data.speech_rate_wpm > 180:
                signals.append(("overload", 0.7))
            
            # Habla muy lenta = FATIGA o DUDA
            elif data.speech_rate_wpm < 100:
                signals.append(("doubt", 0.65))
            
            # Muchas muletillas (um, eh, este...) = DUDA
            if data.filler_words_count >= 5:
                signals.append(("doubt", 0.75))
            
            # Volumen muy bajo = FATIGA o DESMOTIVACIÓN
            if data.volume_db > 0 and data.volume_db < 45:
                signals.append(("fatigue", 0.6))
        
        # ══════════════════════════════════════════════════════
        # 4️⃣ ANÁLISIS DE DECISIÓN (respuestas correctas/incorrectas)
        # ══════════════════════════════════════════════════════
        if data.is_correct_answer is not None:
            active_modalities.append("decision")
            
            if data.is_correct_answer:
                # Respuesta correcta rápida = DOMINIO
                if data.response_time_ms < 3000:
                    signals.append(("mastery", 0.8))
                # Respuesta correcta lenta = DUDA pero eventual comprensión
                elif data.response_time_ms > 7000:
                    signals.append(("curiosity", 0.6))
            else:
                # Respuesta incorrecta rápida = IMPULSIVIDAD/SOBRECARGA
                if data.response_time_ms < 2000:
                    signals.append(("overload", 0.75))
                # Respuesta incorrecta lenta = CONFUSIÓN
                else:
                    signals.append(("frustration", 0.7))
        
        # ══════════════════════════════════════════════════════
        # 5️⃣ FUSIÓN DE SEÑALES (promedio ponderado simple)
        # ══════════════════════════════════════════════════════
        if not signals:
            # Sin datos suficientes
            return {
                "state": "normal",
                "confidence": 0.5,
                "active_modalities": active_modalities,
                "error_risk": 0.3,
                "quiz_recommended": False,
                "reasoning": "Datos insuficientes para análisis profundo"
            }
        
        # Contar votos por estado
        state_votes: Dict[str, List[float]] = {}
        for state, confidence in signals:
            if state not in state_votes:
                state_votes[state] = []
            state_votes[state].append(confidence)
        
        # Calcular estado ganador (promedio de confianzas)
        state_scores = {
            state: sum(confs) / len(confs)
            for state, confs in state_votes.items()
        }
        
        inferred_state = max(state_scores, key=state_scores.get)
        confidence = state_scores[inferred_state]
        
        # ══════════════════════════════════════════════════════
        # 6️⃣ PREDICCIÓN DE ERROR Y RECOMENDACIÓN DE QUIZ
        # ══════════════════════════════════════════════════════
        error_risk = 0.0
        quiz_recommended = False
        
        if inferred_state in ["fatigue", "overload", "frustration"]:
            error_risk = 0.7 + (confidence * 0.3)
            quiz_recommended = True  # Quiz para reforzar antes de que falle
            
        elif inferred_state in ["doubt", "curiosity"]:
            error_risk = 0.5
            quiz_recommended = True  # Quiz para aclarar dudas
            
        elif inferred_state in ["mastery", "flow"]:
            error_risk = 0.1
            quiz_recommended = False  # No interrumpir el flujo
        
        reasoning = self._generate_reasoning(inferred_state, active_modalities, data)
        
        return {
            "state": inferred_state,
            "confidence": round(confidence, 2),
            "active_modalities": active_modalities,
            "error_risk": round(error_risk, 2),
            "quiz_recommended": quiz_recommended,
            "reasoning": reasoning
        }
    
    def _generate_reasoning(
        self, state: str, modalities: List[str], data: QuickAnalysisInput
    ) -> str:
        """Genera explicación breve del análisis"""
        
        reasons = []
        
        if "behavioral" in modalities:
            if data.response_time_ms > 6000:
                reasons.append("respuesta lenta")
            if data.corrections >= 3:
                reasons.append("muchas correcciones")
        
        if "facial" in modalities:
            if data.emotion:
                reasons.append(f"emoción: {data.emotion}")
            if data.attention_score < 0.4:
                reasons.append("atención baja")
        
        if "voice" in modalities:
            if data.filler_words_count >= 5:
                reasons.append("muletillas frecuentes")
        
        if "decision" in modalities:
            if data.is_correct_answer is False:
                reasons.append("respuesta incorrecta")
        
        reason_text = ", ".join(reasons) if reasons else "análisis multimodal"
        
        state_descriptions = {
            "fatigue": "Fatiga detectada",
            "overload": "Sobrecarga cognitiva",
            "doubt": "Duda e incertidumbre",
            "mastery": "Dominio del tema",
            "flow": "Estado de flujo óptimo",
            "frustration": "Frustración detectada",
            "curiosity": "Curiosidad activa",
            "normal": "Estado normal"
        }
        
        return f"{state_descriptions.get(state, state)} ({reason_text})"


# ══════════════════════════════════════════════════════════════
# FUNCIÓN DE UTILIDAD PARA CONVERTIR REQUEST A INPUT
# ══════════════════════════════════════════════════════════════

def build_analysis_input_from_request(request: Any) -> QuickAnalysisInput:
    """
    Convierte ChatMessageRequest a QuickAnalysisInput.
    
    Args:
        request: ChatMessageRequest de FastAPI
        
    Returns:
        QuickAnalysisInput con los datos extraídos
    """
    
    return QuickAnalysisInput(
        # Comportamiento
        response_time_ms=getattr(request, 'response_time_ms', 0.0),
        typing_speed_cpm=getattr(request, 'typing_speed_cpm', 0),
        corrections=getattr(request, 'corrections', 0),
        pause_before_ms=getattr(request, 'pause_before_ms', 0.0),
        
        # Facial
        emotion=request.facial_data.get("emotion") if hasattr(request, 'facial_data') and request.facial_data else None,
        attention_score=request.facial_data.get("attention_score", 0.5) if hasattr(request, 'facial_data') and request.facial_data else 0.5,
        blink_rate=request.facial_data.get("blink_rate", 0.0) if hasattr(request, 'facial_data') and request.facial_data else 0.0,
        
        # Voz
        pitch_mean_hz=request.voice_data.get("pitch_mean_hz", 0.0) if hasattr(request, 'voice_data') and request.voice_data else 0.0,
        volume_db=request.voice_data.get("volume_db", 0.0) if hasattr(request, 'voice_data') and request.voice_data else 0.0,
        speech_rate_wpm=request.voice_data.get("speech_rate_wpm", 0.0) if hasattr(request, 'voice_data') and request.voice_data else 0.0,
        filler_words_count=request.voice_data.get("filler_words_count", 0) if hasattr(request, 'voice_data') and request.voice_data else 0,
        
        # Contexto
        is_correct_answer=getattr(request, 'is_correct_answer', None),
        difficulty_level=getattr(request, 'difficulty_level', 'medium'),
    )
