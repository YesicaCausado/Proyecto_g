"""
📅 NeuroLearn AI - Rutina Diaria de Entrenamiento de Bots

Ejecutar cada día:
    cd backend
    python -m scripts.daily_training

Este script:
1. Muestra el dashboard de progreso
2. Indica la tarea del día
3. Permite entrenar/mejorar bots paso a paso
4. Actualiza el tracker automáticamente
"""
import os
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ai.expert_bot.trainer import ExpertBotTrainer
from app.ai.expert_bot.persistence import (
    save_bot, load_bot, list_bots, get_bot_quality_score, BOTS_DIR
)

# ──────────────────────────────────────────────────────────────
# PATHS
# ──────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
TRACKER_FILE = os.path.join(DATA_DIR, "training_tracker.json")


def load_tracker():
    """Carga el tracker de progreso"""
    if os.path.exists(TRACKER_FILE):
        with open(TRACKER_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return None


def save_tracker(tracker):
    """Guarda el tracker de progreso"""
    with open(TRACKER_FILE, "w", encoding="utf-8") as f:
        json.dump(tracker, f, ensure_ascii=False, indent=2, default=str)


def clear():
    os.system("cls" if os.name == "nt" else "clear")


def get_today():
    return datetime.now().strftime("%Y-%m-%d")


def days_since_start(tracker):
    start = datetime.strptime(tracker["start_date"], "%Y-%m-%d")
    today = datetime.now()
    return (today - start).days + 1


def days_remaining(tracker):
    end = datetime.strptime(tracker["end_date"], "%Y-%m-%d")
    today = datetime.now()
    return max(0, (end - today).days)


def get_current_phase(tracker):
    today = get_today()
    for pid, phase in tracker["phases"].items():
        if phase["start"] <= today <= phase["end"]:
            return int(pid), phase
    return 5, tracker["phases"]["5"]


def scan_bots_quality():
    """Escanea los bots existentes y calcula sus calidades reales"""
    results = []
    bots_list = list_bots()
    for bot_info in bots_list:
        if "error" in bot_info:
            continue
        bot_data = load_bot(bot_info["filename"])
        if bot_data:
            quality = get_bot_quality_score(bot_data)
            results.append({
                "filename": bot_info["filename"],
                "name": bot_info["name"],
                "category": bot_info["category"],
                "total_items": bot_info["total_items"],
                "quality_score": quality["total_score"],
                "level": quality["level"],
                "scores": quality["scores"],
                "recommendations": quality["recommendations"],
            })
    return results


# ──────────────────────────────────────────────────────────────
# DASHBOARD
# ──────────────────────────────────────────────────────────────
def show_dashboard(tracker):
    """Muestra el dashboard principal de progreso"""
    clear()
    today = get_today()
    day_num = days_since_start(tracker)
    remaining = days_remaining(tracker)
    phase_id, phase = get_current_phase(tracker)
    
    # Escanear bots reales
    bots_real = scan_bots_quality()
    total_bots = len(bots_real)
    complete_bots = sum(1 for b in bots_real if b["quality_score"] >= 90)
    good_bots = sum(1 for b in bots_real if 70 <= b["quality_score"] < 90)
    weak_bots = sum(1 for b in bots_real if b["quality_score"] < 70)
    avg_quality = sum(b["quality_score"] for b in bots_real) / max(len(bots_real), 1)
    total_items = sum(b["total_items"] for b in bots_real)
    categories = len(set(b["category"] for b in bots_real))
    
    print("=" * 65)
    print("  NEUROLEARN AI - DASHBOARD DE ENTRENAMIENTO DE BOTS")
    print("=" * 65)
    print(f"  Fecha: {today}  |  Dia {day_num}/180  |  Quedan {remaining} dias")
    print(f"  Fase {phase_id}: {phase['name']}  |  Meta: {phase['goal_bots']} bots")
    print("-" * 65)
    
    # Barra de progreso general
    progress = min(total_bots / 30, 1.0)
    bar_len = 40
    filled = int(bar_len * progress)
    bar = "#" * filled + "." * (bar_len - filled)
    print(f"\n  PROGRESO GENERAL: [{bar}] {total_bots}/30 bots")
    print(f"  Calidad promedio: {avg_quality:.1f}/100")
    
    # Estadísticas
    print(f"\n  ESTADISTICAS:")
    print(f"    Bots excelentes (90+):  {complete_bots}")
    print(f"    Bots buenos (70-89):    {good_bots}")
    print(f"    Bots por mejorar (<70): {weak_bots}")
    print(f"    Total items:            {total_items}")
    print(f"    Categorias cubiertas:   {categories}")
    
    # Lista de bots
    print(f"\n  BOTS ENTRENADOS:")
    print(f"  {'Nombre':<30} {'Cat.':<15} {'Items':>5} {'Calidad':>8} {'Estado':>10}")
    print(f"  {'-'*30} {'-'*15} {'-'*5} {'-'*8} {'-'*10}")
    for b in sorted(bots_real, key=lambda x: -x["quality_score"]):
        level_icon = "EXCEL" if b["quality_score"] >= 90 else "BUENO" if b["quality_score"] >= 70 else "MEJORAR"
        print(f"  {b['name']:<30} {b['category']:<15} {b['total_items']:>5} {b['quality_score']:>7.1f} {level_icon:>10}")
    
    # Bots pendientes para esta fase
    pending = [b for b in tracker["bots_plan"] if b["phase"] == phase_id and b["status"] == "pending"]
    if pending:
        print(f"\n  PENDIENTES FASE {phase_id} ({len(pending)}):")
        for p in pending[:5]:
            sched = p.get("scheduled_start", "sin fecha")
            print(f"    - {p['name']} ({p['category']}) [inicio: {sched}]")
        if len(pending) > 5:
            print(f"    ... y {len(pending)-5} mas")
    
    # Recomendaciones de mejora
    needs_improvement = [b for b in bots_real if b["quality_score"] < 90 and b["recommendations"]]
    if needs_improvement:
        print(f"\n  MEJORAS SUGERIDAS:")
        for b in needs_improvement[:3]:
            print(f"    {b['name']} ({b['quality_score']:.0f}/100):")
            for rec in b["recommendations"][:2]:
                # Remove emojis for terminal compatibility
                clean_rec = rec.encode('ascii', 'ignore').decode('ascii').strip()
                if clean_rec:
                    print(f"      - {clean_rec}")
    
    print("\n" + "=" * 65)
    return bots_real


# ──────────────────────────────────────────────────────────────
# TAREA DEL DIA
# ──────────────────────────────────────────────────────────────
def get_todays_task(tracker, bots_real):
    """Determina qué hacer hoy basado en el plan"""
    today = get_today()
    phase_id, phase = get_current_phase(tracker)
    
    # 1. Buscar bot que necesita mejora urgente (<90)
    needs_fix = [b for b in bots_real if b["quality_score"] < 90]
    needs_fix.sort(key=lambda x: x["quality_score"])
    
    # 2. Buscar bot programado para hoy
    scheduled_today = None
    for bp in tracker["bots_plan"]:
        if bp.get("scheduled_start") == today and bp["status"] == "pending":
            scheduled_today = bp
            break
        if bp.get("scheduled_complete") == today and bp["status"] in ("pending", "in_progress"):
            scheduled_today = bp
            break
    
    # 3. Buscar siguiente bot pendiente en esta fase
    next_pending = None
    for bp in tracker["bots_plan"]:
        if bp["phase"] == phase_id and bp["status"] == "pending":
            next_pending = bp
            break
    
    # Decidir tarea
    if scheduled_today:
        return "create", scheduled_today
    elif needs_fix:
        return "improve", needs_fix[0]
    elif next_pending:
        return "create", next_pending
    else:
        # Buscar en siguiente fase
        for bp in tracker["bots_plan"]:
            if bp["status"] == "pending":
                return "create", bp
        return "review", None


def show_todays_task(tracker, bots_real):
    """Muestra la tarea de hoy"""
    task_type, target = get_todays_task(tracker, bots_real)
    
    print("\n  TAREA DE HOY:")
    print("  " + "-" * 50)
    
    if task_type == "create":
        print(f"  CREAR BOT NUEVO: {target['name']}")
        print(f"  Categoria: {target['category']}")
        print(f"  Prioridad: {target.get('priority', 'normal')}")
        print(f"\n  Pasos:")
        print(f"    1. Info basica (nombre, descripcion, personalidad)")
        print(f"    2. Definir 5-10 pasos del proceso")
        print(f"    3. Agregar 3-4 advertencias criticas")
        print(f"    4. Definir 5-10 reglas operativas")
        print(f"    5. Agregar 5-10 tips practicos")
        print(f"    6. Crear 3+ escenarios de simulacion")
        print(f"    7. Escribir 10-15 FAQ")
        print(f"    8. Revisar y guardar")
    elif task_type == "improve":
        print(f"  MEJORAR BOT: {target['name']}")
        print(f"  Calidad actual: {target['quality_score']:.1f}/100")
        if target.get("recommendations"):
            print(f"\n  Que mejorar:")
            for rec in target["recommendations"]:
                clean = rec.encode('ascii', 'ignore').decode('ascii').strip()
                if clean:
                    print(f"    - {clean}")
    else:
        print(f"  REVISION GENERAL")
        print(f"  Revisar calidad de todos los bots y preparar siguiente fase")
    
    print("  " + "-" * 50)
    return task_type, target


# ──────────────────────────────────────────────────────────────
# ENTRENAMIENTO RÁPIDO (no interactivo, con datos predefinidos)
# ──────────────────────────────────────────────────────────────

# Banco de datos de entrenamiento por template
TRAINING_TEMPLATES = {
    "math_basic": {
        "name": "Matemáticas Básicas",
        "description": "Bot experto que enseña aritmética, fracciones, decimales, porcentajes y geometría básica. Ideal para estudiantes de primaria y secundaria.",
        "category": "Matemáticas",
        "personality": {"teaching_style": "encouraging", "verbosity": "detailed", "use_examples": True, "use_analogies": True},
        "steps": [
            {"order": 1, "title": "Números y operaciones básicas", "description": "Dominar suma, resta, multiplicación y división con números naturales", "details": "Comenzar con sumas simples de un dígito, luego avanzar a operaciones con varios dígitos. Practicar las tablas de multiplicar del 1 al 12. La división se introduce como operación inversa de la multiplicación.", "is_critical": True, "common_errors": ["Confundir el orden en la resta (no es conmutativa)", "Errores al llevar en sumas de múltiples dígitos", "No dominar las tablas de multiplicar"], "tips": ["Practicar tablas de multiplicar todos los días", "Usar objetos reales para visualizar operaciones"]},
            {"order": 2, "title": "Fracciones", "description": "Entender qué son las fracciones, simplificarlas y operar con ellas", "details": "Una fracción representa partes de un todo. Numerador arriba, denominador abajo. Para sumar fracciones necesitas denominador común. Para multiplicar, numerador×numerador y denominador×denominador.", "is_critical": True, "common_errors": ["Sumar numeradores Y denominadores directamente", "No simplificar el resultado final", "Confundir fracciones propias e impropias"], "tips": ["Usar pizza o pastel para visualizar fracciones", "Siempre simplificar al máximo"]},
            {"order": 3, "title": "Decimales", "description": "Comprender números decimales, conversión con fracciones y operaciones", "details": "Los decimales son otra forma de representar fracciones con denominador 10, 100, 1000... Para convertir fracción a decimal, dividir numerador entre denominador. Alinear puntos decimales al sumar/restar.", "is_critical": False, "common_errors": ["No alinear los puntos decimales al operar", "Confundir 0.5 con 0.05", "Errores al mover el punto en multiplicación"], "tips": ["0.1 = 1/10, 0.01 = 1/100, memorizar equivalencias", "Usar dinero como ejemplo práctico de decimales"]},
            {"order": 4, "title": "Porcentajes", "description": "Calcular porcentajes, descuentos, aumentos e interés simple", "details": "Porcentaje significa 'por cada cien'. 25% = 25/100 = 0.25. Para calcular el X% de un número, multiplicar por X/100. Descuento: precio × (1 - porcentaje/100). Aumento: precio × (1 + porcentaje/100).", "is_critical": False, "common_errors": ["Confundir porcentaje de aumento con de descuento", "No convertir porcentaje a decimal antes de operar", "Creer que 50% de aumento seguido de 50% de descuento da el mismo número"], "tips": ["10% = mover el punto decimal un lugar a la izquierda", "Para propinas: calcular 10% y ajustar desde ahí"]},
            {"order": 5, "title": "Geometría básica", "description": "Perímetro, área y volumen de figuras fundamentales", "details": "Perímetro = suma de todos los lados. Área del rectángulo = base × altura. Área del triángulo = base × altura / 2. Área del círculo = π × r². Volumen del cubo = lado³.", "is_critical": False, "common_errors": ["Confundir perímetro con área", "Olvidar las unidades (cm vs cm²)", "Usar diámetro en vez de radio en fórmulas del círculo"], "tips": ["Dibujar siempre la figura antes de calcular", "Memorizar: perímetro = alrededor, área = superficie"]},
            {"order": 6, "title": "Orden de operaciones (PEMDAS)", "description": "Aplicar correctamente la jerarquía de operaciones matemáticas", "details": "Paréntesis → Exponentes → Multiplicación/División (izq a der) → Suma/Resta (izq a der). Ejemplo: 2 + 3 × 4 = 2 + 12 = 14, NO 20.", "is_critical": True, "common_errors": ["Resolver de izquierda a derecha sin respetar jerarquía", "Olvidar que multiplicación y división tienen igual prioridad", "No resolver primero lo que está dentro de paréntesis"], "tips": ["Memorizar: 'Por favor excuse mi dulce abuela' (Paréntesis, Exponentes, Multiplicación, División, Adición, Sustracción)", "Subrayar las operaciones prioritarias antes de resolver"]},
            {"order": 7, "title": "Números enteros y negativos", "description": "Operar con números positivos y negativos en la recta numérica", "details": "Los negativos están a la izquierda del 0. Reglas: negativo × negativo = positivo, negativo × positivo = negativo. Restar un negativo es como sumar. -3 - (-5) = -3 + 5 = 2.", "is_critical": False, "common_errors": ["Confundir el signo al multiplicar dos negativos", "Errores con doble negativo: -(-3) = 3, no -3", "No entender que -5 < -2 (más alejado del 0)"], "tips": ["Usar la recta numérica visual", "Pensar en temperatura o deudas para entender negativos"]}
        ],
        "warnings": [
            {"message": "Nunca dividir entre cero. La división entre cero no está definida y es un error matemático fundamental.", "severity": "critical", "when_to_show": "Cuando el estudiante intente dividir entre cero"},
            {"message": "Las fracciones NO se suman como números normales. No sumar numeradores y denominadores por separado. Se necesita denominador común.", "severity": "high", "when_to_show": "Cuando el estudiante sume fracciones incorrectamente"},
            {"message": "El orden de las operaciones importa. 2+3×4 = 14, NO 20. Siempre seguir PEMDAS.", "severity": "high", "when_to_show": "Cuando el estudiante no respete jerarquía de operaciones"},
            {"message": "Las unidades importan. Área se mide en unidades cuadradas (cm²), volumen en cúbicas (cm³). No mezclar.", "severity": "medium", "when_to_show": "En problemas de geometría"}
        ],
        "rules": [
            "Siempre verificar el resultado con una operación inversa",
            "Simplificar fracciones al máximo antes de dar la respuesta final",
            "Respetar el orden de operaciones PEMDAS en todo momento",
            "Incluir las unidades de medida en la respuesta",
            "Leer el problema completo antes de empezar a resolver",
            "Estimar el resultado mentalmente antes de calcular",
            "No saltarse pasos: escribir cada operación intermedia",
            "Revisar que la respuesta tenga sentido en el contexto del problema",
            "Practicar cálculo mental diariamente para mejorar velocidad",
            "Al resolver ecuaciones, hacer lo mismo en ambos lados"
        ],
        "tips": [
            "Para multiplicar por 5: multiplicar por 10 y dividir entre 2",
            "Para calcular 15%: calcular 10% + 5% (la mitad del 10%)",
            "Un triángulo equilátero tiene todos los lados y ángulos iguales (60°)",
            "Para restar mentalmente: sumar desde el número menor al mayor",
            "Los múltiplos de 9: los dígitos siempre suman 9 (18→1+8=9, 27→2+7=9)",
            "Pi (π) ≈ 3.14159, para cálculos rápidos usar 3.14",
            "Para convertir fracción a porcentaje: multiplicar por 100",
            "Cuadrado perfecto: el resultado de un número multiplicado por sí mismo (1,4,9,16,25...)",
            "MCD sirve para simplificar fracciones, MCM para encontrar denominador común",
            "Un número es divisible entre 3 si la suma de sus dígitos es divisible entre 3"
        ],
        "scenarios": [
            {"title": "La tienda de descuentos", "description": "Calcular precios finales con descuentos y propinas", "initial_situation": "Estás en una tienda. Un producto cuesta $80 y tiene 25% de descuento. Además hay un impuesto del 16%.", "expected_actions": ["Calcular el descuento: $80 × 0.25 = $20", "Precio con descuento: $80 - $20 = $60", "Calcular impuesto: $60 × 0.16 = $9.60", "Precio final: $60 + $9.60 = $69.60"], "correct_outcome": "El precio final es $69.60. El descuento se aplica ANTES del impuesto.", "common_mistakes": ["Aplicar impuesto antes del descuento", "Calcular 25% + 16% = 41% y aplicar al precio original"], "difficulty": "medium"},
            {"title": "Receta para fiesta", "description": "Ajustar proporciones de una receta usando fracciones", "initial_situation": "Una receta para 4 personas usa 2/3 de taza de azúcar. Necesitas hacer la receta para 10 personas.", "expected_actions": ["Calcular factor: 10/4 = 5/2 = 2.5", "Multiplicar: 2/3 × 5/2 = 10/6 = 5/3", "Convertir: 5/3 = 1 2/3 tazas de azúcar"], "correct_outcome": "Necesitas 1 y 2/3 tazas de azúcar (o 1.667 tazas).", "common_mistakes": ["Multiplicar solo el numerador", "No simplificar la fracción resultante"], "difficulty": "medium"},
            {"title": "El viaje en coche", "description": "Usar operaciones básicas para planificar un viaje", "initial_situation": "Vas a hacer un viaje de 450 km. Tu coche consume 8 litros por cada 100 km. La gasolina cuesta $1.50 por litro.", "expected_actions": ["Consumo total: 450/100 × 8 = 36 litros", "Costo total: 36 × $1.50 = $54", "Si son 3 personas: $54/3 = $18 por persona"], "correct_outcome": "El viaje costará $54 en gasolina, $18 por persona si van 3.", "common_mistakes": ["Dividir 450 entre 8 directamente", "Olvidar que el consumo es por cada 100 km"], "difficulty": "easy"}
        ],
        "faq": [
            {"question": "¿Qué es una fracción?", "answer": "Una fracción representa partes de un todo. Se escribe como a/b donde 'a' es el numerador (partes que tomamos) y 'b' es el denominador (partes totales). Por ejemplo, 3/4 significa que tomamos 3 partes de un total de 4. Una pizza cortada en 8 pedazos de la que comes 3 se representa como 3/8.", "category": "fracciones", "difficulty": "beginner"},
            {"question": "¿Cómo se suman fracciones con diferente denominador?", "answer": "Para sumar fracciones con diferente denominador: 1) Encontrar el mínimo común denominador (MCM de los denominadores), 2) Convertir cada fracción al nuevo denominador, 3) Sumar los numeradores, 4) Simplificar. Ejemplo: 1/3 + 1/4 → MCM(3,4)=12 → 4/12 + 3/12 = 7/12.", "category": "fracciones", "difficulty": "beginner"},
            {"question": "¿Cómo calculo el porcentaje de un número?", "answer": "Para calcular el X% de un número N, multiplica N × X/100. Ejemplo: 15% de 200 = 200 × 15/100 = 200 × 0.15 = 30. Truco rápido: 10% = mover el punto decimal un lugar a la izquierda (10% de 200 = 20), luego ajustar. 15% = 10% + 5% = 20 + 10 = 30.", "category": "porcentajes", "difficulty": "beginner"},
            {"question": "¿Qué es el área y cómo se diferencia del perímetro?", "answer": "El perímetro es la medida del contorno (alrededor) de una figura, se mide en unidades lineales (cm, m). El área es la medida de la superficie interior, se mide en unidades cuadradas (cm², m²). Ejemplo: un rectángulo de 5×3: perímetro = 2×(5+3) = 16 cm, área = 5×3 = 15 cm².", "category": "geometría", "difficulty": "beginner"},
            {"question": "¿Por qué no se puede dividir entre cero?", "answer": "Dividir entre cero no tiene sentido matemático. Si divides 10/2=5 porque 5×2=10. Pero 10/0=? significaría encontrar un número que multiplicado por 0 dé 10, y no existe tal número (cualquier cosa ×0 = 0). Por eso la división entre cero está indefinida y las calculadoras muestran ERROR.", "category": "operaciones", "difficulty": "beginner"},
            {"question": "¿Qué son los números primos?", "answer": "Un número primo es aquel que solo es divisible entre 1 y sí mismo. Los primeros primos son: 2, 3, 5, 7, 11, 13, 17, 19, 23, 29... El 1 NO es primo. El 2 es el único primo par. Para verificar si N es primo, prueba dividirlo entre todos los primos hasta √N.", "category": "números", "difficulty": "medium"},
            {"question": "¿Cómo convierto fracciones a decimales y viceversa?", "answer": "Fracción a decimal: divide numerador entre denominador. 3/4 = 3÷4 = 0.75. Decimal a fracción: cuenta decimales para el denominador. 0.75 = 75/100 = 3/4 (simplificando). Algunos dan decimales infinitos: 1/3 = 0.333... Memoriza: 1/2=0.5, 1/4=0.25, 1/5=0.2, 3/4=0.75.", "category": "conversiones", "difficulty": "beginner"},
            {"question": "¿Qué es el mínimo común múltiplo (MCM)?", "answer": "El MCM de dos números es el menor número que es múltiplo de ambos. Para encontrarlo: 1) Lista múltiplos de cada número, 2) Encuentra el menor común. Ejemplo: MCM(4,6): múltiplos de 4={4,8,12,16...}, múltiplos de 6={6,12,18...}, MCM=12. Es esencial para sumar fracciones con diferente denominador.", "category": "números", "difficulty": "medium"},
            {"question": "¿Cómo funciona la regla de tres?", "answer": "La regla de tres resuelve proporciones. Si A es a B como C es a X, entonces X = (B×C)/A. Ejemplo: Si 3 manzanas cuestan $6, ¿cuánto cuestan 7? → X = (6×7)/3 = 42/3 = $14. Siempre verifica que la relación sea proporcional (más cantidad = más costo).", "category": "proporciones", "difficulty": "medium"},
            {"question": "¿Cómo calculo el promedio?", "answer": "El promedio (media aritmética) se calcula sumando todos los valores y dividiendo entre la cantidad. Ejemplo: notas 8, 7, 9, 6, 10 → promedio = (8+7+9+6+10)/5 = 40/5 = 8.0. El promedio indica el valor 'típico' de un conjunto de datos. No confundir con mediana (valor del medio al ordenar).", "category": "estadística", "difficulty": "beginner"},
            {"question": "¿Cuál es la diferencia entre MCD y MCM?", "answer": "MCD (Máximo Común Divisor): el mayor número que divide exactamente a ambos. Sirve para simplificar fracciones. MCM (Mínimo Común Múltiplo): el menor número que es múltiplo de ambos. Sirve para sumar fracciones. Ejemplo con 12 y 8: MCD=4 (divide a ambos), MCM=24 (múltiplo de ambos). Relación: MCD×MCM = a×b.", "category": "números", "difficulty": "medium"},
            {"question": "¿Qué es una ecuación y cómo se resuelve?", "answer": "Una ecuación es una igualdad con una incógnita (letra). Para resolverla, aísla la incógnita haciendo la misma operación en ambos lados. Ejemplo: 2x + 5 = 13 → restar 5: 2x = 8 → dividir entre 2: x = 4. Verificar: 2(4)+5 = 13. La regla de oro: lo que haces a un lado, lo haces al otro.", "category": "álgebra", "difficulty": "medium"}
        ]
    },
    "english_basic": {
        "name": "Inglés Básico",
        "description": "Bot experto en enseñanza de inglés básico: gramática fundamental, vocabulario esencial, pronunciación y conversación cotidiana para hispanohablantes.",
        "category": "Idiomas",
        "personality": {"teaching_style": "encouraging", "verbosity": "detailed", "use_examples": True, "use_analogies": True},
        "steps": [
            {"order": 1, "title": "El abecedario y pronunciación", "description": "Aprender los sonidos del inglés que no existen en español", "details": "El inglés tiene 44 sonidos (fonemas) vs 24 del español. Sonidos nuevos: /θ/ (th en 'think'), /ð/ (th en 'the'), /æ/ (a en 'cat'), /ʃ/ (sh en 'she'), /ʒ/ (s en 'vision'). Las vocales tienen sonidos largos y cortos.", "is_critical": True, "common_errors": ["Pronunciar 'th' como 's' o 't'", "No diferenciar 'ship' de 'sheep'", "Pronunciar letras mudas (knife, know)"], "tips": ["Escuchar música y podcasts en inglés diariamente", "Practicar los sonidos frente al espejo"]},
            {"order": 2, "title": "Pronombres y verbo TO BE", "description": "Dominar I am, You are, He/She/It is, We/They are", "details": "El verbo TO BE (ser/estar) es el más importante. I am (yo soy/estoy), You are (tú eres/estás), He/She/It is (él/ella es/está), We are (nosotros somos), They are (ellos son). Contracciones: I'm, you're, he's, she's, it's, we're, they're.", "is_critical": True, "common_errors": ["Usar 'is' con 'you' (you is → you ARE)", "Olvidar que 'it' se usa para cosas y animales", "Confundir 'his' (de él) con 'he's' (he is)"], "tips": ["Practicar presentaciones: 'I am María, I am from Mexico'", "Memorizar contracciones, se usan mucho en conversación"]},
            {"order": 3, "title": "Presente Simple", "description": "Formar oraciones sobre rutinas y hábitos con do/does", "details": "Se usa para rutinas, verdades generales y hábitos. Estructura: Sujeto + verbo base. Con he/she/it se añade -s/-es al verbo. Negativo: don't/doesn't + verbo base. Pregunta: Do/Does + sujeto + verbo base? 'She works every day' / 'She doesn't work on Sunday'.", "is_critical": True, "common_errors": ["Olvidar la -s en tercera persona (He work → He works)", "Doble marcador: 'She doesn't works' (sobra la s)", "No usar 'do/does' en preguntas"], "tips": ["Regla: si usas does/doesn't, el verbo queda sin -s", "Practicar describiendo tu rutina diaria en inglés"]},
            {"order": 4, "title": "Vocabulario esencial (500 palabras)", "description": "Aprender las 500 palabras más frecuentes del inglés", "details": "Las 100 palabras más comunes cubren ~50% del inglés escrito. Categorías clave: números (1-100), colores, familia, comida, casa, ropa, cuerpo, tiempo, transporte. Aprender palabras en contexto, no aisladas.", "is_critical": False, "common_errors": ["Memorizar listas sin contexto", "False friends: 'actually' no es 'actualmente'", "Confundir 'make' y 'do'"], "tips": ["Aprender 10 palabras nuevas por día en contexto", "Poner post-its en objetos de la casa con su nombre en inglés"]},
            {"order": 5, "title": "Artículos y plurales", "description": "Usar correctamente a/an/the y formar plurales", "details": "A = antes de consonante (a book). An = antes de vocal (an apple). The = específico (the book I told you about). Sin artículo para generalizar (Dogs are friendly). Plurales: +s (books), +es (boxes), irregulares (child→children, man→men).", "is_critical": False, "common_errors": ["Usar 'a' antes de vocal ('a apple' → 'an apple')", "Omitir artículos cuando son necesarios", "Decir 'informations' (information es incontable)"], "tips": ["'An' antes de sonido vocal: 'an hour' (h muda), 'a university' (suena /ju/)", "Memorizar sustantivos incontables comunes: information, advice, money"]},
            {"order": 6, "title": "Preposiciones de tiempo y lugar", "description": "Dominar in, on, at, to, from para ubicar en tiempo y espacio", "details": "Tiempo: AT hora (at 3pm), ON día/fecha (on Monday, on June 5th), IN mes/año/periodo (in January, in 2026). Lugar: AT punto específico (at school), ON superficie (on the table), IN espacio cerrado (in the room). TO = dirección, FROM = origen.", "is_critical": False, "common_errors": ["Decir 'in Monday' en vez de 'on Monday'", "Confundir 'at home' con 'in home'", "Decir 'in the morning' pero 'at night' (excepción)"], "tips": ["AT = punto exacto, ON = superficie/día, IN = dentro/período largo", "Excepciones comunes: at home, at work, at school, at night"]},
            {"order": 7, "title": "Pasado Simple", "description": "Hablar sobre eventos terminados con verbos regulares e irregulares", "details": "Regulares: verbo + -ed (worked, played, studied). Irregulares: formas propias (go→went, eat→ate, see→saw). Negativo: didn't + verbo base. Pregunta: Did + sujeto + verbo base? 'I went to school yesterday. I didn't go to work.'", "is_critical": True, "common_errors": ["No aprender los verbos irregulares", "Doble pasado: 'I didn't went' (→ I didn't go)", "Pronunciación de -ed: /t/, /d/, /ɪd/ según el verbo"], "tips": ["Memorizar los 50 irregulares más comunes primero", "Practicar contando qué hiciste ayer en inglés"]}
        ],
        "warnings": [
            {"message": "Los false friends son peligrosos. 'Actually' = en realidad (no 'actualmente'). 'Embarrassed' = avergonzado (no 'embarazada'). 'Sensible' = sensato (no 'sensible').", "severity": "high", "when_to_show": "Cuando el estudiante traduzca literalmente"},
            {"message": "El orden de las palabras en inglés es estricto: Sujeto + Verbo + Objeto. No se puede cambiar como en español.", "severity": "high", "when_to_show": "Cuando el estudiante altere el orden"},
            {"message": "No traducir palabra por palabra del español. 'Tengo 25 años' = 'I AM 25 years old' (no 'I HAVE').", "severity": "critical", "when_to_show": "Cuando el estudiante traduzca literalmente"},
            {"message": "La pronunciación del inglés NO es fonética. Una misma letra puede tener múltiples sonidos. Siempre verificar pronunciación.", "severity": "medium", "when_to_show": "Al introducir palabras nuevas"}
        ],
        "rules": [
            "El sujeto SIEMPRE debe estar presente en inglés (no se puede omitir como en español)",
            "Los adjetivos van ANTES del sustantivo: 'red car' (no 'car red')",
            "Tercera persona singular (he/she/it) siempre lleva -s en presente simple",
            "Con don't/doesn't/didn't el verbo vuelve a su forma base",
            "No usar doble negación: 'I don't have nothing' → 'I don't have anything'",
            "Los sustantivos incontables NO llevan plural: money, information, advice, furniture",
            "Pregunta = auxiliar primero: 'Do you like...?' no 'You like...?'",
            "Practicar al menos 15 minutos diarios de listening",
            "Escribir un diario simple en inglés todos los días",
            "No tener miedo de cometer errores al hablar"
        ],
        "tips": [
            "Cambiar el idioma del celular a inglés para exposición constante",
            "Ver series en inglés con subtítulos en inglés (no en español)",
            "Aprender frases completas, no palabras aisladas",
            "Los phrasal verbs son esenciales: look up, turn on, give up, find out",
            "Para memorizar: repetición espaciada (hoy, mañana, en 3 días, en 7 días)",
            "Hablar solo en inglés en voz alta (describir lo que haces)",
            "Usar apps: Duolingo para vocabulario, YouTube para pronunciación",
            "Leer libros graded readers (nivel A1-A2 al inicio)",
            "La música en inglés ayuda a memorizar estructuras naturalmente",
            "No esperar hablar perfecto para empezar a practicar conversación"
        ],
        "scenarios": [
            {"title": "Presentarte en una reunión", "description": "Práctica de presentación personal en inglés", "initial_situation": "Estás en una reunión de trabajo con personas de otros países. Necesitas presentarte en inglés.", "expected_actions": ["Saludar: 'Hello, nice to meet you'", "Nombre: 'My name is... / I'm...'", "Origen: 'I'm from Mexico'", "Trabajo: 'I work as a... / I'm a...'", "Cierre: 'Nice meeting you all'"], "correct_outcome": "'Hello everyone, nice to meet you. My name is María and I'm from Mexico City. I work as a software developer. I've been with the company for two years. Nice meeting you all.'", "common_mistakes": ["Decir 'I have 25 years' en vez de 'I am 25 years old'", "Olvidar el sujeto: 'Am from Mexico' en vez de 'I am from Mexico'"], "difficulty": "easy"},
            {"title": "Pedir comida en un restaurante", "description": "Ordenar comida y bebida en inglés", "initial_situation": "Estás en un restaurante en Estados Unidos. El mesero se acerca y te pregunta '¿Are you ready to order?'", "expected_actions": ["Responder: 'Yes, I'd like...' o 'Can I have...?'", "Pedir plato: 'I'll have the chicken salad, please'", "Pedir bebida: 'And a glass of water, please'", "Preguntar: 'What do you recommend?'", "Agradecer: 'Thank you'"], "correct_outcome": "'Yes, I'd like the grilled chicken with vegetables, please. And can I have a glass of iced tea? Thank you.' Al final: 'Can I have the check, please?'", "common_mistakes": ["Decir 'I want' (directo y poco cortés) en vez de 'I'd like'", "Olvidar 'please' y 'thank you'"], "difficulty": "easy"},
            {"title": "Dar direcciones", "description": "Explicar cómo llegar a un lugar en inglés", "initial_situation": "Un turista te pregunta: 'Excuse me, how do I get to the train station?'", "expected_actions": ["Indicar dirección: 'Go straight for two blocks'", "Dar giro: 'Turn left/right at the traffic light'", "Referencia: 'It's next to / across from / between'", "Confirmar: 'You can't miss it'"], "correct_outcome": "'Sure! Go straight for two blocks, then turn right at the traffic light. Walk one more block and the train station is on your left, next to the bank. It takes about 5 minutes.'", "common_mistakes": ["Confundir left y right", "Decir 'go to straight' en vez de 'go straight'"], "difficulty": "medium"}
        ],
        "faq": [
            {"question": "¿Cuál es la diferencia entre 'make' y 'do'?", "answer": "MAKE se usa para crear/producir algo nuevo: make a cake, make a decision, make money, make a mistake. DO se usa para actividades/tareas: do homework, do exercise, do the dishes, do business. Truco: si el resultado es algo tangible/nuevo, usa MAKE. Si es una actividad o tarea, usa DO.", "category": "vocabulario", "difficulty": "beginner"},
            {"question": "¿Cuándo uso 'a' y cuándo 'an'?", "answer": "Usa 'a' antes de sonido consonante: a book, a car, a university (suena /ju/). Usa 'an' antes de sonido vocal: an apple, an hour (h muda), an honest person. Lo que importa es el SONIDO, no la letra. Por eso: 'a European' (sonido /ju/) pero 'an MBA' (sonido /em/).", "category": "gramática", "difficulty": "beginner"},
            {"question": "¿Qué son los phrasal verbs y por qué son importantes?", "answer": "Los phrasal verbs son verbos + preposición/adverbio que cambian de significado: look up (buscar), give up (rendirse), turn on (encender), find out (descubrir), come back (regresar). Son ESENCIALES porque los nativos los usan constantemente en conversación cotidiana. Aprende los 50 más comunes primero.", "category": "vocabulario", "difficulty": "medium"},
            {"question": "¿Cómo se forma el presente continuo?", "answer": "Estructura: Sujeto + am/is/are + verbo-ING. 'I am studying' (estoy estudiando), 'She is working' (ella está trabajando). Se usa para acciones que ocurren AHORA MISMO o temporalmente. Negativo: I'm not studying. Pregunta: Are you studying? Reglas de -ING: write→writing (quitar e), run→running (doblar consonante), die→dying (ie→y).", "category": "gramática", "difficulty": "beginner"},
            {"question": "¿Cuál es la diferencia entre 'there', 'their' y 'they're'?", "answer": "THERE = lugar ('The book is there' / 'There is a cat'). THEIR = posesivo de ellos ('Their house is big'). THEY'RE = they are contracción ('They're happy'). Truco: si puedes reemplazar por 'they are', usa they're. Si indica posesión, usa their. Si indica lugar o existencia, usa there.", "category": "gramática", "difficulty": "beginner"},
            {"question": "¿Cómo se usan los modal verbs (can, should, must)?", "answer": "CAN = habilidad/permiso ('I can swim', 'Can I go?'). SHOULD = consejo ('You should study more'). MUST = obligación fuerte ('You must wear a seatbelt'). COULD = habilidad pasada o posibilidad ('I could swim when I was 5'). WOULD = condicional ('I would go if I could'). Los modales NO llevan -s en tercera persona y van seguidos de verbo base.", "category": "gramática", "difficulty": "medium"},
            {"question": "¿Cuál es la diferencia entre el pasado simple y el presente perfecto?", "answer": "Pasado simple: acción terminada en momento específico. 'I visited Paris in 2020' (cuándo importa). Presente perfecto: experiencia de vida sin tiempo específico. 'I have visited Paris' (alguna vez, no importa cuándo). También para acciones que empezaron en el pasado y continúan: 'I have lived here for 5 years'. Clave: si hay tiempo específico (yesterday, in 2020), usa pasado simple.", "category": "gramática", "difficulty": "medium"},
            {"question": "¿Cómo puedo mejorar mi pronunciación en inglés?", "answer": "1) Escuchar mucho: podcasts, series, música en inglés. 2) Repetir en voz alta (shadowing): imitar exactamente lo que escuchas. 3) Grabar tu voz y comparar. 4) Aprender el IPA (alfabeto fonético). 5) Enfocarte en los sonidos que no existen en español: th, r, sh, vowels. 6) Usar apps como Forvo o YouGlish para escuchar pronunciación real. 7) No intentar sonar 'perfecto', enfocarse en ser entendido.", "category": "pronunciación", "difficulty": "beginner"},
            {"question": "¿Cuáles son los false friends más comunes español-inglés?", "answer": "Actually = en realidad (NO actualmente→currently). Embarrassed = avergonzado (NO embarazada→pregnant). Sensible = sensato (NO sensible→sensitive). Library = biblioteca (NO librería→bookstore). Exit = salida (NO éxito→success). Carpet = alfombra (NO carpeta→folder). Constipated = estreñido (NO constipado→cold). Fabric = tela (NO fábrica→factory).", "category": "vocabulario", "difficulty": "beginner"},
            {"question": "¿Cómo formo preguntas en inglés correctamente?", "answer": "En inglés las preguntas invierten el auxiliar: Afirmación: 'You are happy' → Pregunta: 'Are you happy?' Con do/does: 'She likes coffee' → 'Does she like coffee?' WH-questions: WH-word + auxiliar + sujeto + verbo: 'Where do you live?' 'What does she want?' 'When did they arrive?' Error común: 'Where you live?' (falta el auxiliar 'do').", "category": "gramática", "difficulty": "beginner"},
            {"question": "¿Qué son los countable e uncountable nouns?", "answer": "Countable (contables): se pueden contar, tienen plural. a book/books, a car/cars. Uncountable (incontables): NO tienen plural. water, money, information, advice, furniture, music, homework. Con incontables: NO 'a information', sino 'some information' o 'a piece of information'. Usa 'much' con incontables y 'many' con contables. 'How much money?' vs 'How many coins?'", "category": "gramática", "difficulty": "medium"},
            {"question": "¿Cómo se usa 'going to' vs 'will' para el futuro?", "answer": "GOING TO: planes decididos/intenciones ('I'm going to study medicine') y predicciones con evidencia ('Look at those clouds, it's going to rain'). WILL: decisiones espontáneas ('I'll help you'), promesas ('I will always love you'), predicciones sin evidencia ('I think it will rain tomorrow'). Resumen: going to = planeado, will = espontáneo/promesas.", "category": "gramática", "difficulty": "medium"}
        ]
    },
    "history": {
        "name": "Historia Universal",
        "description": "Bot experto en historia universal: desde las civilizaciones antiguas hasta la era contemporánea. Enfoque en eventos clave, personajes importantes y conexiones entre épocas.",
        "category": "Ciencias Sociales",
        "personality": {"teaching_style": "balanced", "verbosity": "detailed", "use_examples": True, "use_analogies": True},
        "steps": [
            {"order": 1, "title": "Civilizaciones antiguas", "description": "Mesopotamia, Egipto, Grecia y Roma: las bases de la civilización occidental", "details": "Mesopotamia (3500 a.C.): primera escritura (cuneiforme), Código de Hammurabi. Egipto (3100 a.C.): pirámides, faraones, jeroglíficos. Grecia (800 a.C.): democracia, filosofía, Olimpiadas. Roma (753 a.C.): república→imperio, derecho romano, acueductos.", "is_critical": True, "common_errors": ["Confundir las fechas entre civilizaciones", "Creer que la democracia griega incluía a todos (solo ciudadanos varones libres)", "Pensar que Roma cayó de golpe (fue un proceso de siglos)"], "tips": ["Usar líneas de tiempo visuales", "Conectar conceptos antiguos con la actualidad"]},
            {"order": 2, "title": "Edad Media", "description": "Del siglo V al XV: feudalismo, cruzadas, renacimiento del comercio", "details": "Caída de Roma (476 d.C.) marca el inicio. Sistema feudal: rey→nobles→vasallos→siervos. Cruzadas (1096-1291): guerras religiosas que abrieron rutas comerciales. Peste Negra (1347-1351): mató 1/3 de Europa. La imprenta de Gutenberg (1440) revolucionó el conocimiento.", "is_critical": False, "common_errors": ["Llamarla 'edad oscura' (hubo mucho avance)", "Ignorar las civilizaciones no europeas de la época (Islam, China, Maya)", "Simplificar las Cruzadas como solo guerra religiosa"], "tips": ["La Edad Media NO fue solo europea", "Comparar el feudalismo con sistemas modernos de trabajo"]},
            {"order": 3, "title": "Renacimiento y Era de los Descubrimientos", "description": "Siglos XV-XVII: arte, ciencia, exploración y nuevos mundos", "details": "Renacimiento: Da Vinci, Miguel Ángel, humanismo. Descubrimientos: Colón (1492), Magallanes (vuelta al mundo). Reforma protestante: Lutero (1517). Revolución científica: Copérnico, Galileo, Newton.", "is_critical": False, "common_errors": ["Decir que Colón 'descubrió' América (ya había civilizaciones)", "Ignorar el impacto devastador en las poblaciones indígenas", "Pensar que el Renacimiento fue solo arte (también ciencia y filosofía)"], "tips": ["El Renacimiento significa 'renacer' del conocimiento clásico", "Conectar los descubrimientos con la globalización actual"]},
            {"order": 4, "title": "Revoluciones (XVIII-XIX)", "description": "Las revoluciones que transformaron el mundo moderno", "details": "Revolución Americana (1776): independencia de EE.UU., democracia. Revolución Francesa (1789): libertad, igualdad, fraternidad. Revolución Industrial (1760-1840): máquina de vapor, fábricas, urbanización. Independencias latinoamericanas (1810-1830): Bolívar, San Martín, Hidalgo.", "is_critical": True, "common_errors": ["Confundir las causas de la Revolución Francesa y la Americana", "No ver la conexión entre Revolución Industrial y problemas sociales", "Ignorar el rol de la Ilustración como base intelectual"], "tips": ["Las revoluciones no suceden aisladas, están conectadas", "Pensar en cómo la Rev. Industrial creó el mundo moderno"]},
            {"order": 5, "title": "Guerras Mundiales (XX)", "description": "Los dos conflictos que redefinieron el orden mundial", "details": "WWI (1914-1918): trincheras, 17 millones de muertos, caída de imperios. WWII (1939-1945): Holocaust, bombas atómicas, 70-85 millones de muertos. Resultado: ONU, Guerra Fría, descolonización. La WWII fue consecuencia directa de cómo terminó la WWI.", "is_critical": True, "common_errors": ["Simplificar las causas a un solo evento (asesinato de Franz Ferdinand)", "No entender la conexión entre ambas guerras", "Desconocer el papel de los países no europeos"], "tips": ["WWI y WWII son en realidad un solo conflicto con pausa", "Siempre analizar: causas → desarrollo → consecuencias"]},
            {"order": 6, "title": "Guerra Fría y mundo bipolar", "description": "1947-1991: EE.UU. vs URSS, el mundo dividido en dos bloques", "details": "Dos superpotencias: EE.UU. (capitalismo) vs URSS (comunismo). Eventos clave: Muro de Berlín (1961-1989), Crisis de Cuba (1962), Guerra de Vietnam, Carrera espacial. Caída de la URSS (1991): fin de la Guerra Fría.", "is_critical": False, "common_errors": ["Pensar que 'fría' significa que no hubo combates (guerras proxy)", "Creer que solo afectó a EE.UU. y Rusia", "No entender la carrera armamentista nuclear"], "tips": ["La Guerra Fría se 'peleó' en terceros países", "Relacionar con la política actual entre potencias"]},
            {"order": 7, "title": "Mundo contemporáneo (1991-hoy)", "description": "Globalización, tecnología, nuevos desafíos del siglo XXI", "details": "Globalización acelerada, Internet (1990s), smartphones. 11-S (2001) y guerra contra el terrorismo. Crisis financiera 2008. Pandemia COVID-19 (2020). Cambio climático como desafío global. Auge de China como potencia.", "is_critical": False, "common_errors": ["Ver la historia como algo 'que ya pasó' y no conectar con el presente", "Ignorar las perspectivas no occidentales", "Simplificar conflictos actuales sin contexto histórico"], "tips": ["Todo evento actual tiene raíces históricas", "Leer noticias con perspectiva histórica"]}
        ],
        "warnings": [
            {"message": "La historia tiene múltiples perspectivas. Lo que fue 'descubrimiento' para Europa fue 'invasión' para América. Siempre considerar diferentes puntos de vista.", "severity": "high", "when_to_show": "Al hablar de colonización o conquista"},
            {"message": "Cuidado con el presentismo: juzgar el pasado con valores actuales puede distorsionar la comprensión. Contextualizar siempre.", "severity": "medium", "when_to_show": "Al analizar decisiones históricas"},
            {"message": "Las fechas son importantes pero NO lo más importante. Entender las CAUSAS y CONSECUENCIAS es más valioso que memorizar años.", "severity": "high", "when_to_show": "Cuando el estudiante se enfoque demasiado en fechas"},
            {"message": "La historia no es solo guerras y reyes. La vida cotidiana, la cultura, la economía y la tecnología son igualmente importantes.", "severity": "medium", "when_to_show": "Al dar una visión panorámica"}
        ],
        "rules": [
            "Siempre contextualizar: qué pasaba antes, durante y después de cada evento",
            "Presentar múltiples perspectivas, no solo la europea/occidental",
            "Conectar eventos del pasado con situaciones actuales",
            "Usar fuentes primarias cuando sea posible (documentos, testimonios)",
            "Distinguir entre hechos históricos y opiniones/interpretaciones",
            "Aprender historia como proceso, no como lista de fechas",
            "Identificar patrones: las causas de las revoluciones suelen repetirse",
            "Respetar la complejidad: raramente hay buenos y malos absolutos",
            "Usar mapas para entender la geografía de los eventos",
            "Relacionar la historia con otras disciplinas: economía, arte, ciencia"
        ],
        "tips": [
            "Crear líneas de tiempo visuales para cada período",
            "Ver documentales históricos de calidad (BBC, National Geographic)",
            "Leer novelas históricas para 'vivir' las épocas",
            "Visitar museos (virtuales o presenciales) para conectar con la historia",
            "Comparar eventos similares de diferentes épocas",
            "Hacer preguntas '¿qué hubiera pasado si...?' para entender consecuencias",
            "La historia se repite: identificar patrones en conflictos y revoluciones",
            "Usar mnemotecnias para fechas clave",
            "Estudiar la historia de tu propia región/país en contexto global",
            "Debatir temas históricos ayuda a profundizar la comprensión"
        ],
        "scenarios": [
            {"title": "Debate: ¿Fue justa la Revolución Francesa?", "description": "Analizar la Revolución Francesa desde diferentes perspectivas", "initial_situation": "En una clase de historia, se debate si la Revolución Francesa fue 'necesaria' y 'justa'. Debes argumentar desde ambos lados.", "expected_actions": ["A favor: injusticia social extrema, hambruna, absolutismo", "En contra: violencia excesiva (Terror), miles de ejecuciones", "Contextualizar: Ilustración, ejemplo de EE.UU.", "Consecuencias: derechos humanos, pero también Napoleón"], "correct_outcome": "La revolución fue producto de condiciones insostenibles (hambre, desigualdad extrema), pero su ejecución incluyó violencia excesiva. El resultado a largo plazo (derechos, democracia) fue positivo, pero el camino fue traumático. No es blanco o negro.", "common_mistakes": ["Juzgar solo desde el resultado final", "Ignorar el sufrimiento de las víctimas del Terror"], "difficulty": "medium"},
            {"title": "Línea de tiempo: De Roma a la UE", "description": "Trazar la evolución política de Europa en 2000 años", "initial_situation": "Debes crear una línea de tiempo que conecte el Imperio Romano con la Unión Europea, mostrando los grandes cambios políticos.", "expected_actions": ["Imperio Romano → caída (476)", "Feudalismo medieval", "Estados nacionales (XV-XVI)", "Imperios coloniales (XVI-XIX)", "Guerras mundiales → UE (1957/1993)"], "correct_outcome": "Roma unificó Europa por la fuerza → fragmentación feudal → estados nacionales compitiendo → dos guerras devastadoras → cooperación voluntaria (UE). El ciclo: unión → fragmentación → conflicto → nueva unión, pero ahora por elección.", "common_mistakes": ["No ver las conexiones entre períodos", "Ignorar que la UE es respuesta directa a las guerras"], "difficulty": "hard"},
            {"title": "¿Por qué cayó el Imperio Romano?", "description": "Analizar las múltiples causas de la caída de Roma", "initial_situation": "Un estudiante pregunta: '¿Por qué cayó Roma?' y espera UNA respuesta simple.", "expected_actions": ["Explicar que no fue UNA causa sino muchas", "Causas internas: corrupción, inflación, ejército debilitado", "Causas externas: invasiones bárbaras, presión en fronteras", "Proceso gradual: décadas de declive, no un evento", "El Imperio Oriental (Bizancio) sobrevivió 1000 años más"], "correct_outcome": "Roma no 'cayó' un día. Fue un proceso de siglos con múltiples causas: extensión excesiva del imperio, corrupción interna, crisis económica, dependencia de mercenarios, invasiones germánicas, y división del imperio. La caída de Occidente (476) no significó el fin de Roma: Bizancio continuó hasta 1453.", "common_mistakes": ["Dar una sola causa simple", "Decir que los 'bárbaros' destruyeron Roma (muchos se integraron)"], "difficulty": "medium"}
        ],
        "faq": [
            {"question": "¿Por qué es importante estudiar historia?", "answer": "Estudiar historia nos permite entender el presente: por qué existen las fronteras actuales, los sistemas políticos, las desigualdades. Nos enseña a no repetir errores (dictaduras, guerras evitables). Desarrolla pensamiento crítico al analizar fuentes y perspectivas. Además, conocer la historia de la humanidad nos da identidad y nos conecta con quienes vivieron antes.", "category": "general", "difficulty": "beginner"},
            {"question": "¿Qué fue la Revolución Industrial y por qué cambió todo?", "answer": "La Revolución Industrial (1760-1840, Inglaterra) fue el paso de producción manual a máquinas. La máquina de vapor de Watt fue clave. Consecuencias: fábricas en ciudades, éxodo rural, clase obrera, contaminación, pero también más producción, transporte (trenes, barcos), y eventualmente mejor nivel de vida. Creó el mundo moderno: capitalismo, urbanización, y los problemas ambientales que enfrentamos hoy.", "category": "revoluciones", "difficulty": "beginner"},
            {"question": "¿Cuáles son las 7 maravillas del mundo antiguo?", "answer": "1) Gran Pirámide de Giza (Egipto, ~2560 a.C.) - la única que sobrevive. 2) Jardines Colgantes de Babilonia (Iraq, ~600 a.C.). 3) Estatua de Zeus en Olimpia (Grecia). 4) Templo de Artemisa en Éfeso (Turquía). 5) Mausoleo de Halicarnaso (Turquía). 6) Coloso de Rodas (Grecia). 7) Faro de Alejandría (Egipto). Todas eran del mundo mediterráneo porque la lista la hicieron los griegos.", "category": "antigüedad", "difficulty": "beginner"},
            {"question": "¿Qué diferencia hay entre la Primera y la Segunda Guerra Mundial?", "answer": "WWI (1914-18): causada por imperialismo, alianzas y nacionalismo. Guerra de trincheras estática. 17M muertos. Resultado: caída de imperios (otomano, austrohúngaro, ruso). WWII (1939-45): causada por el Tratado de Versalles, nazismo, expansionismo. Guerra de movimiento (tanques, aviones). 70-85M muertos. Holocausto. Bombas atómicas. Resultado: ONU, Guerra Fría, descolonización. La WWII fue consecuencia directa de cómo terminó la WWI.", "category": "guerras", "difficulty": "medium"},
            {"question": "¿Quién fue Alejandro Magno?", "answer": "Alejandro III de Macedonia (356-323 a.C.) fue uno de los mayores conquistadores de la historia. Alumno de Aristóteles. A los 20 años heredó el trono y en 13 años conquistó desde Grecia hasta la India, creando uno de los imperios más grandes. Difundió la cultura griega (helenismo). Murió a los 32 años en Babilonia. Su imperio se dividió entre sus generales. Importante: conectó Oriente y Occidente culturalmente.", "category": "personajes", "difficulty": "medium"},
            {"question": "¿Qué fue el feudalismo?", "answer": "Sistema político-social de la Edad Media (siglos IX-XV). Estructura piramidal: Rey (dueño de todo) → Nobles/Señores feudales (recibían tierras a cambio de servicio militar) → Vasallos (servían al señor) → Siervos/Campesinos (trabajaban la tierra, no podían irse). No había movilidad social. La tierra (feudo) era la base de la riqueza. La Iglesia tenía poder paralelo. Decayó con el comercio, las ciudades y la Peste Negra.", "category": "edad media", "difficulty": "beginner"},
            {"question": "¿Qué causó la caída del Muro de Berlín?", "answer": "El Muro de Berlín (1961-1989) dividió Berlín en Oeste (capitalista) y Este (comunista). Causas de su caída: 1) Reformas de Gorbachov (glasnost/perestroika) debilitaron el control soviético. 2) Crisis económica en el bloque oriental. 3) Protestas masivas en Alemania del Este. 4) Hungría abrió su frontera con Austria. El 9 de noviembre de 1989, ante la presión popular, se abrieron los pasos. Simbolizó el fin de la Guerra Fría.", "category": "guerra fría", "difficulty": "medium"},
            {"question": "¿Qué civilizaciones existían en América antes de la llegada de los europeos?", "answer": "Muchas civilizaciones avanzadas: MAYAS (300-900 d.C., Mesoamérica): astronomía, matemáticas, escritura jeroglífica. AZTECAS (1325-1521, México): Tenochtitlán era más grande que cualquier ciudad europea. INCAS (1438-1533, Andes): red de caminos, Machu Picchu, sin escritura pero usaban quipus. También: Olmecas, Toltecas, Moche, Nazca, Mapuches, y cientos más. No eran 'primitivos' - tenían ciudades, agricultura, arte y ciencia avanzados.", "category": "antigüedad", "difficulty": "medium"},
            {"question": "¿Qué fue la Guerra Fría y por qué se llama así?", "answer": "La Guerra Fría (1947-1991) fue la rivalidad entre EE.UU. (capitalismo) y la URSS (comunismo) después de la WWII. Se llama 'fría' porque nunca hubo enfrentamiento directo entre ambas potencias (hubiera sido nuclear). En cambio, pelearon a través de: guerras proxy (Corea, Vietnam), carrera espacial, carrera armamentista, espionaje, propaganda. Dividió al mundo en dos bloques. Terminó con la disolución de la URSS en 1991.", "category": "guerra fría", "difficulty": "beginner"},
            {"question": "¿Quién fue Cleopatra?", "answer": "Cleopatra VII (69-30 a.C.) fue la última faraona de Egipto, de la dinastía ptolemaica (griega, no egipcia). Hablaba 9 idiomas. Se alió con Julio César y luego con Marco Antonio de Roma para mantener la independencia de Egipto. Tras la derrota en la batalla de Accio (31 a.C.) contra Octavio, se suicidó. Con su muerte, Egipto se convirtió en provincia romana. No era solo por su belleza: era brillante política y estratega.", "category": "personajes", "difficulty": "medium"},
            {"question": "¿Qué fue el Renacimiento?", "answer": "Movimiento cultural europeo (siglos XIV-XVII) que 'renació' el interés por la cultura clásica grecorromana. Comenzó en Italia (Florencia). Características: humanismo (el ser humano al centro), arte realista (Da Vinci, Miguel Ángel, Rafael), ciencia basada en observación (Galileo, Copérnico), imprenta (Gutenberg, 1440). No fue solo arte: fue un cambio de mentalidad del teocentrismo (Dios al centro) al antropocentrismo (humano al centro). Base del pensamiento moderno.", "category": "renacimiento", "difficulty": "beginner"},
            {"question": "¿Cómo se conecta la historia antigua con el mundo actual?", "answer": "Las conexiones son directas: Democracia (Grecia) → nuestros sistemas políticos. Derecho romano → base de leyes en Occidente. Alfabeto fenicio → nuestro alfabeto. Números arábigos (de India) → matemáticas actuales. Religiones antiguas → religiones actuales. Rutas comerciales antiguas → globalización. Filosofía griega → pensamiento científico. Ingeniería romana (acueductos, caminos) → infraestructura moderna. El pasado literalmente construyó el presente.", "category": "general", "difficulty": "medium"}
        ]
    }
}


def get_template_data(template_key):
    """Obtiene los datos de entrenamiento de un template"""
    return TRAINING_TEMPLATES.get(template_key)


def train_bot_from_template(template_key, filename=None):
    """Entrena un bot completo desde un template predefinido"""
    template = get_template_data(template_key)
    if not template:
        print(f"  Template '{template_key}' no encontrado.")
        print(f"  Templates disponibles: {list(TRAINING_TEMPLATES.keys())}")
        return None
    
    trainer = ExpertBotTrainer()
    
    # Iniciar entrenamiento
    result = trainer.start_training(
        name=template["name"],
        description=template["description"],
        category=template["category"]
    )
    print(f"  Iniciando: {template['name']}...")
    
    # Personalidad
    p = template["personality"]
    trainer.set_personality(
        teaching_style=p["teaching_style"],
        verbosity=p["verbosity"],
        use_examples=p["use_examples"],
        use_analogies=p["use_analogies"]
    )
    
    # Steps
    for step in template["steps"]:
        trainer.add_step(
            title=step["title"],
            description=step["description"],
            details=step.get("details", ""),
            is_critical=step.get("is_critical", False),
            common_errors=step.get("common_errors", []),
            tips=step.get("tips", [])
        )
    print(f"    + {len(template['steps'])} pasos")
    
    # Warnings
    for w in template["warnings"]:
        trainer.add_warning(
            message=w["message"],
            severity=w.get("severity", "medium"),
            when_to_show=w.get("when_to_show", "")
        )
    print(f"    + {len(template['warnings'])} advertencias")
    
    # Rules
    for rule in template["rules"]:
        trainer.add_rule(rule)
    print(f"    + {len(template['rules'])} reglas")
    
    # Tips
    for tip in template["tips"]:
        trainer.add_tip(tip)
    print(f"    + {len(template['tips'])} tips")
    
    # Scenarios
    for s in template["scenarios"]:
        trainer.add_scenario(
            title=s["title"],
            description=s["description"],
            initial_situation=s["initial_situation"],
            expected_actions=s["expected_actions"],
            correct_outcome=s["correct_outcome"],
            common_mistakes=s.get("common_mistakes", []),
            difficulty=s.get("difficulty", "medium")
        )
    print(f"    + {len(template['scenarios'])} escenarios")
    
    # FAQ
    for qa in template.get("faq", []):
        trainer.add_qa_pair(
            question=qa["question"],
            answer=qa["answer"],
            category=qa.get("category", ""),
            difficulty=qa.get("difficulty", "medium")
        )
    print(f"    + {len(template.get('faq', []))} FAQ")
    
    # Finalizar
    bot_data = trainer.finalize()
    
    # Guardar
    if not filename:
        filename = template["name"].lower().replace(" ", "_").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")
    filepath = save_bot(bot_data, filename=filename + ".json")
    
    # Evaluar calidad
    quality = get_bot_quality_score(bot_data)
    
    print(f"\n  Bot guardado: {filepath}")
    print(f"  Calidad: {quality['total_score']:.1f}/100 - {quality['level']}")
    
    return bot_data, quality


def improve_bot(filename):
    """Carga un bot y sugiere mejoras"""
    bot_data = load_bot(filename)
    if not bot_data:
        print(f"  Bot '{filename}' no encontrado.")
        return
    
    quality = get_bot_quality_score(bot_data)
    config = bot_data.get("bot_config", {})
    
    print(f"\n  BOT: {config.get('name', 'N/A')}")
    print(f"  Calidad: {quality['total_score']:.1f}/100 - {quality['level']}")
    print(f"\n  Puntuaciones por area:")
    for k, v in quality["scores"].items():
        filled = int(v / 10)
        bar = "#" * filled + "." * (10 - filled)
        print(f"    {k:12s}: [{bar}] {v:.0f}%")
    
    if quality["recommendations"]:
        print(f"\n  Recomendaciones:")
        for i, rec in enumerate(quality["recommendations"], 1):
            clean = rec.encode('ascii', 'ignore').decode('ascii').strip()
            if clean:
                print(f"    {i}. {clean}")
    else:
        print(f"\n  Este bot esta en excelente estado!")
    
    return quality


# ──────────────────────────────────────────────────────────────
# MENU PRINCIPAL
# ──────────────────────────────────────────────────────────────
def main_menu():
    """Menú principal de la rutina diaria"""
    tracker = load_tracker()
    if not tracker:
        print("ERROR: No se encontro el tracker. Ejecuta primero el setup.")
        return
    
    while True:
        bots_real = show_dashboard(tracker)
        task_type, target = show_todays_task(tracker, bots_real)
        
        print("\n  OPCIONES:")
        print("  1. Entrenar bot del dia (automatico con template)")
        print("  2. Mejorar un bot existente")
        print("  3. Ver calidad detallada de un bot")
        print("  4. Entrenar bot personalizado (interactivo)")
        print("  5. Ver plan de entrenamiento completo")
        print("  6. Actualizar tracker")
        print("  0. Salir")
        
        choice = input("\n  Opcion: ").strip()
        
        if choice == "1":
            # Entrenamiento automático
            if task_type == "create" and target:
                template_key = target.get("template", "")
                if template_key and template_key in TRAINING_TEMPLATES:
                    print(f"\n  Entrenando: {target['name']}...")
                    result = train_bot_from_template(template_key, target.get("filename", "").replace(".json", ""))
                    if result:
                        target["status"] = "complete"
                        target["quality_score"] = result[1]["total_score"]
                        target["total_items"] = result[1]["total_items"]
                        target["last_improved"] = get_today()
                        save_tracker(tracker)
                        print(f"\n  Tracker actualizado!")
                else:
                    print(f"\n  Template '{template_key}' no disponible aun.")
                    print(f"  Templates disponibles: {list(TRAINING_TEMPLATES.keys())}")
                    print(f"  Usa opcion 4 para entrenamiento interactivo.")
            elif task_type == "improve":
                improve_bot(target["filename"])
            else:
                print("  No hay tarea pendiente para hoy.")
            input("\n  Presiona Enter para continuar...")
        
        elif choice == "2":
            print("\n  Bots existentes:")
            for b in bots_real:
                print(f"    - {b['filename']}: {b['name']} ({b['quality_score']:.0f}/100)")
            fname = input("\n  Nombre del archivo: ").strip()
            if fname:
                improve_bot(fname)
            input("\n  Presiona Enter para continuar...")
        
        elif choice == "3":
            print("\n  Bots existentes:")
            for b in bots_real:
                print(f"    - {b['filename']}: {b['name']} ({b['quality_score']:.0f}/100)")
            fname = input("\n  Nombre del archivo: ").strip()
            if fname:
                bot_data = load_bot(fname)
                if bot_data:
                    quality = get_bot_quality_score(bot_data)
                    kb = bot_data.get("bot_config", {}).get("knowledge_base", {})
                    print(f"\n  DETALLE COMPLETO:")
                    print(f"  Steps: {len(kb.get('steps', []))}")
                    for s in kb.get("steps", []):
                        print(f"    {s.get('order', '?')}. {s.get('title', 'N/A')}")
                    print(f"\n  FAQ: {len(kb.get('faq', []))}")
                    for qa in kb.get("faq", [])[:5]:
                        print(f"    Q: {qa.get('question', 'N/A')[:60]}")
                    if len(kb.get("faq", [])) > 5:
                        print(f"    ... y {len(kb['faq'])-5} mas")
            input("\n  Presiona Enter para continuar...")
        
        elif choice == "4":
            print("\n  Abriendo entrenamiento interactivo...")
            print("  Ejecuta: python -m scripts.train_bot")
            input("\n  Presiona Enter para continuar...")
        
        elif choice == "5":
            clear()
            print("\n  PLAN COMPLETO DE BOTS:")
            print(f"  {'ID':>3} {'Nombre':<30} {'Cat.':<15} {'Fase':>4} {'Estado':<15} {'Score':>5}")
            print(f"  {'-'*3} {'-'*30} {'-'*15} {'-'*4} {'-'*15} {'-'*5}")
            for bp in tracker["bots_plan"]:
                score_str = f"{bp['quality_score']:.0f}" if bp['quality_score'] > 0 else "-"
                print(f"  {bp['id']:>3} {bp['name']:<30} {bp['category']:<15} {bp['phase']:>4} {bp['status']:<15} {score_str:>5}")
            input("\n  Presiona Enter para continuar...")
        
        elif choice == "6":
            # Actualizar tracker con datos reales
            for bot_real in bots_real:
                for bp in tracker["bots_plan"]:
                    if bp["filename"] == bot_real["filename"]:
                        bp["quality_score"] = bot_real["quality_score"]
                        bp["total_items"] = bot_real["total_items"]
                        if bot_real["quality_score"] >= 90:
                            bp["status"] = "complete"
                        elif bot_real["quality_score"] > 0:
                            bp["status"] = "needs_improvement"
                        bp["last_improved"] = get_today()
            
            tracker["stats"]["total_bots_created"] = len(bots_real)
            tracker["stats"]["total_bots_complete"] = sum(1 for b in bots_real if b["quality_score"] >= 90)
            tracker["stats"]["total_items_all_bots"] = sum(b["total_items"] for b in bots_real)
            tracker["stats"]["average_quality"] = sum(b["quality_score"] for b in bots_real) / max(len(bots_real), 1)
            tracker["stats"]["categories_covered"] = len(set(b["category"] for b in bots_real))
            
            save_tracker(tracker)
            print("\n  Tracker actualizado correctamente!")
            input("\n  Presiona Enter para continuar...")
        
        elif choice == "0":
            print("\n  Hasta manana! Recuerda entrenar diariamente.")
            break


if __name__ == "__main__":
    main_menu()
