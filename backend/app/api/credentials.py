"""
NeuroLearn AI — API de Credenciales y Gestión B2B
Endpoints:
  POST  /admin/institutions           → crea institución + super profesor
  GET   /admin/institutions           → lista instituciones (admin)
  POST  /super/teachers               → crea profesor individual
  POST  /super/teachers/bulk          → carga masiva CSV profesores
  POST  /super/students               → crea estudiante individual
  POST  /super/students/bulk          → carga masiva CSV estudiantes
  POST  /auth/change-password         → cambio de contraseña (primer login)
"""
import csv
import io
import secrets
import string
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.api.auth import get_current_user, get_password_hash, revoke_user_sessions
from app.models.user import User, UserRole
from app.models.institution import Institution, AuditLog
from app.models.classroom import Classroom, Enrollment
from app.core import validators as v
from app.schemas.schemas import (
    InstitutionCreate, InstitutionResponse,
    TeacherCreate, TeacherUpdate, TeacherListItem,
    StudentCreate, StudentUpdate, StudentListItem,
    BulkCreateResponse, CredentialItem, AdminStats,
)

from app.services.consent_service import _parse_birth_date
from app.services.consent_service import ADULT_AGE, age_on
from app.services.email_service import send_credentials_email
from app.services.capacity import (
    MAX_ACTIVE_INSTITUTIONS,
    MAX_STUDENTS_PLATFORM,
    MAX_STUDENTS_PER_INSTITUTION,
    active_institution_count,
    classroom_student_count,
    effective_classroom_limit,
    institution_capacity_snapshot,
    lock_capacity,
    require_classroom_slots,
    require_student_capacity,
    platform_student_count,
    require_existing_enrollment_capacity,
)

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


def _email_taken(db: Session, email: str, exclude_id: Optional[int] = None) -> bool:
    """¿Otro usuario usa ya ese correo? Sin distinguir mayúsculas (los
    correos antiguos pudieron guardarse con mayúsculas)."""
    q = db.query(User.id).filter(func.lower(User.email) == email.lower())
    if exclude_id is not None:
        q = q.filter(User.id != exclude_id)
    return q.first() is not None


def _document_taken(db: Session, number: str) -> bool:
    """El documento es también el usuario de acceso: no puede repetirse en
    ninguna de las dos columnas."""
    return db.query(User.id).filter(
        or_(User.document_number == number, User.username == number)
    ).first() is not None


def _normalize_csv_row(raw_row: Optional[dict]) -> dict:
    if not raw_row:
        return {}

    normalized = {}
    for key, value in raw_row.items():
        if key is None:
            continue
        normalized[str(key).strip().lower()] = "" if value is None else str(value).strip()
    return normalized


DOCUMENT_TYPES = tuple(v.DOCUMENT_RULES)
# Límites del archivo de carga masiva: un CSV de texto de hasta 1 MB y 2.000
# filas cubre de sobra una institución y evita lotes que agoten el servidor.
CSV_MAX_BYTES = 1024 * 1024
CSV_MAX_ROWS = 2000
TEACHER_CSV_COLUMNS = ("nombre_completo", "tipo_documento", "numero_documento", "correo", "area")
STUDENT_CSV_COLUMNS = (
    "nombre_completo", "tipo_documento", "numero_documento", "correo", "grado",
    "fecha_nacimiento", "nombre_acudiente",
)


def _guardian_authorization_required(birth_date) -> bool:
    birth = _parse_birth_date(birth_date)
    return birth is None or age_on(birth) < ADULT_AGE


async def _read_csv_upload(file: UploadFile) -> bytes:
    """Lee el archivo de carga masiva y comprueba que sea un CSV de texto."""
    name = (file.filename or "").lower()
    if name and not name.endswith((".csv", ".txt")):
        raise HTTPException(400, "El archivo debe ser .csv (en Excel: Guardar como → CSV).")
    content = await file.read(CSV_MAX_BYTES + 1)
    if len(content) > CSV_MAX_BYTES:
        raise HTTPException(413, "El archivo CSV supera el máximo de 1 MB.")
    if not content.strip():
        raise HTTPException(400, "El archivo CSV está vacío")
    if content.startswith(b"PK") or b"\x00" in content[:4096]:
        # .xlsx (ZIP) o binario renombrado como .csv
        raise HTTPException(400, "El archivo no es un CSV de texto. En Excel usa Guardar como → CSV.")
    return content


def _csv_rows(reader: csv.DictReader):
    """Filas del CSV numeradas como en la hoja de cálculo (la 1 es el encabezado)."""
    try:
        for i, raw_row in enumerate(reader, 2):
            if i - 1 > CSV_MAX_ROWS:
                raise HTTPException(
                    400,
                    f"El archivo supera el máximo de {CSV_MAX_ROWS} filas. Divídelo en varios lotes.",
                )
            if raw_row is None:
                continue
            first_cell = str(raw_row.get(reader.fieldnames[0]) or "").strip()
            if first_cell.startswith("#"):
                continue
            if not any(str(value or "").strip() for value in raw_row.values()):
                continue
            yield i, raw_row
    except csv.Error as exc:
        raise HTTPException(400, f"El CSV contiene una fila mal formada: {exc}") from exc


