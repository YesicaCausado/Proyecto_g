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
from pydantic import BaseModel, Field, field_validator

from app.core import validators as v
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
from app.services import neuroalert_service

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
        "logo_url":     inst.logo_url,
        "created_at":   inst.created_at.isoformat() if inst.created_at else None,
    }


class InstitutionUpdate(BaseModel):
    """Datos de la institución que edita el Súper Profesor. Los campos
    opcionales se pueden vaciar enviando ""."""
    name: Optional[str] = Field(None, max_length=200)
    dane_code: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=200)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=255)
    logo_url: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _name(cls, value: Optional[str]) -> Optional[str]:
        # El vacío se responde con un 400 propio en el endpoint.
        if value is None or not value.strip():
            return value
        return v.clean_text(value, label="El nombre de la institución", min_len=2, max_len=200)

    @field_validator("dane_code")
    @classmethod
    def _dane(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not value.strip():
            return value
        return v.dane_code(value)

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else (v.email(value, label="El correo institucional", max_len=200, required=False) or "")

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else (v.phone(value) or "")

    @field_validator("address")
    @classmethod
    def _address(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else (v.clean_text(value, label="La dirección", max_len=255, required=False) or "")

    @field_validator("website")
    @classmethod
    def _website(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else (v.http_url(value, label="El sitio web", max_len=255, required=False) or "")


LOGO_MAX_BYTES = 2 * 1024 * 1024
_LOGO_PREFIXES = ("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")


def _validate_logo(logo: str) -> None:
    """El logo llega como data URL (PNG, JPG o WebP, máximo 2 MB). Se muestra
    en los paneles de todos los usuarios de la institución."""
    import base64
    import binascii
    prefix = next((p for p in _LOGO_PREFIXES if logo.startswith(p)), None)
    if prefix is None:
        raise HTTPException(400, "El logo debe ser una imagen PNG, JPG o WebP.")
    try:
        raw = base64.b64decode(logo[len(prefix):], validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(400, "El archivo del logo está dañado.")
    if not raw:
        raise HTTPException(400, "El archivo del logo está vacío.")
    if len(raw) > LOGO_MAX_BYTES:
        raise HTTPException(400, "El logo supera el límite de 2 MB.")
    if not v.image_matches(raw, prefix[len("data:"):].split(";", 1)[0]):
        raise HTTPException(400, "El archivo del logo no es una imagen PNG, JPG o WebP válida.")


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

    if payload.logo_url:
        _validate_logo(payload.logo_url)
    if payload.name is not None and not payload.name.strip():
        raise HTTPException(400, "El nombre de la institución no puede quedar vacío.")
    if payload.dane_code is not None:
        dane = payload.dane_code.strip()
        if not dane:
            raise HTTPException(400, "El código DANE no puede quedar vacío.")
        clash = db.query(Institution.id).filter(Institution.dane_code == dane, Institution.id != inst.id).first()
        if clash:
            raise HTTPException(400, "Ya existe otra institución con ese código DANE.")

    for field_name in [
        "name",
        "dane_code",
        "email",
        "phone",
        "address",
        "website",
        "logo_url",
    ]:
        value = getattr(payload, field_name, None)
        if value is None:
            continue
        if isinstance(value, str):
            value = value.strip()
            if field_name in {"email", "phone", "address", "website", "logo_url"} and value == "":
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


def _institution_staff_ids(db: Session, inst_id: int) -> list[int]:
    """Profesores y Súper Profesores de la institución (activos o no): dueños
    posibles de los grupos que se cuentan en el panel y en Grupos."""
    return [uid for (uid,) in db.query(User.id).filter(
        User.role.in_([UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value]),
        User.institution_id == inst_id,
    ).all()]


def _avg10(values: list[float]) -> Optional[float]:
    """Promedio 0-100 → escala 0-10; None cuando no hay datos (no 0)."""
    return round(sum(values) / len(values) / 10, 1) if values else None


def _compute_super_dashboard(current_user: User, db: Session):
    inst_id = _get_institution_id(current_user, db)
    if not inst_id:
        raise HTTPException(status_code=400, detail="No tienes una institución asignada")

    # ── Usuarios activos de la institución ───────────────────────
    teachers = db.query(User).filter(
        User.role == UserRole.PROFESOR.value,
        User.is_active == True,  # noqa: E712
        User.institution_id == inst_id,
    ).order_by(User.full_name).all()
    student_ids = [uid for (uid,) in db.query(User.id).filter(
        User.role == UserRole.ESTUDIANTE.value,
        User.is_active == True,  # noqa: E712
        User.institution_id == inst_id,
    ).all()]

    # ── Grupos activos (misma definición que «Grupos activos» en Grupos) ──
    classrooms = db.query(Classroom).filter(
        Classroom.is_active == True,  # noqa: E712
        Classroom.teacher_id.in_(_institution_staff_ids(db, inst_id)),
    ).all()
    classroom_by_id = {c.id: c for c in classrooms}

    # Inscripciones activas de estudiantes activos en esos grupos.
    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id.in_(list(classroom_by_id)),
        Enrollment.is_active == True,  # noqa: E712
        Enrollment.student_id.in_(student_ids),
    ).all() if classroom_by_id and student_ids else []

    # ── Promedio general (quizzes reales; None si no hay ninguno) ─
    avg_score = None
    if student_ids:
        avg_raw = db.query(func.avg(QuizHistory.performance_score)).filter(
            QuizHistory.user_id.in_(student_ids),
            QuizHistory.performance_score != None,  # noqa: E711
        ).scalar()
        avg_score = round(float(avg_raw) / 10, 1) if avg_raw is not None else None

    # ── Estudiantes en riesgo (riesgo medio/alto en alguna inscripción) ──
    risk_rank = {"high": 0, "medium": 1}
    worst: dict[int, Enrollment] = {}
    for e in enrollments:
        if e.risk_level in risk_rank:
            cur = worst.get(e.student_id)
            if cur is None or risk_rank[e.risk_level] < risk_rank[cur.risk_level]:
                worst[e.student_id] = e
    names = {u.id: u for u in db.query(User).filter(User.id.in_(list(worst))).all()} if worst else {}
    at_risk_detail = []
    for sid, e in worst.items():
        st = names.get(sid)
        c = classroom_by_id.get(e.classroom_id)
        at_risk_detail.append({
            "name":    (st.full_name or st.username) if st else "Estudiante",
            "grade":   (st.grade if st else None) or "—",
            "avg":     _avg10([float(e.average_score or 0)]) if (e.total_sessions or 0) > 0 else None,
            "subject": c.subject if c else "—",
            "classroom": c.name if c else "—",
            "risk":    e.risk_level,
        })
    at_risk_detail.sort(key=lambda x: (risk_rank[x["risk"]], x["avg"] if x["avg"] is not None else 99))

    # ── Ranking de profesores (solo promedios con actividad real) ─
    week_ago = datetime.utcnow() - timedelta(days=7)
    by_teacher: dict[int, list[Enrollment]] = {}
    for e in enrollments:
        by_teacher.setdefault(classroom_by_id[e.classroom_id].teacher_id, []).append(e)
    teacher_ranking = []
    for t in teachers:
        if not any(c.teacher_id == t.id for c in classrooms):
            continue
        ens = by_teacher.get(t.id, [])
        students = {e.student_id for e in ens}
        active = {e.student_id for e in ens if e.last_activity and e.last_activity > week_ago}
        teacher_ranking.append({
            "name": t.full_name or t.username,
            "subject": t.subject_area or "—",
            "avg": _avg10([float(e.average_score or 0) for e in ens if (e.total_sessions or 0) > 0]),
            "participation": round(len(active) / len(students) * 100) if students else None,
            "students": len(students),
        })
    teacher_ranking.sort(key=lambda x: (x["avg"] is None, -(x["avg"] or 0), x["name"]))

    # ── Áreas: distribución de grupos y rendimiento real por área ─
    areas: dict[str, int] = {}
    scores_by_area: dict[str, list[float]] = {}
    students_by_area: dict[str, set] = {}
    for c in classrooms:
        key = (c.subject or "Otra").strip() or "Otra"
        areas[key] = areas.get(key, 0) + 1
    for e in enrollments:
        key = (classroom_by_id[e.classroom_id].subject or "Otra").strip() or "Otra"
        if (e.total_sessions or 0) > 0:
            scores_by_area.setdefault(key, []).append(float(e.average_score or 0))
            students_by_area.setdefault(key, set()).add(e.student_id)
    total_cls = sum(areas.values())
    areas_data = [
        {"label": k, "groups": v, "pct": round(v / total_cls * 100)}
        for k, v in sorted(areas.items(), key=lambda x: -x[1])
    ]
    areas_performance = [
        {"label": k, "avg_pct": round(sum(v) / len(v), 1), "students": len(students_by_area[k])}
        for k, v in sorted(scores_by_area.items(), key=lambda x: -(sum(x[1]) / len(x[1])))
    ]

    return {
        "total_teachers": len(teachers),
        "total_students": len(student_ids),
        "total_groups":   len(classrooms),
        "avg_score":      avg_score,
        "at_risk_count":  len(worst),
        "teacher_ranking": teacher_ranking[:10],
        "at_risk_detail":  at_risk_detail[:8],
        "areas_data":      areas_data[:8],
        "areas_performance": areas_performance[:8],
    }


# ── GET /super/stats/alerts ───────────────────────────────────────────────────

@router.get("/stats/alerts")
async def get_super_alerts(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.VER_NEUROALERTAS)),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    alerts = _institution_alerts(current_user, db)
    acks = neuroalert_service.acknowledged(db, current_user.id, [a["key"] for a in alerts])
    result = []
    for a in alerts:
        item = {k: v for k, v in a.items() if k not in ("key", "signature")}
        item["resolved"] = neuroalert_service.is_resolved(acks, a)
        result.append(item)
    counts = {p: sum(1 for a in result if a["priority"] == p and not a["resolved"]) for p in ("alta", "media", "baja")}
    return {
        "alerts": result,
        "total": len(result),
        "active": sum(counts.values()),
        "counts": counts,
    }


_ALERT_TEXT = {
    "inactividad":      ("Inactividad", "{name} sin actividad", "Sin actividad desde hace {days} días en {cls}."),
    "sin_inicio":       ("Sin inicio", "{name} nunca inició", "Nunca ha iniciado una sesión en {cls}."),
    "bajo_rendimiento": ("Bajo rendimiento", "{name} — promedio muy bajo", "Promedio de {score:.0f}% en {cls}."),
    "riesgo_cognitivo": ("Riesgo cognitivo", "Riesgo detectado: {name}", "Factores: {factors} en {cls}."),
}


def _institution_alerts(current_user: User, db: Session) -> list[dict]:
    """NeuroAlertas de los grupos activos de la institución (estudiantes activos)."""
    inst_id = _get_institution_id(current_user, db)
    if not inst_id:
        return []
    rows = (
        db.query(Enrollment, Classroom, User)
        .join(Classroom, Classroom.id == Enrollment.classroom_id)
        .join(User, User.id == Enrollment.student_id)
        .filter(
            Classroom.is_active == True,  # noqa: E712
            Classroom.teacher_id.in_(_institution_staff_ids(db, inst_id)),
            Enrollment.is_active == True,  # noqa: E712
            User.is_active == True,  # noqa: E712
            User.role == UserRole.ESTUDIANTE.value,
        )
        .all()
    )
    now = datetime.utcnow()
    alerts = []
    for e, c, st in rows:
        name = st.full_name or st.username
        common = {
            "studentId":   e.student_id,
            "studentName": name,
            "classroom":   c.name,
            "grade":       st.grade,
            "subject":     c.subject,
            "competency":  classroom_competency(c),
            "averageScore": round(float(e.average_score or 0), 1),
            "totalSessions": int(e.total_sessions or 0),
            "totalTimeMinutes": int(e.total_time_minutes or 0),
            "riskLevel":    e.risk_level,
            "riskFactors":  e.risk_factors or [],
        }
        for a in neuroalert_service.enrollment_alerts(e, now):
            category, title, desc = _ALERT_TEXT[a["type"]]
            fmt = {
                "name": name, "cls": c.name, "days": a.get("days_inactive"),
                "score": float(e.average_score or 0),
                "factors": ", ".join(e.risk_factors or ["detectado"]),
            }
            item = {
                "id": a["key"],
                "key": a["key"],
                "signature": a["signature"],
                "priority": "alta" if a["severity"] == "high" else "media",
                "category": category,
                "title": title.format(**fmt),
                "description": desc.format(**fmt),
                "affectedCount": 1,
                "affectedLabel": "estudiante",
                "time": {
                    "inactividad": f"Hace {a.get('days_inactive')} días",
                    "sin_inicio": "Pendiente",
                }.get(a["type"], "Actual"),
                **common,
            }
            if a["type"] == "inactividad":
                item["daysInactive"] = a["days_inactive"]
            alerts.append(item)

    priority_order = {"alta": 0, "media": 1, "baja": 2}
    alerts.sort(key=lambda a: (priority_order.get(a["priority"], 3), a["studentName"]))
    return alerts


@router.post("/stats/alerts/{alert_id}/resolve")
async def resolve_super_alert(
    alert_id: str,
    resolved: bool = Query(True),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.VER_NEUROALERTAS)),
    db: Session = Depends(get_db),
):
    """Marca (o reabre con resolved=false) una NeuroAlerta vigente de la institución."""
    _require_super(current_user)
    alert = next((a for a in _institution_alerts(current_user, db) if a["key"] == alert_id), None)
    if alert is None:
        raise HTTPException(404, "La alerta ya no está vigente o no pertenece a tu institución.")
    neuroalert_service.set_resolved(db, current_user.id, alert, resolved)
    db.commit()
    return {"id": alert_id, "resolved": resolved}


