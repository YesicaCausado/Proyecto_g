"""
NeuroLearn AI - Modelos de Tablero de Clase

Post: publicación del profesor en una clase (anuncio, tarea, recordatorio, material, enlace)
PostReaction: reacción de un usuario a un post
PostComment: comentario de un usuario en un post
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.database import Base


class Post(Base):
    """Publicación del profesor en el tablero de su clase"""
    __tablename__ = "posts"

    id          = Column(Integer, primary_key=True, index=True)
    classroom_id= Column(Integer, ForeignKey("classrooms.id"), nullable=False)
    teacher_id  = Column(Integer, ForeignKey("users.id"), nullable=False)

    post_type   = Column(String(30), default="anuncio")   # anuncio|tarea|recordatorio|material|enlace
    title       = Column(String(200), nullable=False)
    content     = Column(Text, default="")
    due_date    = Column(String(20), nullable=True)        # YYYY-MM-DD
    attachments = Column(JSON, default=[])                 # [{name, url, type}]
    is_pinned   = Column(Boolean, default=False)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime, default=datetime.utcnow)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relaciones
    teacher   = relationship("User", foreign_keys=[teacher_id])
    classroom = relationship("Classroom", foreign_keys=[classroom_id])
    reactions = relationship("PostReaction", back_populates="post", cascade="all, delete-orphan")
    comments  = relationship("PostComment",  back_populates="post", cascade="all, delete-orphan", order_by="PostComment.created_at")


class PostReaction(Base):
    """Reacción (👍) de un usuario a un post"""
    __tablename__ = "post_reactions"

    id        = Column(Integer, primary_key=True, index=True)
    post_id   = Column(Integer, ForeignKey("posts.id"), nullable=False)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    emoji     = Column(String(10), default="👍")
    created_at= Column(DateTime, default=datetime.utcnow)

    post = relationship("Post", back_populates="reactions")
    user = relationship("User", foreign_keys=[user_id])


class PostComment(Base):
    """Comentario de un usuario en un post"""
    __tablename__ = "post_comments"

    id         = Column(Integer, primary_key=True, index=True)
    post_id    = Column(Integer, ForeignKey("posts.id"), nullable=False)
    author_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    content    = Column(Text, nullable=False)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    post   = relationship("Post", back_populates="comments")
    author = relationship("User", foreign_keys=[author_id])
