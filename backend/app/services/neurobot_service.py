"""
NeuroLearn IA — Asignación de NeuroBots, progreso del estudiante y resultados.

Reutiliza la arquitectura existente:

* `classroom_bots` (asignación por aula, ahora con meta y profesor que asigna)
  y `student_bot_assignments` (asignación individual) dicen QUÉ bots tiene
  cada estudiante;
* `neurobot_progress` guarda su avance real; las interacciones se cuentan en
  el chat (app/api/chat.py) cuando el NeuroBot responde con IA.

Estados (derivados de datos guardados, nunca inventados):

    asignado     sin fila de progreso
    iniciado     abrió el chat con el bot
    en_progreso  al menos una interacción
    completado   alcanzó la meta de interacciones del profesor

Meta efectiva cuando el bot le llega por varias vías: la de la asignación
individual si existe; si no, la mayor de las asignaciones por aula.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Set

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.classroom import Classroom, ClassroomBot, Enrollment
from app.models.expert_bot import ExpertBot
from app.models.neurobot_assignment import NeuroBotProgress, StudentBotAssignment
from app.models.user import User, UserRole
from app.services import notification_service as notif

logger = logging.getLogger(__name__)

DEFAULT_GOAL_INTERACTIONS = 10
MIN_GOAL_INTERACTIONS = 1
MAX_GOAL_INTERACTIONS = 200

STATUS_LABELS = {
    "asignado": "Asignado",
    "iniciado": "Iniciado",
    "en_progreso": "En progreso",
    "completado": "Completado",
}


class NeuroBotError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def display_name(user: Optional[User]) -> str:
    if user is None:
        return ""
    return user.full_name or user.username


def validate_goal(goal) -> int:
    try:
        value = int(goal)
    except (TypeError, ValueError):
        raise NeuroBotError("La meta debe ser un número entero de interacciones.", 422)
    if not MIN_GOAL_INTERACTIONS <= value <= MAX_GOAL_INTERACTIONS:
        raise NeuroBotError(
            f"La meta debe estar entre {MIN_GOAL_INTERACTIONS} y {MAX_GOAL_INTERACTIONS} interacciones.", 422)
    return value


# ═════════════════════════════════════════════════════════════════════════════
# Qué bots tiene asignados un estudiante
# ═════════════════════════════════════════════════════════════════════════════

def _assignments_for_students(db: Session, student_ids: Iterable[int],
                              bot_ids: Optional[Iterable[int]] = None) -> Dict[tuple, dict]:
    """{(student_id, bot_id): {goal, sources, teacher_ids, assigned_at}}"""
    student_ids = list({int(s) for s in student_ids})
    out: Dict[tuple, dict] = {}
    if not student_ids:
        return out
    bot_filter = list(bot_ids) if bot_ids is not None else None

    q = (db.query(Enrollment.student_id, ClassroomBot, Classroom)
         .join(ClassroomBot, ClassroomBot.classroom_id == Enrollment.classroom_id)
         .join(Classroom, Classroom.id == Enrollment.classroom_id)
         .filter(Enrollment.student_id.in_(student_ids),
                 Enrollment.is_active == True,  # noqa: E712
                 Classroom.is_active == True))  # noqa: E712
    if bot_filter is not None:
        q = q.filter(ClassroomBot.bot_id.in_(bot_filter))
    for student_id, cb, classroom in q.all():
        entry = out.setdefault((student_id, cb.bot_id), {
            "classroom_goals": [], "individual_goal": None, "sources": [],
            "teacher_ids": set(), "assigned_at": cb.assigned_at, "is_required": False})
        entry["classroom_goals"].append(cb.goal_interactions or DEFAULT_GOAL_INTERACTIONS)
        teacher_id = cb.assigned_by_id or classroom.teacher_id
        entry["teacher_ids"].add(teacher_id)
        entry["is_required"] = entry["is_required"] or bool(cb.is_required)
        entry["sources"].append({"type": "aula", "classroom_id": classroom.id,
                                 "classroom_name": classroom.name, "teacher_id": teacher_id})
        if cb.assigned_at and (entry["assigned_at"] is None or cb.assigned_at < entry["assigned_at"]):
            entry["assigned_at"] = cb.assigned_at

    q = db.query(StudentBotAssignment).filter(StudentBotAssignment.student_id.in_(student_ids))
    if bot_filter is not None:
        q = q.filter(StudentBotAssignment.bot_id.in_(bot_filter))
    for a in q.all():
        entry = out.setdefault((a.student_id, a.bot_id), {
            "classroom_goals": [], "individual_goal": None, "sources": [],
            "teacher_ids": set(), "assigned_at": a.assigned_at, "is_required": False})
        entry["individual_goal"] = a.goal_interactions
        entry["teacher_ids"].add(a.teacher_id)
        entry["sources"].append({"type": "individual", "teacher_id": a.teacher_id})
        if a.assigned_at and (entry["assigned_at"] is None or a.assigned_at < entry["assigned_at"]):
            entry["assigned_at"] = a.assigned_at

    for entry in out.values():
        entry["goal"] = entry["individual_goal"] or max(entry["classroom_goals"] or [DEFAULT_GOAL_INTERACTIONS])
    return out


def assignment_for(db: Session, student_id: int, bot_id: int) -> Optional[dict]:
    return _assignments_for_students(db, [student_id], [bot_id]).get((student_id, bot_id))


def _students_with_bot(db: Session, bot_id: int, student_ids: Iterable[int]) -> Set[int]:
    return {sid for (sid, _bid) in _assignments_for_students(db, student_ids, [bot_id])}


def bot_ids_of_student(db: Session, student_id: int) -> Set[int]:
    return {bid for (_sid, bid) in _assignments_for_students(db, [student_id])}


def notify_new_member(db: Session, student: User, classroom: Classroom, before: Set[int]) -> int:
    """Un estudiante se une a un grupo que ya tiene NeuroBots: se le notifica
    cada bot que recibe por primera vez (sin commit)."""
    rows = (db.query(ClassroomBot, ExpertBot)
            .join(ExpertBot, ExpertBot.id == ClassroomBot.bot_id)
            .filter(ClassroomBot.classroom_id == classroom.id, ExpertBot.is_active == True)  # noqa: E712
            .all())
    sent = 0
    for cb, bot in rows:
        if bot.id in before:
            continue
        teacher = db.get(User, cb.assigned_by_id or classroom.teacher_id)
        goal = cb.goal_interactions or DEFAULT_GOAL_INTERACTIONS
        sent += len(notif.notify(
            db, [student.id], "neurobot_asignado", "Nuevo NeuroBot asignado",
            f'Tu profesor {display_name(teacher)} asignó el NeuroBot "{bot.name}" al grupo {classroom.name}. '
            f"Meta: {goal} interacciones.",
            link=f"/bots/{bot.id}", resource_type="neurobot", resource_id=bot.id))
    return sent


# ═════════════════════════════════════════════════════════════════════════════
# Progreso
# ═════════════════════════════════════════════════════════════════════════════

def progress_view(progress: Optional[NeuroBotProgress], goal: int) -> dict:
    interactions = progress.interactions if progress else 0
    if progress is not None and progress.completed_at is not None:
        status, percent = "completado", 100
        goal = progress.completed_goal or goal
    elif interactions > 0:
        status = "en_progreso"
        percent = min(99, (interactions * 100) // max(goal, 1))
    elif progress is not None and progress.started_at is not None:
        status, percent = "iniciado", 0
    else:
        status, percent = "asignado", 0
    return {
        "status": status,
        "status_label": STATUS_LABELS[status],
        "percent": percent,
        "interactions": interactions,
        "goal_interactions": goal,
        "started_at": notif.iso(progress.started_at) if progress else None,
        "last_activity_at": notif.iso(progress.last_activity_at) if progress else None,
        "completed_at": notif.iso(progress.completed_at) if progress else None,
    }


def _get_progress(db: Session, student_id: int, bot_id: int) -> Optional[NeuroBotProgress]:
    return db.query(NeuroBotProgress).filter(
        NeuroBotProgress.student_id == student_id, NeuroBotProgress.bot_id == bot_id).first()


def _get_or_create_progress(db: Session, student_id: int, bot_id: int) -> NeuroBotProgress:
    progress = _get_progress(db, student_id, bot_id)
    if progress is not None:
        return progress
    progress = NeuroBotProgress(student_id=student_id, bot_id=bot_id, interactions=0, created_at=utcnow())
    db.add(progress)
    try:
        db.flush()
    except IntegrityError:  # otra petición simultánea la creó
        db.rollback()
        progress = _get_progress(db, student_id, bot_id)
    return progress


def _complete_if_reached(db: Session, progress: NeuroBotProgress, goal: int,
                         assignment: dict, student: User, bot: ExpertBot) -> bool:
    """Marca completado con un UPDATE condicional (una sola vez aunque lleguen
    mensajes simultáneos) y notifica a los profesores que lo asignaron."""
    now = utcnow()
    updated = db.query(NeuroBotProgress).filter(
        NeuroBotProgress.id == progress.id,
        NeuroBotProgress.completed_at.is_(None),
        NeuroBotProgress.interactions >= goal,
    ).update({NeuroBotProgress.completed_at: now, NeuroBotProgress.completed_goal: goal},
             synchronize_session=False)
    if not updated:
        return False
    db.refresh(progress)
    notif.notify(
        db, assignment["teacher_ids"], "neurobot_completado",
        "NeuroBot completado",
        f'{display_name(student)} completó el NeuroBot "{bot.name}" ({progress.interactions} interacciones).',
        link=f"/teacher?tab=neurobots&bot={bot.id}",
        resource_type="neurobot", resource_id=bot.id,
    )
    return True


def record_start(db: Session, student: User, bot: ExpertBot) -> Optional[dict]:
    """El estudiante abrió el chat con un bot asignado. Commit incluido."""
    if student.role != UserRole.ESTUDIANTE.value:
        return None
    assignment = assignment_for(db, student.id, bot.id)
    if assignment is None:
        return None
    progress = _get_or_create_progress(db, student.id, bot.id)
    now = utcnow()
    if progress.started_at is None:
        progress.started_at = now
    progress.last_activity_at = now
    db.commit()
    db.refresh(progress)
    return progress_view(progress, assignment["goal"])


def record_interaction(db: Session, student: User, bot: ExpertBot) -> Optional[dict]:
    """El NeuroBot respondió un mensaje del estudiante. Suma la interacción de
    forma atómica y completa si alcanzó la meta. Commit incluido."""
    if student.role != UserRole.ESTUDIANTE.value:
        return None
    assignment = assignment_for(db, student.id, bot.id)
    if assignment is None:
        return None
    progress = _get_or_create_progress(db, student.id, bot.id)
    now = utcnow()
    db.query(NeuroBotProgress).filter(NeuroBotProgress.id == progress.id).update({
        NeuroBotProgress.interactions: NeuroBotProgress.interactions + 1,
        NeuroBotProgress.last_activity_at: now,
        NeuroBotProgress.started_at: NeuroBotProgress.started_at if progress.started_at else now,
    }, synchronize_session=False)
    db.refresh(progress)
    just_completed = _complete_if_reached(db, progress, assignment["goal"], assignment, student, bot)
    db.commit()
    db.refresh(progress)
    view = progress_view(progress, assignment["goal"])
    view["just_completed"] = just_completed
    return view


def reconcile_completion(db: Session, bot: ExpertBot, student_ids: Iterable[int]) -> int:
    """Tras cambiar una meta: completa a quienes ya la alcanzaron (sin commit)."""
    student_ids = list(student_ids)
    if not student_ids:
        return 0
    assignments = _assignments_for_students(db, student_ids, [bot.id])
    progresses = db.query(NeuroBotProgress).filter(
        NeuroBotProgress.bot_id == bot.id, NeuroBotProgress.student_id.in_(student_ids),
        NeuroBotProgress.completed_at.is_(None)).all()
    done = 0
    for p in progresses:
        assignment = assignments.get((p.student_id, bot.id))
        if assignment and p.interactions >= assignment["goal"]:
            student = db.get(User, p.student_id)
            done += _complete_if_reached(db, p, assignment["goal"], assignment, student, bot)
    return done


# ═════════════════════════════════════════════════════════════════════════════
# Vista del estudiante («Mis NeuroBots»)
# ═════════════════════════════════════════════════════════════════════════════

def _bot_card(db: Session, bot: ExpertBot, assignment: dict, progress: Optional[NeuroBotProgress]) -> dict:
    teachers = {u.id: display_name(u) for u in db.query(User).filter(User.id.in_(assignment["teacher_ids"]))}
    sources = []
    for s in assignment["sources"]:
        item = {"type": s["type"], "teacher_name": teachers.get(s["teacher_id"], "")}
        if s["type"] == "aula":
            item.update(classroom_id=s["classroom_id"], classroom_name=s["classroom_name"])
        sources.append(item)
    from app.models.bot_document import BotDocument
    return {
        "id": bot.id,
        "name": bot.name,
        "description": bot.description or "",
        "subject": bot.category or "",
        "creator_name": display_name(bot.creator) if getattr(bot, "creator", None) else "",
        "is_required": assignment["is_required"],
        "assigned_at": notif.iso(assignment["assigned_at"]),
        "sources": sources,
        "document_count": db.query(BotDocument).filter(BotDocument.bot_id == bot.id).count(),
        "progress": progress_view(progress, assignment["goal"]),
    }


def student_bots(db: Session, student: User) -> List[dict]:
    assignments = _assignments_for_students(db, [student.id])
    if not assignments:
        return []
    bot_ids = [bid for (_sid, bid) in assignments]
    bots = {b.id: b for b in db.query(ExpertBot).filter(
        ExpertBot.id.in_(bot_ids), ExpertBot.is_active == True)}  # noqa: E712
    progresses = {p.bot_id: p for p in db.query(NeuroBotProgress).filter(
        NeuroBotProgress.student_id == student.id, NeuroBotProgress.bot_id.in_(bot_ids))}
    cards = [_bot_card(db, bots[bid], a, progresses.get(bid))
             for (_sid, bid), a in assignments.items() if bid in bots]
    order = {"en_progreso": 0, "iniciado": 1, "asignado": 2, "completado": 3}
    cards.sort(key=lambda c: (order[c["progress"]["status"]], c["name"].lower()))
    return cards


def student_bot_detail(db: Session, student: User, bot_id: int) -> dict:
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id, ExpertBot.is_active == True).first()  # noqa: E712
    assignment = assignment_for(db, student.id, bot_id) if bot else None
    if bot is None or assignment is None:
        raise NeuroBotError("Este NeuroBot no está asignado a ti.", 404)
    card = _bot_card(db, bot, assignment, _get_progress(db, student.id, bot_id))
    from app.models.adaptive import Conversation
    last = db.query(Conversation).filter(
        Conversation.student_id == student.id, Conversation.bot_id == bot_id,
        Conversation.is_active == True,  # noqa: E712
    ).order_by(Conversation.last_interaction.desc()).first()
    card["last_conversation_id"] = last.id if last else None
    return card


# ═════════════════════════════════════════════════════════════════════════════
# Profesor: asignar, quitar y consultar resultados
# ═════════════════════════════════════════════════════════════════════════════

def _teacher_classrooms(db: Session, teacher: User) -> List[Classroom]:
    return db.query(Classroom).filter(
        Classroom.teacher_id == teacher.id, Classroom.is_active == True  # noqa: E712
    ).order_by(Classroom.name).all()


def _enrolled_students(db: Session, classroom_ids: Iterable[int]) -> Dict[int, List[int]]:
    """{student_id: [classroom_id, ...]} de estudiantes activos."""
    classroom_ids = list(classroom_ids)
    out: Dict[int, List[int]] = {}
    if not classroom_ids:
        return out
    rows = (db.query(Enrollment.student_id, Enrollment.classroom_id)
            .join(User, User.id == Enrollment.student_id)
            .filter(Enrollment.classroom_id.in_(classroom_ids), Enrollment.is_active == True,  # noqa: E712
                    User.is_active == True, User.role == UserRole.ESTUDIANTE.value))  # noqa: E712
    for sid, cid in rows:
        out.setdefault(sid, []).append(cid)
    return out


def assignments_overview(db: Session, teacher: User, bot: ExpertBot) -> dict:
    classrooms = _teacher_classrooms(db, teacher)
    class_ids = [c.id for c in classrooms]
    enrolled = _enrolled_students(db, class_ids)
    assigned = {cb.classroom_id: cb for cb in db.query(ClassroomBot).filter(
        ClassroomBot.bot_id == bot.id, ClassroomBot.classroom_id.in_(class_ids or [0]))}
    individual = {a.student_id: a for a in db.query(StudentBotAssignment).filter(
        StudentBotAssignment.bot_id == bot.id, StudentBotAssignment.teacher_id == teacher.id)}
    names = {c.id: c.name for c in classrooms}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(list(enrolled) + list(individual) or [0]))}
    count_by_class: Dict[int, int] = {}
    for cids in enrolled.values():
        for cid in cids:
            count_by_class[cid] = count_by_class.get(cid, 0) + 1
    return {
        "bot_id": bot.id,
        "default_goal": DEFAULT_GOAL_INTERACTIONS,
        "min_goal": MIN_GOAL_INTERACTIONS,
        "max_goal": MAX_GOAL_INTERACTIONS,
        "classrooms": [{
            "id": c.id, "name": c.name, "subject": c.subject or "", "grade": c.grade or "",
            "student_count": count_by_class.get(c.id, 0),
            "assigned": c.id in assigned,
            "goal_interactions": (assigned[c.id].goal_interactions or DEFAULT_GOAL_INTERACTIONS) if c.id in assigned else None,
        } for c in classrooms],
        "students": sorted([{
            "id": sid, "full_name": display_name(users.get(sid)),
            "username": users[sid].username if sid in users else "",
            "classrooms": [names[c] for c in enrolled.get(sid, []) if c in names],
            "assigned_individually": sid in individual,
            "goal_interactions": individual[sid].goal_interactions if sid in individual else None,
        } for sid in set(enrolled) | set(individual) if sid in users], key=lambda s: s["full_name"].lower()),
    }


def assign(db: Session, teacher: User, bot: ExpertBot, classroom_ids: Iterable[int],
           student_ids: Iterable[int], goal) -> dict:
    """Asigna (o actualiza la meta) por aula y por estudiante y notifica a los
    estudiantes que reciben el bot por primera vez. Sin commit: el endpoint
    confirma asignación y notificaciones en una sola transacción."""
    goal = validate_goal(goal)
    classroom_ids = sorted({int(c) for c in classroom_ids or []})
    student_ids = sorted({int(s) for s in student_ids or []})
    if not classroom_ids and not student_ids:
        raise NeuroBotError("Selecciona al menos un grupo o un estudiante.", 422)

    own = {c.id: c for c in _teacher_classrooms(db, teacher)}
    foreign = [c for c in classroom_ids if c not in own]
    if foreign:
        raise NeuroBotError("Solo puedes asignar NeuroBots a tus propios grupos.", 403)
    enrolled_all = _enrolled_students(db, own.keys())
    not_mine = [s for s in student_ids if s not in enrolled_all]
    if not_mine:
        raise NeuroBotError("Solo puedes asignar NeuroBots a estudiantes de tus grupos.", 403)

    targets_by_class = _enrolled_students(db, classroom_ids)
    affected = set(targets_by_class) | set(student_ids)
    already = _students_with_bot(db, bot.id, affected)
    now = utcnow()
    classrooms_added = classrooms_updated = students_added = students_updated = 0

    existing_cb = {cb.classroom_id: cb for cb in db.query(ClassroomBot).filter(
        ClassroomBot.bot_id == bot.id, ClassroomBot.classroom_id.in_(classroom_ids or [0]))}
    for cid in classroom_ids:
        cb = existing_cb.get(cid)
        if cb is None:
            db.add(ClassroomBot(classroom_id=cid, bot_id=bot.id, is_required=False, order_index=0,
                                goal_interactions=goal, assigned_by_id=teacher.id, assigned_at=now))
            classrooms_added += 1
        elif (cb.goal_interactions or DEFAULT_GOAL_INTERACTIONS) != goal:
            cb.goal_interactions = goal
            cb.assigned_by_id = cb.assigned_by_id or teacher.id
            classrooms_updated += 1

    existing_sa = {a.student_id: a for a in db.query(StudentBotAssignment).filter(
        StudentBotAssignment.bot_id == bot.id, StudentBotAssignment.student_id.in_(student_ids or [0]))}
    for sid in student_ids:
        a = existing_sa.get(sid)
        if a is None:
            db.add(StudentBotAssignment(bot_id=bot.id, student_id=sid, teacher_id=teacher.id,
                                        goal_interactions=goal, assigned_at=now))
            students_added += 1
        elif a.goal_interactions != goal or a.teacher_id != teacher.id:
            a.goal_interactions = goal
            a.teacher_id = teacher.id
            students_updated += 1
    db.flush()

    newly = sorted(affected - already)
    teacher_name = display_name(teacher)
    notified = 0
    for sid in newly:
        via = [own[c].name for c in targets_by_class.get(sid, [])]
        where = f" en el grupo {', '.join(via)}" if via else ""
        notified += len(notif.notify(
            db, [sid], "neurobot_asignado", "Nuevo NeuroBot asignado",
            f'Tu profesor {teacher_name} te asignó el NeuroBot "{bot.name}"{where}. '
            f"Meta: {goal} interacciones.",
            link=f"/bots/{bot.id}", resource_type="neurobot", resource_id=bot.id))
    completed = reconcile_completion(db, bot, affected & already) if (classrooms_updated or students_updated) else 0
    return {
        "classrooms_added": classrooms_added, "classrooms_updated": classrooms_updated,
        "students_added": students_added, "students_updated": students_updated,
        "students_notified": notified, "completed_after_goal_change": completed,
        "goal_interactions": goal,
    }


def unassign_classroom(db: Session, teacher: User, bot: ExpertBot, classroom_id: int) -> None:
    classroom = db.get(Classroom, classroom_id)
    if classroom is None or classroom.teacher_id != teacher.id:
        raise NeuroBotError("Solo puedes quitar NeuroBots de tus propios grupos.", 403)
    cb = db.query(ClassroomBot).filter(ClassroomBot.classroom_id == classroom_id,
                                       ClassroomBot.bot_id == bot.id).first()
    if cb is None:
        raise NeuroBotError("El NeuroBot no está asignado a ese grupo.", 404)
    db.delete(cb)


def unassign_student(db: Session, teacher: User, bot: ExpertBot, student_id: int) -> None:
    a = db.query(StudentBotAssignment).filter(StudentBotAssignment.bot_id == bot.id,
                                              StudentBotAssignment.student_id == student_id).first()
    if a is None:
        raise NeuroBotError("El NeuroBot no está asignado a ese estudiante.", 404)
    if a.teacher_id != teacher.id:
        raise NeuroBotError("Solo quien asignó el NeuroBot puede quitarlo.", 403)
    db.delete(a)


def results(db: Session, viewer: User, bot: ExpertBot) -> dict:
    """Estado real de cada estudiante con el bot, limitado a lo que el rol puede ver:
    profesor → estudiantes de las asignaciones que él hizo (sus grupos o
    individuales); Súper Profesor → toda su institución; Administrador → todo."""
    if viewer.role == UserRole.PROFESOR.value:
        class_ids = [c.id for c in _teacher_classrooms(db, viewer)]
        cb_rows = db.query(ClassroomBot).filter(ClassroomBot.bot_id == bot.id,
                                                ClassroomBot.classroom_id.in_(class_ids or [0])).all()
        sa_rows = db.query(StudentBotAssignment).filter(StudentBotAssignment.bot_id == bot.id,
                                                        StudentBotAssignment.teacher_id == viewer.id).all()
    else:
        cb_q = db.query(ClassroomBot).join(Classroom, Classroom.id == ClassroomBot.classroom_id).filter(
            ClassroomBot.bot_id == bot.id)
        sa_q = db.query(StudentBotAssignment).join(User, User.id == StudentBotAssignment.student_id).filter(
            StudentBotAssignment.bot_id == bot.id)
        if viewer.role == UserRole.SUPER_PROFESOR.value:
            teachers = [r.id for r in db.query(User.id).filter(User.institution_id == viewer.institution_id)]
            cb_q = cb_q.filter(Classroom.teacher_id.in_(teachers or [0]))
            sa_q = sa_q.filter(User.institution_id == viewer.institution_id)
        cb_rows, sa_rows = cb_q.all(), sa_q.all()

    student_ids: Set[int] = {a.student_id for a in sa_rows}
    student_ids |= set(_enrolled_students(db, [cb.classroom_id for cb in cb_rows]))
    assignments = _assignments_for_students(db, student_ids, [bot.id])
    visible_classes = {cb.classroom_id for cb in cb_rows}
    visible_individual = {a.student_id for a in sa_rows}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(student_ids or [0]))}
    progresses = {p.student_id: p for p in db.query(NeuroBotProgress).filter(
        NeuroBotProgress.bot_id == bot.id, NeuroBotProgress.student_id.in_(student_ids or [0]))}

    rows, summary = [], {k: 0 for k in STATUS_LABELS}
    for sid in student_ids:
        a = assignments.get((sid, bot.id))
        if a is None or sid not in users:
            continue
        sources = [s["classroom_name"] for s in a["sources"]
                   if s["type"] == "aula" and s["classroom_id"] in visible_classes]
        if sid in visible_individual:
            sources.append("Individual")
        view = progress_view(progresses.get(sid), a["goal"])
        summary[view["status"]] += 1
        rows.append({"student_id": sid, "full_name": display_name(users[sid]),
                     "username": users[sid].username, "sources": sources, **view})
    rows.sort(key=lambda r: (-r["percent"], r["full_name"].lower()))
    return {"bot_id": bot.id, "bot_name": bot.name, "total": len(rows), "summary": summary, "students": rows}
