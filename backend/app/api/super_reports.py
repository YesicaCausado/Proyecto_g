"""
NeuroLearn IA — API de Reportes institucionales del Súper Profesor.

Filtros comunes (query string, todos opcionales):
    start_date, end_date   AAAA-MM-DD (hora de Colombia). Con ambos se calcula
                           la comparación con el período anterior de igual duración.
    classroom_id, teacher_id, student_id
    competency             matematicas | lectora | ingles | ciudadanas | cientifico
    source                 todas | quiz | evaluacion
    eval_status            borrador | publicada | cerrada (solo reporte de evaluaciones)
    threshold, min_results criterios del seguimiento académico (60 y 3 por defecto)

Endpoints:
    GET /super/reports/filters                 opciones de los filtros (grupos, profesores…)
    GET /super/reports/overview                resumen, competencias, grupos, profesores,
                                               evolución y calidad de datos
    GET /super/reports/competencies/{key}      detalle de una competencia
    GET /super/reports/groups/{id}             detalle de un grupo
    GET /super/reports/teachers/{id}           detalle de un profesor
    GET /super/reports/students                buscador paginado (?q=&page=&size=)
    GET /super/reports/students/{id}           ficha académica del estudiante
    GET /super/reports/evaluations             evaluaciones e indicadores (paginado)
    GET /super/reports/evaluations/{id}        detalle de una evaluación
    GET /super/reports/followup                seguimiento académico (paginado, ?rule=)
    GET /super/reports/export                  ?section=…&format=csv|pdf

Solo Súper Profesor (o administrador con institución); todo se limita a la
institución del usuario en app/services/super_report_service.py.
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
from app.services import super_report_export as export_svc
from app.services import super_report_service as svc
from app.services.teacher_report_service import ReportError, parse_day

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/super/reports", tags=["Super Profesor - Reportes"])


def report_filters(
    start_date: Optional[str] = Query(None, description="Fecha inicial AAAA-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha final AAAA-MM-DD"),
    classroom_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    competency: Optional[str] = Query(None),
    source: str = Query("todas"),
    eval_status: Optional[str] = Query(None),
    threshold: float = Query(svc.REFERENCE_THRESHOLD),
    min_results: int = Query(svc.DEFAULT_MIN_RESULTS),
) -> svc.Filters:
    try:
        return svc.Filters(
            start=parse_day(start_date, "La fecha inicial"),
            end=parse_day(end_date, "La fecha final"),
            classroom_id=classroom_id, teacher_id=teacher_id, student_id=student_id,
            competency=competency or None, source=source or "todas", eval_status=eval_status or None,
            threshold=threshold, min_results=min_results,
        ).validate()
    except ReportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


def _run(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ReportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message)


@router.get("/filters")
def get_filters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _run(svc.filter_options, db, current_user)


@router.get("/overview")
def get_overview(filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    return _run(svc.overview, db, current_user, filters)


@router.get("/competencies/{key}")
def get_competency(key: str, filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    return _run(svc.competency_detail, db, current_user, filters, key)


@router.get("/groups/{group_id}")
def get_group(group_id: int, filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
              current_user: User = Depends(get_current_user)):
    return _run(svc.group_detail, db, current_user, filters, group_id)


@router.get("/teachers/{teacher_pk}")
def get_teacher(teacher_pk: int, filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    return _run(svc.teacher_detail, db, current_user, filters, teacher_pk)


@router.get("/students")
def get_students(q: str = Query("", max_length=100), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                 filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    filters.student_id = None
    return _run(svc.student_list, db, current_user, filters, q, page, size)


@router.get("/students/{student_pk}")
def get_student(student_pk: int, filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    return _run(svc.student_detail, db, current_user, filters, student_pk)


@router.get("/evaluations")
def get_evaluations(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                    filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                    current_user: User = Depends(get_current_user)):
    return _run(svc.evaluations_report, db, current_user, filters, page, size)


@router.get("/evaluations/{evaluation_id}")
def get_evaluation(evaluation_id: int, filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                   current_user: User = Depends(get_current_user)):
    return _run(svc.evaluation_detail, db, current_user, filters, evaluation_id)


@router.get("/followup")
def get_followup(rule: Optional[str] = Query(None), page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                 filters: svc.Filters = Depends(report_filters), db: Session = Depends(get_db),
                 current_user: User = Depends(get_current_user)):
    return _run(svc.followup_report, db, current_user, filters, rule, page, size)


@router.get("/export")
def export_report(
    section: str = Query("resumen"),
    format: Literal["csv", "pdf"] = Query("pdf"),
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(require_permission(Permission.EXPORTAR_REPORTES)),
):
    doc = _run(export_svc.build_export, db, current_user, filters, section)
    if format == "pdf":
        content, media_type = export_svc.to_pdf(doc), "application/pdf"
    else:
        content, media_type = export_svc.to_csv(doc), "text/csv; charset=utf-8"
    filename = f"{doc.filename_base}.{format}"
    logger.info("Reporte institucional %s (%s) exportado por usuario %s", section, format, current_user.id)
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}",
            "X-Report-Rows": str(doc.table_rows()),
            "Access-Control-Expose-Headers": "Content-Disposition, X-Report-Rows",
        },
    )