def _csv_reader(content: bytes, required: set, expected: tuple) -> csv.DictReader:
    """Lector del CSV de carga masiva tolerante a cómo lo guardan las hojas de
    cálculo: UTF-8 (con o sin BOM) o ANSI/Windows-1252 (Excel «CSV delimitado
    por comas»), separador coma, punto y coma (Excel en español) o tabulador,
    y la línea «sep=,» que Excel admite. Antes solo se aceptaba UTF-8 con coma:
    un archivo guardado desde Excel en español fallaba entero o con un 500."""
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("cp1252", errors="replace")
    lines = text.splitlines()
    while lines and not lines[0].strip():
        lines.pop(0)
    delimiter = ","
    if lines and lines[0].strip().lower().startswith("sep=") and len(lines[0].strip()) == 5:
        delimiter = lines.pop(0).strip()[4]
    elif lines:
        delimiter = max((",", ";", "\t"), key=lines[0].count)
    reader = csv.DictReader(io.StringIO("\n".join(lines)), delimiter=delimiter, strict=True)
    try:
        fieldnames = reader.fieldnames
    except csv.Error as exc:
        raise HTTPException(400, f"El encabezado CSV está mal formado: {exc}") from exc
    if not fieldnames:
        raise HTTPException(400, "El archivo CSV no tiene cabeceras válidas")
    headers = [str(field or "").strip().lower() for field in fieldnames]
    duplicates = set()
    found = set()
    for header in headers:
        if header in found:
            duplicates.add(header)
        found.add(header)
    expected_set = set(expected)
    missing = [column for column in expected if column in required and column not in found]
    extra = [column or "(vacía)" for column in headers if column not in expected_set]
    if duplicates or missing or extra:
        header_errors = [
            {"row": 1, "column": column or "encabezados", "error": "Encabezado duplicado"}
            for column in sorted(duplicates)
        ]
        header_errors.extend(
            {"row": 1, "column": column, "error": "Falta esta columna obligatoria"}
            for column in missing
        )
        header_errors.extend(
            {"row": 1, "column": column, "error": "Columna no reconocida"}
            for column in extra
        )
        raise HTTPException(
            400,
            detail={
                "message": f"Los encabezados deben corresponder a la plantilla: {', '.join(expected)}.",
                "errors": header_errors,
            },
        )
    reader.fieldnames = headers
    return reader


def _csv_row_structure_error(raw_row: dict) -> Optional[tuple[str, str]]:
    extra_values = raw_row.get(None)
    if extra_values and any(str(value or "").strip() for value in extra_values):
        return "columnas_adicionales", "La fila contiene datos después de la última columna de la plantilla"
    for column, value in raw_row.items():
        if column is not None and value is None:
            return column, "Falta una celda; completa la fila respetando todas las columnas de la plantilla"
    return None


def _common_row_error(row: dict) -> Optional[tuple[str, str]]:
    """Reglas de la fila que comparten profesores y estudiantes (las mismas
    del formulario individual, app/core/validators.py). Deja la fila
    normalizada."""
    if not row.get("nombre_completo"):
        return "nombre_completo", "Nombre vacío"
    if not row.get("numero_documento"):
        return "numero_documento", "Documento vacío"
    doc_type = (row.get("tipo_documento") or "").upper()
    if doc_type not in DOCUMENT_TYPES:
        return "tipo_documento", f"Tipo de documento inválido «{row.get('tipo_documento') or ''}» (usa CC, TI, CE o PA)"
    row["tipo_documento"] = doc_type
    try:
        row["nombre_completo"] = v.person_name(row["nombre_completo"], label="nombre_completo")
    except ValueError as exc:
        return "nombre_completo", str(exc)
    try:
        row["numero_documento"] = v.document_number(row["numero_documento"], doc_type)
    except ValueError as exc:
        return "numero_documento", str(exc)
    return None


def _bad_email(value: Optional[str]) -> str:
    shown = (value or "").strip()
    shown = shown if len(shown) <= 60 else shown[:57] + "…"
    if not shown:
        return "Correo vacío (es obligatorio para profesores y estudiantes)"
    return f"Correo inválido «{shown}» (usa el formato nombre@colegio.edu.co)"


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


def _guardian_fields(student: User) -> dict:
    from app.services.consent_service import guardian_status
    st = guardian_status(student)
    return {
        "guardian_required": st["required"],
        "guardian_authorized": st["authorized"],
        "guardian_name": student.guardian_name,
        "guardian_consent_date": student.guardian_consent_date,
        "guardian_authorization_reference": student.guardian_authorization_reference,
    }


def _client_ip(request: Request) -> str:
    return (request.headers.get("X-Forwarded-For") or
            getattr(request.client, "host", "unknown"))


# ─── Admin: Instituciones ─────────────────────────────────────────────────────

