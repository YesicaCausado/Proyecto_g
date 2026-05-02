"""
🏋️ NeuroLearn AI - Script de Entrenamiento Masivo de Bots

Este script te permite entrenar bots de forma interactiva
con grandes cantidades de datos. Los bots se guardan
automáticamente en archivos JSON.

Ejecutar:
    cd backend
    python -m scripts.train_bot

Uso:
    1. Crear un nuevo bot
    2. Cargar y mejorar un bot existente
    3. Ver todos los bots entrenados
    4. Evaluar calidad de un bot
    5. Probar un bot con el chatbot
"""
import asyncio
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.expert_bot.trainer import ExpertBotTrainer
from app.ai.expert_bot.persistence import save_bot, load_bot, list_bots, get_bot_quality_score
from app.ai.chatbot.adaptive_chatbot import AdaptiveChatbot
import time


def clear_screen():
    os.system("cls" if os.name == "nt" else "clear")


def print_header(title: str):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}\n")


def print_menu():
    print_header("🧠 NeuroLearn AI - Entrenamiento de Bots")
    print("  1. 🆕 Crear nuevo bot")
    print("  2. 📂 Cargar y mejorar bot existente")
    print("  3. 📋 Ver todos los bots entrenados")
    print("  4. 📊 Evaluar calidad de un bot")
    print("  5. 🤖 Probar un bot (chat interactivo)")
    print("  6. 📦 Importar bot desde archivo JSON")
    print("  0. ❌ Salir")
    print()


def input_multiline(prompt: str) -> str:
    """Permite ingresar texto multilínea (terminar con línea vacía)"""
    print(f"{prompt} (línea vacía para terminar):")
    lines = []
    while True:
        line = input("  > ")
        if not line.strip():
            break
        lines.append(line)
    return "\n".join(lines) if lines else ""


