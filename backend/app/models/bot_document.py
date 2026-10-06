"""
NeuroLearn IA — Documentos de conocimiento de los NeuroBots.

Un profesor sube documentos (PDF, DOCX, TXT, Markdown) a uno de sus NeuroBots.
El backend extrae el texto, lo divide en fragmentos y los guarda en
`bot_document_chunks`. Cuando alguien conversa con el NeuroBot, los fragmentos
más relevantes para la pregunta se agregan al contexto de la IA
(`app/services/bot_documents.py`).

Tablas:
    bot_documents        — un registro por archivo subido (incluye el archivo
                           original, igual que los adjuntos de mensajes).
    bot_document_chunks  — fragmentos de texto indexados de cada documento.

Al eliminar un documento se eliminan sus fragmentos (el servicio los borra
explícitamente y, además, la FK tiene ON DELETE CASCADE en PostgreSQL).
"""
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
)
from sqlalchemy.orm import deferred, relationship

from app.db.database import Base


class BotDocument(Base):
    __tablename__ = "bot_documents"

    id = Column(Integer, primary_key=True, index=True)
    bot_id = Column(
        Integer,
        ForeignKey("expert_bots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    uploaded_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Institución del profesor que lo subió (aislamiento por institución).
    institution_id = Column(Integer, ForeignKey("institutions.id"), nullable=True, index=True)

    filename = Column(String(255), nullable=False)
    extension = Column(String(10), nullable=False)        # pdf | docx | txt | md
    mime_type = Column(String(120), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    content_hash = Column(String(64), nullable=False)     # SHA-256 del archivo

    # Archivo original. `deferred` evita cargarlo al listar documentos.
    file_data = deferred(Column(LargeBinary, nullable=False))

    text_chars = Column(Integer, nullable=False, default=0)
    chunk_count = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    chunks = relationship(
        "BotDocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan",
        order_by="BotDocumentChunk.chunk_index",
    )


class BotDocumentChunk(Base):
    __tablename__ = "bot_document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer,
        ForeignKey("bot_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Copia de bot_id para recuperar los fragmentos de un bot en una sola consulta.
    bot_id = Column(Integer, nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    # Términos normalizados del fragmento (sin tildes ni palabras vacías),
    # precalculados para la búsqueda BM25.
    terms = Column(Text, nullable=False, default="")

    document = relationship("BotDocument", back_populates="chunks")
