"""
NeuroLearn AI - API de Clases (Rol Profesor)

Endpoints para:
- Crear y gestionar clases
- Inscribir estudiantes con código de invitación
- Asignar bots a clases
- Dashboard y reportes del profesor
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional, List
from datetime import datetime, timedelta

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment, ClassroomBot
from app.models.expert_bot import ExpertBot
from app.models.learning import LearningSession
from app.services.license_service import (
    get_license,
    require_active_license,
    require_student_module,
    require_teacher_module,
    LicenseInfo,
)
from app.schemas.schemas import (
    ClassroomCreate,
    ClassroomResponse,
    ClassroomListResponse,
    EnrollByCodeRequest,
    EnrollmentResponse,
    AssignBotRequest,
    StudentProgressResponse,
    ClassroomStatsResponse,
    ClassroomBotResponse,
    ClassroomStudentDetailResponse,
)

router = APIRouter(prefix="/classrooms", tags=["Clases - Rol Profesor"])


# ============================================================
# UTILIDADES
# ============================================================

def require_teacher(user: User):
    """Verifica que el usuario sea profesor, super profesor o admin."""
    if user.role not in (
        UserRole.PROFESOR.value,
        UserRole.SUPER_PROFESOR.value,
        "admin",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los profesores pueden realizar esta acción",
        )


def require_student(user: User):
    """Verifica que el usuario sea estudiante."""
    if user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los estudiantes pueden realizar esta acción",
        )


# ============================================================
# GESTIÓN DE CLASES - PROFESOR
# ============================================================

@router.post(
    "/",
    response_model=ClassroomResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_classroom(
    request: ClassroomCreate,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Crear una nueva clase (solo profesores)."""

    require_teacher(current_user)

    # --------------------------------------------------------
    # Verificar límite de clases según la licencia
    # --------------------------------------------------------

    total_classes = (
        db.query(Classroom)
        .filter(
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        )
        .count()
    )

    if total_classes >= license_info.groups_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Has alcanzado el límite de "
                f"{license_info.groups_limit} grupos para tu plan "
                f"({license_info.license_type})."
            ),
        )

    # --------------------------------------------------------
    # Crear clase
    # --------------------------------------------------------

    classroom = Classroom(
        teacher_id=current_user.id,
        name=request.name,
        description=request.description,
        subject=request.subject,
        grade=request.grade,
        max_students=request.max_students,
        color=getattr(request, "color", "#2E6FDB"),
        invite_code=Classroom.generate_invite_code(),
    )

    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    # --------------------------------------------------------
    # Respuesta
    # --------------------------------------------------------

    return ClassroomResponse(
        id=classroom.id,
        teacher_id=classroom.teacher_id,
        name=classroom.name,
        description=classroom.description or "",
        subject=classroom.subject,
        grade=classroom.grade,
        invite_code=classroom.invite_code,
        is_active=classroom.is_active,
        max_students=classroom.max_students,
        color=classroom.color or "#2E6FDB",
        student_count=0,
        created_at=classroom.created_at,
    )


@router.get("/", response_model=ClassroomListResponse)
@router.get("/my-classes", response_model=ClassroomListResponse)
async def list_my_classrooms(
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    db: Session = Depends(get_db),
):
    """Listar todas las clases activas del profesor actual."""

    require_teacher(current_user)

    # Obtener todas las clases del profesor en una sola consulta
    classrooms = (
        db.query(Classroom)
        .filter(
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        )
        .all()
    )

    # Si no hay clases, responder rápidamente
    if not classrooms:
        return ClassroomListResponse(
            classrooms=[],
            total=0,
        )

    # --------------------------------------------------------
    # Obtener IDs de las clases
    # --------------------------------------------------------

    classroom_ids = [c.id for c in classrooms]

    # --------------------------------------------------------
    # Obtener cantidad de estudiantes por clase
    # en una sola consulta
    # --------------------------------------------------------

    counts = (
        db.query(
            Enrollment.classroom_id,
            func.count(Enrollment.id).label("cnt"),
        )
        .filter(
            Enrollment.classroom_id.in_(classroom_ids),
            Enrollment.is_active == True,
        )
        .group_by(Enrollment.classroom_id)
        .all()
    )

    counts_map = {
        classroom_id: count
        for classroom_id, count in counts
    }

    # --------------------------------------------------------
    # Construir respuesta
    # --------------------------------------------------------

    result = []

    for classroom in classrooms:
        student_count = counts_map.get(classroom.id, 0)

        result.append(
            ClassroomResponse(
                id=classroom.id,
                teacher_id=classroom.teacher_id,
                name=classroom.name,
                description=classroom.description or "",
                subject=classroom.subject,
                grade=classroom.grade,
                invite_code=classroom.invite_code,
                is_active=classroom.is_active,
                max_students=classroom.max_students,
                color=getattr(
                    classroom,
                    "color",
                    "#2E6FDB",
                )
                or "#2E6FDB",
                student_count=student_count,
                created_at=classroom.created_at,
            )
        )

    return ClassroomListResponse(
        classrooms=result,
        total=len(result),
    )