def create_new_bot():
    """Flujo completo para crear un bot nuevo"""
    print_header("🆕 Crear Nuevo Bot Experto")
    
    trainer = ExpertBotTrainer()
    
    # === INFO BÁSICA ===
    name = input("📛 Nombre del bot: ").strip()
    if not name:
        print("❌ El nombre es obligatorio")
        return
    
    description = input("📝 Descripción: ").strip()
    if not description:
        description = f"Bot experto en {name}"
    
    print("\n📁 Categorías sugeridas: Programación, Cocina, Matemáticas, Idiomas,")
    print("   Ciencias, Medicina, Derecho, Negocios, Arte, Música, Deportes, Otro")
    category = input("📁 Categoría: ").strip()
    if not category:
        category = "General"
    
    result = trainer.start_training(name, description, category)
    print(f"\n✅ {result['message'][:100]}...")
    
    # === PERSONALIDAD ===
    print("\n🎭 PERSONALIDAD DEL BOT")
    print("  1. strict     - Estricto y directo")
    print("  2. balanced   - Equilibrado y claro")
    print("  3. encouraging - Motivador y empático")
    style_choice = input("Elige estilo (1/2/3) [2]: ").strip()
    style_map = {"1": "strict", "2": "balanced", "3": "encouraging"}
    teaching_style = style_map.get(style_choice, "balanced")
    
    print("\n📏 Nivel de detalle:")
    print("  1. brief    - Breve y conciso")
    print("  2. medium   - Moderado")
    print("  3. detailed - Detallado y explicativo")
    verb_choice = input("Elige (1/2/3) [2]: ").strip()
    verb_map = {"1": "brief", "2": "medium", "3": "detailed"}
    verbosity = verb_map.get(verb_choice, "medium")
    
    trainer.set_personality(teaching_style, verbosity, True, True)
    print(f"✅ Personalidad: {teaching_style}, detalle: {verbosity}")
    
    # === PASOS ===
    print_header("📝 PASOS DEL PROCESO")
    print("Define los pasos que el alumno debe seguir para aprender.")
    print("Escribe 'fin' cuando hayas terminado de añadir pasos.\n")
    
    step_num = 1
    while True:
        print(f"\n--- Paso {step_num} ---")
        title = input("  Título del paso (o 'fin'): ").strip()
        if title.lower() == "fin" or not title:
            break
        
        description = input("  Descripción: ").strip()
        details = input("  Detalles adicionales (opcional): ").strip()
        
        is_critical_input = input("  ¿Es un paso CRÍTICO? (s/n) [n]: ").strip().lower()
        is_critical = is_critical_input in ("s", "si", "sí", "y", "yes")
        
        errors = []
        print("  Errores comunes (uno por línea, vacío para terminar):")
        while True:
            err = input("    Error: ").strip()
            if not err:
                break
            errors.append(err)
        
        tips = []
        print("  Tips para este paso (uno por línea, vacío para terminar):")
        while True:
            tip = input("    Tip: ").strip()
            if not tip:
                break
            tips.append(tip)
        
        trainer.add_step(title, description, details, is_critical, errors, tips)
        print(f"  ✅ Paso {step_num} añadido: {title}")
        step_num += 1
    
    # === ADVERTENCIAS ===
    print_header("⚠️ ADVERTENCIAS CRÍTICAS")
    print("Añade advertencias que el alumno debe conocer.")
    print("Escribe 'fin' cuando termines.\n")
    
    while True:
        msg = input("  Advertencia (o 'fin'): ").strip()
        if msg.lower() == "fin" or not msg:
            break
        
        print("  Severidad: 1=low, 2=medium, 3=high, 4=critical")
        sev_input = input("  Severidad (1-4) [2]: ").strip()
        sev_map = {"1": "low", "2": "medium", "3": "high", "4": "critical"}
        severity = sev_map.get(sev_input, "medium")
        
        trainer.add_warning(msg, severity)
        print(f"  ✅ Advertencia añadida ({severity})")
    
    # === REGLAS ===
    print_header("📋 REGLAS OPERATIVAS")
    print("Reglas que siempre deben cumplirse.")
    print("Escribe 'fin' cuando termines.\n")
    
    while True:
        rule = input("  Regla (o 'fin'): ").strip()
        if rule.lower() == "fin" or not rule:
            break
        trainer.add_rule(rule)
        print(f"  ✅ Regla añadida")
    
    # === TIPS ===
    print_header("💡 RECOMENDACIONES PRÁCTICAS")
    print("Tips y consejos del experto.")
    print("Escribe 'fin' cuando termines.\n")
    
    while True:
        tip = input("  Tip (o 'fin'): ").strip()
        if tip.lower() == "fin" or not tip:
            break
        trainer.add_tip(tip)
        print(f"  ✅ Tip añadido")
    
    # === Q&A ===
    print_header("❓ PREGUNTAS Y RESPUESTAS")
    print("Preguntas frecuentes y sus respuestas.")
    print("Escribe 'fin' cuando termines.\n")
    
    while True:
        question = input("  Pregunta (o 'fin'): ").strip()
        if question.lower() == "fin" or not question:
            break
        answer = input("  Respuesta: ").strip()
        if not answer:
            continue
        
        trainer.add_qa_pair(question, answer)
        print(f"  ✅ Q&A añadido")
    
    # === ESCENARIOS ===
    print_header("🎭 ESCENARIOS DE SIMULACIÓN")
    print("Escenarios prácticos para poner a prueba al alumno.")
    print("Escribe 'fin' cuando termines.\n")
    
    while True:
        title = input("  Título del escenario (o 'fin'): ").strip()
        if title.lower() == "fin" or not title:
            break
        
        desc = input("  Descripción: ").strip()
        situation = input("  Situación inicial: ").strip()
        
        actions = []
        print("  Acciones esperadas (una por línea, vacío para terminar):")
        while True:
            action = input("    Acción: ").strip()
            if not action:
                break
            actions.append(action)
        
        outcome = input("  Resultado correcto: ").strip()
        
        mistakes = []
        print("  Errores comunes en este escenario (uno por línea, vacío para terminar):")
        while True:
            mistake = input("    Error: ").strip()
            if not mistake:
                break
            mistakes.append(mistake)
        
        trainer.add_scenario(title, desc, situation, actions, outcome, mistakes)
        print(f"  ✅ Escenario añadido: {title}")
    
    # === REVISIÓN Y GUARDADO ===
    print_header("📊 REVISIÓN FINAL")
    review = trainer.get_review()
    print(review["message"])
    
    # Evaluar calidad
    final = trainer.finalize()
    quality = get_bot_quality_score(final)
    
    print(f"\n📊 Calidad del bot: {quality['level']} ({quality['total_score']}%)")
    print(f"   Total de items: {quality['total_items']}")
    for k, v in quality['scores'].items():
        bar = "█" * int(v / 10) + "░" * (10 - int(v / 10))
        print(f"   {k:12s}: {bar} {v}%")
    
    if quality['recommendations']:
        print(f"\n💡 Recomendaciones para mejorar:")
        for rec in quality['recommendations']:
            print(f"   {rec}")
    
    # Guardar
    save_input = input("\n💾 ¿Guardar el bot? (s/n) [s]: ").strip().lower()
    if save_input != "n":
        filepath = save_bot(final)
        print(f"\n✅ Bot guardado en: {filepath}")
        print(f"   Puedes mejorarlo en cualquier momento cargándolo.")
    else:
        print("❌ Bot no guardado")


