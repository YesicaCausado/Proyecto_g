"""
🧪 NeuroLearn AI - Script de Prueba de Chatbots

Este script permite probar los chatbots de forma interactiva
desde la terminal, sin necesidad de levantar el servidor.

Ejecutar:
    cd backend
    python -m tests.test_chatbot_interactive
"""
import asyncio
import sys
import os
import time

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.chatbot.adaptive_chatbot import AdaptiveChatbot, ChatResponse
from app.ai.cognitive.neuroconductual_engine import NeuroconductualEngine, BehavioralEvent
from datetime import datetime


def print_header():
    print("\n" + "=" * 70)
    print("🧠 NeuroLearn AI - Prueba Interactiva del Chatbot Adaptativo")
    print("=" * 70)
    print()
    print("Comandos especiales:")
    print("  'salir'     - Terminar la sesión")
    print("  'stats'     - Ver estadísticas de la sesión")
    print("  'perfil'    - Ver perfil cognitivo")
    print("  'ejemplo'   - Pedir un ejemplo")
    print("  'evaluar'   - Iniciar evaluación")
    print("  'resumen'   - Ver resumen")
    print()


def print_response(response: ChatResponse):
    print(f"\n{'─' * 60}")
    print(f"🤖 {response.message}")
    print(f"{'─' * 60}")
    print(f"  📊 Estado cognitivo: {response.cognitive_state.value}")
    print(f"  🎯 Dificultad: {response.difficulty.value}")
    print(f"  🎬 Acción: {response.action.value}")
    if response.should_pause:
        print(f"  ⏸️  ¡PAUSA RECOMENDADA!")
    if response.suggestions:
        print(f"  💡 Sugerencias:")
        for s in response.suggestions:
            print(f"     - {s}")
    print()


async def test_adaptive_chatbot():
    """Prueba interactiva del chatbot adaptativo"""
    print_header()
    
    # Seleccionar tema
    topic = input("📚 ¿Sobre qué tema quieres aprender? > ").strip()
    if not topic:
        topic = "Programación en Python"
    
    difficulty = input("🎯 Dificultad inicial (beginner/easy/medium/hard/expert) [medium] > ").strip()
    if not difficulty or difficulty not in ["beginner", "easy", "medium", "hard", "expert"]:
        difficulty = "medium"
    
    print(f"\n⏳ Iniciando sesión sobre '{topic}' en nivel '{difficulty}'...\n")
    
    # Crear chatbot
    chatbot = AdaptiveChatbot()
    
    # Iniciar sesión
    response = chatbot.start_session(topic=topic, difficulty=difficulty)
    print_response(response)
    
    # Bucle de conversación
    while True:
        try:
            # Medir tiempo de respuesta
            start_time = time.time()
            user_input = input("👤 Tú > ").strip()
            response_time = (time.time() - start_time) * 1000  # ms
            
            if not user_input:
                continue
            
            if user_input.lower() == "salir":
                print("\n📊 Estadísticas finales:")
                stats = chatbot.get_session_stats()
                for key, value in stats.items():
                    if key != "cognitive_profile":
                        print(f"  {key}: {value}")
                print("\n👋 ¡Hasta la próxima!")
                break
            
            if user_input.lower() == "stats":
                stats = chatbot.get_session_stats()
                print("\n📊 Estadísticas de la sesión:")
                for key, value in stats.items():
                    if key != "cognitive_profile":
                        print(f"  {key}: {value}")
                continue
            
            if user_input.lower() == "perfil":
                profile = chatbot.cognitive_engine.get_cognitive_profile()
                print("\n🧠 Perfil Cognitivo:")
                for key, value in profile.items():
                    print(f"  {key}: {value}")
                continue
            
            # Estimar velocidad de escritura
            typing_speed = (len(user_input) / max(response_time / 1000, 0.1)) * 60  # CPM
            
            # Simular detección de correcciones (en producción viene del frontend)
            corrections = 0
            
            # Procesar mensaje
            response = await chatbot.process_message(
                user_message=user_input,
                response_time_ms=response_time,
                typing_speed_cpm=typing_speed,
                corrections=corrections,
                pause_before_ms=0,
            )
            
            print_response(response)
            
        except KeyboardInterrupt:
            print("\n\n👋 ¡Sesión interrumpida!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            continue


async def test_cognitive_engine():
    """Prueba del motor de inferencia neuroconductual"""
    print("\n" + "=" * 70)
    print("🧠 NeuroLearn AI - Prueba del Motor Neuroconductual")
    print("=" * 70)
    
    engine = NeuroconductualEngine()
    
    # Simular eventos de comportamiento
    print("\n📊 Simulando comportamiento del usuario...")
    
    # Fase 1: Comportamiento normal (baseline)
    print("\n--- Fase 1: Estableciendo línea base ---")
    for i in range(12):
        event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=2000 + (i * 50),  # Tiempos normales
            typing_speed_cpm=150,
            error_occurred=i % 5 == 0,  # Error cada 5 eventos
            correction_made=False,
            pause_duration_ms=500,
        )
        result = engine.add_event(event)
        print(f"  Evento {i+1}: Estado={result.state.value}, Confianza={result.confidence}")
    
    # Fase 2: Simular fatiga (tiempos crecientes)
    print("\n--- Fase 2: Simulando fatiga ---")
    for i in range(10):
        event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=3000 + (i * 500),  # Tiempos crecientes
            typing_speed_cpm=120 - (i * 5),  # Velocidad decreciente
            error_occurred=i % 3 == 0,  # Más errores
            correction_made=i % 4 == 0,
            pause_duration_ms=1000 + (i * 200),
        )
        result = engine.add_event(event)
        print(f"  Evento {12+i+1}: Estado={result.state.value}, Confianza={result.confidence}")
        if result.recommendations:
            print(f"    💡 {result.recommendations[0]}")
    
    # Fase 3: Simular dominio (respuestas rápidas y precisas)
    print("\n--- Fase 3: Simulando dominio ---")
    engine.reset()
    # Rebuild baseline
    for i in range(12):
        event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=2000,
            typing_speed_cpm=150,
            error_occurred=False,
            correction_made=False,
            pause_duration_ms=500,
        )
        engine.add_event(event)
    
    for i in range(10):
        event = BehavioralEvent(
            timestamp=datetime.utcnow(),
            event_type="response",
            response_time_ms=1200 - (i * 50),  # Cada vez más rápido
            typing_speed_cpm=200 + (i * 10),  # Cada vez más rápido
            error_occurred=False,  # Sin errores
            correction_made=False,
            pause_duration_ms=300,
        )
        result = engine.add_event(event)
        print(f"  Evento {i+1}: Estado={result.state.value}, Confianza={result.confidence}")
        if result.recommendations:
            print(f"    💡 {result.recommendations[0]}")
    
    # Mostrar perfil
    profile = engine.get_cognitive_profile()
    print("\n🧠 Perfil Cognitivo Final:")
    for key, value in profile.items():
        print(f"  {key}: {value}")


