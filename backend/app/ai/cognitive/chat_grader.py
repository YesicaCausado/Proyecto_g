"""
🎯 NeuroLearn AI — Calificador de respuestas del chat para el Patrón 5 (Predicción de Error).

Propósito: determina en TIEMPO REAL si la respuesta que el estudiante acaba de dar
en el chat es correcta o incorrecta, usando el propio modelo de IA. Ese veredicto
alimenta el predictor bayesiano de errores del motor neuroconductual, de modo que
`error_risk` refleje lo que el estudiante está respondiendo en la conversación y
no solo el historial de quizzes.

Para evitar disparar una llamada extra a la IA por cada mensaje, solo se evalúa
cuando el último mensaje del tutor fue una pregunta evaluable / con opciones.
"""

import re
import logging

logger = logging.getLogger(__name__)

# Patrones de opciones de opción múltiple: "A)", "B)", "C)", "D)". 
_OPTIONS_RE = re.compile(r"(?m)\b[A-E][\.\)\:]\s", re.IGNORECASE)

# Expresiones/palabras que indican petición de una respuesta específica.
_KNOWLEDGE_CHECK_HINTS = (
    "qué es", "cuál es", "cuáles son", "cuánto", "cuántos", "cuándo", "quién",
    "quienes", "dónde", "cómo se", "cómo funciona", "cómo resolver", "por qué",
    "define", "explica", "resuelve", "calcula", "menciona",
    "verdadero o falso", "completa", "ordena", "elige", "selecciona",
    "¿cuál", "¿qué", "¿cuánto", "¿quién",
)


def tutor_is_asking(last_assistant_text: str) -> bool:
    """Determina si el último mensaje del tutor solicita una respuesta evaluable."""
    if not last_assistant_text or not str(last_assistant_text).strip():
        return False
    text = str(last_assistant_text).strip()
    stripped = text.rstrip("? ")
    if not stripped:
        return False

    # Termina en signo de interrogación → pregunta.
    if text.endswith("?"):
        return True

    # Contiene opciones de opción múltiple → evaluación.
    if _OPTIONS_RE.search(text):
        return True

    # Contiene una palabra/expresión de verificación de comprensión.
    lower = text.lower()
    return any(hint in lower for hint in _KNOWLEDGE_CHECK_HINTS)


_VERDICT_CORRECT = ("CORRECTO", "correct")
_VERDICT_INCORRECT = ("INCORRECTO", "incorrect")


async def grade_user_answer(ai_manager, user_message: str,
                            last_assistant_message: str, topic: str):
    """
    Evalúa la respuesta del estudiante frente a la pregunta del tutor.

    Returns:
        (verdict, confidence) donde verdict ∈ {"correct", "incorrect", None} y
        confidence ∈ [0,1]. verdict es None cuando no se puede evaluar (el
        tutor no preguntó, la respuesta no es evaluable, o el modelo falló).
    """
    if not tutor_is_asking(last_assistant_message):
        return None, 0.0
    if not user_message or not str(user_message).strip():
        return None, 0.0

    system_prompt = (
        "Eres un calificador objetivo y estricto de respuestas de estudiantes "
        "de bachillerato.\n"
        "Recibirás la pregunta del tutor y la respuesta del estudiante.\n"
        "Responde SOLO con UNA de estas tres palabras exactas (sin puntuación):\n"
        "CORRECTO   — la respuesta es sustancialmente correcta y responde la pregunta.\n"
        "INCORRECTO — la respuesta es errónea, incompleta de forma relevante o "
        "contradice el tema.\n"
        "NEUTRO     — la respuesta no es evaluable: es una contra-pregunta, un saludo, "
        "cambio de tema, o información insuficiente/ambigua.\n"
        "No agregues explicaciones ni puntos."
    )
    prompt = (
        f"TEMA: {topic}\n\n"
        f"PREGUNTA DEL TUTOR:\n{last_assistant_message}\n\n"
        f"RESPUESTA DEL ESTUDIANTE:\n{user_message}\n\n"
        f"VEREDICTO (CORRECTO/INCORRECTO/NEUTRO):"
    )

    try:
        result = await ai_manager.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.0,
            max_tokens=8,
            context_messages=None,
        )
        raw = (result.get("response") or "").strip().upper()
        if _VERDICT_CORRECT[0] in raw:
            return _VERDICT_CORRECT[1], 0.9
        if _VERDICT_INCORRECT[0] in raw:
            return _VERDICT_INCORRECT[1], 0.9
    except Exception as exc:  # pragma: no cover - degradación segura
        logger.warning("⚠️ Calificador de chat falló: %s", exc)

    return None, 0.0