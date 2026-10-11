"""
NeuroLearn IA — Textos y reglas de consentimiento de cámara y micrófono.

Los textos describen lo que hace realmente el código:
  - Cámara: frontend/src/hooks/useFacialDetection.ts (MediaPipe Face Landmarker
    ejecutado en el navegador). Solo se envían indicadores numéricos
    (`facial_data` en /chat/message), nunca imágenes.
  - Micrófono: frontend/src/hooks/useVoiceProsody.ts (Web Audio API en el
    navegador) y el modo de voz de useVoiceTutor.ts (reconocimiento de voz
    del navegador, que en Chrome/Edge usa servicios en línea del fabricante).
    Solo se envían indicadores numéricos (`voice_data`) y el texto dictado.

Si cambia lo que hace el código, se actualiza el texto y su `version`; los
consentimientos de versiones anteriores dejan de ser válidos.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Dict, Optional

from sqlalchemy.orm import Session

from app.models.consent import CONSENT_TYPES, UserConsent

CONSENT_DOCUMENTS: Dict[str, dict] = {
    "camara_facial": {
        "version": "1.0",
        "title": "Uso de la cámara y detección facial",
        "purpose": (
            "Activar la cámara permite que el tutor de NeuroLearn estime tu nivel de atención y tu "
            "estado emocional mientras estudias, para adaptar sus explicaciones."
        ),
        "processed": [
            "La imagen de tu cámara se analiza cuadro por cuadro EN TU DISPOSITIVO, con un modelo de "
            "detección facial que se ejecuta dentro del navegador.",
            "Del análisis solo salen indicadores numéricos: emoción estimada, valencia, activación, "
            "atención, parpadeo, ceño, sonrisa y dirección de la mirada.",
            "Esos indicadores se envían junto con tus mensajes al tutor, se usan para adaptar sus "
            "respuestas y quedan en tu historial de aprendizaje.",
        ],
        "not_stored": [
            "No se graba ni se envía video.",
            "No se toman ni se guardan fotos de tu rostro.",
            "No se crea una huella biométrica para identificarte.",
        ],
        "revocation": (
            "Puedes apagar la cámara en cualquier momento desde el chat y retirar este consentimiento "
            "en Mi Perfil → Privacidad. Desde ese momento la cámara no se volverá a activar. Los "
            "indicadores enviados antes de retirarlo permanecen en tu historial."
        ),
        "voluntary": "Es voluntario: el tutor funciona igual sin cámara.",
        "minors": (
            "Si eres menor de edad, usa esta función solo si tu institución cuenta con la autorización "
            "de tu madre, padre o acudiente."
        ),
    },
    "microfono_voz": {
        "version": "1.0",
        "title": "Uso del micrófono y análisis de voz",
        "purpose": (
            "Activar el micrófono permite hablar con el tutor (modo de voz) y que NeuroLearn analice "
            "cómo hablas para detectar, por ejemplo, dudas o cansancio."
        ),
        "processed": [
            "Tu voz se analiza EN TU DISPOSITIVO para calcular indicadores numéricos: tono, volumen, "
            "ritmo, pausas, muletillas, temblor y energía.",
            "Esos indicadores se envían junto con tus mensajes al tutor, se usan para adaptar sus "
            "respuestas y quedan en tu historial de aprendizaje.",
            "En modo de voz, tu navegador convierte lo que dices en texto. En Chrome y Edge esa "
            "transcripción la hacen servicios en línea del fabricante del navegador (Google o "
            "Microsoft); NeuroLearn recibe solo el texto.",
        ],
        "not_stored": [
            "NeuroLearn no graba ni guarda audio.",
            "No se crea una huella de voz para identificarte.",
        ],
        "revocation": (
            "Puedes apagar el micrófono en cualquier momento desde el chat y retirar este "
            "consentimiento en Mi Perfil → Privacidad. Desde ese momento el micrófono no se volverá a "
            "activar. Los indicadores enviados antes de retirarlo permanecen en tu historial."
        ),
        "voluntary": "Es voluntario: puedes escribirle al tutor sin usar el micrófono.",
        "minors": (
            "Si eres menor de edad, usa esta función solo si tu institución cuenta con la autorización "
            "de tu madre, padre o acudiente."
        ),
    },
}

assert set(CONSENT_DOCUMENTS) == set(CONSENT_TYPES)


def current_version(consent_type: str) -> str:
    return CONSENT_DOCUMENTS[consent_type]["version"]


def active_consent(db: Session, user_id: int, consent_type: str) -> Optional[UserConsent]:
    """Consentimiento vigente (no retirado y de la versión actual) o None."""
    return (
        db.query(UserConsent)
        .filter(
            UserConsent.user_id == user_id,
            UserConsent.consent_type == consent_type,
            UserConsent.version == current_version(consent_type),
            UserConsent.revoked_at.is_(None),
        )
        .order_by(UserConsent.granted_at.desc())
        .first()
    )


# ── Autorización del acudiente (menores de edad) ───────────────────────────
#
# La Ley 1581 de 2012 exige la autorización del representante legal para
# tratar datos de menores. La institución la recoge en físico y el Súper
# Profesor la registra en la ficha del estudiante. Mientras no esté
# registrada, un estudiante menor de edad —o sin fecha de nacimiento, porque
# no se puede comprobar que sea mayor— no puede activar cámara ni micrófono.

ADULT_AGE = 18


def _parse_birth_date(value) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def age_on(birth: date, today: Optional[date] = None) -> int:
    today = today or date.today()
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))


def guardian_status(user) -> dict:
    """¿Necesita este usuario la autorización del acudiente y la tiene?"""
    role = getattr(user, "role", None)
    role = getattr(role, "value", role)
    authorized_at = getattr(user, "guardian_authorized_at", None)
    status = {
        "required": False,
        "authorized": authorized_at is not None,
        "reason": None,
        "name": getattr(user, "guardian_name", None),
        "authorized_at": authorized_at.replace(microsecond=0).isoformat() + "Z" if authorized_at else None,
    }
    if role != "estudiante":
        return status
    birth = _parse_birth_date(getattr(user, "birth_date", None))
    if birth is None:
        status.update(required=True, reason="sin_fecha")
    elif age_on(birth) < ADULT_AGE:
        status.update(required=True, reason="menor")
    return status


def blocked_by_guardian(user) -> bool:
    st = guardian_status(user)
    return st["required"] and not st["authorized"]


GUARDIAN_MESSAGE = (
    "Para activar la cámara o el micrófono, tu institución debe registrar la "
    "autorización de tu madre, padre o acudiente. Pídesela a tu coordinador."
)


class GuardianAuthorizationRequired(Exception):
    pass


def has_consent(db: Session, user_id: int, consent_type: str) -> bool:
    if active_consent(db, user_id, consent_type) is None:
        return False
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    return user is not None and not blocked_by_guardian(user)


def grant(db: Session, user_id: int, consent_type: str, version: str,
          ip_address: Optional[str] = None, user_agent: Optional[str] = None) -> UserConsent:
    """Registra la aceptación (si ya hay una vigente, la devuelve sin duplicar)."""
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    if user is not None and blocked_by_guardian(user):
        raise GuardianAuthorizationRequired(GUARDIAN_MESSAGE)
    existing = active_consent(db, user_id, consent_type)
    if existing is not None and existing.version == version:
        return existing
    record = UserConsent(
        user_id=user_id,
        consent_type=consent_type,
        version=version,
        granted_at=datetime.utcnow(),
        ip_address=(ip_address or None) and ip_address[:45],
        user_agent=(user_agent or None) and user_agent[:255],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def revoke(db: Session, user_id: int, consent_type: str) -> int:
    """Retira todos los consentimientos vigentes de ese tipo. Devuelve cuántos retiró."""
    now = datetime.utcnow()
    rows = db.query(UserConsent).filter(
        UserConsent.user_id == user_id,
        UserConsent.consent_type == consent_type,
        UserConsent.revoked_at.is_(None),
    ).all()
    for row in rows:
        row.revoked_at = now
    db.commit()
    return len(rows)