# ── GET /super/audit ──────────────────────────────────────────────────────────

# Categoría de cada acción registrada en audit_logs (para filtrar en el servidor).
AUDIT_CATEGORIES: dict[str, tuple[str, ...]] = {
    "create":   ("create_teacher", "create_student", "bulk_create_teacher", "bulk_create_student",
                 "create_institution", "create_classroom"),
    "update":   ("update_teacher", "update_student", "update_classroom"),
    "delete":   ("deactivate_teacher", "deactivate_student"),
    "login":    ("login", "login_success", "login_failed"),
    "security": ("revoke_sessions", "password_reset_requested", "password_reset_completed"),
    "broadcast": ("broadcast",),
}
_ACTION_CATEGORY = {a: cat for cat, actions in AUDIT_CATEGORIES.items() for a in actions}


def _audit_description(lg: AuditLog, target_name: Optional[str]) -> str:
    """Texto legible del registro (los comunicados guardan JSON interno)."""
    if lg.action == "broadcast":
        import json as _json
        try:
            data = _json.loads(lg.notes or "{}")
        except ValueError:
            data = {}
        return f"Comunicado «{data.get('subject', '(sin asunto)')}» a {data.get('to', 'la institución')} ({data.get('total', 0)} destinatarios)"
    parts = [p for p in (lg.notes, target_name and f"Usuario: {target_name}") if p]
    return " · ".join(parts) or lg.action


