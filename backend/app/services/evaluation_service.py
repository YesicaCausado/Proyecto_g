"""
NeuroLearn IA — Reglas de las evaluaciones profesor → estudiante.

Lógica pura (sin FastAPI) que usan teacher_evaluations.py y
student_evaluations.py:

- Fecha límite: el campo `date` (AAAA-MM-DD) es el último día para entregar,
  hasta las 23:59:59 hora de Colombia (UTC-5, sin horario de verano).
- Tiempo por intento: `duration` minutos desde que el estudiante abre el
  intento, sin pasar de la fecha límite. Se aceptan 60 s de margen de red.
- Intentos: `attempts` por estudiante. Las respuestas se guardan mientras el
  estudiante responde; si el tiempo se agota sin enviar, el intento se envía
  solo con lo guardado (auto_submitted) y cuenta como intento.
- Nota oficial: el MEJOR intento calificado.
- Calificación: selección múltiple y V/F automáticas en el servidor; las
  preguntas abiertas quedan pendientes hasta que el profesor las califica.
- Corrección visible para el estudiante solo cuando la evaluación está
  cerrada o ya pasó la fecha límite.

Fechas en BD: UTC sin zona (igual que el resto del proyecto, datetime.utcnow).
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.evaluation import EvaluationSubmission, TeacherEvaluation

COLOMBIA_TZ = timezone(timedelta(hours=-5))
GRACE_SECONDS = 60
# "match" (emparejamiento) se retiró del editor; las preguntas antiguas de ese
# tipo tenían opciones y respuesta correcta, así que se califican como múltiple.
AUTO_GRADED = {"multiple", "truefalse", "match"}
MAX_OPEN_ANSWER_CHARS = 5000


def utcnow() -> datetime:
    return datetime.utcnow()


# ── Fechas ───────────────────────────────────────────────────────────────────

def deadline_utc(ev: TeacherEvaluation) -> Optional[datetime]:
    """Fin de la fecha límite en UTC (naive) o None si no tiene fecha."""
    if not ev.date:
        return None
    try:
        day = date.fromisoformat(ev.date)
    except ValueError:
        return None
    local_end = datetime(day.year, day.month, day.day, 23, 59, 59, tzinfo=COLOMBIA_TZ)
    return local_end.astimezone(timezone.utc).replace(tzinfo=None)


def today_colombia() -> date:
    return datetime.now(COLOMBIA_TZ).date()


def is_past_deadline(ev: TeacherEvaluation, now: Optional[datetime] = None) -> bool:
    limit = deadline_utc(ev)
    return limit is not None and (now or utcnow()) > limit


def accepts_submissions(ev: TeacherEvaluation, now: Optional[datetime] = None) -> bool:
    return ev.status == "publicada" and not is_past_deadline(ev, now)


def corrections_visible(ev: TeacherEvaluation, now: Optional[datetime] = None) -> bool:
    return ev.status == "cerrada" or is_past_deadline(ev, now)


def attempt_expiry(ev: TeacherEvaluation, start: datetime) -> datetime:
    expires = start + timedelta(minutes=int(ev.duration or 30))
    limit = deadline_utc(ev)
    return min(expires, limit) if limit else expires


# ── Preguntas ────────────────────────────────────────────────────────────────

def question_id(question: dict, index: int) -> str:
    return str(question.get("id") or f"q{index + 1}")


def ensure_question_ids(questions: List[dict]) -> List[dict]:
    """Garantiza un id único por pregunta (las respuestas se guardan por id)."""
    seen = set()
    out = []
    for i, q in enumerate(questions):
        qid = question_id(q, i)
        if qid in seen:
            qid = f"q{i + 1}"
            while qid in seen:
                qid += "b"
        seen.add(qid)
        out.append({**q, "id": qid})
    return out


def public_question(question: dict, index: int) -> dict:
    """Pregunta para el estudiante: sin respuesta correcta ni explicación."""
    item = {
        "id": question_id(question, index),
        "type": question.get("type", "multiple"),
        "text": question.get("text", ""),
        "points": question.get("points", 1),
    }
    if item["type"] in AUTO_GRADED:
        item["options"] = list(question.get("options") or [])
    return item


def max_score(questions: Iterable[dict]) -> float:
    return float(sum(int(q.get("points") or 0) for q in questions))


def clean_answers(questions: List[dict], answers: Dict[str, object]) -> Dict[str, str]:
    """Conserva solo respuestas a preguntas existentes y válidas para su tipo."""
    clean: Dict[str, str] = {}
    for i, q in enumerate(questions):
        qid = question_id(q, i)
        value = answers.get(qid)
        if value is None:
            continue
        value = str(value).strip()
        if not value:
            continue
        if q.get("type") in AUTO_GRADED:
            if value in (q.get("options") or []):
                clean[qid] = value
        else:
            clean[qid] = value[:MAX_OPEN_ANSWER_CHARS]
    return clean


def grade(questions: List[dict], answers: Dict[str, str]) -> Tuple[Dict[str, dict], bool]:
    """
    Califica las preguntas automáticas. Devuelve (resultados, hay_pendientes).

    resultados[qid] = {correct, points, max_points, feedback}
    En preguntas abiertas `correct` y `points` quedan en None (pendientes).
    """
    results: Dict[str, dict] = {}
    pending = False
    for i, q in enumerate(questions):
        qid = question_id(q, i)
        max_points = float(int(q.get("points") or 0))
        if q.get("type") in AUTO_GRADED:
            ok = answers.get(qid) is not None and answers.get(qid) == q.get("correct")
            results[qid] = {"correct": ok, "points": max_points if ok else 0.0,
                            "max_points": max_points, "feedback": None}
        else:
            answered = bool(answers.get(qid))
            if answered:
                pending = True
                results[qid] = {"correct": None, "points": None, "max_points": max_points, "feedback": None}
            else:
                # Abierta sin respuesta: 0 puntos, no requiere revisión.
                results[qid] = {"correct": False, "points": 0.0, "max_points": max_points, "feedback": None}
    return results, pending


def apply_totals(sub: EvaluationSubmission, questions: List[dict]) -> None:
    """Recalcula score / max_score / percentage y el estado a partir de `results`."""
    results = sub.results or {}
    total = max_score(questions)
    pending = any(r.get("points") is None for r in results.values())
    score = sum(float(r.get("points") or 0) for r in results.values())
    sub.max_score = total
    sub.score = round(score, 2)
    sub.percentage = round(score / total * 100, 1) if total else 0.0
    sub.status = "pendiente_revision" if pending else "calificada"


# ── Intentos ─────────────────────────────────────────────────────────────────

def submit_attempt(sub: EvaluationSubmission, ev: TeacherEvaluation, answers: Dict[str, object],
                   submitted_at: datetime, auto: bool = False) -> None:
    """Califica y cierra un intento en curso (sin commit)."""
    questions = ev.questions or []
    clean = clean_answers(questions, answers or {})
    results, _ = grade(questions, clean)
    sub.answers = clean
    sub.results = results
    sub.submitted_at = submitted_at
    sub.auto_submitted = auto
    apply_totals(sub, questions)
    if sub.status == "calificada":
        sub.graded_at = submitted_at


def finalize_expired_attempts(db: Session, ev: TeacherEvaluation, student_id: Optional[int] = None,
                              now: Optional[datetime] = None) -> int:
    """
    Envía automáticamente (con las respuestas guardadas) los intentos en curso
    cuyo tiempo, más el margen, ya pasó.
    """
    now = now or utcnow()
    limit = now - timedelta(seconds=GRACE_SECONDS)
    q = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.evaluation_id == ev.id,
        EvaluationSubmission.status == "en_curso",
        EvaluationSubmission.expires_at < limit,
    )
    if student_id is not None:
        q = q.filter(EvaluationSubmission.student_id == student_id)
    stale = q.all()
    for sub in stale:
        submit_attempt(sub, ev, sub.answers or {}, submitted_at=sub.expires_at, auto=True)
    if stale:
        refresh_submission_counter(db, ev)
        db.commit()
    return len(stale)


def refresh_submission_counter(db: Session, ev: TeacherEvaluation) -> None:
    """`teacher_evaluations.submissions` = intentos enviados (dato real)."""
    ev.submissions = db.query(EvaluationSubmission).filter(
        EvaluationSubmission.evaluation_id == ev.id,
        EvaluationSubmission.status != "en_curso",
    ).count()


def official_submission(subs: List[EvaluationSubmission]) -> Optional[EvaluationSubmission]:
    """
    Resultado oficial del estudiante: el mejor intento calificado. Si aún no
    hay ninguno calificado, el más reciente pendiente de revisión.
    """
    graded = [s for s in subs if s.status == "calificada"]
    if graded:
        return max(graded, key=lambda s: (s.percentage or 0, s.submitted_at or s.started_at))
    pending = [s for s in subs if s.status == "pendiente_revision"]
    if pending:
        return max(pending, key=lambda s: s.submitted_at or s.started_at)
    return None


def iso(dt: Optional[datetime]) -> Optional[str]:
    """ISO 8601 en UTC con sufijo Z (el frontend lo convierte a hora local)."""
    return dt.replace(microsecond=0).isoformat() + "Z" if dt else None
