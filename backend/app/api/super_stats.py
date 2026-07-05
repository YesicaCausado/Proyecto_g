"""
NeuroLearn AI - API Super Profesor: Estadísticas Institucionales

Endpoints:
  GET  /super/stats/dashboard  - KPIs, ranking profesores, estudiantes en riesgo, áreas
  GET  /super/stats/alerts     - NeuroAlertas agregadas de todas las clases
  GET  /super/audit            - Logs de auditoría (tabla audit_logs)
  GET  /super/stats/security   - Sesiones activas e historial de accesos
  GET  /super/classrooms       - Todos los grupos/aulas de la institución
  GET  /super/bots             - Todos los NeuroBots de la institución
  GET  /super/broadcasts       - Mensajes institucionales enviados
  POST /super/broadcasts       - Enviar mensaje institucional
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.institution import AuditLog, Institution
from app.models.learning import LearningSession, QuizHistory
from app.models.expert_bot import ExpertBot

router = APIRouter(prefix="/super", tags=["Super Profesor - Stats"])


def _require_super(user: User):
    if user.role not in (UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Acceso restringido al super profesor")


def _get_institution_id(user: User, db: Session) -> Optional[int]:
    return user.institution_id


# ── GET /super/stats/dashboard ────────────────────────────────────────────────

@router.get("/stats/dashboard")
async def get_super_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    # ── Usuarios de la institución ───────────────────────────────
    teachers_q = db.query(User).filter(
        User.role == UserRole.PROFESOR.value,
        User.is_active == True,
        User.institution_id == inst_id,
    )
    students_q = db.query(User).filter(
        User.role == UserRole.ESTUDIANTE.value,
        User.is_active == True,
        User.institution_id == inst_id,
    )
    total_teachers = teachers_q.count()
    total_students = students_q.count()

    # ── Clases activas ───────────────────────────────────────────
    teacher_ids = [t.id for t in teachers_q.all()]
    groups_q = db.query(Classroom).filter(
        Classroom.is_active == True,
        Classroom.teacher_id.in_(teacher_ids) if teacher_ids else False,
    )
    total_groups = groups_q.count() if teacher_ids else 0

    # ── Promedio general ─────────────────────────────────────────
    student_ids = [s.id for s in students_q.all()]
    avg_score = 0.0
    if student_ids:
        avg_raw = db.query(func.avg(QuizHistory.performance_score)).filter(
            QuizHistory.user_id.in_(student_ids),
            QuizHistory.performance_score != None,
        ).scalar()
        avg_score = round(float(avg_raw or 0), 1)

    # ── Estudiantes en riesgo (enrollment con risk_level medium/high) ──
    at_risk_ids: set[int] = set()
    if teacher_ids:
        risk_enrollments = db.query(Enrollment).join(
            Classroom, Enrollment.classroom_id == Classroom.id
        ).filter(
            Classroom.teacher_id.in_(teacher_ids),
            Enrollment.is_active == True,
            Enrollment.risk_level.in_(["medium", "high"]),
        ).all()
        for e in risk_enrollments:
            at_risk_ids.add(e.student_id)
    at_risk_count = len(at_risk_ids)

    # ── Ranking de profesores ─────────────────────────────────────
    teacher_ranking = []
    week_ago = datetime.utcnow() - timedelta(days=7)
    for t in teachers_q.order_by(User.full_name).all():
        classrooms = db.query(Classroom).filter(
            Classroom.teacher_id == t.id,
            Classroom.is_active == True,
        ).all()
        if not classrooms:
            continue
        cids = [c.id for c in classrooms]
        enrollments = db.query(Enrollment).filter(
            Enrollment.classroom_id.in_(cids),
            Enrollment.is_active == True,
        ).all()
        n_students = len(enrollments)
        avg_t = (sum(e.average_score for e in enrollments) / n_students) if n_students else 0
        active = sum(1 for e in enrollments if e.last_activity and e.last_activity > week_ago)
        participation = round((active / n_students * 100)) if n_students else 0
        teacher_ranking.append({
            "name": t.full_name or t.username,
            "subject": t.subject_area or "—",
            "avg": round(avg_t / 10, 1),          # score 0-100 → 0-10
            "participation": participation,
            "students": n_students,
        })
    # Ordenar por avg desc
    teacher_ranking.sort(key=lambda x: x["avg"], reverse=True)

    # ── Estudiantes en riesgo detalle ─────────────────────────────
    at_risk_detail = []
    for sid in list(at_risk_ids)[:8]:
        st = db.query(User).filter(User.id == sid).first()
        if not st:
            continue
        e = db.query(Enrollment).filter(
            Enrollment.student_id == sid,
            Enrollment.is_active == True,
        ).order_by(Enrollment.risk_level.desc()).first()
        at_risk_detail.append({
            "name":    st.full_name or st.username,
            "grade":   st.grade or "—",
            "avg":     round((e.average_score if e else 0) / 10, 1),
            "subject": st.subject_area or "—",
            "risk":    e.risk_level if e else "medium",
        })

    # ── Distribución por áreas (clases por materia) ───────────────
    areas: dict[str, int] = {}
    for c in groups_q.all():
        key = (c.subject or "Otra").strip()
        areas[key] = areas.get(key, 0) + 1
    total_cls = sum(areas.values()) or 1
    areas_data = [
        {"label": k, "pct": round(v / total_cls * 100)}
        for k, v in sorted(areas.items(), key=lambda x: -x[1])
    ]

    return {
        "total_teachers": total_teachers,
        "total_students": total_students,
        "total_groups":   total_groups,
        "avg_score":      avg_score,
        "at_risk_count":  at_risk_count,
        "teacher_ranking": teacher_ranking[:10],
        "at_risk_detail":  at_risk_detail,
        "areas_data":      areas_data[:8],
    }


# ── GET /super/stats/alerts ───────────────────────────────────────────────────

@router.get("/stats/alerts")
async def get_super_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    teacher_ids = [t.id for t in db.query(User).filter(
        User.role == UserRole.PROFESOR.value,
        User.institution_id == inst_id,
        User.is_active == True,
    ).all()]

    alerts = []
    if not teacher_ids:
        return {"alerts": [], "total": 0}

    classrooms = db.query(Classroom).filter(
        Classroom.teacher_id.in_(teacher_ids),
        Classroom.is_active == True,
    ).all()

    week_ago = datetime.utcnow() - timedelta(days=7)

    for c in classrooms:
        enrollments = db.query(Enrollment).filter(
            Enrollment.classroom_id == c.id,
            Enrollment.is_active == True,
        ).all()
        for e in enrollments:
            st = db.query(User).filter(User.id == e.student_id).first()
            name = st.full_name or st.username if st else "Estudiante"

            if e.last_activity:
                days_inactive = (datetime.utcnow() - e.last_activity).days
                if days_inactive >= 7:
                    alerts.append({
                        "id": f"inact-{e.id}",
                        "priority": "alta" if days_inactive >= 14 else "media",
                        "category": "Inactividad",
                        "title": f"{name} sin actividad",
                        "description": f"Sin actividad desde hace {days_inactive} días en {c.name}.",
                        "affectedCount": 1,
                        "affectedLabel": "estudiante",
                        "time": f"Hace {days_inactive} días",
                        "resolved": False,
                    })
            elif e.total_sessions == 0:
                alerts.append({
                    "id": f"never-{e.id}",
                    "priority": "media",
                    "category": "Sin inicio",
                    "title": f"{name} nunca inició",
                    "description": f"Nunca ha iniciado una sesión en {c.name}.",
                    "affectedCount": 1,
                    "affectedLabel": "estudiante",
                    "time": "Pendiente",
                    "resolved": False,
                })

            if e.total_sessions >= 3 and e.average_score < 40:
                alerts.append({
                    "id": f"low-{e.id}",
                    "priority": "alta",
                    "category": "Bajo rendimiento",
                    "title": f"{name} — promedio muy bajo",
                    "description": f"Promedio de {e.average_score:.0f}% en {c.name}.",
                    "affectedCount": 1,
                    "affectedLabel": "estudiante",
                    "time": "Actual",
                    "resolved": False,
                })

            if e.risk_level in ("medium", "high"):
                alerts.append({
                    "id": f"risk-{e.id}",
                    "priority": "alta" if e.risk_level == "high" else "media",
                    "category": "Riesgo cognitivo",
                    "title": f"Riesgo detectado: {name}",
                    "description": f"Factores: {', '.join(e.risk_factors or ['detectado'])} en {c.name}.",
                    "affectedCount": 1,
                    "affectedLabel": "estudiante",
                    "time": "Reciente",
                    "resolved": False,
                })

    priority_order = {"alta": 0, "media": 1, "baja": 2}
    alerts.sort(key=lambda a: priority_order.get(a["priority"], 3))
    return {"alerts": alerts[:50], "total": len(alerts)}


# ── GET /super/audit ──────────────────────────────────────────────────────────

@router.get("/audit")
async def get_audit_logs(
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    action: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    q = db.query(AuditLog).filter(AuditLog.institution_id == inst_id)
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    total = q.count()
    logs = q.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for lg in logs:
        by = db.query(User).filter(User.id == lg.performed_by_id).first()
        target = db.query(User).filter(User.id == lg.target_user_id).first()
        result.append({
            "id":           lg.id,
            "action":       lg.action,
            "performed_by": by.full_name or by.username if by else "Sistema",
            "target_user":  target.full_name or target.username if target else None,
            "user_type":    lg.user_type,
            "ip_address":   lg.ip_address,
            "notes":        lg.notes,
            "created_at":   lg.created_at.isoformat(),
        })

    return {"logs": result, "total": total, "limit": limit, "offset": offset}


# ── GET /super/stats/security ─────────────────────────────────────────────────

@router.get("/stats/security")
async def get_security_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    # Usuarios activos de la institución
    users = db.query(User).filter(
        User.institution_id == inst_id,
        User.is_active == True,
    ).all()

    day_ago = datetime.utcnow() - timedelta(hours=24)

    # Sesiones activas: last_login en las últimas 24 h
    active_sessions = []
    for u in users:
        if u.last_login and u.last_login > day_ago:
            active_sessions.append({
                "user":      u.full_name or u.username,
                "role":      u.role,
                "last_login": u.last_login.isoformat(),
                "location":  "Colombia",   # sin geolocalización real por ahora
            })

    # Historial de accesos recientes (last 30 días)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    login_history = []
    audit_logins = db.query(AuditLog).filter(
        AuditLog.institution_id == inst_id,
        AuditLog.action.in_(["login", "login_success", "login_failed"]),
        AuditLog.created_at >= thirty_days_ago,
    ).order_by(AuditLog.created_at.desc()).limit(20).all()

    for lg in audit_logins:
        by = db.query(User).filter(User.id == lg.performed_by_id).first()
        login_history.append({
            "user":      by.full_name or by.username if by else "?",
            "action":    lg.action,
            "ip":        lg.ip_address or "—",
            "created_at": lg.created_at.isoformat(),
        })

    return {
        "active_sessions": active_sessions,
        "total_active":    len(active_sessions),
        "login_history":   login_history,
    }


# ── GET /super/classrooms ─────────────────────────────────────────────────────

@router.get("/classrooms")
async def get_super_classrooms(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    teacher_ids = [t.id for t in db.query(User).filter(
        User.role == UserRole.PROFESOR.value,
        User.institution_id == inst_id,
        User.is_active == True,
    ).all()]

    if not teacher_ids:
        return {"classrooms": [], "total": 0}

    q = db.query(Classroom).filter(
        Classroom.teacher_id.in_(teacher_ids),
        Classroom.is_active == True,
    )
    if search:
        q = q.filter(Classroom.name.ilike(f"%{search}%"))

    classrooms = q.order_by(Classroom.created_at.desc()).all()
    week_ago = datetime.utcnow() - timedelta(days=7)

    result = []
    for c in classrooms:
        teacher = db.query(User).filter(User.id == c.teacher_id).first()
        student_count = db.query(Enrollment).filter(
            Enrollment.classroom_id == c.id,
            Enrollment.is_active == True,
        ).count()
        # Promedio del grupo
        enrollments = db.query(Enrollment).filter(
            Enrollment.classroom_id == c.id,
            Enrollment.is_active == True,
        ).all()
        avg = round(sum(e.average_score for e in enrollments) / len(enrollments) / 10, 1) if enrollments else 0.0
        # Última actividad (más reciente)
        last_act = max((e.last_activity for e in enrollments if e.last_activity), default=None)
        if last_act:
            diff = (datetime.utcnow() - last_act).total_seconds()
            if diff < 3600:    last_active = "Hace menos de 1 hora"
            elif diff < 86400: last_active = f"Hace {int(diff/3600)}h"
            else:              last_active = f"Hace {int(diff/86400)} día(s)"
        else:
            last_active = "Sin actividad"

        result.append({
            "id":          c.id,
            "name":        c.name,
            "teacher":     teacher.full_name or teacher.username if teacher else "?",
            "subject":     c.subject,
            "grade":       c.grade or "—",
            "students":    student_count,
            "code":        c.invite_code,
            "status":      "activo" if c.is_active else "inactivo",
            "avg":         avg,
            "lastActivity": last_active,
        })

    return {"classrooms": result, "total": len(result)}


# ── GET /super/bots ───────────────────────────────────────────────────────────

@router.get("/bots")
async def get_super_bots(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    teacher_ids = [t.id for t in db.query(User).filter(
        User.role == UserRole.PROFESOR.value,
        User.institution_id == inst_id,
        User.is_active == True,
    ).all()]

    if not teacher_ids:
        return {"bots": [], "total": 0}

    q = db.query(ExpertBot).filter(
        ExpertBot.creator_id.in_(teacher_ids),
        ExpertBot.is_active == True,
    )
    if search:
        q = q.filter(ExpertBot.name.ilike(f"%{search}%"))

    bots = q.order_by(ExpertBot.created_at.desc()).all()
    result = []
    for b in bots:
        creator = db.query(User).filter(User.id == b.creator_id).first()
        result.append({
            "id":         b.id,
            "name":       b.name,
            "teacher":    creator.full_name or creator.username if creator else "?",
            "subject":    b.category or "—",
            "status":     "activo" if b.is_active else "inactivo",
            "visibility": "publico" if b.is_public else "privado",
            "created":    b.created_at.strftime("%Y-%m-%d"),
        })

    return {"bots": result, "total": len(result)}


# ── Broadcasts (mensajería institucional) ─────────────────────────────────────
# Usamos la tabla audit_logs para registrar broadcasts ya que no hay tabla dedicada.
# En producción se puede crear una tabla Broadcast separada.

class BroadcastSend(BaseModel):
    subject: str
    body: str
    recipient_type: str = "institucional"   # institucional|profesores|estudiantes|grado|grupo
    grade: Optional[str] = None
    group_id: Optional[int] = None


@router.get("/broadcasts")
async def list_broadcasts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    logs = db.query(AuditLog).filter(
        AuditLog.institution_id == inst_id,
        AuditLog.action == "broadcast",
    ).order_by(AuditLog.created_at.desc()).limit(50).all()

    result = []
    for lg in logs:
        import json as _json
        try:
            notes = _json.loads(lg.notes or "{}")
        except Exception:
            notes = {}
        result.append({
            "id":       lg.id,
            "subject":  notes.get("subject", "(sin asunto)"),
            "to":       notes.get("to", "Institución"),
            "date":     lg.created_at.strftime("%Y-%m-%d %H:%M"),
            "reads":    0,
            "total":    notes.get("total", 0),
            "sender":   (db.query(User).filter(User.id == lg.performed_by_id).first() or current_user).full_name or "Rector",
        })

    return {"broadcasts": result, "total": len(result)}


@router.post("/broadcasts", status_code=201)
async def send_broadcast(
    body: BroadcastSend,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    # Calcular total de destinatarios
    to_label = body.recipient_type
    total = 0
    if body.recipient_type == "institucional":
        total = db.query(User).filter(User.institution_id == inst_id, User.is_active == True).count()
        to_label = "Toda la institución"
    elif body.recipient_type == "profesores":
        total = db.query(User).filter(User.institution_id == inst_id, User.role == UserRole.PROFESOR.value, User.is_active == True).count()
        to_label = "Solo profesores"
    elif body.recipient_type == "estudiantes":
        total = db.query(User).filter(User.institution_id == inst_id, User.role == UserRole.ESTUDIANTE.value, User.is_active == True).count()
        to_label = "Solo estudiantes"
    elif body.recipient_type == "grado" and body.grade:
        total = db.query(User).filter(User.institution_id == inst_id, User.grade == body.grade, User.is_active == True).count()
        to_label = f"Grado {body.grade}"

    import json as _json
    notes = _json.dumps({"subject": body.subject, "body": body.body, "to": to_label, "total": total})

    log = AuditLog(
        action="broadcast",
        performed_by_id=current_user.id,
        institution_id=inst_id,
        notes=notes,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "id":      log.id,
        "subject": body.subject,
        "to":      to_label,
        "date":    log.created_at.strftime("%Y-%m-%d %H:%M"),
        "reads":   0,
        "total":   total,
        "sender":  current_user.full_name or current_user.username,
    }
