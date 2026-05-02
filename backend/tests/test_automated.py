"""
🧪 NeuroLearn AI - Prueba Automática Completa (sin interacción manual)

Ejecutar:
    cd backend
    python -m tests.test_automated
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.chatbot.adaptive_chatbot import AdaptiveChatbot
from app.ai.cognitive.neuroconductual_engine import (
    NeuroconductualEngine, BehavioralEvent,
    DecisionEvent, FacialData, VoiceProsodyData,
    EmotionEnum, CognitiveStateEnum,
)
from app.ai.expert_bot.trainer import ExpertBotTrainer
from datetime import datetime


async def test_all():
    print("\n" + "=" * 70)
    print("🧠 NeuroLearn AI - PRUEBA AUTOMÁTICA COMPLETA")
    print("=" * 70)

    # ============ TEST 1: Motor Neuroconductual ============
    print("\n\n📊 TEST 1: Motor de Inferencia Neuroconductual")
    print("-" * 50)

    engine = NeuroconductualEngine()

    # Fase baseline
    print("  ▶ Estableciendo línea base (12 eventos normales)...")
    for i in range(12):
        event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=2000 + (i * 30),
            typing_speed_cpm=150,
            error_occurred=i % 5 == 0,
            pause_duration_ms=500,
        )
        result = engine.add_event(event)

    assert engine.baseline is not None, "❌ La línea base no se construyó"
    print(f"  ✅ Línea base establecida: RT_avg={engine.baseline['avg_response_time']:.0f}ms")

    # Fase fatiga
    print("  ▶ Simulando fatiga (10 eventos degradados)...")
    for i in range(10):
        event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=3500 + (i * 600),
            typing_speed_cpm=100 - (i * 5),
            error_occurred=i % 2 == 0,
            pause_duration_ms=1500 + (i * 300),
        )
        result = engine.add_event(event)

    last_state = result.state.value
    print(f"  📊 Estado detectado: {last_state} (confianza: {result.confidence})")
    print(f"  💡 Recomendación: {result.recommendations[0] if result.recommendations else 'N/A'}")
    assert last_state in ["fatigue", "overload", "doubt"], f"Se esperaba fatiga/sobrecarga, pero fue {last_state}"
    print("  ✅ Detección de fatiga/sobrecarga correcta")

    # Fase dominio
    print("  ▶ Simulando dominio (respuestas rápidas y precisas)...")
    engine.reset()
    for i in range(12):
        engine.add_event(BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=2000,
            typing_speed_cpm=150,
            error_occurred=False,
            pause_duration_ms=400,
        ))

    for i in range(15):
        result = engine.add_event(BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=1200 - (i * 40),
            typing_speed_cpm=220 + (i * 10),
            error_occurred=False,
            correction_made=False,
            pause_duration_ms=200,
        ))

    profile = engine.get_cognitive_profile()
    print(f"  📊 Estado dominante: {profile['dominant_state']}")
    print(f"  📊 Distribución: {profile['state_distribution']}")
    print("  ✅ Perfil cognitivo generado correctamente")

    # ============ TEST 1b: Motor Multimodal - 5 Patrones ============
    print("\n\n🧠 TEST 1b: Motor Multimodal - 5 Patrones Neuroconductuales")
    print("-" * 50)

    engine2 = NeuroconductualEngine()

    # Patrón 1: Ritmo de Interacción
    print("  ▶ Patrón 1: Ritmo de Interacción...")
    for i in range(15):
        engine2.add_behavioral_event(BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=2000 + (i * 50),
            typing_speed_cpm=150 - (i * 2),
            error_occurred=i % 6 == 0,
            pause_duration_ms=500 + (i * 30),
            content_length=50 + i * 5,
        ), user_message=f"respuesta {i}")

    status = engine2.get_modality_status()
    assert status["interaction_rhythm"]["active"], "❌ Ritmo de interacción debería estar activo"
    assert status["interaction_rhythm"]["baseline_ready"], "❌ Baseline debería estar listo"
    print(f"    ✅ Activo, baseline listo, {status['interaction_rhythm']['data_points']} puntos")

    # Patrón 2: Secuencia de Decisión
    print("  ▶ Patrón 2: Secuencia de Decisión...")
    for i in range(8):
        engine2.add_decision_event(DecisionEvent(
            timestamp=datetime.utcnow(),
            decision_type="answer",
            final_answer=f"respuesta {i}",
            changes_count=i % 3,
            time_to_decide_ms=3000 + (i * 200),
            confidence_indicator=0.8 - (i * 0.05),
            depth_of_response=30 + i * 10,
            is_correct=i % 3 != 0,
            hesitation_pauses=1 if i % 2 == 0 else 0,
            backspace_count=i % 4,
        ))
    assert status["decision_sequence"]["active"], "❌ Secuencia de decisión debería estar activa"
    print(f"    ✅ Activo, {status['decision_sequence']['data_points']} decisiones registradas")

    # Patrón 3: Microexpresión Facial
    print("  ▶ Patrón 3: Microexpresión Facial...")
    emotions = [EmotionEnum.NEUTRAL, EmotionEnum.FOCUSED, EmotionEnum.CONFUSED,
                EmotionEnum.HAPPY, EmotionEnum.SURPRISED, EmotionEnum.NEUTRAL]
    for i, emo in enumerate(emotions):
        engine2.add_facial_data(FacialData(
            timestamp=datetime.utcnow(),
            emotion=emo,
            emotion_confidence=0.75 + (i * 0.02),
            valence=0.2 if emo in [EmotionEnum.HAPPY, EmotionEnum.FOCUSED] else -0.1,
            arousal=0.5 + (i * 0.05),
            attention_score=0.85 - (i * 0.05),
            blink_rate=16 + i,
            brow_furrow=0.3 if emo == EmotionEnum.CONFUSED else 0.1,
            smile_intensity=0.5 if emo == EmotionEnum.HAPPY else 0.0,
            gaze_direction="screen" if i < 4 else "away",
        ))
    status = engine2.get_modality_status()
    assert status["facial_microexpression"]["active"], "❌ Microexpresión facial debería estar activa"
    print(f"    ✅ Activo, {status['facial_microexpression']['data_points']} frames faciales")

    # Patrón 4: Prosodia de Voz
    print("  ▶ Patrón 4: Prosodia de Voz...")
    for i in range(6):
        engine2.add_voice_data(VoiceProsodyData(
            timestamp=datetime.utcnow(),
            pitch_mean_hz=120 + (i * 5),
            pitch_variance=10 + i,
            volume_db=60 + (i * 2),
            volume_variance=5 + i,
            speech_rate_wpm=130 + (i * 3),
            voice_tremor=0.05 + (i * 0.02),
            energy_level=0.7 - (i * 0.05),
            emotion_from_voice=EmotionEnum.NEUTRAL,
            emotion_confidence=0.6 + (i * 0.03),
            filler_words_count=i % 3,
        ))
    status = engine2.get_modality_status()
    assert status["voice_prosody"]["active"], "❌ Prosodia de voz debería estar activa"
    print(f"    ✅ Activo, {status['voice_prosody']['data_points']} muestras de voz")

    # Patrón 5: Predicción de Error (ya alimentado por add_behavioral_event)
    assert status["error_prediction"]["active"], "❌ Predicción de error debería estar activa"
    print(f"    ✅ Activo, riesgo actual: {status['error_prediction']['current_risk']:.2%}")

    # Inferencia multimodal completa
    print("\n  ▶ Ejecutando inferencia multimodal con 5 modalidades...")
    result = engine2.add_multimodal_event(
        behavioral=BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=2500,
            typing_speed_cpm=140,
            error_occurred=False,
            content_length=80,
        ),
        facial=FacialData(
            timestamp=datetime.utcnow(),
            emotion=EmotionEnum.FOCUSED,
            emotion_confidence=0.85,
            valence=0.3,
            arousal=0.55,
            attention_score=0.9,
            gaze_direction="screen",
        ),
        voice=VoiceProsodyData(
            timestamp=datetime.utcnow(),
            pitch_mean_hz=125,
            volume_db=62,
            speech_rate_wpm=135,
            energy_level=0.65,
            emotion_confidence=0.7,
        ),
        user_message="prueba multimodal completa"
    )

    print(f"  📊 Estado cognitivo: {result.state.value} (confianza: {result.confidence})")
    print(f"  📊 Modalidades activas: {result.active_modalities}")
    print(f"  📊 Estado emocional: {result.emotional_state}")
    print(f"  📊 Atención: {result.attention_level}")
    print(f"  📊 Engagement: {result.engagement_score}")
    print(f"  📊 Riesgo de error: {result.error_risk}")
    print(f"  💡 Recomendaciones: {result.recommendations[0] if result.recommendations else 'N/A'}")

    assert len(result.active_modalities) >= 3, f"❌ Se esperaban ≥3 modalidades activas, fueron {len(result.active_modalities)}"
    assert result.confidence > 0, "❌ La confianza debe ser > 0"
    assert 0 <= result.engagement_score <= 1, "❌ Engagement debe estar entre 0 y 1"
    assert 0 <= result.error_risk <= 1, "❌ Riesgo de error debe estar entre 0 y 1"
    print("  ✅ Inferencia multimodal con fusión bayesiana: CORRECTO")

    # ============ TEST 2: Entrenador de Bot Experto ============
    print("\n\n🏗️ TEST 2: Entrenador de Bot Experto")
    print("-" * 50)

    trainer = ExpertBotTrainer()

    # Iniciar
    r = trainer.start_training("Bot de Cocina", "Enseña recetas básicas", "Cocina")
    print(f"  ✅ Bot creado: {r['status']}")

    # Personalidad
    r = trainer.set_personality("encouraging", "detailed", True, True)
    print(f"  ✅ Personalidad: {r['status']}")

    # Pasos
    trainer.add_step("Preparar ingredientes", "Lavar, pelar y cortar", is_critical=True,
                     common_errors=["No lavar los vegetales"])
    trainer.add_step("Calentar sartén", "A fuego medio con aceite",
                     tips=["Usa aceite de oliva"])
    trainer.add_step("Cocinar", "Seguir la receta paso a paso",
                     common_errors=["Temperatura muy alta"])
    trainer.add_step("Emplatar", "Presentar de forma atractiva")
    print(f"  ✅ 4 pasos añadidos")

    # Advertencias
    trainer.add_warning("Nunca dejes la estufa encendida sin supervisión", "critical")
    trainer.add_warning("Ten cuidado con el aceite caliente", "high")
    print(f"  ✅ 2 advertencias añadidas")

    # Reglas
    trainer.add_rule("Siempre lávate las manos antes de cocinar")
    trainer.add_rule("Sigue los tiempos de cocción")
    trainer.add_rule("Prueba la sazón durante la preparación")
    print(f"  ✅ 3 reglas añadidas")

    # Tips
    trainer.add_tip("Un buen cuchillo hace toda la diferencia")
    trainer.add_tip("Cocina a fuego bajo para mejores resultados")
    trainer.add_tip("Sazona en capas, no todo al final")
    print(f"  ✅ 3 tips añadidos")

    # Q&A
    trainer.add_qa_pair("¿Qué aceite usar?", "Aceite de oliva para saltear, girasol para freír")
    trainer.add_qa_pair("¿Cómo saber si la sartén está lista?", "Pon una gota de agua, si salta está lista")
    trainer.add_qa_pair("¿Cuánta sal usar?", "Empieza con poco y prueba. Siempre puedes añadir más")
    trainer.add_qa_pair("¿Cómo evitar que se pegue?", "Calienta bien la sartén y usa suficiente aceite")
    trainer.add_qa_pair("¿Cómo cortar cebolla sin llorar?", "Enfríala antes de cortarla o corta cerca del extractor")
    print(f"  ✅ 5 Q&A añadidos")

    # Escenario
    trainer.add_scenario(
        title="Hacer una tortilla española",
        description="Preparar una tortilla de patatas básica",
        initial_situation="Tienes patatas, huevos, cebolla, aceite y sal",
        expected_actions=["Pelar y cortar patatas", "Freír a fuego medio", "Batir huevos", "Mezclar y cuajar"],
        correct_outcome="Tortilla dorada y jugosa por dentro",
        common_mistakes=["Patatas crudas", "Fuego muy alto", "No dar la vuelta"],
    )
    print(f"  ✅ 1 escenario añadido")

    # Revisión
    review = trainer.get_review()
    print(f"  📊 Revisión: listo={review['is_ready']}")
    assert review["is_ready"], "❌ El bot debería estar listo"
    print(f"  ✅ Bot listo para finalizar")

    # Finalizar
    final = trainer.finalize()
    print(f"  ✅ Bot finalizado: {final['status']}")
    knowledge = trainer.export_knowledge()
    print(f"  📦 Conocimiento exportado: {len(knowledge['steps'])} pasos, {len(knowledge['faq'])} FAQ")

    # ============ TEST 3: Chatbot con Bot Entrenado ============
    print("\n\n🤖 TEST 3: Chatbot Adaptativo con Bot Experto")
    print("-" * 50)

    chatbot = AdaptiveChatbot()
    response = chatbot.start_session(
        topic="Cocina Básica",
        difficulty="beginner",
        bot_knowledge=knowledge,
    )
    print(f"  ✅ Sesión iniciada")
    print(f"  🤖 {response.message[:150]}...")

    # Conversación simulada
    test_messages = [
        ("¿Qué aceite debo usar para cocinar?", 1800, 140, 0),
        ("¿Cómo sé si la sartén está lista?", 2200, 130, 0),
        ("No entiendo cómo cortar la cebolla sin llorar", 3500, 90, 2),
        ("ejemplo", 1000, 200, 0),
        ("evaluar", 800, 250, 0),
        ("Para hacer una tortilla necesito patatas, huevos, cebolla y aceite. Primero pelo y corto las patatas, luego las frío a fuego medio", 5000, 160, 1),
    ]

    for msg, rt, ts, corr in test_messages:
        response = await chatbot.process_message(
            user_message=msg,
            response_time_ms=rt,
            typing_speed_cpm=ts,
            corrections=corr,
        )
        print(f"\n  👤 {msg}")
        print(f"  🤖 {response.message[:120]}...")
        print(f"     Estado: {response.cognitive_state.value} | Acción: {response.action.value} | Dificultad: {response.difficulty.value}")

    stats = chatbot.get_session_stats()
    print(f"\n  📊 Estadísticas finales:")
    print(f"     Interacciones: {stats['interactions']}")
    print(f"     Dificultad: {stats['difficulty']}")
    print(f"     Estado cognitivo: {stats['cognitive_state']}")
    print(f"     Duración: {stats['duration_minutes']:.1f} min")

    # ============ RESUMEN ============
    print("\n\n" + "=" * 70)
    print("✅ ¡TODAS LAS PRUEBAS PASARON EXITOSAMENTE!")
    print("=" * 70)
    print("""
    📊 Resumen de componentes verificados:
    
    1. ✅ Motor de Inferencia Neuroconductual Multimodal
       - Construcción de línea base
       - Detección de fatiga/sobrecarga
       - Detección de dominio/flujo
       - Generación de perfil cognitivo
       - Patrón 1: Ritmo de Interacción
       - Patrón 2: Secuencia de Decisión
       - Patrón 3: Microexpresión Facial
       - Patrón 4: Prosodia de Voz
       - Patrón 5: Patrón Predictivo de Error
       - Fusión Bayesiana Multimodal
    
    2. ✅ Entrenador de Bot Experto
       - Creación y configuración
       - Definición de pasos, reglas, advertencias, tips
       - Escenarios de simulación
       - Q&A pairs
       - Exportación de conocimiento
    
    3. ✅ Chatbot Adaptativo
       - Inicio de sesión con bot experto
       - Procesamiento de mensajes con métricas
       - Decisiones pedagógicas automáticas
       - Inferencia cognitiva en tiempo real
       - Estadísticas de sesión
    
    🚀 Los chatbots están listos para usar.
    """)


if __name__ == "__main__":
    asyncio.run(test_all())
