"""
NeuroLearn AI - Enrollment Tracking Service
Única fuente de verdad para actualizar el seguimiento (Enrollment) de un
estudiante en una clase, a partir de eventos de aprendizaje (hoy: quizzes).

Reglas de negocio confirmadas (checkpoint de diseño):
- average_score / overall_progress: promedio de los quizzes que cuentan para
  el grupo (quiz_counts_for_group), recalculado desde el historial.
- risk_level / risk_factors: mismas reglas ya usadas (de forma solo-lectura) en
  super_stats.py::get_super_alerts, ahora centralizadas aquí como fuente de escritura.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.classroom import Enrollment

logger = logging.getLogger(__name__)

INACTIVITY_HIGH_RISK_DAYS = 14
INACTIVITY_MEDIUM_RISK_DAYS = 5
LOW_SCORE_THRESHOLD = 40.0
MIN_SESSIONS_FOR_SCORE_RISK = 3


def quiz_counts_for_group(quiz_competency: Optional[str], quiz_classroom_id: Optional[int],
                          group_id: int, group_competency: Optional[str]) -> bool:
    """Regla única: ¿el quiz de práctica cuenta para el progreso del grupo?

    Los quizzes de Desafíos son práctica de una COMPETENCIA, no actividades
    asignadas por un grupo:
    - Grupo de una competencia: cuentan los quizzes de esa competencia. Si el
      quiz quedó registrado con un grupo (el estudiante tenía un único grupo
      de esa competencia), solo cuenta para ese grupo.
    - Grupo sin competencia (p. ej. dirección de grupo): cuenta toda la
      práctica del estudiante.
    Con varios grupos de la misma competencia el quiz no se asigna a uno
    arbitrariamente: cuenta una vez en el progreso del estudiante en cada uno
    (y una sola vez en su desempeño individual). La usan también los reportes
    del Súper Profesor (super_report_service._group_results).
    """
    if group_competency is None:
        return True
    if quiz_competency != group_competency:
        return False
    return quiz_classroom_id is None or quiz_classroom_id == group_id


class EnrollmentTrackingService:
    """Servicio de aplicación responsable de mantener actualizado el
    seguimiento de progreso de un estudiante dentro de una clase (Enrollment).

    El progreso se RECALCULA desde el historial de quizzes completados (no se
    suma de forma incremental): un reenvío o un reintento no puede contar dos
    veces el mismo quiz.
    """

    @staticmethod
    def refresh_student(db: Session, student_id: int) -> List[Enrollment]:
        """Recalcula el seguimiento de todas las inscripciones activas del
        estudiante y guarda los cambios (commit). Devuelve las actualizadas."""
        enrollments = db.query(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.is_active == True,  # noqa: E712
        ).all()
        for enrollment in enrollments:
            EnrollmentTrackingService.recompute(db, enrollment)
        db.commit()
        for enrollment in enrollments:
            db.refresh(enrollment)
        return enrollments

    @staticmethod
    def recompute(db: Session, enrollment: Enrollment) -> Enrollment:
        """Progreso, tiempo y riesgo de una inscripción desde el historial (sin commit)."""
        from app.models.classroom import Classroom
        from app.models.learning import QuizHistory
        from app.services.competencies import classroom_competency, quiz_competency

        classroom = db.get(Classroom, enrollment.classroom_id)
        group_competency = classroom_competency(classroom)
        quizzes = [
            q for q in db.query(QuizHistory).filter(
                QuizHistory.user_id == enrollment.student_id,
                QuizHistory.completed_at.isnot(None),
                QuizHistory.performance_score.isnot(None),
            ).all()
            if quiz_counts_for_group(quiz_competency(q)[0], q.classroom_id,
                                     enrollment.classroom_id, group_competency)
        ]

        sessions = len(quizzes)
        average = (sum(float(q.performance_score) for q in quizzes) / sessions) if sessions else 0.0
        enrollment.total_sessions = sessions
        enrollment.average_score = round(average, 1)
        enrollment.overall_progress = round(average, 1)  # mismo valor, confirmado en diseño
        enrollment.total_time_minutes = round(
            sum(q.time_spent_seconds or 0 for q in quizzes) / 60, 1)
        enrollment.last_activity = max((q.completed_at for q in quizzes), default=None)

        # ── Riesgo ─────────────────────────────────────────────────────
        # Misma regla que super_stats.py::get_super_alerts (bajo rendimiento
        # con evidencia mínima). La inactividad se evalúa en las alertas.
        risk_factors = []
        risk_level = "none"
        if sessions >= MIN_SESSIONS_FOR_SCORE_RISK and average < LOW_SCORE_THRESHOLD:
            risk_factors.append("bajo_rendimiento")
            risk_level = "high"

        previous_risk = enrollment.risk_level
        enrollment.risk_level = risk_level
        enrollment.risk_factors = risk_factors
        if risk_level == "high" and previous_risk != "high":
            EnrollmentTrackingService._notify_high_risk(db, enrollment, average)

        logger.info(
            "Seguimiento recalculado: estudiante=%s grupo=%s quizzes=%s promedio=%s riesgo=%s",
            enrollment.student_id, enrollment.classroom_id, sessions,
            enrollment.average_score, risk_level,
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
