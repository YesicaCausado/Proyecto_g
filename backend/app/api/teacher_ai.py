"""
NeuroLearn AI — Generación de Contenido IA para el Docente
=============================================================
Endpoints de IA Generativa para el panel del profesor (plan Pro / módulo `ia`).

Usa el gestor central de proveedores (Groq → Gemini) mediante `ai_manager`.
Si la IA no está configurada o falla, devuelve contenido local estructurado
(misma forma que los endpoints de chat), de forma que la UI siempre recibe
un resultado utilizable.
"""
import json
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.models.user import User
from app.services.license_service import require_teacher_module, require_active_license, LicenseInfo
from app.core.config import settings

# Reutilizar el mismo gestor que usa el chat (Groq → Gemini → local).
from app.ai.providers.ai_manager import AIManager

router = APIRouter(prefix="/teacher/ai", tags=["Teacher - IA Generativa"])

ai_manager = AIManager(
    groq_api_key=settings.GROQ_API_KEY,
    groq_model=settings.GROQ_MODEL,
    gemini_api_key=settings.GEMINI_API_KEY,
    gemini_model=settings.GEMINI_MODEL,
)


class GenerateRequest(BaseModel):
    kind: str = Field(..., description="plan_clase | preguntas | guia | rubrica")
    topic: str = Field(..., min_length=1, max_length=200)
    level: str = "10°"
    count: int = Field(5, ge=1, le=12)
    subject: Optional[str] = None           # ej: Matemáticas
    extra: Optional[str] = None             # contexto / instrucciones extra


KINDS = {"plan_clase", "preguntas", "guia", "rubrica"}

# ─── System prompts por tipo de contenido ─────────────────────────────────────

SYSTEM_PROMPTS: dict[str, str] = {
    "plan_clase": (
        "Eres un docente experto en planeación pedagógica de bachillerato colombiano en NeuroLearn AI. "
        "Genera un plan de clase en español, completo y bien estructurado, usando el formato JSON "
        'exacto: {"titulo","duracion_minutos","grado","objetivos":[string],"indicadores_desempeno":[string],'
        '"momentos":[{"nombre","duracion_min","detalle"}],"recursos":[string],"evaluacion":string,"cierre":string}. '
        "Ajusta la dificultad al grado indicado. Escribe solo el JSON, sin texto adicional."
    ),
    "preguntas": (
        "Eres un docente experto en evaluaciones académicas. Genera preguntas de opción múltiple en español "
        "adecuadas al grado y tema indicados. Devuelve únicamente un arreglo JSON con el formato "
        '[{"type":"multiple","text":string,"options":[4 strings],"correct":string,"points":2}. '
        "La opción 'correct' debe coincidir exactamente con una de las opciones. Sin texto adicional."
    ),
    "guia": (
        "Eres un docente experto en elaboración de guías de estudio. Genera una guía de estudio en español "
        "bien estructurada para bachillerato, con el formato JSON exacto: "
        '{"titulo","tema","grado","conceptos_clave":[string],"resumen":string,'
        '"actividades":[{"titulo","tipo","descripcion"}],"preguntas_reflexion":[string],"recomendaciones":[string]}. '
        "Escribe solo el JSON, sin texto adicional."
    ),
    "rubrica": (
        "Eres un docente experto en evaluación por rúbricas. Genera una rúbrica para evaluar la competencia "
        "del tema indicado en español, con el formato JSON exacto: "
        '{"criterios":[{"criterio":string,"descripcion":string,"niveles":[...4 strings de niveles...]}]}. '
        "Escribe solo el JSON, sin texto adicional."
    ),
}

PROMPT_BODY = (
    "\n\nTEMA: {topic}\nGRADO/NIVEL: {level}\n"
) + (
    "{subject_line}NÚMERO DE ÍTEMS: {count}\n"
    "{extra}"
)


# ─── Fallbacks locales (cuando la IA no está disponible) ──────────────────────

