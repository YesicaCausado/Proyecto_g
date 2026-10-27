"""Server-side capacity limits and transaction-safe capacity accounting."""
from __future__ import annotations

import threading
from typing import Dict, Tuple

from fastapi import HTTPException
from sqlalchemy import event, func, text
from sqlalchemy.orm import Session

from app.models.classroom import Classroom, Enrollment
from app.models.institution import Institution
from app.models.user import User, UserRole

MAX_ACTIVE_INSTITUTIONS = 40
MAX_CLASSROOMS_PER_INSTITUTION = 8
MAX_STUDENTS_PER_CLASSROOM = 200
MAX_STUDENTS_PER_INSTITUTION = (
    MAX_CLASSROOMS_PER_INSTITUTION * MAX_STUDENTS_PER_CLASSROOM
)
MAX_STUDENTS_PLATFORM = MAX_ACTIVE_INSTITUTIONS * MAX_STUDENTS_PER_INSTITUTION

_LOCK_NAMESPACE = 1313623372
_LOCAL_LOCKS: Dict[Tuple[str, int], threading.Lock] = {}
_LOCAL_LOCKS_GUARD = threading.Lock()
_SESSION_LOCKS_KEY = "_neurolearn_capacity_locks"


@event.listens_for(Session, "after_transaction_end")
def _release_local_locks(session: Session, transaction) -> None:
    if transaction.parent is not None:
        return
    locks = session.info.pop(_SESSION_LOCKS_KEY, {})
    for lock in reversed(list(locks.values())):
        lock.release()


def lock_capacity(db: Session, scope: str, resource_id: int = 0) -> None:
    """Serialize capacity-changing work until this transaction commits/rolls back."""
    lock_key = (scope, resource_id)
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        scope_id = 1 if scope == "platform" else 2
        db.execute(
            text("SELECT pg_advisory_xact_lock(:namespace, :lock_key)"),
            {"namespace": _LOCK_NAMESPACE + scope_id, "lock_key": resource_id},
        )
        return

    held = db.info.setdefault(_SESSION_LOCKS_KEY, {})
    if lock_key in held:
        return
    with _LOCAL_LOCKS_GUARD:
        lock = _LOCAL_LOCKS.setdefault(lock_key, threading.Lock())
    lock.acquire()
    held[lock_key] = lock


def active_institution_count(db: Session) -> int:
    return int(
        db.query(func.count(Institution.id))
        .filter(Institution.is_active.is_(True))
        .scalar()
        or 0
    )


def institution_classroom_count(db: Session, institution_id: int) -> int:
    return int(
        db.query(func.count(Classroom.id))
        .join(User, User.id == Classroom.teacher_id)
        .filter(User.institution_id == institution_id)
        .scalar()
        or 0
    )


def institution_student_count(db: Session, institution_id: int) -> int:
    return int(
        db.query(func.count(User.id))
        .filter(
            User.institution_id == institution_id,
            User.role == UserRole.ESTUDIANTE.value,
            User.is_active.is_(True),
        )
        .scalar()
        or 0
    )


def platform_student_count(db: Session) -> int:
    return int(
        db.query(func.count(User.id))
        .filter(
            User.role == UserRole.ESTUDIANTE.value,
            User.is_active.is_(True),
        )
        .scalar()
        or 0
    )


def classroom_student_count(db: Session, classroom_id: int) -> int:
    return int(
        db.query(func.count(Enrollment.id))
        .join(User, User.id == Enrollment.student_id)
        .filter(
            Enrollment.classroom_id == classroom_id,
            Enrollment.is_active.is_(True),
            User.role == UserRole.ESTUDIANTE.value,
            User.is_active.is_(True),
        )
        .scalar()
        or 0
    )


def effective_classroom_limit(classroom: Classroom) -> int:
    configured = classroom.max_students
    if configured is None:
        return min(40, MAX_STUDENTS_PER_CLASSROOM)
    return max(0, min(int(configured), MAX_STUDENTS_PER_CLASSROOM))


def require_institution_slots(db: Session, institution_id: int, requested: int = 1) -> None:
    used = institution_student_count(db, institution_id)
    if used + requested > MAX_STUDENTS_PER_INSTITUTION:
        available = max(0, MAX_STUDENTS_PER_INSTITUTION - used)
        raise HTTPException(
            status_code=409,
            detail=(
                f"La institución alcanzó su capacidad máxima de "
                f"{MAX_STUDENTS_PER_INSTITUTION} estudiantes; "
                f"quedan {available} cupos disponibles."
            ),
        )


def require_student_capacity(db: Session, institution_id: int, requested: int = 1) -> None:
    lock_capacity(db, "platform")
    require_institution_slots(db, institution_id, requested)
    used = platform_student_count(db)
    if used + requested > MAX_STUDENTS_PLATFORM:
        available = max(0, MAX_STUDENTS_PLATFORM - used)
        raise HTTPException(
            status_code=409,
            detail=(
                f"La plataforma alcanzó su capacidad máxima de {MAX_STUDENTS_PLATFORM} estudiantes; "
                f"quedan {available} cupos disponibles. No se creó ningún registro."
            ),
        )


def require_classroom_slots(db: Session, classroom: Classroom, requested: int = 1) -> None:
    used = classroom_student_count(db, classroom.id)
    limit = effective_classroom_limit(classroom)
    if used + requested > limit:
        available = max(0, limit - used)
        raise HTTPException(
            status_code=409,
            detail=(
                f"El aula «{classroom.name}» admite como máximo {limit} estudiantes; "
                f"quedan {available} cupos disponibles."
            ),
        )


def require_existing_enrollment_capacity(db: Session, student_id: int) -> None:
    classrooms = (
        db.query(Classroom)
        .join(Enrollment, Enrollment.classroom_id == Classroom.id)
        .filter(
            Enrollment.student_id == student_id,
            Enrollment.is_active.is_(True),
        )
        .all()
    )
    for classroom in classrooms:
        require_classroom_slots(db, classroom)


def institution_capacity_snapshot(db: Session, institution_id: int) -> dict:
    classrooms = institution_classroom_count(db, institution_id)
    students = institution_student_count(db, institution_id)
    return {
        "institution_id": institution_id,
        "classrooms_used": classrooms,
        "classrooms_limit": MAX_CLASSROOMS_PER_INSTITUTION,
        "classrooms_available": max(0, MAX_CLASSROOMS_PER_INSTITUTION - classrooms),
        "students_used": students,
        "students_limit": MAX_STUDENTS_PER_INSTITUTION,
        "students_available": max(0, MAX_STUDENTS_PER_INSTITUTION - students),
        "students_per_classroom_limit": MAX_STUDENTS_PER_CLASSROOM,
    }


def classroom_capacity_snapshot(db: Session, classroom: Classroom) -> dict:
    used = classroom_student_count(db, classroom.id)
    limit = effective_classroom_limit(classroom)
    return {
        "classroom_id": classroom.id,
        "students_used": used,
        "students_limit": limit,
        "students_available": max(0, limit - used),
    }