# ============================================================
# CLASES DEL ESTUDIANTE
# ============================================================

@router.get(
    "/my-enrolled",
    response_model=ClassroomListResponse,
)
async def list_enrolled_classrooms(
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_student_module("mis_cursos")
    ),
    db: Session = Depends(get_db),
):
    """Listar las clases en las que está inscrito el estudiante actual."""

    require_student(current_user)

    # Obtener inscripciones
    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        )
        .all()
    )

    if not enrollments:
        return ClassroomListResponse(
            classrooms=[],
            total=0,
        )

    classroom_ids = [
        enrollment.classroom_id
        for enrollment in enrollments
    ]

    # --------------------------------------------------------
    # Obtener clases
    # --------------------------------------------------------

    classrooms = (
        db.query(Classroom)
        .filter(
            Classroom.id.in_(classroom_ids),
            Classroom.is_active == True,
        )
        .all()
    )

    classrooms_by_id = {
        classroom.id: classroom
        for classroom in classrooms
    }

    # --------------------------------------------------------
    # Obtener cantidad de estudiantes
    # --------------------------------------------------------

    counts = (
        db.query(
            Enrollment.classroom_id,
            func.count(Enrollment.id).label("cnt"),
        )
        .filter(
            Enrollment.classroom_id.in_(classroom_ids),
            Enrollment.is_active == True,
        )
        .group_by(Enrollment.classroom_id)
        .all()
    )

    counts_map = {
        classroom_id: count
        for classroom_id, count in counts
    }

    # --------------------------------------------------------
    # Construir respuesta
    # --------------------------------------------------------

    result = []

    for enrollment in enrollments:
        classroom = classrooms_by_id.get(
            enrollment.classroom_id
        )

        if classroom is None:
            continue

        result.append(
            ClassroomResponse(
                id=classroom.id,
                teacher_id=classroom.teacher_id,
                name=classroom.name,
                description=classroom.description or "",
                subject=classroom.subject,
                grade=classroom.grade,
                invite_code=classroom.invite_code,
                is_active=classroom.is_active,
                max_students=classroom.max_students,
                color=getattr(
                    classroom,
                    "color",
                    "#2E6FDB",
                )
                or "#2E6FDB",
                student_count=counts_map.get(
                    classroom.id,
                    0,
                ),
                created_at=classroom.created_at,
            )
        )

    return ClassroomListResponse(
        classrooms=result,
        total=len(result),
    )


# ============================================================
# OBTENER UNA CLASE
# ============================================================

@router.get(
    "/{classroom_id}",
    response_model=ClassroomResponse,
)
async def get_classroom(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """Obtener detalle de una clase."""

    classroom = (
        db.query(Classroom)
        .filter(Classroom.id == classroom_id)
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    # --------------------------------------------------------
    # Verificar acceso
    # --------------------------------------------------------

    if classroom.teacher_id != current_user.id:

        if (
            current_user.role == UserRole.ESTUDIANTE.value
            and not license_info.has_student_module("mis_cursos")
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "El módulo 'mis_cursos' no está disponible "
                    f"en tu licencia ({license_info.license_type})."
                ),
            )

        enrollment = (
            db.query(Enrollment)
            .filter(
                Enrollment.classroom_id == classroom_id,
                Enrollment.student_id == current_user.id,
                Enrollment.is_active == True,
            )
            .first()
        )

        if not enrollment:
            raise HTTPException(
                status_code=403,
                detail="No tienes acceso a esta clase",
            )

    # --------------------------------------------------------
    # Contar estudiantes
    # --------------------------------------------------------

    student_count = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.is_active == True,
        )
        .count()
    )

    return ClassroomResponse(
        id=classroom.id,
        teacher_id=classroom.teacher_id,
        name=classroom.name,
        description=classroom.description or "",
        subject=classroom.subject,
        grade=classroom.grade,
        invite_code=classroom.invite_code,
        is_active=classroom.is_active,
        max_students=classroom.max_students,
        color=classroom.color or "#2E6FDB",
        student_count=student_count,
        created_at=classroom.created_at,
    )


