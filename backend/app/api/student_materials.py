"""
Material compartido por los profesores — vista del estudiante (parche 14C).

  GET /student/materials                  materiales compartidos con sus grupos
  GET /student/materials/{id}/download    descarga autorizada

Un estudiante solo ve los materiales que un profesor compartió con un grupo
activo en el que él está inscrito (inscripción activa). Antes la página
«Material de apoyo» solo mostraba un catálogo fijo de PDFs y lo que subía el
profesor nunca llegaba al estudiante.
"""
from typing import Dict, List, Set
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_permission
from app.api.teacher_materials import (
    TeacherFolder, TeacherMaterial, _guess_mime, material_url, shared_ids,
)
from app.core.permissions import Permission
from app.db.database import get_db
from app.models.classroom import Classroom, Enrollment
from app.models.user import User

router = APIRouter(prefix="/student/materials", tags=["Estudiante - Materiales"])


def _my_classrooms(db: Session, student: User) -> Dict[int, Classroom]:
    rows = (
        db.query(Classroom)
        .join(Enrollment, Enrollment.classroom_id == Classroom.id)
        .filter(
            Enrollment.student_id == student.id,
            Enrollment.is_active == True,  # noqa: E712
            Classroom.is_active == True,  # noqa: E712
        )
        .all()
    )
    return {c.id: c for c in rows}


def _visible(db: Session, student: User) -> List[tuple]:
    """(material, ids de mis grupos con los que está compartido)."""
    groups = _my_classrooms(db, student)
    if not groups:
        return [], groups
    teacher_ids: Set[int] = {c.teacher_id for c in groups.values()}
    rows = db.query(TeacherMaterial).filter(TeacherMaterial.teacher_id.in_(teacher_ids)).all()
    out = []
    for m in rows:
        mine = [cid for cid in shared_ids(m) if cid in groups and groups[cid].teacher_id == m.teacher_id]
        if mine:
            out.append((m, mine))
    return out, groups


@router.get("")
async def list_my_materials(
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
    db: Session = Depends(get_db),
):
    visible, groups = _visible(db, current_user)
    teachers = {u.id: u for u in db.query(User).filter(
        User.id.in_({m.teacher_id for m, _ in visible})).all()} if visible else {}
    folders = {f.id: f for f in db.query(TeacherFolder).filter(
        TeacherFolder.id.in_({m.folder_id for m, _ in visible})).all()} if visible else {}
    items = []
    for m, mine in sorted(visible, key=lambda x: x[0].created_at or 0, reverse=True):
        teacher = teachers.get(m.teacher_id)
        items.append({
            "id": m.id,
            "name": m.name,
            "type": m.file_type,
            "size": m.size,
            "date": m.created_at.strftime("%Y-%m-%d") if m.created_at else "",
            "folder": folders[m.folder_id].name if m.folder_id in folders else None,
            "teacher": (teacher.full_name or teacher.username) if teacher else "Profesor",
            "groups": [groups[cid].name for cid in mine],
            "hasFile": bool(m.has_file),
            "url": material_url(m),
        })
    return {"materials": items, "total": len(items)}


@router.get("/{material_id}/download")
async def download_my_material(
    material_id: int,
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.PARTICIPAR_EN_AULAS)),
    db: Session = Depends(get_db),
):
    visible, _ = _visible(db, current_user)
    mat = next((m for m, _ in visible if m.id == material_id), None)
    if mat is None:
        raise HTTPException(status_code=404, detail="Material no encontrado.")
    if not mat.has_file or not mat.content:
        raise HTTPException(status_code=404, detail="Este material no tiene archivo para descargar.")
    filename = mat.original_name or mat.name
    ascii_name = "".join(ch if 32 <= ord(ch) < 127 and ch != '"' else "_" for ch in filename)
    return Response(
        content=bytes(mat.content),
        media_type=mat.mime_type or _guess_mime(filename),
        headers={
            "Content-Disposition": f'attachment; filename="{ascii_name}"; filename*=UTF-8\'\'{quote(filename)}',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
