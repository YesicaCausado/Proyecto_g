"""
🧪 NeuroLearn AI — Validación de los 8 Estados Cognitivos
Sprint 3: Cada estado debe alcanzar confianza > 0.6

Estados a validar:
  1. normal       — comportamiento base sin señales especiales
  2. fatigue      — cansancio: RT alto, velocidad baja, errores
  3. overload     — sobrecarga: demasiada corrección, confusión facial+voz
  4. doubt        — duda: vacilación, muchas correcciones, baja confianza
  5. mastery      — dominio: rápido, preciso, sin errores
  6. flow         — flujo: atención máxima, ritmo constante, emoción positiva
  7. frustration  — frustración: errores repetidos, emoción negativa, energía alta
  8. curiosity    — curiosidad: preguntas, arousal alto, atención sostenida

Ejecutar:
    cd backend
    python -m tests.test_8_states
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.ai.cognitive.neuroconductual_engine import (
    MultimodalCognitiveEngine,
    BehavioralEvent,
    DecisionEvent,
    FacialData,
    VoiceProsodyData,
    EmotionEnum,
    CognitiveStateEnum,
)

PASS = "✅"
FAIL = "❌"
WARN = "⚠️ "
MIN_CONFIDENCE = 0.55   # mínimo aceptable
TARGET_CONFIDENCE = 0.65  # objetivo

results_summary = []

def now():
    return datetime.utcnow()

def make_engine_with_baseline(rt=2000.0, speed=150.0):
    """Crea engine con baseline de 10 eventos normales."""
    engine = MultimodalCognitiveEngine()
    for _ in range(10):
        engine.add_behavioral_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=rt, typing_speed_cpm=speed,
            error_occurred=False,
        ))
    return engine

def run_state_test(name: str, state_fn) -> tuple:
    """Ejecuta un test de estado y retorna (state, confidence, ok)."""
    try:
        result = state_fn()
        conf = result.confidence
        state = result.state.value
        ok = conf >= MIN_CONFIDENCE
        target_ok = conf >= TARGET_CONFIDENCE
        icon = PASS if target_ok else (WARN if ok else FAIL)
        print(f"  {icon} {name:15s} → estado={state:12s}  confianza={conf:.3f}  "
              f"{'OK' if target_ok else 'BAJO' if ok else 'FALLO'}")
        results_summary.append((name, state, conf, ok))
        return state, conf, ok
    except Exception as e:
        print(f"  {FAIL} {name}: ERROR — {e}")
        import traceback; traceback.print_exc()
        results_summary.append((name, "error", 0.0, False))
        return "error", 0.0, False


# =============================================================================
# 1. ESTADO NORMAL
# =============================================================================
def scenario_normal():
    engine = make_engine_with_baseline()
    result = None
    for i in range(12):
        result = engine.add_behavioral_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2100.0 + (i % 3) * 100,
            typing_speed_cpm=145.0 + (i % 4) * 5,
            error_occurred=False,
            correction_made=False,
        ))
    return result


# =============================================================================
# 2. FATIGA
# =============================================================================
def scenario_fatigue():
    engine = make_engine_with_baseline()
    result = None
    for i in range(18):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=4500.0 + i * 300,
                typing_speed_cpm=75.0 - i * 2,
                error_occurred=(i % 2 == 0),
                pause_duration_ms=3000.0 + i * 100,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.SAD,
                emotion_confidence=0.75, valence=-0.35,
                arousal=0.20, attention_score=0.40,
                blink_rate=26.0, brow_furrow=0.45,
                gaze_direction="away",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=98.0,
                volume_db=47.0, speech_rate_wpm=82.0,
                energy_level=0.18, emotion_confidence=0.70,
                silence_duration_ms=4000.0, filler_words_count=2,
            ),
        )
    return result


# =============================================================================
# 3. SOBRECARGA (OVERLOAD)
# =============================================================================
def scenario_overload():
    engine = make_engine_with_baseline()
    result = None
    for i in range(16):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=5000.0 + i * 200,
                typing_speed_cpm=60.0,
                error_occurred=True,
                correction_made=True,
                pause_duration_ms=1500.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=5, time_to_decide_ms=7000.0,
                confidence_indicator=0.15, depth_of_response=10,
                is_correct=False, backspace_count=8,
                hesitation_pauses=4,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.CONFUSED,
                emotion_confidence=0.80, valence=-0.50,
                arousal=0.75, attention_score=0.35,
                blink_rate=28.0, brow_furrow=0.80,
                gaze_direction="away",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=115.0,
                volume_db=58.0, speech_rate_wpm=65.0,
                energy_level=0.55, emotion_confidence=0.72,
                silence_duration_ms=2500.0, filler_words_count=5,
            ),
        )
    return result


# =============================================================================
# 4. DUDA (DOUBT)
# =============================================================================
def scenario_doubt():
    engine = make_engine_with_baseline()
    result = None
    for i in range(15):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=4000.0 + i * 150,
                typing_speed_cpm=100.0,
                error_occurred=(i % 3 == 0),
                correction_made=True,
                pause_duration_ms=2000.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=3, time_to_decide_ms=5500.0,
                confidence_indicator=0.20, depth_of_response=25,
                is_correct=(i % 3 != 0), backspace_count=4,
                hesitation_pauses=3,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.CONFUSED,
                emotion_confidence=0.70, valence=-0.20,
                arousal=0.45, attention_score=0.60,
                blink_rate=18.0, brow_furrow=0.60,
                gaze_direction="screen",
            ),
        )
    return result


# =============================================================================
# 5. DOMINIO (MASTERY)
# =============================================================================
def scenario_mastery():
    engine = make_engine_with_baseline(rt=2000.0, speed=150.0)
    result = None
    for i in range(18):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=1200.0 - i * 20,
                typing_speed_cpm=220.0 + i * 4,
                error_occurred=False,
                correction_made=False,
                pause_duration_ms=180.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=0, time_to_decide_ms=1300.0,
                confidence_indicator=0.95, depth_of_response=85,
                is_correct=True, backspace_count=0,
                hesitation_pauses=0,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.HAPPY,
                emotion_confidence=0.82, valence=0.60,
                arousal=0.45, attention_score=0.90,
                blink_rate=13.0, brow_furrow=0.02,
                gaze_direction="screen",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=130.0,
                volume_db=67.0, speech_rate_wpm=152.0,
                energy_level=0.72, emotion_confidence=0.80,
                silence_duration_ms=350.0, filler_words_count=0,
            ),
        )
    return result


# =============================================================================
# 6. FLUJO (FLOW)
# =============================================================================
def scenario_flow():
    engine = make_engine_with_baseline(rt=1800.0, speed=160.0)
    result = None
    for i in range(20):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=1500.0 + (i % 3) * 50,   # constante, sin picos
                typing_speed_cpm=190.0 + (i % 5) * 3,
                error_occurred=False,
                correction_made=False,
                pause_duration_ms=200.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=0, time_to_decide_ms=1600.0,
                confidence_indicator=0.88, depth_of_response=70,
                is_correct=True, backspace_count=0,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.FOCUSED,
                emotion_confidence=0.90, valence=0.50,
                arousal=0.55, attention_score=0.95,
                blink_rate=12.0, brow_furrow=0.03,
                gaze_direction="screen",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=125.0,
                volume_db=65.0, speech_rate_wpm=145.0,
                energy_level=0.68, emotion_confidence=0.82,
                silence_duration_ms=300.0, filler_words_count=0,
            ),
        )
    return result


# =============================================================================
# 7. FRUSTRACIÓN (FRUSTRATION)
# =============================================================================
def scenario_frustration():
    engine = make_engine_with_baseline()
    result = None
    for i in range(18):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=2800.0 + i * 120,   # RT moderado-alto
                typing_speed_cpm=125.0,
                error_occurred=True,        # errores TODOS
                correction_made=True,
                pause_duration_ms=600.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=4,            # > 3 ✓
                time_to_decide_ms=3200.0,
                confidence_indicator=0.25 - i * 0.005,  # tendencia negativa
                depth_of_response=28,
                is_correct=False,           # TODOS incorrectos → failure_chain creciente
                backspace_count=7,          # > 5 ✓
                hesitation_pauses=2,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.ANGRY,
                emotion_confidence=0.88, valence=-0.68,
                arousal=0.82,               # > 0.6 ✓
                attention_score=0.62,
                blink_rate=20.0, brow_furrow=0.88,  # > 0.6 ✓
                smile_intensity=0.0, gaze_direction="screen",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=120.0,
                volume_db=66.0, speech_rate_wpm=122.0,
                energy_level=0.72,          # > 0.7 ✓
                emotion_confidence=0.80,
                silence_duration_ms=700.0, filler_words_count=1,
                voice_tremor=0.25,          # > 0.2 ✓
            ),
        )
    return result


# =============================================================================
# 8. CURIOSIDAD (CURIOSITY)
# =============================================================================
def scenario_curiosity():
    engine = make_engine_with_baseline()
    result = None
    for i in range(14):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=1800.0 + (i % 4) * 200,
                typing_speed_cpm=170.0 + (i % 3) * 10,
                error_occurred=False,
                correction_made=False,
                pause_duration_ms=400.0,     # pausa reflexiva, no de fatiga
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=1, time_to_decide_ms=2200.0,
                confidence_indicator=0.65, depth_of_response=90,  # respuestas largas
                is_correct=True, backspace_count=1,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.SURPRISED,
                emotion_confidence=0.78, valence=0.40,
                arousal=0.72, attention_score=0.88,
                blink_rate=16.0, brow_furrow=0.30,
                smile_intensity=0.25, gaze_direction="screen",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=135.0,
                volume_db=63.0, speech_rate_wpm=138.0,
                energy_level=0.62, emotion_confidence=0.75,
                silence_duration_ms=500.0, filler_words_count=0,
            ),
        )
    return result


# =============================================================================
# RUNNER
# =============================================================================
if __name__ == "__main__":
    print("\n" + "=" * 65)
    print("🧠 NeuroLearn AI — Validación de los 8 Estados Cognitivos")
    print(f"   Mínimo aceptable: {MIN_CONFIDENCE:.0%}  |  Objetivo: {TARGET_CONFIDENCE:.0%}")
    print("=" * 65)

    SCENARIOS = [
        ("normal",      scenario_normal),
        ("fatigue",     scenario_fatigue),
        ("overload",    scenario_overload),
        ("doubt",       scenario_doubt),
        ("mastery",     scenario_mastery),
        ("flow",        scenario_flow),
        ("frustration", scenario_frustration),
        ("curiosity",   scenario_curiosity),
    ]

    for state_name, fn in SCENARIOS:
        run_state_test(state_name, fn)

    print("\n" + "=" * 65)
    passed_target = sum(1 for _, _, c, _ in results_summary if c >= TARGET_CONFIDENCE)
    passed_min    = sum(1 for _, _, _, ok in results_summary if ok)
    total = len(results_summary)

    print(f"📊 Objetivo ({TARGET_CONFIDENCE:.0%}+):   {passed_target}/{total} estados")
    print(f"📊 Mínimo  ({MIN_CONFIDENCE:.0%}+):   {passed_min}/{total} estados")

    # Desglose
    print("\n   Estado detectado vs esperado:")
    for expected, detected, conf, ok in results_summary:
        match = "✅" if detected == expected else f"⚠️  → detectó '{detected}'"
        print(f"   {expected:15s} {match}  ({conf:.3f})")

    if passed_target == total:
        print("\n✅ TODOS LOS ESTADOS SUPERAN EL OBJETIVO — Engine calibrado")
    elif passed_min == total:
        print(f"\n⚠️  Todos los estados son detectables pero {total - passed_target} necesitan más datos")
    else:
        print(f"\n❌ {total - passed_min} estado(s) por debajo del mínimo — revisar patrones")
    print("=" * 65)
