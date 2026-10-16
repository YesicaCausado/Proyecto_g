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
from datetime import datetime, timezone

from app.db.database import get_db
from app.api.auth import get_current_user
from app.core.permissions import FORBIDDEN_MESSAGE, Permission, has_permission
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


def _event_to_dict(ev: ClassroomEvent, db: Session, user: User | None = None) -> dict:
    teacher = db.query(User).filter(User.id == ev.teacher_id).first()
    classroom = db.query(Classroom).filter(Classroom.id == ev.classroom_id).first() if ev.classroom_id else None
    return {
        "id": ev.id,
        "classroom_id": ev.classroom_id,
        "classroom_name": classroom.name if classroom else "Institucional",
        "institution_id": ev.institution_id,
        "teacher_id": ev.teacher_id,
        "teacher_name": teacher.full_name or teacher.username if teacher else "Institución",
        "title": ev.title,
        "event_type": ev.event_type,
        "event_date": ev.event_date,
        "event_time": ev.event_time,
        "description": ev.description,
        "created_at": ev.created_at.isoformat(),
        "is_personal": ev.classroom_id is None and ev.institution_id is None,
        "can_edit": user is not None and _can_edit_event(user, ev),
        "can_delete": user is not None and _can_delete_event(user, ev, db),
    }


def _can_edit_event(user: User, ev: ClassroomEvent) -> bool:
    """Solo el creador puede editar; estudiantes solo eventos personales."""
    if ev.teacher_id != user.id:
        return False
    return user.role in (
        UserRole.PROFESOR.value,
        UserRole.SUPER_PROFESOR.value,
    ) or (user.role == UserRole.ESTUDIANTE.value and ev.classroom_id is None)


def _can_delete_event(user: User, ev: ClassroomEvent, db: Session) -> bool:
    """El creador elimina lo suyo; el super puede eliminar eventos de profesores
    de su institución, pero no eventos personales de estudiantes."""
    if _can_edit_event(user, ev):
        return True
    if user.role != UserRole.SUPER_PROFESOR.value:
        return False
    owner = db.query(User).filter(User.id == ev.teacher_id).first()
    return (
        owner is not None
        and owner.role == UserRole.PROFESOR.value
        and ev.institution_id == getattr(user, "institution_id", None)
    )


