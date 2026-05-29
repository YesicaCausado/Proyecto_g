"""
🧠 NeuroLearn AI - Motor Multimodal de Inferencia Neuroconductual Digital

Implementa los 5 PATRONES NEUROCONDUCTUALES DIGITALES:

  ┌─────────────────────────────────────────────────────┐
  │         MODELO MULTIMODAL DE INFERENCIA              │
  │                  COGNITIVA                           │
  │                                                     │
  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
  │  │  Ritmo   │  │Secuencia │  │ Microexpresión   │  │
  │  │  de      │  │  de      │  │    Facial        │  │
  │  │Interacc. │  │Decisión  │  │                  │  │
  │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘  │
  │       │             │                 │             │
  │  ┌────┴─────┐  ┌────┴─────┐          │             │
  │  │Prosodia  │  │Patrón    │          │             │
  │  │  de Voz  │  │Predictivo│          │             │
  │  │          │  │ de Error │          │             │
  │  └────┬─────┘  └────┬─────┘          │             │
  │       │             │                 │             │
  │       └──────┬──────┴────────┬────────┘             │
  │              │               │                      │
  │         ┌────▼───────────────▼────┐                 │
  │         │   FUSIÓN BAYESIANA      │                 │
  │         │   MULTIMODAL            │                 │
  │         └────────────┬────────────┘                 │
  │                      │                              │
  │              ┌───────▼───────┐                      │
  │              │ ESTADO        │                      │
  │              │ COGNITIVO     │                      │
  │              │ INFERIDO      │                      │
  │              └───────────────┘                      │
  └─────────────────────────────────────────────────────┘

Estados Cognitivos:
  - Normal      : Concentración base
  - Fatiga      : Deterioro progresivo
  - Sobrecarga  : Exceso de complejidad  
  - Duda        : Incertidumbre
  - Dominio     : Alto nivel de comprensión
  - Flujo       : Estado óptimo
  - Frustración : Estado emocional negativo
  - Curiosidad  : Exploración activa
"""
import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import deque
import math


# =============================================================================
# ENUMS
# =============================================================================

class CognitiveStateEnum(str, Enum):
    NORMAL = "normal"
    FATIGUE = "fatigue"
    OVERLOAD = "overload"
    DOUBT = "doubt"
    MASTERY = "mastery"
    FLOW = "flow"
    FRUSTRATION = "frustration"
    CURIOSITY = "curiosity"


class EmotionEnum(str, Enum):
    """Emociones detectables por microexpresiones y prosodia"""
    NEUTRAL = "neutral"
    HAPPY = "happy"
    SAD = "sad"
    ANGRY = "angry"
    SURPRISED = "surprised"
    FEARFUL = "fearful"
    DISGUSTED = "disgusted"
    CONFUSED = "confused"
    FOCUSED = "focused"
    BORED = "bored"


class ModalityType(str, Enum):
    """Los 5 canales de datos neuroconductuales"""
    INTERACTION_RHYTHM = "interaction_rhythm"
    DECISION_SEQUENCE = "decision_sequence"
    FACIAL_MICROEXPRESSION = "facial_microexpression"
    VOICE_PROSODY = "voice_prosody"
    ERROR_PREDICTION = "error_prediction"


# =============================================================================
# DATACLASSES DE ENTRADA
# =============================================================================

@dataclass
class BehavioralEvent:
    """Evento de comportamiento digital (Patrón 1: Ritmo de Interacción)"""
    timestamp: datetime
    event_type: str  # response, click, keystroke, scroll, pause, correction
    response_time_ms: float = 0.0
    typing_speed_cpm: float = 0.0
    error_occurred: bool = False
    correction_made: bool = False
    pause_duration_ms: float = 0.0
    content_length: int = 0
    metadata: dict = field(default_factory=dict)


@dataclass
class DecisionEvent:
    """Evento de decisión del usuario (Patrón 2: Secuencia de Decisión)"""
    timestamp: datetime
    decision_type: str  # answer, choice, skip, change, undo, retry
    original_answer: Optional[str] = None
    final_answer: Optional[str] = None
    changes_count: int = 0
    time_to_decide_ms: float = 0.0
    confidence_indicator: float = 0.0
    depth_of_response: int = 0
    is_correct: Optional[bool] = None
    hesitation_pauses: int = 0
    backspace_count: int = 0


@dataclass
class FacialData:
    """Datos de microexpresión facial (Patrón 3: Microexpresión Facial)"""
    timestamp: datetime
    emotion: EmotionEnum = EmotionEnum.NEUTRAL
    emotion_confidence: float = 0.0
    valence: float = 0.0                  # -1 (negativo) a 1 (positivo)
    arousal: float = 0.0                  # 0 (calmado) a 1 (excitado)
    attention_score: float = 0.5          # 0-1
    blink_rate: float = 15.0             # Parpadeos/min
    brow_furrow: float = 0.0             # 0-1
    smile_intensity: float = 0.0         # 0-1
    jaw_drop: float = 0.0               # 0-1
    gaze_direction: str = "screen"       # screen, away, down, up
    head_tilt: float = 0.0
    micro_expression_duration_ms: float = 0.0


@dataclass
class VoiceProsodyData:
    """Datos de prosodia de voz (Patrón 4: Prosodia de Voz)"""
    timestamp: datetime
    pitch_mean_hz: float = 0.0
    pitch_variance: float = 0.0
    volume_db: float = 0.0
    volume_variance: float = 0.0
    speech_rate_wpm: float = 0.0
    pause_ratio: float = 0.0
    voice_tremor: float = 0.0           # 0-1
    energy_level: float = 0.0           # 0-1
    emotion_from_voice: EmotionEnum = EmotionEnum.NEUTRAL
    emotion_confidence: float = 0.0
    silence_duration_ms: float = 0.0
    filler_words_count: int = 0          # "eh", "um", "este"


# =============================================================================
# DATACLASSES DE SALIDA
# =============================================================================

@dataclass
class ModalityScore:
    """Resultado del análisis de una modalidad individual"""
    modality: ModalityType
    state_scores: Dict[str, float] = field(default_factory=dict)
    confidence: float = 0.0
    is_active: bool = False
    raw_metrics: Dict[str, float] = field(default_factory=dict)
    insights: List[str] = field(default_factory=list)


@dataclass
class CognitiveStateResult:
    """Resultado final de la inferencia multimodal"""
    state: CognitiveStateEnum
    confidence: float
    factors: Dict[str, float] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    should_adapt: bool = False
    suggested_difficulty: Optional[str] = None
    # Campos multimodales
    active_modalities: List[str] = field(default_factory=list)
    modality_scores: Dict[str, Dict[str, float]] = field(default_factory=dict)
    emotional_state: Optional[str] = None
    attention_level: float = 1.0
    error_risk: float = 0.0
    engagement_score: float = 0.5
    predicted_next_error: Optional[str] = None


# =============================================================================
# PATRÓN 1: ANALIZADOR DE RITMO DE INTERACCIÓN
# =============================================================================

