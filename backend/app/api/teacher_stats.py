"""
NeuroLearn AI – Teacher Stats API
Endpoint de estadísticas agregadas para el panel del profesor.

Este endpoint entrega ÚNICAMENTE datos calculados a partir de registros reales
en la base de datos (clases, inscripciones, quizzes, sesiones de aprendizaje y
alertas). Ningún valor se inventa ni se rellena: si no hay datos para un
indicador, se devuelve vacío / 0 / null y el frontend muestra el estado
correspondiente ("Sin datos suficientes").
"""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.classroom import Classroom, Enrollment
from app.models.expert_bot import ExpertBot
from app.models.learning import LearningSession, QuizHistory
from app.models.events import ClassroomEvent

router = APIRouter(prefix="/teacher", tags=["Teacher Stats"])

SESSION_COLORS = [
    "bg-[#2E6FDB]", "bg-[#0F7B6C]", "bg-[#D9730D]",
    "bg-[#6940A5]", "bg-[#0B6E99]", "bg-[#E03E3E]",
]

# Días de lunes a sábado (6 celdas del mapa de calor semanal)
WEEK_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]


def _teacher_classroom_ids(db: Session, teacher_id: int) -> list[int]:
    """IDs de las clases activas del profesor."""
    rows = db.query(Classroom.id).filter(
        Classroom.teacher_id == teacher_id,
        Classroom.is_active == True,
    ).all()
    return [r[0] for r in rows]


def _enrolled_student_ids(db: Session, classroom_ids: list[int]) -> list[int]:
    """IDs de estudiantes activos en las clases dadas."""
    if not classroom_ids:
        return []
    rows = db.query(Enrollment.student_id).filter(
        Enrollment.classroom_id.in_(classroom_ids),
        Enrollment.is_active == True,
    ).all()
    return [r[0] for r in rows]


