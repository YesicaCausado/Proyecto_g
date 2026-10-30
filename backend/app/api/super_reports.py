"""
NeuroLearn IA — API de Reportes institucionales del Súper Profesor.

Filtros comunes (query string, todos opcionales):
    start_date, end_date   AAAA-MM-DD (hora de Colombia). Con ambos se calcula
                           la comparación con el período anterior de igual duración.
    classroom_id, teacher_id, student_id
    competency             matematicas | lectora | ingles | ciudadanas | cientifico
    source                 todas | quiz | evaluacion
    eval_status            borrador | publicada | cerrada (solo evaluaciones)
    threshold, min_results criterios del seguimiento académico.
    period_id               período académico de la institución; reemplaza el
                            rango de fechas y compara con el período académico
                            anterior cuando existe.

Endpoints:
    GET /super/reports/filters
    GET /super/reports/overview
    GET /super/reports/competencies/{key}
    GET /super/reports/groups/{group_id}
    GET /super/reports/teachers/{teacher_pk}
    GET /super/reports/students
    GET /super/reports/students/{student_pk}
    GET /super/reports/evaluations
    GET /super/reports/evaluations/{evaluation_id}
    GET /super/reports/followup
    GET /super/reports/export

Solo Súper Profesor o administrador autorizado.
El aislamiento institucional se gestiona en super_report_service.py.
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

router = APIRouter(
    prefix="/super/reports",
    tags=["Super Profesor - Reportes"],
)


# ============================================================
# FILTROS
# ============================================================

def report_filters(
    start_date: Optional[str] = Query(
        None,
        description="Fecha inicial AAAA-MM-DD",
    ),
    end_date: Optional[str] = Query(
        None,
        description="Fecha final AAAA-MM-DD",
    ),
    classroom_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),
    student_id: Optional[int] = Query(None),
    competency: Optional[str] = Query(None),
    source: str = Query("todas"),
    eval_status: Optional[str] = Query(None),
    threshold: float = Query(svc.REFERENCE_THRESHOLD),
    min_results: int = Query(svc.DEFAULT_MIN_RESULTS),
    period_id: Optional[int] = Query(None, ge=1),
) -> svc.Filters:
    """
    Construye y valida los filtros de los reportes.

    Los errores de validación conservan el código HTTP y el mensaje
    definidos por ReportError.
    """
    try:
        filters = svc.Filters(
            start=parse_day(start_date, "La fecha inicial"),
            end=parse_day(end_date, "La fecha final"),
            classroom_id=classroom_id,
            teacher_id=teacher_id,
            student_id=student_id,
            competency=competency or None,
            source=source or "todas",
            eval_status=eval_status or None,
            threshold=threshold,
            min_results=min_results,
            period_id=period_id,
        )

        return filters.validate()

    except ReportError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc


# ============================================================
# MANEJO CENTRALIZADO DE ERRORES
# ============================================================

def _run(fn, *args, **kwargs):
    """
    Ejecuta una operación del módulo de reportes.

    - ReportError: conserva su código HTTP y mensaje.
    - HTTPException: conserva la respuesta HTTP original.
    - Excepciones inesperadas: registra el traceback y devuelve
      un error 500 sin exponer detalles internos.

    No convierte los errores en respuestas exitosas ni inventa datos.
    """
    try:
        return fn(*args, **kwargs)

    except ReportError as exc:
        logger.warning(
            "Error controlado en reportes. Operación=%s, código=%s, motivo=%s",
            getattr(fn, "__name__", "desconocida"),
            exc.status_code,
            exc.message,
        )

        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc

    except HTTPException:
        # No transformar errores HTTP intencionales en errores 500.
        raise

    except Exception:
        # Registra el traceback completo en el servidor.
        # No se exponen detalles internos al cliente.
        logger.exception(
            "Error inesperado al ejecutar la operación de reportes: %s",
            getattr(fn, "__name__", "desconocida"),
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "No fue posible procesar el reporte. "
                "Inténtalo nuevamente o contacta al administrador."
            ),
        ) from None


# ============================================================
# OPCIONES DE FILTROS
# ============================================================

@router.get("/filters")
def get_filters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.filter_options,
        db,
        current_user,
    )


# ============================================================
# RESUMEN INSTITUCIONAL
# ============================================================

@router.get("/overview")
def get_overview(
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.overview,
        db,
        current_user,
        filters,
    )


# ============================================================
# DETALLE POR COMPETENCIA
# ============================================================

@router.get("/competencies/{key}")
def get_competency(
    key: str,
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.competency_detail,
        db,
        current_user,
        filters,
        key,
    )


# ============================================================
# DETALLE POR GRUPO
# ============================================================

@router.get("/groups/{group_id}")
def get_group(
    group_id: int,
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.group_detail,
        db,
        current_user,
        filters,
        group_id,
    )


# ============================================================
# DETALLE POR PROFESOR
# ============================================================

@router.get("/teachers/{teacher_pk}")
def get_teacher(
    teacher_pk: int,
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.teacher_detail,
        db,
        current_user,
        filters,
        teacher_pk,
    )


# ============================================================
# LISTADO PAGINADO DE ESTUDIANTES
# ============================================================

@router.get("/students")
def get_students(
    q: str = Query("", max_length=100),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # El listado permite buscar estudiantes sin quedar limitado
    # por un student_id recibido accidentalmente en los filtros.
    filters.student_id = None

    return _run(
        svc.student_list,
        db,
        current_user,
        filters,
        q,
        page,
        size,
    )


# ============================================================
# FICHA INDIVIDUAL DEL ESTUDIANTE
# ============================================================

@router.get("/students/{student_pk}")
def get_student(
    student_pk: int,
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.student_detail,
        db,
        current_user,
        filters,
        student_pk,
    )


# ============================================================
# LISTADO DE EVALUACIONES
# ============================================================

@router.get("/evaluations")
def get_evaluations(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.evaluations_report,
        db,
        current_user,
        filters,
        page,
        size,
    )


# ============================================================
# DETALLE DE UNA EVALUACIÓN
# ============================================================

@router.get("/evaluations/{evaluation_id}")
def get_evaluation(
    evaluation_id: int,
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.evaluation_detail,
        db,
        current_user,
        filters,
        evaluation_id,
    )


# ============================================================
# SEGUIMIENTO ACADÉMICO
# ============================================================

@router.get("/followup")
def get_followup(
    rule: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _run(
        svc.followup_report,
        db,
        current_user,
        filters,
        rule,
        page,
        size,
    )


# ============================================================
# EXPORTACIÓN PDF Y CSV
# ============================================================

@router.get("/export")
def export_report(
    section: str = Query("resumen"),
    format: Literal["csv", "pdf"] = Query("pdf"),
    filters: svc.Filters = Depends(report_filters),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _authorized: User = Depends(
        require_permission(Permission.EXPORTAR_REPORTES)
    ),
):
    # Construcción del documento.
    doc = _run(
        export_svc.build_export,
        db,
        current_user,
        filters,
        section,
    )

    # Generación del archivo.
    if format == "pdf":
        content, media_type = _run(
            export_svc.to_pdf,
            doc,
        ), "application/pdf"
    else:
        content, media_type = _run(
            export_svc.to_csv,
            doc,
        ), "text/csv; charset=utf-8"

    filename = f"{doc.filename_base}.{format}"

    logger.info(
        "Reporte institucional exportado. "
        "Sección=%s, formato=%s, usuario=%s",
        section,
        format,
        current_user.id,
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{filename}"; '
                f"filename*=UTF-8''{quote(filename)}"
            ),
            "X-Report-Rows": str(doc.table_rows()),
            "Access-Control-Expose-Headers": (
                "Content-Disposition, X-Report-Rows"
            ),
        },
    )