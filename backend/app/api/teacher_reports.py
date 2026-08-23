"""
NeuroLearn AI — Exportación de Reportes
=======================================
Endpoints para exportar reportes académicos en PDF y CSV
"""
import csv, io
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from pydantic import BaseModel

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User, UserRole
from app.models.learning import LearningSession, QuizHistory

router = APIRouter(prefix="/teacher", tags=["Teacher - Reports"])


class ReportFilter(BaseModel):
    class Config:
        json_schema_extra = {
            "example": {
                "classroom_id": 1,
                "start_date": "2026-01-01",
                "end_date": "2026-01-31",
                "format": "csv"  # csv o pdf
            }
        }


def _parse_date(value: Optional[str], label: str) -> Optional[datetime]:
    if value is None:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{label} inválida, use YYYY-MM-DD")


# ─── GET /teacher/reports/export ──────────────────────────────────────────────
@router.get("/reports/export")
async def export_reports(
    classroom_id: Optional[int] = Query(None, description="ID de la clase"),
    start_date: Optional[str] = Query(None, description="Fecha inicio YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Fecha fin YYYY-MM-DD"),
    format: str = Query("csv", description="Formato: csv o pdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Exporta reportes académicos.

    - CSV: Datos crudos para análisis
    - PDF: Reporte formateado con estadísticas
    """
    if current_user.role not in [UserRole.PROFESOR.value, UserRole.SUPER_PROFESOR.value]:
        raise HTTPException(status_code=403, detail="Solo profesores pueden exportar reportes")

    # Filtrar quiz history
    query = db.query(QuizHistory).options(
        joinedload(QuizHistory.user),
        joinedload(QuizHistory.session).joinedload(LearningSession.bot)
    )
    if classroom_id:
        query = query.filter(QuizHistory.classroom_id == classroom_id)

    start = _parse_date(start_date, "Fecha inicio")
    end = _parse_date(end_date, "Fecha fin")
    if start:
        query = query.filter(QuizHistory.completed_at >= start)
    if end:
        query = query.filter(QuizHistory.completed_at < end + timedelta(days=1))

    quizzes = query.order_by(QuizHistory.completed_at.desc()).all()

    # ─── Estadísticas (usando campos reales de LearningSession / QuizHistory) ──
    total_sessions = len(quizzes)
    total_students = len({q.user_id for q in quizzes if q.user_id})
    avg_duration = (sum((q.time_spent_seconds or 0) for q in quizzes) / 60) / total_sessions if total_sessions else 0
    scored = [q.performance_score for q in quizzes if q.performance_score is not None]
    avg_score = sum(scored) / len(scored) if scored else 0

    # ─── Generar CSV ────────────────────────────────────────────────────────────
    csv_buffer = io.StringIO()
    writer = csv.writer(csv_buffer)
    writer.writerow(["id", "student_id", "student_name", "bot_name", "session_date",
                     "duration_minutes", "topics_covered", "performance_score"])

    for q in quizzes:
        # duration in minutes from time_spent_seconds
        duration_minutes = int((q.time_spent_seconds or 0) // 60)
        # topics_covered: use topic (o quiz_title como respaldo)
        topics_covered = q.topic or q.quiz_title or ""
        bot = q.session.bot if q.session else None
        bot_name = bot.name if bot else ""
        session_date = (q.completed_at or q.created_at).strftime("%Y-%m-%d %H:%M") if (q.completed_at or q.created_at) else ""
        writer.writerow([
            q.id,
            q.user_id,
            q.user.full_name if q.user else "",
            bot_name,
            session_date,
            duration_minutes,
            topics_covered,
            q.performance_score or 0
        ])

    if format == "csv":
        return {
            "format": "csv",
            "rows": csv_buffer.getvalue().strip().split('\n'),
            "filename": f"reporte_{current_user.username}_{datetime.now().strftime('%Y%m%d_%H%M')}.csv"
        }

    # ─── Generar PDF (requiere librería reportlab) ─────────────────────────────
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.pdfgen import canvas
        import io as io_lib
    except ImportError:
        raise HTTPException(status_code=400, detail="Instalar reportlab: pip install reportlab")

    pdf_buffer = io_lib.BytesIO()
    c = canvas.Canvas(pdf_buffer, pagesize=A4)
    width, height = A4

    # Header
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, height - 50, "Reporte Académico NeuroLearn AI")
    c.setFont("Helvetica", 12)
    c.drawString(50, height - 80, f"Profesor: {current_user.full_name}")
    c.drawString(50, height - 100, f"Fecha: {datetime.now().strftime('%d/%m/%Y %H:%M')}")

    # Stats
    c.setFont("Helvetica-Bold", 12)
    y_pos = height - 130
    c.drawString(50, y_pos, "Estadísticas:")
    c.setFont("Helvetica", 10)
    y_pos -= 20

    c.drawString(70, y_pos, f"Evaluaciones: {total_sessions}")
    c.drawString(70, y_pos - 20, f"Estudiantes únicos: {total_students}")
    c.drawString(70, y_pos - 40, f"Duración promedio: {avg_duration:.1f} min")
    c.drawString(70, y_pos - 60, f"Puntaje promedio: {avg_score:.1f}")

    c.save()
    pdf_buffer.seek(0)

    return {
        "format": "pdf",
        "filename": f"reporte_{current_user.username}_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf",
        "content": pdf_buffer.read()
    }