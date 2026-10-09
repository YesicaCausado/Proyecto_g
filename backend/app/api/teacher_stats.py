"""
NeuroLearn AI – Teacher Stats API

Estadísticas agregadas para el panel del profesor.

Todas las métricas se calculan a partir de información existente
en la base de datos. No se generan datos ficticios.
"""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.expert_bot import ExpertBot
from app.models.learning import QuizHistory
from app.models.events import ClassroomEvent


router = APIRouter(
    prefix="/teacher",
    tags=["Teacher Stats"],
)


SESSION_COLORS = [
    "bg-[#2E6FDB]",
    "bg-[#0F7B6C]",
    "bg-[#D9730D]",
    "bg-[#6940A5]",
    "bg-[#0B6E99]",
    "bg-[#E03E3E]",
]


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def _teacher_classroom_ids(
    db: Session,
    teacher_id: int,
) -> list[int]:
    """
    Devuelve los IDs de las clases activas pertenecientes
    al profesor.
    """

    rows = (
        db.query(Classroom.id)
        .filter(
            Classroom.teacher_id == teacher_id,
            Classroom.is_active.is_(True),
        )
        .all()
    )

    return [row[0] for row in rows]


def _enrolled_student_ids(
    db: Session,
    classroom_ids: list[int],
) -> list[int]:
    """
    Devuelve los IDs de estudiantes activos inscritos
    en las clases indicadas.
    """

    if not classroom_ids:
        return []

    rows = (
        db.query(Enrollment.student_id)
        .filter(
            Enrollment.classroom_id.in_(classroom_ids),
            Enrollment.is_active.is_(True),
        )
        .distinct()
        .all()
    )

    return [row[0] for row in rows]


# ============================================================
# ENDPOINT PRINCIPAL
# ============================================================

