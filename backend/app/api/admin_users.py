"""
NeuroLearn AI — Admin: Gestión de Usuarios
==========================================
GET    /admin/users              → lista todos los usuarios (filtrable por rol, institución, búsqueda)
GET    /admin/users/{id}         → detalle de un usuario
PATCH  /admin/users/{id}         → activar/desactivar, cambiar rol, editar nombre/email
DELETE /admin/users/{id}         → eliminar usuario (solo si no tiene datos vinculados)
POST   /admin/users/{id}/reset-password → generar nueva contraseña temporal
GET    /admin/stats              → estadísticas globales del sistema
GET    /admin/audit-logs         → logs de auditoría del sistema (paginado)
PATCH  /admin/institutions/{id}/license → gestionar licencia de institución
"""
import secrets, string, re
from typing import Optional, List
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user, get_password_hash
from app.models.user import User, UserRole
from app.models.institution import Institution, AuditLog

router = APIRouter(prefix="/admin", tags=["Admin - Usuarios"])


def _require_admin(user: User):
    if user.role != UserRole.ADMIN.value:
        raise HTTPException(status_code=403, detail="Solo el administrador puede acceder a esta sección")


def _gen_temp_pwd(length: int = 10) -> str:
    special = "!@#$%&*"
    pool = string.ascii_letters + string.digits + special
    mandatory = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(special),
    ]
    rest = [secrets.choice(pool) for _ in range(length - len(mandatory))]
    pwd = mandatory + rest
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


class UserUpdatePayload(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


# ─── GET /admin/users ─────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    search: Optional[str] = Query(None, description="Buscar por nombre, usuario o email"),
    role: Optional[str] = Query(None, description="Filtrar por rol"),
    institution_id: Optional[int] = Query(None, description="Filtrar por institución"),
    is_active: Optional[bool] = Query(None, description="Filtrar por estado"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    q = db.query(User)

    if search:
        term = f"%{search.lower()}%"
        q = q.filter(or_(
            func.lower(User.full_name).like(term),
            func.lower(User.username).like(term),
            func.lower(User.email).like(term),
            func.lower(User.document_number).like(term),
        ))
    if role:
        q = q.filter(User.role == role)
    if institution_id is not None:
        q = q.filter(User.institution_id == institution_id)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)

    total = q.count()
    users = q.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    # Mapear institución
    inst_ids = {u.institution_id for u in users if u.institution_id}
    institutions = {}
    if inst_ids:
        for inst in db.query(Institution).filter(Institution.id.in_(inst_ids)).all():
            institutions[inst.id] = inst.name

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "users": [
            {
                "id":               u.id,
                "username":         u.username,
                "full_name":        u.full_name or "",
                "email":            u.email or "",
                "role":             u.role,
                "is_active":        u.is_active,
                "institution_id":   u.institution_id,
                "institution_name": institutions.get(u.institution_id, "—"),
                "document_type":    u.document_type or "",
                "document_number":  u.document_number or "",
                "created_at":       u.created_at.isoformat() if u.created_at else None,
                "last_login":       u.last_login.isoformat() if getattr(u, "last_login", None) else None,
                "must_change_password": getattr(u, "must_change_password", False),
            }
            for u in users
        ],
    }


# ─── GET /admin/users/{id} ───────────────────────────────────────────────────

@router.get("/users/{user_id}")
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    inst_name = "—"
    if u.institution_id:
        inst = db.query(Institution).filter(Institution.id == u.institution_id).first()
        inst_name = inst.name if inst else "—"

    return {
        "id": u.id, "username": u.username, "full_name": u.full_name or "",
        "email": u.email or "", "role": u.role, "is_active": u.is_active,
        "institution_id": u.institution_id, "institution_name": inst_name,
        "document_type": u.document_type or "", "document_number": u.document_number or "",
        "subject_area": getattr(u, "subject_area", "") or "",
        "grade": getattr(u, "grade", "") or "",
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "last_login": u.last_login.isoformat() if getattr(u, "last_login", None) else None,
        "must_change_password": getattr(u, "must_change_password", False),
    }


# ─── PATCH /admin/users/{id} ─────────────────────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user(
    user_id: int,
    payload: UserUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.id == current_user.id and payload.is_active is False:
        raise HTTPException(400, "No puedes desactivar tu propia cuenta")

    if payload.full_name is not None:
        u.full_name = payload.full_name.strip()
    if payload.email is not None:
        email = payload.email.strip()
        if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(400, "Formato de correo inválido")
        if email:
            exists = db.query(User).filter(User.email == email, User.id != user_id).first()
            if exists:
                raise HTTPException(400, "Ese correo ya está en uso")
        u.email = email or None
    if payload.role is not None:
        valid_roles = [r.value for r in UserRole]
        if payload.role not in valid_roles:
            raise HTTPException(400, f"Rol inválido. Opciones: {valid_roles}")
        u.role = payload.role
    if payload.is_active is not None:
        u.is_active = payload.is_active

    db.commit()
    return {"ok": True, "message": "Usuario actualizado correctamente"}


