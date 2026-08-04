"""
NeuroLearn AI — API de Credenciales y Gestión B2B
Endpoints:
  POST  /admin/institutions           → crea institución + super profesor
  GET   /admin/institutions           → lista instituciones (admin)
  POST  /super/teachers               → crea profesor individual
  POST  /super/teachers/bulk          → carga masiva CSV profesores
  POST  /super/students               → crea estudiante individual
  POST  /super/students/bulk          → carga masiva CSV estudiantes
  GET   /super/license-usage          → uso de la licencia
  POST  /auth/change-password         → cambio de contraseña (primer login)
"""
import csv
import io
import re
import secrets
import string
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user, get_password_hash, verify_password
from app.models.user import User, UserRole
from app.models.institution import Institution, AuditLog, LICENSE_LIMITS
from app.schemas.schemas import (
    InstitutionCreate, InstitutionResponse, InstitutionListItem,
    TeacherCreate, TeacherListItem, StudentCreate, BulkCreateResponse,
    CredentialItem, LicenseUsage, ChangePasswordRequest, AdminStats,
)

from app.services.email_service import send_credentials_email

router = APIRouter(tags=["Credenciales B2B"])


# ─── Utilidades ──────────────────────────────────────────────────────────────

def _gen_temp_password(length: int = 10) -> str:
    """Genera contraseña segura: mayúsc + minúsc + dígito + especial + relleno."""
    special = "!@#$%&*"
    mandatory = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(special),
    ]
    pool = string.ascii_letters + string.digits + special
    rest = [secrets.choice(pool) for _ in range(length - len(mandatory))]
    pwd = mandatory + rest
    secrets.SystemRandom().shuffle(pwd)
    return "".join(pwd)


def _validate_email(email: str) -> bool:
    return bool(re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email))


def _require_role(current_user: User, *roles: str):
    if current_user.role not in roles:
        raise HTTPException(status_code=403, detail="No tienes permisos para esta acción")


def _log(db: Session, action: str, performed_by: User, institution_id: Optional[int],
         target_id: Optional[int], user_type: str, ip: str, notes: str = ""):
    entry = AuditLog(
        action=action,
        performed_by_id=performed_by.id,
        target_user_id=target_id,
        institution_id=institution_id,
        user_type=user_type,
        ip_address=ip,
        notes=notes,
    )
    db.add(entry)


def _client_ip(request: Request) -> str:
    return (request.headers.get("X-Forwarded-For") or
            getattr(request.client, "host", "unknown"))


# ─── Licencia ─────────────────────────────────────────────────────────────────

def _check_license(db: Session, institution: Institution, role: str):
    """Lanza 403 si se supera el límite de la licencia."""
    limits = LICENSE_LIMITS.get(institution.license_type, LICENSE_LIMITS["basica"])
    if role == UserRole.PROFESOR.value:
        count = db.query(User).filter(
            User.institution_id == institution.id,
            User.role == UserRole.PROFESOR.value,
            User.is_active == True,
        ).count()
        if count >= limits["teachers"]:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Has alcanzado el límite de profesores de tu licencia "
                    f"({limits['teachers']}/{limits['teachers']}). "
                    "Actualiza tu licencia para continuar."
                ),
            )
    elif role == UserRole.ESTUDIANTE.value:
        count = db.query(User).filter(
            User.institution_id == institution.id,
            User.role == UserRole.ESTUDIANTE.value,
            User.is_active == True,
        ).count()
        if count >= limits["students"]:
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Has alcanzado el límite de estudiantes de tu licencia "
                    f"({limits['students']}/{limits['students']}). "
                    "Actualiza tu licencia para continuar."
                ),
            )


# ─── Admin: Instituciones ─────────────────────────────────────────────────────

