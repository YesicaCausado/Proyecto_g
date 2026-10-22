from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from app.db.database import get_db
from app.models.user import User, UserRole
from app.models.learning import QuizHistory, LearningSession, CognitiveEvent
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    
    # Filtro común para todas las métricas de quizzes completados.
    _completed_filter = (
        QuizHistory.user_id == user_id,
        QuizHistory.completed_at.isnot(None),
        QuizHistory.performance_score.isnot(None),
        QuizHistory.user_score.isnot(None),
    )

    # 1–4. Una sola query agregada en lugar de 3 queries separadas
    #     (sum questions, avg performance, sum time) + una para topics.
    agg = db.query(
        func.sum(QuizHistory.questions_count),
        func.avg(QuizHistory.performance_score),
        func.sum(QuizHistory.time_spent_seconds),
    ).filter(*_completed_filter).one()

    total_exercises = agg[0] or 0
    avg_performance = agg[1] or 0
    total_study_time_seconds = agg[2] or 0
    # Competencias practicadas (de 5): antes se contaban temas distintos,
    # que podían superar 5 con textos de tema diferentes.
    practiced = {
        _classify(topic, competency)
        for topic, competency in db.query(QuizHistory.topic, QuizHistory.competency)
        .filter(*_completed_filter).distinct().all()
    }
    active_skills_count = len(practiced - {"otros"})

    # 2. Total Class Sessions
    total_classes = db.query(LearningSession).filter(
        LearningSession.user_id == user_id
    ).count()

    # 4. Tiempo de estudio: SOLO el tiempo medido de los quizzes completados.
    # Antes se sumaban 0,5 h ficticias por cada sesión de chat.
    total_study_hours = total_study_time_seconds / 3600

    return {
        # None = aún no hay quizzes completados (no es un 0 % de progreso)
        "progress_percentage": int(round(avg_performance)) if agg[1] is not None else None,
        "total_exercises": int(total_exercises),
        "total_classes": total_classes,
        "active_skills": active_skills_count,
        "study_hours": round(total_study_hours, 1)
    }


# ─── SUBJECT KEYWORD MAP ───────────────────────────────────────────────────────
# Incluye formas acentuadas y nombres de competencia para que los topics que
# envía el frontend (competencia completa) se agrupen correctamente por materia
# en la sección de desempeño.
_SUBJECT_MAP = {
    "matematicas": ["matematica", "matemátic", "algebra", "álgebra", "geometria",
                    "geométr", "trigonometria", "calculo", "estadistica",
                    "estadístic", "probabilidad", "aritmetica", "numerica",
                    "funcion", "ecuaci", "razonamiento cuantitativ", "math"],
    "lectura":     ["lectura", "lector", "comprension", "comprensión", "critica",
                    "crítica", "literatura", "texto", "español", "comunicacion",
                    "reading", "idea principal", "inferencia", "argumentacion"],
    "ingles":      ["ingles", "inglés", "english", "grammar", "vocabulary",
                    "idioma", "comunicativa en inglés"],
    "ciencias":    ["ciencia", "ciencias", "cientifico", "científico", "biologia",
                    "biolog", "quimica", "química", "fisica", "física",
                    "naturaleza", "nature", "metodo científico", "ecología"],
    "sociales":    ["social", "sociales", "historia", "geografia", "geografía",
                    "ciudadana", "ciudadan", "democraci", "derecho", "econom",
                    "económ", "politica", "política", "colombia", "constituc",
                    "pensamiento crítico"],
}

_SUBJECT_LABELS = {
    "matematicas": "Matemáticas",
    "lectura":     "Lectura Crítica",
    "ingles":      "Inglés",
    "ciencias":    "Ciencias",
    "sociales":    "Sociales",
}

_DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]  # 0=Mon


# Competencia (app/services/competencies.py) → materia de esta sección.
_COMPETENCY_SUBJECT = {
    "matematicas": "matematicas",
    "lectora":     "lectura",
    "ingles":      "ingles",
    "ciudadanas":  "sociales",
    "cientifico":  "ciencias",
}