@router.post("/admin/institutions", response_model=InstitutionResponse, status_code=201)
def create_institution(
    payload: InstitutionCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.ADMIN.value)

    lock_capacity(db, "platform")
    if active_institution_count(db) >= MAX_ACTIVE_INSTITUTIONS:
        raise HTTPException(
            status_code=409,
            detail=f"La plataforma admite como máximo {MAX_ACTIVE_INSTITUTIONS} instituciones activas.",
        )

    # Validar unicidad
    if db.query(Institution).filter(Institution.dane_code == payload.dane_code).first():
        raise HTTPException(400, "Ya existe una institución con ese Código DANE")
    if _document_taken(db, payload.sp_document_number):
        raise HTTPException(400, "Ya existe un usuario con ese número de documento")
    if _email_taken(db, payload.sp_email):
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")

    # Crear institución
    institution = Institution(
        name=payload.name,
        dane_code=payload.dane_code,
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
        "is_active": institution.is_active,
        "created_at": institution.created_at,
        "credential": CredentialItem(
            full_name=sp.full_name,
            username=sp.username,
            temp_password=temp_pwd,
            role=sp.role,
        ),
    }


@router.get("/admin/capacity")
def get_platform_capacity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.ADMIN.value)
    used = active_institution_count(db)
    students = platform_student_count(db)
    return {
        "institutions_used": used,
        "institutions_limit": MAX_ACTIVE_INSTITUTIONS,
        "institutions_available": max(0, MAX_ACTIVE_INSTITUTIONS - used),
        "students_used": students,
        "students_limit": MAX_STUDENTS_PLATFORM,
        "students_available": max(0, MAX_STUDENTS_PLATFORM - students),
    }


@router.get("/institution/capacity")
def get_institution_capacity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.SUPER_PROFESOR.value, UserRole.PROFESOR.value):
        raise HTTPException(status_code=403, detail="Acceso restringido a usuarios de una institución.")
    if not current_user.institution_id:
        raise HTTPException(status_code=400, detail="Tu cuenta no tiene una institución asignada.")
    return institution_capacity_snapshot(db, current_user.institution_id)

