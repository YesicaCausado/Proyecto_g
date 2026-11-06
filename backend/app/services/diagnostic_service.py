"""
NeuroLearn IA — Calificación del diagnóstico inicial (RF-13).

Puntaje: cada acierto vale según su dificultad (básico 1, intermedio 2,
avanzado 3) y el total se expresa de 0 a 100. Así, acertar solo las preguntas
básicas no lleva al nivel más alto.

Niveles (los cuatro niveles de desempeño del Saber 11):
    1 Insuficiente   puntaje < 40
    2 Mínimo         40 ≤ puntaje < 60
    3 Satisfactorio  60 ≤ puntaje < 80
    4 Avanzado       puntaje ≥ 80

Después de calificar, el tutor de IA evalúa las respuestas (tutor_evaluation):
qué domina el estudiante, qué debe reforzar y cómo se adaptarán las sesiones.
Si la IA no responde, la evaluación se arma con los mismos datos calificados,
sin inventar nada.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Tuple

from app.services.diagnostic_bank import DIFFICULTY_WEIGHTS, questions_for

logger = logging.getLogger(__name__)

LEVELS = {
    1: {"label": "Insuficiente", "difficulty": "beginner",
        "description": "Estás empezando: el tutor reforzará primero los conceptos básicos."},
    2: {"label": "Mínimo", "difficulty": "easy",
        "description": "Manejas algunas bases; vas a fortalecer los temas intermedios."},
    3: {"label": "Satisfactorio", "difficulty": "medium",
        "description": "Tienes un buen dominio; trabajarás retos de mayor complejidad."},
    4: {"label": "Avanzado", "difficulty": "hard",
        "description": "Dominas la competencia; el tutor te propondrá problemas avanzados."},
}

_THRESHOLDS = ((80, 4), (60, 3), (40, 2))


def level_for(score: float) -> int:
    for minimum, level in _THRESHOLDS:
        if score >= minimum:
            return level
    return 1


def level_info(level: int) -> dict:
    return {"level": level, **LEVELS[level]}


def grade(competency: str, answers: Dict[str, Optional[int]]) -> dict:
    """Califica las respuestas {question_id: índice} de una competencia.

    Las preguntas sin responder cuentan como incorrectas.
    """
    questions = questions_for(competency)
    earned = possible = correct_count = 0
    topics: Dict[str, dict] = {}
    review: List[dict] = []

    for q in questions:
        weight = DIFFICULTY_WEIGHTS[q["difficulty"]]
        chosen = answers.get(q["id"])
        is_correct = chosen == q["correct"]
        possible += weight
        if is_correct:
            earned += weight
            correct_count += 1
        t = topics.setdefault(q["topic"], {"topic": q["topic"], "correct": 0, "total": 0})
        t["total"] += 1
        t["correct"] += int(is_correct)
        review.append({
            "id": q["id"],
            "topic": q["topic"],
            "difficulty": q["difficulty"],
            "context": q.get("context"),
            "text": q["text"],
            "options": list(q["options"]),
            "chosen": chosen,
            "correct": q["correct"],
            "is_correct": is_correct,
            "explanation": q["explanation"],
        })

    score = round(100 * earned / possible, 1) if possible else 0.0
    return {
        "correct_count": correct_count,
        "total_questions": len(questions),
        "score": score,
        "level": level_for(score),
        "topic_results": list(topics.values()),
        "review": review,
    }


def weak_topics(topic_results: List[dict]) -> List[str]:
    """Temas con menos de la mitad de aciertos: lo que conviene reforzar."""
    return [t["topic"] for t in topic_results if t["total"] and t["correct"] / t["total"] < 0.5]


# ── Evaluación del tutor de IA ───────────────────────────────────────────────

TUTOR_SYSTEM_PROMPT = (
    "Eres el tutor de inteligencia artificial de NeuroLearn IA y acabas de aplicar "
    "el diagnóstico inicial de una competencia del Saber 11 a un estudiante de "
    "secundaria en Colombia. Evalúa sus respuestas y háblale directamente (tú), en "
    "español, con un tono cercano y motivador. Usa SOLO los datos que recibes: no "
    "inventes temas, puntajes ni respuestas. Responde en texto plano, sin títulos ni "
    "listas, en 4 a 6 oraciones: qué domina, qué errores cometió y por qué, qué "
    "temas reforzará primero y cómo adaptarás las próximas sesiones a su nivel."
)


def _option(q: dict, index: Optional[int]) -> str:
    if index is None or not 0 <= index < len(q["options"]):
        return "sin respuesta"
    return q["options"][index]


def tutor_prompt(competency_name: str, graded: dict) -> str:
    """Datos del diagnóstico calificado que el tutor necesita para evaluarlo."""
    level = LEVELS[graded["level"]]
    topics = "\n".join(f"- {t['topic']}: {t['correct']}/{t['total']} correctas"
                       for t in graded["topic_results"])
    errors = [q for q in graded["review"] if not q["is_correct"]]
    error_lines = "\n".join(
        f"- [{q['topic']}, {q['difficulty']}] {q['text']} | eligió: {_option(q, q['chosen'])}"
        f" | correcta: {_option(q, q['correct'])}"
        for q in errors
    ) or "- Ninguno: respondió todo correctamente."
    return (
        f"COMPETENCIA: {competency_name}\n"
        f"PUNTAJE: {graded['score']}/100 ({graded['correct_count']} de {graded['total_questions']} correctas)\n"
        f"NIVEL: {graded['level']} - {level['label']}\n"
        f"RESULTADOS POR TEMA:\n{topics}\n"
        f"PREGUNTAS FALLADAS:\n{error_lines}"
    )


def local_evaluation(competency_name: str, graded: dict) -> str:
    """Evaluación sin IA, construida solo con los resultados calificados."""
    level = LEVELS[graded["level"]]
    strong = [t["topic"] for t in graded["topic_results"]
              if t["total"] and t["correct"] / t["total"] >= 0.5]
    weak = weak_topics(graded["topic_results"])
    parts = [
        f"En {competency_name} obtuviste {graded['score']} de 100 "
        f"({graded['correct_count']} de {graded['total_questions']} correctas): "
        f"nivel {level['label']}."
    ]
    if strong:
        parts.append(f"Muestras buen manejo de {', '.join(strong)}.")
    if weak:
        parts.append(f"Vamos a reforzar primero {', '.join(weak)}.")
    else:
        parts.append("No hay temas con menos de la mitad de aciertos.")
    parts.append(level["description"])
    return " ".join(parts)


async def tutor_evaluation(ai_manager, competency_name: str, graded: dict) -> Tuple[str, str]:
    """(texto, proveedor) de la evaluación del tutor; 'local' si la IA no respondió."""
    if ai_manager is not None and getattr(ai_manager, "providers", None):
        try:
            result = await ai_manager.generate(
                prompt=tutor_prompt(competency_name, graded),
                system_prompt=TUTOR_SYSTEM_PROMPT,
                temperature=0.4,
                max_tokens=600,
            )
            provider = result.get("provider")
            text = (result.get("response") or "").strip()
            if provider and provider != "local" and text:
                return text[:4000], provider
        except Exception:  # noqa: BLE001 (la evaluación nunca impide guardar el diagnóstico)
            logger.exception("El tutor de IA no pudo evaluar el diagnóstico (%s)", competency_name)
    return local_evaluation(competency_name, graded), "local"