def _classify(topic: str, competency: str | None = None) -> str:
    """Materia de un quiz: su competencia registrada (la misma que usan el
    progreso del grupo y los reportes) o, en quizzes antiguos sin ella, las
    palabras clave del tema."""
    if competency in _COMPETENCY_SUBJECT:
        return _COMPETENCY_SUBJECT[competency]
    tl = (topic or "").lower()
    for subj, kws in _SUBJECT_MAP.items():
        if any(kw in tl for kw in kws):
            return subj
    return "otros"


def _avg(entries, field="performance_score"):
    vals = [getattr(e, field) for e in entries if getattr(e, field) is not None]
    return round(sum(vals) / len(vals), 1) if vals else 0


def _build_cognitive_summary_from_events(events) -> dict:
    """Deriva indicadores cognitivos desde los eventos neuroconductuales guardados.

    Solo cuentan los eventos cuyo estado se infirió con evidencia suficiente
    (≥ 2 fuentes válidas, `event_data.sufficient_evidence`). Los eventos
    anteriores a la auditoría no llevan esa marca: se calcularon con valores
    sustituidos por defaults y no se usan. Sin eventos válidos los indicadores
    son None (no 0 %).
    """
    empty = {"fatigue": None, "overload": None, "doubt": None, "mastery": None}
    events = [e for e in (events or []) if (e.event_data or {}).get("sufficient_evidence") is True]
    if not events:
        return empty

    state_counts = {"fatigue": 0, "overload": 0, "doubt": 0, "mastery": 0, "flow": 0, "normal": 0}
    for event in events:
        payload = event.event_data or {}
        state = (payload.get("cognitive_state") or event.inferred_state or "normal").strip().lower()
        if state in {"focused", "flow"}:
            state = "flow"
        elif state in {"confused", "confusion"}:
            state = "doubt"
        elif state in {"struggling", "overload"}:
            state = "overload"
        elif state in {"stressed", "fatigue"}:
            state = "fatigue"
        elif state in {"happy", "mastery"}:
            state = "mastery"
        elif state in {"neutral", "normal"}:
            state = "normal"

        if state in state_counts:
            state_counts[state] += 1

    total = sum(state_counts.values())
    if total == 0:
        return empty

    fatigue = int((state_counts["fatigue"] / total) * 100)
    overload = int((state_counts["overload"] / total) * 100)
    doubt = int((state_counts["doubt"] / total) * 100)
    mastery = int(((state_counts["mastery"] + state_counts["flow"]) / total) * 100)

    return {"fatigue": fatigue, "overload": overload, "doubt": doubt, "mastery": mastery}


