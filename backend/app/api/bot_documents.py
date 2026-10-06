"""
NeuroLearn IA — API de documentos de los NeuroBots (base de conocimiento).

Montado en main.py con prefix="/api/v1/bots":

    GET    /api/v1/bots/{bot_id}/documents                       listar
    POST   /api/v1/bots/{bot_id}/documents                       subir (multipart, campo "file")
    GET    /api/v1/bots/{bot_id}/documents/{document_id}/download descargar el original
    DELETE /api/v1/bots/{bot_id}/documents/{document_id}         eliminar (documento + fragmentos)

Autorización: permiso GESTIONAR_DOCUMENTOS_NEUROBOT (roles que crean bots) y,
además, ser el creador del NeuroBot o el Administrador. Como el creador
pertenece a una sola institución, nadie de otra institución puede ver ni
modificar estos documentos.

La lógica vive en app/services/bot_documents.py.
"""
from __future__ import annotations

import logging
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_permission
from app.core.permissions import FORBIDDEN_MESSAGE, Permission
from app.db.database import get_db
from app.models.bot_document import BotDocument
from app.models.expert_bot import ExpertBot
from app.models.user import User
from app.schemas.schemas import BotDocumentListResponse, BotDocumentResponse
from app.services.bot_documents import (
    MAX_FILE_BYTES,
    BotDocumentError,
    can_manage_bot,
    delete_document,
    document_to_dict,
    save_document,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["NeuroBots — Documentos"])


def _get_managed_bot(db: Session, bot_id: int, user: User) -> ExpertBot:
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if not bot:
        raise HTTPException(status_code=404, detail="NeuroBot no encontrado")
    if not can_manage_bot(user, bot):
        raise HTTPException(status_code=403, detail=FORBIDDEN_MESSAGE)
    return bot


def _get_document(db: Session, bot: ExpertBot, document_id: int) -> BotDocument:
    document = db.query(BotDocument).filter(
        BotDocument.id == document_id,
        BotDocument.bot_id == bot.id,
    ).first()
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return document


@router.get("/{bot_id}/documents", response_model=BotDocumentListResponse)
async def list_bot_documents(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_DOCUMENTOS_NEUROBOT)),
    db: Session = Depends(get_db),
):
    """Documentos de la base de conocimiento del NeuroBot."""
    bot = _get_managed_bot(db, bot_id, current_user)
    documents = (
        db.query(BotDocument)
        .filter(BotDocument.bot_id == bot.id)
        .order_by(BotDocument.created_at.desc(), BotDocument.id.desc())
        .all()
    )
    items = [document_to_dict(d) for d in documents]
    return {
        "bot_id": bot.id,
        "documents": items,
        "total": len(items),
        "total_size_bytes": sum(d.size_bytes for d in documents),
    }


@router.post(
    "/{bot_id}/documents",
    response_model=BotDocumentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_bot_document(
    bot_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_DOCUMENTOS_NEUROBOT)),
    db: Session = Depends(get_db),
):
    """
    Sube un documento, extrae su texto, lo indexa y lo asocia al NeuroBot.

    Responde 201 solo cuando el documento quedó procesado e indexado.
    Errores: 400 (vacío), 409 (duplicado), 413 (tamaño), 415 (formato/MIME),
    422 (no se pudo extraer texto).
    """
    bot = _get_managed_bot(db, bot_id, current_user)
    # Se lee un byte más del máximo para detectar archivos demasiado grandes
    # sin cargar archivos arbitrariamente grandes en memoria.
    raw = await file.read(MAX_FILE_BYTES + 1)
    try:
        saved = save_document(db, bot, current_user, file.filename, file.content_type, raw)
    except BotDocumentError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)
    except Exception:
        logger.exception("Error guardando documento del NeuroBot %s", bot.id)
        raise HTTPException(
            status_code=500,
            detail="No se pudo guardar el documento. Inténtalo de nuevo.",
        )
    finally:
        await file.close()

    logger.info(
        "📄 Documento %s indexado en NeuroBot %s (%d fragmentos) por usuario %s",
        saved.document.id, bot.id, saved.document.chunk_count, current_user.id,
    )
    return document_to_dict(saved.document)


@router.get("/{bot_id}/documents/{document_id}/download")
async def download_bot_document(
    bot_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_DOCUMENTOS_NEUROBOT)),
    db: Session = Depends(get_db),
):
    """Descarga el archivo original."""
    bot = _get_managed_bot(db, bot_id, current_user)
    document = _get_document(db, bot, document_id)
    filename = quote(document.filename)
    return Response(
        content=document.file_data,
        media_type=document.mime_type,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )


@router.delete("/{bot_id}/documents/{document_id}")
async def delete_bot_document(
    bot_id: int,
    document_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_DOCUMENTOS_NEUROBOT)),
    db: Session = Depends(get_db),
):
    """Elimina el documento y sus fragmentos: el NeuroBot deja de usar ese contenido."""
    bot = _get_managed_bot(db, bot_id, current_user)
    document = _get_document(db, bot, document_id)
    delete_document(db, document)
    return {"ok": True, "message": "Documento eliminado", "document_id": document_id}
