"""Aviso informativo para estudiantes; el acuse no es una autorización legal."""
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from app.models.student_privacy_notice import StudentPrivacyNotice

POLICY_VERSION = "2026-10-23"

NOTICE = {
    "version": POLICY_VERSION,
    "title": "Aviso de privacidad para estudiantes",
    "summary": (
        "NeuroLearn IA trata tus datos para crear tu cuenta, permitir el aprendizaje, "
        "gestionar clases y actividades, proteger la plataforma y ofrecer apoyo educativo."
    ),
    "purposes": [
        "Administrar tu cuenta, tus cursos, evaluaciones, materiales y comunicaciones.",
        "Acompañar tu aprendizaje y adaptar actividades mediante inteligencia artificial.",
        "Medir patrones neurodigitales de interacción (por ejemplo, ritmo, pausas, correcciones "
        "y longitud de escritura) para generar indicadores de aprendizaje y adaptación.",
        "Atender la seguridad, el funcionamiento y las solicitudes relacionadas con tus datos.",
    ],
    "patterns": (
        "La plataforma puede analizar patrones de interacción y aprendizaje. La cámara y el "
        "micrófono son funciones separadas y voluntarias: requieren permisos y consentimientos "
        "específicos, y para menores la autorización institucional del acudiente. No uses esas "
        "funciones si no están autorizadas."
    ),
    "rights": (
        "Puedes conocer, actualizar y rectificar tus datos, solicitar prueba de las autorizaciones, "
        "preguntar por el uso de tus datos y presentar consultas o reclamos. Si eres menor, puedes "
        "pedir ayuda a tu madre, padre o acudiente para ejercerlos. Las solicitudes se tramitan por "
        "los canales indicados en la Política de Privacidad."
    ),
    "legal_basis": (
        "Este aviso te informa; pulsar «Continuar» solo registra que fue presentado y que indicaste "
        "haberlo leído. No es una autorización para tratar datos sensibles ni reemplaza la autorización "
        "previa, expresa e informada que deba otorgar tu representante legal."
    ),
}


def current_notice(db: Session, user_id: int) -> Optional[StudentPrivacyNotice]:
    return (
        db.query(StudentPrivacyNotice)
        .filter(
            StudentPrivacyNotice.user_id == user_id,
            StudentPrivacyNotice.policy_version == POLICY_VERSION,
        )
        .first()
    )


def has_acknowledged(db: Session, user_id: int) -> bool:
    record = current_notice(db, user_id)
    return record is not None and record.acknowledged_at is not None


def present(
    db: Session,
    user_id: int,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> StudentPrivacyNotice:
    record = current_notice(db, user_id)
    if record is None:
        record = StudentPrivacyNotice(
            user_id=user_id,
            policy_version=POLICY_VERSION,
            presented_at=datetime.utcnow(),
            ip_address=(ip_address or "")[:45] or None,
            user_agent=(user_agent or "")[:255] or None,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
    return record


def acknowledge(
    db: Session,
    record: StudentPrivacyNotice,
    ip_address: Optional[str],
    user_agent: Optional[str],
) -> StudentPrivacyNotice:
    if record.acknowledged_at is None:
        record.acknowledged_at = datetime.utcnow()
        record.ip_address = (ip_address or "")[:45] or record.ip_address
        record.user_agent = (user_agent or "")[:255] or record.user_agent
        db.commit()
        db.refresh(record)
    return record
