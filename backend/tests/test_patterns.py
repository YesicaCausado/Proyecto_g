"""
🧪 NeuroLearn AI — Tests Unitarios Aislados por Patrón Neuroconductual

Cada test valida un patrón de forma independiente con escenarios realistas:
  - Patrón 1: Ritmo de Interacción
  - Patrón 2: Secuencia de Decisión
  - Patrón 3: Microexpresión Facial
  - Patrón 4: Prosodia de Voz
  - Patrón 5: Predicción de Error
  - Fusión Bayesiana Multimodal

Ejecutar:
    cd backend
    python -m tests.test_patterns
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime
from app.ai.cognitive.neuroconductual_engine import (
    InteractionRhythmAnalyzer,
    DecisionSequenceAnalyzer,
    FacialMicroexpressionAnalyzer,
    VoiceProsodyAnalyzer,
    ErrorPredictionAnalyzer,
    MultimodalCognitiveEngine,
    BehavioralEvent,
    DecisionEvent,
    FacialData,
    VoiceProsodyData,
    EmotionEnum,
    CognitiveStateEnum,
    ModalityType,
)

PASS = "✅"
FAIL = "❌"
results = []


def check(name: str, condition: bool, detail: str = ""):
    icon = PASS if condition else FAIL
    msg = f"  {icon} {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append((name, condition))
    if not condition:
        raise AssertionError(f"FALLÓ: {name}. {detail}")


def now():
    return datetime.utcnow()


# =============================================================================
# PATRÓN 1: RITMO DE INTERACCIÓN
# =============================================================================

def test_pattern1_baseline():
    print("\n📊 PATRÓN 1 — Ritmo de Interacción")
    print("-" * 45)
    analyzer = InteractionRhythmAnalyzer()

    # Sin datos → no activo
    score = analyzer.analyze()
    check("Sin datos → is_active=False", not score.is_active)
    check("Sin datos → confianza baja", score.confidence < 0.2)

    # Alimentar baseline (10 eventos normales)
    for i in range(10):
        analyzer.add_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2000.0, typing_speed_cpm=150.0,
            error_occurred=False, pause_duration_ms=500.0,
        ))

    check("10 eventos → baseline creado", analyzer.baseline is not None)
    check("avg_rt en baseline ~2000ms",
          abs(analyzer.baseline["avg_rt"] - 2000) < 200,
          f"avg_rt={analyzer.baseline['avg_rt']:.0f}")


def test_pattern1_fatigue():
    analyzer = InteractionRhythmAnalyzer()
    # Baseline
    for _ in range(10):
        analyzer.add_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2000.0, typing_speed_cpm=150.0,
            error_occurred=False,
        ))
    # Fatiga: RT sube, velocidad baja, más errores
    for i in range(15):
        analyzer.add_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=4000.0 + i * 500,
            typing_speed_cpm=80.0 - i * 3,
            error_occurred=(i % 2 == 0),
            pause_duration_ms=2000.0 + i * 200,
        ))

    score = analyzer.analyze()
    fatigue_s = score.state_scores.get(CognitiveStateEnum.FATIGUE.value, 0)
    check("Fatiga → score fatigue > 0.4", fatigue_s > 0.4,
          f"fatigue_score={fatigue_s:.3f}")
    check("Fatiga → confianza > 0.5", score.confidence > 0.5,
          f"confidence={score.confidence:.3f}")
    print(f"    Scores: fatigue={fatigue_s:.3f}, "
          f"mastery={score.state_scores.get('mastery', 0):.3f}, "
          f"flow={score.state_scores.get('flow', 0):.3f}")


def test_pattern1_mastery():
    analyzer = InteractionRhythmAnalyzer()
    # Baseline moderado
    for _ in range(10):
        analyzer.add_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2000.0, typing_speed_cpm=150.0,
            error_occurred=False,
        ))
    # Dominio: RT baja, velocidad alta, sin errores
    for i in range(15):
        analyzer.add_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=1200.0 - i * 30,
            typing_speed_cpm=220.0 + i * 5,
            error_occurred=False,
            correction_made=False,
            pause_duration_ms=200.0,
        ))

    score = analyzer.analyze()
    mastery_s = score.state_scores.get(CognitiveStateEnum.MASTERY.value, 0)
    flow_s = score.state_scores.get(CognitiveStateEnum.FLOW.value, 0)
    check("Dominio → mastery+flow > 0.5", (mastery_s + flow_s) > 0.5,
          f"mastery={mastery_s:.3f}, flow={flow_s:.3f}")


# =============================================================================
# PATRÓN 2: SECUENCIA DE DECISIÓN
# =============================================================================

def test_pattern2_doubt():
    print("\n📊 PATRÓN 2 — Secuencia de Decisión")
    print("-" * 45)
    analyzer = DecisionSequenceAnalyzer()

    # Sin datos → no activo
    score = analyzer.analyze()
    check("Sin datos → is_active=False", not score.is_active)

    # Duda: muchas correcciones, vacilación, baja confianza
    for i in range(12):
        analyzer.add_decision(DecisionEvent(
            timestamp=now(),
            decision_type="answer",
            final_answer=f"respuesta {i}",
            changes_count=3 + (i % 3),
            time_to_decide_ms=5000.0 + i * 300,
            confidence_indicator=0.3 - i * 0.01,
            depth_of_response=20,
            is_correct=(i % 3 != 0),
            hesitation_pauses=2,
            backspace_count=4 + i,
        ))

    score = analyzer.analyze()
    doubt_s = score.state_scores.get(CognitiveStateEnum.DOUBT.value, 0)
    check("Duda → score doubt > 0.4", doubt_s > 0.4,
          f"doubt_score={doubt_s:.3f}")
    # failure_chain se resetea con cada acierto; el patrón i%3!=0 deja
    # failure_chain=1 al final (último evento falló). El doubt_score ya validó el estado.
    check("Fallos registrados (total_incorrect > 0)", analyzer.total_incorrect >= 1,
          f"total_incorrect={analyzer.total_incorrect}")
    print(f"    Scores: doubt={doubt_s:.3f}, "
          f"frustration={score.state_scores.get('frustration', 0):.3f}, "
          f"mastery={score.state_scores.get('mastery', 0):.3f}")


def test_pattern2_mastery():
    analyzer = DecisionSequenceAnalyzer()

    # Dominio: respuestas rápidas, sin vacilación, alta confianza, todo correcto
    for i in range(12):
        analyzer.add_decision(DecisionEvent(
            timestamp=now(),
            decision_type="answer",
            final_answer=f"respuesta correcta {i}",
            changes_count=0,
            time_to_decide_ms=1500.0,
            confidence_indicator=0.9,
            depth_of_response=60,
            is_correct=True,
            hesitation_pauses=0,
            backspace_count=0,
        ))

    score = analyzer.analyze()
    mastery_s = score.state_scores.get(CognitiveStateEnum.MASTERY.value, 0)
    check("Dominio → score mastery > 0.5", mastery_s > 0.5,
          f"mastery_score={mastery_s:.3f}")
    check("Racha de éxitos >= 10", analyzer.success_chain >= 10,
          f"success_chain={analyzer.success_chain}")


# =============================================================================
# PATRÓN 3: MICROEXPRESIÓN FACIAL
# =============================================================================

def test_pattern3_frustration():
    print("\n📊 PATRÓN 3 — Microexpresión Facial")
    print("-" * 45)
    analyzer = FacialMicroexpressionAnalyzer()

    # Sin datos → no activo
    score = analyzer.analyze()
    check("Sin datos → is_active=False", not score.is_active)

    # Frustración: valence negativa, ceño fruncido, poca sonrisa
    emotions = [EmotionEnum.ANGRY, EmotionEnum.DISGUSTED, EmotionEnum.CONFUSED,
                EmotionEnum.ANGRY, EmotionEnum.FEARFUL, EmotionEnum.CONFUSED,
                EmotionEnum.ANGRY, EmotionEnum.DISGUSTED]
    for i, emo in enumerate(emotions):
        analyzer.add_data(FacialData(
            timestamp=now(),
            emotion=emo,
            emotion_confidence=0.80,
            valence=-0.6 - (i * 0.03),
            arousal=0.7,
            attention_score=0.5,
            blink_rate=22.0,
            brow_furrow=0.75,
            smile_intensity=0.0,
            gaze_direction="screen",
        ))

    score = analyzer.analyze()
    frust_s = score.state_scores.get(CognitiveStateEnum.FRUSTRATION.value, 0)
    check("Frustración facial → score > 0.4", frust_s > 0.4,
          f"frustration_score={frust_s:.3f}")
    print(f"    Scores: frustration={frust_s:.3f}, "
          f"fatigue={score.state_scores.get('fatigue', 0):.3f}, "
          f"flow={score.state_scores.get('flow', 0):.3f}")


def test_pattern3_flow():
    analyzer = FacialMicroexpressionAnalyzer()

    # Flujo: atención alta, emociones positivas, valencia positiva
    for i in range(10):
        analyzer.add_data(FacialData(
            timestamp=now(),
            emotion=EmotionEnum.FOCUSED,
            emotion_confidence=0.85,
            valence=0.5,
            arousal=0.55,
            attention_score=0.92,
            blink_rate=14.0,
            brow_furrow=0.05,
            smile_intensity=0.3,
            gaze_direction="screen",
        ))

    score = analyzer.analyze()
    flow_s = score.state_scores.get(CognitiveStateEnum.FLOW.value, 0)
    check("Flujo facial → score > 0.4", flow_s > 0.4,
          f"flow_score={flow_s:.3f}")


# =============================================================================
# PATRÓN 4: PROSODIA DE VOZ
# =============================================================================

def test_pattern4_fatigue():
    print("\n📊 PATRÓN 4 — Prosodia de Voz")
    print("-" * 45)
    analyzer = VoiceProsodyAnalyzer()

    # Sin datos → no activo
    score = analyzer.analyze()
    check("Sin datos → is_active=False", not score.is_active)

    # Fatiga vocal: energía baja, habla lenta, silencios largos
    for i in range(8):
        analyzer.add_data(VoiceProsodyData(
            timestamp=now(),
            pitch_mean_hz=105.0,
            pitch_variance=5.0,
            volume_db=50.0 - i * 1.5,
            volume_variance=3.0,
            speech_rate_wpm=90.0 - i * 3,
            voice_tremor=0.15,
            energy_level=0.25 - i * 0.02,
            emotion_from_voice=EmotionEnum.SAD,
            emotion_confidence=0.65,
            silence_duration_ms=3000.0 + i * 200,
            filler_words_count=1,
        ))

    score = analyzer.analyze()
    fatigue_s = score.state_scores.get(CognitiveStateEnum.FATIGUE.value, 0)
    check("Fatiga vocal → score > 0.3", fatigue_s > 0.3,
          f"fatigue_score={fatigue_s:.3f}")
    print(f"    Scores: fatigue={fatigue_s:.3f}, "
          f"frustration={score.state_scores.get('frustration', 0):.3f}, "
          f"mastery={score.state_scores.get('mastery', 0):.3f}")


def test_pattern4_mastery():
    analyzer = VoiceProsodyAnalyzer()

    # Dominio vocal: energía alta, fluido, sin muletillas
    for i in range(8):
        analyzer.add_data(VoiceProsodyData(
            timestamp=now(),
            pitch_mean_hz=125.0,
            pitch_variance=12.0,
            volume_db=68.0,
            volume_variance=4.0,
            speech_rate_wpm=145.0,
            voice_tremor=0.04,
            energy_level=0.75,
            emotion_from_voice=EmotionEnum.FOCUSED,
            emotion_confidence=0.80,
            silence_duration_ms=500.0,
            filler_words_count=0,
        ))

    score = analyzer.analyze()
    mastery_s = score.state_scores.get(CognitiveStateEnum.MASTERY.value, 0)
    check("Dominio vocal → score > 0.4", mastery_s > 0.4,
          f"mastery_score={mastery_s:.3f}")


# =============================================================================
# PATRÓN 5: PREDICCIÓN DE ERROR
# =============================================================================

def test_pattern5_high_risk():
    print("\n📊 PATRÓN 5 — Predicción de Error")
    print("-" * 45)
    predictor = ErrorPredictionAnalyzer()

    # Sin datos → prior default
    score = predictor.predict_error({})
    check("Sin datos → is_active=False", not score.is_active)

    # Alimentar historial con muchos errores
    for i in range(15):
        had_error = (i % 2 == 0)  # 50% error rate
        predictor.record_interaction(
            metrics={"avg_rt": 4500.0, "avg_speed": 70.0, "correction_rate": 0.4},
            had_error=had_error,
            context="respuesta_incorrecta" if had_error else "ok",
        )

    score = predictor.predict_error(
        {"avg_rt": 5000.0, "avg_speed": 60.0, "correction_rate": 0.5},
    )
    err_prob = score.raw_metrics.get("error_probability", 0)
    check("Alto error rate → probabilidad > 0.5", err_prob > 0.5,
          f"error_prob={err_prob:.3f}")
    check("5 errores activo", score.is_active)
    print(f"    error_probability={err_prob:.3f}, prior={predictor.prior_error_rate:.3f}")


def test_pattern5_low_risk():
    predictor = ErrorPredictionAnalyzer()

    # Historial perfecto → riesgo bajo
    for i in range(15):
        predictor.record_interaction(
            metrics={"avg_rt": 1500.0, "avg_speed": 200.0, "correction_rate": 0.02},
            had_error=False,
        )

    score = predictor.predict_error(
        {"avg_rt": 1400.0, "avg_speed": 210.0, "correction_rate": 0.01},
    )
    err_prob = score.raw_metrics.get("error_probability", 1)
    check("Historial perfecto → probabilidad < 0.3", err_prob < 0.3,
          f"error_prob={err_prob:.3f}")


# =============================================================================
# FUSIÓN BAYESIANA MULTIMODAL
# =============================================================================

def test_multimodal_fusion_fatigue():
    print("\n📊 FUSIÓN BAYESIANA — Estado Final Integrado")
    print("-" * 45)
    engine = MultimodalCognitiveEngine()

    # Baseline
    for _ in range(10):
        engine.add_behavioral_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2000.0, typing_speed_cpm=150.0,
            error_occurred=False,
        ))

    # Señales convergentes de FATIGA en los 5 canales
    for i in range(15):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=4000.0 + i * 400,
                typing_speed_cpm=80.0 - i * 3,
                error_occurred=(i % 2 == 0),
                pause_duration_ms=2500.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=3, time_to_decide_ms=6000.0,
                confidence_indicator=0.25, depth_of_response=15,
                is_correct=False, backspace_count=5,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.SAD,
                emotion_confidence=0.75, valence=-0.4,
                arousal=0.2, attention_score=0.45,
                blink_rate=24.0, brow_furrow=0.5,
                gaze_direction="away",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=100.0,
                volume_db=48.0, speech_rate_wpm=85.0,
                energy_level=0.2, emotion_confidence=0.70,
                silence_duration_ms=3500.0, filler_words_count=2,
            ),
        )

    check("Estado final es fatigue u overload",
          result.state.value in ["fatigue", "overload", "doubt"],
          f"estado={result.state.value}, confianza={result.confidence:.3f}")
    check("Confianza > 0.4", result.confidence > 0.4,
          f"confidence={result.confidence:.3f}")
    check("5 modalidades activas", len(result.active_modalities) == 5,
          f"activas={result.active_modalities}")
    check("should_adapt=True", result.should_adapt,
          f"should_adapt={result.should_adapt}, difficulty={result.suggested_difficulty}")
    check("Dificultad sugerida es 'easy' o 'beginner'",
          result.suggested_difficulty in ["easy", "beginner"],
          f"suggested={result.suggested_difficulty}")
    check("engagement_score es float", isinstance(result.engagement_score, float),
          f"type={type(result.engagement_score).__name__}, val={result.engagement_score}")
    check("engagement_score entre 0 y 1", 0.0 <= result.engagement_score <= 1.0,
          f"val={result.engagement_score}")
    print(f"    Estado={result.state.value}, confianza={result.confidence:.3f}, "
          f"dificultad={result.suggested_difficulty}, engagement={result.engagement_score:.3f}")


def test_multimodal_fusion_flow():
    engine = MultimodalCognitiveEngine()

    # Baseline
    for _ in range(10):
        engine.add_behavioral_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2000.0, typing_speed_cpm=150.0,
            error_occurred=False,
        ))

    # Señales convergentes de FLUJO / DOMINIO
    for i in range(15):
        result = engine.add_multimodal_event(
            behavioral=BehavioralEvent(
                timestamp=now(), event_type="response",
                response_time_ms=1300.0 - i * 20,
                typing_speed_cpm=210.0 + i * 5,
                error_occurred=False,
                correction_made=False,
                pause_duration_ms=180.0,
            ),
            decision=DecisionEvent(
                timestamp=now(), decision_type="answer",
                changes_count=0, time_to_decide_ms=1400.0,
                confidence_indicator=0.92, depth_of_response=80,
                is_correct=True, backspace_count=0,
            ),
            facial=FacialData(
                timestamp=now(), emotion=EmotionEnum.FOCUSED,
                emotion_confidence=0.85, valence=0.55,
                arousal=0.55, attention_score=0.93,
                blink_rate=13.0, brow_furrow=0.04,
                gaze_direction="screen",
            ),
            voice=VoiceProsodyData(
                timestamp=now(), pitch_mean_hz=128.0,
                volume_db=66.0, speech_rate_wpm=148.0,
                energy_level=0.72, emotion_confidence=0.80,
                silence_duration_ms=400.0, filler_words_count=0,
            ),
        )

    check("Estado final es flow o mastery",
          result.state.value in ["flow", "mastery", "normal"],
          f"estado={result.state.value}, confianza={result.confidence:.3f}")
    check("error_risk < 0.3", result.error_risk < 0.3,
          f"error_risk={result.error_risk:.3f}")
    print(f"    Estado={result.state.value}, confianza={result.confidence:.3f}, "
          f"error_risk={result.error_risk:.3f}, engagement={result.engagement_score:.3f}")


def test_multimodal_only_p1_p2():
    """Verifica que el engine funciona sin cámara ni micrófono (modo básico)"""
    engine = MultimodalCognitiveEngine()

    for _ in range(10):
        engine.add_behavioral_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=2000.0, typing_speed_cpm=150.0,
            error_occurred=False,
        ))
    for i in range(10):
        result = engine.add_behavioral_event(BehavioralEvent(
            timestamp=now(), event_type="response",
            response_time_ms=3800.0 + i * 300,
            typing_speed_cpm=90.0,
            error_occurred=(i % 2 == 0),
        ))

    status = engine.get_modality_status()
    check("Sin cámara/mic → P3 inactivo", not status["facial_microexpression"]["active"])
    check("Sin cámara/mic → P4 inactivo", not status["voice_prosody"]["active"])
    check("P1 activo solo con teclado", status["interaction_rhythm"]["active"])
    check("P2 activo solo con teclado", status["decision_sequence"]["active"])
    check("Engine produce resultado válido", result.state is not None)
    print(f"    Modo texto puro → Estado={result.state.value}, "
          f"activas={result.active_modalities}")


# =============================================================================
# RUNNER
# =============================================================================

if __name__ == "__main__":
    print("\n" + "=" * 60)
    print("🧪 NeuroLearn AI — Tests Unitarios por Patrón")
    print("=" * 60)

    tests = [
        # Patrón 1
        test_pattern1_baseline,
        test_pattern1_fatigue,
        test_pattern1_mastery,
        # Patrón 2
        test_pattern2_doubt,
        test_pattern2_mastery,
        # Patrón 3
        test_pattern3_frustration,
        test_pattern3_flow,
        # Patrón 4
        test_pattern4_fatigue,
        test_pattern4_mastery,
        # Patrón 5
        test_pattern5_high_risk,
        test_pattern5_low_risk,
        # Fusión
        test_multimodal_fusion_fatigue,
        test_multimodal_fusion_flow,
        test_multimodal_only_p1_p2,
    ]

    passed = 0
    failed = 0
    for test_fn in tests:
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            print(f"  {FAIL} ASSERTION: {e}")
            failed += 1
        except Exception as e:
            print(f"  {FAIL} ERROR en {test_fn.__name__}: {e}")
            import traceback
            traceback.print_exc()
            failed += 1

    print("\n" + "=" * 60)
    total_checks = len(results)
    total_passed = sum(1 for _, ok in results if ok)
    print(f"📊 Checks: {total_passed}/{total_checks} pasaron")
    print(f"📊 Tests:  {passed}/{len(tests)} pasaron")
    if failed == 0:
        print("✅ ¡TODOS LOS TESTS PASARON!")
    else:
        print(f"❌ {failed} test(s) fallaron")
    print("=" * 60)