def load_and_improve_bot():
    """Carga un bot existente y permite añadir más datos"""
    print_header("📂 Cargar y Mejorar Bot")
    
    bots = list_bots()
    if not bots:
        print("📭 No hay bots entrenados. Crea uno primero.")
        return
    
    print("Bots disponibles:")
    for i, bot in enumerate(bots, 1):
        if "error" in bot:
            continue
        print(f"  {i}. {bot['name']} ({bot['category']}) - {bot['total_items']} items - {bot['filename']}")
    
    choice = input("\nSelecciona el número del bot: ").strip()
    try:
        idx = int(choice) - 1
        if idx < 0 or idx >= len(bots):
            raise ValueError
    except ValueError:
        print("❌ Selección inválida")
        return
    
    bot_data = load_bot(bots[idx]["filename"])
    if not bot_data:
        print("❌ Error al cargar el bot")
        return
    
    config = bot_data.get("bot_config", {})
    kb = config.get("knowledge_base", {})
    
    print(f"\n✅ Bot cargado: {config.get('name', 'Sin nombre')}")
    
    # Crear trainer con datos existentes
    trainer = ExpertBotTrainer()
    trainer.start_training(
        config.get("name", "Bot"),
        config.get("description", ""),
        config.get("category", "General"),
    )
    
    personality = config.get("personality", {})
    trainer.set_personality(
        personality.get("teaching_style", "balanced"),
        personality.get("verbosity", "medium"),
        personality.get("use_examples", True),
        personality.get("use_analogies", True),
    )
    
    # Cargar datos existentes
    for step in kb.get("steps", []):
        trainer.add_step(
            step.get("title", ""), step.get("description", ""),
            step.get("details", ""), step.get("is_critical", False),
            step.get("common_errors", []), step.get("tips", [])
        )
    for w in kb.get("warnings", []):
        if isinstance(w, dict):
            trainer.add_warning(w.get("message", ""), w.get("severity", "medium"))
        else:
            trainer.add_warning(w)
    for r in kb.get("rules", []):
        trainer.add_rule(r)
    for t in kb.get("tips", []):
        trainer.add_tip(t)
    for s in kb.get("scenarios", []):
        trainer.add_scenario(
            s.get("title", ""), s.get("description", ""),
            s.get("initial_situation", ""), s.get("expected_actions", []),
            s.get("correct_outcome", ""), s.get("common_mistakes", []),
            s.get("difficulty", "medium")
        )
    for qa in kb.get("faq", []):
        trainer.add_qa_pair(
            qa.get("question", ""), qa.get("answer", ""),
            qa.get("category", ""), qa.get("difficulty", "medium")
        )
    
    # Menú de mejoras
    while True:
        print(f"\n{'─' * 50}")
        print(f"📊 Estado actual del bot: {config.get('name', '')}")
        review = trainer.get_review()
        stats = review.get("stats", {})
        for k, v in stats.items():
            print(f"   {k}: {v}")
        
        print(f"\n¿Qué quieres añadir?")
        print("  1. Pasos")
        print("  2. Advertencias")
        print("  3. Reglas")
        print("  4. Tips")
        print("  5. Q&A")
        print("  6. Escenarios")
        print("  7. 📊 Ver calidad")
        print("  8. 💾 Guardar y salir")
        print("  0. Salir sin guardar")
        
        choice = input("\nOpción: ").strip()
        
        if choice == "1":
            title = input("  Título del paso: ").strip()
            if not title:
                continue
            desc = input("  Descripción: ").strip()
            details = input("  Detalles (opcional): ").strip()
            is_crit = input("  ¿Crítico? (s/n) [n]: ").strip().lower() in ("s", "si", "sí")
            trainer.add_step(title, desc, details, is_crit)
            print(f"  ✅ Paso añadido")
        
        elif choice == "2":
            msg = input("  Advertencia: ").strip()
            if not msg:
                continue
            sev = input("  Severidad (low/medium/high/critical) [medium]: ").strip() or "medium"
            trainer.add_warning(msg, sev)
            print(f"  ✅ Advertencia añadida")
        
        elif choice == "3":
            rule = input("  Regla: ").strip()
            if rule:
                trainer.add_rule(rule)
                print(f"  ✅ Regla añadida")
        
        elif choice == "4":
            tip = input("  Tip: ").strip()
            if tip:
                trainer.add_tip(tip)
                print(f"  ✅ Tip añadido")
        
        elif choice == "5":
            q = input("  Pregunta: ").strip()
            if not q:
                continue
            a = input("  Respuesta: ").strip()
            if a:
                trainer.add_qa_pair(q, a)
                print(f"  ✅ Q&A añadido")
        
        elif choice == "6":
            title = input("  Título del escenario: ").strip()
            if not title:
                continue
            desc = input("  Descripción: ").strip()
            sit = input("  Situación inicial: ").strip()
            actions = []
            print("  Acciones (vacío para terminar):")
            while True:
                a = input("    > ").strip()
                if not a:
                    break
                actions.append(a)
            outcome = input("  Resultado correcto: ").strip()
            trainer.add_scenario(title, desc, sit, actions, outcome)
            print(f"  ✅ Escenario añadido")
        
        elif choice == "7":
            final = trainer.finalize()
            quality = get_bot_quality_score(final)
            print(f"\n📊 Calidad: {quality['level']} ({quality['total_score']}%)")
            for k, v in quality['scores'].items():
                bar = "█" * int(v / 10) + "░" * (10 - int(v / 10))
                print(f"   {k:12s}: {bar} {v}%")
            if quality['recommendations']:
                print(f"\n💡 Recomendaciones:")
                for rec in quality['recommendations']:
                    print(f"   {rec}")
            # Re-init trainer since finalize changes state
            trainer.training_step = "review"
        
        elif choice == "8":
            final = trainer.finalize()
            # Incrementar versión
            final["bot_config"]["version"] = config.get("version", 1) + 1
            filepath = save_bot(final, bots[idx]["filename"])
            print(f"\n✅ Bot actualizado y guardado en: {filepath}")
            break
        
        elif choice == "0":
            print("❌ Cambios descartados")
            break


