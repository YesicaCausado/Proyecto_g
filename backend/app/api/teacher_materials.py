"""
NeuroLearn AI - Materiales del Profesor
CRUD para carpetas y archivos de material didáctico.
Los archivos se almacenan como registros en DB (metadata); el binario
queda en el cliente/storage externo. Por ahora solo guardamos metadata.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Column, Integer, String, DateTime, JSON, ForeignKey
from sqlalchemy.orm import Session, relationship
from datetime import datetime
from typing import List

from app.db.database import Base, get_db
from app.api.auth import get_current_user
from app.models.user import User

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
    id          = Column(Integer, primary_key=True, index=True)
    folder_id   = Column(Integer, ForeignKey("teacher_folders.id"), nullable=False)
    teacher_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    name        = Column(String(200), nullable=False)
    file_type   = Column(String(20), default="doc")   # pdf | doc | ppt | link | img
    size        = Column(String(30), default="—")
    shared_with = Column(JSON, default=[])
    created_at  = Column(DateTime, default=datetime.utcnow)

    folder = relationship("TeacherFolder", back_populates="files")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _folder_out(folder: TeacherFolder) -> dict:
    return {
        "id":    folder.id,
        "name":  folder.name,
        "color": folder.color,
        "files": [
            {
                "id":          f.id,
                "name":        f.name,
                "type":        f.file_type,
                "size":        f.size,
                "date":        f.created_at.strftime("%Y-%m-%d"),
                "sharedWith":  f.shared_with or [],
            }
            for f in folder.files
        ],
    }


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/materials")
async def list_materials(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Registra metadata de un archivo en una carpeta."""
    folder_id = data.get("folder_id")
    if not folder_id:
        raise HTTPException(status_code=400, detail="folder_id es obligatorio.")
    folder = db.query(TeacherFolder).filter(
        TeacherFolder.id == folder_id,
        TeacherFolder.teacher_id == current_user.id,
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Carpeta no encontrada.")

    mat = TeacherMaterial(
        folder_id=folder_id,
        teacher_id=current_user.id,
        name=data.get("name", "Archivo"),
        file_type=data.get("type", "doc"),
        size=data.get("size", "—"),
        shared_with=data.get("sharedWith", []),
    )
    db.add(mat)
    db.commit()
    db.refresh(mat)
    return {
        "id":         mat.id,
        "name":       mat.name,
        "type":       mat.file_type,
        "size":       mat.size,
        "date":       mat.created_at.strftime("%Y-%m-%d"),
        "sharedWith": mat.shared_with or [],
    }


@router.patch("/materials/files/{file_id}")
async def update_file_sharing(
    file_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
    return {
        "id":         mat.id,
        "name":       mat.name,
        "type":       mat.file_type,
        "size":       mat.size,
        "date":       mat.created_at.strftime("%Y-%m-%d"),
        "sharedWith": mat.shared_with or [],
    }


@router.delete("/materials/files/{file_id}", status_code=204)
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
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
