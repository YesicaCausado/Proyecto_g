"""
NeuroLearn AI - API de Estadísticas (MODIFICADO)
=================================================

Actualizado para eliminar el sistema de licencias.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.api.auth import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.quiz import Quiz, QuizHistory
from app.models.classroom import Classroom
from app.models.classroom_user import ClassroomUser
from app.services.license_service import require_active_license  # Mantener por compatibilidad

router = APIRouter(prefix="/stats", tags=["Estadísticas"])


# ── Esquemas ────────────────────────────────────────────────────────────────

class StatResponse(BaseModel):
    performance_score: Optional[float] = None
    completion_rate: float = 0.0
    average_time: Optional[float] = None
    score_distribution: List[int] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    trend: str = "stable"  # improving, stable, declining
    weekly_data: List[dict] = []
    subject_breakdown: List[dict] = []
    cognitive_indicators: dict = {}
    achievements: List[dict] = []
    hourly_distribution: List[int] = [0] * 24


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/estudiante/{user_id}", response_model=StatResponse)
async def get_student_stats(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Obtiene estadísticas detalladas de desempeño para un estudiante.
    """
    # Verificar que el usuario solicite sus propias estadísticas o tenga permisos
    if user_id != current_user.id:
        # Solo permitir que usuarios vean sus propias estadísticas o que profesores vean sus estudiantes
        if current_user.role == UserRole.PROFESOR.value:
            # Verificar que el estudiante esté inscrito en alguna clase del profesor
            student_in_classrooms = db.query(ClassroomUser.classroom_id).filter(
                ClassroomUser.user_id == user_id,
                ClassroomUser.is_active == True
            ).subquery()
            
            professor_classrooms = db.query(Classroom.id).filter(
                Classroom.teacher_id == current_user.id,
                Classroom.is_active == True
            ).subquery()
            
            # Verificar intersección
            has_class_in_common = db.query(
                db.query(student_in_classrooms).intersect(
                    db.query(professor_classrooms)
                ).exists()
            ).scalar()
            
            if not has_class_in_common:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No tienes permiso para ver las estadísticas de este estudiante"
                )
        elif current_user.role not in {UserRole.SUPER_PROFESOR.value, UserRole.ADMIN.value}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para ver las estadísticas de este usuario"
            )
    
    # NOTA: Ya no se verifica disponibilidad de módulo por licencia
    # Todos los roles tienen acceso a estadísticas según nuestros permisos basados en roles
    
    now = datetime.utcnow()
    today = now.date()
    
    # ── 1. Historial completo de quizzes completados ─────────────────────────
    all_history = (
        db.query(QuizHistory)
        .filter(
            QuizHistory.user_id == user_id,
            QuizHistory.completed_at.isnot(None)
        )
        .order_by(QuizHistory.completed_at.desc())
        .all()
    )
    
    # Si no hay historial, devolver estadísticas vacías
    if not all_history:
        return StatResponse()
    
    # ── 2. Estadísticas básicas ─────────────────────────────────────────────
    scores = [h.performance_score for h in all_history if h.performance_score is not None]
    if not scores:
        return StatResponse()
    
    # Calcular promedio de rendimiento
    avg_score = sum(scores) / len(scores)
    
    # Calcular tasa de completion (asumiendo que todos los quizzes en historial están completados)
    completion_rate = 1.0  # Como ya filtramos por completed_at.not(None)
    
    # Calcular tiempo promedio (si está disponible)
    times = [h.time_spent for h in all_history if h.time_spent is not None]
    avg_time = sum(times) / len(times) if times else None
    
    # Distribución de puntuaciones (0-100 en rangos de 10)
    score_distribution = [0] * 11
    for score in scores:
        if score is not None:
            idx = min(int(score // 10), 10)
            score_distribution[idx] += 1
    
    # Tendencia (comparando últimos 5 vs anteriores 5)
    trend = "stable"
    if len(scores) >= 10:
        recent_avg = sum(scores[-5:]) / 5
        previous_avg = sum(scores[-10:-5]) / 5
        if recent_avg > previous_avg + 5:
            trend = "improving"
        elif recent_avg < previous_avg - 5:
            trend = "declining"
    
    # ── 3. Datos semanales (últimas 8 semanas) ───────────────────────────────
    weekly_data = []
    for i in range(8):
        week_start = today - timedelta(days=today.weekday() + 7 * i)
        week_end = week_start + timedelta(days=6)
        week_history = [
            h for h in all_history 
            if h.completed_at and week_start <= h.completed_at.date() <= week_end
        ]
        week_scores = [h.performance_score for h in week_history if h.performance_score is not None]
        week_avg = sum(week_scores) / len(week_scores) if week_scores else 0.0
        
        weekly_data.append({
            "week": f"Semana {len(weekly_data) + 1}",
            "start_date": week_start.strftime("%Y-%m-%d"),
            "end_date": week_end.strftime("%Y-%m-%d"),
            "average_score": round(week_avg, 1),
            "quiz_count": len(week_history)
        })
    
    # ── 4. Desglose por materia ────────────────────────────────────────────
    subject_breakdown = []
    # Agrupar por categoría/subject
    subject_scores = {}
    for h in all_history:
        if h.performance_score is not None and h.subject:
            if h.subject not in subject_scores:
                subject_scores[h.subject] = []
            subject_scores[h.subject].append(h.performance_score)
    
    for subject, scores in subject_scores.items():
        subject_breakdown.append({
            "subject": subject,
            "average_score": round(sum(scores) / len(scores), 1),
            "quiz_count": len(scores),
            "completion_rate": 1.0  # Simplificado
        })
    
    # Ordenar por promedio de puntuación descendente
    subject_breakdown.sort(key=lambda x: x["average_score"], reverse=True)
    
    # ── 5. Indicadores cognitivos ────────────────────────────────────────
    cognitive_indicators = {
        "consistencia": round(100 - (sum((s - avg_score) ** 2 for s in scores) / len(scores)) ** 0.5, 1) if len(scores) > 1 else 100.0,
        "mejora": "positive" if trend == "improving" else "negative" if trend == "declining" else "stable",
        "promedio": round(avg_score, 1),
        "desviacion_estandar": round((sum((s - avg_score) ** 2 for s in scores) / len(scores)) ** 0.5, 1) if len(scores) > 1 else 0.0
    }
    
    # ── 6. Logros y conquistas ────────────────────────────────────────
    achievements = []
    if max(scores) >= 95:
        achievements.append({
            "id": "high_performer",
            "title": "Alto Rendimiento",
            "description": "Has alcanzado una puntuación de 95 o superior en al menos un quiz",
            "date": max((h.completed_at for h in all_history if h.performance_score >= 95), default=None).strftime("%Y-%m-%d") if any(h.performance_score >= 95 for h in all_history) else None
        })
    if len(all_history) >= 10:
        achievements.append({
            "id": "persistent_learner",
            "title": "Aprendiz Persistente",
            "description": "Has completado 10 o más quizzes",
            "date": all_history[-1].completed_at.strftime("%Y-%m-%d") if all_history[-1].completed_at else None
        })
    if avg_score >= 80:
        achievements.append({
            "id": "consistent_performer",
            "title": "Rendimiento Consistente",
            "description": "Tu promedio de puntuación es 80 o superior",
            "date": None
        })
    
    # ── 7. Distribución horaria ────────────────────────────────────────
    hourly_distribution = [0] * 24
    for h in all_history:
        if h.completed_at:
            hour = h.completed_at.hour
            hourly_distribution[hour] += 1
    
    return StatResponse(
        performance_score=round(avg_score, 1),
        completion_rate=round(completion_rate, 2),
        average_time=round(avg_time, 1) if avg_time else None,
        score_distribution=score_distribution,
        trend=trend,
        weekly_data=weekly_data,
        subject_breakdown=subject_breakdown,
        cognitive_indicators=cognitive_indicators,
        achievements=achievements,
        hourly_distribution=hourly_distribution,
    )


# Los demás endpoints (como /curso/{course_id}, etc.) seguirían un patrón similar...

# Mantener funciones de compatibilidad pero simplificadas
def _require_stats_module(user: User, license_info):  # pragma: no cover
    """Función de compatibilidad - ya no hace nada real."""
    # Todos los roles tienen acceso a estadísticas básicas según nuestros permisos
    return True