# ============================================================
# DETALLE DE CLASE PARA ESTUDIANTE
# ============================================================

@router.get(
    "/{classroom_id}/student-detail",
    response_model=ClassroomStudentDetailResponse,
)
async def get_student_classroom_detail(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """
    Detalle de una clase para el estudiante inscrito.

    Devuelve:
    - Información de la clase
    - Profesor
    - Bots asignados
    - Progreso del estudiante
    """

    if current_user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(
            status_code=403,
            detail="Solo los estudiantes pueden ver esta vista",
        )

    # --------------------------------------------------------
    # Buscar clase
    # --------------------------------------------------------

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.is_active == True,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    # --------------------------------------------------------
    # Verificar inscripción
    # --------------------------------------------------------

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        )
        .first()
    )

    if not enrollment:
        raise HTTPException(
            status_code=403,
            detail="No estás inscrito en esta clase",
        )

    # --------------------------------------------------------
    # Obtener profesor
    # --------------------------------------------------------

    teacher = (
        db.query(User)
        .filter(User.id == classroom.teacher_id)
        .first()
    )

    teacher_name = (
        (teacher.full_name or teacher.username)
        if teacher
        else ""
    )

    # --------------------------------------------------------
    # Contar estudiantes
    # --------------------------------------------------------

    student_count = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.is_active == True,
        )
        .count()
    )

    # --------------------------------------------------------
    # Obtener bots asignados
    # --------------------------------------------------------

    assignments = (
        db.query(ClassroomBot)
        .filter(
            ClassroomBot.classroom_id == classroom_id
        )
        .order_by(ClassroomBot.order_index)
        .all()
    )

    bots = []

    if assignments:

        bot_ids = [
            assignment.bot_id
            for assignment in assignments
        ]

        bot_map = {
            bot.id: bot
            for bot in (
                db.query(ExpertBot)
                .filter(ExpertBot.id.in_(bot_ids))
                .all()
            )
        }

        for assignment in assignments:

            bot = bot_map.get(
                assignment.bot_id
            )

            if bot:
                bots.append(
                    ClassroomBotResponse(
                        bot_id=bot.id,
                        name=bot.name,
                        description=bot.description or "",
                        category=bot.category,
                        is_required=assignment.is_required,
                        order_index=assignment.order_index,
                    )
                )

    return ClassroomStudentDetailResponse(
        id=classroom.id,
        name=classroom.name,
        description=classroom.description or "",
        subject=classroom.subject,
        grade=classroom.grade,
        color=classroom.color or "#2E6FDB",
        max_students=classroom.max_students,
        student_count=student_count,
        created_at=classroom.created_at,
        teacher_name=teacher_name,
        invite_code=classroom.invite_code,
        overall_progress=enrollment.overall_progress,
        total_sessions=enrollment.total_sessions,
        total_time_minutes=enrollment.total_time_minutes,
        average_score=enrollment.average_score,
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
        bots=bots,
    )


# ============================================================
# ELIMINAR / DESACTIVAR CLASE
# ============================================================

