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
from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment, ClassroomBot
from app.models.expert_bot import ExpertBot


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


router = APIRouter(
    prefix="/classrooms",
    tags=["Clases - Rol Profesor"],
)


# ============================================================
# UTILIDADES
# ============================================================

def require_teacher(user: User):
    """
    Verifica que el usuario sea:
    - Profesor
    - Super Profesor
    - Administrador
    """

    allowed_roles = (
        UserRole.PROFESOR.value,
        UserRole.SUPER_PROFESOR.value,
        UserRole.ADMIN.value,
    )

    if user.role not in allowed_roles:
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


def can_manage_classroom(
    current_user: User,
    classroom: Classroom,
) -> bool:
    """
    Determina si el usuario puede administrar una clase.

    Puede hacerlo:
    - El profesor propietario.
    - Un Super Profesor.
    - Un Administrador.
    """

    if classroom.teacher_id == current_user.id:
        return True

    if current_user.role in (
        UserRole.SUPER_PROFESOR.value,
        UserRole.ADMIN.value,
    ):
        return True

    return False


def classroom_response(
    classroom: Classroom,
    student_count: int = 0,
) -> ClassroomResponse:
    """
    Construye una respuesta ClassroomResponse
    de forma centralizada.
    """

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
        color=getattr(
            classroom,
            "color",
            "#2E6FDB",
        ) or "#2E6FDB",
        student_count=student_count,
        created_at=classroom.created_at,
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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Crear una nueva clase."""

    require_teacher(current_user)

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
        color=getattr(
            request,
            "color",
            "#2E6FDB",
        ) or "#2E6FDB",
        invite_code=Classroom.generate_invite_code(),
    )

    try:
        db.add(classroom)
        db.flush()
        # Actividad institucional → Súper Profesor(es) de la institución.
        from app.services import notification_service
        notification_service.notify(
            db,
            notification_service.super_profesores_of(db, current_user.institution_id),
            "actividad_institucional",
            "Nuevo grupo creado",
            f'{current_user.full_name or current_user.username} creó el grupo "{classroom.name}".',
            link="/super?tab=grupos",
            resource_type="aula",
            resource_id=classroom.id,
        )
        db.commit()
        db.refresh(classroom)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible crear la clase",
        )

    return classroom_response(
        classroom,
        student_count=0,
    )


# ============================================================
# LISTAR CLASES DEL PROFESOR
# ============================================================

@router.get(
    "/",
    response_model=ClassroomListResponse,
)
@router.get(
    "/my-classes",
    response_model=ClassroomListResponse,
)
async def list_my_classrooms(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Listar todas las clases activas del profesor actual."""

    require_teacher(current_user)

    classrooms = (
        db.query(Classroom)
        .filter(
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        )
        .all()
    )

    if not classrooms:
        return ClassroomListResponse(
            classrooms=[],
            total=0,
        )

    classroom_ids = [
        classroom.id
        for classroom in classrooms
    ]

    # --------------------------------------------------------
    # Contar estudiantes
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
        .group_by(
            Enrollment.classroom_id
        )
        .all()
    )

    counts_map = {
        classroom_id: count
        for classroom_id, count in counts
    }

    # --------------------------------------------------------
    # Construir respuesta
    # --------------------------------------------------------

    result = [
        classroom_response(
            classroom,
            counts_map.get(
                classroom.id,
                0,
            ),
        )
        for classroom in classrooms
    ]

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
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
    db: Session = Depends(get_db),
):
    """Listar las clases del estudiante actual."""

    require_student(current_user)

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
    # Contar estudiantes por clase
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
        .group_by(
            Enrollment.classroom_id
        )
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
            classroom_response(
                classroom,
                counts_map.get(
                    classroom.id,
                    0,
                ),
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
    db: Session = Depends(get_db),
):
    """Obtener detalle de una clase."""

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    # --------------------------------------------------------
    # Profesor propietario / Super Profesor / Admin
    # --------------------------------------------------------

    if can_manage_classroom(
        current_user,
        classroom,
    ):
        student_count = (
            db.query(Enrollment)
            .filter(
                Enrollment.classroom_id == classroom.id,
                Enrollment.is_active == True,
            )
            .count()
        )

        return classroom_response(
            classroom,
            student_count,
        )

    # --------------------------------------------------------
    # Estudiante
    # --------------------------------------------------------

    if current_user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

    student_count = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.is_active == True,
        )
        .count()
    )

    return classroom_response(
        classroom,
        student_count,
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
    db: Session = Depends(get_db),
):
    """
    Detalle de una clase para el estudiante inscrito.
    """

    require_student(current_user)

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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
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
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No estás inscrito en esta clase",
        )

    teacher = (
        db.query(User)
        .filter(
            User.id == classroom.teacher_id
        )
        .first()
    )

    teacher_name = (
        teacher.full_name or teacher.username
        if teacher
        else ""
    )

    student_count = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.is_active == True,
        )
        .count()
    )

    # --------------------------------------------------------
    # Bots asignados
    # --------------------------------------------------------

    assignments = (
        db.query(ClassroomBot)
        .filter(
            ClassroomBot.classroom_id == classroom_id
        )
        .order_by(
            ClassroomBot.order_index
        )
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
                .filter(
                    ExpertBot.id.in_(bot_ids)
                )
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
        overall_progress=enrollment.overall_progress or 0,
        total_sessions=enrollment.total_sessions or 0,
        total_time_minutes=enrollment.total_time_minutes or 0,
        average_score=enrollment.average_score or 0,
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
        bots=bots,
    )


