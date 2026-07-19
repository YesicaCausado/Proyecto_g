"""
NeuroLearn AI — Admin: Gestión de Usuarios
==========================================
GET    /admin/users              → lista todos los usuarios (filtrable por rol, institución, búsqueda)
GET    /admin/users/{id}         → detalle de un usuario
PATCH  /admin/users/{id}         → activar/desactivar, cambiar rol, editar nombre/email
DELETE /admin/users/{id}         → eliminar usuario (solo si no tiene datos vinculados)
POST   /admin/users/{id}/reset-password → generar nueva contraseña temporal
"""
import secrets, string, re
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user, get_password_hash
from app.models.user import User, UserRole
from app.models.institution import Institution

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

    from app.models.institution import Institution as Inst
    stats = {}
    for role in UserRole:
        stats[role.value] = db.query(User).filter(User.role == role.value).count()

    stats["institutions"] = db.query(Inst).count()
    stats["institutions_active"] = db.query(Inst).filter(Inst.is_active == True).count()
    stats["users_active"] = db.query(User).filter(User.is_active == True).count()
    stats["users_inactive"] = db.query(User).filter(User.is_active == False).count()
    return stats
