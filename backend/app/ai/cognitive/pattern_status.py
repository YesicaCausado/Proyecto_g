"""
NeuroLearn IA — Estado verificable de los cinco patrones neurodigitales.

Cada respuesta de /chat/message incluye `metadata.pattern_status` con una
entrada por patrón (facial, voz, teclado, interacción, rendimiento):

    {
      "status": "available" | "pending" | "unavailable" | "not_applicable"
                | "error" | "stale",
      "reason": str | None,          # motivo comprensible si no es available
      "measured_at": ISO-8601 UTC | None,
      "values": {...},               # solo valores realmente medidos
      "units": {...},                # unidad de cada valor
      "source": str,                 # de dónde sale el dato
      "engine": {"used": bool, "weight": float | None},
    }

Regla: dato inexistente no es cero, dato no medido no es resultado negativo y
error técnico no es una medición válida. Un patrón sin medición nunca lleva
`values` inventados. `pending` lo usa solo el frontend mientras la petición
está en curso (el backend responde de forma síncrona).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

AVAILABLE = "available"
PENDING = "pending"
UNAVAILABLE = "unavailable"
NOT_APPLICABLE = "not_applicable"
ERROR = "error"
STALE = "stale"

# Un historial de quizzes más antiguo que esto se presenta como desactualizado
PERFORMANCE_STALE_AFTER = timedelta(days=30)

# Patrón → modalidades del motor que alimenta
ENGINE_MODALITIES = {
    "facial": ("facial_microexpression",),
    "voice": ("voice_prosody",),
    "keyboard": ("interaction_rhythm", "decision_sequence"),
    "interaction": (),
    "performance": ("error_prediction",),
}

_SENSOR_REASONS = {
    "facial": {
        "off": "La cámara no está activada en esta actividad.",
        "denied": "Permiso de cámara denegado en el navegador.",
        "unavailable": "No se encontró una cámara disponible.",
        "no_face": "No se detectó un rostro durante el turno; no se infiere ninguna expresión.",
        "insufficient": "Muy pocos fotogramas con rostro para una medición válida.",
        "error": "Falló la cámara o el modelo de detección facial.",
    },
    "voice": {
        "off": "El micrófono no está activado en esta actividad.",
        "denied": "Permiso de micrófono denegado en el navegador.",
        "unavailable": "No se encontró un micrófono disponible.",
        "insufficient": "No hubo voz suficiente (mínimo 1 s) para analizar la prosodia.",
        "error": "Falló la captura o el análisis de audio.",
    },
}


def _iso(dt: Optional[datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _entry(status: str, source: str, reason: Optional[str] = None,
           measured_at: Optional[datetime] = None,
           values: Optional[Dict[str, Any]] = None,
           units: Optional[Dict[str, str]] = None,
           notes: Optional[str] = None) -> Dict[str, Any]:
    return {
        "status": status,
        "reason": reason,
        "measured_at": _iso(measured_at) if status in (AVAILABLE, STALE) else None,
        "values": {k: v for k, v in (values or {}).items() if v is not None},
        "units": units or {},
        "source": source,
        "notes": notes,
        "engine": {"used": False, "weight": None},
    }


def _attach_engine(entry: Dict[str, Any], pattern: str, analysis) -> None:
    if analysis is None or entry["status"] != AVAILABLE:
        return
    weights = getattr(analysis, "modality_weights", {}) or {}
    w = sum(weights.get(m, 0.0) for m in ENGINE_MODALITIES[pattern])
    entry["engine"] = {"used": w > 0, "weight": round(w, 4) if w > 0 else None}


def facial_status(*, signal, rejected: Optional[str], sensor_state: Optional[str],
                  consent_blocked: bool, accepted_by_engine: Optional[bool],
                  now: datetime) -> Dict[str, Any]:
    src = "Navegador (MediaPipe Face Landmarker, procesamiento local)"
    if consent_blocked:
        return _entry(UNAVAILABLE, src, "Sin consentimiento vigente de cámara: los datos se descartaron.")
    if rejected:
        return _entry(ERROR, src, f"Datos faciales inválidos rechazados ({rejected}).")
    if signal is None:
        reason = _SENSOR_REASONS["facial"].get(sensor_state or "off",
                                               _SENSOR_REASONS["facial"]["off"])
        status = ERROR if sensor_state == "error" else UNAVAILABLE
        return _entry(status, src, reason)
    if accepted_by_engine is False:
        return _entry(ERROR, src, "La muestra facial no superó la validación del motor.")
    ratio = signal.valid_frame_ratio
    return _entry(
        AVAILABLE, src, measured_at=now,
        values={
            "attention_score": round(signal.attention_score, 3),
            "valence": round(signal.valence, 3),
            "arousal": signal.arousal,
            "blink_rate": signal.blink_rate,
            "brow_furrow": signal.brow_furrow,
            "smile_intensity": signal.smile_intensity,
            "gaze_direction": signal.gaze_direction,
            "expression_label": signal.emotion,
            "valid_frames": signal.valid_frames,
            "total_frames": signal.total_frames,
            "valid_frame_ratio": round(ratio, 3) if ratio is not None else None,
        },
        units={"attention_score": "0-1 (heurística: rostro + mirada + estabilidad)",
               "valence": "-1..1 (blendshapes sonrisa/ceño)", "arousal": "0-1",
               "blink_rate": "parpadeos/min", "brow_furrow": "0-1",
               "smile_intensity": "0-1", "valid_frame_ratio": "fracción de fotogramas con rostro"},
        notes="Indicadores faciales observables promediados en el turno. "
              "La etiqueta de expresión es heurística y no es un diagnóstico emocional.",
    )


def voice_status(*, signal, rejected: Optional[str], sensor_state: Optional[str],
                 consent_blocked: bool, accepted_by_engine: Optional[bool],
                 input_mode: Optional[str], now: datetime) -> Dict[str, Any]:
    src = "Navegador (Web Audio API, procesamiento local)"
    if consent_blocked:
        return _entry(UNAVAILABLE, src, "Sin consentimiento vigente de micrófono: los datos se descartaron.")
    if rejected:
        return _entry(ERROR, src, f"Datos de voz inválidos rechazados ({rejected}).")
    if signal is None:
        if (sensor_state in (None, "off")) and input_mode != "voice":
            return _entry(NOT_APPLICABLE, src,
                          "El turno se respondió por escrito; la voz no se mide en esta actividad.")
        reason = _SENSOR_REASONS["voice"].get(sensor_state or "off",
                                              _SENSOR_REASONS["voice"]["off"])
        status = ERROR if sensor_state == "error" else UNAVAILABLE
        return _entry(status, src, reason)
    if accepted_by_engine is False:
        return _entry(UNAVAILABLE, src, _SENSOR_REASONS["voice"]["insufficient"])
    return _entry(
        AVAILABLE, src, measured_at=now,
        values={
            "voiced_ms": round(signal.voiced_ms),
            "window_ms": signal.window_ms,
            "speech_rate_wpm": signal.speech_rate_wpm,
            "pause_ratio": signal.pause_ratio,
            "pause_count": signal.pause_count,
            "volume_dbfs": signal.volume_db,
            "spectral_centroid_hz": signal.pitch_mean_hz,
            "voice_tremor": signal.voice_tremor,
            "energy_level": signal.energy_level,
            "filler_estimate": signal.filler_words_count,
        },
        units={"voiced_ms": "ms con voz", "window_ms": "ms del turno",
               "speech_rate_wpm": "palabras/min (estimación por inicios de voz)",
               "pause_ratio": "fracción del turno en silencio", "volume_dbfs": "dBFS",
               "spectral_centroid_hz": "Hz (centroide espectral, no F0)",
               "voice_tremor": "0-1 (variación de amplitud)", "energy_level": "0-1",
               "filler_estimate": "emisiones cortas (heurística, sin reconocimiento de voz)"},
        notes="Proxies acústicos calculados sin reconocimiento de voz; se comparan "
              "solo contra la línea base personal del estudiante.",
    )


def keyboard_status(*, request, now: datetime) -> Dict[str, Any]:
    src = "Navegador (eventos de escritura del campo del chat)"
    mode = getattr(request, "input_mode", None)
    if mode == "voice":
        return _entry(NOT_APPLICABLE, src, "La respuesta se dictó por voz; no hubo escritura que medir.")
    if mode == "pasted":
        return _entry(UNAVAILABLE, src, "El texto se pegó: no hay ritmo de escritura medible.")
    speed = request.typing_speed_cpm
    keys = getattr(request, "keystrokes", None)
    if not speed or speed <= 0 or (keys is not None and keys <= 0):
        return _entry(UNAVAILABLE, src, "No se registraron pulsaciones válidas en este turno.")
    return _entry(
        AVAILABLE, src, measured_at=now,
        values={
            "typing_speed_cpm": round(float(speed), 1),
            "response_time_ms": request.response_time_ms,
            "pause_before_ms": request.pause_before_ms,
            "deleted_chars": request.corrections,
            "typing_bursts": request.typing_bursts,
            "keystrokes": keys,
        },
        units={"typing_speed_cpm": "caracteres/min desde la primera pulsación hasta el envío",
               "response_time_ms": "ms desde la respuesta del tutor hasta el envío",
               "pause_before_ms": "ms hasta la primera pulsación",
               "deleted_chars": "caracteres borrados",
               "typing_bursts": "ráfagas separadas por pausas > 800 ms"},
        notes="Solo metadatos temporales. No se miden errores ortográficos.",
    )


def interaction_status(*, signal, rejected: Optional[str], now: datetime) -> Dict[str, Any]:
    src = "Navegador (visibilidad de la pestaña, foco y clics en el chat)"
    if rejected:
        return _entry(ERROR, src, f"Eventos de interacción inválidos rechazados ({rejected}).")
    if signal is None:
        return _entry(UNAVAILABLE, src, "El cliente no envió eventos de interacción para este turno.")
    return _entry(
        AVAILABLE, src, measured_at=now,
        values={
            "window_ms": round(signal.window_ms),
            "tab_hidden_count": signal.tab_hidden_count,
            "hidden_ms": round(signal.hidden_ms),
            "window_blur_count": signal.window_blur_count,
            "suggestion_clicks": signal.suggestion_clicks,
            "pointer_clicks": signal.pointer_clicks,
        },
        units={"window_ms": "ms transcurridos en el turno (permanencia, no tiempo activo)",
               "hidden_ms": "ms con la pestaña oculta"},
        notes="Interacción observada. Es permanencia y eventos, no actividad efectiva; "
              "no participa en la inferencia del motor.",
    )


def performance_status(*, verdict: Optional[str], grading_failed: bool,
                       was_question: bool, session_stats: Dict[str, Any],
                       quiz_count: int, quiz_error_rate: Optional[float],
                       last_quiz_at: Optional[datetime], analysis,
                       now: datetime) -> Dict[str, Any]:
    src = "Backend (calificación de la respuesta del chat y quizzes completados)"
    evals = int(session_stats.get("chat_eval_count") or 0)
    values: Dict[str, Any] = {
        "last_answer_correct": (verdict == "correct") if verdict in ("correct", "incorrect") else None,
        "chat_eval_count": evals if evals else None,
        "chat_error_rate": round(session_stats["chat_error_rate"], 3)
        if evals and session_stats.get("chat_error_rate") is not None else None,
        "quiz_count": quiz_count or None,
        "quiz_error_rate": round(quiz_error_rate, 3) if quiz_count and quiz_error_rate is not None else None,
    }
    if analysis is not None and getattr(analysis, "error_risk_available", False):
        values["error_risk"] = round(float(analysis.error_risk), 3)
    units = {"chat_error_rate": "fracción de respuestas incorrectas (últimas 30 calificadas)",
             "quiz_error_rate": "respuestas incorrectas / preguntas (últimos 5 quizzes)",
             "error_risk": "probabilidad estimada (experimental)"}

    if grading_failed:
        e = _entry(ERROR, src, "No fue posible calificar la respuesta de este turno.",
                   values=values, units=units)
        e["values"] = {}
        return e
    if verdict in ("correct", "incorrect"):
        return _entry(AVAILABLE, src, measured_at=now, values=values, units=units)
    if evals or quiz_count:
        if last_quiz_at is not None and not evals and now - last_quiz_at > PERFORMANCE_STALE_AFTER:
            return _entry(STALE, src, "El último quiz completado es antiguo.",
                          measured_at=last_quiz_at, values=values, units=units)
        reason = None if was_question else "Este mensaje no respondía una pregunta evaluable."
        e = _entry(AVAILABLE, src, reason, measured_at=last_quiz_at if not evals else now,
                   values=values, units=units)
        return e
    if not was_question:
        return _entry(NOT_APPLICABLE, src, "Este mensaje no respondía una pregunta evaluable "
                                           "y aún no hay respuestas calificadas.")
    return _entry(UNAVAILABLE, src, "Aún no hay respuestas calificadas ni quizzes completados.")


def engine_summary(analysis, *, failed: bool) -> Dict[str, Any]:
    """Resumen trazable del motor neuroconductual para la interfaz."""
    if failed:
        return {"status": ERROR, "reason": "El análisis neuroconductual falló en este turno."}
    if analysis is None:
        return {"status": UNAVAILABLE, "reason": "No hubo señales para analizar."}
    sufficient = bool(getattr(analysis, "sufficient_evidence", False))
    return {
        "status": AVAILABLE if sufficient else UNAVAILABLE,
        "reason": None if sufficient else
        "Evidencia insuficiente: se necesitan al menos dos fuentes con datos válidos.",
        "state": analysis.state.value if sufficient else None,
        "probability": analysis.probability if sufficient else None,
        "confidence": analysis.confidence if sufficient else None,
        "engagement_score": analysis.engagement_score if sufficient else None,
        "attention_level": analysis.attention_level,
        "error_risk": analysis.error_risk if analysis.error_risk_available else None,
        "modality_weights": analysis.modality_weights,
        "excluded_modalities": analysis.excluded_modalities,
        "label": "Estimación experimental del sistema; no es un diagnóstico.",
    }