@router.get("/admin/stats", response_model=AdminStats)
def get_admin_stats(
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


# NOTE: La ruta GET /admin/institutions (listado de instituciones con paginación
# y estados) se define de forma canónica en
# app/api/admin_users.py (admin_list_institutions). ESTE módulo NO la redefine:
# definirla aquí duplicaba el path y, al montar credentials antes que admin_users
# en main.py, la versión simple de este archivo sombreaba la rica de admin_users,
# rompiendo páginas que esperan el contrato {total, page, page_size, institutions}
# (p.ej. InstitutionList.tsx). La creación (POST /admin/institutions) sí vive
# aquí porque es parte del flujo B2B de registro de institución + super profesor.


# ─── Super Profesor: Profesores ───────────────────────────────────────────────

def _get_my_institution(db: Session, user: User) -> Institution:
    if not user.institution_id:
        raise HTTPException(400, "No tienes una institución asignada")
    inst = db.query(Institution).filter(Institution.id == user.institution_id).first()
    if not inst:
        raise HTTPException(404, "Institución no encontrada")
    return inst


@router.get("/super/teachers", response_model=List[TeacherListItem])
def list_teachers(
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


@router.delete("/super/teachers/{user_id}")
def delete_teacher(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    teacher = db.query(User).filter(
        User.id == user_id,
        User.institution_id == institution.id,
        User.role == UserRole.PROFESOR.value,
    ).first()
    if not teacher:
        raise HTTPException(404, "Profesor no encontrado en tu institución")
    if teacher.id == current_user.id:
        raise HTTPException(400, "No puedes eliminar tu propia cuenta de profesor")

    # Soft-delete: desactiva la cuenta en lugar de eliminarla.
    # Preserva el historial académico y evita IntegrityError por FKs en PostgreSQL.
    teacher.is_active = False
    _log(db, "deactivate_teacher", current_user, institution.id,
         teacher.id, "profesor", _client_ip(request), notes="Cuenta desactivada")
    db.commit()
    return {"ok": True, "message": "Profesor desactivado correctamente"}


@router.post("/super/teachers/bulk-delete")
def bulk_delete_teachers(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    ids = v.or_400(v.parse_int_list, payload.get("ids") if isinstance(payload, dict) else None)

    teachers = db.query(User).filter(
        User.id.in_(ids),
        User.institution_id == institution.id,
        User.role == UserRole.PROFESOR.value,
    ).all()

    deleted = 0
    for teacher in teachers:
        if teacher.id == current_user.id:
            continue
        teacher.is_active = False
        _log(db, "deactivate_teacher", current_user, institution.id,
             teacher.id, "profesor", _client_ip(request), notes="Desactivación masiva")
        deleted += 1

    db.commit()
    return {"ok": True, "deleted": deleted, "message": "Profesores desactivados correctamente"}


@router.post("/super/teachers", response_model=CredentialItem, status_code=201)
def create_teacher(
    payload: TeacherCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)

    if _document_taken(db, payload.document_number):
        raise HTTPException(400, "Ya existe un usuario con ese número de documento")
    if _email_taken(db, payload.email):
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")

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


def _regenerate_user_credentials(
    user: User,
    current_user: User,
    institution: Institution,
    request: Request,
    db: Session,
) -> CredentialItem:
    if not user.is_active:
        raise HTTPException(400, "Activa la cuenta antes de generar credenciales nuevas.")
    if user.id == current_user.id:
        raise HTTPException(400, "No puedes restablecer las credenciales de tu propia cuenta desde este panel.")

    temp_pwd = _gen_temp_password()
    user.hashed_password = get_password_hash(temp_pwd)
    user.must_change_password = True
    revoke_user_sessions(user)
    _log(
        db,
        "regenerate_credentials",
        current_user,
        institution.id,
        user.id,
        user.role,
        _client_ip(request),
        notes="Credenciales temporales regeneradas; sesiones anteriores revocadas",
    )
    db.commit()
    email_sent = send_credentials_email(
        to_email=user.email or "",
        to_name=user.full_name or user.username,
        username=user.username,
        temp_password=temp_pwd,
        role=user.role,
    )
    return CredentialItem(
        full_name=user.full_name or "",
        username=user.username,
        temp_password=temp_pwd,
        role=user.role,
        email_sent=email_sent,
    )


@router.post("/super/teachers/{user_id}/credentials/regenerate", response_model=CredentialItem)
def regenerate_teacher_credentials(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    teacher = db.query(User).filter(
        User.id == user_id,
        User.institution_id == institution.id,
        User.role == UserRole.PROFESOR.value,
    ).first()
    if not teacher:
        raise HTTPException(404, "Profesor no encontrado en tu institución")
    return _regenerate_user_credentials(teacher, current_user, institution, request, db)


@router.put("/super/teachers/{user_id}", response_model=TeacherListItem)
def update_teacher(
    user_id: int,
    payload: TeacherUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edita un docente de la institución (solo campos enviados). No cambia documento."""
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    teacher = db.query(User).filter(
        User.id == user_id,
        User.institution_id == institution.id,
        User.role == UserRole.PROFESOR.value,
    ).first()
    if not teacher:
        raise HTTPException(404, "Profesor no encontrado en tu institución")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No hay campos para actualizar")

    new_email = updates.get("email")
    if new_email is not None and _email_taken(db, new_email, exclude_id=user_id):
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")
    if updates.get("full_name"):
        teacher.full_name = updates["full_name"]
    if "document_type" in updates and updates["document_type"]:
        teacher.document_type = updates["document_type"]
    if "subject_area" in updates:
        teacher.subject_area = updates["subject_area"]
    if updates.get("email"):
        teacher.email = updates["email"]
    if "is_active" in updates:
        teacher.is_active = updates["is_active"]

    _log(db, "update_teacher", current_user, institution.id,
         teacher.id, "profesor", _client_ip(request), notes="Edición de docente")
    db.commit()
    db.refresh(teacher)
    return TeacherListItem(
        id=teacher.id,
        full_name=teacher.full_name,
        username=teacher.username,
        email=teacher.email or "",
        document_type=teacher.document_type or "",
        document_number=teacher.document_number or "",
        subject_area=teacher.subject_area or "",
        is_active=teacher.is_active,
    )


def _teacher_row_error(
    db: Session, row: dict, seen_docs: set, seen_emails: set
) -> Optional[tuple[str, str]]:
    """Validación de una fila del CSV de profesores (vista previa y creación)."""
    err = _common_row_error(row)
    if err:
        return err
    try:
        row["correo"] = v.email(row.get("correo"), label="correo")
    except ValueError:
        return "correo", _bad_email(row.get("correo"))
    try:
        row["area"] = v.clean_text(row.get("area"), label="area", max_len=100, required=False) or ""
    except ValueError as exc:
        return "area", str(exc)
    if row["numero_documento"] in seen_docs:
        return "numero_documento", "Documento duplicado en este archivo"
    if row["correo"] in seen_emails:
        return "correo", "Correo duplicado en este archivo"
    if _document_taken(db, row["numero_documento"]):
        return "numero_documento", "Documento duplicado en el sistema"
    if _email_taken(db, row["correo"]):
        return "correo", "Correo duplicado en el sistema"
    return None


@router.post("/super/teachers/bulk", response_model=BulkCreateResponse, status_code=201)
async def bulk_create_teachers(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)

    content = await _read_csv_upload(file)

    required_cols = {"nombre_completo", "tipo_documento", "numero_documento", "correo"}
    reader = _csv_reader(content, required_cols, TEACHER_CSV_COLUMNS)

    errors = []
    seen_docs: set = set()   # duplicados dentro del mismo batch
    seen_emails: set = set()
    rows_to_create = []

    for i, raw_row in _csv_rows(reader):
        structure_error = _csv_row_structure_error(raw_row)
        if structure_error:
            column, error = structure_error
            errors.append({"row": i, "column": column, "error": error})
            continue
        row = _normalize_csv_row(raw_row)
        err = _teacher_row_error(db, row, seen_docs, seen_emails)
        if err:
            column, error = err
            errors.append({"row": i, "column": column, "error": error})
            if row.get("numero_documento"):
                seen_docs.add(row["numero_documento"])
            if row.get("correo"):
                seen_emails.add(row["correo"].strip().lower())
            continue
        seen_docs.add(row["numero_documento"])
        seen_emails.add(row["correo"])
        rows_to_create.append(row)

    if errors:
        raise HTTPException(
            422,
            detail={
                "message": "No se creó ningún usuario. Corrige todos los errores del archivo y vuelve a revisarlo.",
                "errors": errors,
            },
        )
    if not rows_to_create:
        raise HTTPException(400, "El archivo no contiene registros para importar.")

    created: List[CredentialItem] = []
    pending_emails: list = []

    for row in rows_to_create:
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
        _log(db, "bulk_create_teacher", current_user, institution.id,
             teacher.id, "profesor", _client_ip(request))
        created.append(CredentialItem(
            full_name=teacher.full_name,
            username=teacher.username,
            temp_password=temp_pwd,
            role=teacher.role,
        ))
        pending_emails.append((row["correo"], teacher.full_name or teacher.username,
                               teacher.username, temp_pwd, teacher.role))

    db.commit()
    # Los correos salen solo cuando las cuentas ya quedaron guardadas.
    _send_pending_credentials(pending_emails)
    return BulkCreateResponse(
        credentials=created, errors=[],
        total_processed=len(created),
        total_created=len(created), total_errors=0,
    )


@router.post("/super/teachers/preview")
async def preview_bulk_create_teachers(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PRE-CARGA masiva de profesores: valida el CSV y devuelve un resumen de
    registros válidos e inválidos SIN crear ningún usuario.

    Uso (flujo en dos pasos):
      1) POST /super/teachers/preview  → valida y muestra el resumen
      2) POST /super/teachers/bulk     → solo si el usuario confirma

    Retorna el mismo contrato que /bulk en cuanto a validación, pero
    `created=[]` en la preview (nada se persiste todavía). Cada error incluye
    la fila exacta del CSV para que la UI pueda mostrarlos antes de confirmar.
    """
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)

    content = await _read_csv_upload(file)

    required_cols = {"nombre_completo", "tipo_documento", "numero_documento", "correo"}
    reader = _csv_reader(content, required_cols, TEACHER_CSV_COLUMNS)

    errors = []
    valid_count = 0
    # Igual que en la creación: lo que la vista previa da por válido es
    # exactamente lo que se crea (antes no detectaba duplicados en el archivo).
    seen_docs: set = set()
    seen_emails: set = set()

    for i, raw_row in _csv_rows(reader):
        structure_error = _csv_row_structure_error(raw_row)
        if structure_error:
            column, error = structure_error
            errors.append({"row": i, "column": column, "error": error})
            continue
        row = _normalize_csv_row(raw_row)
        err = _teacher_row_error(db, row, seen_docs, seen_emails)
        if err:
            column, error = err
            errors.append({"row": i, "column": column, "error": error})
            if row.get("numero_documento"):
                seen_docs.add(row["numero_documento"])
            if row.get("correo"):
                seen_emails.add(row["correo"].strip().lower())
        else:
            valid_count += 1
            seen_docs.add(row["numero_documento"])
            seen_emails.add(row["correo"].lower())

    return {
        "preview": True,
        "total_valid": valid_count,
        "total_errors": len(errors),
        "errors": errors,
        "message": (
            f"{valid_count} profesor(es) válidos y {len(errors)} fila(s) con errores. "
            "Corrige todos los errores; el lote completo se rechazará mientras exista alguno."
            if errors else
            f"{valid_count} profesor(es) listos para crear." if valid_count > 0 else
            "El archivo no contiene registros. Agrega al menos una fila antes de continuar."
        ),
    }


# ─── Super Profesor: Estudiantes ──────────────────────────────────────────────

def _send_pending_credentials(pending: list) -> None:
    for to_email, to_name, username, temp_pwd, role in pending:
        send_credentials_email(to_email=to_email, to_name=to_name, username=username,
                               temp_password=temp_pwd, role=role)


def _student_row_error(
    db: Session, row: dict, seen_docs: set, seen_emails: set
) -> Optional[tuple[str, str]]:
    """Validación de una fila del CSV de estudiantes. La usan la vista previa y
    la creación, para que una fila «válida» en la vista previa no falle al crear."""
    err = _common_row_error(row)
    if err:
        return err
    doc = row["numero_documento"]
    if row.get("fecha_nacimiento") and _parse_birth_date(row["fecha_nacimiento"]) is None:
        return "fecha_nacimiento", f"fecha_nacimiento inválida «{row['fecha_nacimiento']}» (usa AAAA-MM-DD, p. ej. 2009-05-14)"
    try:
        row["correo"] = v.email(row.get("correo"), label="correo")
    except ValueError:
        return "correo", _bad_email(row.get("correo"))
    try:
        # Se guarda en un único formato (Excel la reescribe como 14/05/2009).
        row["fecha_nacimiento"] = v.birth_date(row.get("fecha_nacimiento"))
        row["grado"] = v.grade(row.get("grado")) or ""
    except ValueError as exc:
        column = "fecha_nacimiento" if "fecha de nacimiento" in str(exc).lower() else "grado"
        return column, f"{column}: {exc}"
    guardian_name = (row.get("nombre_acudiente") or "").strip()
    if guardian_name:
        try:
            row["nombre_acudiente"] = v.person_name(
                guardian_name, label="nombre_acudiente", max_len=150
            )
        except ValueError as exc:
            return "nombre_acudiente", str(exc)
    elif _guardian_authorization_required(row["fecha_nacimiento"]):
        return "nombre_acudiente", "Para menores o fecha de nacimiento no informada se requiere el nombre del acudiente"
    if not _guardian_authorization_required(row["fecha_nacimiento"]):
        row["nombre_acudiente"] = None
    email = row["correo"]
    if doc in seen_docs:
        return "numero_documento", "Documento duplicado en este archivo"
    if email in seen_emails:
        return "correo", "Correo duplicado en este archivo"
    if _document_taken(db, doc):
        return "numero_documento", "Documento duplicado en el sistema"
    if _email_taken(db, email):
        return "correo", "Correo duplicado en el sistema"
    return None


def _institution_classroom_for_enrollment(db: Session, institution: Institution, classroom_id: Optional[int]):
    """Grupo activo de la institución donde se inscribe un lote (None = sin grupo)."""
    if classroom_id is None:
        return None
    classroom = (
        db.query(Classroom)
        .join(User, User.id == Classroom.teacher_id)
        .filter(Classroom.id == classroom_id, User.institution_id == institution.id)
        .first()
    )
    if classroom is None:
        raise HTTPException(404, "Grupo no encontrado en tu institución")
    if not classroom.is_active:
        raise HTTPException(400, "El grupo está desactivado")
    return classroom

@router.get("/super/students")
def list_students(
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
            **_guardian_fields(s),
        }
        for s in students
    ]


@router.delete("/super/students/{user_id}")
def delete_student(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    student = db.query(User).filter(
        User.id == user_id,
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value,
    ).first()
    if not student:
        raise HTTPException(404, "Estudiante no encontrado en tu institución")
    if student.id == current_user.id:
        raise HTTPException(400, "No puedes eliminar tu propia cuenta de estudiante")

    # Soft-delete: desactiva la cuenta en lugar de eliminarla.
    # Preserva el historial académico y evita IntegrityError por FKs en PostgreSQL.
    student.is_active = False
    _log(db, "deactivate_student", current_user, institution.id,
         student.id, "estudiante", _client_ip(request), notes="Cuenta desactivada")
    db.commit()
    return {"ok": True, "message": "Estudiante desactivado correctamente"}


@router.post("/super/students/bulk-delete")
def bulk_delete_students(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    ids = v.or_400(v.parse_int_list, payload.get("ids") if isinstance(payload, dict) else None)

    students = db.query(User).filter(
        User.id.in_(ids),
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value,
    ).all()

    deleted = 0
    for student in students:
        if student.id == current_user.id:
            continue
        student.is_active = False
        _log(db, "deactivate_student", current_user, institution.id,
             student.id, "estudiante", _client_ip(request), notes="Desactivación masiva")
        deleted += 1

    db.commit()
    return {"ok": True, "deleted": deleted, "message": "Estudiantes desactivados correctamente"}


@router.post("/super/students", response_model=CredentialItem, status_code=201)
def create_student(
    payload: StudentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)

    lock_capacity(db, "institution", institution.id)
    require_student_capacity(db, institution.id)

    if _document_taken(db, payload.document_number):
        raise HTTPException(400, "Ya existe un usuario con ese número de documento")
    if _email_taken(db, payload.email):
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")
    if not payload.guardian_authorization_confirmed:
        raise HTTPException(
            400,
            "Confirma que la autorización del acudiente está verificada o que no aplica por mayoría de edad.",
        )
    guardian_required = _guardian_authorization_required(payload.birth_date)
    if guardian_required:
        if not payload.guardian_name:
            raise HTTPException(
                400,
                "Para menores o fecha de nacimiento no informada se requiere el nombre del acudiente.",
            )

    temp_pwd = _gen_temp_password()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    student = User(
        username=payload.document_number,
        email=payload.email,
        full_name=payload.full_name,
        hashed_password=get_password_hash(temp_pwd),
        role=UserRole.ESTUDIANTE.value,
        document_type=payload.document_type,
        document_number=payload.document_number,
        birth_date=payload.birth_date,
        grade=payload.grade,
        institution_id=institution.id,
        must_change_password=True,
        guardian_name=payload.guardian_name if guardian_required else None,
        guardian_authorized_at=now if guardian_required else None,
        guardian_authorized_by_id=current_user.id if guardian_required else None,
        guardian_confirmation_recorded_at=now,
        guardian_confirmation_by_id=current_user.id,
    )
    db.add(student)
    db.flush()
    _log(db, "create_student", current_user, institution.id,
         student.id, "estudiante", _client_ip(request))
    db.commit()

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


@router.post("/super/students/{user_id}/credentials/regenerate", response_model=CredentialItem)
def regenerate_student_credentials(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    student = db.query(User).filter(
        User.id == user_id,
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value,
    ).first()
    if not student:
        raise HTTPException(404, "Estudiante no encontrado en tu institución")
    return _regenerate_user_credentials(student, current_user, institution, request, db)


@router.put("/super/students/{user_id}", response_model=StudentListItem)
def update_student(
    user_id: int,
    payload: StudentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Edita un estudiante de la institución (solo campos enviados). No cambia documento."""
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    student = db.query(User).filter(
        User.id == user_id,
        User.institution_id == institution.id,
        User.role == UserRole.ESTUDIANTE.value,
    ).first()
    if not student:
        raise HTTPException(404, "Estudiante no encontrado en tu institución")
    if student.id == current_user.id:
        raise HTTPException(400, "No puedes editar tu propia cuenta de estudiante")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(400, "No hay campos para actualizar")

    new_email = updates.get("email")
    if new_email is not None and _email_taken(db, new_email, exclude_id=user_id):
        raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")
    if updates.get("full_name"):
        student.full_name = updates["full_name"]
    if "document_type" in updates and updates["document_type"]:
        student.document_type = updates["document_type"]
    if "grade" in updates:
        student.grade = updates["grade"]
    if "birth_date" in updates:
        student.birth_date = updates["birth_date"]
    if updates.get("email"):
        student.email = updates["email"]
    if "is_active" in updates:
        if updates["is_active"] and not student.is_active:
            lock_capacity(db, "institution", institution.id)
            require_student_capacity(db, institution.id)
            require_existing_enrollment_capacity(db, student.id)
        student.is_active = updates["is_active"]
    guardian_note = ""
    if "guardian_name" in updates:
        student.guardian_name = updates["guardian_name"] or None
    if "guardian_consent_date" in updates:
        student.guardian_consent_date = updates["guardian_consent_date"] or None
    if "guardian_authorization_reference" in updates:
        student.guardian_authorization_reference = updates["guardian_authorization_reference"] or None
    if any(key in updates for key in (
        "guardian_authorized", "guardian_name", "guardian_consent_date",
        "guardian_authorization_reference",
    )) and updates.get("guardian_authorized", student.guardian_authorized_at is not None):
        consent_date = _parse_birth_date(student.guardian_consent_date)
        if not student.guardian_name:
            raise HTTPException(
                400,
                "Para registrar la autorización se requiere el nombre del acudiente.",
            )
        if consent_date and consent_date > datetime.now().date():
            raise HTTPException(400, "La fecha de autorización del acudiente no puede estar en el futuro.")
    if "guardian_authorized" in updates:
        if updates["guardian_authorized"]:
            if not student.guardian_name:
                raise HTTPException(
                    400,
                    "Registra el nombre del acudiente antes de marcar la autorización como recibida.",
                )
            consent_date = _parse_birth_date(student.guardian_consent_date)
            if consent_date and consent_date > datetime.now().date():
                raise HTTPException(400, "La fecha de autorización del acudiente no puede estar en el futuro.")
            student.guardian_authorized_at = datetime.now(timezone.utc).replace(tzinfo=None)
            student.guardian_authorized_by_id = current_user.id
            guardian_note = f" · autorización del acudiente registrada ({student.guardian_name})"
        else:
            student.guardian_authorized_at = None
            student.guardian_authorized_by_id = None
            student.guardian_consent_date = None
            student.guardian_authorization_reference = None
            guardian_note = " · autorización del acudiente retirada"

    _log(db, "update_student", current_user, institution.id,
         student.id, "estudiante", _client_ip(request), notes="Edición de estudiante" + guardian_note)
    db.commit()
    db.refresh(student)
    return StudentListItem(
        id=student.id,
        full_name=student.full_name,
        username=student.username,
        email=student.email or "",
        document_type=student.document_type or "",
        document_number=student.document_number or "",
        grade=student.grade or "",
        birth_date=student.birth_date or "",
        is_active=student.is_active,
        **_guardian_fields(student),
    )


@router.post("/super/students/bulk", response_model=BulkCreateResponse, status_code=201)
async def bulk_create_students(
    request: Request,
    file: UploadFile = File(...),
    # Grupo opcional donde quedan inscritos los estudiantes creados (antes el
    # formulario enviaba un «profesor» que el backend ignoraba).
    classroom_id: Optional[int] = Form(None),
    authorization_confirmed: bool = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    if not authorization_confirmed:
        raise HTTPException(
            400,
            "Confirma que cada autorización aplicable está respaldada y verificada antes de crear el lote.",
        )
    institution = _get_my_institution(db, current_user)
    lock_capacity(db, "institution", institution.id)
    lock_capacity(db, "platform")
    classroom = _institution_classroom_for_enrollment(db, institution, classroom_id)
    free_seats = None
    if classroom is not None:
        used = classroom_student_count(db, classroom.id)
        free_seats = max(effective_classroom_limit(classroom) - used, 0)
    content = await _read_csv_upload(file)

    required_cols = {"nombre_completo", "tipo_documento", "numero_documento", "correo"}
    reader = _csv_reader(content, required_cols, STUDENT_CSV_COLUMNS)

    errors = []
    seen_docs_s: set = set()
    seen_emails_s: set = set()
    rows_to_create = []
    for i, raw_row in _csv_rows(reader):
        structure_error = _csv_row_structure_error(raw_row)
        if structure_error:
            column, error = structure_error
            errors.append({"row": i, "column": column, "error": error})
            continue
        row = _normalize_csv_row(raw_row)
        err = _student_row_error(db, row, seen_docs_s, seen_emails_s)
        if err:
            column, error = err
            errors.append({"row": i, "column": column, "error": error})
            if row.get("numero_documento"):
                seen_docs_s.add(row["numero_documento"])
            if row.get("correo"):
                seen_emails_s.add(row["correo"].strip().lower())
            continue
        seen_docs_s.add(row["numero_documento"])
        seen_emails_s.add(row["correo"].lower())
        rows_to_create.append((i, row))

    if errors:
        raise HTTPException(
            422,
            detail={
                "message": "No se creó ningún usuario. Corrige todos los errores del archivo y vuelve a revisarlo.",
                "errors": errors,
            },
        )
    if not rows_to_create:
        raise HTTPException(400, "El archivo no contiene registros para importar.")

    institution_available_students = max(
        0,
        MAX_STUDENTS_PER_INSTITUTION - int(
            db.query(User.id).filter(
                User.institution_id == institution.id,
                User.role == UserRole.ESTUDIANTE.value,
                User.is_active.is_(True),
            ).count()
        ),
    )
    available_platform_students = max(0, MAX_STUDENTS_PLATFORM - platform_student_count(db))
    if len(rows_to_create) > institution_available_students:
        raise HTTPException(
            status_code=409,
            detail=(
                f"El archivo contiene {len(rows_to_create)} estudiantes válidos, pero la "
                f"institución solo dispone de {institution_available_students} cupos de "
                f"{MAX_STUDENTS_PER_INSTITUTION}. No se creó ningún registro."
            ),
        )
    if len(rows_to_create) > available_platform_students:
        raise HTTPException(
            status_code=409,
            detail=(
                f"El archivo contiene {len(rows_to_create)} estudiantes válidos, pero la "
                f"plataforma solo dispone de {available_platform_students} cupos de "
                f"{MAX_STUDENTS_PLATFORM}. No se creó ningún registro."
            ),
        )
    if free_seats is not None and len(rows_to_create) > free_seats:
        raise HTTPException(
            status_code=409,
            detail=(
                f"El archivo contiene {len(rows_to_create)} estudiantes válidos, pero el grupo "
                f"«{classroom.name}» solo dispone de {free_seats} cupos. No se creó ningún registro."
            ),
        )

    created: List[CredentialItem] = []
    pending_emails: list = []
    enrolled = 0

    for _i, row in rows_to_create:
        email = row["correo"]
        temp_pwd = _gen_temp_password()
        guardian_required = _guardian_authorization_required(row.get("fecha_nacimiento"))
        now = datetime.now(timezone.utc).replace(tzinfo=None)
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
            guardian_name=row.get("nombre_acudiente") if guardian_required else None,
            guardian_authorized_at=now if guardian_required else None,
            guardian_authorized_by_id=current_user.id if guardian_required else None,
            guardian_confirmation_recorded_at=now,
            guardian_confirmation_by_id=current_user.id,
        )
        db.add(student)
        db.flush()
        notes = ""
        if classroom is not None:
            db.add(Enrollment(student_id=student.id, classroom_id=classroom.id))
            enrolled += 1
            notes = f"Inscrito en «{classroom.name}»"
        _log(db, "bulk_create_student", current_user, institution.id,
             student.id, "estudiante", _client_ip(request), notes=notes)
        created.append(CredentialItem(
            full_name=student.full_name,
            username=student.username,
            temp_password=temp_pwd,
            role=student.role,
        ))
        pending_emails.append((row["correo"], student.full_name or student.username,
                               student.username, temp_pwd, student.role))
    db.commit()
    # Los correos salen solo cuando las cuentas ya quedaron guardadas.
    _send_pending_credentials(pending_emails)
    return BulkCreateResponse(
        credentials=created, errors=[],
        total_processed=len(created),
        total_created=len(created), total_errors=0,
        enrolled=enrolled,
        classroom=classroom.name if classroom is not None else None,
    )


@router.post("/super/students/preview")
async def preview_bulk_create_students(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PRE-CARGA masiva de estudiantes: valida el CSV y devuelve un resumen de
    registros válidos e inválidos SIN crear ningún usuario.

    Uso (flujo en dos pasos):
      1) POST /super/students/preview → valida y muestra el resumen
      2) POST /super/students/bulk    → solo si el usuario confirma
    """
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    content = await _read_csv_upload(file)

    required_cols = {"nombre_completo", "tipo_documento", "numero_documento", "correo"}
    reader = _csv_reader(content, required_cols, STUDENT_CSV_COLUMNS)

    errors = []
    valid_count = 0
    seen_docs: set = set()
    seen_emails: set = set()

    for i, raw_row in _csv_rows(reader):
        structure_error = _csv_row_structure_error(raw_row)
        if structure_error:
            column, error = structure_error
            errors.append({"row": i, "column": column, "error": error})
            continue
        row = _normalize_csv_row(raw_row)
        err = _student_row_error(db, row, seen_docs, seen_emails)
        if err:
            column, error = err
            errors.append({"row": i, "column": column, "error": error})
            if row.get("numero_documento"):
                seen_docs.add(row["numero_documento"])
            if row.get("correo"):
                seen_emails.add(row["correo"].strip().lower())
        else:
            valid_count += 1
            seen_docs.add(row["numero_documento"])
            seen_emails.add(row["correo"].lower())

    return {
        "preview": True,
        "total_valid": valid_count,
        "total_errors": len(errors),
        "errors": errors,
        "message": (
            f"{valid_count} estudiante(s) válidos y {len(errors)} fila(s) con errores. "
            "Corrige todos los errores; el lote completo se rechazará mientras exista alguno."
            if errors else
            f"{valid_count} estudiante(s) listos para crear." if valid_count > 0 else
            "El archivo no contiene registros. Agrega al menos una fila antes de continuar."
        ),
    }



# NOTE: El cambio de contraseña (incluido el forzado en primer login) se
# resuelve en `auth.py` → POST /api/v1/auth/change-password, que es la ruta
# registrada y usada por el frontend (ForceChangePassword.tsx). Este módulo
# NO debe redefinir esa ruta, pues quedaría sombreada y duplicaría la lógica.