@router.get("/stats")
def get_teacher_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Estadísticas reales y agregadas para el panel del profesor."""
    try:
        return _compute_teacher_stats(current_user, db)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # La base de datos puede estar lenta/caída en serverless; devolver un
        # 503 controlado en lugar del 500 crudo que rompía el panel.
        raise HTTPException(
            status_code=503,
            detail=f"Servicio de estadísticas no disponible (base de datos). {str(e)[:160]}",
        )


def _compute_teacher_stats(
    current_user: User,
    db: Session,
):
    """Estadísticas reales y agregadas para el panel del profesor."""

    classroom_ids = _teacher_classroom_ids(db, current_user.id)
    student_ids = _enrolled_student_ids(db, classroom_ids)

    # ── KPIs reales ───────────────────────────────────────────────────────
    total_groups = len(classroom_ids)
    total_students = len(student_ids)
    active_bots = db.query(ExpertBot).filter(
        ExpertBot.creator_id == current_user.id,
        ExpertBot.is_active == True,
    ).count()

    # ── Promedio global (0–10) ────────────────────────────────────────────
    avg_global_raw = 0.0
    quiz_count = 0
    if student_ids:
        avg_global_raw = (
            db.query(func.avg(QuizHistory.performance_score))
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score != None,
            )
            .scalar()
            or 0.0
        )
        quiz_count = (
            db.query(func.count(QuizHistory.id))
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score != None,
            )
            .scalar()
            or 0
        )
    avg_global = round(avg_global_raw / 10, 1)
    # Índice de salud = transformación directa del promedio real (0–100)
    score = round(avg_global_raw, 0) if avg_global_raw > 0 else None

    # ── Rendimiento por tema (análisis real) ─────────────────────────────
    topics_perf = []
    if student_ids:
        topic_rows = (
            db.query(
                QuizHistory.topic,
                func.avg(QuizHistory.performance_score).label("avg_score"),
                func.count(QuizHistory.id).label("attempts"),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score != None,
                QuizHistory.topic != None,
            )
            .group_by(QuizHistory.topic)
            .order_by(func.avg(QuizHistory.performance_score).desc())
            .all()
        )
        for idx, (topic, avg, attempts) in enumerate(topic_rows):
            topics_perf.append({
                "topic": topic or "Sin tema",
                "avg":   round((avg or 0) / 10, 1),
                "attempts": int(attempts or 0),
                "color": SESSION_COLORS[idx % len(SESSION_COLORS)],
            })

    # ── Participación semanal (lunes a sábado): quizzes reales por día ──
    weekly_activity = []
    now = datetime.utcnow()
    # Recorremos los 6 últimos días (la celda más reciente = hoy o ayer).
    days_window = []
    for k in range(6):
        d = now - timedelta(days=k)
        days_window.append(d)  # más reciente primero
    days_window.reverse()  # más antiguo primero
    # Nombres de los últimos 6 días en orden cronológico
    day_counts = {}
    for d in days_window:
        key = d.strftime("%Y-%m-%d")
        day_counts[key] = 0
    if student_ids:
        from_rows = (
            db.query(
                QuizHistory.completed_at,
                func.count(QuizHistory.id),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.completed_at != None,
                QuizHistory.completed_at >= days_window[0].replace(hour=0, minute=0, second=0, microsecond=0),
            )
            .group_by(QuizHistory.completed_at)
            .all()
        )
        for ts, cnt in from_rows:
            key = ts.strftime("%Y-%m-%d")
            if key in day_counts:
                day_counts[key] += int(cnt)
    max_count = max(day_counts.values()) if day_counts else 0
    weekly_activity = [
        {
            "label": d.strftime("%a"),
            "count": day_counts[d.strftime("%Y-%m-%d")],
            "pct":   round((day_counts[d.strftime("%Y-%m-%d")] / max_count) * 100) if max_count else 0,
        }
        for d in days_window
    ]
    # Normalizar etiquetas en español (Lun..Sáb) según el día de la semana
    es_day = {0: "Lun", 1: "Mar", 2: "Mié", 3: "Jue", 4: "Vie", 5: "Sáb", 6: "Dom"}
    for item, d in zip(weekly_activity, days_window):
        item["label"] = es_day[d.weekday()]

    # ── Distribución de riesgo (real desde Enrollment.risk_level) ─────────
    risk_dist = {"bajo": 0, "medio": 0, "alto": 0}
    if student_ids:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id.in_(student_ids),
            Enrollment.is_active == True,
        ).all()
        for e in enrollments:
            rl = (e.risk_level or "none").lower()
            if rl == "high":
                risk_dist["alto"] += 1
            elif rl == "medium":
                risk_dist["medio"] += 1
            elif rl == "low":
                risk_dist["bajo"] += 1
    alert_count = risk_dist["medio"] + risk_dist["alto"]

    # ── Desempeño por grupo (solo medias reales) ─────────────────────────
    # Una sola consulta agregada (Classroom → Enrollment → QuizHistory) en
    # lugar de 3 queries por aula (N+1) que provocaba 504 en serverless.
    groups_perf = []
    if classroom_ids:
        group_agg = (
            db.query(
                Classroom.id,
                Classroom.name,
                func.avg(QuizHistory.performance_score).label("grp_avg"),
                func.count(QuizHistory.id).label("grp_count"),
            )
            .join(Enrollment, Enrollment.classroom_id == Classroom.id)
            .join(QuizHistory, QuizHistory.user_id == Enrollment.student_id)
            .filter(
                Classroom.id.in_(classroom_ids),
                Enrollment.is_active == True,
                QuizHistory.performance_score != None,
            )
            .group_by(Classroom.id, Classroom.name)
            .all()
        )
        for idx, (_, cname, gavg, gcount) in enumerate(group_agg):
            grp_avg = gavg or 0.0
            grp_count = gcount or 0
            groups_perf.append({
                "name":  cname,
                "avg":   round(grp_avg / 10, 2) if grp_avg > 0 else 0,
                "count": int(grp_count),
                "color": SESSION_COLORS[idx % len(SESSION_COLORS)],
            })
        # Solo grupos con datos reales (evita anillos en 0 rellenos)
        groups_perf = [g for g in groups_perf if g["count"] > 0]

    # ── Top estudiantes (con tendencia real) ─────────────────────────────
    # Optimización: antes esto hacía ~3 queries por estudiante (N+1). Ahora
    # usamos consultas por lotes: una para los top, una para los usuarios,
    # una para su clase y una para la tendencia de todos a la vez.
    top_students = []
    if student_ids:
        rows = (
            db.query(
                QuizHistory.user_id,
                func.avg(QuizHistory.performance_score).label("avg_score"),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score != None,
            )
            .group_by(QuizHistory.user_id)
            .order_by(func.avg(QuizHistory.performance_score).desc())
            .limit(5)
            .all()
        )
        top_ids = [row.user_id for row in rows]
        if top_ids:
            # 1) Usuarios por lote.
            users = {
                u.id: u
                for u in db.query(User)
                .filter(User.id.in_(top_ids))
                .all()
            }
            # 2) Clase (grado) de cada estudiante por lote: una fila por estudiante.
            enrollment_rows = (
                db.query(Enrollment.student_id, Classroom)
                .join(Classroom, Classroom.id == Enrollment.classroom_id)
                .filter(
                    Enrollment.student_id.in_(top_ids),
                    Enrollment.classroom_id.in_(classroom_ids),
                    Enrollment.is_active == True,
                )
                .all()
            )
            # 3) Tendencias por lote: todos los scores de los top estudiantes.
            trend_rows = (
                db.query(
                    QuizHistory.user_id,
                    QuizHistory.performance_score,
                    QuizHistory.completed_at,
                )
                .filter(
                    QuizHistory.user_id.in_(top_ids),
                    QuizHistory.performance_score != None,
                )
                .order_by(QuizHistory.completed_at.asc())
                .all()
            )
            scores_by_user: dict[int, list[float]] = {}
            for uid, s, _ in trend_rows:
                scores_by_user.setdefault(uid, []).append(s)

            for row in rows:
                uid = row.user_id
                student = users.get(uid)
                if not student:
                    continue
                # grado de su clase (primer classroom encontrado en el lote)
                grade_label = None
                for sid, cls in enrollment_rows:
                    if sid == uid:
                        grade_label = cls.grade or "—"
                        break
                # Tendencia real: promedio de la mitad más reciente vs la más antigua
                scores = [s for s in scores_by_user.get(uid, []) if s is not None]
                trend = None
                if len(scores) >= 2:
                    split = len(scores) // 2
                    old = sum(scores[:split]) / split
                    recent = sum(scores[split:]) / (len(scores) - split)
                    delta = round((recent - old) / 10, 1)
                    trend = f"{'+' if delta >= 0 else ''}{delta}" if abs(delta) >= 0.1 else "0.0"

                top_students.append({
                    "name":  student.full_name or student.username,
                    "group": grade_label,
                    "avg":   round((row.avg_score or 0) / 10, 1),
                    "trend": trend,
                })

    # ── Próximos eventos (this + next month) ─────────────────────────────
    today = datetime.utcnow().date()
    next_month = (today.replace(day=1) + timedelta(days=32)).replace(day=1)
    cutoff = next_month.replace(
        month=next_month.month % 12 + 1 if next_month.month < 12 else 1,
        year=next_month.year + (1 if next_month.month == 12 else 0),
    )
    upcoming_events = (
        db.query(ClassroomEvent)
        .filter(
            ClassroomEvent.classroom_id.in_(classroom_ids + [None]),
            ClassroomEvent.event_date >= today.isoformat(),
            ClassroomEvent.event_date < cutoff.isoformat(),
            ClassroomEvent.is_active == True,
        )
        .order_by(ClassroomEvent.event_date)
        .limit(5)
        .all()
    )
    upcoming = []
    for ev in upcoming_events:
        ev_date = ev.event_date
        if ev_date == today.isoformat():
            label_date = "Hoy"
        elif ev_date == (today + timedelta(days=1)).isoformat():
            label_date = "Mañana"
        else:
            try:
                d = datetime.strptime(ev_date, "%Y-%m-%d")
                label_date = d.strftime("%-d %b").capitalize()
            except Exception:
                label_date = ev_date

        color_map = {
            "examen": "bg-[#E03E3E]",
            "tarea":  "bg-[#D9730D]",
            "clase":  "bg-[#2E6FDB]",
            "evento": "bg-[#0F7B6C]",
        }
        upcoming.append({
            "type":  ev.event_type,
            "label": ev.title,
            "date":  label_date,
            "color": color_map.get(ev.event_type, "bg-[#6940A5]"),
        })

    # ── Uso de IA (real: usuarios totales por bot) ───────────────────────
    my_bots = db.query(ExpertBot).filter(
        ExpertBot.creator_id == current_user.id,
    ).all()
    ai_usage = []
    if my_bots:
        max_val = max((b.total_users or 0) for b in my_bots) or 1
        for bot in my_bots[:3]:
            total = bot.total_users or 0
            ai_usage.append({
                "name":  bot.name,
                "pct":   round((total / max_val) * 100) if max_val > 0 else 0,
                "color": "bg-[#6940A5]",
            })

    has_data = len(student_ids) > 0 and quiz_count > 0

    return {
        "total_groups":   total_groups,
        "total_students": total_students,
        "active_bots":    active_bots,
        "avg_global":     avg_global,
        "score":          score,
        "has_data":       bool(has_data),
        "alert_count":    alert_count,
        "risk_dist":      risk_dist,
        "groups_perf":    groups_perf,
        "top_students":   top_students,
        "topics_perf":    topics_perf,
        "weekly_activity": weekly_activity,
        "upcoming":       upcoming,
        "ai_usage":       ai_usage,
    }