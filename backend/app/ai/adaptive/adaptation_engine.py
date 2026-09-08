"""
NeuroLearn AI — Motor de Adaptación Pedagógica

Pieza central diferencial. Separa explícitamente:
    StudentModel → Pedagogical Adaptation Engine → TeachingStrategy → LLM

Es 100% determinista y sin BD: recibe el modelo del estudiante (ya derivado de
datos reales) y decide la ESTRATEGIA PEDAGÓGICA con que el LLM debe responder.
El LLM no recibe el estado crudo; recibe las decisiones ya tomadas.

REGLAS:
- La confianza de cada señal condiciona su peso (ver CONF_* en student_model).
- Señales con confianza < CONF_IGNORE se ignoran para decisiones críticas.
- Nunca se diagnosticó una emoción: solo se combina evidencia observada.
- Dos estudiantes con distinto modelo reciben estrategias distintas.
"""
from dataclasses import dataclass
from typing import List, Optional

from app.ai.adaptive.student_model import (
    StudentModel,
    SkillMastery,
    TeachingStrategy,
    CONF_IGNORE,
)


# Dificultades válidas ordenadas para encadenar transiciones
_DIFF_ORDER = ["beginner", "easy", "medium", "hard", "expert"]
_DIFF_MIN, _DIFF_MAX = _DIFF_ORDER[0], _DIFF_ORDER[-1]


def _shift_difficulty(current: str, delta: int) -> str:
    try:
        idx = _DIFF_ORDER.index(current)
    except ValueError:
        idx = 2
    new_idx = max(0, min(len(_DIFF_ORDER) - 1, idx + delta))
    return _DIFF_ORDER[new_idx]


class PedagogicalAdaptationEngine:
    """
    Selecciona la estrategia pedagógica a partir del StudentModel y las señales
    disponibles (con su confianza). No genera texto; genera DECISIONES.
    """

    def __init__(
        self,
        mastery_high: float = 0.80,
        mastery_low: float = 0.45,
    ):
        self.mastery_high = mastery_high
        self.mastery_low = mastery_low

    def decide(self, model: StudentModel,
               available_signals: Optional[dict] = None) -> TeachingStrategy:
        available_signals = available_signals or {}
        strategy = TeachingStrategy()
        strategy.decision_confidence = 0.0
        reasons: List[str] = []

        current = model.current_skill()

        # ═════════════ 1) DOMINIO (Patrón 5 — rendimiento real) ═════════════
        if current is not None and current.evidence_count > 0:
            mastery = current.mastery
            src_conf = current.last_confidence
            strategy.difficulty = "medium"
            if mastery >= self.mastery_high:
                # Estudiante con alto dominio → más autonomía, más dificultad
                if src_conf >= CONF_IGNORE:
                    strategy.increase_difficulty = True
                    strategy.difficulty = _shift_difficulty(
                        (model.state.difficulty if model.state else "medium"), +1)
                    strategy.guidance_level = "autonomy"
                    strategy.example_count = 0
                    strategy.explanation_length = "short"
                    strategy.let_solve_alone = True
                    strategy.propose_exercise = True
                    reasons.append(f"dominio alto ({mastery:.0%})")
            elif mastery <= self.mastery_low:
                # Bajo dominio → más guía, menor dificultad, precisión
                if src_conf >= CONF_IGNORE:
                    strategy.reduce_difficulty = True
                    strategy.difficulty = _shift_difficulty(
                        (model.state.difficulty if model.state else "medium"), -1)
                    strategy.guidance_level = "guided"
                    strategy.explanation_length = "detailed"
                    strategy.example_count = 2
                    strategy.propose_exercise = False
                    reasons.append(f"dominio bajo ({mastery:.0%})")
            else:
                # Dominio medio → guía balanceada, ejemplos moderados
                strategy.guidance_level = "balanced"
                strategy.explanation_length = "medium"
                strategy.example_count = 1
                reasons.append(f"dominio medio ({mastery:.0%})")

        # Debilidades específicas → refuerzo / recuperación de base
        if current is not None and current.weak_concepts:
            strategy.prior_recovery = True
            strategy.give_hint = "Recuerda primero los fundamentos de: " + \
                ", ".join(current.weak_concepts[:2])
            reasons.append("conceptos débiles detectados")

        # ═════════════════ 2) ERRORES RECIENTES (temporalidad) ═════════════
        # Un error aislado no es adaptación fuerte; una racha > 2 sí cambia estrategia.
        streak = max(
            current.consecutive_wrong if current else 0,
            model.recent_error_streak,
        )
        if streak >= 3:
            strategy.change_strategy = True
            strategy.prior_recovery = True
            strategy.reduce_difficulty = True
            strategy.difficulty = _shift_difficulty(
                (model.state.difficulty if model.state else "medium"), -1)
            strategy.explanation_length = "detailed"
            strategy.example_count = 2
            strategy.give_hint = "Vamos a encarar el concepto desde otro ángulo."
            reasons.append(f"{streak} errores consecutivos")
        elif streak >= 2:
            strategy.repeat_explanation = True
            strategy.propose_exercise = True
            strategy.guidance_level = "guided"
            reasons.append("2 errores consecutivos → repetir + guiar")

        # ═════════════ 3) TASA DE ERROR DEL CHAT (rendimiento reciente) ═════
        chat_err = model.recent_chat_error_rate
        if chat_err > 0:
            if chat_err >= 0.60:
                strategy.change_strategy = True
                strategy.quiz_before_continue = False
                strategy.repeat_explanation = True
                strategy.give_hint = "Repasemos el concepto paso a paso."
                reasons.append(f"tasa de error del chat {chat_err:.0%}")
            elif chat_err >= 0.40:
                strategy.propose_exercise = True
                strategy.quiz_before_continue = True
                reasons.append(f"errores moderados ({chat_err:.0%})")

        # ═════════════ 4) PERSISTENCIA / DECISIONES DE SEGUIMIENTO ═════════
        if model.state and model.state.next_recommended_action:
            # Continuidad: proponer el siguiente paso ya recomendado
            strategy.propose_exercise = True
            reasons.append("continuidad pedagógica activa")
        if model.state and model.state.last_result == "incorrect":
            # No revelar respuesta de inmediato: guía + verificación
            strategy.guidance_level = "guided"
            strategy.give_hint = "Resuélvelo paso a paso; dime qué dudas tienes."
            reasons.append("última actividad incorrecta")

        # ═════════════ 5) FLUJO: NADA SOSPECHOSO → mantener ritmo ══════════
        # Cuando el modelo no tiene evidencia o todo va bien, no forzamos cambios.
        if not reasons:
            strategy.propose_exercise = True
            strategy.quiz_before_continue = True
            reasons.append("sin evidencia de quiebre → verificar comprensión")

        # Confianza global = promedio de la confianza de las fuentes usadas
        confs = []
        if current and current.evidence_count > 0:
            confs.append(current.last_confidence)
        if model.recent_chat_error_rate > 0:
            confs.append(min(0.9, 0.5 + model.recent_chat_error_rate))
        strategy.decision_confidence = (sum(confs) / len(confs)) if confs else 0.0
        strategy.rationale = list(dict.fromkeys(reasons))
        return strategy