class InteractionRhythmAnalyzer:
    """
    PATRÓN 1: RITMO DE INTERACCIÓN

    Analiza los patrones temporales de la interacción del usuario:
    - Intervalos entre acciones (aceleración/desaceleración)
    - Velocidad de escritura y tendencias
    - Distribución y duración de pausas
    - Ritmo circadiano (influencia de la hora del día)
    - Microritmos (variabilidad a corto plazo)
    - Tendencias a largo plazo (mejora/deterioro)
    """

    def __init__(self):
        self.events: deque = deque(maxlen=200)
        self.baseline: Optional[Dict] = None
        self.baseline_events_needed = 10

    def add_event(self, event: BehavioralEvent):
        self.events.append(event)
        if self.baseline is None and len(self.events) >= self.baseline_events_needed:
            self._build_baseline()

    def _build_baseline(self):
        events = list(self.events)[:self.baseline_events_needed]
        rts = [e.response_time_ms for e in events if e.response_time_ms > 0]
        speeds = [e.typing_speed_cpm for e in events if e.typing_speed_cpm > 0]
        pauses = [e.pause_duration_ms for e in events if e.pause_duration_ms > 0]
        errors = sum(1 for e in events if e.error_occurred)
        avg_rt = float(np.mean(rts)) if rts else 2000.0
        std_rt = float(np.std(rts)) if len(rts) > 1 else 500.0
        avg_speed = float(np.mean(speeds)) if speeds else 150.0
        avg_pause = float(np.mean(pauses)) if pauses else 1000.0
        error_rate = errors / len(events) if events else 0.2
        self.baseline = {
            "avg_rt": avg_rt,
            "std_rt": std_rt,
            "avg_speed": avg_speed,
            "avg_pause": avg_pause,
            "error_rate": error_rate,
            # Aliases de retrocompatibilidad
            "avg_response_time": avg_rt,
            "std_response_time": std_rt,
            "avg_typing_speed": avg_speed,
        }

    def analyze(self) -> ModalityScore:
        score = ModalityScore(modality=ModalityType.INTERACTION_RHYTHM,
                              is_active=len(self.events) >= 3)
        if not score.is_active or self.baseline is None:
            score.confidence = 0.1
            return score

        recent = list(self.events)[-20:]
        m = self._metrics(recent)
        score.raw_metrics = m
        score.state_scores = {
            CognitiveStateEnum.FATIGUE.value: self._fatigue(m),
            CognitiveStateEnum.OVERLOAD.value: self._overload(m),
            CognitiveStateEnum.DOUBT.value: self._doubt(m),
            CognitiveStateEnum.MASTERY.value: self._mastery(m),
            CognitiveStateEnum.FLOW.value: self._flow(m),
            CognitiveStateEnum.FRUSTRATION.value: self._frustration(m),
            CognitiveStateEnum.CURIOSITY.value: self._curiosity(m),
            CognitiveStateEnum.NORMAL.value: 0.3,
        }
        score.confidence = min(len(self.events) / 20, 1.0) * 0.9
        if m.get("rt_trend", 0) > 0.3:
            score.insights.append("Tiempos de respuesta en aumento progresivo")
        if m.get("speed_decay", 0) > 0.2:
            score.insights.append("Velocidad de escritura disminuyendo")
        if m.get("rhythm_irregularity", 0) > 0.5:
            score.insights.append("Ritmo de interacción irregular")
        return score

    def _metrics(self, events: List[BehavioralEvent]) -> Dict[str, float]:
        rts = [e.response_time_ms for e in events if e.response_time_ms > 0]
        speeds = [e.typing_speed_cpm for e in events if e.typing_speed_cpm > 0]
        pauses = [e.pause_duration_ms for e in events if e.pause_duration_ms > 0]
        errors = sum(1 for e in events if e.error_occurred)
        corrections = sum(1 for e in events if e.correction_made)
        n = len(events)
        rt_trend = 0.0
        if len(rts) >= 4:
            h = len(rts) // 2
            rt_trend = (float(np.mean(rts[h:])) - float(np.mean(rts[:h]))) / max(float(np.mean(rts[:h])), 1)
        speed_decay = 0.0
        if len(speeds) >= 4:
            h = len(speeds) // 2
            speed_decay = (float(np.mean(speeds[:h])) - float(np.mean(speeds[h:]))) / max(float(np.mean(speeds[:h])), 1)
        intervals = []
        for i in range(1, len(events)):
            dt = (events[i].timestamp - events[i - 1].timestamp).total_seconds()
            if dt > 0:
                intervals.append(dt)
        rhythm_irregularity = float(np.std(intervals) / max(np.mean(intervals), 0.01)) if len(intervals) >= 3 else 0.0
        acceleration = 0.0
        if len(rts) >= 6:
            diffs = [rts[i] - rts[i - 1] for i in range(1, len(rts))]
            acceleration = float(np.mean(diffs)) / max(self.baseline["avg_rt"], 1)
        hour = events[-1].timestamp.hour if events else 12
        circadian = 1.0
        if hour < 7 or hour > 22:
            circadian = 0.7
        elif 9 <= hour <= 11 or 15 <= hour <= 17:
            circadian = 1.2
        elif 13 <= hour <= 14:
            circadian = 0.85
        return {
            "avg_rt": float(np.mean(rts)) if rts else 0,
            "std_rt": float(np.std(rts)) if len(rts) > 1 else 0,
            "max_rt": float(max(rts)) if rts else 0,
            "avg_speed": float(np.mean(speeds)) if speeds else 0,
            "avg_pause": float(np.mean(pauses)) if pauses else 0,
            "error_rate": errors / n if n > 0 else 0,
            "correction_rate": corrections / n if n > 0 else 0,
            "pause_frequency": len(pauses) / n if n > 0 else 0,
            "rt_trend": rt_trend,
            "speed_decay": speed_decay,
            "rhythm_irregularity": rhythm_irregularity,
            "acceleration": acceleration,
            "circadian_factor": circadian,
            "session_duration_s": (events[-1].timestamp - events[0].timestamp).total_seconds() if len(events) > 1 else 0,
        }

    def _fatigue(self, m: Dict) -> float:
        s = 0.0
        bl = self.baseline
        r = m.get("avg_rt", 0) / max(bl["avg_rt"], 1)
        if r > 1.5: s += 0.25 * min(r / 2, 1.0)
        if m.get("rt_trend", 0) > 0.2: s += 0.25 * min(m["rt_trend"], 1.0)
        if m.get("speed_decay", 0) > 0.15: s += 0.2 * min(m["speed_decay"], 1.0)
        er = m.get("error_rate", 0) / max(bl["error_rate"], 0.01)
        if er > 1.3: s += 0.15 * min(er / 3, 1.0)
        d = m.get("session_duration_s", 0)
        if d > 1800: s += 0.15 * min(d / 3600, 1.0)
        return min(s * m.get("circadian_factor", 1.0), 1.0)

    def _overload(self, m: Dict) -> float:
        s = 0.0
        if m.get("error_rate", 0) > 0.5: s += 0.3
        if m.get("pause_frequency", 0) > 0.4: s += 0.25
        if m.get("avg_pause", 0) > self.baseline["avg_pause"] * 2: s += 0.2
        r = m.get("avg_rt", 0) / max(self.baseline["avg_rt"], 1)
        if r > 2.0: s += 0.25
        return min(s, 1.0)

    def _doubt(self, m: Dict) -> float:
        s = 0.0
        if m.get("correction_rate", 0) > 0.3: s += 0.3
        cv = m.get("std_rt", 0) / max(m.get("avg_rt", 1), 1)
        bl_cv = self.baseline["std_rt"] / max(self.baseline["avg_rt"], 1)
        if cv > bl_cv * 2: s += 0.3
        r = m.get("avg_rt", 0) / max(self.baseline["avg_rt"], 1)
        if 1.3 < r < 2.0: s += 0.2
        if m.get("rhythm_irregularity", 0) > 0.5: s += 0.2
        return min(s, 1.0)

    def _mastery(self, m: Dict) -> float:
        s = 0.0
        if (1 - m.get("error_rate", 0)) >= 0.9: s += 0.3
        r = m.get("avg_rt", 0) / max(self.baseline["avg_rt"], 1)
        if r < 0.8: s += 0.3
        if m.get("correction_rate", 0) < 0.1: s += 0.2
        cv = m.get("std_rt", 0) / max(m.get("avg_rt", 1), 1)
        if cv < 0.3: s += 0.2
        return min(s, 1.0)

    def _flow(self, m: Dict) -> float:
        s = 0.0
        cv = m.get("std_rt", 0) / max(m.get("avg_rt", 1), 1)
        if cv < 0.2: s += 0.3
        if m.get("error_rate", 0) < 0.15: s += 0.25
        r = m.get("avg_rt", 0) / max(self.baseline["avg_rt"], 1)
        if 0.6 < r < 1.2: s += 0.25
        if m.get("pause_frequency", 0) < 0.15: s += 0.2
        return min(s, 1.0)

    def _frustration(self, m: Dict) -> float:
        s = 0.0
        if m.get("error_rate", 0) > 0.4 and m.get("acceleration", 0) < -0.1: s += 0.3
        if m.get("speed_decay", 0) > 0.3: s += 0.2
        if m.get("rhythm_irregularity", 0) > 0.6: s += 0.25
        r = m.get("avg_rt", 0) / max(self.baseline["avg_rt"], 1)
        if r > 1.8: s += 0.25
        return min(s, 1.0)

    def _curiosity(self, m: Dict) -> float:
        s = 0.0
        if m.get("error_rate", 0) < 0.2 and m.get("avg_speed", 0) > self.baseline["avg_speed"] * 1.1: s += 0.3
        r = m.get("avg_rt", 0) / max(self.baseline["avg_rt"], 1)
        if 0.7 < r < 1.1: s += 0.2
        if m.get("acceleration", 0) > 0.05: s += 0.2
        if m.get("rhythm_irregularity", 0) < 0.3: s += 0.15
        if 0.1 < m.get("pause_frequency", 0) < 0.3: s += 0.15
        return min(s, 1.0)

    def reset(self):
        self.events.clear()
        self.baseline = None