# ============================================================
# ELIMINAR / DESACTIVAR CLASE
# ============================================================

@router.delete(
    "/{classroom_id}"
)
async def delete_classroom(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Desactivar una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

    classroom.is_active = False

    try:
        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible desactivar la clase",
        )

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
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
    db: Session = Depends(get_db),
):
    """Inscribirse en una clase con código."""

    require_student(current_user)

    invite_code = (
        request.invite_code or ""
    ).strip().upper()

    if not invite_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes ingresar un código de invitación",
        )

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.invite_code == invite_code,
            Classroom.is_active == True,
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
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
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya estás inscrito en esta clase",
            )

        from app.services import neurobot_service
        bots_before = neurobot_service.bot_ids_of_student(db, current_user.id)
        existing.is_active = True

        try:
            db.flush()
            neurobot_service.notify_new_member(db, current_user, classroom, bots_before)
            db.commit()
            db.refresh(existing)

        except Exception:
            db.rollback()

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No fue posible reactivar la inscripción",
            )

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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La clase está llena",
        )

    # --------------------------------------------------------
    # Crear inscripción
    # --------------------------------------------------------

    enrollment = Enrollment(
        student_id=current_user.id,
        classroom_id=classroom.id,
    )

    from app.services import neurobot_service
    bots_before = neurobot_service.bot_ids_of_student(db, current_user.id)

    try:
        db.add(enrollment)
        db.flush()
        # NeuroBots que el grupo ya tenía → notificación al nuevo estudiante.
        neurobot_service.notify_new_member(db, current_user, classroom, bots_before)
        db.commit()
        db.refresh(enrollment)

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible inscribirte en la clase",
        )

    # --------------------------------------------------------
    # Automatización
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
            owner_id=classroom.teacher_id,
        )

    except Exception:
        # La inscripción ya fue guardada.
        # No debemos deshacerla si falla la automatización.
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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Listar estudiantes inscritos en una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.is_active == True,
        )
        .all()
    )

    if not enrollments:
        return []

    student_ids = [
        enrollment.student_id
        for enrollment in enrollments
    ]

    students_by_id = {
        user.id: user
        for user in (
            db.query(User)
            .filter(
                User.id.in_(student_ids)
            )
            .all()
        )
    }

    return [
        _enrollment_to_response(
            enrollment,
            students_by_id.get(
                enrollment.student_id
            ),
        )
        for enrollment in enrollments
    ]


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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Remover un estudiante de una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado en la clase",
        )

    enrollment.is_active = False

    try:
        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible remover al estudiante",
        )

    return {
        "message": "Estudiante removido de la clase"
    }


# ============================================================
# ASIGNACIÓN DE BOTS
# ============================================================

