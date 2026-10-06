"""
NeuroLearn AI - API de Credenciales B2B (MODIFICADO)
=====================================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.institution import Institution
from app.schemas.schemas import (
    InstitutionCreate,
    InstitutionResponse,
    CredentialItem,
    BulkCreateResponse,
    AdminStats,
)
from app.services.email_service import send_credentials_email
from app.services.mail.addresses import placeholder_email_for

router = APIRouter(tags=["Credenciales B2B"])


# ─── Módulos permitidos del panel Súper Profesor (todos habilitados ahora) ──────
# NOTA: Ya no usamos licencias, todos los módulos están disponibles según rol
SUPER_MODULES = {
    "basica": [  # Mantener para compatibilidad pero todos los módulos están disponibles
        "dashboard",
        "gestión_profesores",
        "gestión_estudiantes",
        "configuracion",
        "reportes",
    ]
}


def _require_role(user: User, *allowed_roles: UserRole) -> None:
    """Verifica si el usuario tiene uno de los roles permitidos."""
    if user.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Se requiere uno de los roles: {[r.value for r in allowed_roles]}",
        )


def _get_my_institution(db: Session, current_user: User) -> Optional[Institution]:
    """Obtiene la institución del usuario actual."""
    institution_id = getattr(current_user, "institution_id", None)
    if not institution_id:
        return None
    return db.query(Institution).filter(Institution.id == institution_id).first()


def _resolve_license_state(institution: Institution) -> tuple[str, Optional[int]]:
    """
    Función de compatibilidad - ya no verifica estado de licencia real.
    Siempre devuelve activo y sin vencimiento.
    """
    if not institution.is_active:
        return "suspended", None
    # Siempre activo, sin vencimiento
    return "active", None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", response_model=InstitutionResponse, status_code=status.HTTP_201_CREATED)
async def create_institution(
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Crea una nueva institución con sus credenciales de acceso inicial.
    NOTA: Ya no se almacena license_type porque el sistema no usa licencias.
    """
    _require_role(current_user, UserRole.ADMIN.value)

    # Verificar que el dane_code no exista
    existing = db.query(Institution).filter(
        Institution.dane_code == payload.dane_code
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El código DANE ya está registrado por otra institución."
        )

    # Crear institución (sin license_type ya que no se usa)
    institution = Institution(
        name=payload.name,
        dane_code=payload.dane_code,
        # license_type eliminada - campo removido del modelo
        created_by=current_user.id,
    )
    db.add(institution)
    db.flush()  # obtener institution.id

    # Generar credenciales para el Super Profesor
    sp_username = payload.sp_document_number
    sp_password = Institution._generate_temp_password()

    # Crear usuario Super Profesor
    sp_user = User(
        username=sp_username,
        email=payload.sp_email,
        full_name=payload.sp_full_name,
        role=UserRole.SUPER_PROFESOR.value,
        hashed_password=User._hash_password(sp_password),
        institution_id=institution.id,
        is_active=True,
    )
    db.add(sp_user)
    db.flush()

    # Credenciales para enviar por email
    credential = CredentialItem(
        full_name=sp_user.full_name,
        username=sp_user.username,
        temp_password=sp_password,
        role=sp_user.role,
    )

    # Enviar credenciales por email (en background)
    try:
        send_credentials_email(
            to_email=sp_user.email,
            credential=credential,
            institution_name=institution.name,
        )
    except Exception as e:
        # No fallar la creación si falla el email
        pass

    db.commit()
    db.refresh(institution)
    db.refresh(sp_user)

    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        # license_type eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=credential,
    )


@router.get("/{institution_id}", response_model=InstitutionResponse)
async def get_institution(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Obtiene los detalles de una institución.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Verificar que el usuario pertenece a esta institución
    if getattr(current_user, "institution_id", None) != institution.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a esta institución"
        )
    
    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        # license_type eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
<<<<<<< HEAD
=======
    }


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