# =============================================================================
# PATRÓN 2: ANALIZADOR DE SECUENCIA DE DECISIÓN
# =============================================================================

class DecisionSequenceAnalyzer:
    """
    PATRÓN 2: SECUENCIA DE DECISIÓN

    Rastrea cómo el usuario toma decisiones a lo largo del tiempo:
    - Vacilaciones (cambios antes de respuesta final)
    - Profundidad y longitud de respuestas
    - Consistencia en el tipo de decisiones
    - Patrones de retroceso (undo/backspace)
    - Confianza inferida por velocidad de decisión
    - Cadenas de éxito/fracaso
    """

    def __init__(self):
        self.decisions: deque = deque(maxlen=100)
        self.success_chain: int = 0
        self.failure_chain: int = 0
        self.total_correct: int = 0
        self.total_incorrect: int = 0

    def add_decision(self, decision: DecisionEvent):
        self.decisions.append(decision)
        if decision.is_correct is True:
            self.success_chain += 1
            self.failure_chain = 0
            self.total_correct += 1
        elif decision.is_correct is False:
            self.failure_chain += 1
            self.success_chain = 0
            self.total_incorrect += 1

    def add_from_behavioral(self, event: BehavioralEvent, user_message: str = ""):
        """Crea un DecisionEvent a partir de un BehavioralEvent"""
        decision = DecisionEvent(
            timestamp=event.timestamp,
            decision_type="answer",
            final_answer=user_message,
            changes_count=event.metadata.get("corrections", 0),
            time_to_decide_ms=event.response_time_ms,
            depth_of_response=event.content_length,
            hesitation_pauses=1 if event.pause_duration_ms > 2000 else 0,
            backspace_count=event.metadata.get("corrections", 0),
        )
        if event.response_time_ms > 0:
            decision.confidence_indicator = max(0, 1 - (event.response_time_ms / 10000))
        if event.correction_made:
            decision.confidence_indicator *= 0.7
        self.add_decision(decision)

    def analyze(self) -> ModalityScore:
        score = ModalityScore(modality=ModalityType.DECISION_SEQUENCE,
                              is_active=len(self.decisions) >= 3)
        if not score.is_active:
            score.confidence = 0.1
            return score
        recent = list(self.decisions)[-15:]
        m = self._metrics(recent)
        score.raw_metrics = m
        score.state_scores = {
            CognitiveStateEnum.FATIGUE.value: self._fatigue(m),
            CognitiveStateEnum.OVERLOAD.value: self._overload(m),
            CognitiveStateEnum.DOUBT.value: self._doubt(m),
            CognitiveStateEnum.MASTERY.value: self._mastery(m),
            CognitiveStateEnum.FLOW.value: self._flow(m),
            CognitiveStateEnum.FRUSTRATION.value: self._frustration(m),
            CognitiveStateEnum.CURIOSITY.value: self._curiosity(m),
            CognitiveStateEnum.NORMAL.value: 0.3,
        }
        score.confidence = min(len(self.decisions) / 15, 1.0) * 0.85
        if m.get("avg_changes", 0) > 2:
            score.insights.append("Cambios frecuentes de respuesta indican vacilación")
        if m.get("confidence_trend", 0) < -0.2:
            score.insights.append("Confianza del usuario en declive")
        if self.success_chain >= 5:
            score.insights.append(f"Racha de {self.success_chain} respuestas correctas")
        if self.failure_chain >= 3:
            score.insights.append(f"Racha de {self.failure_chain} errores consecutivos")
        return score

    def _metrics(self, decisions: List[DecisionEvent]) -> Dict[str, float]:
        n = len(decisions)
        if n == 0:
            return {}
        changes = [d.changes_count for d in decisions]
        times = [d.time_to_decide_ms for d in decisions if d.time_to_decide_ms > 0]
        confs = [d.confidence_indicator for d in decisions]
        depths = [d.depth_of_response for d in decisions if d.depth_of_response > 0]
        backspaces = [d.backspace_count for d in decisions]
        conf_trend = 0.0
        if len(confs) >= 4:
            h = len(confs) // 2
            conf_trend = float(np.mean(confs[h:])) - float(np.mean(confs[:h]))
        hes_rate = sum(1 for d in decisions if d.changes_count > 0 or d.hesitation_pauses > 0) / n
        depth_con = 0.0
        if len(depths) > 1:
            depth_con = 1.0 - min(float(np.std(depths) / max(np.mean(depths), 1)), 1.0)
        total = self.total_correct + self.total_incorrect
        accuracy = self.total_correct / max(total, 1)
        return {
            "avg_changes": float(np.mean(changes)),
            "avg_decision_time": float(np.mean(times)) if times else 0,
            "avg_confidence": float(np.mean(confs)),
            "confidence_trend": conf_trend,
            "hesitation_rate": hes_rate,
            "avg_backspaces": float(np.mean(backspaces)),
            "avg_depth": float(np.mean(depths)) if depths else 0,
            "depth_consistency": depth_con,
            "success_chain": self.success_chain,
            "failure_chain": self.failure_chain,
            "accuracy": accuracy,
        }

    def _fatigue(self, m: Dict) -> float:
        s = 0.0
        if m.get("confidence_trend", 0) < -0.15: s += 0.3
        if m.get("avg_decision_time", 0) > 5000: s += 0.25
        if m.get("depth_consistency", 0) < 0.3: s += 0.2
        if m.get("avg_backspaces", 0) > 3: s += 0.15
        return min(s, 1.0)

    def _overload(self, m: Dict) -> float:
        s = 0.0
        if m.get("hesitation_rate", 0) > 0.6: s += 0.3
        if m.get("avg_changes", 0) > 3: s += 0.25
        if m.get("failure_chain", 0) >= 3: s += 0.25
        if m.get("avg_confidence", 0) < 0.3: s += 0.2
        return min(s, 1.0)

    def _doubt(self, m: Dict) -> float:
        s = 0.0
        if m.get("hesitation_rate", 0) > 0.4: s += 0.3
        if m.get("avg_changes", 0) > 1.5: s += 0.25
        if 0.3 < m.get("avg_confidence", 0) < 0.6: s += 0.25
        if m.get("avg_backspaces", 0) > 2: s += 0.2
        return min(s, 1.0)

    def _mastery(self, m: Dict) -> float:
        s = 0.0
        if m.get("accuracy", 0) >= 0.85: s += 0.3
        if m.get("avg_confidence", 0) > 0.75: s += 0.25
        if m.get("success_chain", 0) >= 4: s += 0.25
        if m.get("hesitation_rate", 0) < 0.15: s += 0.2
        return min(s, 1.0)

    def _flow(self, m: Dict) -> float:
        s = 0.0
        if m.get("depth_consistency", 0) > 0.7: s += 0.3
        if m.get("avg_confidence", 0) > 0.65: s += 0.25
        if m.get("hesitation_rate", 0) < 0.2: s += 0.25
        if m.get("accuracy", 0) > 0.75: s += 0.2
        return min(s, 1.0)

    def _frustration(self, m: Dict) -> float:
        s = 0.0
        if m.get("failure_chain", 0) >= 3: s += 0.35
        if m.get("avg_backspaces", 0) > 5: s += 0.25
        if m.get("confidence_trend", 0) < -0.3: s += 0.2
        if m.get("avg_changes", 0) > 3 and m.get("accuracy", 0) < 0.4: s += 0.2
        return min(s, 1.0)

    def _curiosity(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_depth", 0) > 50: s += 0.3
        if m.get("avg_confidence", 0) > 0.5 and m.get("hesitation_rate", 0) < 0.3: s += 0.25
        if m.get("accuracy", 0) > 0.6 and m.get("depth_consistency", 0) > 0.5: s += 0.25
        if 2000 < m.get("avg_decision_time", 0) < 6000: s += 0.2
        return min(s, 1.0)

    def reset(self):
        self.decisions.clear()
        self.success_chain = 0
        self.failure_chain = 0
        self.total_correct = 0
        self.total_incorrect = 0


# =============================================================================
# PATRÓN 3: ANALIZADOR DE MICROEXPRESIÓN FACIAL
# =============================================================================

class FacialMicroexpressionAnalyzer:
    """
    PATRÓN 3: MICROEXPRESIÓN FACIAL

    Analiza señales faciales capturadas por webcam:
    - Emociones básicas (Ekman) + estados cognitivos
    - Valencia (positivo/negativo) y Arousal (excitación)
    - Atención visual (dirección de mirada, gaze tracking)
    - Tasa de parpadeo (indicador de fatiga/estrés)
    - Ceño fruncido (concentración/frustración)
    - Microexpresiones fugaces (duración < 500ms)

    NOTA: Los datos se capturan en el frontend con TensorFlow.js face-api
    o MediaPipe FaceMesh y se envían como FacialData al backend.
    """

    def __init__(self):
        self.facial_data: deque = deque(maxlen=300)
        self.baseline_blink_rate: float = 17.0
        self.baseline_attention: float = 0.8

    def add_data(self, data: FacialData):
        self.facial_data.append(data)
        if len(self.facial_data) == 30:
            blinks = [d.blink_rate for d in self.facial_data if d.blink_rate > 0]
            if blinks:
                self.baseline_blink_rate = float(np.mean(blinks))
            attns = [d.attention_score for d in self.facial_data]
            if attns:
                self.baseline_attention = float(np.mean(attns))

    def analyze(self) -> ModalityScore:
        score = ModalityScore(modality=ModalityType.FACIAL_MICROEXPRESSION,
                              is_active=len(self.facial_data) >= 5)
        if not score.is_active:
            score.confidence = 0.0
            return score
        recent = list(self.facial_data)[-60:]
        m = self._metrics(recent)
        score.raw_metrics = m
        score.state_scores = {
            CognitiveStateEnum.FATIGUE.value: self._fatigue(m),
            CognitiveStateEnum.OVERLOAD.value: self._overload(m),
            CognitiveStateEnum.DOUBT.value: self._doubt(m),
            CognitiveStateEnum.MASTERY.value: self._mastery(m),
            CognitiveStateEnum.FLOW.value: self._flow(m),
            CognitiveStateEnum.FRUSTRATION.value: self._frustration(m),
            CognitiveStateEnum.CURIOSITY.value: self._curiosity(m),
            CognitiveStateEnum.NORMAL.value: 0.3,
        }
        avg_conf = float(np.mean([d.emotion_confidence for d in recent]))
        score.confidence = min(avg_conf * 0.9, 1.0)
        if m.get("attention_drop", 0) > 0.3:
            score.insights.append("Atención visual reducida significativamente")
        if m.get("blink_ratio", 1) > 1.5:
            score.insights.append("Tasa de parpadeo elevada (posible fatiga ocular)")
        if m.get("dominant_emotion", "") == "confused":
            score.insights.append("Expresión facial predominante: confusión")
        return score

    def _metrics(self, data: List[FacialData]) -> Dict[str, float]:
        n = len(data)
        if n == 0:
            return {}
        emo_counts: Dict[str, int] = {}
        for d in data:
            e = d.emotion.value
            emo_counts[e] = emo_counts.get(e, 0) + 1
        dom = max(emo_counts, key=emo_counts.get) if emo_counts else "neutral"
        valences = [d.valence for d in data]
        avg_val = float(np.mean(valences))
        val_trend = 0.0
        if len(valences) >= 6:
            h = len(valences) // 2
            val_trend = float(np.mean(valences[h:]) - np.mean(valences[:h]))
        avg_arousal = float(np.mean([d.arousal for d in data]))
        avg_attn = float(np.mean([d.attention_score for d in data]))
        attn_drop = max(0, self.baseline_attention - avg_attn)
        away = sum(1 for d in data if d.gaze_direction != "screen") / n
        blinks = [d.blink_rate for d in data if d.blink_rate > 0]
        avg_blink = float(np.mean(blinks)) if blinks else self.baseline_blink_rate
        blink_ratio = avg_blink / max(self.baseline_blink_rate, 1)
        return {
            "dominant_emotion": dom,
            "avg_valence": avg_val,
            "valence_trend": val_trend,
            "avg_arousal": avg_arousal,
            "avg_attention": avg_attn,
            "attention_drop": attn_drop,
            "away_ratio": away,
            "avg_blink_rate": avg_blink,
            "blink_ratio": blink_ratio,
            "avg_brow_furrow": float(np.mean([d.brow_furrow for d in data])),
            "avg_smile": float(np.mean([d.smile_intensity for d in data])),
            "avg_jaw_drop": float(np.mean([d.jaw_drop for d in data])),
            "negative_emotion_ratio": sum(1 for d in data if d.valence < -0.2) / n,
            "confused_ratio": emo_counts.get("confused", 0) / n,
        }

    def _fatigue(self, m: Dict) -> float:
        s = 0.0
        if m.get("blink_ratio", 1) > 1.4: s += 0.3
        if m.get("attention_drop", 0) > 0.2: s += 0.25
        if m.get("avg_arousal", 0.5) < 0.3: s += 0.25
        if m.get("away_ratio", 0) > 0.3: s += 0.2
        return min(s, 1.0)

    def _overload(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_brow_furrow", 0) > 0.5: s += 0.3
        if m.get("confused_ratio", 0) > 0.3: s += 0.3
        if m.get("avg_valence", 0) < -0.3: s += 0.2
        if m.get("avg_arousal", 0) > 0.7: s += 0.2
        return min(s, 1.0)

    def _doubt(self, m: Dict) -> float:
        s = 0.0
        if m.get("confused_ratio", 0) > 0.2: s += 0.35
        if m.get("avg_brow_furrow", 0) > 0.3: s += 0.25
        if -0.2 < m.get("avg_valence", 0) < 0.1: s += 0.2
        if m.get("avg_arousal", 0) > 0.4: s += 0.2
        return min(s, 1.0)

    def _mastery(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_smile", 0) > 0.3: s += 0.3
        if m.get("avg_valence", 0) > 0.3: s += 0.25
        if m.get("avg_attention", 0) > 0.7: s += 0.25
        if m.get("confused_ratio", 0) < 0.05: s += 0.2
        return min(s, 1.0)

    def _flow(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_attention", 0) > 0.8: s += 0.3
        if 0.4 < m.get("avg_arousal", 0) < 0.7: s += 0.25
        if m.get("avg_valence", 0) > 0.1: s += 0.25
        if m.get("away_ratio", 0) < 0.1: s += 0.2
        return min(s, 1.0)

    def _frustration(self, m: Dict) -> float:
        s = 0.0
        if m.get("negative_emotion_ratio", 0) > 0.4: s += 0.3
        if m.get("avg_brow_furrow", 0) > 0.6: s += 0.25
        if m.get("avg_valence", 0) < -0.4: s += 0.25
        if m.get("avg_arousal", 0) > 0.6: s += 0.2
        return min(s, 1.0)

    def _curiosity(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_jaw_drop", 0) > 0.2: s += 0.25
        if m.get("avg_attention", 0) > 0.75: s += 0.25
        if m.get("avg_valence", 0) > 0.1: s += 0.25
        if 0.4 < m.get("avg_arousal", 0) < 0.8: s += 0.25
        return min(s, 1.0)

    def reset(self):
        self.facial_data.clear()


# =============================================================================
# PATRÓN 4: ANALIZADOR DE PROSODIA DE VOZ
# =============================================================================

class VoiceProsodyAnalyzer:
    """
    PATRÓN 4: PROSODIA DE VOZ

    Analiza características acústicas de la voz del usuario:
    - Pitch (tono fundamental): estrés, emoción, confianza
    - Volumen: energía, asertividad, frustración
    - Tasa de habla (WPM): nerviosismo, seguridad
    - Pausas en el habla: pensamiento, duda
    - Temblor vocal: ansiedad, fatiga
    - Palabras de relleno ("eh", "um"): incertidumbre

    NOTA: Las features de audio se extraen en el frontend con Web Audio API
    y se envían como VoiceProsodyData al backend.
    """

    def __init__(self):
        self.voice_data: deque = deque(maxlen=200)
        self.baseline_pitch: float = 120.0
        self.baseline_volume: float = 60.0
        self.baseline_rate: float = 130.0

    def add_data(self, data: VoiceProsodyData):
        self.voice_data.append(data)
        if len(self.voice_data) == 15:
            pitches = [d.pitch_mean_hz for d in self.voice_data if d.pitch_mean_hz > 0]
            volumes = [d.volume_db for d in self.voice_data if d.volume_db > 0]
            rates = [d.speech_rate_wpm for d in self.voice_data if d.speech_rate_wpm > 0]
            if pitches: self.baseline_pitch = float(np.mean(pitches))
            if volumes: self.baseline_volume = float(np.mean(volumes))
            if rates: self.baseline_rate = float(np.mean(rates))

    def analyze(self) -> ModalityScore:
        score = ModalityScore(modality=ModalityType.VOICE_PROSODY,
                              is_active=len(self.voice_data) >= 5)
        if not score.is_active:
            score.confidence = 0.0
            return score
        recent = list(self.voice_data)[-30:]
        m = self._metrics(recent)
        score.raw_metrics = m
        score.state_scores = {
            CognitiveStateEnum.FATIGUE.value: self._fatigue(m),
            CognitiveStateEnum.OVERLOAD.value: self._overload(m),
            CognitiveStateEnum.DOUBT.value: self._doubt(m),
            CognitiveStateEnum.MASTERY.value: self._mastery(m),
            CognitiveStateEnum.FLOW.value: self._flow(m),
            CognitiveStateEnum.FRUSTRATION.value: self._frustration(m),
            CognitiveStateEnum.CURIOSITY.value: self._curiosity(m),
            CognitiveStateEnum.NORMAL.value: 0.3,
        }
        confs = [d.emotion_confidence for d in recent if d.emotion_confidence > 0]
        avg_conf = float(np.mean(confs)) if confs else 0.3
        score.confidence = min(avg_conf * 0.85, 1.0)
        if m.get("tremor_level", 0) > 0.3:
            score.insights.append("Temblor vocal detectado (posible estrés)")
        if m.get("filler_rate", 0) > 0.3:
            score.insights.append("Alto uso de muletillas (incertidumbre)")
        if m.get("pitch_elevation", 0) > 0.3:
            score.insights.append("Tono de voz elevado respecto a baseline")
        return score

    def _metrics(self, data: List[VoiceProsodyData]) -> Dict[str, float]:
        n = len(data)
        if n == 0:
            return {}
        pitches = [d.pitch_mean_hz for d in data if d.pitch_mean_hz > 0]
        volumes = [d.volume_db for d in data if d.volume_db > 0]
        rates = [d.speech_rate_wpm for d in data if d.speech_rate_wpm > 0]
        avg_p = float(np.mean(pitches)) if pitches else self.baseline_pitch
        avg_v = float(np.mean(volumes)) if volumes else self.baseline_volume
        avg_r = float(np.mean(rates)) if rates else self.baseline_rate
        return {
            "avg_pitch": avg_p,
            "pitch_variance": float(np.std(pitches)) if len(pitches) > 1 else 0,
            "pitch_elevation": (avg_p - self.baseline_pitch) / max(self.baseline_pitch, 1),
            "avg_volume": avg_v,
            "volume_variance": float(np.std(volumes)) if len(volumes) > 1 else 0,
            "volume_change": (avg_v - self.baseline_volume) / max(self.baseline_volume, 1),
            "avg_rate": avg_r,
            "rate_change": (avg_r - self.baseline_rate) / max(self.baseline_rate, 1),
            "tremor_level": float(np.mean([d.voice_tremor for d in data])),
            "avg_energy": float(np.mean([d.energy_level for d in data])),
            "filler_rate": float(np.sum([d.filler_words_count for d in data])) / n,
            "avg_silence": float(np.mean([d.silence_duration_ms for d in data if d.silence_duration_ms > 0])) if any(d.silence_duration_ms > 0 for d in data) else 0,
            "pause_ratio": sum(1 for d in data if d.silence_duration_ms > 0) / n,
        }

    def _fatigue(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_energy", 0.5) < 0.3: s += 0.3
        if m.get("rate_change", 0) < -0.2: s += 0.25
        if m.get("volume_change", 0) < -0.15: s += 0.25
        if m.get("avg_silence", 0) > 2000: s += 0.2
        return min(s, 1.0)

    def _overload(self, m: Dict) -> float:
        s = 0.0
        if m.get("filler_rate", 0) > 0.4: s += 0.3
        if m.get("pitch_elevation", 0) > 0.2: s += 0.25
        if m.get("tremor_level", 0) > 0.3: s += 0.25
        if m.get("rate_change", 0) > 0.3: s += 0.2
        return min(s, 1.0)

    def _doubt(self, m: Dict) -> float:
        s = 0.0
        if m.get("filler_rate", 0) > 0.2: s += 0.3
        if m.get("pitch_variance", 0) > 30: s += 0.25
        if m.get("pause_ratio", 0) > 0.4: s += 0.25
        if m.get("volume_variance", 0) > 10: s += 0.2
        return min(s, 1.0)

    def _mastery(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_energy", 0) > 0.6: s += 0.3
        if m.get("filler_rate", 0) < 0.1: s += 0.25
        if m.get("tremor_level", 0) < 0.1: s += 0.25
        if 5 < m.get("pitch_variance", 0) < 20: s += 0.2
        return min(s, 1.0)

    def _flow(self, m: Dict) -> float:
        s = 0.0
        if m.get("avg_energy", 0) > 0.5: s += 0.25
        if m.get("filler_rate", 0) < 0.15: s += 0.25
        if abs(m.get("rate_change", 0)) < 0.1: s += 0.25
        if m.get("tremor_level", 0) < 0.1: s += 0.25
        return min(s, 1.0)

    def _frustration(self, m: Dict) -> float:
        s = 0.0
        if m.get("pitch_elevation", 0) > 0.3: s += 0.3
        if m.get("volume_change", 0) > 0.2: s += 0.25
        if m.get("avg_energy", 0) > 0.7: s += 0.25
        if m.get("tremor_level", 0) > 0.2: s += 0.2
        return min(s, 1.0)

    def _curiosity(self, m: Dict) -> float:
        s = 0.0
        if 0.05 < m.get("pitch_elevation", 0) < 0.2: s += 0.3
        if m.get("avg_energy", 0) > 0.5: s += 0.25
        if 0.05 < m.get("rate_change", 0) < 0.25: s += 0.25
        if m.get("filler_rate", 0) < 0.2: s += 0.2
        return min(s, 1.0)

    def reset(self):
        self.voice_data.clear()


# =============================================================================
# PATRÓN 5: PREDICTOR DE ERRORES
# =============================================================================

class ErrorPredictionAnalyzer:
    """
    PATRÓN 5: PATRÓN PREDICTIVO DE ERROR

    Predice la probabilidad de error en la próxima interacción:
    - Historial de errores (posiciones, contexto, frecuencia)
    - Patrón de deterioro (ventana deslizante)
    - Correlación entre métricas de otros patrones y errores pasados
    - Modelo probabilístico bayesiano (prior + likelihood)
    - Análisis de pre-señales de error (indicadores tempranos)
    """

    def __init__(self):
        self.error_history: List[Dict] = []
        self.interaction_history: List[Dict] = []
        self.error_contexts: List[str] = []
        self.prior_error_rate: float = 0.2
        self.likelihood_weights: Dict[str, float] = {
            "high_rt": 0.3, "low_speed": 0.2, "recent_errors": 0.4,
            "high_corrections": 0.25, "fatigue_signal": 0.35, "overload_signal": 0.3,
        }

    def record_interaction(self, metrics: Dict, had_error: bool, context: str = ""):
        record = {"timestamp": datetime.utcnow(), "metrics": metrics.copy(),
                  "had_error": had_error, "context": context}
        self.interaction_history.append(record)
        if had_error:
            self.error_history.append(record)
            self.error_contexts.append(context)
        total = len(self.interaction_history)
        errors = len(self.error_history)
        self.prior_error_rate = (errors + 1) / (total + 5)

    def predict_error(self, current_metrics: Dict,
                      other_modality_scores: Optional[Dict[str, Dict]] = None) -> ModalityScore:
        score = ModalityScore(modality=ModalityType.ERROR_PREDICTION,
                              is_active=len(self.interaction_history) >= 5)
        if not score.is_active:
            score.confidence = 0.1
            score.raw_metrics = {"error_probability": self.prior_error_rate}
            return score
        err_prob = self._bayesian_predict(current_metrics, other_modality_scores)
        score.raw_metrics = {
            "error_probability": err_prob,
            "prior_error_rate": self.prior_error_rate,
            "recent_error_rate": self._recent_rate(5),
            "error_trend": self._trend(),
            "total_errors": len(self.error_history),
            "total_interactions": len(self.interaction_history),
        }
        score.state_scores = {
            CognitiveStateEnum.FATIGUE.value: err_prob * 0.6 if err_prob > 0.4 else 0.0,
            CognitiveStateEnum.OVERLOAD.value: err_prob * 0.7 if err_prob > 0.5 else 0.0,
            CognitiveStateEnum.DOUBT.value: err_prob * 0.8 if 0.3 < err_prob < 0.7 else 0.0,
            CognitiveStateEnum.MASTERY.value: (1 - err_prob) * 0.8 if err_prob < 0.2 else 0.0,
            CognitiveStateEnum.FLOW.value: (1 - err_prob) * 0.7 if err_prob < 0.15 else 0.0,
            CognitiveStateEnum.FRUSTRATION.value: err_prob * 0.5 if err_prob > 0.6 else 0.0,
            CognitiveStateEnum.CURIOSITY.value: 0.0,
            CognitiveStateEnum.NORMAL.value: 0.3 if 0.15 < err_prob < 0.35 else 0.1,
        }
        score.confidence = min(len(self.interaction_history) / 20, 1.0) * 0.8
        if err_prob > 0.6:
            score.insights.append(f"⚠️ Alta probabilidad de error: {err_prob:.0%}")
        if self._recent_rate(3) > 0.5:
            score.insights.append("Errores recientes frecuentes")
        if self._trend() > 0.2:
            score.insights.append("Tendencia de errores en aumento")
        return score

    def _bayesian_predict(self, metrics: Dict, other_scores: Optional[Dict] = None) -> float:
        prior = self.prior_error_rate
        factors = []
        rt = metrics.get("avg_rt", 0)
        if rt > 3000:
            factors.append(("high_rt", min(rt / 6000, 1.0)))
        speed = metrics.get("avg_speed", 150)
        if 0 < speed < 100:
            factors.append(("low_speed", 1 - (speed / 150)))
        recent_err = self._recent_rate(5)
        if recent_err > 0.2:
            factors.append(("recent_errors", recent_err))
        corr = metrics.get("correction_rate", 0)
        if corr > 0.2:
            factors.append(("high_corrections", corr))
        if other_scores:
            for mod_scores in other_scores.values():
                fat = mod_scores.get(CognitiveStateEnum.FATIGUE.value, 0)
                ovl = mod_scores.get(CognitiveStateEnum.OVERLOAD.value, 0)
                if fat > 0.3: factors.append(("fatigue_signal", fat))
                if ovl > 0.3: factors.append(("overload_signal", ovl))
        if not factors:
            return prior
        combined = 0.0
        total_w = 0.0
        for name, val in factors:
            w = self.likelihood_weights.get(name, 0.2)
            combined += val * w
            total_w += w
        if total_w > 0:
            combined /= total_w
        posterior = (combined * prior) / (combined * prior + (1 - combined) * (1 - prior))
        return min(max(posterior, 0.0), 1.0)

    def _recent_rate(self, n: int) -> float:
        if len(self.interaction_history) < n:
            return self.prior_error_rate
        recent = self.interaction_history[-n:]
        return sum(1 for r in recent if r["had_error"]) / n

    def _trend(self) -> float:
        if len(self.interaction_history) < 6:
            return 0.0
        h = len(self.interaction_history) // 2
        first = sum(1 for r in self.interaction_history[:h] if r["had_error"]) / h
        second = sum(1 for r in self.interaction_history[h:] if r["had_error"]) / (len(self.interaction_history) - h)
        return second - first

    def get_predicted_error_type(self) -> Optional[str]:
        if not self.error_contexts:
            return None
        ctx_counts: Dict[str, int] = {}
        for ctx in self.error_contexts[-10:]:
            if ctx:
                ctx_counts[ctx] = ctx_counts.get(ctx, 0) + 1
        return max(ctx_counts, key=ctx_counts.get) if ctx_counts else None

    def reset(self):
        self.error_history.clear()
        self.interaction_history.clear()
        self.error_contexts.clear()
        self.prior_error_rate = 0.2


# =============================================================================
# MODELO MULTIMODAL DE INFERENCIA COGNITIVA
# =============================================================================

class MultimodalCognitiveEngine:
    """
    🧠 MOTOR MULTIMODAL DE INFERENCIA COGNITIVA

    Integra los 5 patrones neuroconductuales digitales:
      1. Ritmo de Interacción
      2. Secuencia de Decisión
      3. Microexpresión Facial
      4. Prosodia de Voz
      5. Patrón Predictivo de Error

    Usa fusión bayesiana multimodal para combinar todas las señales
    en una inferencia cognitiva unificada con pesos dinámicos.

    Características:
    - Funciona con cualquier combinación de modalidades activas
    - Redistribuye pesos automáticamente según disponibilidad
    - Suavizado temporal para evitar cambios bruscos
    - Retrocompatible con la interfaz del motor anterior
    """

    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        # Los 5 analizadores
        self.rhythm_analyzer = InteractionRhythmAnalyzer()
        self.decision_analyzer = DecisionSequenceAnalyzer()
        self.facial_analyzer = FacialMicroexpressionAnalyzer()
        self.voice_analyzer = VoiceProsodyAnalyzer()
        self.error_predictor = ErrorPredictionAnalyzer()
        # Pesos base (se ajustan dinámicamente según confianza por modalidad)
        # P3 facial y P4 voz tienen más peso: cuando están activos son señales
        # directas de emoción, más fiables que los patrones de teclado solos.
        self.modality_weights: Dict[str, float] = {
            ModalityType.INTERACTION_RHYTHM.value:    0.27,  # P1
            ModalityType.DECISION_SEQUENCE.value:     0.22,  # P2
            ModalityType.FACIAL_MICROEXPRESSION.value: 0.27, # P3 ↑ (era 0.20)
            ModalityType.VOICE_PROSODY.value:         0.14,  # P4 ↑ (era 0.10)
            ModalityType.ERROR_PREDICTION.value:      0.10,  # P5
        }
        self.state_history: List[CognitiveStateResult] = []
        # Suavizado temporal: 0.15 permite que los cambios de estado sean visibles
        # desde la primera sesión sin perder estabilidad entre eventos consecutivos
        self.temporal_smoothing = self.config.get("temporal_smoothing", 0.15)
        self._previous_scores: Optional[Dict[str, float]] = None

    # --- Retrocompatibilidad con motor anterior ---
    @property
    def event_history(self) -> deque:
        return self.rhythm_analyzer.events

    @property
    def baseline(self) -> Optional[Dict]:
        return self.rhythm_analyzer.baseline

    # --- Entrada de datos ---

    def add_event(self, event: BehavioralEvent, user_message: str = "") -> CognitiveStateResult:
        """Retrocompatible: registra BehavioralEvent y ejecuta inferencia"""
        return self.add_behavioral_event(event, user_message)

    def add_behavioral_event(self, event: BehavioralEvent,
                              user_message: str = "") -> CognitiveStateResult:
        """Registra evento conductual → alimenta Ritmo + Decisión + Predicción"""
        self.rhythm_analyzer.add_event(event)
        self.decision_analyzer.add_from_behavioral(event, user_message)
        rhythm_metrics = {}
        if self.rhythm_analyzer.baseline:
            recent = list(self.rhythm_analyzer.events)[-10:]
            if recent:
                rhythm_metrics = self.rhythm_analyzer._metrics(recent)
        self.error_predictor.record_interaction(
            metrics=rhythm_metrics, had_error=event.error_occurred,
            context=event.event_type)
        return self._run_inference()

    def add_decision_event(self, decision: DecisionEvent):
        self.decision_analyzer.add_decision(decision)

    def add_facial_data(self, facial: FacialData):
        self.facial_analyzer.add_data(facial)

    def add_voice_data(self, voice: VoiceProsodyData):
        self.voice_analyzer.add_data(voice)

    def add_multimodal_event(self,
                              behavioral: Optional[BehavioralEvent] = None,
                              decision: Optional[DecisionEvent] = None,
                              facial: Optional[FacialData] = None,
                              voice: Optional[VoiceProsodyData] = None,
                              user_message: str = "") -> CognitiveStateResult:
        """Registra datos de múltiples modalidades simultáneamente"""
        if behavioral:
            self.rhythm_analyzer.add_event(behavioral)
            self.decision_analyzer.add_from_behavioral(behavioral, user_message)
            rm = {}
            if self.rhythm_analyzer.baseline:
                r = list(self.rhythm_analyzer.events)[-10:]
                if r: rm = self.rhythm_analyzer._metrics(r)
            self.error_predictor.record_interaction(
                metrics=rm, had_error=behavioral.error_occurred,
                context=behavioral.event_type)
        if decision:
            self.decision_analyzer.add_decision(decision)
        if facial:
            self.facial_analyzer.add_data(facial)
        if voice:
            self.voice_analyzer.add_data(voice)
        return self._run_inference()

    # --- Motor de Inferencia ---

    def _run_inference(self) -> CognitiveStateResult:
        """Fusión bayesiana multimodal de los 5 patrones"""
        # 1. Scores por modalidad
        results: Dict[str, ModalityScore] = {}
        results[ModalityType.INTERACTION_RHYTHM.value] = self.rhythm_analyzer.analyze()
        results[ModalityType.DECISION_SEQUENCE.value] = self.decision_analyzer.analyze()
        results[ModalityType.FACIAL_MICROEXPRESSION.value] = self.facial_analyzer.analyze()
        results[ModalityType.VOICE_PROSODY.value] = self.voice_analyzer.analyze()

        other_scores = {n: ms.state_scores for n, ms in results.items() if ms.is_active}
        rhythm_m = results[ModalityType.INTERACTION_RHYTHM.value].raw_metrics if results[ModalityType.INTERACTION_RHYTHM.value].is_active else {}
        results[ModalityType.ERROR_PREDICTION.value] = self.error_predictor.predict_error(rhythm_m, other_scores)

        # 2. Pesos dinámicos
        dw = self._dynamic_weights(results)

        # 3. Fusión
        fused = self._fuse(results, dw)

        # 4. Suavizado temporal
        if self._previous_scores:
            a = self.temporal_smoothing
            for st in fused:
                fused[st] = a * self._previous_scores.get(st, 0.3) + (1 - a) * fused[st]
        self._previous_scores = fused.copy()

        # 5. Estado dominante
        best_str = max(fused, key=fused.get)
        best_val = fused[best_str]
        if best_val < 0.45:
            best_str = CognitiveStateEnum.NORMAL.value
            best_val = 0.5
        best_state = CognitiveStateEnum(best_str)
        confidence = min(best_val, 1.0)

        # 6. Construir resultado
        active = [n for n, ms in results.items() if ms.is_active]
        insights = []
        for ms in results.values():
            insights.extend(ms.insights)

        recs = self._recommendations(best_state, fused, insights)
        should_adapt, suggested = self._suggest_adaptation(best_state, confidence)

        emotional_state = None
        facial_ms = results[ModalityType.FACIAL_MICROEXPRESSION.value]
        voice_ms = results[ModalityType.VOICE_PROSODY.value]
        if facial_ms.is_active:
            emotional_state = facial_ms.raw_metrics.get("dominant_emotion", "neutral")
        elif voice_ms.is_active:
            emotional_state = "neutral"

        attention = facial_ms.raw_metrics.get("avg_attention", 1.0) if facial_ms.is_active else 1.0
        err_risk = results[ModalityType.ERROR_PREDICTION.value].raw_metrics.get("error_probability", 0.0)
        engagement = self._engagement(fused, attention, err_risk)

        result = CognitiveStateResult(
            state=best_state,
            confidence=round(confidence, 3),
            factors={k: round(v, 3) for k, v in fused.items()},
            recommendations=recs,
            should_adapt=should_adapt,
            suggested_difficulty=suggested,
            active_modalities=active,
            modality_scores={n: ms.state_scores for n, ms in results.items() if ms.is_active},
            emotional_state=emotional_state,
            attention_level=round(attention, 3),
            error_risk=round(err_risk, 3),
            engagement_score=round(engagement, 3),
            predicted_next_error=self.error_predictor.get_predicted_error_type(),
        )
        self.state_history.append(result)
        return result

    def _dynamic_weights(self, results: Dict[str, ModalityScore]) -> Dict[str, float]:
        active = {n: ms for n, ms in results.items() if ms.is_active}
        if not active:
            return {n: 0.0 for n in self.modality_weights}
        raw = {}
        for n, ms in active.items():
            raw[n] = self.modality_weights.get(n, 0.1) * ms.confidence
        total = sum(raw.values())
        if total == 0:
            return {n: 1.0 / len(active) for n in active}
        norm = {n: w / total for n, w in raw.items()}
        for n in self.modality_weights:
            if n not in norm:
                norm[n] = 0.0
        return norm

    def _fuse(self, results: Dict[str, ModalityScore],
              weights: Dict[str, float]) -> Dict[str, float]:
        states = [s.value for s in CognitiveStateEnum]
        fused = {st: 0.0 for st in states}
        for mod_name, ms in results.items():
            if not ms.is_active:
                continue
            w = weights.get(mod_name, 0.0)
            for st in states:
                fused[st] += ms.state_scores.get(st, 0.0) * w
        return fused

    def _engagement(self, scores: Dict[str, float], attention: float, err_risk: float) -> float:
        pos = (scores.get("flow", 0) * 1.0 + scores.get("mastery", 0) * 0.9 +
               scores.get("curiosity", 0) * 0.8 + scores.get("normal", 0) * 0.5)
        neg = (scores.get("fatigue", 0) * 0.8 + scores.get("frustration", 0) * 0.9 +
               scores.get("overload", 0) * 0.7 + scores.get("doubt", 0) * 0.3)
        # Asegurar que siempre devuelve float (no int 1 cuando el resultado es exactamente 1.0)
        return float(max(0.0, min(1.0, (pos - neg + 0.5) * attention * (1 - err_risk * 0.3))))

    def _recommendations(self, state: CognitiveStateEnum,
                          scores: Dict, insights: List[str]) -> List[str]:
        base = {
            CognitiveStateEnum.FATIGUE: [
                "🔋 Fatiga detectada en múltiples canales. Toma un descanso de 5-10 minutos.",
                "💡 Tu rendimiento ha disminuido. Una pausa mejorará la retención.",
            ],
            CognitiveStateEnum.OVERLOAD: [
                "⚠️ Sobrecarga cognitiva detectada. Simplificando el contenido.",
                "📉 Vamos a repasar lo básico antes de seguir adelante.",
            ],
            CognitiveStateEnum.DOUBT: [
                "🤔 Se detecta incertidumbre. ¿Quieres ver un ejemplo práctico?",
                "📖 Vamos a repasar este concepto con un enfoque diferente.",
            ],
            CognitiveStateEnum.MASTERY: [
                "🌟 ¡Excelente dominio! Avancemos a un nivel más desafiante.",
                "🚀 Tu rendimiento indica que estás listo/a para más.",
            ],
            CognitiveStateEnum.FLOW: [
                "✨ ¡Estás en un excelente estado de flujo! Continuemos.",
                "🎯 Rendimiento óptimo detectado en todos los canales.",
            ],
            CognitiveStateEnum.FRUSTRATION: [
                "😤 Se detecta frustración. Probemos un enfoque diferente.",
                "🔄 Cambiemos de estrategia para un aprendizaje más fluido.",
                "💪 La frustración es temporal. Vamos paso a paso.",
            ],
            CognitiveStateEnum.CURIOSITY: [
                "🔍 ¡Excelente curiosidad! Profundicemos en este tema.",
                "💡 Tu interés es alto. Exploremos más detalles.",
            ],
            CognitiveStateEnum.NORMAL: [
                "👍 Todo va bien. Continuemos con el aprendizaje.",
            ],
        }
        recs = list(base.get(state, ["Continuando..."]))
        for ins in insights[:2]:
            recs.append(f"📊 {ins}")
        return recs

    def _suggest_adaptation(self, state: CognitiveStateEnum,
                             confidence: float) -> Tuple[bool, Optional[str]]:
        # Umbral 0.4 para detectar cambios de estado con menos eventos (sesiones cortas)
        if confidence < 0.4:
            return False, None
        m = {
            CognitiveStateEnum.FATIGUE: (True, "easy"),
            CognitiveStateEnum.OVERLOAD: (True, "beginner"),
            CognitiveStateEnum.DOUBT: (True, "easy"),
            CognitiveStateEnum.MASTERY: (True, "hard"),
            CognitiveStateEnum.FRUSTRATION: (True, "beginner"),
            CognitiveStateEnum.CURIOSITY: (True, "medium"),
            CognitiveStateEnum.FLOW: (False, None),
            CognitiveStateEnum.NORMAL: (False, None),
        }
        return m.get(state, (False, None))

    # --- Consultas ---

    def get_cognitive_profile(self) -> Dict:
        if not self.state_history:
            return {"status": "insufficient_data",
                    "events_collected": len(self.rhythm_analyzer.events)}
        counts: Dict[str, int] = {}
        for r in self.state_history:
            counts[r.state.value] = counts.get(r.state.value, 0) + 1
        total = len(self.state_history)
        dist = {k: round(v / total, 3) for k, v in counts.items()}
        recent = self.state_history[-10:]
        last = self.state_history[-1]
        return {
            "total_events": len(self.rhythm_analyzer.events),
            "total_analyses": total,
            "state_distribution": dist,
            "dominant_state": max(counts, key=counts.get),
            "recent_trend": [r.state.value for r in recent],
            "current_state": last.state.value,
            "current_confidence": last.confidence,
            "baseline_established": self.rhythm_analyzer.baseline is not None,
            "baseline_metrics": self.rhythm_analyzer.baseline,
            "active_modalities": last.active_modalities,
            "emotional_state": last.emotional_state,
            "attention_level": last.attention_level,
            "engagement_score": last.engagement_score,
            "error_risk": last.error_risk,
        }

    def get_modality_status(self) -> Dict[str, Dict]:
        return {
            "interaction_rhythm": {
                "active": len(self.rhythm_analyzer.events) >= 3,
                "data_points": len(self.rhythm_analyzer.events),
                "baseline_ready": self.rhythm_analyzer.baseline is not None,
            },
            "decision_sequence": {
                "active": len(self.decision_analyzer.decisions) >= 3,
                "data_points": len(self.decision_analyzer.decisions),
                "accuracy": self.decision_analyzer.total_correct / max(
                    self.decision_analyzer.total_correct + self.decision_analyzer.total_incorrect, 1),
            },
            "facial_microexpression": {
                "active": len(self.facial_analyzer.facial_data) >= 5,
                "data_points": len(self.facial_analyzer.facial_data),
                "connected": len(self.facial_analyzer.facial_data) > 0,
            },
            "voice_prosody": {
                "active": len(self.voice_analyzer.voice_data) >= 5,
                "data_points": len(self.voice_analyzer.voice_data),
                "connected": len(self.voice_analyzer.voice_data) > 0,
            },
            "error_prediction": {
                "active": len(self.error_predictor.interaction_history) >= 5,
                "data_points": len(self.error_predictor.interaction_history),
                "current_risk": self.error_predictor.prior_error_rate,
            },
        }

    def reset(self):
        self.rhythm_analyzer.reset()
        self.decision_analyzer.reset()
        self.facial_analyzer.reset()
        self.voice_analyzer.reset()
        self.error_predictor.reset()
        self.state_history.clear()
        self._previous_scores = None


# =============================================================================
# ALIAS DE COMPATIBILIDAD
# =============================================================================
NeuroconductualEngine = MultimodalCognitiveEngine