@router.post(
    "/{classroom_id}/bots"
)
async def assign_bot_to_classroom(
    classroom_id: int,
    request: AssignBotRequest,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
    db: Session = Depends(get_db),
):
    """Asignar un bot a una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

    bot = (
        db.query(ExpertBot)
        .filter(
            ExpertBot.id == request.bot_id
        )
        .first()
    )

    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot no encontrado",
        )

    # Solo bots propios o públicos de su institución: asignar un bot da a los
    # estudiantes del aula acceso a su base de conocimiento.
    from app.services.bot_documents import can_use_bot
    if not can_use_bot(db, current_user, bot):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo puedes asignar tus NeuroBots o los públicos de tu institución.",
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este bot ya está asignado a la clase",
        )

    # --------------------------------------------------------
    # Crear asignación
    # --------------------------------------------------------

    # Mismo servicio que POST /bots/{id}/assignments: guarda la meta, quién
    # asigna y notifica a los estudiantes del aula en la misma transacción.
    from app.services import neurobot_service

    try:
        neurobot_service.assign(
            db, current_user, bot, [classroom_id], [],
            request.goal_interactions or neurobot_service.DEFAULT_GOAL_INTERACTIONS,
        )
        assignment = (
            db.query(ClassroomBot)
            .filter(
                ClassroomBot.classroom_id == classroom_id,
                ClassroomBot.bot_id == request.bot_id,
            )
            .first()
        )
        assignment.is_required = request.is_required
        assignment.order_index = request.order_index
        db.commit()

    except neurobot_service.NeuroBotError as exc:
        db.rollback()

        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        )

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible asignar el bot",
        )

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
    _authorized: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
    db: Session = Depends(get_db),
):
    """
    Lista los bots creados por el profesor
    que pueden compartirse con la clase.
    """

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

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
    # Para profesor normal: sus propios bots.
    # Para Super Profesor/Admin: también sus propios bots.
    # --------------------------------------------------------

    bots = (
        db.query(ExpertBot)
        .filter(
            ExpertBot.creator_id == current_user.id
        )
        .order_by(
            ExpertBot.created_at.desc()
        )
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

@router.get(
    "/{classroom_id}/bots"
)
async def list_classroom_bots(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
    db: Session = Depends(get_db),
):
    """Listar bots asignados a una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

    assignments = (
        db.query(ClassroomBot)
        .filter(
            ClassroomBot.classroom_id == classroom_id
        )
        .order_by(
            ClassroomBot.order_index
        )
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
                .filter(
                    ExpertBot.id.in_(bot_ids)
                )
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
                        "description": bot.description or "",
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
    _authorized: User = Depends(require_permission(Permission.ASIGNAR_BOTS_AULA)),
    db: Session = Depends(get_db),
):
    """Remover un bot de una clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bot no asignado a esta clase",
        )

    try:
        db.delete(assignment)
        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible remover el bot",
        )

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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Estadísticas generales de la clase."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
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
            top_performers=[],
            struggling_students=[],
        )

    # --------------------------------------------------------
    # Métricas
    # --------------------------------------------------------

    week_ago = (
        datetime.utcnow()
        - timedelta(days=7)
    )

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
            enrollment.overall_progress or 0
            for enrollment in enrollments
        )
        / total_students
    )

    avg_score = (
        sum(
            enrollment.average_score or 0
            for enrollment in enrollments
        )
        / total_students
    )

    total_sessions = sum(
        enrollment.total_sessions or 0
        for enrollment in enrollments
    )

    students_at_risk = sum(
        1
        for enrollment in enrollments
        if enrollment.risk_level
        in ("medium", "high")
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
            .filter(
                User.id.in_(student_ids)
            )
            .all()
        )
    }

    # --------------------------------------------------------
    # Mejores resultados
    # --------------------------------------------------------

    sorted_by_score = sorted(
        enrollments,
        key=lambda enrollment: (
            enrollment.average_score or 0
        ),
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
                    "score": (
                        enrollment.average_score
                        or 0
                    ),
                    "progress": (
                        enrollment.overall_progress
                        or 0
                    ),
                }
            )

    # --------------------------------------------------------
    # Estudiantes con dificultades
    # --------------------------------------------------------

    struggling = []

    for enrollment in enrollments:

        if enrollment.risk_level in (
            "medium",
            "high",
        ):

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
                            enrollment.risk_factors
                            or []
                        ),
                        "progress": (
                            enrollment.overall_progress
                            or 0
                        ),
                    }
                )

    return ClassroomStatsResponse(
        classroom_id=classroom.id,
        classroom_name=classroom.name,
        total_students=total_students,
        active_students=active_students,
        avg_progress=round(
            avg_progress,
            1,
        ),
        avg_score=round(
            avg_score,
            1,
        ),
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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Progreso detallado de un estudiante."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado en la clase",
        )

    student = (
        db.query(User)
        .filter(
            User.id == student_id
        )
        .first()
    )

    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Estudiante no encontrado",
        )

    return StudentProgressResponse(
        student_id=student.id,
        student_name=(
            student.full_name
            or student.username
        ),
        username=student.username,
        overall_progress=(
            enrollment.overall_progress or 0
        ),
        total_sessions=(
            enrollment.total_sessions or 0
        ),
        total_time_minutes=(
            enrollment.total_time_minutes or 0
        ),
        average_score=(
            enrollment.average_score or 0
        ),
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
        cognitive_profile=student.cognitive_profile,
    )


# ============================================================
# ALERTAS
# ============================================================

@router.get(
    "/{classroom_id}/alerts"
)
async def get_classroom_alerts(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Alertas de estudiantes en riesgo."""

    require_teacher(current_user)

    classroom = (
        db.query(Classroom)
        .filter(
            Classroom.id == classroom_id
        )
        .first()
    )

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Clase no encontrada",
        )

    if not can_manage_classroom(
        current_user,
        classroom,
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a esta clase",
        )

    enrollments = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.is_active == True,
        )
        .all()
    )

    student_ids = [
        enrollment.student_id
        for enrollment in enrollments
    ]

    students_by_id = (
        {
            user.id: user
            for user in (
                db.query(User)
                .filter(
                    User.id.in_(student_ids)
                )
                .all()
            )
        }
        if student_ids
        else {}
    )

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

        elif (enrollment.total_sessions or 0) == 0:

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

        average_score = (
            enrollment.average_score or 0
        )

        total_sessions = (
            enrollment.total_sessions or 0
        )

        if (
            total_sessions >= 3
            and average_score < 40
        ):

            alerts.append(
                {
                    "type": "low_performance",
                    "severity": "high",
                    "student": name,
                    "student_id": student.id,
                    "message": (
                        f"Promedio muy bajo: "
                        f"{average_score:.0f}%"
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
            (
                student.full_name
                or student.username
            )
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
        overall_progress=(
            enrollment.overall_progress or 0
        ),
        total_sessions=(
            enrollment.total_sessions or 0
        ),
        total_time_minutes=(
            enrollment.total_time_minutes or 0
        ),
        average_score=(
            enrollment.average_score or 0
        ),
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
    )