@router.delete("/super/students/{user_id}")
async def delete_student(
    user_id: int,
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
    db.commit()
    return {"ok": True, "message": "Estudiante desactivado correctamente"}


@router.post("/super/students/bulk-delete")
async def bulk_delete_students(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_role(current_user, UserRole.SUPER_PROFESOR.value)
    institution = _get_my_institution(db, current_user)
    ids = payload.get("ids") or []
    if not isinstance(ids, list) or not ids:
        raise HTTPException(400, "Debes enviar al menos un ID válido")

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
        deleted += 1

    db.commit()
    return {"ok": True, "deleted": deleted, "message": "Estudiantes desactivados correctamente"}


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
        email=payload.email or placeholder_email_for(payload.document_number),
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
>>>>>>> c2854c22917fa587265fa11eaec38604e06de41d
    )


@router.get("", response_model=List[InstitutionResponse])
async def list_institutions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
<<<<<<< HEAD
    """
    Lista todas las instituciones (solo para admins).
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institutions = db.query(Institution).all()
    
    results = []
    for institution in institutions:
        results.append(InstitutionResponse(
            id=institution.id,
            name=institution.name,
            dane_code=institution.dane_code,
            # license_type eliminada - ya no se usa
            is_active=institution.is_active,
            created_at=institution.created_at,
            credential=CredentialItem(
                full_name="",  # Se obtiene separadamente si es necesario
                username="",
                temp_password="",
                role="",
            ),
=======
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
    if new_email is not None:
        if not _validate_email(new_email):
            raise HTTPException(400, "Formato de correo inválido")
        conflict = db.query(User).filter(
            User.email == new_email,
            User.id != user_id,
        ).first()
        if conflict:
            raise HTTPException(400, "Ya existe un usuario con ese correo electrónico")
    if updates.get("full_name"):
        student.full_name = updates["full_name"]
    if "document_type" in updates and updates["document_type"]:
        student.document_type = updates["document_type"]
    if "grade" in updates:
        student.grade = updates["grade"]
    if "birth_date" in updates:
        student.birth_date = updates["birth_date"]
    if "email" in updates:
        student.email = updates["email"]
    if "is_active" in updates:
        student.is_active = updates["is_active"]

    db.commit()
    _log(db, "update_student", current_user, institution.id,
         student.id, "estudiante", _client_ip(request), notes="Edición de estudiante")
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
    if not content.strip():
        raise HTTPException(400, "El archivo CSV está vacío")

    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    if not reader.fieldnames:
        raise HTTPException(400, "El archivo CSV no tiene cabeceras válidas")

    required_cols = {"nombre_completo", "tipo_documento", "numero_documento"}

    created: List[CredentialItem] = []
    errors = []
    seen_docs_s: set = set()

    for i, raw_row in enumerate(reader, start=2):
        row = _normalize_csv_row(raw_row)
        if not row or not any((value or "").strip() for value in row.values()):
            continue
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

        email = row.get("correo") or placeholder_email_for(row["numero_documento"])
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
>>>>>>> c2854c22917fa587265fa11eaec38604e06de41d
        ))
    
    return results


# NOTA: El endpoint /super/license-usage ha sido eliminado
# ya que el sistema ya no tracks uso por licencia


@router.put("/{institution_id}", response_model=InstitutionResponse)
async def update_institution(
    institution_id: int,
    payload: InstitutionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Actualiza una institución existente.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Verificar que el usuario pertenece a esta institución
    if getattr(current_user, "institution_id", None) != institution.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a esta institución"
        )
    
    # Verificar que el nuevo dane_code no exista (si cambió)
    if payload.dane_code != institution.dane_code:
        existing = db.query(Institution).filter(
            Institution.dane_code == payload.dane_code
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El código DANE ya está registrado por otra institución."
            )
    
    # Actualizar campos
    institution.name = payload.name
    institution.dane_code = payload.dane_code
    # license_type eliminada - ya no se usa
    
    db.commit()
    db.refresh(institution)
    
    return InstitutionResponse(
        id=institution.id,
        name=institution.name,
        dane_code=institution.dane_code,
        # license_type eliminada - ya no se usa
        is_active=institution.is_active,
        created_at=institution.created_at,
        credential=CredentialItem(
            full_name="",  # Se obtiene separadamente si es necesario
            username="",
            temp_password="",
            role="",
        ),
    )


@router.delete("/{institution_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_institution(
    institution_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Elimina una institución y todos sus datos asociados.
    """
    _require_role(current_user, UserRole.ADMIN.value)
    
    institution = db.query(Institution).filter(
        Institution.id == institution_id
    ).first()
    
    if not institution:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Institución no encontrada"
        )
    
    # Verificar que el usuario pertenece a esta institución
    if getattr(current_user, "institution_id", None) != institution.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene permiso para acceder a esta institución"
        )
    
    # Eliminar usuarios asociados primero (por foreign key)
    db.query(User).filter(User.institution_id == institution.id).delete()
    
    # Eliminar institución
    db.delete(institution)
    db.commit()
    
    return None


# Mantener funciones de compatibilidad pero simplificadas
def _require_super_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    _require_role(user, UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value)