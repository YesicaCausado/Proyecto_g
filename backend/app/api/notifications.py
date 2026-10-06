"""
Sistema de Notificaciones NeuroLearn
GET /api/v1/notifications  →  lista de notificaciones contextuales del usuario
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from app.db.database import get_db
from app.models.user import User
from app.models.learning import QuizHistory, LearningSession
from app.api.auth import get_current_user
from app.services.license_service import get_license, LicenseInfo

router = APIRouter()


def _activity_dates(user_id: int, db: Session, since_days: int = 366) -> set:
    """Fechas (naive datetime.date) con actividad de quiz, en UNA sola query.

    Reemplaza el bucle N+1 previo (hasta 366 queries) que excedía el límite de
    tiempo de las funciones serverless de Vercel en rachas largas.
    """
    since = datetime.utcnow() - timedelta(days=since_days)
    rows = (
        db.query(func.date(QuizHistory.completed_at).label("d"))
        .filter(
            QuizHistory.user_id == user_id,
            QuizHistory.completed_at.isnot(None),
            QuizHistory.completed_at >= since,
        )
        .all()
    )
    return {r[0] for r in rows if r[0] is not None}


def _build_notifications(user: User, db: Session) -> list[dict]:
    notifs = []
    now = datetime.utcnow()
    today = now.date()
    user_id = user.id

    # ── 1 + 2. Rachas (en riesgo / lograda) ───────────────────────────────
    # Consultamos TODAS las fechas activas una sola vez y derivamos la racha
    # en memoria (sin el bucle de queries N+1 original).
    activity_dates = _activity_dates(user_id, db)
    has_today = today in activity_dates
    yesterday = today - timedelta(days=1)
    has_yesterday = yesterday in activity_dates

    if has_yesterday and not has_today:
        notifs.append({
            "id": "streak_risk",
            "type": "warning",
            "title": "¡Tu racha está en riesgo!",
            "message": "Haz al menos un ejercicio hoy para mantener tu racha de días.",
            "icon": "flame",
            "read": False,
            "created_at": now.isoformat(),
        })

    # Contar días consecutivos hacia atrás desde hoy (o ayer si hoy no hay nada).
    check_date = today if has_today else yesterday
    streak = 0
    d = check_date
    while d in activity_dates:
        streak += 1
        d -= timedelta(days=1)

    if streak >= 7 and streak % 7 == 0:
        notifs.append({
            "id": f"streak_milestone_{streak}",
            "type": "achievement",
            "title": f"🔥 ¡{streak} días de racha!",
            "message": "¡Increíble constancia! Sigue así para dominar el Saber 11.",
            "icon": "trophy",
            "read": False,
            "created_at": now.isoformat(),
        })

    # ── 3. Rendimiento alto reciente ────────────────────────────────────────
    recent = db.query(QuizHistory).filter(
        QuizHistory.user_id == user_id,
        QuizHistory.completed_at.isnot(None),
        QuizHistory.completed_at >= now - timedelta(days=3),
        QuizHistory.performance_score.isnot(None),
    ).all()

    if recent:
        avg_recent = sum(q.performance_score for q in recent) / len(recent)
        if avg_recent >= 80:
            notifs.append({
                "id": "high_performance",
                "type": "success",
                "title": "¡Excelente rendimiento!",
                "message": f"Promedio de {int(avg_recent)}% en los últimos 3 días. ¡Vas muy bien!",
                "icon": "star",
                "read": False,
                "created_at": now.isoformat(),
            })
        elif avg_recent < 50:
            notifs.append({
                "id": "low_performance",
                "type": "info",
                "title": "Área de oportunidad detectada",
                "message": "Tu Neuron ha detectado temas donde puedes mejorar. ¡Practica un poco más!",
                "icon": "brain",
                "read": False,
                "created_at": now.isoformat(),
            })

    # ── 4. Primera sesión de chat ────────────────────────────────────────────
    total_sessions = db.query(LearningSession).filter(
        LearningSession.user_id == user_id,
    ).count()

    if total_sessions == 0:
        notifs.append({
            "id": "first_session",
            "type": "info",
            "title": "¡Comienza tu primera sesión!",
            "message": "Habla con Neuron para empezar a prepararte. Está listo para ayudarte.",
            "icon": "bot",
            "read": False,
            "created_at": now.isoformat(),
        })

    # ── 5. Bienvenida (siempre presente si no hay otras) ─────────────────────
    total_quizzes = db.query(QuizHistory).filter(
        QuizHistory.user_id == user_id
    ).count()

    if total_quizzes == 0 and total_sessions == 0:
        notifs.append({
            "id": "welcome",
            "type": "info",
            "title": f"¡Bienvenido/a, {user.full_name or user.username}!",
            "message": "Tu plataforma de preparación para el Saber 11 está lista. ¡Empieza hoy!",
            "icon": "sparkles",
            "read": False,
            "created_at": now.isoformat(),
        })

    # ── 6. Tip del día ───────────────────────────────────────────────────────
    from hashlib import md5
    day_seed = int(md5(f"{user_id}-{today}".encode()).hexdigest(), 16) % 5
    tips = [
        ("Tip: Matemáticas", "Repasa funciones cuadráticas — son las más frecuentes en el Saber 11."),
        ("Tip: Lectura crítica", "Lee el texto completo antes de responder. Busca la idea principal."),
        ("Tip: Ciencias", "Enfócate en los conceptos de células y ecosistemas para Biología."),
        ("Tip: Sociales", "Repasa los períodos históricos del siglo XX y sus contextos políticos."),
        ("Tip: Inglés", "Practica vocabulario de contexto — el Saber 11 evalúa inferencia de significado."),
    ]
    title, msg = tips[day_seed]
    notifs.append({
        "id": f"tip_{today}",
        "type": "tip",
        "title": title,
        "message": msg,
        "icon": "lightbulb",
        "read": False,
        "created_at": now.isoformat(),
    })

    return notifs


@router.get("/notifications")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
):
    """Retorna notificaciones contextuales del usuario autenticado."""
    # Bloquear si la licencia está suspendida
    if license_info.license_status == "suspended":
        raise HTTPException(status_code=403, detail="La licencia institucional está suspendida.")

    try:
        notifs = _build_notifications(current_user, db)
    except Exception:
        notifs = [{
            "id": "fallback",
            "type": "info",
            "title": "¡Bienvenido a NeuroLearn!",
            "message": "Tu asistente Neuron está listo para ayudarte.",
            "icon": "bot",
            "read": False,
            "created_at": datetime.utcnow().isoformat(),
        }]

    return {
        "notifications": notifs,
        "unread_count": sum(1 for n in notifs if not n["read"]),
        "total": len(notifs),
    }
