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
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.classroom import Classroom, Enrollment
from app.models.posts import Post, PostReaction, PostComment

router = APIRouter(prefix="/posts", tags=["Tablero - Posts"])


# ── Schemas internos ────────────────────────────────────────────────────────

class PostCreate(BaseModel):
    classroom_id: int
    post_type: str = "anuncio"   # anuncio|tarea|recordatorio|material|enlace
    title: str
    content: str = ""
    due_date: Optional[str] = None
    attachments: Optional[list] = []

class CommentCreate(BaseModel):
    content: str


def _post_to_dict(post: Post, current_user_id: int, db: Session) -> dict:
    """Serializa un Post a dict con metadatos de reacciones y comentarios."""
    # Reacciones
    reactions = db.query(PostReaction).filter(PostReaction.post_id == post.id).all()
    user_reacted = any(r.user_id == current_user_id for r in reactions)

    # Comentarios activos
    comments_q = db.query(PostComment).filter(
        PostComment.post_id == post.id,
        PostComment.is_active == True,
    ).order_by(PostComment.created_at).all()

    comments = []
    for c in comments_q:
        author = db.query(User).filter(User.id == c.author_id).first()
        comments.append({
            "id": c.id,
            "author_id": c.author_id,
            "author_name": author.full_name or author.username if author else "?",
            "author_role": author.role if author else "estudiante",
            "content": c.content,
            "created_at": c.created_at.isoformat(),
        })

    teacher = db.query(User).filter(User.id == post.teacher_id).first()
    classroom = db.query(Classroom).filter(Classroom.id == post.classroom_id).first()

    return {
        "id": post.id,
        "classroom_id": post.classroom_id,
        "classroom_name": classroom.name if classroom else "",
        "teacher_id": post.teacher_id,
        "teacher_name": teacher.full_name or teacher.username if teacher else "Profesor",
        "post_type": post.post_type,
        "title": post.title,
        "content": post.content,
        "due_date": post.due_date,
        "attachments": post.attachments or [],
        "is_pinned": post.is_pinned,
        "created_at": post.created_at.isoformat(),
        "updated_at": post.updated_at.isoformat(),
        "reactions_count": len(reactions),
        "user_reacted": user_reacted,
        "comments": comments,
        "comments_count": len(comments),
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def list_posts(
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
        "posts": [_post_to_dict(p, current_user.id, db) for p in posts],
        "total": len(posts),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(
    body: PostCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crear un post en el tablero (solo profesores dueños de la clase)."""
    if current_user.role not in (UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value):
        raise HTTPException(status_code=403, detail="Solo profesores pueden publicar")

    classroom = db.query(Classroom).filter(
        Classroom.id == body.classroom_id,
        Classroom.teacher_id == current_user.id,
        Classroom.is_active == True,
    ).first()
    if not classroom:
        raise HTTPException(status_code=404, detail="Clase no encontrada o sin permiso")

    post = Post(
        classroom_id=body.classroom_id,
        teacher_id=current_user.id,
        post_type=body.post_type,
        title=body.title,
        content=body.content,
        due_date=body.due_date,
        attachments=body.attachments or [],
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _post_to_dict(post, current_user.id, db)


@router.get("/{post_id}")
async def get_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")
    return _post_to_dict(post, current_user.id, db)


@router.post("/{post_id}/reactions")
async def toggle_reaction(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggle de reacción 👍 del usuario actual en un post."""
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")

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
async def list_comments(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")

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
            "author_name": author.full_name or author.username if author else "?",
            "author_role": author.role if author else "estudiante",
            "content": c.content,
            "created_at": c.created_at.isoformat(),
        })
    return {"comments": result, "total": len(result)}


@router.post("/{post_id}/comments", status_code=status.HTTP_201_CREATED)
async def add_comment(
    post_id: int,
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Añadir comentario a un post (profesores y estudiantes pueden comentar)."""
    post = db.query(Post).filter(Post.id == post_id, Post.is_active == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post no encontrado")

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
async def delete_post(
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