async def test_expert_bot_trainer():
    """Prueba del entrenador de bot experto"""
    print("\n" + "=" * 70)
    print("🏗️ NeuroLearn AI - Prueba del Entrenador de Bot Experto")
    print("=" * 70)
    
    from app.ai.expert_bot.trainer import ExpertBotTrainer
    
    trainer = ExpertBotTrainer()
    
    # 1. Iniciar entrenamiento
    print("\n📋 Iniciando entrenamiento...")
    result = trainer.start_training(
        name="Bot de Python Básico",
        description="Bot que enseña los fundamentos de Python",
        category="Programación",
    )
    print(result["message"])
    
    # 2. Configurar personalidad
    print("\n🎭 Configurando personalidad...")
    result = trainer.set_personality(
        teaching_style="encouraging",
        verbosity="detailed",
        use_examples=True,
        use_analogies=True,
    )
    print(result["message"])
    
    # 3. Añadir pasos
    print("\n📝 Añadiendo pasos del proceso...")
    steps = [
        {
            "title": "Instalar Python",
            "description": "Descargar e instalar Python desde python.org",
            "details": "Asegúrate de marcar 'Add to PATH' durante la instalación",
            "is_critical": True,
            "common_errors": ["No agregar Python al PATH", "Instalar versión incorrecta"],
            "tips": ["Usa Python 3.10 o superior", "Verifica con 'python --version'"],
        },
        {
            "title": "Tu primer programa",
            "description": "Crear y ejecutar un archivo .py con print('Hola Mundo')",
            "details": "Usa un editor de texto o VS Code",
            "common_errors": ["Olvidar las comillas", "Error de indentación"],
            "tips": ["VS Code tiene excelente soporte para Python"],
        },
        {
            "title": "Variables y tipos de datos",
            "description": "Aprender sobre int, float, str, bool",
            "details": "Python es de tipado dinámico",
            "common_errors": ["Confundir tipos", "No convertir tipos al operar"],
            "tips": ["Usa type() para verificar el tipo de una variable"],
        },
        {
            "title": "Estructuras de control",
            "description": "if/else, for, while",
            "common_errors": ["Olvidar los dos puntos :", "Indentación incorrecta"],
        },
    ]
    
    for step_data in steps:
        result = trainer.add_step(**step_data)
        print(f"  ✅ {result['message']}")
    
    # 4. Añadir advertencias
    print("\n⚠️ Añadiendo advertencias...")
    trainer.add_warning(
        message="Nunca uses eval() con entrada de usuario",
        severity="critical",
    )
    trainer.add_warning(
        message="Cuida la indentación - Python usa espacios, no tabs mezclados",
        severity="high",
    )
    print("  ✅ 2 advertencias añadidas")
    
    # 5. Añadir reglas
    print("\n📋 Añadiendo reglas...")
    trainer.add_rule("Siempre usa nombres de variables descriptivos")
    trainer.add_rule("Comenta tu código de forma clara")
    trainer.add_rule("Usa funciones para código reutilizable")
    print("  ✅ 3 reglas añadidas")
    
    # 6. Añadir tips
    print("\n💡 Añadiendo tips...")
    trainer.add_tip("Usa f-strings para formatear texto: f'Hola {nombre}'")
    trainer.add_tip("La documentación oficial de Python es excelente: docs.python.org")
    trainer.add_tip("Practica en Jupyter Notebooks para experimentar")
    print("  ✅ 3 tips añadidos")
    
    # 7. Añadir Q&A
    print("\n❓ Añadiendo Q&A...")
    qa_pairs = [
        {"question": "¿Qué es Python?", "answer": "Python es un lenguaje de programación de alto nivel, interpretado y de propósito general, conocido por su sintaxis limpia y legible."},
        {"question": "¿Qué es una variable?", "answer": "Una variable es un espacio en memoria que almacena un valor. En Python, se crea simplemente asignando un valor: nombre = 'Juan'"},
        {"question": "¿Qué es una función?", "answer": "Una función es un bloque de código reutilizable que realiza una tarea específica. Se define con 'def nombre_funcion():' "},
        {"question": "¿Cómo se instala un paquete?", "answer": "Usando pip: 'pip install nombre_paquete'. Pip es el gestor de paquetes de Python."},
        {"question": "¿Qué es una lista?", "answer": "Una lista es una colección ordenada y modificable de elementos. Se crea con corchetes: mi_lista = [1, 2, 3]"},
    ]
    for qa in qa_pairs:
        trainer.add_qa_pair(**qa)
    print(f"  ✅ {len(qa_pairs)} Q&A añadidos")
    
    # 8. Revisión
    print("\n📊 Revisión del bot:")
    review = trainer.get_review()
    print(review["message"])
    
    # 9. Finalizar
    print("\n🎉 Finalizando entrenamiento...")
    final = trainer.finalize()
    print(final["message"])
    
    # 10. Probar el bot entrenado con el chatbot
    print("\n" + "=" * 70)
    print("🧪 Probando el bot entrenado con el chatbot adaptativo...")
    print("=" * 70)
    
    chatbot = AdaptiveChatbot()
    knowledge = trainer.export_knowledge()
    
    response = chatbot.start_session(
        topic="Python Básico",
        difficulty="beginner",
        bot_knowledge=knowledge,
    )
    print(f"\n🤖 {response.message}")
    
    # Simular una conversación
    test_messages = [
        "¿Qué es Python?",
        "¿Cómo instalo Python?",
        "No entiendo las variables",
        "ejemplo",
        "evaluar",
        "Las variables almacenan datos en memoria y se crean con asignación simple",
    ]
    
    for msg in test_messages:
        print(f"\n👤 {msg}")
        response = await chatbot.process_message(
            user_message=msg,
            response_time_ms=2000,
            typing_speed_cpm=150,
        )
        print(f"🤖 {response.message[:200]}...")
        print(f"   📊 Estado: {response.cognitive_state.value} | Acción: {response.action.value}")


async def main():
    """Menú principal de pruebas"""
    print("\n🧠 NeuroLearn AI - Suite de Pruebas")
    print("=" * 50)
    print("1. Chatbot Adaptativo (interactivo)")
    print("2. Motor Neuroconductual (simulación)")
    print("3. Entrenador de Bot Experto (demo)")
    print("4. Todas las pruebas automáticas")
    print("0. Salir")
    
    choice = input("\nSelecciona una opción > ").strip()
    
    if choice == "1":
        await test_adaptive_chatbot()
    elif choice == "2":
        await test_cognitive_engine()
    elif choice == "3":
        await test_expert_bot_trainer()
    elif choice == "4":
        await test_cognitive_engine()
        await test_expert_bot_trainer()
        print("\n✅ ¡Todas las pruebas automáticas completadas!")
    else:
        print("👋 ¡Hasta luego!")


if __name__ == "__main__":
    asyncio.run(main())