@router.post("/admin/institutions", response_model=InstitutionResponse, status_code=201)
async def create_institution(
    payload: InstitutionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.ADMIN.value)

    # Validar unicidad
    if db.query(Institution).filter(Institution.dane_code == payload.dane_code).first():
        raise HTTPException(400, "Ya existe una institución con ese Código DANE")
    if db.query(User).filter(User.document_number == payload.sp_document_number).first():
        raise HTTPException(400, "Ya existe un usuario con ese número de documento")
    if db.query(User).filter(User.email == payload.sp_email).first():
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")
    if not _validate_email(payload.sp_email):
        raise HTTPException(400, "Formato de correo inválido")

    # Crear institución
    institution = Institution(
        name=payload.name,
        dane_code=payload.dane_code,
        license_type=payload.license_type,
        created_by=current_user.id,
    )
    db.add(institution)
    db.flush()  # obtener institution.id

    # Crear Super Profesor
    temp_pwd = _gen_temp_password()
    sp = User(
        username=payload.sp_document_number,
        email=payload.sp_email,
        full_name=payload.sp_full_name,
        hashed_password=get_password_hash(temp_pwd),
        role=UserRole.SUPER_PROFESOR.value,
        document_type=payload.sp_document_type,
        document_number=payload.sp_document_number,
        institution_id=institution.id,
        must_change_password=True,
    )
    db.add(sp)
    db.flush()

    _log(db, "create_institution", current_user, institution.id,
         sp.id, "super_profesor", _client_ip(request),
         f"Institución: {institution.name}")

    db.commit()

    send_credentials_email(
        to_email=sp.email,
        to_name=sp.full_name or sp.username,
        username=sp.username,
        temp_password=temp_pwd,
        role=sp.role,
    )

    return {
        "id": institution.id,
        "name": institution.name,
        "dane_code": institution.dane_code,
        "license_type": institution.license_type,
        "is_active": institution.is_active,
        "created_at": institution.created_at,
        "credential": CredentialItem(
            full_name=sp.full_name,
            username=sp.username,
            temp_password=temp_pwd,
            role=sp.role,
        ),
    }

