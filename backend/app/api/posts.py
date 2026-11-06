"""
NeuroLearn AI - API Tablero de Clase (Posts)

Endpoints:
  GET  /posts                         - posts de las clases del usuario actual
  POST /posts                         - crear post (solo profesor)
  GET  /posts/{post_id}               - detalle de un post
  POST /posts/{post_id}/reactions     - toggle reacción 👍
  GET  /posts/{post_id}/comments      - listar comentarios
  POST /posts/{post_id}/comments      - añadir comentario
  DELETE /posts/{post_id}             - eliminar post (solo profesor dueño)
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator

from app.core import validators as v
from app.db.database import get_db
from app.api.auth import get_current_user
from app.core.permissions import Permission, has_permission
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.posts import Post, PostReaction, PostComment

router = APIRouter(prefix="/posts", tags=["Tablero - Posts"])


def _check_post_access(post: Post, current_user: User, db: Session) -> None:
    """Verifica que el usuario tiene acceso al aula del post (anti cross-tenant).
    Lanza 403 si el usuario no es dueño del aula ni está inscrito activamente en ella.
    """
    if current_user.role == UserRole.ADMIN.value:
        return
    if current_user.role == UserRole.SUPER_PROFESOR.value:
        # Solo publicaciones de grupos de su propia institución.
        classroom = db.query(Classroom).filter(Classroom.id == post.classroom_id).first()
        teacher = classroom.teacher if classroom else None
        if not teacher or teacher.institution_id != current_user.institution_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este post")
        return
    if current_user.role == UserRole.PROFESOR.value:
        classroom = db.query(Classroom).filter(Classroom.id == post.classroom_id).first()
        if not classroom or classroom.teacher_id != current_user.id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este post")
    else:
        # Estudiante: debe estar inscrito en el aula
        enrolled = db.query(Enrollment).filter(
            Enrollment.classroom_id == post.classroom_id,
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="No tienes acceso a este post")


# ── Schemas internos ────────────────────────────────────────────────────────

POST_TYPES = ("anuncio", "tarea", "recordatorio", "material", "enlace")


class PostCreate(BaseModel):
    classroom_id: int
    post_type: str = "anuncio"   # anuncio|tarea|recordatorio|material|enlace
    title: str
    content: str = ""
    due_date: Optional[str] = None
    attachments: Optional[list] = Field(default_factory=list, max_length=10)

    @field_validator("post_type")
    @classmethod
    def _type(cls, value: str) -> str:
        value = (value or "").strip().lower()
        if value not in POST_TYPES:
            raise ValueError("Tipo de publicación no válido.")
        return value

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return v.clean_text(value, label="El título", max_len=200)

    @field_validator("content")
    @classmethod
    def _content(cls, value: str) -> str:
        return v.clean_text(value, label="El contenido", max_len=5000, required=False, multiline=True)

    @field_validator("due_date")
    @classmethod
    def _due(cls, value: Optional[str]) -> Optional[str]:
        return v.iso_date(value, label="La fecha de entrega", required=False, min_year=2000)


class CommentCreate(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def _content(cls, value: str) -> str:
        return v.clean_text(value, label="El comentario", max_len=2000, multiline=True)


def _posts_to_dicts(posts: List[Post], current_user_id: int, db: Session) -> List[dict]:
    """Serializa posts con reacciones y comentarios en 4 consultas en total.

    Antes eran ~4 consultas POR post (reacciones, comentarios, un usuario por
    comentario, docente y aula): el Tablero tardaba más cuanto más se usaba.
    """
    if not posts:
        return []
    post_ids = [p.id for p in posts]

    reactions_by_post: dict = {pid: [] for pid in post_ids}
    for r in db.query(PostReaction.post_id, PostReaction.user_id).filter(PostReaction.post_id.in_(post_ids)):
        reactions_by_post[r.post_id].append(r.user_id)

    comments_by_post: dict = {pid: [] for pid in post_ids}
    all_comments = db.query(PostComment).filter(
        PostComment.post_id.in_(post_ids),
        PostComment.is_active == True,
    ).order_by(PostComment.created_at).all()
    for c in all_comments:
        comments_by_post[c.post_id].append(c)

    user_ids = {p.teacher_id for p in posts} | {c.author_id for c in all_comments}
    users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids))}
    classrooms = {c.id: c for c in db.query(Classroom).filter(
        Classroom.id.in_({p.classroom_id for p in posts}))}

    out = []
    for post in posts:
        reactors = reactions_by_post[post.id]
        comments = []
        for c in comments_by_post[post.id]:
            author = users.get(c.author_id)
            comments.append({
                "id": c.id,
                "author_id": c.author_id,
                "author_name": (author.full_name or author.username) if author else "?",
                "author_role": author.role if author else "estudiante",
                "content": c.content,
                "created_at": c.created_at.isoformat(),
            })
        teacher = users.get(post.teacher_id)
        classroom = classrooms.get(post.classroom_id)
        out.append({
            "id": post.id,
            "classroom_id": post.classroom_id,
            "classroom_name": classroom.name if classroom else "",
            "teacher_id": post.teacher_id,
            "teacher_name": (teacher.full_name or teacher.username) if teacher else "Profesor",
            "post_type": post.post_type,
            "title": post.title,
            "content": post.content,
            "due_date": post.due_date,
            # [{id, name}] = material real descargable; los antiguos (solo
            # nombre) se marcan sin id para que no aparenten ser descargables.
            "attachments": [
                {"id": a.get("id"), "name": a.get("name") or "Adjunto"} if isinstance(a, dict)
                else {"id": None, "name": str(a)}
                for a in (post.attachments or [])
            ],
            "is_pinned": post.is_pinned,
            "created_at": post.created_at.isoformat(),
            "updated_at": post.updated_at.isoformat(),
            "reactions_count": len(reactors),
            "user_reacted": current_user_id in reactors,
            "comments": comments,
            "comments_count": len(comments),
        })
    return out


def _post_to_dict(post: Post, current_user_id: int, db: Session) -> dict:
    """Serializa un Post a dict con metadatos de reacciones y comentarios."""
    return _posts_to_dicts([post], current_user_id, db)[0]


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def list_posts(
    classroom_id: Optional[int] = Query(None, description="Filtrar por clase"),
    post_type: Optional[str]    = Query(None, description="Filtrar por tipo"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve los posts de las clases del usuario actual.
    - Profesor: posts de sus propias clases.
    - Estudiante: posts de las clases en las que está inscrito.
    """
    if current_user.role == UserRole.PROFESOR.value:
        my_classrooms = db.query(Classroom).filter(
            Classroom.teacher_id == current_user.id,
            Classroom.is_active == True,
        ).all()
        cids = [c.id for c in my_classrooms]
    else:
        # Estudiante — clases inscritas
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == current_user.id,
            Enrollment.is_active == True,
        ).all()
        cids = [e.classroom_id for e in enrollments]

    if not cids:
        return {"posts": [], "total": 0}

    q = db.query(Post).filter(
        Post.classroom_id.in_(cids),
        Post.is_active == True,
    )
    if classroom_id:
        q = q.filter(Post.classroom_id == classroom_id)
    if post_type:
        q = q.filter(Post.post_type == post_type)

    posts = q.order_by(Post.is_pinned.desc(), Post.created_at.desc()).all()
    return {
        "posts": _posts_to_dicts(posts, current_user.id, db),
        "total": len(posts),
    }