@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("cursos")
    ),
    active_license: LicenseInfo = Depends(
        require_active_license()
    ),
    db: Session = Depends(get_db),
):
    """Desactivar una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_user.id,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    classroom.is_active = False

    db.commit()

    return {
        "message": f"Clase '{classroom.name}' desactivada"
    }


# ============================================================
# INSCRIPCIÓN DE ESTUDIANTES
# ============================================================

@router.post(
    "/join",
    response_model=EnrollmentResponse,
)
async def join_classroom(
    request: EnrollByCodeRequest,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_student_module("mis_cursos")
    ),
    active_license: LicenseInfo = Depends(
        require_active_license()
    ),
    db: Session = Depends(get_db),
):
    """Inscribirse en una clase con código de invitación."""

    require_student(current_user)

    # --------------------------------------------------------
    # Buscar clase
    # --------------------------------------------------------

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.invite_code == request.invite_code.upper(),
            Classroom.is_active == True,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Código de invitación no válido",
        )

    # --------------------------------------------------------
    # Verificar inscripción existente
    # --------------------------------------------------------

    existing = (
        db.query(Enrollment)
        .filter(
            Enrollment.student_id == current_user.id,
            Enrollment.classroom_id == classroom.id,
        )
        .first()
    )

    if existing:

        if existing.is_active:
            raise HTTPException(
                status_code=400,
                detail="Ya estás inscrito en esta clase",
            )

        existing.is_active = True

        db.commit()
        db.refresh(existing)

        return _enrollment_to_response(
            existing,
            current_user,
        )

    # --------------------------------------------------------
    # Verificar cupo
    # --------------------------------------------------------

    current_count = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.is_active == True,
        )
        .count()
    )

    if current_count >= classroom.max_students:
        raise HTTPException(
            status_code=400,
            detail="La clase está llena",
        )

    # --------------------------------------------------------
    # Crear inscripción
    # --------------------------------------------------------

    enrollment = Enrollment(
        student_id=current_user.id,
        classroom_id=classroom.id,
    )

    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # --------------------------------------------------------
    # Automatización: nuevo estudiante
    # --------------------------------------------------------

    try:
        from app.services import integration_service as _isvc

        _isvc.dispatch_trigger(
            db,
            current_user,
            "nuevo_estudiante",
            {
                "event_desc": "Nuevo estudiante inscrito",
                "student_id": current_user.id,
                "name": (
                    current_user.full_name
                    or current_user.username
                ),
                "classroom_id": classroom.id,
                "classroom_name": classroom.name,
            },
        )

    except Exception:
        db.rollback()

    return _enrollment_to_response(
        enrollment,
        current_user,
    )


# ============================================================
# LISTAR ESTUDIANTES
# ============================================================

@router.get(
    "/{classroom_id}/students",
    response_model=List[EnrollmentResponse],
)
async def list_students(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("cursos")
    ),
    db: Session = Depends(get_db),
):
    """Listar estudiantes inscritos en una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_user.id,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.is_active == True,
        )
        .all()
    )

    result = []

    if enrollments:

        student_ids = [
            enrollment.student_id
            for enrollment in enrollments
        ]

        students_by_id = {
            user.id: user
            for user in (
                db.query(User)
                .filter(User.id.in_(student_ids))
                .all()
            )
        }

        for enrollment in enrollments:
            result.append(
                _enrollment_to_response(
                    enrollment,
                    students_by_id.get(
                        enrollment.student_id
                    ),
                )
            )

    return result


# ============================================================
# REMOVER ESTUDIANTE
# ============================================================