def _require_calendar_manager(user: User) -> None:
    """Solo súper profesores y profesores crean, editan o eliminan eventos."""
    if not has_permission(user.role, Permission.GESTIONAR_CALENDARIO):
        raise HTTPException(status_code=403, detail=FORBIDDEN_MESSAGE)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_events(
    classroom_id: Optional[int] = Query(None),
    month: Optional[str]        = Query(None, description="YYYY-MM para filtrar por mes"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve los eventos relevantes para el usuario, siempre acotados a SU
    institución (multi-tenant):
    - Estudiante: eventos de sus clases inscritas + eventos institucionales
      (classroom_id NULL) de su misma institución.
    - Profesor: eventos de sus propias clases + eventos institucionales de su
      institución.
    - Super profesor: todos los eventos de su institución (clases de todos los
      profesores + institucionales).
    """
    inst_id = getattr(current_user, "institution_id", None)


    from sqlalchemy import or_, and_

    # Si se pide una clase concreta, validar acceso y listar solo sus eventos.
    if classroom_id:
        classroom = db.query(Classroom).filter(
            Classroom.id == classroom_id,
            Classroom.is_active == True,
        ).first()
        if not classroom:
            raise HTTPException(status_code=404, detail="Clase no encontrada.")
        # Solo el dueño o estudiantes inscritos pueden ver los eventos de esa clase.
        can_view = classroom.teacher_id == current_user.id
        if not can_view and current_user.role == UserRole.ESTUDIANTE.value:
            can_view = db.query(Enrollment).filter(
                Enrollment.classroom_id == classroom_id,
                Enrollment.student_id == current_user.id,
                Enrollment.is_active == True,
            ).first() is not None
        if not can_view and current_user.role not in (UserRole.SUPER_PROFESOR.value, "admin"):
            raise HTTPException(status_code=403, detail="Sin permiso para ver esta clase.")
        q = db.query(ClassroomEvent).filter(
            ClassroomEvent.is_active == True,
            ClassroomEvent.classroom_id == classroom_id,
        )
        if current_user.role == UserRole.SUPER_PROFESOR.value:
            q = q.filter(ClassroomEvent.teacher_id.in_(
                db.query(User.id).filter(
                    User.institution_id == inst_id,
                    User.role.in_([
                        UserRole.SUPER_PROFESOR.value,
                        UserRole.PROFESOR.value,
                    ]),
                )
            ))
        elif current_user.role == UserRole.PROFESOR.value:
            q = q.filter(or_(
                ClassroomEvent.teacher_id == current_user.id,
                ClassroomEvent.teacher_id.in_(
                    db.query(User.id).filter(
                        User.institution_id == inst_id,
                        User.role == UserRole.SUPER_PROFESOR.value,
                    )
                ),
            ))
        elif current_user.role == UserRole.ESTUDIANTE.value:
            q = q.filter(ClassroomEvent.teacher_id.in_(
                db.query(User.id).filter(
                    User.institution_id == inst_id,
                    User.role.in_([
                        UserRole.SUPER_PROFESOR.value,
                        UserRole.PROFESOR.value,
                    ]),
                )
            ))
        if month:
            q = q.filter(ClassroomEvent.event_date.startswith(month))
        events = q.order_by(ClassroomEvent.event_date).all()
        return {
            "events": [_event_to_dict(e, db, current_user) for e in events],
            "total": len(events),
        }

    # Construir la consulta base siempre acotada a la institución del usuario.
    conditions = [ClassroomEvent.is_active == True]

    if current_user.role == UserRole.SUPER_PROFESOR.value or current_user.role == "admin":
        # El súper ve sus eventos y los publicados por profesores de su
        # institución. Los eventos personales de estudiantes quedan fuera.
        if inst_id is not None:
            conditions.append(or_(
                ClassroomEvent.teacher_id.in_(
                    db.query(User.id).filter(
                        User.institution_id == inst_id,
                        User.role.in_([
                            UserRole.SUPER_PROFESOR.value,
                            UserRole.PROFESOR.value,
                        ]),
                    )
                ),
            ))
        else:
            # Sin institución asociada: solo eventos propios + globales.
            conditions.append(or_(
                ClassroomEvent.teacher_id == current_user.id,
                ClassroomEvent.classroom_id == None,
            ))
    elif current_user.role == UserRole.PROFESOR.value:
        my_classrooms = db.query(Classroom).filter(
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        ).all()
        cids = [c.id for c in my_classrooms]
        cls_cond = ClassroomEvent.classroom_id.in_(cids) if cids else False
        # Solo sus eventos y los eventos institucionales publicados por el
        # Súper Profesor. Los eventos de otros profesores quedan aislados.
        conditions.append(or_(
            and_(
                ClassroomEvent.teacher_id == current_user.id,
                ClassroomEvent.institution_id == inst_id,
            ),
            ClassroomEvent.teacher_id.in_(
                db.query(User.id).filter(
                    User.institution_id == inst_id,
                    User.role == UserRole.SUPER_PROFESOR.value,
                )
            ),
        ))
    else:
        # Estudiante
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]
        cls_cond = ClassroomEvent.classroom_id.in_(cids) if cids else False
        # Eventos de clases inscritas publicados por docentes, eventos
        # institucionales de docentes/súper y su evento personal.
        conditions.append(or_(
            and_(
                ClassroomEvent.teacher_id.in_(
                    db.query(User.id).filter(
                        User.institution_id == inst_id,
                        User.role.in_([
                            UserRole.SUPER_PROFESOR.value,
                            UserRole.PROFESOR.value,
                        ]),
                    )
                ),
                ClassroomEvent.institution_id == inst_id,
            ),
            and_(
                cls_cond,
                ClassroomEvent.teacher_id.in_(
                    db.query(User.id).filter(
                        User.institution_id == inst_id,
                        User.role.in_([
                            UserRole.SUPER_PROFESOR.value,
                            UserRole.PROFESOR.value,
                        ]),
                    )
                ),
            ),
            and_(
                ClassroomEvent.teacher_id == current_user.id,
                ClassroomEvent.classroom_id == None,
                ClassroomEvent.institution_id == None,
            ),
        ))

    q = db.query(ClassroomEvent).filter(*conditions)

    if month:
        q = q.filter(ClassroomEvent.event_date.startswith(month))

    events = q.order_by(ClassroomEvent.event_date).all()
    return {
        "events": [_event_to_dict(e, db, current_user) for e in events],
        "total": len(events),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crear un evento institucional/de clase o uno personal del estudiante."""
    if current_user.role == UserRole.ESTUDIANTE.value:
        if body.classroom_id is not None:
            raise HTTPException(status_code=403, detail="El calendario personal no puede publicar en clases")
    elif current_user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
        raise HTTPException(status_code=403, detail="Rol sin permiso para crear eventos")

    if current_user.role != UserRole.ESTUDIANTE.value:
        _require_calendar_manager(current_user)

    # Verificar que la clase le pertenece (si se especificó).
    if body.classroom_id:
        classroom = db.query(Classroom).filter(
            Classroom.id == body.classroom_id,
            Classroom.is_active == True,
        ).first()
        if not classroom:
            raise HTTPException(status_code=404, detail="Clase no encontrada")
        # El super_profesor puede publicar en cualquier clase de su institución.
        is_owner = classroom.teacher_id == current_user.id
        if not is_owner and current_user.role == UserRole.SUPER_PROFESOR.value:
            is_owner = classroom.teacher.institution_id == getattr(current_user, "institution_id", None)
        if not is_owner:
            raise HTTPException(status_code=403, detail="Clase no encontrada o sin permiso")

    ev = ClassroomEvent(
        classroom_id=body.classroom_id,
        teacher_id=current_user.id,
        institution_id=(
            getattr(current_user, "institution_id", None)
            if current_user.role != UserRole.ESTUDIANTE.value
            else None
        ),
        title=body.title,
        event_type=body.event_type,
        event_date=body.event_date,
        event_time=body.event_time,
        description=body.description,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _event_to_dict(ev, db, current_user)


@router.put("/{event_id}")
async def update_event(
    event_id: int,
    body: EventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Editar solo un evento propio; el estudiante se limita a sus personales."""
    if current_user.role not in (
        UserRole.PROFESOR.value,
        UserRole.SUPER_PROFESOR.value,
        UserRole.ESTUDIANTE.value,
    ):
        raise HTTPException(status_code=403, detail="Rol sin permiso para editar eventos")

    ev = db.query(ClassroomEvent).filter(
        ClassroomEvent.id == event_id,
        ClassroomEvent.is_active == True,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not _can_edit_event(current_user, ev):
        raise HTTPException(status_code=403, detail="No puedes editar este evento")

    if current_user.role != UserRole.ESTUDIANTE.value:
        _require_calendar_manager(current_user)

    if body.title is not None:       ev.title = body.title
    if body.event_type is not None:  ev.event_type = body.event_type
    if body.event_date is not None:  ev.event_date = body.event_date
    if body.event_time is not None:  ev.event_time = body.event_time
    if body.description is not None: ev.description = body.description
    ev.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(ev)
    return _event_to_dict(ev, db, current_user)


@router.delete("/{event_id}")
async def delete_event(
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Eliminar un evento propio o, para el súper, un evento de un profesor."""
    if current_user.role not in (
        UserRole.PROFESOR.value,
        UserRole.SUPER_PROFESOR.value,
        UserRole.ESTUDIANTE.value,
    ):
        raise HTTPException(status_code=403, detail="Rol sin permiso para eliminar eventos")

    ev = db.query(ClassroomEvent).filter(
        ClassroomEvent.id == event_id,
        ClassroomEvent.is_active == True,
    ).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    if not _can_delete_event(current_user, ev, db):
        raise HTTPException(status_code=403, detail="No puedes eliminar este evento")

    if current_user.role != UserRole.ESTUDIANTE.value:
        _require_calendar_manager(current_user)

    ev.is_active = False
    db.commit()
    return {"message": "Evento eliminado"}