_POST_TYPE_LABELS = {
    "tarea": "una tarea", "recordatorio": "un recordatorio", "material": "material",
    "enlace": "un enlace", "anuncio": "un anuncio",
}


def _notify_new_post(db: Session, post: Post, classroom: Classroom, teacher: User) -> None:
    """Publicación nueva → estudiantes activos del grupo (misma transacción).

    Antes el estudiante solo se enteraba de una tarea o anuncio si abría el
    Tablero por su cuenta."""
    from app.services import notification_service
    student_ids = [r.student_id for r in db.query(Enrollment.student_id).filter(
        Enrollment.classroom_id == classroom.id, Enrollment.is_active == True)]  # noqa: E712
    what = _POST_TYPE_LABELS.get(post.post_type or "", "una publicación")
    due = f" Fecha límite: {post.due_date}." if post.due_date else ""
    notification_service.notify(
        db, student_ids, "publicacion_tablero", f"Nueva publicación: {post.title}",
        f"{teacher.full_name or teacher.username} publicó {what} en {classroom.name}.{due}",
        link="/tablero", resource_type="publicacion", resource_id=post.id,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def create_post(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crear un post en el tablero (solo profesores dueños de la clase)."""
    # Solo el profesor dueño de la clase publica (el súper profesor no tiene
    # clases propias; ya quedaba excluido por la regla del módulo de cursos).
    if not has_permission(current_user.role, Permission.PUBLICAR_EN_TABLERO):
        raise HTTPException(status_code=403, detail="Solo profesores pueden publicar")

    classroom = db.query(Classroom).filter(
        Classroom.id == body.classroom_id,
        Classroom.teacher_id == current_user.id,
        Classroom.is_active == True,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada o sin permiso")

    # Adjuntos: solo materiales reales del profesor compartidos con este grupo
    # (se suben con POST /teacher/materials/attachments). Antes se guardaba
    # solo el nombre del archivo y el estudiante no podía abrir nada.
    attachments = []
    if body.attachments:
        from app.api.teacher_materials import TeacherMaterial, shared_ids
        for a in body.attachments:
            mid = a.get("id") if isinstance(a, dict) else None
            mat = db.query(TeacherMaterial).filter(
                TeacherMaterial.id == mid, TeacherMaterial.teacher_id == current_user.id,
            ).first() if isinstance(mid, int) else None
            if mat is None or body.classroom_id not in shared_ids(mat):
                raise HTTPException(status_code=400,
                                    detail="Los adjuntos deben subirse primero y pertenecer a este grupo.")
            attachments.append({"id": mat.id, "name": mat.name})

    post = Post(
        classroom_id=body.classroom_id,
        teacher_id=current_user.id,
        post_type=body.post_type,
        title=body.title,
        content=body.content,
        due_date=body.due_date,
        attachments=attachments,
    )
    db.add(post)
    db.flush()
    _notify_new_post(db, post, classroom, current_user)
    db.commit()
    db.refresh(post)

    # ── Automatizaciones: "Nueva actividad" ────────────────────────────────
    # Cada publicación en el tablero (anuncio, tarea, recordatorio, material,
    # enlace) se considera una "actividad"; dispara las automatizaciones de la
    # institución que estén configuradas para este evento (ej. crear evento en
    # Google Calendar, ejecutar webhook).
    try:
        from app.services import integration_service as _isvc
        _isvc.dispatch_trigger(db, current_user, "nueva_actividad", {
            "event_desc": "Nueva actividad en el tablero",
            "title": post.title,
            "content": post.content or "",
            "post_type": post.post_type or "anuncio",
            "date": post.due_date,
            "classroom_id": post.classroom_id,
        }, owner_id=current_user.id)
    except Exception:
        # Una automatización que falla no debe romper la publicación.
        db.rollback()

    return _post_to_dict(post, current_user.id, db)


@router.get("/{post_id}")
def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    _check_post_access(post, current_user, db)
    return _post_to_dict(post, current_user.id, db)


@router.post("/{post_id}/reactions")
def toggle_reaction(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle de reacción 👍 del usuario actual en un post."""

    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    _check_post_access(post, current_user, db)

    existing = db.query(PostReaction).filter(
        PostReaction.post_id == post_id,
        PostReaction.user_id == current_user.id,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()
        reacted = False
    else:
        db.add(PostReaction(post_id=post_id, user_id=current_user.id))
        db.commit()
        reacted = True

    count = db.query(PostReaction).filter(PostReaction.post_id == post_id).count()
    return {"reacted": reacted, "reactions_count": count}


@router.get("/{post_id}/comments")
def list_comments(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    _check_post_access(post, current_user, db)

    comments = db.query(PostComment).filter(
        PostComment.post_id == post_id,
        PostComment.is_active == True,
    ).order_by(PostComment.created_at).all()

    result = []
    for c in comments:
        author = db.query(User).filter(User.id == c.author_id).first()
        result.append({
            "id": c.id,
            "author_id": c.author_id,
            "author_name": (author.full_name or author.username) if author else "?",
            "author_role": author.role if author else "estudiante",
            "content": c.content,
            "created_at": c.created_at.isoformat(),
        })
    return {"comments": result, "total": len(result)}


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED)
def add_comment(
    post_id: int,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Añadir comentario a un post (profesores y estudiantes pueden comentar)."""
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    _check_post_access(post, current_user, db)

    if not body.content.strip():
        raise HTTPException(status_code=400, detail="El comentario no puede estar vacío")

    comment = PostComment(
        post_id=post_id,
        author_id=current_user.id,
        content=body.content.strip(),
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    return {
        "id": comment.id,
        "author_id": comment.author_id,
        "author_name": current_user.full_name or current_user.username,
        "author_role": current_user.role,
        "content": comment.content,
        "created_at": comment.created_at.isoformat(),
    }


@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Desactivar un post (solo el profesor que lo creó)."""
    if current_user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
        raise HTTPException(status_code=403, detail="Solo profesores pueden eliminar posts")

    post = db.query(Post).filter(
        Post.id == post_id,
        Post.teacher_id == current_user.id,
        Post.is_active == True,
    ).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado o sin permiso")

    post.is_active = False
    db.commit()
    return {"message": "Post eliminado"}
