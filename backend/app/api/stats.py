from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from collections import defaultdict, Counter
from app.db.database import get_db
from app.models.user import User
from app.models.learning import QuizHistory, LearningSession
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    
    # 1. Total Exercises (sum of questions answered in quizzes)
    total_exercises = db.query(func.sum(QuizHistory.questions_count)).filter(
        QuizHistory.user_id == user_id
    ).scalar() or 0
    
    # 2. Total Class Sessions
    total_classes = db.query(LearningSession).filter(
        LearningSession.user_id == user_id
    ).count()
    
    # 3. Overall Progress (%)
    avg_performance = db.query(func.avg(QuizHistory.performance_score)).filter(
        QuizHistory.user_id == user_id,
        QuizHistory.performance_score != None
    ).scalar() or 0
    
    # 4. Total Study Time (hours)
    # Estimate based on learning sessions 
    # (Here we sum session time if added later, but for now we fallback to standard 1 hour per session approximation or use Quiz time spent if we had it populated always)
    total_study_time_seconds = db.query(func.sum(QuizHistory.time_spent_seconds)).filter(
        QuizHistory.user_id == user_id
    ).scalar() or 0
    total_study_hours = (total_study_time_seconds / 3600) + (total_classes * 0.5) 
    
    # 5. Active Skills (Topics attempted)
    active_skills_query = db.query(QuizHistory.topic).filter(
        QuizHistory.user_id == user_id
    ).distinct().all()
    active_skills_count = len(active_skills_query)
    
    return {
        "progress_percentage": int(avg_performance),
        "total_exercises": int(total_exercises),
        "total_classes": total_classes,
        "active_skills": active_skills_count,
        "study_hours": round(total_study_hours, 1)
    }


# ─── SUBJECT KEYWORD MAP ───────────────────────────────────────────────────────
_SUBJECT_MAP = {
    "matematicas": ["matematica", "algebra", "geometria", "trigonometria",
                    "calculo", "estadistica", "probabilidad", "aritmetica",
                    "numerica", "math"],
    "lectura":     ["lectura", "comprension", "critica", "literatura",
                    "texto", "español", "comunicacion", "reading"],
    "ingles":      ["ingles", "english", "grammar", "vocabulary", "idioma"],
    "ciencias":    ["ciencia", "biologia", "quimica", "fisica", "naturaleza",
                    "nature", "ciencias"],
    "sociales":    ["social", "historia", "geografia", "ciudadana", "politica",
                    "colombia", "constituc"],
}

_SUBJECT_LABELS = {
    "matematicas": "Matemáticas",
    "lectura":     "Lectura Crítica",
    "ingles":      "Inglés",
    "ciencias":    "Ciencias",
    "sociales":    "Sociales",
}

_DAYS_ES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]  # 0=Mon


def _classify(topic: str) -> str:
    tl = topic.lower()
    for subj, kws in _SUBJECT_MAP.items():
        if any(kw in tl for kw in kws):
            return subj
    return "otros"


def _avg(entries, field="performance_score"):
    vals = [getattr(e, field) for e in entries if getattr(e, field) is not None]
    return round(sum(vals) / len(vals), 1) if vals else 0


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
        s = _classify(e.topic)
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

        score      = _avg(cur_) or _avg(all_[:5]) or 0
        prev_score = _avg(prev_) or 0

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
            "trend":        round(score - prev_score, 1),
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
        sk    = _classify(e.topic)
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
            "score":     int(parts[0]) if parts[0].isdigit() else 0,
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

    # ── 9. Indicadores cognitivos (derivados de patrones) ─────────────────────
    recent5 = all_history[:5]
    if len(recent5) >= 3:
        diff_fatigue = _avg(recent5[:2]) - _avg(recent5[2:])
        fatigue = min(90, max(10, int((diff_fatigue + 30) * 1.5)))
    else:
        fatigue = 25

    avg_t_per_q = (
        sum((e.time_spent_seconds or 0) / max(e.questions_count, 1) for e in recent5) / len(recent5)
        if recent5 else 60
    )
    overload = min(90, max(10, int(avg_t_per_q * 1.2)))

    last3 = all_history[:3]
    if last3:
        tot3   = sum(e.questions_count for e in last3)
        wrong3 = sum(e.wrong_answers or 0 for e in last3)
        doubt  = min(90, max(10, int(wrong3 / max(tot3, 1) * 100 * 0.8)))
    else:
        doubt = 25

    mastery = min(95, max(5, int(avg_sc)))

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
        hourly_raw[e.completed_at.hour] += (e.time_spent_seconds or 60) // 60
    max_h = max(hourly_raw) if any(hourly_raw) else 1
    hourly = [min(60, int(v / max_h * 60)) for v in hourly_raw]

    # ── 12. Mejor día / mejor hora ────────────────────────────────────────────
    best_day_obj = max(weekly, key=lambda x: x["score"], default={"day": "—"})
    best_day     = best_day_obj["day"]
    peak_h       = hourly.index(max(hourly)) if any(hourly) else 15
    best_time    = f"{peak_h}:00 – {(peak_h + 4) % 24}:00"
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
        "achievements":        achievements,
        "hourly_distribution": hourly,
    }
