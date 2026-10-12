"""
NeuroLearn AI - Enrollment Tracking Service
Única fuente de verdad para actualizar el seguimiento (Enrollment) de un
estudiante en una clase, a partir de eventos de aprendizaje (hoy: quizzes).

Reglas de negocio confirmadas (checkpoint de diseño):
- average_score / overall_progress: promedio acumulado ponderado de TODO el historial.
- risk_level / risk_factors: mismas reglas ya usadas (de forma solo-lectura) en
  super_stats.py::get_super_alerts, ahora centralizadas aquí como fuente de escritura.
"""
import logging
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import Session

from app.models.classroom import Enrollment

logger = logging.getLogger(__name__)

INACTIVITY_HIGH_RISK_DAYS = 14
INACTIVITY_MEDIUM_RISK_DAYS = 5
LOW_SCORE_THRESHOLD = 40.0
MIN_SESSIONS_FOR_SCORE_RISK = 3


class EnrollmentTrackingService:
    """Servicio de aplicación responsable de mantener actualizado el
    seguimiento de progreso de un estudiante dentro de una clase (Enrollment).
    """

    @staticmethod
    def register_quiz_completion(
        db: Session,
        student_id: int,
        classroom_id: Optional[int],
        score_percentage: float,
    ) -> Optional[Enrollment]:
        """
        Actualiza el Enrollment correspondiente tras completar un quiz.
        No lanza excepción si no hay classroom_id o no hay Enrollment activo:
        simplemente no hace nada (el quiz se sigue guardando en QuizHistory igual).
        """
        if classroom_id is None:
            return None

        enrollment = (
            db.query(Enrollment)
            .filter(
                Enrollment.student_id == student_id,
                Enrollment.classroom_id == classroom_id,
                Enrollment.is_active == True,
            )
            .first()
        )
        if enrollment is None:
            logger.warning(
                f"register_quiz_completion: no hay Enrollment activo para "
                f"student_id={student_id}, classroom_id={classroom_id}. Se omite."
            )
            return None

        # ── Promedio acumulado ponderado ──────────────────────────────
        prev_sessions = enrollment.total_sessions or 0
        prev_avg = enrollment.average_score or 0.0
        new_sessions = prev_sessions + 1
        new_avg = ((prev_avg * prev_sessions) + score_percentage) / new_sessions

        enrollment.total_sessions = new_sessions
        enrollment.average_score = round(new_avg, 1)
        enrollment.overall_progress = round(new_avg, 1)  # mismo valor, confirmado en diseño
        enrollment.last_activity = datetime.utcnow()

        # ── Recalcular riesgo ──────────────────────────────────────────
        risk_factors = []
        risk_level = "none"

        if new_sessions >= MIN_SESSIONS_FOR_SCORE_RISK and new_avg < LOW_SCORE_THRESHOLD:
            risk_factors.append("bajo_rendimiento")
            risk_level = "high"

        # La inactividad se evalúa de nuevo desde cero en cada actualización;
        # como esto se dispara al completar un quiz, last_activity siempre
        # queda "ahora", así que este chequeo aplica sobre todo en re-cálculos
        # futuros (p. ej. un job periódico), no en este flujo de escritura directa.
        # Se deja la regla aquí para mantener consistencia con super_stats.py.

        previous_risk = enrollment.risk_level
        enrollment.risk_level = risk_level
        enrollment.risk_factors = risk_factors

        if risk_level == "high" and previous_risk != "high":
            EnrollmentTrackingService._notify_high_risk(db, enrollment, new_avg)

        db.commit()
        db.refresh(enrollment)

        logger.info(
            f"📊 Enrollment actualizado: student_id={student_id}, "
            f"classroom_id={classroom_id}, avg={enrollment.average_score}, "
            f"sessions={enrollment.total_sessions}, risk={enrollment.risk_level}"
        )
        return enrollment

    @staticmethod
    def _notify_high_risk(db: Session, enrollment: Enrollment, average: float) -> None:
        """Alerta de riesgo → profesor del aula y Súper Profesor(es) de su
        institución, solo cuando el estudiante PASA a riesgo alto (misma
        transacción que la actualización del seguimiento)."""
        from app.models.classroom import Classroom
        from app.models.user import User
        from app.services import notification_service

        classroom = db.get(Classroom, enrollment.classroom_id)
        student = db.get(User, enrollment.student_id)
        teacher = db.get(User, classroom.teacher_id) if classroom else None
        if classroom is None or student is None:
            return
        name = student.full_name or student.username
        message = (f"{name} pasó a riesgo alto en el grupo {classroom.name}: "
                   f"promedio de {round(average)}% en {enrollment.total_sessions} quizzes.")
        if teacher is not None:
            notification_service.notify(
                db, [teacher.id], "alerta_riesgo", "Estudiante en riesgo alto", message,
                link=notification_service.alerts_link(teacher.role),
                resource_type="estudiante", resource_id=student.id)
        supers = notification_service.super_profesores_of(
            db, teacher.institution_id if teacher else student.institution_id)
        notification_service.notify(
            db, supers, "alerta_riesgo", "Estudiante en riesgo alto", message,
            link="/super?tab=alertas", resource_type="estudiante", resource_id=student.id)
