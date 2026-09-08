"""
NeuroLearn AI — Contexto del LLM (Memoria eficiente + Estrategia pedagógica)

Construye el bloque de contexto que se inyecta al system prompt del LLM.
NO envía todo el historial: envía
    Current Context + Estrategia Pedagógica + Memoria relevante (resumida)
+ rendimiento reciente + señales neuro disponibles.

Separa los 4 tipos de memoria:
  1. Memoria de conversación   → últimos N mensajes (los envía el orquestador).
  2. Memoria episódica          → recuerdos auto-contenidos relevantes.
  3. Memoria semántica          → conocimiento consolidado del progreso.
  4. Estado actual              → continuity (dónde quedó el estudiante).
"""
from typing import Dict, List, Optional

from app.ai.adaptive.student_model import StudentModel, TeachingStrategy


def build_adaptation_context(
    model: StudentModel,
    strategy: TeachingStrategy,
    neuro_digest: Optional[Dict[str, str]] = None,
) -> str:
    """Genera un bloque de texto inequívoco para el LLM con las decisiones."""
    lines: List[str] = ["", "=" * 50, "PLAN DE TUTORÍA ADAPTATIVA (acata estrictamente):", "=" * 50]

    # Dificultad y longitud
    lines.append(f"- Dificultad objetivo: {strategy.difficulty}")
    lines.append(f"- Longitud de explicación: {_length_label(strategy.explanation_length)}")
    lines.append(f"- Cantidad de ejemplos: {strategy.example_count}")

    # Guía
    if strategy.guidance_level == "guided":
        lines.append("- Estilo: guiado paso a paso, con preguntas cortas de verificación.")
    elif strategy.guidance_level == "autonomy":
        lines.append("- Estilo: autonomía. Da el reto y deja que el estudiante lo intente primero.")
    else:
        lines.append("- Estilo: balanceado, explicación + verificación.")

    # Acciones específicas
    if strategy.repeat_explanation:
        lines.append("- Repite la explicación del concepto con un enfoque DISTINTO al anterior.")
    if strategy.change_strategy:
        lines.append("- CAMBIA de estrategia: el enfoque anterior no está funcionando.")
    if strategy.prior_recovery:
        lines.append("- Haz recuperación de conocimientos previos antes de avanzar.")
    if strategy.reduce_difficulty:
        lines.append("- Reduce la dificultad: simplifica el alcance de esta respuesta.")
    if strategy.increase_difficulty:
        lines.append("- Aumenta la dificultad: plantea un reto de aplicación.")
    if strategy.propose_exercise:
        lines.append("- Propón un ejercicio para que el estudiante resuelva.")
    else:
        lines.append("- NO propongas ejercicio aún; primero consolida.")
    if strategy.quiz_before_continue:
        lines.append("- Antes de avanzar, haz UNA pregunta breve de verificación de comprensión.")
    if strategy.let_solve_alone:
        lines.append("- Permite que el estudiante resuelva por sí mismo; NO reveles la respuesta de inmediato.")
    if strategy.give_hint:
        lines.append(f"- Sugerencia para dar: {strategy.give_hint}")
    if strategy.should_pause:
        lines.append("- Sugiere amablemente una breve pausa.")
    if strategy.decision_confidence and strategy.decision_confidence < 0.40:
        lines.append("- (Señales de baja confianza: usa esta plan como orientativo, no como diagnóstico.)")

    # Continuidad pedagógica
    if model.state:
        st = model.state
        cont = [
            "CONTINUIDAD PEDAGÓGICA:",
            f"  · Última actividad: {st.last_activity or '—'} (resultado: {st.last_result or '—'})",
        ]
        if st.detected_difficulty:
            cont.append(f"  · Dificultad detectada: {st.detected_difficulty}")
        if st.next_recommended_action:
            lines.append(f"- Siguiente paso recomendado (continúa desde aquí): {st.next_recommended_action}")
        lines = lines[:2] + cont + lines[2:]

    # Memoria semántica / episódica (resumida y pertinente)
    if model.semantic_memories:
        lines.append("HISTORIAL CONSOLIDADO del estudiante (usa como contexto general):")
        for m in model.semantic_memories[-4:]:
            lines.append(f"  · {m}")
    if model.episodic_memories:
        lines.append("EVENTOS RECIENTES relevantes:")
        for m in model.episodic_memories[-4:]:
            lines.append(f"  · {m}")

    # Señales neuro disponibles (solo las que existen)
    if neuro_digest:
        avail = {k: v for k, v in neuro_digest.items() if v}
        if avail:
            lines.append("SEÑALES DISPONIBLES (solo las que el sistema midió):")
            for k, v in avail.items():
                lines.append(f"  · {k}: {v}")
            lines.append("  · No todas las señales están disponibles; NO inventes lo que no ves.")

    return "\n".join(lines)


def _length_label(value: str) -> str:
    return {
        "short": "corta (máx 2 párrafos)",
        "medium": "media (moderada, concisa)",
        "detailed": "detallada (paso a paso, completa)",
    }.get(value, value)


def conversation_history_block(messages: List[Dict]) -> str:
    """Convierte los últimos mensajes de la conversación en texto (acotado)."""
    out: List[str] = []
    for m in (messages or [])[-12:]:
        role = "Tutor" if m.get("role") == "assistant" else "Estudiante"
        content = (m.get("content") or "").strip()
        if not content:
            continue
        out.append(f"{role}: {content}")
    return "\n".join(out)