@router.get("/stats")
def get_teacher_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve las estadísticas reales necesarias para
    el Dashboard del profesor.
    """

    # --------------------------------------------------------
    # VALIDACIÓN DE ROL
    # --------------------------------------------------------

    allowed_roles = (
        UserRole.PROFESOR.value,
        UserRole.SUPER_PROFESOR.value,
        UserRole.ADMIN.value,
    )

    if current_user.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Las estadísticas de docente solo están disponibles para profesores.",
        )

    try:
        return _compute_teacher_stats(
            current_user=current_user,
            db=db,
        )

    except HTTPException:
        raise

    except Exception as exc:
        # Mostrar el error real en los logs de Vercel,
        # pero no devolver un traceback al frontend.
        import traceback

        traceback.print_exc()

        raise HTTPException(
            status_code=503,
            detail="No fue posible calcular las estadísticas en este momento. Intenta de nuevo.",
        )


# ============================================================
# CÁLCULO DE ESTADÍSTICAS
# ============================================================

def _compute_teacher_stats(
    current_user: User,
    db: Session,
):
    # ========================================================
    # 1. CLASES Y ESTUDIANTES
    # ========================================================

    classroom_ids = _teacher_classroom_ids(
        db,
        current_user.id,
    )

    student_ids = _enrolled_student_ids(
        db,
        classroom_ids,
    )

    total_groups = len(classroom_ids)
    total_students = len(student_ids)

    # ========================================================
    # 2. NEUROBOTS ACTIVOS
    # ========================================================

    active_bots = (
        db.query(func.count(ExpertBot.id))
        .filter(
            ExpertBot.creator_id == current_user.id,
            ExpertBot.is_active.is_(True),
        )
        .scalar()
        or 0
    )

    # ========================================================
    # 3. PROMEDIO GLOBAL
    # ========================================================

    avg_global_raw = 0.0
    quiz_count = 0

    if student_ids:

        avg_global_raw = (
            db.query(
                func.avg(
                    QuizHistory.performance_score
                )
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score.isnot(None),
            )
            .scalar()
            or 0.0
        )

        quiz_count = (
            db.query(
                func.count(QuizHistory.id)
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score.isnot(None),
            )
            .scalar()
            or 0
        )

    avg_global = round(
        float(avg_global_raw) / 10,
        1,
    )

    score = (
        round(float(avg_global_raw), 0)
        if float(avg_global_raw) > 0
        else None
    )

    # ========================================================
    # 4. RENDIMIENTO POR TEMA
    # ========================================================

    topics_perf = []

    if student_ids:

        topic_rows = (
            db.query(
                QuizHistory.topic,
                func.avg(
                    QuizHistory.performance_score
                ).label("avg_score"),
                func.count(
                    QuizHistory.id
                ).label("attempts"),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score.isnot(None),
                QuizHistory.topic.isnot(None),
            )
            .group_by(
                QuizHistory.topic
            )
            .order_by(
                func.avg(
                    QuizHistory.performance_score
                ).desc()
            )
            .all()
        )

        for idx, row in enumerate(topic_rows):

            topic = row[0]
            avg = row[1]
            attempts = row[2]

            topics_perf.append(
                {
                    "topic": topic or "Sin tema",
                    "avg": round(
                        float(avg or 0) / 10,
                        1,
                    ),
                    "attempts": int(
                        attempts or 0
                    ),
                    "color": SESSION_COLORS[
                        idx % len(SESSION_COLORS)
                    ],
                }
            )

    # ========================================================
    # 5. ACTIVIDAD DE LOS ÚLTIMOS 6 DÍAS
    # ========================================================

    now = datetime.utcnow()

    days_window = []

    for k in range(6):
        d = now - timedelta(days=k)
        days_window.append(d)

    days_window.reverse()

    day_counts = {
        d.strftime("%Y-%m-%d"): 0
        for d in days_window
    }

    if student_ids:

        start_date = days_window[0].replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

        activity_rows = (
            db.query(
                QuizHistory.completed_at,
                func.count(QuizHistory.id),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.completed_at.isnot(None),
                QuizHistory.completed_at >= start_date,
            )
            .group_by(
                QuizHistory.completed_at
            )
            .all()
        )

        for timestamp, count in activity_rows:

            if timestamp is None:
                continue

            key = timestamp.strftime(
                "%Y-%m-%d"
            )

            if key in day_counts:
                day_counts[key] += int(
                    count or 0
                )

    max_count = (
        max(day_counts.values())
        if day_counts
        else 0
    )

    es_day = {
        0: "Lun",
        1: "Mar",
        2: "Mié",
        3: "Jue",
        4: "Vie",
        5: "Sáb",
        6: "Dom",
    }

    weekly_activity = []

    for d in days_window:

        key = d.strftime(
            "%Y-%m-%d"
        )

        count = day_counts[key]

        percentage = (
            round(
                (count / max_count) * 100
            )
            if max_count
            else 0
        )

        weekly_activity.append(
            {
                "label": es_day[
                    d.weekday()
                ],
                "count": count,
                "pct": percentage,
            }
        )

    # ========================================================
    # 6. DISTRIBUCIÓN DE RIESGO
    # ========================================================

    # Se calcula con el historial REAL de quizzes de cada estudiante (antes
    # leía Enrollment.risk_level, que solo tomaba «none»/«high» y casi nunca
    # se actualizaba: «bajo» y «medio» salían siempre en 0). Mismos umbrales
    # que el servicio de seguimiento (enrollment_tracking_service).
    from app.services.enrollment_tracking_service import (
        INACTIVITY_HIGH_RISK_DAYS, INACTIVITY_MEDIUM_RISK_DAYS,
        LOW_SCORE_THRESHOLD, MIN_SESSIONS_FOR_SCORE_RISK,
    )
    risk_dist = {"bajo": 0, "medio": 0, "alto": 0, "sin_actividad": 0}

    if student_ids:
        rows = (
            db.query(
                QuizHistory.user_id,
                func.avg(QuizHistory.performance_score),
                func.count(QuizHistory.id),
                func.max(QuizHistory.completed_at),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.completed_at.isnot(None),
                QuizHistory.performance_score.isnot(None),
            )
            .group_by(QuizHistory.user_id)
            .all()
        )
        by_student = {uid: (float(avg or 0), int(n or 0), last) for uid, avg, n, last in rows}
        now = datetime.utcnow()
        for sid in set(student_ids):
            if sid not in by_student:
                risk_dist["sin_actividad"] += 1
                continue
            avg, n, last = by_student[sid]
            idle_days = (now - last).days if last else 0
            if idle_days >= INACTIVITY_HIGH_RISK_DAYS or (
                    n >= MIN_SESSIONS_FOR_SCORE_RISK and avg < LOW_SCORE_THRESHOLD):
                risk_dist["alto"] += 1
            elif idle_days >= INACTIVITY_MEDIUM_RISK_DAYS or avg < 60:
                risk_dist["medio"] += 1
            else:
                risk_dist["bajo"] += 1

    alert_count = (
        risk_dist["medio"]
        + risk_dist["alto"]
    )

    # ========================================================
    # 7. RENDIMIENTO POR GRUPO
    # ========================================================

    groups_perf = []

    if classroom_ids:

        group_rows = (
            db.query(
                Classroom.id,
                Classroom.name,
                func.avg(
                    QuizHistory.performance_score
                ).label("grp_avg"),
                func.count(
                    QuizHistory.id
                ).label("grp_count"),
            )
            .join(
                Enrollment,
                Enrollment.classroom_id
                == Classroom.id,
            )
            .join(
                QuizHistory,
                QuizHistory.user_id
                == Enrollment.student_id,
            )
            .filter(
                Classroom.id.in_(
                    classroom_ids
                ),
                Enrollment.is_active.is_(True),
                QuizHistory.performance_score.isnot(
                    None
                ),
            )
            .group_by(
                Classroom.id,
                Classroom.name,
            )
            .all()
        )

        for idx, row in enumerate(group_rows):

            classroom_name = row[1]
            group_avg = float(
                row[2] or 0
            )
            group_count = int(
                row[3] or 0
            )

            if group_count <= 0:
                continue

            groups_perf.append(
                {
                    "name": classroom_name,
                    "avg": round(
                        group_avg / 10,
                        2,
                    ),
                    "count": group_count,
                    "color": SESSION_COLORS[
                        idx % len(SESSION_COLORS)
                    ],
                }
            )

    # ========================================================
    # 8. TOP ESTUDIANTES
    # ========================================================

    top_students = []

    if student_ids:

        top_rows = (
            db.query(
                QuizHistory.user_id,
                func.avg(
                    QuizHistory.performance_score
                ).label("avg_score"),
            )
            .filter(
                QuizHistory.user_id.in_(
                    student_ids
                ),
                QuizHistory.performance_score.isnot(
                    None
                ),
            )
            .group_by(
                QuizHistory.user_id
            )
            .order_by(
                func.avg(
                    QuizHistory.performance_score
                ).desc()
            )
            .limit(5)
            .all()
        )

        top_ids = [
            row.user_id
            for row in top_rows
        ]

        if top_ids:

            # ------------------------------------------------
            # Usuarios
            # ------------------------------------------------

            users = {
                user.id: user
                for user in (
                    db.query(User)
                    .filter(
                        User.id.in_(top_ids)
                    )
                    .all()
                )
            }

            # ------------------------------------------------
            # Clases
            # ------------------------------------------------

            enrollment_rows = (
                db.query(
                    Enrollment.student_id,
                    Classroom,
                )
                .join(
                    Classroom,
                    Classroom.id
                    == Enrollment.classroom_id,
                )
                .filter(
                    Enrollment.student_id.in_(
                        top_ids
                    ),
                    Enrollment.classroom_id.in_(
                        classroom_ids
                    ),
                    Enrollment.is_active.is_(True),
                )
                .all()
            )

            grade_by_student = {}

            for student_id, classroom in enrollment_rows:

                if student_id not in grade_by_student:
                    grade_by_student[
                        student_id
                    ] = (
                        classroom.grade
                        or "—"
                    )

            # ------------------------------------------------
            # Tendencias
            # ------------------------------------------------

            trend_rows = (
                db.query(
                    QuizHistory.user_id,
                    QuizHistory.performance_score,
                    QuizHistory.completed_at,
                )
                .filter(
                    QuizHistory.user_id.in_(
                        top_ids
                    ),
                    QuizHistory.performance_score.isnot(
                        None
                    ),
                )
                .order_by(
                    QuizHistory.completed_at.asc()
                )
                .all()
            )

            scores_by_user = {}

            for user_id, score_value, _ in trend_rows:

                if score_value is None:
                    continue

                scores_by_user.setdefault(
                    user_id,
                    [],
                ).append(
                    float(score_value)
                )

            # ------------------------------------------------
            # Construcción final
            # ------------------------------------------------

            for row in top_rows:

                user_id = row.user_id

                student = users.get(
                    user_id
                )

                if not student:
                    continue

                scores = scores_by_user.get(
                    user_id,
                    [],
                )

                trend = None

                if len(scores) >= 2:

                    split = max(
                        1,
                        len(scores) // 2,
                    )

                    old_scores = scores[
                        :split
                    ]

                    recent_scores = scores[
                        split:
                    ]

                    old_average = (
                        sum(old_scores)
                        / len(old_scores)
                    )

                    recent_average = (
                        sum(recent_scores)
                        / len(recent_scores)
                    )

                    delta = round(
                        (
                            recent_average
                            - old_average
                        ) / 10,
                        1,
                    )

                    if abs(delta) >= 0.1:
                        trend = (
                            f"{'+' if delta >= 0 else ''}"
                            f"{delta}"
                        )
                    else:
                        trend = "0.0"

                top_students.append(
                    {
                        "name": (
                            student.full_name
                            or student.username
                        ),
                        "group": grade_by_student.get(
                            user_id
                        ),
                        "avg": round(
                            float(
                                row.avg_score
                                or 0
                            ) / 10,
                            1,
                        ),
                        "trend": trend,
                    }
                )

    # ========================================================
    # 9. PRÓXIMOS EVENTOS
    # ========================================================

    upcoming = []

    if classroom_ids:

        today = datetime.utcnow().date()

        next_month = (
            today.replace(day=1)
            + timedelta(days=32)
        ).replace(day=1)

        cutoff = (
            next_month
            + timedelta(days=32)
        ).replace(day=1)

        institution_id = getattr(
            current_user,
            "institution_id",
            None,
        )

        event_filters = [
            ClassroomEvent.classroom_id.in_(
                classroom_ids
            )
        ]

        if institution_id is not None:

            event_filters.append(
                and_(
                    ClassroomEvent.classroom_id.is_(None),
                    ClassroomEvent.institution_id
                    == institution_id,
                )
            )

        upcoming_events = (
            db.query(ClassroomEvent)
            .filter(
                or_(*event_filters),
                ClassroomEvent.event_date
                >= today.isoformat(),
                ClassroomEvent.event_date
                < cutoff.isoformat(),
                ClassroomEvent.is_active.is_(True),
            )
            .order_by(
                ClassroomEvent.event_date.asc()
            )
            .limit(5)
            .all()
        )

        color_map = {
            "examen": "bg-[#E03E3E]",
            "tarea": "bg-[#D9730D]",
            "clase": "bg-[#2E6FDB]",
            "evento": "bg-[#0F7B6C]",
        }

        for event in upcoming_events:

            event_date = event.event_date

            if not event_date:
                continue

            if event_date == today.isoformat():

                label_date = "Hoy"

            elif event_date == (
                today + timedelta(days=1)
            ).isoformat():

                label_date = "Mañana"

            else:

                try:

                    parsed_date = datetime.strptime(
                        event_date,
                        "%Y-%m-%d",
                    )

                    label_date = (
                        parsed_date
                        .strftime("%d %b")
                        .lstrip("0")
                        .capitalize()
                    )

                except Exception:
                    label_date = event_date

            event_type = (
                event.event_type
                or "evento"
            )

            upcoming.append(
                {
                    "type": event_type,
                    "label": event.title,
                    "date": label_date,
                    "color": color_map.get(
                        event_type,
                        "bg-[#6940A5]",
                    ),
                }
            )

    # ========================================================
    # 10. USO DE IA
    # ========================================================

    ai_usage = []

    my_bots = (
        db.query(ExpertBot)
        .filter(
            ExpertBot.creator_id
            == current_user.id
        )
        .all()
    )

    if my_bots:
        # Uso real: estudiantes distintos que conversaron con cada NeuroBot
        # (antes ExpertBot.total_users, que nunca se actualizaba: siempre 0 %).
        from app.models.learning import LearningSession
        bot_ids = [b.id for b in my_bots]
        users_by_bot = dict(
            db.query(LearningSession.bot_id, func.count(func.distinct(LearningSession.user_id)))
            .filter(LearningSession.bot_id.in_(bot_ids))
            .group_by(LearningSession.bot_id)
            .all()
        )
        ranked = sorted(my_bots, key=lambda b: -int(users_by_bot.get(b.id, 0)))[:5]
        max_users = max((int(users_by_bot.get(b.id, 0)) for b in ranked), default=0)
        for bot in ranked:
            users = int(users_by_bot.get(bot.id, 0))
            ai_usage.append({
                "name": bot.name,
                "users": users,
                "pct": round(users / max_users * 100) if max_users else 0,
                "color": "bg-[#6940A5]",
            })

    # ========================================================
    # 11. ¿HAY DATOS?
    # ========================================================

    has_data = (
        len(student_ids) > 0
        and quiz_count > 0
    )

    # ========================================================
    # 12. RESPUESTA
    # ========================================================

    return {
        "total_groups": total_groups,
        "total_students": total_students,
        "active_bots": int(active_bots),

        "avg_global": avg_global,
        "score": score,
        "has_data": bool(has_data),

        "alert_count": alert_count,
        "risk_dist": risk_dist,

        "groups_perf": groups_perf,
        "top_students": top_students,
        "topics_perf": topics_perf,

        "weekly_activity": weekly_activity,

        "upcoming": upcoming,

        "ai_usage": ai_usage,
    }