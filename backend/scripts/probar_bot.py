"""
🤖 NeuroLearn AI - Prueba Rápida de Bot

Chatea con uno de los bots pre-entrenados.
Ejecutar:
    cd backend
    python -m scripts.probar_bot
"""
import asyncio
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.expert_bot.persistence import list_bots, load_bot, get_bot_quality_score
from app.ai.chatbot.adaptive_chatbot import AdaptiveChatbot


async def main():
    print("\n" + "=" * 60)
    print("  🤖 NeuroLearn AI - PROBAR BOT INTERACTIVO")
    print("=" * 60)

    # Listar bots disponibles
    bots = list_bots()
    if not bots:
        print("\n📭 No hay bots entrenados.")
        return

    print("\n📋 Bots disponibles:\n")
    valid_bots = []
    for i, bot in enumerate(bots, 1):
        if "error" not in bot:
            valid_bots.append(bot)
            quality = "🏆" if bot["total_items"] >= 50 else "🌟" if bot["total_items"] >= 30 else "📊"
            print(f"  {i}. {quality} {bot['name']} ({bot['category']})")
            print(f"     {bot['total_items']} items | Pasos: {bot['steps']} | FAQ: {bot['faq']} | Escenarios: {bot['scenarios']}")

    if not valid_bots:
        print("❌ No hay bots válidos")
        return

    # Seleccionar bot
    print()
    choice = input("  Selecciona un bot (número): ").strip()
    try:
        idx = int(choice) - 1
        if idx < 0 or idx >= len(valid_bots):
            raise ValueError
    except ValueError:
        print("❌ Selección inválida")
        return

    selected = valid_bots[idx]
    bot_data = load_bot(selected["filename"])
    if not bot_data:
        print("❌ Error al cargar el bot")
        return

    config = bot_data.get("bot_config", {})
    kb = config.get("knowledge_base", {})
    bot_name = config.get("name", "Bot")

    # Mostrar calidad
    quality = get_bot_quality_score(bot_data)
    print(f"\n  📊 Calidad: {quality['level']} ({quality['total_score']}/100)")

    # Iniciar chatbot
    print(f"\n⏳ Cargando '{bot_name}'...\n")
    chatbot = AdaptiveChatbot()
    response = chatbot.start_session(
        topic=bot_name,
        difficulty="beginner",
        bot_knowledge=kb,
    )

    print(f"🤖 {response.message}")
    print()
    print("─" * 60)
    print("  Escribe tu pregunta y presiona Enter")
    print("  Comandos: 'ejemplo' | 'evaluar' | 'resumen' | 'stats' | 'salir'")
    print("─" * 60)

    # Bucle de chat
    while True:
        try:
            print()
            start = time.time()
            user_input = input("👤 Tú > ").strip()
            elapsed = (time.time() - start) * 1000  # ms

            if not user_input:
                continue

            if user_input.lower() in ("salir", "exit", "quit", "q"):
                stats = chatbot.get_session_stats()
                print(f"\n📊 Estadísticas de la sesión:")
                print(f"   Interacciones: {stats['interactions']}")
                print(f"   Dificultad final: {stats['difficulty']}")
                print(f"   Estado cognitivo: {stats['cognitive_state']}")
                print(f"   Duración: {stats['duration_minutes']:.1f} min")
                print("\n👋 ¡Hasta la próxima!")
                break

            if user_input.lower() == "stats":
                stats = chatbot.get_session_stats()
                for k, v in stats.items():
                    if k != "cognitive_profile":
                        print(f"   {k}: {v}")
                continue

            # Calcular velocidad de escritura aproximada
            typing_speed = (len(user_input) / max(elapsed / 1000, 0.1)) * 60

            response = await chatbot.process_message(
                user_message=user_input,
                response_time_ms=elapsed,
                typing_speed_cpm=min(typing_speed, 300),
            )

            print(f"\n🤖 {response.message}")
            print(f"   [{response.cognitive_state.value} | {response.action.value} | {response.difficulty.value}]")

            if response.should_pause:
                print("   ⏸️  ¡Se recomienda tomar un descanso!")

        except KeyboardInterrupt:
            print("\n\n👋 ¡Sesión interrumpida!")
            break
        except EOFError:
            print("\n👋 ¡Fin de la sesión!")
            break


if __name__ == "__main__":
    asyncio.run(main())