@router.delete(
    "/{classroom_id}/students/{student_id}"
)
async def remove_student(
    classroom_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("cursos")
    ),
    active_license: LicenseInfo = Depends(
        require_active_license()
    ),
    db: Session = Depends(get_db),
):
    """Remover un estudiante de una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(Classroom.id == classroom_id)
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    if (
        classroom.teacher_id != current_user.id
        and current_user.role
        not in (
            UserRole.SUPER_PROFESOR.value,
            UserRole.ADMIN.value,
        )
    ):
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a esta clase",
        )

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.student_id == student_id,
            Enrollment.is_active == True,
        )
        .first()
    )

    if not enrollment:
        raise HTTPException(
            status_code=404,
            detail="Estudiante no encontrado en la clase",
        )

    enrollment.is_active = False

    db.commit()

    return {
        "message": "Estudiante removido de la clase"
    }


# ============================================================
# ASIGNACIÓN DE BOTS
# ============================================================

@router.post("/{classroom_id}/bots")
async def assign_bot_to_classroom(
    classroom_id: int,
    request: AssignBotRequest,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("neurobots")
    ),
    active_license: LicenseInfo = Depends(
        require_active_license()
    ),
    db: Session = Depends(get_db),
):
    """Asignar un bot a la clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_user.id,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    bot = (
        db.query(ExpertBot)
        .filter(ExpertBot.id == request.bot_id)
        .first()
    )

    if not bot:
        raise HTTPException(
            status_code=404,
            detail="Bot no encontrado",
        )

    # --------------------------------------------------------
    # Verificar duplicado
    # --------------------------------------------------------

    existing = (
        db.query(ClassroomBot)
        .filter(
            ClassroomBot.classroom_id == classroom_id,
            ClassroomBot.bot_id == request.bot_id,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Este bot ya está asignado a la clase",
        )

    # --------------------------------------------------------
    # Crear asignación
    # --------------------------------------------------------

    assignment = ClassroomBot(
        classroom_id=classroom_id,
        bot_id=request.bot_id,
        is_required=request.is_required,
        order_index=request.order_index,
    )

    db.add(assignment)
    db.commit()

    return {
        "message": (
            f"Bot '{bot.name}' asignado a la clase "
            f"'{classroom.name}'"
        )
    }


# ============================================================
# BOTS DISPONIBLES
# ============================================================

@router.get(
    "/{classroom_id}/available-bots"
)
async def list_available_bots(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("neurobots")
    ),
    db: Session = Depends(get_db),
):
    """
    Lista los bots creados por el profesor que pueden
    compartirse con la clase.
    """

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_user.id,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    # --------------------------------------------------------
    # Bots ya asignados
    # --------------------------------------------------------

    assigned_ids = {
        row[0]
        for row in (
            db.query(ClassroomBot.bot_id)
            .filter(
                ClassroomBot.classroom_id == classroom_id
            )
            .all()
        )
    }

    # --------------------------------------------------------
    # Bots creados por el profesor
    # --------------------------------------------------------

    bots = (
        db.query(ExpertBot)
        .filter(
            ExpertBot.creator_id == current_user.id
        )
        .order_by(ExpertBot.created_at.desc())
        .all()
    )

    result = []

    for bot in bots:
        result.append(
            {
                "bot_id": bot.id,
                "name": bot.name,
                "subject": bot.category or "",
                "assigned": bot.id in assigned_ids,
            }
        )

    return {
        "bots": result,
        "total": len(result),
    }


# ============================================================
# BOTS DE UNA CLASE
# ============================================================

@router.get("/{classroom_id}/bots")
async def list_classroom_bots(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("neurobots")
    ),
    db: Session = Depends(get_db),
):
    """Listar bots asignados a una clase."""

    assignments = (
        db.query(ClassroomBot)
        .filter(
            ClassroomBot.classroom_id == classroom_id
        )
        .order_by(ClassroomBot.order_index)
        .all()
    )

    result = []

    if assignments:

        bot_ids = [
            assignment.bot_id
            for assignment in assignments
        ]

        bot_map = {
            bot.id: bot
            for bot in (
                db.query(ExpertBot)
                .filter(ExpertBot.id.in_(bot_ids))
                .all()
            )
        }

        for assignment in assignments:

            bot = bot_map.get(
                assignment.bot_id
            )

            if bot:
                result.append(
                    {
                        "bot_id": bot.id,
                        "name": bot.name,
                        "description": bot.description,
                        "category": bot.category,
                        "is_required": assignment.is_required,
                        "order_index": assignment.order_index,
                    }
                )

    return {
        "bots": result,
        "total": len(result),
    }


# ============================================================
# REMOVER BOT
# ============================================================

