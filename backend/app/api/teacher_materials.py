"""
NeuroLearn AI - Materiales del Profesor
CRUD para carpetas y archivos de material didáctico.
Los archivos se almacenan como registros en DB (metadata); el binario
queda en el cliente/storage externo. Por ahora solo guardamos metadata.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, LargeBinary, Boolean
from sqlalchemy.orm import Session, relationship, deferred
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

from app.db.database import Base, get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.services.license_service import require_active_license, require_teacher_module, LicenseInfo

router = APIRouter(prefix="/teacher", tags=["Teacher Materials"])


# ─── Modelos ─────────────────────────────────────────────────────────────────

class TeacherFolder(Base):
    __tablename__ = "teacher_folders"
    id         = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name       = Column(String(120), nullable=False)
    color      = Column(String(20), default="#787774")
    created_at = Column(DateTime, default=datetime.utcnow)

    files = relationship("TeacherMaterial", back_populates="folder", cascade="all, delete-orphan")


class TeacherMaterial(Base):
    __tablename__ = "teacher_materials"
    id           = Column(Integer, primary_key=True, index=True)
    folder_id    = Column(Integer, ForeignKey("teacher_folders.id"), nullable=False)
    teacher_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    name         = Column(String(200), nullable=False)
    file_type    = Column(String(20), default="doc")   # pdf | doc | ppt | link | img
    size         = Column(String(30), default="—")
    shared_with  = Column(JSON, default=[])
    created_at   = Column(DateTime, default=datetime.utcnow)
    mime_type    = Column(String(80), nullable=True)      # tipo MIME real del archivo
    original_name = Column(String(255), nullable=True)    # nombre original del archivo
    has_file     = Column(Boolean, default=False)          # indica si hay binario almacenado
    content      = deferred(Column(LargeBinary, nullable=True))  # binario (solo se carga al descargar)

    folder = relationship("TeacherFolder", back_populates="files")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _folder_out(folder: TeacherFolder) -> dict:
    return {
        "id":    folder.id,
        "name":  folder.name,
        "color": folder.color,
        "files": [
            {
                "id":           f.id,
                "name":         f.name,
                "type":         f.file_type,
                "size":         f.size,
                "date":         f.created_at.strftime("%Y-%m-%d"),
                "sharedWith":   f.shared_with or [],
                "hasFile":      bool(f.has_file),
                "mimeType":     f.mime_type,
                "originalName": f.original_name,
                "downloadUrl":  f"/api/v1/teacher/materials/files/{f.id}/download" if f.has_file else None,
            }
            for f in folder.files
        ],
    }


# ─── Helpers de archivo ──────────────────────────────────────────────────────

# Mapa de extensión -> tipo MIME para que la descarga conserve el formato real.
MIME_BY_EXT = {
    ".pdf":   "application/pdf",
    ".doc":   "application/msword",
    ".docx":  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt":   "application/vnd.ms-powerpoint",
    ".pptx":  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls":   "application/vnd.ms-excel",
    ".xlsx":  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt":   "text/plain",
    ".csv":   "text/csv",
    ".png":   "image/png",
    ".jpg":   "image/jpeg",
    ".jpeg":  "image/jpeg",
    ".gif":   "image/gif",
    ".webp":  "image/webp",
    ".svg":   "image/svg+xml",
    ".zip":   "application/zip",
    ".mp4":   "video/mp4",
    ".mp3":   "audio/mpeg",
}


def _guess_mime(filename: str) -> str:
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    return MIME_BY_EXT.get(ext, "application/octet-stream")


def _material_out(m: TeacherMaterial) -> dict:
    return {
        "id":           m.id,
        "name":         m.name,
        "type":         m.file_type,
        "size":         m.size,
        "date":         m.created_at.strftime("%Y-%m-%d"),
        "sharedWith":   m.shared_with or [],
        "hasFile":      bool(m.has_file),
        "mimeType":     m.mime_type,
        "originalName": m.original_name,
        "downloadUrl":  f"/api/v1/teacher/materials/files/{m.id}/download" if m.has_file else None,
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/materials")
async def list_materials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
):
    """Lista todas las carpetas del profesor con sus archivos."""
    folders = (
        db.query(TeacherFolder)
        .filter(TeacherFolder.teacher_id == current_user.id)
        .order_by(TeacherFolder.created_at)
        .all()
    )
    return {"folders": [_folder_out(f) for f in folders]}


@router.post("/materials/folders", status_code=201)
async def create_folder(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
):
    """Crea una nueva carpeta de materiales."""
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="El nombre es obligatorio.")
    folder = TeacherFolder(
        teacher_id=current_user.id,
        name=name,
        color=data.get("color", "#787774"),
    )
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return _folder_out(folder)


@router.delete("/materials/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
):
    """Elimina una carpeta y todos sus archivos."""
    folder = db.query(TeacherFolder).filter(
        TeacherFolder.id == folder_id,
        TeacherFolder.teacher_id == current_user.id,
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    db.delete(folder)
    db.commit()


@router.post("/materials/files", status_code=201)
async def upload_file(
    folder_id: int = Form(...),
    file: Optional[UploadFile] = File(None),
    shared_with: Optional[str] = Form(None),
    name: Optional[str] = Form(None),
    file_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
):
    """Sube un archivo real a una carpeta y guarda su binario en la DB."""
    folder = db.query(TeacherFolder).filter(
        TeacherFolder.id == folder_id,
        TeacherFolder.teacher_id == current_user.id,
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")

    # ── Enlace (no hay binario) ─────────────────────────────────────────
    if file is None:
        # Retrocompatibilidad: si llega name en vez de archivo, se crea sólo metadata.
        if name:
            mat = TeacherMaterial(
                folder_id=folder_id,
                teacher_id=current_user.id,
                name=name,
                file_type=file_type or "link",
                size="—",
                shared_with=_parse_shared(shared_with),
            )
            db.add(mat)
            db.commit()
            db.refresh(mat)
            return _material_out(mat)
        raise HTTPException(status_code=400, detail="El archivo es obligatorio.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")

    original_name = file.filename or "archivo"
    # Detectar tipo de archivo a partir de la extensión para el ícono en el frontend
    ext = ("." + original_name.rsplit(".", 1)[-1].lower()) if "." in original_name else ""
    if file_type:
        ftype = file_type
    elif ".pdf" == ext:
        ftype = "pdf"
    elif ext in (".ppt", ".pptx"):
        ftype = "ppt"
    elif ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
        ftype = "img"
    elif ext in (".doc", ".docx"):
        ftype = "doc"
    elif ext == "":
        ftype = "doc"
    else:
        ftype = "doc"

    size_mb = len(raw) / (1024 * 1024)
    size_str = f"{size_mb:.1f} MB" if size_mb >= 1 else f"{int(len(raw) / 1024)} KB"

    mat = TeacherMaterial(
        folder_id=folder_id,
        teacher_id=current_user.id,
        name=name or original_name,
        file_type=ftype,
        size=size_str,
        shared_with=_parse_shared(shared_with),
        mime_type=_guess_mime(original_name),
        original_name=original_name,
        has_file=True,
        content=raw,
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return _material_out(mat)


def _parse_shared(shared_with: Optional[str]) -> List[str]:
    """Convierte el campo de formulario 'shared_with' (JSON string) en lista."""
    if not shared_with:
        return []
    import json
    try:
        val = json.loads(shared_with)
        if isinstance(val, list):
            return [x for x in val]
    except Exception:
        return [shared_with]
    return []


@router.get("/materials/files/{file_id}/download")
async def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
):
    """Descarga el archivo real con su contenido y formato original."""
    mat = db.query(TeacherMaterial).filter(
        TeacherMaterial.id == file_id,
        TeacherMaterial.teacher_id == current_user.id,
    ).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    if not mat.content:
        raise HTTPException(status_code=404, detail="Este material no tiene archivo adjunto.")

    mime = mat.mime_type or _guess_mime(mat.original_name or mat.name)
    filename = mat.original_name or mat.name
    # Content-Disposition con filename* para soportar caracteres UTF-8
    ascii_name = "".join(ch if 32 <= ord(ch) < 127 else "_" for ch in filename)
    disposition = (
        f'attachment; filename="{ascii_name}"; '
        f"filename*=UTF-8''{quote(filename)}"
    )
    return Response(
        content=bytes(mat.content),
        media_type=mime,
        headers={"Content-Disposition": disposition, "Content-Length": str(len(mat.content))},
    )


@router.patch("/materials/files/{file_id}")
async def update_file_sharing(
    file_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
):
    """Actualiza los grupos con quienes se comparte un archivo."""
    mat = db.query(TeacherMaterial).filter(
        TeacherMaterial.id == file_id,
        TeacherMaterial.teacher_id == current_user.id,
    ).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    if "sharedWith" in data:
        mat.shared_with = data["sharedWith"]
    db.commit()
    db.refresh(mat)
    return _material_out(mat)


@router.delete("/materials/files/{file_id}", status_code=204)
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    license_info: LicenseInfo = Depends(require_teacher_module("recursos")),
    active_license: LicenseInfo = Depends(require_active_license()),
):
    """Elimina un archivo de una carpeta."""
    mat = db.query(TeacherMaterial).filter(
        TeacherMaterial.id == file_id,
        TeacherMaterial.teacher_id == current_user.id,
    ).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    db.delete(mat)
    db.commit()