# ─── DELETE /admin/users/{id} ────────────────────────────────────────────────

@router.delete("/users/{user_id}", status_code=200)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    if user_id == current_user.id:
        raise HTTPException(400, "No puedes eliminar tu propia cuenta")

    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")
    if u.role in (UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value):
        raise HTTPException(400, "No se pueden eliminar cuentas de Super Profesor o Admin. Desactívalas en su lugar.")

    db.delete(u)
    db.commit()
    return {"ok": True, "message": "Usuario eliminado"}


# ─── POST /admin/users/{id}/reset-password ───────────────────────────────────

@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "Usuario no encontrado")

    temp_pwd = _gen_temp_pwd()
    u.hashed_password = get_password_hash(temp_pwd)
    u.must_change_password = True
    db.commit()
    return {"ok": True, "temp_password": temp_pwd, "message": "Contraseña temporal generada. El usuario deberá cambiarla en su próximo login."}


# ─── GET /admin/stats ────────────────────────────────────────────────────────

@router.get("/stats")
async def admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    today = datetime.utcnow()

    # Contadores por rol
    role_counts: dict = {}
    for role in UserRole:
        role_counts[role.value] = db.query(User).filter(
            User.role == role.value, User.is_active == True
        ).count()

    total_institutions   = db.query(Institution).count()
    active_institutions  = db.query(Institution).filter(Institution.is_active == True).count()
    expired_licenses     = db.query(Institution).filter(
        Institution.expiry_date != None,
        Institution.expiry_date < today,
        Institution.is_active == True,
    ).count()
    expiring_soon = db.query(Institution).filter(
        Institution.expiry_date != None,
        Institution.expiry_date >= today,
        Institution.expiry_date <= today + timedelta(days=30),
        Institution.is_active == True,
    ).count()

    # Conteo por tipo de licencia
    license_breakdown: dict = {}
    from app.models.institution import LICENSE_LIMITS
    for lt in LICENSE_LIMITS:
        license_breakdown[lt] = db.query(Institution).filter(
            Institution.license_type == lt
        ).count()

    # Instituciones más grandes (por estudiantes)
    top_institutions = (
        db.query(
            Institution.id,
            Institution.name,
            Institution.license_type,
            Institution.is_active,
            func.count(User.id).label("student_count"),
        )
        .outerjoin(User, (User.institution_id == Institution.id) & (User.role == "estudiante"))
        .group_by(Institution.id, Institution.name, Institution.license_type, Institution.is_active)
        .order_by(desc("student_count"))
        .limit(5)
        .all()
    )

    return {
        **role_counts,
        "institutions": total_institutions,
        "institutions_active": active_institutions,
        "expired_licenses": expired_licenses,
        "expiring_soon": expiring_soon,
        "license_breakdown": license_breakdown,
        "top_institutions": [
            {
                "id": r.id,
                "name": r.name,
                "license_type": r.license_type,
                "is_active": r.is_active,
                "student_count": r.student_count,
            }
            for r in top_institutions
        ],
    }


# ─── GET /admin/audit-logs ───────────────────────────────────────────────────