@router.get("/audit")
async def get_audit_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD (incluido)"),
    q: Optional[str] = Query(None, description="Texto en la descripción o el nombre de quien actuó"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)

    query = db.query(AuditLog).filter(AuditLog.institution_id == inst_id)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))
    if category:
        if category == "other":
            query = query.filter(AuditLog.action.notin_(list(_ACTION_CATEGORY)))
        elif category in AUDIT_CATEGORIES:
            query = query.filter(AuditLog.action.in_(AUDIT_CATEGORIES[category]))
        else:
            raise HTTPException(400, "Categoría inválida.")
    try:
        if date_from:
            query = query.filter(AuditLog.created_at >= datetime.strptime(date_from, "%Y-%m-%d"))
        if date_to:
            query = query.filter(AuditLog.created_at < datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1))
    except ValueError:
        raise HTTPException(400, "Fecha inválida (usa AAAA-MM-DD).")
    if q and q.strip():
        term = f"%{q.strip()}%"
        actors = db.query(User.id).filter(User.institution_id == inst_id,
                                          or_(User.full_name.ilike(term), User.username.ilike(term)))
        query = query.filter(or_(AuditLog.notes.ilike(term), AuditLog.performed_by_id.in_(actors),
                                 AuditLog.target_user_id.in_(actors)))
    total = query.count()
    logs = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).offset(offset).limit(limit).all()

    people_ids = {lg.performed_by_id for lg in logs} | {lg.target_user_id for lg in logs}
    people = {u.id: u for u in db.query(User).filter(User.id.in_([i for i in people_ids if i])).all()}

    result = []
    for lg in logs:
        by = people.get(lg.performed_by_id)
        target = people.get(lg.target_user_id)
        target_name = (target.full_name or target.username) if target else None
        result.append({
            "id":           lg.id,
            "action":       lg.action,
            "category":     _ACTION_CATEGORY.get(lg.action, "other"),
            "performed_by": (by.full_name or by.username) if by else "Sistema",
            "performed_by_role": by.role if by else None,
            "target_user":  target_name,
            "user_type":    lg.user_type,
            "ip_address":   lg.ip_address,
            "description":  _audit_description(lg, target_name),
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

    day_ago = datetime.utcnow() - timedelta(hours=24)

    # Usuarios activos de la institución con login en las últimas 24 h
    # (antes se cargaban TODOS y se filtraba en Python).
    users = db.query(User).filter(
        User.institution_id == inst_id,
        User.is_active == True,
        User.last_login > day_ago,
    ).all()

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

    authors = {u.id: u for u in db.query(User).filter(
        User.id.in_({lg.performed_by_id for lg in audit_logins if lg.performed_by_id}))}
    for lg in audit_logins:
        by = authors.get(lg.performed_by_id)
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
    teacher_ids = _institution_staff_ids(db, inst_id) if inst_id else []

    if not teacher_ids:
        return {"classrooms": [], "total": 0, "unique_students": 0}

    q = db.query(Classroom).filter(
        Classroom.teacher_id.in_(teacher_ids),
    )
    if search:
        q = q.filter(Classroom.name.ilike(f"%{search}%"))

    classrooms = q.order_by(Classroom.created_at.desc()).all()
    teachers = {u.id: u for u in db.query(User).filter(User.id.in_(teacher_ids)).all()}
    # Inscripciones activas de estudiantes activos, en una sola consulta.
    by_classroom: dict[int, list[Enrollment]] = {}
    if classrooms:
        for e in (db.query(Enrollment)
                  .join(User, User.id == Enrollment.student_id)
                  .filter(Enrollment.classroom_id.in_([c.id for c in classrooms]),
                          Enrollment.is_active == True,  # noqa: E712
                          User.is_active == True)  # noqa: E712
                  .all()):
            by_classroom.setdefault(e.classroom_id, []).append(e)

    result = []
    unique_students: set[int] = set()
    for c in classrooms:
        teacher = teachers.get(c.teacher_id)
        enrollments = by_classroom.get(c.id, [])
        student_count = len(enrollments)
        if c.is_active:
            unique_students.update(e.student_id for e in enrollments)
        # Promedio del grupo: solo estudiantes con sesiones (None = sin datos).
        avg = _avg10([float(e.average_score or 0) for e in enrollments if (e.total_sessions or 0) > 0])
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
            "teacher":     (teacher.full_name or teacher.username) if teacher else "?",
            "teacherActive": bool(teacher and teacher.is_active),
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

    return {"classrooms": result, "total": len(result), "unique_students": len(unique_students)}


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
        .filter(Enrollment.classroom_id == c.id, Enrollment.is_active == True,  # noqa: E712
                User.is_active == True)  # noqa: E712
        .order_by(User.full_name)
        .all()
    )
    students = [{
        "id":           u.id,
        "name":         u.full_name or u.username,
        "email":        u.email,
        "avg":          _avg10([float(e.average_score or 0)]) if (e.total_sessions or 0) > 0 else None,
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
    # Datos del grupo (RF-10: el Súper Profesor también los edita).
    name: Optional[str] = Field(default=None, max_length=150)
    subject: Optional[str] = Field(default=None, max_length=100)
    grade: Optional[str] = Field(default=None, max_length=20)
    description: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("grade")
    @classmethod
    def _grade(cls, value: Optional[str]) -> Optional[str]:
        return v.grade(value)

    @field_validator("description")
    @classmethod
    def _description(cls, value: Optional[str]) -> Optional[str]:
        return v.clean_text(value, label="La descripción", max_len=2000, required=False, multiline=True)


class SuperClassroomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    subject: str = Field(..., min_length=1, max_length=100)
    grade: str = Field(default="", max_length=20)
    description: str = Field(default="", max_length=2000)
    teacher_id: int
    competency: Optional[str] = Field(default=None, max_length=30)
    max_students: int = Field(default=40, ge=1, le=100)

    @field_validator("grade")
    @classmethod
    def _grade(cls, value: str) -> str:
        return v.grade(value) or ""

    @field_validator("description")
    @classmethod
    def _description(cls, value: str) -> str:
        return v.clean_text(value, label="La descripción", max_len=2000, required=False, multiline=True)


def _active_institution_teacher(db: Session, current_user: User, teacher_id: int) -> User:
    teacher = db.query(User).filter(
        User.id == teacher_id,
        User.role == UserRole.PROFESOR.value,
        User.institution_id == current_user.institution_id,
        User.is_active == True,  # noqa: E712
    ).first()
    if not teacher:
        raise HTTPException(400, "El profesor elegido no existe o no pertenece a tu institución.")
    return teacher


@router.post("/classrooms", status_code=201)
async def create_super_classroom(
    data: SuperClassroomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea un grupo de la institución a cargo de un profesor activo (RF-10)."""
    _require_super(current_user)
    if not current_user.institution_id:
        raise HTTPException(400, "No tienes una institución asignada")
    teacher = _active_institution_teacher(db, current_user, data.teacher_id)
    name, subject = data.name.strip(), data.subject.strip()
    if not name or not subject:
        raise HTTPException(400, "El nombre y la materia del grupo son obligatorios.")
    if data.competency and data.competency != "general" and valid_key(data.competency) is None:
        raise HTTPException(400, "Competencia inválida.")
    from app.services.competencies import from_subject
    from app.services import notification_service
    code = Classroom.generate_invite_code()
    while db.query(Classroom.id).filter(Classroom.invite_code == code).first():
        code = Classroom.generate_invite_code()
    c = Classroom(
        teacher_id=teacher.id,
        name=name,
        subject=subject,
        grade=data.grade.strip(),
        description=data.description.strip(),
        competency=(None if data.competency == "general"
                    else valid_key(data.competency) if data.competency else from_subject(subject)),
        max_students=data.max_students,
        invite_code=code,
    )
    db.add(c)
    db.flush()
    db.add(AuditLog(
        action="create_classroom",
        performed_by_id=current_user.id,
        target_user_id=teacher.id,
        institution_id=current_user.institution_id,
        notes=f"Grupo «{c.name}» creado para {teacher.full_name or teacher.username}",
    ))
    notification_service.notify(
        db, [teacher.id], "actividad_institucional", "Nuevo grupo asignado",
        f'{current_user.full_name or current_user.username} te asignó el grupo "{c.name}".',
        link="/teacher?tab=grupos", resource_type="aula", resource_id=c.id,
    )
    db.commit()
    return {"id": c.id, "name": c.name, "code": c.invite_code, "teacherId": teacher.id,
            "teacher": teacher.full_name or teacher.username, "status": "activo"}


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
        new_teacher = _active_institution_teacher(db, current_user, data.teacher_id)
        notes.append(f"transferido a {new_teacher.full_name or new_teacher.username}")
        c.teacher_id = new_teacher.id
    for field, label in (("name", "nombre"), ("subject", "materia"), ("grade", "grado"), ("description", "descripción")):
        value = getattr(data, field)
        if value is None:
            continue
        value = value.strip()
        if field in ("name", "subject") and not value:
            raise HTTPException(400, f"El {label} del grupo no puede quedar vacío.")
        if value != (getattr(c, field) or ""):
            setattr(c, field, value)
            notes.append(f"{label} actualizado")
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

    # Profesores de la institución, activos o no: los NeuroBots de un profesor
    # desactivado siguen existiendo (y los públicos siguen disponibles), así
    # que el Súper Profesor debe poder verlos y moderarlos.
    teacher_ids = [uid for (uid,) in db.query(User.id).filter(
        User.role == UserRole.PROFESOR.value,
        User.institution_id == inst_id,
    ).all()] if inst_id else []

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
    docs, queries, groups, individual = {}, {}, {}, {}
    if bot_ids:
        from app.models.bot_document import BotDocument
        from app.models.classroom import ClassroomBot
        from app.models.neurobot_assignment import StudentBotAssignment
        individual = dict(db.query(StudentBotAssignment.bot_id, func.count(StudentBotAssignment.id))
                          .filter(StudentBotAssignment.bot_id.in_(bot_ids))
                          .group_by(StudentBotAssignment.bot_id).all())
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
            "teacherActive": bool(creator and creator.is_active),
            "subject":    b.category or "",
            "groups":     groups.get(b.id, []),
            "individualAssignments": int(individual.get(b.id, 0)),
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
    if body.recipient_type == "grado":
        return base.filter(User.role == UserRole.ESTUDIANTE.value, User.grade == body.grade).all()
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

        # Conteo real de lecturas: solo los mensajes que entregó ESTE comunicado
        # (antes contaba cualquier mensaje leído del rector a esas personas).
        recipient_ids = notes.get("recipient_ids") or []
        message_ids = notes.get("message_ids") or []
        total = len(recipient_ids) if recipient_ids else notes.get("total", 0)
        reads = 0
        if message_ids:
            reads = db.query(func.count(DirectMessage.id)).filter(
                DirectMessage.id.in_(message_ids),
                DirectMessage.is_read == True,  # noqa: E712
            ).scalar() or 0
        elif recipient_ids:
            # Comunicados anteriores (sin ids guardados): el mismo texto entregado.
            reads = db.query(func.count(DirectMessage.id)).filter(
                DirectMessage.sender_id == lg.performed_by_id,
                DirectMessage.receiver_id.in_(recipient_ids),
                DirectMessage.content == _broadcast_content(notes.get("subject", ""), notes.get("body", "")),
                DirectMessage.is_read == True,  # noqa: E712
            ).scalar() or 0

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


def _broadcast_content(subject: str, body: str) -> str:
    return f"📢 {subject}\n\n{body}"


@router.post("/broadcasts", status_code=201)
async def send_broadcast(
    subject: str = Form(...),
    body: str = Form(...),
    recipient_type: str = Form("institucional"),
    grade: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_super(current_user)
    inst_id = _get_institution_id(current_user, db)
    subject = v.or_400(v.clean_text, subject, label="El asunto", max_len=200)
    body = v.or_400(v.clean_text, body, label="El mensaje", max_len=5000, multiline=True)
    grade = v.or_400(v.grade, grade) or None
    if recipient_type not in ("institucional", "profesores", "estudiantes", "grado"):
        raise HTTPException(400, "Tipo de destinatario inválido.")
    if recipient_type == "grado" and not grade:
        # Antes, sin grado el comunicado se enviaba a toda la institución.
        raise HTTPException(400, "Selecciona el grado al que va dirigido el mensaje.")

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
    if not recipient_ids:
        raise HTTPException(400, "No hay destinatarios activos para ese envío.")

    # ── Entregar un mensaje real en el buzón de cada destinatario ─────────────
    delivered = [
        DirectMessage(
            sender_id=current_user.id,
            receiver_id=uid,
            content=_broadcast_content(data.subject, data.body),
        )
        for uid in recipient_ids
    ]
    db.add_all(delivered)
    db.flush()

    import json as _json
    notes = _json.dumps({
        "subject":       data.subject,
        "body":          data.body,
        "to":            to_label,
        "total":         total,
        "recipient_ids": recipient_ids,
        "message_ids":   [m.id for m in delivered],
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
