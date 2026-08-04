"""
NeuroLearn AI - API de Eventos de Calendario

Endpoints:
  GET  /events          - listar eventos de las clases del usuario
  POST /events          - crear evento (solo profesor)
  PUT  /events/{id}     - editar evento (solo profesor dueño)
  DELETE /events/{id}   - eliminar evento (solo profesor dueño)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
from datetime import datetime

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.events import ClassroomEvent

router = APIRouter(prefix="/events", tags=["Calendario - Eventos"])


# ── Schemas internos ─────────────────────────────────────────────────────────

class EventCreate(BaseModel):
    classroom_id: Optional[int] = None   # None = evento global/institucional
    title: str
    event_type: str = "clase"             # examen|tarea|clase|anuncio|evento|feriado
    event_date: str                       # YYYY-MM-DD
    event_time: Optional[str] = None
    description: str = ""

class EventUpdate(BaseModel):
    title: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    description: Optional[str] = None


def _event_to_dict(ev: ClassroomEvent, db: Session) -> dict:
    teacher = db.query(User).filter(User.id == ev.teacher_id).first()
    classroom = db.query(Classroom).filter(Classroom.id == ev.classroom_id).first() if ev.classroom_id else None
    return {
        "id": ev.id,
        "classroom_id": ev.classroom_id,
        "classroom_name": classroom.name if classroom else "Institucional",
        "teacher_id": ev.teacher_id,
        "teacher_name": teacher.full_name or teacher.username if teacher else "Institución",
        "title": ev.title,
        "event_type": ev.event_type,
        "event_date": ev.event_date,
        "event_time": ev.event_time,
        "description": ev.description,
        "created_at": ev.created_at.isoformat(),
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_events(
    classroom_id: Optional[int] = Query(None),
    month: Optional[str]        = Query(None, description="YYYY-MM para filtrar por mes"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve los eventos relevantes para el usuario:
    - Estudiante: eventos de sus clases inscritas + eventos globales (classroom_id NULL).
    - Profesor: eventos de sus propias clases + globales.
    """
    if current_user.role == UserRole.PROFESOR.value:
        my_classrooms = db.query(Classroom).filter(
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        ).all()
        cids = [c.id for c in my_classrooms]
    else:
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]

    # Eventos de las clases del usuario O eventos globales (classroom_id IS NULL)
    from sqlalchemy import or_
    q = db.query(ClassroomEvent).filter(
        ClassroomEvent.is_active == True,
        or_(
            ClassroomEvent.classroom_id.in_(cids),
            ClassroomEvent.classroom_id == None,
        )
    )

    if classroom_id:
        q = db.query(ClassroomEvent).filter(
            ClassroomEvent.is_active == True,
            ClassroomEvent.classroom_id == classroom_id,
        )

    if month:
        q = q.filter(ClassroomEvent.event_date.startswith(month))

    events = q.order_by(ClassroomEvent.event_date).all()
    return {
        "events": [_event_to_dict(e, db) for e in events],
        "total": len(events),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crear un evento en el calendario (solo profesores)."""
    if current_user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
        raise HTTPException(status_code=403, detail="Solo profesores pueden crear eventos")

    # Verificar que la clase le pertenece (si se especificó)
    if body.classroom_id:
        classroom = db.query(Classroom).filter(
            Classroom.id == body.classroom_id,
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        ).first()
        if not classroom:
            raise HTTPException(status_code=404, detail="Clase no encontrada o sin permiso")

    ev = ClassroomEvent(
        classroom_id=body.classroom_id,
        teacher_id=current_user.id,
        title=body.title,
        event_type=body.event_type,
        event_date=body.event_date,
        event_time=body.event_time,
        description=body.description,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _event_to_dict(ev, db)


@router.put("/{event_id}")
async def update_event(
    event_id: int,
    body: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Editar un evento (solo el profesor que lo creó)."""
    if current_user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
        raise HTTPException(status_code=403, detail="Solo profesores pueden editar eventos")

    ev = db.query(ClassroomEvent).filter(
        ClassroomEvent.id == event_id,
        ClassroomEvent.teacher_id == current_user.id,
        ClassroomEvent.is_active == True,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado o sin permiso")

    if body.title is not None:       ev.title = body.title
    if body.event_type is not None:  ev.event_type = body.event_type
    if body.event_date is not None:  ev.event_date = body.event_date
    if body.event_time is not None:  ev.event_time = body.event_time
    if body.description is not None: ev.description = body.description
    ev.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ev)
    return _event_to_dict(ev, db)


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Eliminar un evento (solo el profesor que lo creó)."""
    if current_user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
        raise HTTPException(status_code=403, detail="Solo profesores pueden eliminar eventos")

    ev = db.query(ClassroomEvent).filter(
        ClassroomEvent.id == event_id,
        ClassroomEvent.teacher_id == current_user.id,
        ClassroomEvent.is_active == True,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado o sin permiso")

    ev.is_active = False
    db.commit()
    return {"message": "Evento eliminado"}
