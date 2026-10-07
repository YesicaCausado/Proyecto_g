"""
NeuroLearn AI — Generación de Contenido IA para el Docente
=============================================================
Endpoints de IA Generativa para el panel del profesor (permiso USAR_IA_DOCENTE).

Usa el gestor central de proveedores (Groq → Gemini) mediante `ai_manager`.
Si la IA no está configurada, falla o devuelve un formato inválido, el
endpoint responde con un error claro (503/502). Nunca devuelve contenido
de plantilla presentado como si lo hubiera generado la IA.

Lo usan:
  - IAGenerativaTab.tsx  (plan de clase, preguntas, guía, rúbrica)
  - EvaluacionesTab.tsx  (kind="preguntas" → revisión → guardar evaluación)
"""
import json
import logging
import re
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.user import User
from app.core.config import settings

# Reutilizar el mismo gestor que usa el chat (Groq → Gemini → local).
from app.ai.providers.ai_manager import AIManager

logger = logging.getLogger(__name__)

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
    level: str = Field("10°", max_length=30)
    count: int = Field(5, ge=1, le=12)
    subject: Optional[str] = Field(None, max_length=120)      # ej: Matemáticas
    extra: Optional[str] = Field(None, max_length=1000)       # contexto / instrucciones extra
    # Solo para kind="preguntas"
    competency: Optional[str] = Field(None, max_length=120)   # competencia Saber 11
    difficulty: Optional[Literal["basico", "intermedio", "avanzado"]] = None


DIFFICULTY_LABELS = {
    "basico": "básico (reconocimiento y comprensión)",
    "intermedio": "intermedio (aplicación y análisis)",
    "avanzado": "avanzado (análisis, argumentación y resolución de problemas complejos)",
}


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
        "Eres un docente experto en evaluaciones tipo Saber 11 (ICFES, Colombia). Genera preguntas de "
        "selección múltiple con única respuesta, en español, adecuadas al grado, tema, competencia y "
        "dificultad indicados. Cada pregunta puede incluir un breve contexto o situación en el enunciado. "
        "Devuelve únicamente un arreglo JSON con el formato exacto "
        '[{"type":"multiple","text":string,"options":[4 strings],"correct":string,"explanation":string,"points":2}]. '
        "Reglas: exactamente 4 opciones distintas y plausibles; 'correct' debe ser idéntica a una de las "
        "opciones; 'explanation' justifica en una o dos frases por qué es la respuesta correcta; "
        "no numeres las preguntas ni pongas letras en las opciones. Sin texto adicional."
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
    "{subject_line}{competency_line}{difficulty_line}NÚMERO DE ÍTEMS: {count}\n"
    "{extra}"
)


# ─── Normalización de preguntas ───────────────────────────────────────────────

_LETTER_PREFIX = re.compile(r"^\s*(?:[A-Da-d]|[1-4])\s*[\).:-]\s+")
_NUMBER_PREFIX = re.compile(r"^\s*\d+\s*[\).:-]\s+")


def _clean_option(value) -> str:
    return _LETTER_PREFIX.sub("", str(value or "")).strip()


def normalize_questions(parsed, count: int) -> List[dict]:
    """
    Convierte la respuesta de la IA al formato de pregunta del frontend
    (EvaluacionesTab / TeacherEvaluation.questions):

        {"id", "type": "multiple", "text", "options": [4], "correct", "points", "explanation"}

    Descarta las preguntas mal formadas (sin enunciado, con menos de 4 opciones
    distintas o con una respuesta correcta que no está entre las opciones).
    """
    items = parsed if isinstance(parsed, list) else (parsed or {}).get("questions") or []
    result: List[dict] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        text = _NUMBER_PREFIX.sub("", str(raw.get("text") or raw.get("pregunta") or "")).strip()
        if not text:
            continue

        options: List[str] = []
        for opt in raw.get("options") or raw.get("opciones") or []:
            cleaned = _clean_option(opt)
            if cleaned and cleaned not in options:
                options.append(cleaned)
        if len(options) < 4:
            continue

        correct_raw = raw.get("correct", raw.get("respuesta_correcta"))
        correct = None
        if isinstance(correct_raw, int) and 0 <= correct_raw < len(options):
            correct = options[correct_raw]
        elif correct_raw is not None:
            candidate = str(correct_raw).strip()
            if len(candidate) == 1 and candidate.upper() in "ABCD":
                correct = options["ABCD".index(candidate.upper())]
            else:
                candidate = _clean_option(candidate)
                correct = next((o for o in options if o == candidate), None) or next(
                    (o for o in options if o.lower() == candidate.lower()), None
                )
        if correct is None:
            continue
        if options.index(correct) >= 4:
            continue  # la correcta quedó fuera de las 4 opciones que se conservan
        options = options[:4]

        try:
            points = int(raw.get("points", 2))
        except (TypeError, ValueError):
            points = 2
        explanation = str(raw.get("explanation") or raw.get("explicacion") or "").strip()[:600]

        result.append({
            "id": f"ia-{len(result) + 1}",
            "type": "multiple",
            "text": text[:2000],
            "options": options,
            "correct": correct,
            "points": min(max(points, 1), 10),
            "explanation": explanation,
        })
        if len(result) >= count:
            break
    return result