@router.get("/performance")
def get_performance_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Análisis detallado de desempeño para la sección Desempeño:
    estadísticas por materia, gráfico semanal, calendario 28 días,
    indicadores cognitivos derivados, logros y distribución horaria.
    """
    user_id = current_user.id
    now = datetime.utcnow()
    today = now.date()

    # ── 1. Historial completo de quizzes completados ─────────────────────────
    all_history = (
        db.query(QuizHistory)
        .filter(
            QuizHistory.user_id == user_id,
            QuizHistory.completed_at.isnot(None),
            QuizHistory.performance_score.isnot(None),
            QuizHistory.user_score.isnot(None),
        )
        .order_by(QuizHistory.completed_at.desc())
        .all()
    )

    # ── 2. Agrupar por materia ────────────────────────────────────────────────
    cutoff_cur  = now - timedelta(days=14)
    cutoff_prev = now - timedelta(days=28)

    subject_all  = defaultdict(list)
    subject_cur  = defaultdict(list)
    subject_prev = defaultdict(list)

    for e in all_history:
        s = _classify(e.topic, e.competency)
        subject_all[s].append(e)
        if e.completed_at >= cutoff_cur:
            subject_cur[s].append(e)
        elif e.completed_at >= cutoff_prev:
            subject_prev[s].append(e)

    # ── 3. Stats por materia ──────────────────────────────────────────────────
    subjects_out: dict = {}
    for subj in _SUBJECT_MAP:
        cur_  = subject_cur.get(subj, [])
        prev_ = subject_prev.get(subj, [])
        all_  = subject_all.get(subj, [])

        # Sin quizzes en la materia: score None (no 0 %). La tendencia solo se
        # calcula si hay un período anterior comparable (antes prev=0 hacía
        # que cualquier nota apareciera como una mejora de +nota puntos).
        score      = (_avg(cur_) if cur_ else _avg(all_[:5])) if all_ else None
        prev_score = _avg(prev_) if prev_ else None

        time_entries = [e for e in all_ if e.time_spent_seconds]
        avg_time = round(
            sum(e.time_spent_seconds for e in time_entries) / len(time_entries) / 60, 1
        ) if time_entries else 0

        strengths = list({e.topic[:30] for e in all_ if (e.performance_score or 0) >= 80})[:2]

        wc_all: list = []
        for e in all_:
            if e.weak_concepts:
                wc_all.extend(e.weak_concepts[:2])
        top_weak = [w for w, _ in Counter(wc_all).most_common(2)]

        subjects_out[subj] = {
            "score":        score,
            "prev_score":   prev_score,
            "trend":        round(score - prev_score, 1)
                            if score is not None and prev_score is not None else None,
            "quizzes":      len(all_),
            "avg_time_min": avg_time,
            "topics":       list({e.topic for e in all_})[:3],
            "strengths":    strengths if strengths else ["Sin datos aún"],
            "weaknesses":   top_weak  if top_weak  else ["Sin datos aún"],
        }

    # ── 4. Datos semanales (últimos 7 días) ───────────────────────────────────
    weekly = []
    for offset in range(6, -1, -1):
        d  = today - timedelta(days=offset)
        ds = datetime(d.year, d.month, d.day)
        de = ds + timedelta(days=1)
        day_entries = [e for e in all_history if ds <= e.completed_at < de]
        weekly.append({
            "day":   _DAYS_ES[d.weekday()],
            "score": _avg(day_entries),
            "hours": round(sum(e.time_spent_seconds or 0 for e in day_entries) / 3600, 1),
        })

    # ── 5. Calendario 28 días (nivel 0–3) ────────────────────────────────────
    calendar: list = []
    for offset in range(27, -1, -1):
        d  = today - timedelta(days=offset)
        ds = datetime(d.year, d.month, d.day)
        de = ds + timedelta(days=1)
        cnt = sum(1 for e in all_history if ds <= e.completed_at < de)
        calendar.append(0 if cnt == 0 else 1 if cnt == 1 else 2 if cnt == 2 else 3)

    # ── 6. Historial reciente (últimos 10) ───────────────────────────────────
    recent: list = []
    for e in all_history[:10]:
        sk    = _classify(e.topic, e.competency)
        delta = now - e.completed_at
        if delta.days == 0:
            hrs   = int(delta.total_seconds() / 3600)
            fecha = (f"Hoy, {e.completed_at.strftime('%H:%M')}" if hrs >= 1
                     else f"Hace {int(delta.total_seconds() / 60)} min")
        elif delta.days == 1:
            fecha = f"Ayer, {e.completed_at.strftime('%H:%M')}"
        else:
            fecha = f"Hace {delta.days} días"
        parts = e.user_score.split("/") if e.user_score else ["0", str(e.questions_count)]
        recent.append({
            "materia":   _SUBJECT_LABELS.get(sk, e.topic[:20]),
            "topic_key": sk,
            "fecha":     fecha,
            "score":     int(parts[0]) if parts and parts[0].isdigit() else 0,
            "total":     int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else e.questions_count,
            "tiempo":    f"{round(e.time_spent_seconds / 60)}min" if e.time_spent_seconds else "—",
            "diff":      e.difficulty or "Medio",
        })

    # ── 7. Overview global ────────────────────────────────────────────────────
    total_q       = len(all_history)
    total_correct = sum(e.correct_answers or 0 for e in all_history)
    total_wrong   = sum(e.wrong_answers   or 0 for e in all_history)
    total_ans     = total_correct + total_wrong
    precision     = round(total_correct / total_ans * 100, 1) if total_ans else 0
    avg_sc        = _avg(all_history)
    total_secs    = sum(e.time_spent_seconds or 0 for e in all_history)
    total_hours   = round(total_secs / 3600, 1)

    total_xp = total_correct * 10 + sum(
        50 for e in all_history if (e.performance_score or 0) >= 80
    )

    week_cut      = now - timedelta(days=7)
    prev_week_cut = now - timedelta(days=14)
    this_week = [e for e in all_history if e.completed_at >= week_cut]
    prev_week = [e for e in all_history if prev_week_cut <= e.completed_at < week_cut]
    weekly_avg      = _avg(this_week)
    prev_weekly_avg = _avg(prev_week)

    # ── 8. Racha (streak) ─────────────────────────────────────────────────────
    streak = 0
    today_ds = datetime(today.year, today.month, today.day)
    today_de = today_ds + timedelta(days=1)
    today_active = any(today_ds <= e.completed_at < today_de for e in all_history)
    start_offset = 0 if today_active else 1
    for i in range(start_offset, 366):
        d  = today - timedelta(days=i)
        ds = datetime(d.year, d.month, d.day)
        de = ds + timedelta(days=1)
        if any(ds <= e.completed_at < de for e in all_history):
            streak += 1
        else:
            break

    # ── 9. Indicadores cognitivos reales (entradas neuroconductuales) ────────
    recent_events = (
        db.query(CognitiveEvent)
        .filter(CognitiveEvent.user_id == user_id)
        .order_by(CognitiveEvent.timestamp.desc())
        .limit(30)
        .all()
    )
    event_cognitive = _build_cognitive_summary_from_events(recent_events)

    # Sin eventos con evidencia suficiente los indicadores quedan en None.
    # Antes se inventaban (fatiga=25, duda=25, sobrecarga = segundos por
    # pregunta × 1,2, dominio = nota media) y se mostraban como mediciones.
    fatigue  = event_cognitive["fatigue"]
    overload = event_cognitive["overload"]
    doubt    = event_cognitive["doubt"]
    mastery  = event_cognitive["mastery"]
    valid_events = [e for e in recent_events
                    if (e.event_data or {}).get("sufficient_evidence") is True]
    cognitive_meta = {
        "status": "available" if valid_events else "unavailable",
        "reason": None if valid_events else
        "No hay análisis neuroconductuales con evidencia suficiente.",
        "events_used": len(valid_events),
        "last_measured_at": (valid_events[0].timestamp.isoformat() + "Z")
        if valid_events and valid_events[0].timestamp else None,
        "label": "Estimación experimental del sistema; no es un diagnóstico.",
    }

    # ── 10. Logros ────────────────────────────────────────────────────────────
    math_80       = len([e for e in subject_all.get("matematicas", []) if (e.performance_score or 0) >= 80])
    reading_count = len(subject_all.get("lectura", []))
    has_perfect   = any((e.performance_score or 0) >= 100 for e in all_history)
    fast_quiz     = any(
        e.time_spent_seconds and e.time_spent_seconds < 300 and (e.performance_score or 0) >= 60
        for e in all_history
    )
    best_pct = max((e.performance_score or 0) for e in all_history) if all_history else 0
    min_time = min((e.time_spent_seconds for e in all_history if e.time_spent_seconds), default=9999)

    achievements = [
        {
            "key": "streak_5",    "icon": "🔥", "title": "Racha de 5 días",
            "desc": "5 días de estudio seguidos",
            "earned": streak >= 5, "pts": 50,
            "progress": min(100, int(streak / 5 * 100)),
        },
        {
            "key": "perfect",     "icon": "🎯", "title": "Precisión perfecta",
            "desc": "10/10 en un quiz",
            "earned": has_perfect, "pts": 100,
            "progress": 100 if has_perfect else min(99, int(best_pct)),
        },
        {
            "key": "speed",       "icon": "⚡", "title": "Velocidad relámpago",
            "desc": "Quiz completado en < 5 min",
            "earned": fast_quiz,  "pts": 75,
            "progress": 100 if fast_quiz else min(90, int((1 - min(min_time / 300, 1)) * 100)),
        },
        {
            "key": "100_correct", "icon": "💡", "title": "Mente brillante",
            "desc": "100 respuestas correctas",
            "earned": total_correct >= 100, "pts": 80,
            "progress": min(100, total_correct),
        },
        {
            "key": "reader",      "icon": "📚", "title": "Lector voraz",
            "desc": "10 quizzes de Lectura Crítica",
            "earned": reading_count >= 10, "pts": 150,
            "progress": min(100, int(reading_count / 10 * 100)),
        },
        {
            "key": "math_master", "icon": "🧮", "title": "Maestro del Álgebra",
            "desc": ">80% en 5 quizzes de Matemáticas",
            "earned": math_80 >= 5, "pts": 200,
            "progress": min(100, int(math_80 / 5 * 100)),
        },
        {
            "key": "streak_month","icon": "🌟", "title": "Estudiante del mes",
            "desc": "Racha de 20 días seguidos",
            "earned": streak >= 20, "pts": 300,
            "progress": min(100, int(streak / 20 * 100)),
        },
        {
            "key": "champion",    "icon": "🏆", "title": "Campeón Saber 11",
            "desc": "Promedio >85% en todas las materias",
            "earned": avg_sc >= 85, "pts": 500,
            "progress": min(100, int(avg_sc / 85 * 100)),
        },
    ]

    # ── 11. Distribución horaria (24 h, normalizada 0–60) ─────────────────────
    hourly_raw = [0] * 24
    for e in all_history:
        if e.time_spent_seconds:   # sin tiempo medido no se suma (antes 60 s)
            hourly_raw[e.completed_at.hour] += e.time_spent_seconds // 60
    max_h = max(hourly_raw) if any(hourly_raw) else 1
    hourly = [min(60, int(v / max_h * 60)) for v in hourly_raw]

    # ── 12. Mejor día / mejor hora ────────────────────────────────────────────
    scored_days  = [w for w in weekly if w["score"]]
    best_day     = max(scored_days, key=lambda x: x["score"])["day"] if scored_days else None
    # Sin datos horarios no hay "mejor hora" (antes 15:00 por defecto).
    peak_h       = hourly.index(max(hourly)) if any(hourly) else None
    best_time    = f"{peak_h}:00 – {(peak_h + 4) % 24}:00" if peak_h is not None else None
    days_active  = sum(1 for v in calendar if v > 0)
    consistency  = round(days_active / 28 * 100)
    avg_session  = round(
        (total_secs / total_q / 60) if total_q > 0 else 0
    )

    return {
        "subjects":            subjects_out,
        "weekly":              weekly,
        "calendar":            calendar,
        "recent_history":      recent,
        "overview": {
            "avg_score":       avg_sc,
            "total_quizzes":   total_q,
            "total_xp":        total_xp,
            "streak_days":     streak,
            "total_hours":     total_hours,
            "precision":       precision,
            "weekly_avg":      weekly_avg,
            "prev_weekly_avg": prev_weekly_avg,
            "weekly_diff":     round(weekly_avg - prev_weekly_avg, 1),
            "total_correct":   total_correct,
            "best_day":        best_day,
            "best_time":       best_time,
            "consistency_pct": consistency,
            "avg_session_min": avg_session,
        },
        "cognitive": {
            "fatigue":  fatigue,
            "overload": overload,
            "doubt":    doubt,
            "mastery":  mastery,
        },
        "cognitive_meta": cognitive_meta,
        "achievements":        achievements,
        "hourly_distribution": hourly,
    }