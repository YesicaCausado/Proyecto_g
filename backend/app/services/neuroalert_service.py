"""
NeuroLearn IA — Reglas de las NeuroAlertas.

Una sola definición para el profesor (`GET /classrooms/{id}/alerts`) y el
Súper Profesor (`GET /super/stats/alerts`). Cada alerta sale de datos reales
de la inscripción (`enrollments`):

    inactividad       última actividad hace 7 días o más (alta desde 14)
    sin_inicio        inscrito y sin ninguna sesión registrada
    bajo_rendimiento  3 sesiones o más con promedio menor a 40 %
    riesgo_cognitivo  risk_level medio o alto calculado por el motor

`key` identifica la alerta (tipo + inscripción) y `signature` el estado que la
originó; con ambos se recuerda si el usuario ya la marcó como resuelta.
"""
from datetime import datetime
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.models.alert_ack import AlertAcknowledgement
from app.models.classroom import Enrollment

_PREFIX = {
    "inactividad": "inact",
    "sin_inicio": "never",
    "bajo_rendimiento": "low",
    "riesgo_cognitivo": "risk",
}


def enrollment_alerts(e: Enrollment, now: Optional[datetime] = None) -> list[dict]:
    """Alertas vigentes de una inscripción, sin datos de presentación."""
    now = now or datetime.utcnow()
    sessions = int(e.total_sessions or 0)
    score = float(e.average_score or 0)
    out: list[dict] = []

    if e.last_activity:
        days = (now - e.last_activity).days
        if days >= 7:
            out.append({
                "type": "inactividad",
                "severity": "high" if days >= 14 else "medium",
                "days_inactive": days,
                "signature": e.last_activity.isoformat(),
            })
    elif sessions == 0:
        out.append({"type": "sin_inicio", "severity": "medium", "signature": "0"})

    if sessions >= 3 and score < 40:
        out.append({
            "type": "bajo_rendimiento",
            "severity": "high",
            "signature": f"{sessions}",
        })

    if e.risk_level in ("medium", "high"):
        factors = ",".join(sorted(str(f) for f in (e.risk_factors or [])))
        out.append({
            "type": "riesgo_cognitivo",
            "severity": e.risk_level,
            "signature": f"{e.risk_level}:{factors}"[:200],
        })

    for a in out:
        a["key"] = f"{_PREFIX[a['type']]}-{e.id}"
    return out


def acknowledged(db: Session, user_id: int, keys: Iterable[str]) -> dict[str, str]:
    """{alert_key: firma} de las alertas que el usuario marcó como resueltas."""
    keys = list(set(keys))
    if not keys:
        return {}
    rows = db.query(AlertAcknowledgement.alert_key, AlertAcknowledgement.signature).filter(
        AlertAcknowledgement.user_id == user_id,
        AlertAcknowledgement.alert_key.in_(keys),
    ).all()
    return {k: s for k, s in rows}


def is_resolved(acks: dict[str, str], alert: dict) -> bool:
    return acks.get(alert["key"]) == alert["signature"]


def set_resolved(db: Session, user_id: int, alert: dict, resolved: bool) -> None:
    """Marca o desmarca una alerta vigente como resuelta (sin commit)."""
    row = db.query(AlertAcknowledgement).filter(
        AlertAcknowledgement.user_id == user_id,
        AlertAcknowledgement.alert_key == alert["key"],
    ).first()
    if not resolved:
        if row is not None:
            db.delete(row)
        return
    if row is None:
        db.add(AlertAcknowledgement(user_id=user_id, alert_key=alert["key"], signature=alert["signature"]))
    else:
        row.signature = alert["signature"]
        row.created_at = datetime.utcnow()