def show_all_bots():
    """Muestra todos los bots entrenados"""
    print_header("📋 Bots Entrenados")
    
    bots = list_bots()
    if not bots:
        print("📭 No hay bots entrenados aún.")
        print("   Usa la opción 1 para crear tu primer bot.")
        return
    
    print(f"Total: {len(bots)} bots\n")
    
    for i, bot in enumerate(bots, 1):
        if "error" in bot:
            print(f"  {i}. ❌ {bot['filename']}: {bot['error']}")
            continue
        
        print(f"  {i}. 🤖 {bot['name']}")
        print(f"     📁 Categoría: {bot['category']}")
        print(f"     🎭 Estilo: {bot['personality']}")
        print(f"     📊 Contenido: {bot['total_items']} items total")
        print(f"        Pasos: {bot['steps']} | FAQ: {bot['faq']} | Escenarios: {bot['scenarios']}")
        print(f"        Reglas: {bot['rules']} | Tips: {bot['tips']} | Advertencias: {bot['warnings']}")
        print(f"     📅 Guardado: {bot['saved_at'][:19] if bot['saved_at'] else 'N/A'}")
        print(f"     📄 Archivo: {bot['filename']}")
        print()


def evaluate_bot():
    """Evalúa la calidad de un bot"""
    print_header("📊 Evaluar Calidad de Bot")
    
    bots = list_bots()
    if not bots:
        print("📭 No hay bots para evaluar")
        return
    
    print("Bots disponibles:")
    for i, bot in enumerate(bots, 1):
        if "error" not in bot:
            print(f"  {i}. {bot['name']} ({bot['total_items']} items)")
    
    choice = input("\nSelecciona el número: ").strip()
    try:
        idx = int(choice) - 1
        bot_data = load_bot(bots[idx]["filename"])
    except (ValueError, IndexError):
        print("❌ Selección inválida")
        return
    
    if not bot_data:
        print("❌ Error al cargar")
        return
    
    quality = get_bot_quality_score(bot_data)
    
    print(f"\n{'═' * 50}")
    print(f"  📊 EVALUACIÓN: {bots[idx]['name']}")
    print(f"{'═' * 50}")
    print(f"\n  Puntuación total: {quality['total_score']}%")
    print(f"  Nivel: {quality['level']}")
    print(f"  Items totales: {quality['total_items']}")
    
    print(f"\n  Desglose:")
    for k, v in quality['scores'].items():
        bar = "█" * int(v / 10) + "░" * (10 - int(v / 10))
        emoji = "✅" if v >= 80 else "🟡" if v >= 50 else "🔴"
        print(f"    {emoji} {k:12s}: {bar} {v}%")
    
    if quality['recommendations']:
        print(f"\n  💡 Para mejorar el bot:")
        for rec in quality['recommendations']:
            print(f"    {rec}")
    
    print(f"\n  🎯 Plan de mejora sugerido:")
    if quality['total_score'] < 50:
        print("    1. Prioridad: Añadir más Q&A y pasos")
        print("    2. Secundario: Crear escenarios de práctica")
        print("    3. Opcional: Detallar tips y advertencias")
    elif quality['total_score'] < 80:
        print("    1. Completa las áreas con puntuación < 60%")
        print("    2. Enriquece los pasos con más detalles y errores comunes")
        print("    3. Añade escenarios variados")
    else:
        print("    ¡El bot está bien entrenado! Puedes:")
        print("    1. Añadir más escenarios avanzados")
        print("    2. Refinar las respuestas existentes")
        print("    3. Probarlo con usuarios reales")


