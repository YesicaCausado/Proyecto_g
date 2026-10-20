"""
NeuroLearn AI - API Super Profesor: Estadísticas Institucionales

Endpoints:
  GET  /super/stats/dashboard  - KPIs, ranking profesores, estudiantes en riesgo, áreas
  GET  /super/stats/alerts     - NeuroAlertas agregadas de todas las clases
  GET  /super/audit            - Logs de auditoría (tabla audit_logs)
  GET  /super/stats/security   - Sesiones activas e historial de accesos
  GET  /super/classrooms       - Todos los grupos/aulas de la institución (activos e inactivos)
  GET  /super/classrooms/{id}  - Detalle de un grupo (profesor y estudiantes)
  PATCH /super/classrooms/{id} - Activar/desactivar o transferir a otro profesor
  GET  /super/bots             - Todos los NeuroBots de la institución
  GET  /super/broadcasts       - Mensajes institucionales enviados
  POST /super/broadcasts       - Enviar mensaje institucional
  GET  /super/institution      - Datos de la institución (nombre, DANE, contacto)
  PATCH /super/institution     - Actualizar nombre de la institución
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Form
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from datetime import datetime, timedelta
from typing import Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.institution import AuditLog, Institution
from app.models.learning import ChatMessage, LearningSession, QuizHistory
from app.models.expert_bot import ExpertBot
from app.models.messages import DirectMessage
from app.services.competencies import COMP_NAMES, classroom_competency, valid_key

router = APIRouter(prefix="/super", tags=["Super Profesor - Stats"])


def _require_super(user: User):
    if user.role not in (UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value):
        raise HTTPException(status_code=403, detail="Acceso restringido al super profesor")


def _get_institution_id(user: User, db: Session) -> Optional[int]:
    return user.institution_id


# ── GET /super/institution ────────────────────────────────────────────────────

@router.get("/institution")
async def get_institution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst = db.query(Institution).filter(Institution.id == current_user.institution_id).first()
    if not inst:
        raise HTTPException(404, "Institución no encontrada")
    return {
        "id":           inst.id,
        "name":         inst.name,
        "dane_code":    inst.dane_code,
        "is_active":    inst.is_active,
        "email":        inst.email,
        "phone":        inst.phone,
        "address":      inst.address,
        "website":      inst.website,
        "timezone":     inst.timezone or "America/Bogota",
        "language":     inst.language or "es",
        "primary_color": inst.primary_color or "#6940A5",
        "logo_url":     inst.logo_url,
        "created_at":   inst.created_at.isoformat() if inst.created_at else None,
    }


class InstitutionUpdate(BaseModel):
    name: Optional[str] = None
    dane_code: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    timezone: Optional[str] = None
    language: Optional[str] = None
    primary_color: Optional[str] = None
    logo_url: Optional[str] = None


# ── PATCH /super/institution ──────────────────────────────────────────────────

@router.patch("/institution")
async def update_institution(
    payload: InstitutionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst = db.query(Institution).filter(Institution.id == current_user.institution_id).first()
    if not inst:
        raise HTTPException(404, "Institución no encontrada")

    for field_name in [
        "name",
        "dane_code",
        "email",
        "phone",
        "address",
        "website",
        "timezone",
        "language",
        "primary_color",
        "logo_url",
    ]:
        value = getattr(payload, field_name, None)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if field_name in {"email", "phone", "address", "website", "timezone", "language", "primary_color", "logo_url"} and value == "":
                value = None
        setattr(inst, field_name, value)

    db.commit()
    db.refresh(inst)
    return {
        "id": inst.id,
        "name": inst.name,
        "dane_code": inst.dane_code,
        "email": inst.email,
        "phone": inst.phone,
        "address": inst.address,
        "website": inst.website,
        "timezone": inst.timezone,
        "language": inst.language,
        "primary_color": inst.primary_color,
        "logo_url": inst.logo_url,
    }


# ── GET /super/stats/dashboard ────────────────────────────────────────────────

@router.get("/stats/dashboard")
async def get_super_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    try:
        return _compute_super_dashboard(current_user, db)
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        # Cualquier error interno (BD lenta/caída, tipo de dato, N+1) se
        # convierte en un 503 controlado en vez del 500 crudo que el frontend
        # silenciaba y dejaba los reportes vacíos sin explicación.
        raise HTTPException(
            status_code=503,
            detail=f"No se pudo calcular el dashboard (base de datos). {str(e)[:160]}",
        ) from e


def _compute_super_dashboard(current_user: User, db: Session):
    inst_id = _get_institution_id(current_user, db)
    if not inst_id:
        raise HTTPException(status_code=400, detail="No tienes una institución asignada")

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
        Classroom.teacher_id.in_(teacher_ids),
    )
    total_groups = groups_q.count()

    # ── Promedio general ─────────────────────────────────────────
    student_ids = [s.id for s in students_q.all()]
    avg_score = 0.0
    if student_ids:
        avg_raw = db.query(func.avg(QuizHistory.performance_score)).filter(
            QuizHistory.user_id.in_(student_ids),
            QuizHistory.performance_score != None,
        ).scalar()
        # QuizHistory.performance_score está en escala 0-100; normalizamos a 0-10.
        avg_score = round(float(avg_raw or 0) / 10, 1)

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

    # ── Detalle de TODOS los estudiantes (no solo en riesgo) ──────
    # El "Reporte por Estudiante" debe listar a todos los estudiantes de la
    # institución con su promedio real, grado y área. Se calcula el promedio
    # desde QuizHistory (actividad real); los que aún no tienen quizzes
    # aparecen con promedio 0 y riesgo "Sin actividad".
    students_detail = []
    if student_ids:
        agg_rows = (
            db.query(
                QuizHistory.user_id,
                func.avg(QuizHistory.performance_score).label("avg_score"),
                func.count(QuizHistory.id).label("attempts"),
            )
            .filter(
                QuizHistory.user_id.in_(student_ids),
                QuizHistory.performance_score != None,
            )
            .group_by(QuizHistory.user_id)
            .all()
        )
        avg_by_student: dict[int, float] = {r.user_id: float(r.avg_score or 0) for r in agg_rows}
        attempts_by_student: dict[int, int] = {r.user_id: int(r.attempts or 0) for r in agg_rows}

        # Riesgo por estudiante (desde Enrollment) para mostrar el estado real.
        risk_by_student: dict[int, str] = {}
        enroll_rows = (
            db.query(Enrollment.student_id, Enrollment.risk_level)
            .filter(
                Enrollment.student_id.in_(student_ids),
                Enrollment.is_active == True,
            )
            .all()
        )
        for sid, rl in enroll_rows:
            if rl in ("medium", "high"):
                risk_by_student[sid] = rl

        for st in students_q.order_by(User.full_name).all():
            sid = st.id
            raw_avg = avg_by_student.get(sid, 0.0)
            attempts = attempts_by_student.get(sid, 0)
            risk = risk_by_student.get(sid, "none")
            students_detail.append({
                "name":     st.full_name or st.username,
                "grade":    st.grade or "—",
                "avg":      round(raw_avg / 10, 1),        # 0-100 → 0-10
                "subject":  st.subject_area or "—",
                "risk":     risk if risk != "none" else ("Sin actividad" if attempts == 0 else "normal"),
                "attempts": attempts,
            })

        # Ordenar: en riesgo primero, luego por promedio desc.
        risk_prio = {"high": 0, "medium": 1, "normal": 2, "none": 3, "Sin actividad": 3}
        students_detail.sort(key=lambda x: (risk_prio.get(x["risk"], 3), -x["avg"]))

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
        "students_detail": students_detail,
        "areas_data":      areas_data[:8],
    }


# ── GET /super/stats/alerts ───────────────────────────────────────────────────

@router.get("/stats/alerts")
async def get_super_alerts(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.VER_NEUROALERTAS)),
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

            # Datos compartidos a todas las alertas del estudiante en esta clase
            common = {
                "studentId":   e.student_id,
                "studentName": name,
                "classroom":   c.name,
                "grade":       st.grade if st else None,
                "subject":     c.subject,
                "competency":  classroom_competency(c),
                "averageScore": round(float(e.average_score or 0), 1),
                "totalSessions": int(e.total_sessions or 0),
                "totalTimeMinutes": int(e.total_time_minutes or 0),
                "riskLevel":    e.risk_level,
                "riskFactors":  e.risk_factors or [],
            }

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
                        "daysInactive": days_inactive,
                        **common,
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
                    **common,
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
                    **common,
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
                    **common,
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

    # Usuarios que iniciaron sesión en las últimas 24 h (no se inventa la
    # ubicación: antes se mostraba «Colombia» para todos).
    active_sessions = []
    def _naive(dt):
        return dt.replace(tzinfo=None) if dt is not None and dt.tzinfo else dt

    for u in sorted(users, key=lambda x: _naive(x.last_login) or datetime.min, reverse=True):
        last = _naive(u.last_login)
        if last and last > day_ago:
            cutoff = _naive(u.sessions_valid_after)
            revoked = bool(cutoff and cutoff >= last)
            active_sessions.append({
                "id":         u.id,
                "user":       u.full_name or u.username,
                "role":       u.role,
                "last_login": last.isoformat(),
                "current":    u.id == current_user.id,
                "revoked":    revoked,
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


# ── POST /super/users/{id}/revoke-sessions ────────────────────────────────────

@router.post("/users/{user_id}/revoke-sessions")
async def revoke_institution_user_sessions(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cierra todas las sesiones abiertas de un usuario de la institución."""
    _require_super(current_user)
    from app.api.auth import revoke_user_sessions
    target = db.query(User).filter(
        User.id == user_id,
        User.institution_id == current_user.institution_id,
    ).first()
    if not target:
        raise HTTPException(404, "Usuario no encontrado")
    if target.id == current_user.id:
        raise HTTPException(400, "Para tus propias sesiones usa «Cerrar mis otras sesiones».")
    revoke_user_sessions(target)
    db.add(AuditLog(
        action="revoke_sessions",
        performed_by_id=current_user.id,
        target_user_id=target.id,
        institution_id=current_user.institution_id,
        notes=f"Sesiones cerradas: {target.full_name or target.username}",
    ))
    db.commit()
    return {"ok": True}