def _fallback(kind: str, topic: str, level: str, count: int, subject: Optional[str]) -> dict:
    cap = topic.strip().capitalize()
    s = f" de {subject}" if subject else ""
    if kind == "preguntas":
        questions = []
        for i in range(count):
            n = i + 1
            questions.append({
                "type": "multiple",
                "text": f"{n}. ¿Cuál es la afirmación correcta sobre {topic}?",
                "options": [f"Opción A sobre {cap}", f"Opción B sobre {cap}",
                            f"Distractor C sobre {cap}", f"Distractor D sobre {cap}"],
                "correct": f"Opción A sobre {cap}",
                "points": 2,
            })
        return {"titulo": f"Evaluación de {cap}", "questions": questions}
    if kind == "plan_clase":
        return {
            "titulo": f"Plan de clase: {cap}",
            "duracion_minutos": 60,
            "grado": level,
            "objetivos": [f"Comprender los conceptos fundamentales de {topic}",
                          f"Aplicar {topic} en ejercicios prácticos{s}."],
            "indicadores_desempeno": [f"Explica con sus palabras la importancia de {topic}.",
                                      f"Resuelve problemas tipo sobre {cap}."],
            "momentos": [
                {"nombre": "Apertura", "duracion_min": 10, "detalle": f"Motivación y exploración de saberes previos sobre {cap}."},
                {"nombre": "Desarrollo", "duracion_min": 35, "detalle": f"Explicación guiada y práctica supervisada de {cap}."},
                {"nombre": "Cierre", "duracion_min": 15, "detalle": f"Socialización de resultados y retroalimentación."},
            ],
            "recursos": [f"Guía impresa de {cap}", "Tablero y marcadores", "Material concreto de apoyo"],
            "evaluacion": f"Lista de chequeo y participación durante la actividad sobre {cap}.",
            "cierre": f"Retroalimentación general y asignación de tarea corta sobre {cap}.",
        }
    if kind == "guia":
        return {
            "titulo": f"Guía de estudio: {cap}",
            "tema": topic,
            "grado": level,
            "conceptos_clave": [cap, f"Conceptos previos de {topic}", "Aplicaciones cotidianas"],
            "resumen": f"La presente guía permite al estudiante consolidar los conceptos centrales de {cap}{s}, mediante lectura, ejemplos y práctica guiada.",
            "actividades": [
                {"titulo": "Lectura comprensiva", "tipo": "individual", "descripcion": f"Leer el material de {cap} y subrayar ideas fuerza."},
                {"titulo": "Ejercicios guiados", "tipo": "práctica", "descripcion": f"Resolver la serie de ejercicios base de {cap}."},
                {"titulo": "Puesta en común", "tipo": "grupal", "descripcion": "Socializar respuestas y aclarar dudas en grupo."},
            ],
            "preguntas_reflexion": [f"¿Por qué es relevante estudiar {topic}?",
                                    "¿Cómo se relaciona este tema con tu vida cotidiana?"],
            "recomendaciones": ["Repasar los apuntes diariamente", "Practicar con ejercicios progresivos"],
        }
    # rubrica
    return {
        "criterios": [
            {"criterio": "Dominio conceptual", "descripcion": f"Comprende y explica correctamente los conceptos de {cap}.",
             "niveles": ["No logra identificar los conceptos", "Identifica algunos conceptos con ayuda",
                         "Explica los conceptos de forma adecuada", "Explica y relaciona conceptos con autonomía"]},
            {"criterio": "Aplicación práctica", "descripcion": f"Resuelve situaciones que requieren {cap}.",
             "niveles": ["No resuelve las situaciones", "Resuelve con acompañamiento", "Resuelve correctamente",
                         "Resuelve y justifica su estrategia"]},
            {"criterio": "Comunicación", "descripcion": "Comunica ideas y resultados con claridad.",
             "niveles": ["Comunica con dificultad", "Comunica ideas básicas", "Comunica con claridad",
                         "Comunica y fundamenta su respuesta"]},
        ]
    }