@router.get("/admin/stats", response_model=AdminStats)
async def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Estadísticas globales del sistema — solo para administradores."""
    _require_role(current_user, UserRole.ADMIN.value)

    total_institutions  = db.query(Institution).count()
    active_institutions = db.query(Institution).filter(Institution.is_active == True).count()

    total_super_profesores = db.query(User).filter(
        User.role == UserRole.SUPER_PROFESOR.value,
        User.is_active == True,
    ).count()

    total_profesores = db.query(User).filter(
        User.role == UserRole.PROFESOR.value,
        User.is_active == True,
    ).count()

    total_estudiantes = db.query(User).filter(
        User.role == UserRole.ESTUDIANTE.value,
        User.is_active == True,
    ).count()

    return AdminStats(
        total_institutions=total_institutions,
        active_institutions=active_institutions,
        total_super_profesores=total_super_profesores,
        total_profesores=total_profesores,
        total_estudiantes=total_estudiantes,
    )


@router.get("/admin/institutions", response_model=List[InstitutionListItem])
async def list_institutions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.ADMIN.value)
    institutions = db.query(Institution).order_by(Institution.created_at.desc()).all()
    result = []
    for inst in institutions:
        t_count = db.query(User).filter(
            User.institution_id == inst.id, User.role == UserRole.PROFESOR.value).count()
        s_count = db.query(User).filter(
            User.institution_id == inst.id, User.role == UserRole.ESTUDIANTE.value).count()
        result.append(InstitutionListItem(
            id=inst.id, name=inst.name, dane_code=inst.dane_code,
            license_type=inst.license_type, is_active=inst.is_active,
            created_at=inst.created_at, teacher_count=t_count, student_count=s_count,
        ))
    return result


# ─── Super Profesor: Profesores ───────────────────────────────────────────────

def _get_my_institution(db: Session, user: User) -> Institution:
    if not user.institution_id:
        raise HTTPException(400, "No tienes una institución asignada")
    inst = db.query(Institution).filter(Institution.id == user.institution_id).first()
    if not inst:
        raise HTTPException(404, "Institución no encontrada")
    return inst


@router.get("/super/teachers", response_model=List[TeacherListItem])
async def list_teachers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    teachers = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.PROFESOR.value,
    ).order_by(User.full_name).all()
    return [
        TeacherListItem(
            id=t.id,
            full_name=t.full_name,
            username=t.username,
            email=t.email or "",
            document_type=t.document_type or "",
            document_number=t.document_number or "",
            subject_area=t.subject_area or "",
            is_active=t.is_active,
        )
        for t in teachers
    ]


@router.post("/super/teachers", response_model=CredentialItem, status_code=201)
async def create_teacher(
    payload: TeacherCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    _check_license(db, institution, UserRole.PROFESOR.value)

    if db.query(User).filter(User.document_number == payload.document_number).first():
        raise HTTPException(400, "Ya existe un usuario con ese número de documento")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")
    if not _validate_email(payload.email):
        raise HTTPException(400, "Formato de correo inválido")

    temp_pwd = _gen_temp_password()
    teacher = User(
        username=payload.document_number,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(temp_pwd),
        role=UserRole.PROFESOR.value,
        document_type=payload.document_type,
        document_number=payload.document_number,
        subject_area=payload.subject_area,
        institution_id=institution.id,
        must_change_password=True,
    )
    db.add(teacher)
    db.flush()
    _log(db, "create_teacher", current_user, institution.id,
         teacher.id, "profesor", _client_ip(request))
    db.commit()

    send_credentials_email(
        to_email=teacher.email,
        to_name=teacher.full_name or teacher.username,
        username=teacher.username,
        temp_password=temp_pwd,
        role=teacher.role,
    )

    return CredentialItem(
        full_name=teacher.full_name,
        username=teacher.username,
        temp_password=temp_pwd,
        role=teacher.role,
    )


@router.post("/super/teachers/bulk", response_model=BulkCreateResponse, status_code=201)
async def bulk_create_teachers(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    required_cols = {"nombre_completo", "tipo_documento", "numero_documento", "correo"}

    created: List[CredentialItem] = []
    errors = []
    seen_docs: set = set()   # duplicados dentro del mismo batch
    seen_emails: set = set()

    for i, row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() for k, v in row.items()}
        missing = required_cols - set(row.keys())
        if missing:
            errors.append({"row": i, "error": f"Columnas faltantes: {missing}", "data": row})
            continue

        # Validaciones
        err = None
        if not row.get("nombre_completo"):
            err = "Nombre vacío"
        elif not row.get("numero_documento"):
            err = "Documento vacío"
        elif not _validate_email(row.get("correo", "")):
            err = "Correo inválido"
        elif row["numero_documento"] in seen_docs:
            err = "Documento duplicado en este archivo"
        elif row["correo"] in seen_emails:
            err = "Correo duplicado en este archivo"
        elif db.query(User).filter(User.document_number == row["numero_documento"]).first():
            err = "Documento duplicado en el sistema"
        elif db.query(User).filter(User.email == row["correo"]).first():
            err = "Correo duplicado en el sistema"

        if err:
            errors.append({"row": i, "error": err, "data": row})
            continue

        # Verificar límite
        limits = LICENSE_LIMITS.get(institution.license_type, LICENSE_LIMITS["basica"])
        t_count = db.query(User).filter(
            User.institution_id == institution.id,
            User.role == UserRole.PROFESOR.value,
        ).count()
        if t_count + len(created) >= limits["teachers"]:
            errors.append({"row": i, "error": "Límite de licencia alcanzado", "data": row})
            continue

        temp_pwd = _gen_temp_password()
        teacher = User(
            username=row["numero_documento"],
            email=row["correo"],
            full_name=row["nombre_completo"],
            hashed_password=get_password_hash(temp_pwd),
            role=UserRole.PROFESOR.value,
            document_type=row.get("tipo_documento", "CC"),
            document_number=row["numero_documento"],
            subject_area=row.get("area", ""),
            institution_id=institution.id,
            must_change_password=True,
        )
        db.add(teacher)
        db.flush()
        seen_docs.add(row["numero_documento"])
        seen_emails.add(row["correo"])
        _log(db, "bulk_create_teacher", current_user, institution.id,
             teacher.id, "profesor", _client_ip(request))
        created.append(CredentialItem(
            full_name=teacher.full_name,
            username=teacher.username,
            temp_password=temp_pwd,
            role=teacher.role,
        ))
        # Email se envía dentro del loop porque aquí tenemos row["correo"]
        send_credentials_email(
            to_email=row["correo"],
            to_name=teacher.full_name or teacher.username,
            username=teacher.username,
            temp_password=temp_pwd,
            role=teacher.role,
        )

    db.commit()
    return BulkCreateResponse(
        credentials=created, errors=errors,
        total_processed=len(created) + len(errors),
        total_created=len(created), total_errors=len(errors),
    )


# ─── Super Profesor: Estudiantes ──────────────────────────────────────────────

@router.get("/super/students")
async def list_students(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    students = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value,
    ).order_by(User.full_name).all()
    return [
        {
            "id": s.id,
            "full_name": s.full_name,
            "username": s.username,
            "email": s.email or "",
            "document_type": s.document_type or "",
            "document_number": s.document_number or "",
            "grade": s.grade or "",
            "birth_date": s.birth_date or "",
            "is_active": s.is_active,
        }
        for s in students
    ]


@router.post("/super/students", response_model=CredentialItem, status_code=201)
async def create_student(
    payload: StudentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    _check_license(db, institution, UserRole.ESTUDIANTE.value)

    if db.query(User).filter(User.document_number == payload.document_number).first():
        raise HTTPException(400, "Ya existe un usuario con ese número de documento")
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")

    temp_pwd = _gen_temp_password()
    student = User(
        username=payload.document_number,
        email=payload.email or f"{payload.document_number}@neurolearn.local",
        full_name=payload.full_name,
        hashed_password=get_password_hash(temp_pwd),
        role=UserRole.ESTUDIANTE.value,
        document_type=payload.document_type,
        document_number=payload.document_number,
        birth_date=payload.birth_date,
        grade=payload.grade,
        institution_id=institution.id,
        must_change_password=True,
    )
    db.add(student)
    db.flush()
    _log(db, "create_student", current_user, institution.id,
         student.id, "estudiante", _client_ip(request))
    db.commit()

    if payload.email:
        send_credentials_email(
            to_email=student.email,
            to_name=student.full_name or student.username,
            username=student.username,
            temp_password=temp_pwd,
            role=student.role,
        )

    return CredentialItem(
        full_name=student.full_name,
        username=student.username,
        temp_password=temp_pwd,
        role=student.role,
    )


@router.post("/super/students/bulk", response_model=BulkCreateResponse, status_code=201)
async def bulk_create_students(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)

    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    required_cols = {"nombre_completo", "tipo_documento", "numero_documento"}

    created: List[CredentialItem] = []
    errors = []
    seen_docs_s: set = set()

    for i, row in enumerate(reader, start=2):
        row = {k.strip().lower(): v.strip() for k, v in row.items()}
        missing = required_cols - set(row.keys())
        if missing:
            errors.append({"row": i, "error": f"Columnas faltantes: {missing}", "data": row})
            continue

        err = None
        if not row.get("nombre_completo"):
            err = "Nombre vacío"
        elif not row.get("numero_documento"):
            err = "Documento vacío"
        elif row["numero_documento"] in seen_docs_s:
            err = "Documento duplicado en este archivo"
        elif db.query(User).filter(User.document_number == row["numero_documento"]).first():
            err = "Documento duplicado"

        if err:
            errors.append({"row": i, "error": err, "data": row})
            continue

        limits = LICENSE_LIMITS.get(institution.license_type, LICENSE_LIMITS["basica"])
        s_count = db.query(User).filter(
            User.institution_id == institution.id,
            User.role == UserRole.ESTUDIANTE.value,
        ).count()
        if s_count + len(created) >= limits["students"]:
            errors.append({"row": i, "error": "Límite de licencia alcanzado", "data": row})
            continue

        email = row.get("correo") or f"{row['numero_documento']}@neurolearn.local"
        temp_pwd = _gen_temp_password()
        student = User(
            username=row["numero_documento"],
            email=email,
            full_name=row["nombre_completo"],
            hashed_password=get_password_hash(temp_pwd),
            role=UserRole.ESTUDIANTE.value,
            document_type=row.get("tipo_documento", "CC"),
            document_number=row["numero_documento"],
            birth_date=row.get("fecha_nacimiento"),
            grade=row.get("grado", ""),
            institution_id=institution.id,
            must_change_password=True,
        )
        db.add(student)
        db.flush()
        seen_docs_s.add(row["numero_documento"])
        _log(db, "bulk_create_student", current_user, institution.id,
             student.id, "estudiante", _client_ip(request))
        created.append(CredentialItem(
            full_name=student.full_name,
            username=student.username,
            temp_password=temp_pwd,
            role=student.role,
        ))
        # Solo enviar si tiene email real (no el @neurolearn.local generado)
        if row.get("correo"):
            send_credentials_email(
                to_email=row["correo"],
                to_name=student.full_name or student.username,
                username=student.username,
                temp_password=temp_pwd,
                role=student.role,
            )
    db.commit()
    return BulkCreateResponse(
        credentials=created, errors=errors,
        total_processed=len(created) + len(errors),
        total_created=len(created), total_errors=len(errors),
    )


# ─── Uso de licencia ──────────────────────────────────────────────────────────

@router.get("/super/license-usage", response_model=LicenseUsage)
async def get_license_usage(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value)
    institution = _get_my_institution(db, current_user)
    limits = LICENSE_LIMITS.get(institution.license_type, LICENSE_LIMITS["basica"])
    t_count = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.PROFESOR.value, User.is_active == True,
    ).count()
    s_count = db.query(User).filter(
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value, User.is_active == True,
    ).count()
    return LicenseUsage(
        license_type=institution.license_type,
        max_teachers=limits["teachers"],
        current_teachers=t_count,
        max_students=limits["students"],
        current_students=s_count,
    )


# ─── Cambio de contraseña ─────────────────────────────────────────────────────

@router.post("/auth/change-password", status_code=200)
async def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(400, "La contraseña actual es incorrecta")

    # Validar contraseña nueva
    pwd = payload.new_password
    if (len(pwd) < 8 or not re.search(r"[A-Z]", pwd) or
            not re.search(r"[a-z]", pwd) or not re.search(r"\d", pwd) or
            not re.search(r"[!@#$%^&*(),.?\":{}|<>]", pwd)):
        raise HTTPException(
            400,
            "La contraseña debe tener al menos 8 caracteres, "
            "una mayúscula, una minúscula, un número y un carácter especial",
        )

    current_user.hashed_password = get_password_hash(pwd)
    current_user.must_change_password = False
    db.commit()
    return {"message": "Contraseña actualizada correctamente"}
