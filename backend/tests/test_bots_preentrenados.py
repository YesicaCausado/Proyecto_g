"""
🧪 NeuroLearn AI - Test de Bots Pre-entrenados

Verifica que los bots guardados en JSON se cargan correctamente
y funcionan con el chatbot adaptativo.

Ejecutar:
    cd backend
    python -m tests.test_bots_preentrenados
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.expert_bot.persistence import list_bots, load_bot, get_bot_quality_score
from app.ai.chatbot.adaptive_chatbot import AdaptiveChatbot


async def test_bot_file(filename: str, test_questions: list):
    """Carga un bot desde JSON y lo prueba con preguntas"""
    data = load_bot(filename)
    if not data:
        print(f"  ❌ No se pudo cargar {filename}")
        return False

    config = data.get("bot_config", {})
    name = config.get("name", "Desconocido")
    kb = config.get("knowledge_base", {})

    print(f"\n  📂 Cargando: {name}")
    print(f"     Pasos: {len(kb.get('steps', []))} | FAQ: {len(kb.get('faq', []))} | "
          f"Escenarios: {len(kb.get('scenarios', []))} | Tips: {len(kb.get('tips', []))}")

    # Evaluar calidad
    quality = get_bot_quality_score(data)
    print(f"     Calidad: {quality['level']} ({quality['total_score']}/100)")

    # Crear chatbot y cargar el bot
    chatbot = AdaptiveChatbot()
    response = chatbot.start_session(
        topic=name,
        difficulty="beginner",
        bot_knowledge=kb,
    )
    print(f"  ✅ Sesión iniciada")

    # Probar preguntas
    correct_answers = 0
    for question in test_questions:
        resp = await chatbot.process_message(
            user_message=question,
            response_time_ms=2000,
            typing_speed_cpm=140,
            corrections=0,
        )
        has_content = len(resp.message) > 30
        is_not_generic = "no tengo información" not in resp.message.lower()

        status = "✅" if has_content and is_not_generic else "⚠️"
        if has_content and is_not_generic:
            correct_answers += 1

        print(f"  {status} Q: {question[:50]}")
        print(f"     R: {resp.message[:120]}...")

    accuracy = (correct_answers / len(test_questions)) * 100
    print(f"\n  📊 Respuestas con contenido real: {correct_answers}/{len(test_questions)} ({accuracy:.0f}%)")
    return accuracy >= 50


async def main():
    print("\n" + "=" * 70)
    print("🧪 NeuroLearn AI - TEST DE BOTS PRE-ENTRENADOS")
    print("=" * 70)

    # Listar bots disponibles
    bots = list_bots()
    print(f"\n📋 Bots encontrados: {len(bots)}")
    for b in bots:
        if "error" not in b:
            print(f"   - {b['name']} ({b['category']}) — {b['total_items']} items")

    results = []

    # ====== Test Python Bot ======
    print("\n\n🐍 TEST: Bot Python Fundamentals")
    print("-" * 50)
    python_ok = await test_bot_file("python_fundamentals", [
        "¿Qué es Python?",
        "¿Qué es una variable?",
        "¿Cómo se instala un paquete?",
        "¿Cuál es la diferencia entre lista y tupla?",
        "¿Qué son los f-strings?",
    ])
    results.append(("Python Fundamentals", python_ok))

    # ====== Test Cocina Bot ======
    print("\n\n🍳 TEST: Bot Cocina Básica")
    print("-" * 50)
    cocina_ok = await test_bot_file("cocina_basica", [
        "¿Cómo sé si el aceite está listo para freír?",
        "¿Cuánta sal debo poner?",
        "¿Cómo evito que la pasta se pegue?",
        "¿Cómo cortar cebolla sin llorar?",
        "¿Qué es al dente?",
    ])
    results.append(("Cocina Básica", cocina_ok))

    # ====== Resumen ======
    print("\n\n" + "=" * 70)
    all_passed = all(r[1] for r in results)
    if all_passed:
        print("✅ ¡TODOS LOS BOTS FUNCIONAN CORRECTAMENTE!")
    else:
        print("⚠️ Algunos bots necesitan mejoras:")
    for name, ok in results:
        status = "✅" if ok else "❌"
        print(f"   {status} {name}")
    print("=" * 70)

    return all_passed


if __name__ == "__main__":
    asyncio.run(main())
