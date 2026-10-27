"""
NeuroLearn IA — Exportación de reportes académicos.

    GET /api/v1/teacher/reports/export
        ?report=resumen|quizzes|evaluaciones|estudiante   (por defecto resumen)
        &format=csv|pdf                         (por defecto csv)
        &classroom_id=<id>                      (opcional; sin él, todos los grupos del alcance)
        &student_id=<id>                        (obligatorio para el reporte estudiante)
        &start_date=AAAA-MM-DD&end_date=AAAA-MM-DD   (opcionales, hora de Colombia)

    GET /api/v1/teacher/reports/students
    GET /api/v1/teacher/reports/students/{student_id}

Devuelve el archivo para descargar (Content-Disposition: attachment).
Los reportes agregados sin filas responden 404 con el motivo. El reporte
individual conserva una fila explícita si el estudiante no tiene resultados,
para que la ausencia de evaluaciones no se confunda con un fallo. Los
endpoints de estudiantes solo incluyen estudiantes activos inscritos en los
grupos activos del profesor autenticado.
"""
import logging
from typing import Literal, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.auth import get_current_user, require_permission
from app.core.permissions import Permission
from app.db.database import get_db
from app.models.user import User
from app.services.teacher_report_service import (
    ReportError,
    build_report,
    build_student_detail,
    list_report_students,
    parse_day,
    to_csv,
    to_pdf,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teacher", tags=["Teacher - Reports"])


@router.get("/reports/students")
def get_report_students(
    classroom_id: Optional[int] = Query(None, description="ID del grupo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.EXPORTAR_REPORTES)),
):
    """Lista a los estudiantes activos de los grupos que el profesor puede consultar."""
    try:
        return {"items": list_report_students(db, current_user, classroom_id)}
    except ReportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/reports/students/{student_id}")
def get_student_report(
    student_id: int,
    classroom_id: Optional[int] = Query(None, description="Limita la ficha a un grupo"),
    start_date: Optional[str] = Query(None, description="Fecha inicio AAAA-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha fin AAAA-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.EXPORTAR_REPORTES)),
):
    """Devuelve datos académicos y neurodigitales disponibles de un estudiante autorizado."""
    try:
        return build_student_detail(
            db, current_user, student_id, classroom_id,
            parse_day(start_date, "La fecha inicial"),
            parse_day(end_date, "La fecha final"),
        )
    except ReportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc


@router.get("/reports/export")
def export_reports(
    report: Literal["resumen", "quizzes", "evaluaciones", "estudiante"] = Query("resumen"),
    format: Literal["csv", "pdf"] = Query("csv"),
    classroom_id: Optional[int] = Query(None, description="ID del grupo"),
    student_id: Optional[int] = Query(None, description="ID del estudiante para reporte individual"),
    start_date: Optional[str] = Query(None, description="Fecha inicio AAAA-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha fin AAAA-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.EXPORTAR_REPORTES)),
):
    """Genera y descarga el reporte académico con datos reales."""
    try:
        data = build_report(
            db, current_user, report, classroom_id,
            parse_day(start_date, "La fecha inicial"),
            parse_day(end_date, "La fecha final"),
            student_id,
        )
    except ReportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)

    if format == "pdf":
        content, media_type, ext = to_pdf(data), "application/pdf", "pdf"
    else:
        content, media_type, ext = to_csv(data), "text/csv; charset=utf-8", "csv"

    filename = f"{data.filename_base}.{ext}"

    # Automatizaciones «Reporte generado» del docente (antes nunca se disparaba).
    try:
        from app.services import integration_service as _isvc
        _isvc.dispatch_trigger(db, current_user, "reporte_generado", {
            "event_desc": f"Reporte generado: {filename}",
            "message": f"Generaste el reporte «{filename}» ({len(data.rows)} filas).",
            "title": f"Reporte {filename}",
            "report": data.kind, "format": ext, "rows": len(data.rows),
        }, owner_id=current_user.id)
    except Exception:  # noqa: BLE001 — una automatización no impide descargar
        logger.exception("No se pudieron ejecutar las automatizaciones del reporte")
        db.rollback()
    logger.info(
        "Reporte %s (%s) exportado por usuario %s: %d filas",
        data.kind, ext, current_user.id, len(data.rows),
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}",
            "X-Report-Rows": str(len(data.rows)),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Rows",
        },
    )
