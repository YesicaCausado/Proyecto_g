"""
NeuroLearn IA — Esquemas validados de las señales neurodigitales del chat.

Antes `facial_data` y `voice_data` llegaban como `Dict[str, Any]` sin
validación: cualquier tipo o rango se aceptaba y el motor sustituía los
valores inválidos por promedios poblacionales. Aquí cada señal tiene tipos y
límites explícitos.

Política ante una señal inválida (ver `parse_signal`): el mensaje del
estudiante NO se rechaza (la tutoría no debe bloquearse por un sensor), pero
la señal se DESCARTA completa y el estado del patrón se informa como `error`
con el motivo. Nunca se corrige ni se completa con valores por defecto.

Solo se aceptan metadatos numéricos: no hay campos para imágenes, audio ni
texto tecleado (privacidad, ver docs/PRIVACIDAD_CONSENTIMIENTO.md). Los campos
desconocidos se ignoran y no se almacenan.
"""
from __future__ import annotations

from typing import Any, Dict, Literal, Optional, Tuple, Type, TypeVar

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

# Estado del sensor informado por el cliente para el turno (por qué no hay datos)
SensorState = Literal["active", "off", "denied", "unavailable", "no_face",
                      "insufficient", "error"]


class _Signal(BaseModel):
    # extra="ignore": un campo desconocido (p. ej. un blob de imagen) no se
    # conserva ni llega a la base de datos.
    model_config = ConfigDict(extra="ignore")


class FacialSignal(_Signal):
    """Agregado del turno calculado en el navegador (MediaPipe Face Landmarker).

    Los valores son promedios sobre los fotogramas CON rostro detectado.
    `emotion` es una etiqueta heurística derivada de blendshapes; no es un
    diagnóstico emocional.
    """
    valence: float = Field(..., ge=-1, le=1)
    attention_score: float = Field(..., ge=0, le=1)
    arousal: Optional[float] = Field(default=None, ge=0, le=1)
    blink_rate: Optional[float] = Field(default=None, ge=0, le=60)       # parpadeos/min
    brow_furrow: Optional[float] = Field(default=None, ge=0, le=1)
    smile_intensity: Optional[float] = Field(default=None, ge=0, le=1)
    gaze_direction: Optional[str] = Field(default=None, max_length=16)
    emotion: Optional[str] = Field(default=None, max_length=24)
    valid_frames: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    total_frames: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    window_ms: Optional[float] = Field(default=None, ge=0, le=86_400_000)

    @model_validator(mode="after")
    def _frames_consistent(self) -> "FacialSignal":
        if self.valid_frames is not None and self.total_frames is not None:
            if self.valid_frames > self.total_frames:
                raise ValueError("valid_frames no puede superar total_frames")
            if self.total_frames == 0:
                raise ValueError("total_frames = 0: no hubo observación facial")
        return self

    @property
    def valid_frame_ratio(self) -> Optional[float]:
        if self.valid_frames is None or not self.total_frames:
            return None
        return self.valid_frames / self.total_frames


class VoiceSignal(_Signal):
    """Agregado del turno calculado en el navegador (Web Audio API).

    Unidades: `volume_db` en dBFS (−100..0); `pitch_mean_hz` es el centroide
    espectral (proxy de tono, NO frecuencia fundamental); `speech_rate_wpm`
    es una estimación por inicios de voz, sin reconocimiento de palabras.
    """
    voiced_ms: float = Field(..., ge=0, le=3_600_000)
    window_ms: Optional[float] = Field(default=None, ge=0, le=86_400_000)
    pitch_mean_hz: Optional[float] = Field(default=None, ge=0, le=8000)
    volume_db: Optional[float] = Field(default=None, ge=-100, le=0)
    speech_rate_wpm: Optional[float] = Field(default=None, ge=0, le=400)
    voice_tremor: Optional[float] = Field(default=None, ge=0, le=1)
    energy_level: Optional[float] = Field(default=None, ge=0, le=1)
    filler_words_count: Optional[int] = Field(default=None, ge=0, le=10_000)
    silence_duration_ms: Optional[float] = Field(default=None, ge=0, le=86_400_000)
    pause_ratio: Optional[float] = Field(default=None, ge=0, le=1)
    pause_count: Optional[int] = Field(default=None, ge=0, le=100_000)

    @model_validator(mode="after")
    def _window_consistent(self) -> "VoiceSignal":
        if self.window_ms is not None and self.voiced_ms > self.window_ms + 500:
            raise ValueError("voiced_ms no puede superar window_ms")
        return self


class InteractionSignal(_Signal):
    """Patrón de interacción del turno (eventos de la interfaz del chat).

    Solo conteos y duraciones: no se registra qué se pulsó ni contenido.
    `hidden_ms` es tiempo con la pestaña oculta (no es tiempo activo).
    """
    window_ms: float = Field(..., ge=0, le=86_400_000)
    tab_hidden_count: int = Field(default=0, ge=0, le=10_000)
    hidden_ms: float = Field(default=0, ge=0, le=86_400_000)
    window_blur_count: int = Field(default=0, ge=0, le=10_000)
    suggestion_clicks: int = Field(default=0, ge=0, le=10_000)
    pointer_clicks: int = Field(default=0, ge=0, le=100_000)

    @model_validator(mode="after")
    def _hidden_within_window(self) -> "InteractionSignal":
        if self.hidden_ms > self.window_ms + 500:
            raise ValueError("hidden_ms no puede superar window_ms")
        return self


S = TypeVar("S", bound=_Signal)


def parse_signal(model: Type[S], raw: Any) -> Tuple[Optional[S], Optional[str]]:
    """Valida una señal cruda.

    Devuelve (señal, None) si es válida, (None, None) si no llegó y
    (None, motivo) si llegó pero es inválida (se descarta completa).
    """
    if raw is None:
        return None, None
    if isinstance(raw, model):
        return raw, None
    if not isinstance(raw, dict):
        return None, "formato inválido (se esperaba un objeto)"
    try:
        return model.model_validate(raw), None
    except ValidationError as exc:
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", ())) or "señal"
        return None, f"{loc}: {first.get('msg', 'valor inválido')}"


def signal_to_storage(signal: Optional[_Signal]) -> Optional[Dict[str, Any]]:
    """Representación persistible: solo campos definidos y no nulos."""
    if signal is None:
        return None
    return signal.model_dump(exclude_none=True)