@router.get("/audit-logs")
async def admin_audit_logs(
    action: Optional[str] = Query(None, description="Filtrar por acción"),
    institution_id: Optional[int] = Query(None),
    performed_by_id: Optional[int] = Query(None),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    q = db.query(AuditLog)

    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if institution_id is not None:
        q = q.filter(AuditLog.institution_id == institution_id)
    if performed_by_id is not None:
        q = q.filter(AuditLog.performed_by_id == performed_by_id)
    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            q = q.filter(AuditLog.created_at >= dt_from)
        except ValueError:
            pass
    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            q = q.filter(AuditLog.created_at < dt_to)
        except ValueError:
            pass

    total = q.count()
    logs = q.order_by(desc(AuditLog.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    # Enrich con nombre de usuario y nombre de institución
    user_ids = {l.performed_by_id for l in logs if l.performed_by_id}
    user_ids |= {l.target_user_id for l in logs if l.target_user_id}
    inst_ids = {l.institution_id for l in logs if l.institution_id}

    users_map: dict = {}
    insts_map: dict = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_map[u.id] = u.username
    if inst_ids:
        for inst in db.query(Institution).filter(Institution.id.in_(inst_ids)).all():
            insts_map[inst.id] = inst.name

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "logs": [
            {
                "id":               log.id,
                "action":           log.action,
                "performed_by_id":  log.performed_by_id,
                "performed_by":     users_map.get(log.performed_by_id, "—"),
                "target_user_id":   log.target_user_id,
                "target_user":      users_map.get(log.target_user_id, "—"),
                "institution_id":   log.institution_id,
                "institution_name": insts_map.get(log.institution_id, "—"),
                "user_type":        getattr(log, "user_type", None) or "—",
                "ip_address":       getattr(log, "ip_address", None) or "—",
                "notes":            getattr(log, "notes", None) or "",
                "created_at":       log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }


# ─── PATCH /admin/institutions/{id}/license ───────────────────────────────────

class LicenseUpdatePayload(BaseModel):
    license_type: Optional[str] = None      # basica | premium | pro
    is_active: Optional[bool] = None
    expiry_date: Optional[str] = None       # "YYYY-MM-DD" o null para quitar vencimiento
    clear_expiry: Optional[bool] = False    # True = eliminar vencimiento


@router.patch("/institutions/{institution_id}/license")
async def update_institution_license(
    institution_id: int,
    payload: LicenseUpdatePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    inst = db.query(Institution).filter(Institution.id == institution_id).first()
    if not inst:
        raise HTTPException(404, "Institución no encontrada")

    from app.models.institution import LICENSE_LIMITS
    valid_types = list(LICENSE_LIMITS.keys())

    if payload.license_type is not None:
        if payload.license_type not in valid_types:
            raise HTTPException(400, f"Tipo de licencia inválido. Opciones: {valid_types}")
        inst.license_type = payload.license_type

    if payload.is_active is not None:
        inst.is_active = payload.is_active

    if payload.clear_expiry:
        inst.expiry_date = None
    elif payload.expiry_date is not None:
        try:
            inst.expiry_date = datetime.strptime(payload.expiry_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(400, "Formato de fecha inválido. Use YYYY-MM-DD")

    db.commit()
    db.refresh(inst)

    return {
        "ok": True,
        "institution_id": inst.id,
        "name": inst.name,
        "license_type": inst.license_type,
        "is_active": inst.is_active,
        "expiry_date": inst.expiry_date.strftime("%Y-%m-%d") if inst.expiry_date else None,
        "max_teachers": inst.max_teachers,
        "max_students": inst.max_students,
    }


# ─── GET /admin/institutions (resumen con uso de licencia) ────────────────────

@router.get("/institutions")
async def admin_list_institutions(
    search: Optional[str] = Query(None),
    license_type: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    q = db.query(Institution)
    if search:
        term = f"%{search.lower()}%"
        q = q.filter(
            or_(func.lower(Institution.name).like(term),
                func.lower(Institution.dane_code).like(term))
        )
    if license_type:
        q = q.filter(Institution.license_type == license_type)
    if is_active is not None:
        q = q.filter(Institution.is_active == is_active)

    total = q.count()
    institutions = q.order_by(Institution.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    today = datetime.utcnow()
    result = []
    for inst in institutions:
        teachers = db.query(User).filter(
            User.institution_id == inst.id,
            User.role.in_(["profesor", "super_profesor"])
        ).count()
        students = db.query(User).filter(
            User.institution_id == inst.id,
            User.role == "estudiante"
        ).count()
        days_left = None
        if inst.expiry_date:
            delta = (inst.expiry_date - today).days
            days_left = max(delta, 0)
        result.append({
            "id":           inst.id,
            "name":         inst.name,
            "dane_code":    inst.dane_code,
            "license_type": inst.license_type,
            "is_active":    inst.is_active,
            "expiry_date":  inst.expiry_date.strftime("%Y-%m-%d") if inst.expiry_date else None,
            "days_left":    days_left,
            "max_teachers": inst.max_teachers,
            "max_students": inst.max_students,
            "teachers_count": teachers,
            "students_count": students,
            "created_at":   inst.created_at.isoformat() if inst.created_at else None,
        })

    return {"total": total, "page": page, "page_size": page_size, "institutions": result}
    stats["institutions_active"] = db.query(Inst).filter(Inst.is_active == True).count()
    stats["users_active"] = db.query(User).filter(User.is_active == True).count()
    stats["users_inactive"] = db.query(User).filter(User.is_active == False).count()
    return stats