def _extract_json(text: str, kind: str):
    """Extrae el bloque JSON del texto generado y valida que tenga la estructura
    completa esperada para el tipo de contenido (`kind`).

    Devuelve `None` si el texto no contiene JSON válido o si el JSON está
    incompleto (p. ej. truncado por el límite de tokens del modelo); en ese
    caso el endpoint responde 502 en lugar de presentar contenido vacío o roto.
    """
    if not text:
        return None
    candidates = []
    if text.strip().startswith(("[", "{")):
        candidates.append(text.strip())
    for m in re.finditer(r"```(?:json)?\s*([\s\S]*?)```", text):
        candidates.append(m.group(1).strip())
    # Bloque más amplio: del primer "[" / "{" al último "]" / "}" (texto
    # explicativo antes o después del JSON).
    for open_ch, close_ch in (("[", "]"), ("{", "}")):
        start, end = text.find(open_ch), text.rfind(close_ch)
        if 0 <= start < end:
            candidates.append(text[start:end + 1])
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
    _authorized: User = Depends(require_permission(Permission.USAR_IA_DOCENTE)),
    current_user: User = Depends(get_current_user),
):
    """
    Genera contenido educativo con IA real para el docente.

    Errores:
      400  kind inválido
      503  no hay proveedor de IA disponible (sin claves o todos fallaron)
      502  la IA respondió con un formato que no se pudo interpretar
    """
    kind = req.kind
    if kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind inválido: {kind}")
    topic = req.topic.strip()
    if not topic:
        raise HTTPException(status_code=422, detail="Escribe el tema.")

    if not ai_manager.providers:
        raise HTTPException(
            status_code=503,
            detail="La IA no está configurada en el servidor (GROQ_API_KEY o GEMINI_API_KEY).",
        )

    system = SYSTEM_PROMPTS[kind]
    is_questions = kind == "preguntas"
    body = PROMPT_BODY.format(
        topic=topic,
        level=req.level,
        subject_line=f"ASIGNATURA: {req.subject.strip()}\n" if req.subject and req.subject.strip() else "",
        competency_line=(
            f"COMPETENCIA SABER 11: {req.competency.strip()}\n"
            if is_questions and req.competency and req.competency.strip() else ""
        ),
        difficulty_line=(
            f"DIFICULTAD: {DIFFICULTY_LABELS[req.difficulty]}\n"
            if is_questions and req.difficulty else ""
        ),
        count=req.count,
        extra=f"CONTEXTO EXTRA: {req.extra.strip()}" if req.extra and req.extra.strip() else "",
    )

    try:
        # max_tokens generoso: un plan de clase completo puede superar los 2000
        # tokens de salida. Con valores bajos (1400) la IA alcanzaba a emitir el
        # JSON a medias y el contenido se mostraba vacío/roto.
        result = await ai_manager.generate(
            prompt=body, system_prompt=system, temperature=0.7, max_tokens=3000, expect_json=True,
        )
    except Exception:
        logger.exception("Error llamando a la IA (kind=%s, user=%s)", kind, current_user.id)
        result = {}

    provider = result.get("provider")
    ai_text = result.get("response") if provider and provider != "local" else None
    if not ai_text:
        # "local" es la plantilla interna del gestor: no es contenido generado por IA.
        raise HTTPException(
            status_code=503,
            detail="El servicio de IA no respondió. Inténtalo de nuevo en unos segundos.",
        )

    parsed = _extract_json(ai_text, kind)
    if parsed is None:
        logger.warning("IA devolvió JSON inválido (kind=%s, provider=%s)", kind, provider)
        raise HTTPException(
            status_code=502,
            detail="La IA respondió con un formato que no se pudo interpretar. Inténtalo de nuevo.",
        )

    response = {
        "kind": kind,
        "topic": topic,
        "level": req.level,
        "subject": req.subject,
        "provider": provider,
        "ai_used": True,
    }
    if is_questions:
        questions = normalize_questions(parsed, req.count)
        if not questions:
            raise HTTPException(
                status_code=502,
                detail="La IA no devolvió preguntas válidas (enunciado, 4 opciones y respuesta correcta). Inténtalo de nuevo.",
            )
        response.update({
            "competency": req.competency,
            "difficulty": req.difficulty,
            "requested": req.count,
            "content": {"questions": questions},
        })
    else:
        response["content"] = parsed

    logger.info(
        "IA docente: kind=%s provider=%s user=%s institution=%s",
        kind, provider, current_user.id, current_user.institution_id,
    )
    return response
