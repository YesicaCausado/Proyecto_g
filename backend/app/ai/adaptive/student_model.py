"""
NeuroLearn AI — Student Model (Modelo del Estudiante)

Capa de dominio pura y sin dependencias de BD. Representa el perfil dinámico
que el Motor de Adaptación Pedagógica consume antes de cada respuesta.

⚠️ REGLA DE ORO: Todo dato aquí se DERIVA de interacción real persistida
(quiz_history, cognitive_events, chat_messages, conversaciones). Nunca se
inventa un mastery, una debilidad ni un estado. Si no hay suficiente evidencia,
los campos quedan en None / vacíos y el motor de adaptación los ignora.

Las funciones de build/update reciben eventos ya normalizados; la orquestación
con la base de datos vive en services/student_model_service.py.
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class SkillMastery:
    """Dominio real de una habilidad específica del estudiante."""
    skill: str
    subject: str
    topic: str = ""
    mastery: float = 0.0                 # 0-1 derivado de rendimiento real
    attempts: int = 0
    correct: int = 0
    # veces consecutivas errando (temporal)
    consecutive_wrong: int = 0
    weak_concepts: List[str] = field(default_factory=list)
    strength_concepts: List[str] = field(default_factory=list)
    # evidencia del último dato usado (fuente + confianza + timestamp)
    last_source: str = ""
    last_confidence: float = 0.0
    evidence_count: int = 0


@dataclass
class LearningState:
    """Continuidad pedagógica — el punto exacto donde quedó el estudiante."""
    subject: str = ""
    skill: str = ""
    topic: str = ""
    current_step: str = ""
    difficulty: str = "medium"
    mastery: float = 0.0
    last_activity: str = ""
    last_result: str = ""                 # correct | incorrect | ""
    detected_difficulty: str = ""
    next_recommended_action: str = ""


@dataclass
class StudentModel:
    """Modelo completo del estudiante para una decisión pedagógica."""
    student_id: int
    skills: Dict[str, SkillMastery] = field(default_factory=dict)
    state: Optional[LearningState] = None
    # Preferencias inferidas prudentemente (solo con evidencia)
    inferred_preferences: Dict[str, str] = field(default_factory=dict)
    # Memoria reciente relevante (episódica/semántica) para el contexto del LLM
    episodic_memories: List[str] = field(default_factory=list)
    semantic_memories: List[str] = field(default_factory=list)
    # Tasa de error reciente del chat real (de cognitive_session_state)
    recent_chat_error_rate: float = 0.0
    recent_error_streak: int = 0

    def current_skill(self) -> Optional[SkillMastery]:
        if not self.state or not self.state.skill:
            return None
        return self.skills.get(self.state.skill)

    def has_evidence(self) -> bool:
        return bool(self.skills) or bool(self.state)


@dataclass
class TeachingStrategy:
    """Decisión pedagógica del Motor de Adaptación (antes de llegar al LLM)."""
    difficulty: str = "medium"
    # cantidad / longitud
    explanation_length: str = "medium"     # short | medium | detailed
    example_count: int = 1
    guidance_level: str = "balanced"       # guided | balanced | autonomy
    quiz_before_continue: bool = False
    repeat_explanation: bool = False
    change_strategy: bool = False
    reduce_difficulty: bool = False
    increase_difficulty: bool = False
    prior_recovery: bool = False
    propose_exercise: bool = False
    give_hint: str = ""                    # descripción de pista
    let_solve_alone: bool = False
    should_pause: bool = False
    # justificación auditada (opcional, para UI/debug)
    rationale: List[str] = field(default_factory=list)
    # confianza global de la decisión basada en evidencia
    decision_confidence: float = 0.0


# ── Umbrales de confianza (propuesta inicial; se usan para pesar la señal) ──
CONF_IGNORE = 0.40    # < 0.40 → ignorar para adaptación
CONF_SECONDARY = 0.70 # 0.40–0.70 → señal secundaria