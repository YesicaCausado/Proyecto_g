"""
NeuroLearn AI — License API
============================
Expone el estado de licencia del usuario autenticado.
El frontend lo consume al iniciar sesión para construir el menú dinámicamente.
"""
from fastapi import APIRouter, Depends
from app.api.auth import get_current_user
from app.models.user import User
from app.db.database import get_db
from app.services.license_service import get_license_for_user
from sqlalchemy.orm import Session

router = APIRouter(prefix="/license", tags=["Licencia"])


@router.get("/my-license")
async def my_license(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Devuelve la licencia activa del usuario autenticado.
    Incluye: tipo, estado, días restantes, módulos permitidos (profesor y estudiante),
    KPI cards del dashboard, límite de NeuroBots y formatos de exportación.
    """
    info = get_license_for_user(current_user, db)
    return info.to_dict()