@router.delete(
    "/{classroom_id}/bots/{bot_id}"
)
async def remove_bot_from_classroom(
    classroom_id: int,
    bot_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("neurobots")
    ),
    active_license: LicenseInfo = Depends(
        require_active_license()
    ),
    db: Session = Depends(get_db),
):
    """Remover un bot de una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(Classroom.id == classroom_id)
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    if (
        classroom.teacher_id != current_user.id
        and current_user.role
        not in (
            UserRole.SUPER_PROFESOR.value,
            UserRole.ADMIN.value,
        )
    ):
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a esta clase",
        )

    assignment = (
        db.query(ClassroomBot)
        .filter(
            ClassroomBot.classroom_id == classroom_id,
            ClassroomBot.bot_id == bot_id,
        )
        .first()
    )

    if not assignment:
        raise HTTPException(
            status_code=404,
            detail="Bot no asignado a esta clase",
        )

    db.delete(assignment)
    db.commit()

    return {
        "message": "Bot removido de la clase"
    }


# ============================================================
# DASHBOARD Y REPORTES
# ============================================================

@router.get(
    "/{classroom_id}/stats",
    response_model=ClassroomStatsResponse,
)
async def get_classroom_stats(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("cursos")
    ),
    db: Session = Depends(get_db),
):
    """Estadísticas generales de la clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_user.id,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.is_active == True,
        )
        .all()
    )

    total_students = len(enrollments)

    if total_students == 0:
        return ClassroomStatsResponse(
            classroom_id=classroom.id,
            classroom_name=classroom.name,
            total_students=0,
            active_students=0,
            avg_progress=0.0,
            avg_score=0.0,
            total_sessions=0,
            students_at_risk=0,
        )

    # --------------------------------------------------------
    # Métricas
    # --------------------------------------------------------

    week_ago = datetime.utcnow() - timedelta(days=7)

    active_students = sum(
        1
        for enrollment in enrollments
        if (
            enrollment.last_activity
            and enrollment.last_activity > week_ago
        )
    )

    avg_progress = (
        sum(
            enrollment.overall_progress
            for enrollment in enrollments
        )
        / total_students
    )

    avg_score = (
        sum(
            enrollment.average_score
            for enrollment in enrollments
        )
        / total_students
    )

    total_sessions = sum(
        enrollment.total_sessions
        for enrollment in enrollments
    )

    students_at_risk = sum(
        1
        for enrollment in enrollments
        if enrollment.risk_level in ("medium", "high")
    )

    # --------------------------------------------------------
    # Obtener estudiantes
    # --------------------------------------------------------

    student_ids = [
        enrollment.student_id
        for enrollment in enrollments
    ]

    students_by_id = {
        user.id: user
        for user in (
            db.query(User)
            .filter(User.id.in_(student_ids))
            .all()
        )
    }

    # --------------------------------------------------------
    # Mejores resultados
    # --------------------------------------------------------

    sorted_by_score = sorted(
        enrollments,
        key=lambda enrollment: enrollment.average_score,
        reverse=True,
    )

    top_performers = []

    for enrollment in sorted_by_score[:5]:

        student = students_by_id.get(
            enrollment.student_id
        )

        if student:
            top_performers.append(
                {
                    "name": (
                        student.full_name
                        or student.username
                    ),
                    "score": enrollment.average_score,
                    "progress": enrollment.overall_progress,
                }
            )

    # --------------------------------------------------------
    # Estudiantes con dificultades
    # --------------------------------------------------------

    struggling = []

    for enrollment in enrollments:

        if enrollment.risk_level in ("medium", "high"):

            student = students_by_id.get(
                enrollment.student_id
            )

            if student:
                struggling.append(
                    {
                        "name": (
                            student.full_name
                            or student.username
                        ),
                        "risk_level": enrollment.risk_level,
                        "risk_factors": (
                            enrollment.risk_factors or []
                        ),
                        "progress": enrollment.overall_progress,
                    }
                )

    return ClassroomStatsResponse(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        total_students=total_students,
        active_students=active_students,
        avg_progress=round(avg_progress, 1),
        avg_score=round(avg_score, 1),
        total_sessions=total_sessions,
        students_at_risk=students_at_risk,
        top_performers=top_performers,
        struggling_students=struggling,
    )


# ============================================================
# PROGRESO DE ESTUDIANTE
# ============================================================

