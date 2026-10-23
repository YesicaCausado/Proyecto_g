"""
NeuroLearn AI - Materiales del Profesor

Carpetas y archivos del profesor. El binario se guarda en la base (columna
`content`). Compartir un material = guardar en `shared_with` los ids de
grupos PROPIOS del profesor (antes se guardaban nombres de una lista de
grupos de prueba del frontend). Los estudiantes de esos grupos lo ven en
«Material de apoyo» (api/student_materials.py) y reciben una notificación.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey, LargeBinary, Boolean
from sqlalchemy.orm import Session, relationship, deferred
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

from app.db.database import Base, get_db
from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.models.user import User
from app.models.classroom import Classroom

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

MAX_FILE_BYTES = 4 * 1024 * 1024   # Vercel limita cada petición a ~4,5 MB
LINK_MIME = "link-url"             # enlace externo: la URL va en original_name
DRIVE_MIME = "drive-link"          # importado de Google Drive (parche 13B)


def own_classrooms(db: Session, teacher: User) -> dict:
    """Grupos activos del profesor, por id."""
    rows = db.query(Classroom).filter(
        Classroom.teacher_id == teacher.id, Classroom.is_active == True,  # noqa: E712
    ).all()
    return {c.id: c for c in rows}


def shared_ids(m: "TeacherMaterial") -> List[int]:
    """Ids de grupo guardados en shared_with (se ignoran valores antiguos)."""
    out = []
    for x in (m.shared_with or []):
        if isinstance(x, int) or (isinstance(x, str) and x.isdigit()):
            out.append(int(x))
    return out


def material_url(m: "TeacherMaterial") -> Optional[str]:
    if m.mime_type in (LINK_MIME, DRIVE_MIME) and (m.original_name or "").startswith(("https://", "http://")):
        return m.original_name
    return None


def _clean_share(db: Session, teacher: User, raw) -> List[int]:
    """Valida que cada grupo sea del profesor. Acepta ids (o nombres de sus
    grupos, por compatibilidad). Un grupo ajeno o inexistente → 400."""
    if raw in (None, "", []):
        return []
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="Los grupos deben enviarse como lista.")
    groups = own_classrooms(db, teacher)
    by_name = {c.name.strip().lower(): cid for cid, c in groups.items()}
    ids: List[int] = []
    for x in raw:
        cid = None
        if isinstance(x, int) or (isinstance(x, str) and x.strip().isdigit()):
            cid = int(x)
        elif isinstance(x, str):
            cid = by_name.get(x.strip().lower())
        if cid is None or cid not in groups:
            raise HTTPException(status_code=400,
                                detail="Solo puedes compartir con tus propios grupos activos.")
        if cid not in ids:
            ids.append(cid)
    return ids


def _file_out(f: "TeacherMaterial", groups: dict) -> dict:
    ids = shared_ids(f)
    return {
        "id":           f.id,
        "name":         f.name,
        "type":         f.file_type,
        "size":         f.size,
        "date":         f.created_at.strftime("%Y-%m-%d") if f.created_at else "",
        "sharedWith":   [cid for cid in ids if cid in groups],
        "sharedGroups": [{"id": cid, "name": groups[cid].name} for cid in ids if cid in groups],
        "hasFile":      bool(f.has_file),
        "mimeType":     f.mime_type if f.mime_type not in (LINK_MIME, DRIVE_MIME) else None,
        "originalName": f.original_name if not material_url(f) else None,
        "downloadUrl":  f"/api/v1/teacher/materials/files/{f.id}/download" if f.has_file else None,
        "url":          material_url(f),
        "fromDrive":    f.mime_type == DRIVE_MIME,
    }


def _folder_out(folder: "TeacherFolder", groups: dict) -> dict:
    return {
        "id":    folder.id,
        "name":  folder.name,
        "color": folder.color,
        "files": [_file_out(f, groups) for f in folder.files],
    }


def _notify_students(db: Session, teacher: User, mat: "TeacherMaterial", classroom_ids: List[int]) -> None:
    """Avisa a los estudiantes de los grupos con los que se acaba de compartir."""
    if not classroom_ids:
        return
    from app.models.classroom import Enrollment
    from app.services import notification_service
    groups = own_classrooms(db, teacher)
    for cid in classroom_ids:
        students = [sid for (sid,) in db.query(Enrollment.student_id).filter(
            Enrollment.classroom_id == cid, Enrollment.is_active == True).all()]  # noqa: E712
        if not students:
            continue
        notification_service.notify(
            db, students, "material_compartido", "Nuevo material",
            f'{teacher.full_name or teacher.username} compartió «{mat.name}» con el grupo '
            f'{groups[cid].name}.' if cid in groups else f"Nuevo material: «{mat.name}».",
            link="/material", resource_type="material", resource_id=mat.id,
        )


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


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/materials")
async def list_materials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
):
    """Lista todas las carpetas del profesor con sus archivos."""
    folders = (
        db.query(TeacherFolder)
        .filter(TeacherFolder.teacher_id == current_user.id)
        .order_by(TeacherFolder.created_at)
        .all()
    )
    groups = own_classrooms(db, current_user)
    return {
        "folders": [_folder_out(f, groups) for f in folders],
        "groups": [{"id": c.id, "name": c.name} for c in sorted(groups.values(), key=lambda c: c.name)],
    }


@router.post("/materials/folders", status_code=201)
async def create_folder(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
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
    return _folder_out(folder, {})


@router.delete("/materials/folders/{folder_id}", status_code=204)
async def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
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
    url: Optional[str] = Form(None),
    file_type: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
):
    """Sube un archivo (o registra un enlace) en una carpeta del profesor,
    opcionalmente compartido con sus grupos."""
    folder = db.query(TeacherFolder).filter(
        TeacherFolder.id == folder_id,
        TeacherFolder.teacher_id == current_user.id,
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")
    share = _clean_share(db, current_user, _parse_shared(shared_with))

    if file is None:
        # Enlace externo (sin binario): exige una URL válida.
        link = (url or "").strip()
        if not link.startswith(("https://", "http://")) or len(link) > 255:
            raise HTTPException(status_code=400, detail="Escribe un enlace válido que empiece por https://.")
        mat = TeacherMaterial(
            folder_id=folder_id, teacher_id=current_user.id,
            name=((name or "").strip() or link)[:200], file_type="link", size="—",
            shared_with=share, original_name=link, mime_type=LINK_MIME, has_file=False,
        )
    else:
        raw = await file.read()
        if not raw:
            raise HTTPException(status_code=400, detail="El archivo está vacío.")
        if len(raw) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="El archivo supera el máximo de 4 MB.")
        original_name = file.filename or "archivo"
        ext = ("." + original_name.rsplit(".", 1)[-1].lower()) if "." in original_name else ""
        if ext == ".pdf":
            ftype = "pdf"
        elif ext in (".ppt", ".pptx"):
            ftype = "ppt"
        elif ext in (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"):
            ftype = "img"
        else:
            ftype = "doc"
        size_mb = len(raw) / (1024 * 1024)
        mat = TeacherMaterial(
            folder_id=folder_id, teacher_id=current_user.id,
            name=((name or "").strip() or original_name)[:200], file_type=ftype,
            size=f"{size_mb:.1f} MB" if size_mb >= 1 else f"{max(1, int(len(raw) / 1024))} KB",
            shared_with=share, mime_type=_guess_mime(original_name),
            original_name=original_name[:255], has_file=True, content=raw,
        )
    db.add(mat)
    db.flush()
    _notify_students(db, current_user, mat, share)
    db.commit()
    db.refresh(mat)
    return _file_out(mat, own_classrooms(db, current_user))


@router.post("/materials/attachments", status_code=201)
async def upload_post_attachment(
    classroom_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
):
    """Adjunto de una publicación del Tablero: se guarda como material en la
    carpeta «Adjuntos del Tablero», compartido con el grupo de la publicación.
    Antes el Tablero solo guardaba el nombre del archivo."""
    if classroom_id not in own_classrooms(db, current_user):
        raise HTTPException(status_code=404, detail="Grupo no encontrado.")
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="El archivo está vacío.")
    if len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail="El archivo supera el máximo de 4 MB.")
    folder = db.query(TeacherFolder).filter(
        TeacherFolder.teacher_id == current_user.id, TeacherFolder.name == "Adjuntos del Tablero",
    ).first()
    if folder is None:
        folder = TeacherFolder(teacher_id=current_user.id, name="Adjuntos del Tablero", color="#6940A5")
        db.add(folder)
        db.flush()
    original_name = (file.filename or "adjunto")[:255]
    size_mb = len(raw) / (1024 * 1024)
    mat = TeacherMaterial(
        folder_id=folder.id, teacher_id=current_user.id, name=original_name[:200],
        file_type="pdf" if original_name.lower().endswith(".pdf") else "doc",
        size=f"{size_mb:.1f} MB" if size_mb >= 1 else f"{max(1, int(len(raw) / 1024))} KB",
        shared_with=[classroom_id], mime_type=_guess_mime(original_name),
        original_name=original_name, has_file=True, content=raw,
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return {"id": mat.id, "name": mat.name}


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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
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
    ascii_name = "".join(ch if 32 <= ord(ch) < 127 and ch != '"' else "_" for ch in filename)
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
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
):
    """Actualiza los grupos con quienes se comparte un archivo (solo grupos
    propios del profesor; lista vacía = solo el profesor)."""
    mat = db.query(TeacherMaterial).filter(
        TeacherMaterial.id == file_id,
        TeacherMaterial.teacher_id == current_user.id,
    ).first()
    if not mat:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    if "sharedWith" in data:
        before = set(shared_ids(mat))
        share = _clean_share(db, current_user, data["sharedWith"])
        mat.shared_with = share
        _notify_students(db, current_user, mat, [cid for cid in share if cid not in before])
    db.commit()
    db.refresh(mat)
    return _file_out(mat, own_classrooms(db, current_user))


@router.delete("/materials/files/{file_id}", status_code=204)
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.GESTIONAR_MATERIALES)),
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
