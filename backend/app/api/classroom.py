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
from app.services.competencies import classroom_competency, from_subject, valid_key
from app.services import neuroalert_service
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


from app.services.enrollment_tracking_service import EnrollmentTrackingService  # noqa: E402
from app.services.capacity import (
    MAX_CLASSROOMS_PER_INSTITUTION,
    effective_classroom_limit,
    institution_classroom_count,
    lock_capacity,
    require_classroom_slots,
)


def _managed_classroom_or_404(db: Session, user: User, classroom_id: int) -> Classroom:
    """Grupo que el usuario puede administrar (404/403 en otro caso)."""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada")
    if not can_manage_classroom(user, classroom):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta clase")
    return classroom


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
    - Un Super Profesor de la MISMA institución que el profesor del grupo.
    - Un Administrador.
    """

    if classroom.teacher_id == current_user.id:
        return True

    if current_user.role == UserRole.ADMIN.value:
        return True

    if current_user.role == UserRole.SUPER_PROFESOR.value:
        # Antes cualquier Súper Profesor podía ver o gestionar grupos de
        # otras instituciones (incluido su código de invitación).
        teacher = classroom.teacher
        return (
            teacher is not None
            and current_user.institution_id is not None
            and teacher.institution_id == current_user.institution_id
        )

    return False


def classroom_response(
    classroom: Classroom,
    student_count: int = 0,
    avg: Optional[float] = None,
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
        competency=classroom_competency(classroom),
        grade=classroom.grade,
        invite_code=classroom.invite_code,
        is_active=classroom.is_active,
        max_students=effective_classroom_limit(classroom),
        color=getattr(
            classroom,
            "color",
            "#2E6FDB",
        ) or "#2E6FDB",
        student_count=student_count,
        avg=avg,
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
def create_classroom(
    request: ClassroomCreate,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Crear una nueva clase."""

    require_teacher(current_user)

    institution_id = current_user.institution_id
    if not institution_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tu cuenta no tiene una institución asignada.",
        )
    lock_capacity(db, "institution", institution_id)
    if institution_classroom_count(db, institution_id) >= MAX_CLASSROOMS_PER_INSTITUTION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La institución admite como máximo {MAX_CLASSROOMS_PER_INSTITUTION} aulas.",
        )

    # --------------------------------------------------------
    # Crear clase
    # --------------------------------------------------------

    classroom = Classroom(
        teacher_id=current_user.id,
        name=request.name,
        description=request.description,
        subject=request.subject,
        competency=valid_key(request.competency) or from_subject(request.subject),
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
def list_my_classrooms(
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
        .join(User, User.id == Enrollment.student_id)
        .filter(
            Enrollment.classroom_id.in_(classroom_ids),
            Enrollment.is_active == True,
            User.is_active == True,
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

    # Promedio 0-10 de los estudiantes con sesiones; None = sin datos.
    avg_rows = (
        db.query(
            Enrollment.classroom_id,
            func.avg(Enrollment.average_score),
        )
        .join(User, User.id == Enrollment.student_id)
        .filter(
            User.is_active == True,
            Enrollment.classroom_id.in_(classroom_ids),
            Enrollment.is_active == True,
            Enrollment.total_sessions > 0,
        )
        .group_by(Enrollment.classroom_id)
        .all()
    )
    avg_map = {
        classroom_id: round(float(value) / 10, 1)
        for classroom_id, value in avg_rows
        if value is not None
    }

    result = [
        classroom_response(
            classroom,
            counts_map.get(
                classroom.id,
                0,
            ),
            avg_map.get(classroom.id),
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
def list_enrolled_classrooms(
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
def get_classroom(
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
def get_student_classroom_detail(
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
                    ExpertBot.id.in_(bot_ids),
                    # Un bot desactivado no se puede usar en el chat.
                    ExpertBot.is_active == True,
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
        max_students=effective_classroom_limit(classroom),
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
def delete_classroom(
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
def join_classroom(
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

    # Solo grupos de la propia institución: un código filtrado de otro
    # colegio responde igual que un código inexistente.
    if classroom is not None:
        teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
        if (
            teacher is None
            or not current_user.institution_id
            or teacher.institution_id != current_user.institution_id
        ):
            classroom = None

    if not classroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Código de invitación no válido",
        )

    lock_capacity(db, "institution", current_user.institution_id)

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

        # Retirado por el profesor: la relación quedó revocada y ningún código
        # (ni el anterior ni uno regenerado) la reabre. Solo vuelve si el
        # profesor lo reincorpora (POST .../students/{id}/reinstate).
        if existing.removed_at is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=("Tu profesor te retiró de este grupo. Para volver, pídele "
                        "que te reincorpore desde su lista de estudiantes."),
            )

        require_classroom_slots(db, classroom)

        from app.services import neurobot_service
        bots_before = neurobot_service.bot_ids_of_student(db, current_user.id)
        existing.is_active = True
        existing.removed_at = None
        existing.removed_by = None
        existing.removed_invite_code = None

        try:
            db.flush()
            EnrollmentTrackingService.recompute(db, existing)
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

    require_classroom_slots(db, classroom)

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
        # Su práctica de la competencia del grupo cuenta desde ya
        # (quiz_counts_for_group), igual que en los reportes.
        EnrollmentTrackingService.recompute(db, enrollment)
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
def list_students(
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
def remove_student(
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

    # Se revoca la relación; no se borra nada (intentos, quizzes, chats y
    # resultados anteriores se conservan). Ningún código lo vuelve a inscribir
    # (ver join_classroom); se guarda el código vigente como registro.
    enrollment.is_active = False
    enrollment.removed_at = datetime.utcnow()
    enrollment.removed_by = current_user.id
    enrollment.removed_invite_code = classroom.invite_code

    try:
        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No fue posible remover al estudiante",
        )

    return {
        "message": "Estudiante retirado del grupo"
    }


@router.get(
    "/{classroom_id}/removed-students"
)
def list_removed_students(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Estudiantes retirados del grupo por un profesor (para reincorporarlos)."""

    require_teacher(current_user)
    classroom = _managed_classroom_or_404(db, current_user, classroom_id)

    rows = (
        db.query(Enrollment, User)
        .join(User, User.id == Enrollment.student_id)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.is_active == False,  # noqa: E712
            Enrollment.removed_at.isnot(None),
        )
        .order_by(Enrollment.removed_at.desc())
        .all()
    )
    return [
        {
            "student_id": user.id,
            "student_name": user.full_name or user.username,
            "student_email": user.email,
            "removed_at": enrollment.removed_at.isoformat() if enrollment.removed_at else None,
        }
        for enrollment, user in rows
    ]


@router.post(
    "/{classroom_id}/students/{student_id}/reinstate"
)
def reinstate_student(
    classroom_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Reincorporación autorizada por el profesor de un estudiante retirado."""

    require_teacher(current_user)
    classroom = _managed_classroom_or_404(db, current_user, classroom_id)
    institution_id = current_user.institution_id
    if not institution_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Tu cuenta no tiene una institución asignada.")
    lock_capacity(db, "institution", institution_id)
    if not classroom.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="El grupo está desactivado")

    enrollment = (
        db.query(Enrollment)
        .filter(
            Enrollment.classroom_id == classroom.id,
            Enrollment.student_id == student_id,
            Enrollment.is_active == False,  # noqa: E712
            Enrollment.removed_at.isnot(None),
        )
        .first()
    )
    if not enrollment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="El estudiante no está retirado de este grupo")

    student = db.query(User).filter(
        User.id == student_id,
        User.institution_id == institution_id,
        User.role == UserRole.ESTUDIANTE.value,
        User.is_active == True,  # noqa: E712
    ).first()
    if student is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="La cuenta del estudiante está desactivada")

    require_classroom_slots(db, classroom)

    from app.services import neurobot_service
    bots_before = neurobot_service.bot_ids_of_student(db, student.id)
    enrollment.is_active = True
    enrollment.removed_at = None
    enrollment.removed_by = None
    enrollment.removed_invite_code = None
    try:
        db.flush()
        EnrollmentTrackingService.recompute(db, enrollment)
        neurobot_service.notify_new_member(db, student, classroom, bots_before)
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                            detail="No fue posible reincorporar al estudiante")

    return {"message": "Estudiante reincorporado al grupo"}


# ============================================================
# ASIGNACIÓN DE BOTS
# ============================================================

@router.post(
    "/{classroom_id}/bots"
)
def assign_bot_to_classroom(
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
def list_available_bots(
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
def list_classroom_bots(
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
def remove_bot_from_classroom(
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
def get_classroom_stats(
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
def get_student_progress(
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
def get_classroom_alerts(
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
            for user in db.query(User).filter(
                User.id.in_(student_ids),
                User.is_active == True,  # noqa: E712
            ).all()
        }
        if student_ids
        else {}
    )

    alerts = _classroom_alerts(enrollments, students_by_id)
    acks = neuroalert_service.acknowledged(db, current_user.id, [a["id"] for a in alerts])
    for a in alerts:
        a["resolved"] = neuroalert_service.is_resolved(acks, {"key": a["id"], "signature": a.pop("signature")})

    return {
        "alerts": alerts,
        "total": len(alerts),
        "classroom": classroom.name,
    }


_TEACHER_ALERT_TYPE = {
    "inactividad": "inactivity",
    "sin_inicio": "never_started",
    "bajo_rendimiento": "low_performance",
    "riesgo_cognitivo": "cognitive_risk",
}


def _classroom_alerts(enrollments, students_by_id) -> list[dict]:
    """Alertas del aula con las reglas comunes (app/services/neuroalert_service.py)."""
    now = datetime.utcnow()
    alerts = []
    for enrollment in enrollments:
        student = students_by_id.get(enrollment.student_id)
        if not student:
            continue
        name = student.full_name or student.username
        sessions = int(enrollment.total_sessions or 0)
        for a in neuroalert_service.enrollment_alerts(enrollment, now):
            if a["type"] == "inactividad":
                message = f"Sin actividad desde hace {a['days_inactive']} días"
            elif a["type"] == "sin_inicio":
                message = "Nunca ha iniciado una sesión"
            elif a["type"] == "bajo_rendimiento":
                message = f"Promedio muy bajo: {float(enrollment.average_score or 0):.0f}%"
            else:
                message = "Riesgo cognitivo: " + ", ".join(enrollment.risk_factors or ["detectado"])
            alerts.append({
                "id": a["key"],
                "signature": a["signature"],
                "type": _TEACHER_ALERT_TYPE[a["type"]],
                "severity": a["severity"],
                "student": name,
                "student_id": student.id,
                "message": message,
                # Promedio 0-100 de la inscripción; None si aún no hay sesiones.
                "average_score": round(float(enrollment.average_score or 0), 1) if sessions > 0 else None,
                "total_sessions": sessions,
                "total_time_minutes": round(float(enrollment.total_time_minutes or 0)),
                "last_activity": enrollment.last_activity.isoformat() if enrollment.last_activity else None,
                "risk_factors": enrollment.risk_factors or [],
            })
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda alert: (severity_order.get(alert["severity"], 3), alert["student"]))
    return alerts


def _managed_classroom(db: Session, current_user: User, classroom_id: int) -> Classroom:
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Clase no encontrada")
    if not can_manage_classroom(current_user, classroom):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes acceso a esta clase")
    return classroom


@router.post("/{classroom_id}/alerts/{alert_id}/resolve")
def resolve_classroom_alert(
    classroom_id: int,
    alert_id: str,
    resolved: bool = True,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Marca (o reabre con resolved=false) una alerta vigente del aula."""
    require_teacher(current_user)
    classroom = _managed_classroom(db, current_user, classroom_id)
    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom.id,
        Enrollment.is_active == True,  # noqa: E712
    ).all()
    students = {u.id: u for u in db.query(User).filter(
        User.id.in_([e.student_id for e in enrollments]),
        User.is_active == True,  # noqa: E712
    ).all()} if enrollments else {}
    alert = next((a for a in _classroom_alerts(enrollments, students) if a["id"] == alert_id), None)
    if alert is None:
        raise HTTPException(status_code=404, detail="La alerta ya no está vigente.")
    neuroalert_service.set_resolved(db, current_user.id, {"key": alert["id"], "signature": alert["signature"]}, resolved)
    db.commit()
    return {"id": alert_id, "resolved": resolved}


@router.post("/{classroom_id}/regenerate-code")
def regenerate_invite_code(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_AULAS)),
    db: Session = Depends(get_db),
):
    """Nuevo código de invitación (RF-39); el anterior deja de servir para unirse."""
    require_teacher(current_user)
    classroom = _managed_classroom(db, current_user, classroom_id)
    if not classroom.is_active:
        raise HTTPException(status_code=400, detail="La clase está desactivada.")
    for _ in range(10):
        code = Classroom.generate_invite_code()
        if not db.query(Classroom.id).filter(Classroom.invite_code == code).first():
            break
    else:
        raise HTTPException(status_code=500, detail="No fue posible generar un código único.")
    classroom.invite_code = code
    db.commit()
    return {"id": classroom.id, "invite_code": code}


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