async def test_bot_interactive():
    """Prueba un bot con el chatbot adaptativo de forma interactiva"""
    print_header("🤖 Probar Bot (Chat Interactivo)")
    
    bots = list_bots()
    if not bots:
        print("📭 No hay bots para probar")
        return
    
    print("Bots disponibles:")
    for i, bot in enumerate(bots, 1):
        if "error" not in bot:
            print(f"  {i}. {bot['name']} ({bot['category']}) - {bot['total_items']} items")
    
    choice = input("\nSelecciona el número: ").strip()
    try:
        idx = int(choice) - 1
        bot_data = load_bot(bots[idx]["filename"])
    except (ValueError, IndexError):
        print("❌ Selección inválida")
        return
    
    if not bot_data:
        print("❌ Error al cargar")
        return
    
    config = bot_data.get("bot_config", {})
    kb = config.get("knowledge_base", {})
    bot_name = config.get("name", "Bot")
    
    print(f"\n⏳ Cargando bot '{bot_name}'...")
    
    # Crear chatbot con el conocimiento del bot
    chatbot = AdaptiveChatbot()
    response = chatbot.start_session(
        topic=bot_name,
        difficulty="beginner",
        bot_knowledge=kb,
    )
    
    print(f"\n🤖 {response.message}")
    
    print(f"\n{'─' * 50}")
    print("Comandos: 'ejemplo' | 'evaluar' | 'resumen' | 'stats' | 'salir'")
    print(f"{'─' * 50}")
    
    while True:
        try:
            start_time = time.time()
            user_input = input("\n👤 Tú > ").strip()
            response_time = (time.time() - start_time) * 1000
            
            if not user_input:
                continue
            
            if user_input.lower() == "salir":
                stats = chatbot.get_session_stats()
                print(f"\n📊 Estadísticas finales:")
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
            
            typing_speed = (len(user_input) / max(response_time / 1000, 0.1)) * 60
            
            response = await chatbot.process_message(
                user_message=user_input,
                response_time_ms=response_time,
                typing_speed_cpm=typing_speed,
            )
            
            print(f"\n🤖 {response.message}")
            print(f"   [Estado: {response.cognitive_state.value} | Acción: {response.action.value} | Nivel: {response.difficulty.value}]")
            
            if response.should_pause:
                print("   ⏸️ ¡Se recomienda tomar un descanso!")
            
        except KeyboardInterrupt:
            print("\n\n👋 ¡Sesión interrumpida!")
            break


async def main():
    """Menú principal"""
    while True:
        print_menu()
        choice = input("Selecciona una opción > ").strip()
        
        if choice == "1":
            create_new_bot()
        elif choice == "2":
            load_and_improve_bot()
        elif choice == "3":
            show_all_bots()
        elif choice == "4":
            evaluate_bot()
        elif choice == "5":
            await test_bot_interactive()
        elif choice == "6":
            print_header("📦 Importar Bot desde JSON")
            path = input("Ruta del archivo JSON: ").strip()
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                filepath = save_bot(data)
                print(f"✅ Bot importado: {filepath}")
            else:
                print("❌ Archivo no encontrado")
        elif choice == "0":
            print("\n👋 ¡Hasta luego! Recuerda entrenar tus bots regularmente. 🧠")
            break
        else:
            print("❌ Opción inválida")


if __name__ == "__main__":
    asyncio.run(main())