# ── GET /super/classrooms ─────────────────────────────────────────────────────

@router.get("/classrooms")
async def get_super_classrooms(
    search: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    # Todos los grupos de profesores de la institución, activos e
    # inactivos: la pantalla filtra por estado y permite reactivarlos.
    teacher_ids = [t.id for t in db.query(User).filter(
        User.role.in_([UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value]),
        User.institution_id == inst_id,
    ).all()]

    if not teacher_ids:
        return {"classrooms": [], "total": 0}

    q = db.query(Classroom).filter(
        Classroom.teacher_id.in_(teacher_ids),
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
            "teacherId":   c.teacher_id,
            "subject":     c.subject,
            "competency":  classroom_competency(c),
            "grade":       c.grade or "—",
            "students":    student_count,
            "code":        c.invite_code,
            "status":      "activo" if c.is_active else "inactivo",
            "avg":         avg,
            "lastActivity": last_active,
        })

    return {"classrooms": result, "total": len(result)}


def _institution_classroom(db: Session, current_user: User, classroom_id: int) -> Classroom:
    """Grupo de la institución del Súper Profesor (404 si es de otra)."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    teacher = db.query(User).filter(User.id == classroom.teacher_id).first() if classroom else None
    if not classroom or not teacher or teacher.institution_id != current_user.institution_id:
        raise HTTPException(404, "Grupo no encontrado")
    return classroom


@router.get("/classrooms/{classroom_id}")
async def get_super_classroom_detail(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    c = _institution_classroom(db, current_user, classroom_id)
    teacher = db.query(User).filter(User.id == c.teacher_id).first()
    rows = (
        db.query(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .filter(Enrollment.classroom_id == c.id, Enrollment.is_active == True)  # noqa: E712
        .order_by(User.full_name)
        .all()
    )
    students = [{
        "id":           u.id,
        "name":         u.full_name or u.username,
        "email":        u.email,
        "avg":          round((e.average_score or 0) / 10, 1),
        "lastActivity": e.last_activity.strftime("%Y-%m-%d") if e.last_activity else None,
    } for e, u in rows]
    return {
        "id":          c.id,
        "name":        c.name,
        "subject":     c.subject,
        "competency":  classroom_competency(c),
        "grade":       c.grade or "—",
        "description": c.description or "",
        "code":        c.invite_code,
        "status":      "activo" if c.is_active else "inactivo",
        "createdAt":   c.created_at.strftime("%Y-%m-%d") if c.created_at else None,
        "teacher":     {"id": teacher.id, "name": teacher.full_name or teacher.username} if teacher else None,
        "students":    students,
    }


class SuperClassroomUpdate(BaseModel):
    is_active: Optional[bool] = None
    teacher_id: Optional[int] = None
    # Competencia Saber 11 del grupo; "general" = aula sin competencia única.
    competency: Optional[str] = None


@router.patch("/classrooms/{classroom_id}")
async def update_super_classroom(
    classroom_id: int,
    data: SuperClassroomUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activa/desactiva un grupo o lo transfiere a otro profesor de la institución."""
    _require_super(current_user)
    c = _institution_classroom(db, current_user, classroom_id)
    notes = []
    if data.teacher_id is not None and data.teacher_id != c.teacher_id:
        new_teacher = db.query(User).filter(
            User.id == data.teacher_id,
            User.role == UserRole.PROFESOR.value,
            User.institution_id == current_user.institution_id,
            User.is_active == True,  # noqa: E712
        ).first()
        if not new_teacher:
            raise HTTPException(400, "El profesor elegido no existe o no pertenece a tu institución.")
        notes.append(f"transferido a {new_teacher.full_name or new_teacher.username}")
        c.teacher_id = new_teacher.id
    if data.is_active is not None and data.is_active != c.is_active:
        c.is_active = data.is_active
        notes.append("activado" if data.is_active else "desactivado")
    if data.competency is not None:
        new_comp = None if data.competency == "general" else valid_key(data.competency)
        if data.competency != "general" and new_comp is None:
            raise HTTPException(400, "Competencia inválida.")
        if new_comp != c.competency:
            c.competency = new_comp
            notes.append(f"competencia: {COMP_NAMES.get(new_comp, 'general')}")
    if not notes:
        raise HTTPException(400, "No hay cambios para guardar.")
    db.add(AuditLog(
        action="update_classroom",
        performed_by_id=current_user.id,
        institution_id=current_user.institution_id,
        notes=f"Grupo «{c.name}» " + ", ".join(notes),
    ))
    db.commit()
    teacher = db.query(User).filter(User.id == c.teacher_id).first()
    return {
        "id":        c.id,
        "status":    "activo" if c.is_active else "inactivo",
        "teacherId": c.teacher_id,
        "teacher":   (teacher.full_name or teacher.username) if teacher else "?",
        "competency": classroom_competency(c),
    }


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

    # Se listan también los bots inactivos: el Súper Profesor puede reactivarlos.
    q = db.query(ExpertBot).filter(ExpertBot.creator_id.in_(teacher_ids))
    if search:
        q = q.filter(ExpertBot.name.ilike(f"%{search}%"))

    bots = q.order_by(ExpertBot.created_at.desc()).all()
    bot_ids = [b.id for b in bots]
    creators = {u.id: u for u in db.query(User).filter(User.id.in_({b.creator_id for b in bots})).all()} if bots else {}

    # Métricas reales en consultas agrupadas (sin N+1).
    docs, queries, groups = {}, {}, {}
    if bot_ids:
        from app.models.bot_document import BotDocument
        from app.models.classroom import ClassroomBot
        docs = dict(db.query(BotDocument.bot_id, func.count(BotDocument.id))
                    .filter(BotDocument.bot_id.in_(bot_ids)).group_by(BotDocument.bot_id).all())
        queries = dict(db.query(LearningSession.bot_id, func.count(ChatMessage.id))
                       .join(ChatMessage, ChatMessage.session_id == LearningSession.id)
                       .filter(LearningSession.bot_id.in_(bot_ids), ChatMessage.role == "user")
                       .group_by(LearningSession.bot_id).all())
        for bot_id, name in (db.query(ClassroomBot.bot_id, Classroom.name)
                             .join(Classroom, Classroom.id == ClassroomBot.classroom_id)
                             .filter(ClassroomBot.bot_id.in_(bot_ids), Classroom.is_active == True)
                             .order_by(Classroom.name).all()):
            groups.setdefault(bot_id, []).append(name)

    result = []
    for b in bots:
        creator = creators.get(b.creator_id)
        result.append({
            "id":         b.id,
            "name":       b.name,
            "teacher":    (creator.full_name or creator.username) if creator else "?",
            "subject":    b.category or "—",
            "group":      ", ".join(groups.get(b.id, [])) or "Sin grupos asignados",
            "docs":       docs.get(b.id, 0),
            "queries":    queries.get(b.id, 0),
            "status":     "activo" if b.is_active else "inactivo",
            "visibility": "publico" if b.is_public else "privado",
            "created":    b.created_at.strftime("%Y-%m-%d") if b.created_at else "",
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


def _broadcast_recipients(body: "BroadcastSend", sender: "User", db: Session):
    """Devuelve los usuarios a los que va dirigido el broadcast (excluyendo al propio rector)."""
    inst_id = sender.institution_id
    base = db.query(User).filter(
        User.institution_id == inst_id,
        User.is_active == True,
        User.id != sender.id,
    )

    if body.recipient_type == "profesores":
        return base.filter(User.role == UserRole.PROFESOR.value).all()
    if body.recipient_type == "estudiantes":
        return base.filter(User.role == UserRole.ESTUDIANTE.value).all()
    if body.recipient_type == "grado" and body.grade:
        return base.filter(User.grade == body.grade).all()
    # institucional (default): profesores + estudiantes de la institución
    return base.filter(
        User.role.in_([UserRole.PROFESOR.value, UserRole.ESTUDIANTE.value])
    ).all()


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

        # Conteo real de lecturas: destinatarios que leyeron el mensaje entregado
        recipient_ids = notes.get("recipient_ids") or []
        total = len(recipient_ids) if recipient_ids else notes.get("total", 0)
        reads = 0
        if recipient_ids:
            reads = (
                db.query(func.count(DirectMessage.id))
                .filter(
                    DirectMessage.sender_id == lg.performed_by_id,
                    DirectMessage.receiver_id.in_(recipient_ids),
                    DirectMessage.is_read == True,
                )
                .scalar()
            ) or 0

        result.append({
            "id":       lg.id,
            "subject":  notes.get("subject", "(sin asunto)"),
            "to":       notes.get("to", "Institución"),
            "date":     lg.created_at.strftime("%Y-%m-%d %H:%M"),
            "reads":    int(reads),
            "total":    total,
            "sender":   (db.query(User).filter(User.id == lg.performed_by_id).first() or current_user).full_name or "Rector",
        })

    return {"broadcasts": result, "total": len(result)}


@router.post("/broadcasts", status_code=201)
async def send_broadcast(
    subject: str = Form(...),
    body: str = Form(...),
    recipient_type: str = Form("institucional"),
    grade: Optional[str] = Form(None),
    scheduled_at: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    # Construir el "body" del broadcast (por motivos de retrocompatibilidad con
    # JSON se aceptan también los campos vía form).
    data = BroadcastSend(
        subject=subject,
        body=body,
        recipient_type=recipient_type,
        grade=grade,
    )

    # Destinatarios reales (se excluye al propio rector)
    recipients = _broadcast_recipients(data, current_user, db)

    to_label = {
        "institucional": "Toda la institución",
        "profesores":    "Solo profesores",
        "estudiantes":   "Solo estudiantes",
        "grado":         f"Grado {data.grade}" if data.grade else "Por grado",
    }.get(data.recipient_type, data.recipient_type)

    total = len(recipients)
    recipient_ids = [u.id for u in recipients]

    # ── Entregar un mensaje real en el buzón de cada destinatario ─────────────
    if recipients:
        db.add_all([
            DirectMessage(
                sender_id=current_user.id,
                receiver_id=uid,
                content=f"📢 {data.subject}\n\n{data.body}",
            )
            for uid in recipient_ids
        ])
        db.flush()

    import json as _json
    notes = _json.dumps({
        "subject":       data.subject,
        "body":          data.body,
        "to":            to_label,
        "total":         total,
        "recipient_ids": recipient_ids,
    })

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
        "subject": data.subject,
        "to":      to_label,
        "date":    log.created_at.strftime("%Y-%m-%d %H:%M"),
        "reads":   0,
        "total":   total,
        "sender":  current_user.full_name or current_user.username,
    }
