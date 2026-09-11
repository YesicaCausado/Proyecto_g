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
from app.services.license_service import get_license, require_active_license, require_student_module, require_teacher_module, LicenseInfo
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


# ===== UTILIDADES =====

def require_teacher(user: User):
    """Verifica que el usuario sea profesor o super_profesor"""
    if user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value, "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los profesores pueden realizar esta acción",
        )


def require_student(user: User):
    """Verifica que el usuario sea estudiante"""
    if user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo los estudiantes pueden realizar esta acción",
        )


# ===== GESTIÓN DE CLASES (PROFESOR) =====

@router.post("/", response_model=ClassroomResponse, status_code=status.HTTP_201_CREATED)
async def create_classroom(
    request: ClassroomCreate,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Crear una nueva clase (solo profesores)"""
    require_teacher(current_user)

    total_classes = db.query(Classroom).filter(
        Classroom.teacher_id == current_user.id,
        Classroom.is_active == True,
    ).count()
    if total_classes >= license_info.groups_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Has alcanzado el límite de {license_info.groups_limit} grupos para tu plan ({license_info.license_type}).",
        )

    classroom = Classroom(
        teacher_id=current_user.id,
        name=request.name,
        description=request.description,
        subject=request.subject,
        grade=request.grade,
        max_students=request.max_students,
        color=getattr(request, 'color', '#2E6FDB'),
        invite_code=Classroom.generate_invite_code(),
    )
    db.add(classroom)
    db.commit()
    db.refresh(classroom)

    return ClassroomResponse(
        id=classroom.id,
        teacher_id=classroom.teacher_id,
        name=classroom.name,
        description=classroom.description,
        subject=classroom.subject,
        grade=classroom.grade,
        invite_code=classroom.invite_code,
        is_active=classroom.is_active,
        max_students=classroom.max_students,
        color=classroom.color or '#2E6FDB',
        student_count=0,
        created_at=classroom.created_at,
    )


@router.get("/my-classes", response_model=ClassroomListResponse)
async def list_my_classrooms(
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    db: Session = Depends(get_db),
):
    """Listar las clases del profesor actual"""
    require_teacher(current_user)
    # Obtener todas las clases del profesor en una sola consulta
    classrooms = db.query(Classroom).filter(
        Classroom.teacher_id == current_user.id,
        Classroom.is_active == True,
    ).all()

    # Si no hay clases, responder rápido
    if not classrooms:
        return ClassroomListResponse(classrooms=[], total=0)

    # Obtener contadores de estudiantes por classroom_id en una sola consulta
    classroom_ids = [c.id for c in classrooms]
    counts = db.query(Enrollment.classroom_id, func.count(Enrollment.id).label("cnt")).filter(
        Enrollment.classroom_id.in_(classroom_ids),
        Enrollment.is_active == True,
    ).group_by(Enrollment.classroom_id).all()

    counts_map = {cid: cnt for (cid, cnt) in counts}

    result = []
    for c in classrooms:
        student_count = counts_map.get(c.id, 0)
        result.append(ClassroomResponse(
            id=c.id,
            teacher_id=c.teacher_id,
            name=c.name,
            description=c.description,
            subject=c.subject,
            grade=c.grade,
            invite_code=c.invite_code,
            is_active=c.is_active,
            max_students=c.max_students,
            color=getattr(c, 'color', '#2E6FDB') or '#2E6FDB',
            student_count=student_count,
            created_at=c.created_at,
        ))

    return ClassroomListResponse(classrooms=result, total=len(result))


@router.get("/my-enrolled", response_model=ClassroomListResponse)
async def list_enrolled_classrooms(
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_student_module("mis_cursos")),
    db: Session = Depends(get_db),
):
    """Listar las clases en las que está inscrito el estudiante actual"""
    require_student(current_user)

    enrollments = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.is_active == True,
    ).all()

    if not enrollments:
        return ClassroomListResponse(classrooms=[], total=0)

    classroom_ids = [e.classroom_id for e in enrollments]

    # 1 sola consulta para las clases activas (en lugar de 1 por inscripción)
    classrooms = db.query(Classroom).filter(
        Classroom.id.in_(classroom_ids),
        Classroom.is_active == True,
    ).all()
    classrooms_by_id = {c.id: c for c in classrooms}

    # 1 sola consulta para los contadores de estudiantes de todas las clases
    counts = db.query(
        Enrollment.classroom_id, func.count(Enrollment.id).label("cnt")
    ).filter(
        Enrollment.classroom_id.in_(classroom_ids),
        Enrollment.is_active == True,
    ).group_by(Enrollment.classroom_id).all()
    counts_map = {cid: cnt for (cid, cnt) in counts}

    result = []
    for e in enrollments:
        c = classrooms_by_id.get(e.classroom_id)
        if c is None:
            continue
        result.append(ClassroomResponse(
            id=c.id,
            teacher_id=c.teacher_id,
            name=c.name,
            description=c.description,
            subject=c.subject,
            grade=c.grade,
            invite_code=c.invite_code,
            is_active=c.is_active,
            max_students=c.max_students,
            color=getattr(c, 'color', '#2E6FDB') or '#2E6FDB',
            student_count=counts_map.get(c.id, 0),
            created_at=c.created_at,
        ))

    return ClassroomListResponse(classrooms=result, total=len(result))


@router.get("/{classroom_id}", response_model=ClassroomResponse)
async def get_classroom(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """Obtener detalle de una clase"""
    classroom = db.query(Classroom).filter(Classroom.id == classroom_id).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    # Verificar acceso: profesor dueño o estudiante inscrito
    if classroom.teacher_id != current_user.id:
        if current_user.role == UserRole.ESTUDIANTE.value and not license_info.has_student_module("mis_cursos"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"El módulo 'mis_cursos' no está disponible en tu licencia ({license_info.license_type}).",
            )
        enrollment = db.query(Enrollment).filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        ).first()
        if not enrollment:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta clase")

    student_count = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom.id,
        Enrollment.is_active == True,
    ).count()

    return ClassroomResponse(
        id=classroom.id,
        teacher_id=classroom.teacher_id,
        name=classroom.name,
        description=classroom.description,
        subject=classroom.subject,
        grade=classroom.grade,
        invite_code=classroom.invite_code,
        is_active=classroom.is_active,
        max_students=classroom.max_students,
        student_count=student_count,
        created_at=classroom.created_at,
    )


@router.get("/{classroom_id}/student-detail", response_model=ClassroomStudentDetailResponse)
async def get_student_classroom_detail(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(get_license),
    db: Session = Depends(get_db),
):
    """Detalle de una clase para el estudiante inscrito (vista estilo classroom).

    Devuelve información de la clase, el profesor, los bots asignados (tutores)
    y el progreso del propio estudiante en esa clase.
    """
    if current_user.role != UserRole.ESTUDIANTE.value:
        raise HTTPException(status_code=403, detail="Solo los estudiantes pueden ver esta vista")

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.is_active == True,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    enrollment = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.student_id == current_user.id,
        Enrollment.is_active == True,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=403, detail="No estás inscrito en esta clase")

    # Profesor
    teacher = db.query(User).filter(User.id == classroom.teacher_id).first()
    teacher_name = (teacher.full_name or teacher.username) if teacher else ""

    # Número de estudiantes inscritos
    student_count = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom.id,
        Enrollment.is_active == True,
    ).count()

    # Bots asignados como tutores
    assignments = db.query(ClassroomBot).filter(
        ClassroomBot.classroom_id == classroom_id,
    ).order_by(ClassroomBot.order_index).all()

    bots = []
    if assignments:
        bot_ids = [a.bot_id for a in assignments]
        # 1 sola consulta para todos los bots (en lugar de 1 por bot)
        bot_map = {
            b.id: b
            for b in db.query(ExpertBot).filter(ExpertBot.id.in_(bot_ids)).all()
        }
        for a in assignments:
            bot = bot_map.get(a.bot_id)
            if bot:
                bots.append(ClassroomBotResponse(
                    bot_id=bot.id,
                    name=bot.name,
                    description=bot.description or "",
                    category=bot.category,
                    is_required=a.is_required,
                    order_index=a.order_index,
                ))

    return ClassroomStudentDetailResponse(
        id=classroom.id,
        name=classroom.name,
        description=classroom.description,
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


@router.delete("/{classroom_id}")
async def delete_classroom(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Desactivar una clase (solo el profesor dueño)"""
    require_teacher(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    classroom.is_active = False
    db.commit()
    return {"message": f"Clase '{classroom.name}' desactivada"}


# ===== INSCRIPCIÓN DE ESTUDIANTES =====

@router.post("/join", response_model=EnrollmentResponse)
async def join_classroom(
    request: EnrollByCodeRequest,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_student_module("mis_cursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Inscribirse en una clase con código de invitación (solo estudiantes)"""
    require_student(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.invite_code == request.invite_code.upper(),
        Classroom.is_active == True,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Código de invitación no válido")

    # Verificar si ya está inscrito
    existing = db.query(Enrollment).filter(
        Enrollment.student_id == current_user.id,
        Enrollment.classroom_id == classroom.id,
    ).first()
    if existing:
        if existing.is_active:
            raise HTTPException(status_code=400, detail="Ya estás inscrito en esta clase")
        existing.is_active = True
        db.commit()
        db.refresh(existing)
        return _enrollment_to_response(existing, current_user)

    # Verificar cupo
    current_count = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom.id,
        Enrollment.is_active == True,
    ).count()
    if current_count >= classroom.max_students:
        raise HTTPException(status_code=400, detail="La clase está llena")

    enrollment = Enrollment(
        student_id=current_user.id,
        classroom_id=classroom.id,
    )
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # ── Automatizaciones: "Nuevo estudiante" ────────────────────────────────
    try:
        from app.services import integration_service as _isvc
        _isvc.dispatch_trigger(db, current_user, "nuevo_estudiante", {
            "event_desc": "Nuevo estudiante inscrito",
            "student_id": current_user.id,
            "name": current_user.full_name or current_user.username,
            "classroom_id": classroom.id,
            "classroom_name": classroom.name,
        })
    except Exception:
        db.rollback()

    return _enrollment_to_response(enrollment, current_user)


@router.get("/{classroom_id}/students", response_model=List[EnrollmentResponse])
async def list_students(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    db: Session = Depends(get_db),
):
    """Listar estudiantes inscritos en una clase (solo el profesor dueño)"""
    require_teacher(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.is_active == True,
    ).all()

    result = []
    if enrollments:
        student_ids = [e.student_id for e in enrollments]
        # 1 sola consulta para todos los estudiantes (en lugar de 1 por estudiante)
        students_by_id = {
            u.id: u
            for u in db.query(User).filter(User.id.in_(student_ids)).all()
        }
        for e in enrollments:
            result.append(_enrollment_to_response(e, students_by_id.get(e.student_id)))

    return result


@router.delete("/{classroom_id}/students/{student_id}")
async def remove_student(
    classroom_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Remover un estudiante de la clase (solo el profesor)"""
    require_teacher(current_user)

    enrollment = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.student_id == student_id,
        Enrollment.is_active == True,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado en la clase")

    enrollment.is_active = False
    db.commit()
    return {"message": "Estudiante removido de la clase"}


# ===== ASIGNACIÓN DE BOTS =====

@router.post("/{classroom_id}/bots")
async def assign_bot_to_classroom(
    classroom_id: int,
    request: AssignBotRequest,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("neurobots")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Asignar un bot a la clase (solo el profesor dueño)"""
    require_teacher(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    bot = db.query(ExpertBot).filter(ExpertBot.id == request.bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")

    # Verificar que no esté ya asignado
    existing = db.query(ClassroomBot).filter(
        ClassroomBot.classroom_id == classroom_id,
        ClassroomBot.bot_id == request.bot_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Este bot ya está asignado a la clase")

    assignment = ClassroomBot(
        classroom_id=classroom_id,
        bot_id=request.bot_id,
        is_required=request.is_required,
        order_index=request.order_index,
    )
    db.add(assignment)
    db.commit()

    return {"message": f"Bot '{bot.name}' asignado a la clase '{classroom.name}'"}


@router.get("/{classroom_id}/available-bots")
async def list_available_bots(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("neurobots")),
    db: Session = Depends(get_db),
):
    """Lista los bots del profesor (aún no asignados a esta clase) elegibles
    para compartir con la clase. Usado por el frontend del profesor para
    mostrar el selector 'Asignar a clase'."""
    require_teacher(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    assigned_ids = set(
        row[0]
        for row in db.query(ClassroomBot.bot_id).filter(
            ClassroomBot.classroom_id == classroom_id
        ).all()
    )

    bots = (
        db.query(ExpertBot)
        .filter(ExpertBot.creator_id == current_user.id)
        .order_by(ExpertBot.created_at.desc())
        .all()
    )

    result = []
    for bot in bots:
        result.append({
            "bot_id": bot.id,
            "name": bot.name,
            "subject": bot.category or "",
            "assigned": bot.id in assigned_ids,
        })

    return {"bots": result, "total": len(result)}


@router.get("/{classroom_id}/bots")
async def list_classroom_bots(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("neurobots")),
    db: Session = Depends(get_db),
):
    """Listar bots asignados a una clase"""
    assignments = db.query(ClassroomBot).filter(
        ClassroomBot.classroom_id == classroom_id,
    ).order_by(ClassroomBot.order_index).all()

    result = []
    if assignments:
        bot_ids = [a.bot_id for a in assignments]
        bot_map = {
            b.id: b
            for b in db.query(ExpertBot).filter(ExpertBot.id.in_(bot_ids)).all()
        }
        for a in assignments:
            bot = bot_map.get(a.bot_id)
            if bot:
                result.append({
                    "bot_id": bot.id,
                    "name": bot.name,
                    "description": bot.description,
                    "category": bot.category,
                    "is_required": a.is_required,
                    "order_index": a.order_index,
                })

    return {"bots": result, "total": len(result)}


@router.delete("/{classroom_id}/bots/{bot_id}")
async def remove_bot_from_classroom(
    classroom_id: int,
    bot_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("neurobots")),
    active_license: LicenseInfo = Depends(require_active_license()),
    db: Session = Depends(get_db),
):
    """Remover un bot de la clase"""
    require_teacher(current_user)

    assignment = db.query(ClassroomBot).filter(
        ClassroomBot.classroom_id == classroom_id,
        ClassroomBot.bot_id == bot_id,
    ).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Bot no asignado a esta clase")

    db.delete(assignment)
    db.commit()
    return {"message": "Bot removido de la clase"}


# ===== DASHBOARD Y REPORTES DEL PROFESOR =====

@router.get("/{classroom_id}/stats", response_model=ClassroomStatsResponse)
async def get_classroom_stats(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    db: Session = Depends(get_db),
):
    """Estadísticas generales de la clase (dashboard del profesor)"""
    require_teacher(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.is_active == True,
    ).all()

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

    # Calcular métricas
    week_ago = datetime.utcnow() - timedelta(days=7)
    active_students = sum(1 for e in enrollments if e.last_activity and e.last_activity > week_ago)
    avg_progress = sum(e.overall_progress for e in enrollments) / total_students
    avg_score = sum(e.average_score for e in enrollments) / total_students
    total_sessions = sum(e.total_sessions for e in enrollments)
    students_at_risk = sum(1 for e in enrollments if e.risk_level in ("medium", "high"))

    # Top performers y estudiantes con dificultades
    # 1 sola consulta para todos los estudiantes (evita N+1 en ambos bucles)
    student_ids = [e.student_id for e in enrollments]
    students_by_id = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(student_ids)).all()
    }

    sorted_by_score = sorted(enrollments, key=lambda e: e.average_score, reverse=True)
    top_performers = []
    for e in sorted_by_score[:5]:
        student = students_by_id.get(e.student_id)
        if student:
            top_performers.append({
                "name": student.full_name or student.username,
                "score": e.average_score,
                "progress": e.overall_progress,
            })

    struggling = []
    for e in enrollments:
        if e.risk_level in ("medium", "high"):
            student = students_by_id.get(e.student_id)
            if student:
                struggling.append({
                    "name": student.full_name or student.username,
                    "risk_level": e.risk_level,
                    "risk_factors": e.risk_factors or [],
                    "progress": e.overall_progress,
                })

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


@router.get("/{classroom_id}/students/{student_id}/progress", response_model=StudentProgressResponse)
async def get_student_progress(
    classroom_id: int,
    student_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    db: Session = Depends(get_db),
):
    """Progreso detallado de un estudiante en la clase"""
    require_teacher(current_user)

    enrollment = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.student_id == student_id,
        Enrollment.is_active == True,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Estudiante no encontrado en la clase")

    student = db.query(User).filter(User.id == student_id).first()

    return StudentProgressResponse(
        student_id=student.id,
        student_name=student.full_name or student.username,
        username=student.username,
        overall_progress=enrollment.overall_progress,
        total_sessions=enrollment.total_sessions,
        total_time_minutes=enrollment.total_time_minutes,
        average_score=enrollment.average_score,
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
        cognitive_profile=student.cognitive_profile,
    )


@router.get("/{classroom_id}/alerts")
async def get_classroom_alerts(
    classroom_id: int,
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("cursos")),
    db: Session = Depends(get_db),
):
    """Alertas de estudiantes en riesgo en la clase"""
    require_teacher(current_user)

    classroom = db.query(Classroom).filter(
        Classroom.id == classroom_id,
        Classroom.teacher_id == current_user.id,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada")

    enrollments = db.query(Enrollment).filter(
        Enrollment.classroom_id == classroom_id,
        Enrollment.is_active == True,
    ).all()

    # 1 sola consulta para todos los estudiantes (evita N+1 en el bucle)
    student_ids = [e.student_id for e in enrollments]
    students_by_id = {
        u.id: u
        for u in db.query(User).filter(User.id.in_(student_ids)).all()
    } if student_ids else {}

    alerts = []
    for e in enrollments:
        student = students_by_id.get(e.student_id)
        if not student:
            continue

        name = student.full_name or student.username

        # Alerta: Sin actividad en 7+ días
        if e.last_activity:
            days_inactive = (datetime.utcnow() - e.last_activity).days
            if days_inactive >= 7:
                alerts.append({
                    "type": "inactivity",
                    "severity": "high" if days_inactive >= 14 else "medium",
                    "student": name,
                    "student_id": student.id,
                    "message": f"Sin actividad desde hace {days_inactive} días",
                })
        elif e.total_sessions == 0:
            alerts.append({
                "type": "never_started",
                "severity": "medium",
                "student": name,
                "student_id": student.id,
                "message": "Nunca ha iniciado una sesión",
            })

        # Alerta: Bajo rendimiento
        if e.total_sessions >= 3 and e.average_score < 40:
            alerts.append({
                "type": "low_performance",
                "severity": "high",
                "student": name,
                "student_id": student.id,
                "message": f"Promedio muy bajo: {e.average_score:.0f}%",
            })

        # Alerta: Riesgo cognitivo (frustración, sobrecarga)
        if e.risk_level in ("medium", "high"):
            alerts.append({
                "type": "cognitive_risk",
                "severity": e.risk_level,
                "student": name,
                "student_id": student.id,
                "message": f"Riesgo cognitivo: {', '.join(e.risk_factors or ['detectado'])}",
            })

    # Ordenar por severidad
    severity_order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: severity_order.get(a["severity"], 3))

    return {"alerts": alerts, "total": len(alerts), "classroom": classroom.name}


# ===== UTILIDADES INTERNAS =====

def _enrollment_to_response(enrollment: Enrollment, student: User) -> EnrollmentResponse:
    """Convierte un enrollment a respuesta"""
    return EnrollmentResponse(
        id=enrollment.id,
        student_id=enrollment.student_id,
        student_name=student.full_name or student.username if student else "",
        student_username=student.username if student else "",
        classroom_id=enrollment.classroom_id,
        enrolled_at=enrollment.enrolled_at,
        overall_progress=enrollment.overall_progress,
        total_sessions=enrollment.total_sessions,
        total_time_minutes=enrollment.total_time_minutes,
        average_score=enrollment.average_score,
        risk_level=enrollment.risk_level,
        last_activity=enrollment.last_activity,
    )