@router.get(
    "/{classroom_id}/students/{student_id}/progress",
    response_model=StudentProgressResponse,
)
async def get_student_progress(
    classroom_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("cursos")
    ),
    db: Session = Depends(get_db),
):
    """Progreso detallado de un estudiante en una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(Classroom.id == classroom_id)
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    if (
        classroom.teacher_id != current_user.id
        and current_user.role
        not in (
            UserRole.SUPER_PROFESOR.value,
            UserRole.ADMIN.value,
        )
    ):
        raise HTTPException(
            status_code=403,
            detail="No tienes acceso a esta clase",
        )

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.student_id == student_id,
            Enrollment.is_active == True,
        )
        .first()
    )

    if not enrollment:
        raise HTTPException(
            status_code=404,
            detail="Estudiante no encontrado en la clase",
        )

    student = (
        db.query(User)
        .filter(User.id == student_id)
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=404,
            detail="Estudiante no encontrado",
        )

    return StudentProgressResponse(
        student_id=student.id,
        student_name=(
            student.full_name
            or student.username
        ),
        username=student.username,
        overall_progress=enrollment.overall_progress,
        total_sessions=enrollment.total_sessions,
        total_time_minutes=enrollment.total_time_minutes,
        average_score=enrollment.average_score,
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
        cognitive_profile=student.cognitive_profile,
    )


# ============================================================
# ALERTAS
# ============================================================

@router.get("/{classroom_id}/alerts")
async def get_classroom_alerts(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(
        require_teacher_module("cursos")
    ),
    db: Session = Depends(get_db),
):
    """Alertas de estudiantes en riesgo."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id,
            Classroom.teacher_id == current_user.id,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Clase no encontrada",
        )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.is_active == True,
        )
        .all()
    )

    # --------------------------------------------------------
    # Obtener estudiantes
    # --------------------------------------------------------

    student_ids = [
        enrollment.student_id
        for enrollment in enrollments
    ]

    students_by_id = (
        {
            user.id: user
            for user in (
                db.query(User)
                .filter(User.id.in_(student_ids))
                .all()
            )
        }
        if student_ids
        else {}
    )

    # --------------------------------------------------------
    # Generar alertas
    # --------------------------------------------------------

    alerts = []

    for enrollment in enrollments:

        student = students_by_id.get(
            enrollment.student_id
        )

        if not student:
            continue

        name = (
            student.full_name
            or student.username
        )

        # ----------------------------------------------------
        # Alerta: inactividad
        # ----------------------------------------------------

        if enrollment.last_activity:

            days_inactive = (
                datetime.utcnow()
                - enrollment.last_activity
            ).days

            if days_inactive >= 7:

                alerts.append(
                    {
                        "type": "inactivity",
                        "severity": (
                            "high"
                            if days_inactive >= 14
                            else "medium"
                        ),
                        "student": name,
                        "student_id": student.id,
                        "message": (
                            f"Sin actividad desde hace "
                            f"{days_inactive} días"
                        ),
                    }
                )

        elif enrollment.total_sessions == 0:

            alerts.append(
                {
                    "type": "never_started",
                    "severity": "medium",
                    "student": name,
                    "student_id": student.id,
                    "message": (
                        "Nunca ha iniciado una sesión"
                    ),
                }
            )

        # ----------------------------------------------------
        # Alerta: bajo rendimiento
        # ----------------------------------------------------

        if (
            enrollment.total_sessions >= 3
            and enrollment.average_score < 40
        ):

            alerts.append(
                {
                    "type": "low_performance",
                    "severity": "high",
                    "student": name,
                    "student_id": student.id,
                    "message": (
                        f"Promedio muy bajo: "
                        f"{enrollment.average_score:.0f}%"
                    ),
                }
            )

        # ----------------------------------------------------
        # Alerta: riesgo cognitivo
        # ----------------------------------------------------

        if enrollment.risk_level in (
            "medium",
            "high",
        ):

            alerts.append(
                {
                    "type": "cognitive_risk",
                    "severity": enrollment.risk_level,
                    "student": name,
                    "student_id": student.id,
                    "message": (
                        "Riesgo cognitivo: "
                        + ", ".join(
                            enrollment.risk_factors
                            or ["detectado"]
                        )
                    ),
                }
            )

    # --------------------------------------------------------
    # Ordenar por severidad
    # --------------------------------------------------------

    severity_order = {
        "high": 0,
        "medium": 1,
        "low": 2,
    }

    alerts.sort(
        key=lambda alert: severity_order.get(
            alert["severity"],
            3,
        )
    )

    return {
        "alerts": alerts,
        "total": len(alerts),
        "classroom": classroom.name,
    }


# ============================================================
# UTILIDADES INTERNAS
# ============================================================

def _enrollment_to_response(
    enrollment: Enrollment,
    student: Optional[User],
) -> EnrollmentResponse:
    """Convierte un Enrollment en EnrollmentResponse."""

    return EnrollmentResponse(
        id=enrollment.id,
        student_id=enrollment.student_id,
        student_name=(
            student.full_name or student.username
            if student
            else ""
        ),
        student_username=(
            student.username
            if student
            else ""
        ),
        student_email=(
            student.email
            if student
            else None
        ),
        classroom_id=enrollment.classroom_id,
        enrolled_at=enrollment.enrolled_at,
        overall_progress=enrollment.overall_progress,
        total_sessions=enrollment.total_sessions,
        total_time_minutes=enrollment.total_time_minutes,
        average_score=enrollment.average_score,
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
    )