def _extract_json(text: str, kind: str):
    """Extrae el bloque JSON del texto generado y valida que tenga la estructura
    completa esperada para el tipo de contenido (`kind`).

    Devuelve `None` si el texto no contiene JSON válido o si el JSON está
    incompleto (p. ej. truncado por el límite de tokens del modelo). Devolver
    `None` hace que el endpoint use el fallback local en lugar de presentar
    contenido vacío o roto en la UI.
    """
    if not text:
        return None
    candidates = []
    if text.strip().startswith(("[", "{")):
        candidates.append(text.strip())
    for m in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", text):
        candidates.append(m.group(1).strip())
    for m in re.finditer(r"[\[{][\s\S]*?[\]}]", text):
        candidates.append(m.group(0).strip())
    seen = set()
    for cand in candidates:
        cand = cand.strip()
        if not cand or cand in seen:
            continue
        seen.add(cand)
        try:
            parsed = json.loads(cand)
        except Exception:
            continue
        if not isinstance(parsed, (dict, list)):
            continue
        if _matches_schema(kind, parsed):
            return parsed
    return None


def _matches_schema(kind: str, parsed) -> bool:
    """Valida que el JSON extraído tenga las claves estructurales mínimas que el
    renderizador del frontend espera para cada `kind`.

    - preguntas: `questions` (lista) o una lista directamente.
    - plan_clase: `objetivos` (lista), `momentos` (lista) y `evaluacion`.
    - guia: `conceptos_clave` (lista), `resumen` y `actividades` (lista).
    - rubrica: `criterios` (lista, con al menos un elemento).
    """
    def _is_list(x):
        return isinstance(x, list)

    if kind == "preguntas":
        if isinstance(parsed, list) and parsed:
            return True
        return isinstance(parsed, dict) and _is_list(parsed.get("questions")) and bool(parsed.get("questions"))
    if kind == "plan_clase":
        return (
            isinstance(parsed, dict)
            and _is_list(parsed.get("objetivos"))
            and _is_list(parsed.get("momentos"))
            and bool(parsed.get("evaluacion"))
        )
    if kind == "guia":
        return (
            isinstance(parsed, dict)
            and _is_list(parsed.get("conceptos_clave"))
            and bool(parsed.get("resumen"))
            and _is_list(parsed.get("actividades"))
        )
    if kind == "rubrica":
        return (
            isinstance(parsed, dict)
            and _is_list(parsed.get("criterios"))
            and bool(parsed.get("criterios"))
        )
    return isinstance(parsed, (dict, list))


@router.post("/generate")
async def generate_content(
    req: GenerateRequest,
    license_info: LicenseInfo = Depends(require_teacher_module("ia")),
    active_license: LicenseInfo = Depends(require_active_license()),
    current_user: User = Depends(get_current_user),
):
    """Genera contenido educativo con IA (o fallback local) para el docente."""
    kind = req.kind
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind inválido: {kind}")

    system = SYSTEM_PROMPTS[kind]
    body = PROMPT_BODY.format(
        topic=req.topic,
        level=req.level,
        subject_line=f"ASIGNATURA: {req.subject}\n" if req.subject else "",
        count=req.count,
        extra=f"CONTEXTO EXTRA: {req.extra}" if req.extra else "",
    )

    ai = None
    provider = None
    try:
        # max_tokens generoso: un plan de clase completo puede superar los 2000
        # tokens de salida. Con valores bajos (1400) la IA alcanzaba a emitir el
        # JSON a medias y el contenido se mostraba vacío/roto.
        result = await ai_manager.generate(prompt=body, system_prompt=system, temperature=0.7, max_tokens=3000)
        ai = result.get("response")
        provider = result.get("provider")
    except Exception:
        ai = None

    parsed = _extract_json(ai, kind) if ai else None
    fallback_used = parsed is None

    if parsed is None:
        parsed = _fallback(kind, req.topic, req.level, req.count, req.subject)

    return {
        "kind": kind,
        "topic": req.topic,
        "level": req.level,
        "subject": req.subject,
        "content": parsed,
        "provider": provider if not fallback_used else "local",
        "ai_used": provider is not None and not fallback_used,
    }