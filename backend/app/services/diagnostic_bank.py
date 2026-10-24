"""
NeuroLearn IA — Banco de preguntas del diagnóstico inicial (RF-13).

Diez preguntas de selección múltiple con única respuesta por cada una de las
cinco competencias Saber 11 (app/services/competencies.py). En cada
competencia hay 4 preguntas de nivel básico, 3 intermedio y 3 avanzado, para
que el resultado distinga niveles y no solo cuente aciertos.

Cada pregunta:
    id           identificador estable (se guarda con las respuestas)
    topic        tema dentro de la competencia (reporte por tema)
    difficulty   basico | intermedio | avanzado
    context      texto de apoyo opcional (lectura, situación, tabla)
    text         enunciado
    options      cuatro opciones
    correct      índice (0-3) de la opción correcta — NUNCA se envía al
                 estudiante antes de responder
    explanation  retroalimentación que se muestra al terminar
"""
from __future__ import annotations

from typing import Dict, List

DIFFICULTY_WEIGHTS = {"basico": 1, "intermedio": 2, "avanzado": 3}
DIFFICULTY_LABELS = {"basico": "Básico", "intermedio": "Intermedio", "avanzado": "Avanzado"}

QUESTIONS_PER_COMPETENCY = 10

BANK: Dict[str, List[dict]] = {
    # ── Pensamiento Lógico-Matemático ─────────────────────────────────────────
    "matematicas": [
        {
            "id": "mat-01", "topic": "Ecuaciones", "difficulty": "basico",
            "text": "¿Cuál es el valor de x en la ecuación 3x + 5 = 20?",
            "options": ["3", "5", "15", "25/3"], "correct": 1,
            "explanation": "3x = 20 − 5 = 15, entonces x = 15 ÷ 3 = 5.",
        },
        {
            "id": "mat-02", "topic": "Estadística", "difficulty": "basico",
            "text": "Las notas de Laura en cinco quices fueron 4, 8, 6, 10 y 7. ¿Cuál es su promedio?",
            "options": ["6", "7", "8", "35"], "correct": 1,
            "explanation": "La suma es 35 y hay 5 datos: 35 ÷ 5 = 7.",
        },
        {
            "id": "mat-03", "topic": "Geometría", "difficulty": "basico",
            "text": "Un rectángulo mide 8 cm de largo y 5 cm de ancho. ¿Cuál es su área?",
            "options": ["13 cm²", "26 cm²", "40 cm²", "80 cm²"], "correct": 2,
            "explanation": "Área = largo × ancho = 8 × 5 = 40 cm². (26 cm es el perímetro.)",
        },
        {
            "id": "mat-04", "topic": "Proporcionalidad", "difficulty": "basico",
            "text": "¿Cuánto es el 20 % de 150?",
            "options": ["15", "20", "30", "75"], "correct": 2,
            "explanation": "20 % = 0,2; 0,2 × 150 = 30.",
        },
        {
            "id": "mat-05", "topic": "Funciones", "difficulty": "intermedio",
            "text": "Si f(x) = 2x − 3, ¿cuál es el valor de f(4)?",
            "options": ["5", "8", "11", "−5"], "correct": 0,
            "explanation": "f(4) = 2·4 − 3 = 8 − 3 = 5.",
        },
        {
            "id": "mat-06", "topic": "Probabilidad", "difficulty": "intermedio",
            "text": "En una bolsa hay 3 balotas rojas, 5 azules y 2 verdes. Si se saca una al azar, "
                    "¿cuál es la probabilidad de que sea azul?",
            "options": ["1/5", "1/3", "1/2", "5/8"], "correct": 2,
            "explanation": "Hay 5 azules de 10 balotas en total: 5/10 = 1/2.",
        },
        {
            "id": "mat-07", "topic": "Proporcionalidad", "difficulty": "intermedio",
            "text": "Andrés pagó $60.000 por unos tenis que tenían un descuento del 25 %. "
                    "¿Cuál era el precio antes del descuento?",
            "options": ["$75.000", "$80.000", "$85.000", "$45.000"], "correct": 1,
            "explanation": "Pagó el 75 % del precio: 0,75·P = 60.000, entonces P = 80.000.",
        },
        {
            "id": "mat-08", "topic": "Geometría", "difficulty": "avanzado",
            "text": "Un triángulo rectángulo tiene catetos de 6 m y 8 m. ¿Cuánto mide la hipotenusa?",
            "options": ["7 m", "10 m", "14 m", "48 m"], "correct": 1,
            "explanation": "Por Pitágoras: √(6² + 8²) = √(36 + 64) = √100 = 10 m.",
        },
        {
            "id": "mat-09", "topic": "Probabilidad", "difficulty": "avanzado",
            "text": "Se lanzan dos monedas al aire. ¿Cuál es la probabilidad de obtener al menos una cara?",
            "options": ["1/4", "1/2", "2/3", "3/4"], "correct": 3,
            "explanation": "Los casos son CC, CS, SC y SS. Solo SS no tiene cara: 1 − 1/4 = 3/4.",
        },
        {
            "id": "mat-10", "topic": "Funciones", "difficulty": "avanzado",
            "text": "¿Cuál es la ecuación de la recta que pasa por los puntos (0, 2) y (2, 8)?",
            "options": ["y = 2x + 3", "y = 3x + 2", "y = 4x + 2", "y = 6x + 2"], "correct": 1,
            "explanation": "Pendiente = (8 − 2)/(2 − 0) = 3 y corta el eje y en 2: y = 3x + 2.",
        },
    ],

    # ── Lectura Crítica ───────────────────────────────────────────────────────
    "lectora": [
        {
            "id": "lec-01", "topic": "Idea principal", "difficulty": "basico",
            "context": "Las abejas transportan el polen de una flor a otra mientras buscan néctar. "
                       "Gracias a ese transporte, muchas plantas pueden producir frutos y semillas. "
                       "Se calcula que gran parte de los alimentos que consumimos depende de la "
                       "polinización que realizan estos insectos.",
            "text": "¿Cuál es la idea principal del texto?",
            "options": [
                "Las abejas buscan néctar en las flores.",
                "Las abejas son importantes porque polinizan las plantas que nos alimentan.",
                "Las plantas producen frutos y semillas.",
                "Los insectos consumen muchos alimentos.",
            ], "correct": 1,
            "explanation": "Las demás opciones son detalles; la idea que los reúne es la importancia "
                           "de la polinización de las abejas para la alimentación.",
        },
        {
            "id": "lec-02", "topic": "Tipos de texto", "difficulty": "basico",
            "text": "Un texto cuyo propósito principal es convencer al lector de adoptar una postura es:",
            "options": ["Narrativo", "Descriptivo", "Instructivo", "Argumentativo"], "correct": 3,
            "explanation": "El texto argumentativo defiende una tesis con razones para persuadir.",
        },
        {
            "id": "lec-03", "topic": "Inferencias", "difficulty": "basico",
            "context": "Cuando Ana llegó a casa, el piso de la entrada estaba mojado y los paraguas "
                       "goteaban junto a la puerta.",
            "text": "¿Qué se puede inferir del fragmento?",
            "options": [
                "Ana trapeó el piso.",
                "Había llovido o estaba lloviendo.",
                "Ana olvidó su paraguas.",
                "Se rompió una tubería.",
            ], "correct": 1,
            "explanation": "Los paraguas mojados son la pista: alguien llegó de la lluvia.",
        },
        {
            "id": "lec-04", "topic": "Comunicación", "difficulty": "basico",
            "text": "Completa con el conector adecuado: «Estudió toda la semana; ______, no aprobó el examen».",
            "options": ["por lo tanto", "sin embargo", "además", "es decir"], "correct": 1,
            "explanation": "La segunda idea contradice lo esperado por la primera: se necesita un "
                           "conector de contraste.",
        },
        {
            "id": "lec-05", "topic": "Argumentación", "difficulty": "intermedio",
            "context": "Las ciudades deberían ampliar sus ciclorrutas. La bicicleta no contamina, "
                       "reduce el tráfico y mejora la salud de quienes la usan. Además, construir "
                       "ciclorrutas cuesta mucho menos que construir nuevas vías para carros.",
            "text": "¿Cuál es la tesis del autor?",
            "options": [
                "La bicicleta mejora la salud.",
                "Construir vías para carros es costoso.",
                "Las ciudades deberían ampliar sus ciclorrutas.",
                "El tráfico es el principal problema urbano.",
            ], "correct": 2,
            "explanation": "La tesis es la postura que se defiende; las otras opciones son los "
                           "argumentos que la apoyan.",
        },
        {
            "id": "lec-06", "topic": "Argumentación", "difficulty": "intermedio",
            "context": "Las ciudades deberían ampliar sus ciclorrutas. La bicicleta no contamina, "
                       "reduce el tráfico y mejora la salud de quienes la usan.",
            "text": "¿Cuál de los siguientes datos DEBILITARÍA el argumento del autor?",
            "options": [
                "En otras ciudades las ciclorrutas redujeron los trancones.",
                "La mayoría de los habitantes vive a más de 25 km de su trabajo y no usaría la bicicleta.",
                "Montar bicicleta reduce el riesgo de enfermedades cardíacas.",
                "Las bicicletas no emiten gases contaminantes.",
            ], "correct": 1,
            "explanation": "Si casi nadie usaría las ciclorrutas, los beneficios que promete el autor "
                           "no se lograrían.",
        },
        {
            "id": "lec-07", "topic": "Inferencias", "difficulty": "intermedio",
            "context": "«¡Qué maravilla! Otra vez se fue la luz justo cuando iba a guardar el trabajo», "
                       "dijo Camilo mirando la pantalla apagada.",
            "text": "¿Con qué intención usa Camilo la expresión «¡Qué maravilla!»?",
            "options": [
                "Expresar alegría porque terminó el trabajo.",
                "Mostrar ironía ante una situación molesta.",
                "Agradecer que se fue la luz.",
                "Describir la pantalla del computador.",
            ], "correct": 1,
            "explanation": "Dice lo contrario de lo que siente: es ironía frente a perder su trabajo.",
        },
        {
            "id": "lec-08", "topic": "Argumentación", "difficulty": "avanzado",
            "context": "«Como el colegio instaló cámaras en los pasillos, este año no habrá robos».",
            "text": "¿Qué supuesto implícito tiene esta afirmación?",
            "options": [
                "Los robos solo ocurren en los pasillos y las cámaras los evitan por completo.",
                "El colegio tiene muchos pasillos.",
                "Las cámaras son costosas.",
                "El año pasado hubo pocos robos.",
            ], "correct": 0,
            "explanation": "Para que la conclusión sea válida, habría que suponer que las cámaras "
                           "eliminan todos los robos y que estos solo pasan donde ellas vigilan.",
        },
        {
            "id": "lec-09", "topic": "Argumentación", "difficulty": "avanzado",
            "text": "¿Cuál de los siguientes enunciados expresa una OPINIÓN y no un hecho?",
            "options": [
                "Colombia tiene costas sobre el océano Pacífico y el mar Caribe.",
                "En 2018 se realizaron elecciones presidenciales en Colombia.",
                "El vallenato es la música más bonita del país.",
                "El río Magdalena atraviesa varios departamentos.",
            ], "correct": 2,
            "explanation": "«La más bonita» es una valoración personal que no se puede verificar.",
        },
        {
            "id": "lec-10", "topic": "Comunicación", "difficulty": "avanzado",
            "context": "Texto 1: «Las redes sociales acercan a las personas: permiten hablar a diario "
                       "con familiares lejanos». Texto 2: «Las redes sociales crean una ilusión de "
                       "compañía: muchos jóvenes tienen cientos de contactos y se sienten solos».",
            "text": "¿Qué relación hay entre los dos textos?",
            "options": [
                "El texto 2 amplía con ejemplos la idea del texto 1.",
                "Ambos defienden que las redes sociales eliminan la soledad.",
                "Presentan posturas opuestas sobre el efecto de las redes en las relaciones.",
                "El texto 1 es una consecuencia del texto 2.",
            ], "correct": 2,
            "explanation": "Uno valora que las redes acercan; el otro, que generan una compañía falsa.",
        },
    ],

    # ── Inglés Comunicativo ───────────────────────────────────────────────────
    "ingles": [
        {
            "id": "ing-01", "topic": "Present Simple", "difficulty": "basico",
            "text": "Choose the correct option: «She ______ to school every day».",
            "options": ["go", "goes", "going", "gone"], "correct": 1,
            "explanation": "Con he/she/it en presente simple se agrega -s/-es al verbo: goes.",
        },
        {
            "id": "ing-02", "topic": "Vocabulary", "difficulty": "basico",
            "text": "Where can you buy bread?",
            "options": ["At a bakery", "At a library", "At a hospital", "At a bank"], "correct": 0,
            "explanation": "Bakery = panadería.",
        },
        {
            "id": "ing-03", "topic": "Past Simple", "difficulty": "basico",
            "text": "Choose the correct option: «Yesterday I ______ a movie with my friends».",
            "options": ["watch", "watches", "watched", "am watching"], "correct": 2,
            "explanation": "«Yesterday» indica pasado: watched.",
        },
        {
            "id": "ing-04", "topic": "Reading", "difficulty": "basico",
            "text": "What does the sign «NO PARKING» mean?",
            "options": [
                "You can't leave your car here.",
                "You can't walk here.",
                "The park is closed.",
                "You must pay to enter.",
            ], "correct": 0,
            "explanation": "Parking = estacionar: no se puede dejar el carro ahí.",
        },
        {
            "id": "ing-05", "topic": "Connectors", "difficulty": "intermedio",
            "text": "Choose the correct connector: «I wanted to go out, ______ it was raining».",
            "options": ["because", "so", "but", "and"], "correct": 2,
            "explanation": "Hay contraste entre querer salir y la lluvia: but.",
        },
        {
            "id": "ing-06", "topic": "Present Perfect", "difficulty": "intermedio",
            "text": "Choose the correct option: «I have lived in Medellín ______ 2015».",
            "options": ["for", "since", "during", "ago"], "correct": 1,
            "explanation": "Since + punto de inicio (2015); for + duración (for ten years).",
        },
        {
            "id": "ing-07", "topic": "Reading", "difficulty": "intermedio",
            "context": "Tom usually takes the bus to work. Today he walked because the bus drivers "
                       "were on strike.",
            "text": "Why did Tom walk today?",
            "options": [
                "He wanted to do exercise.",
                "He missed the bus.",
                "The buses were not working.",
                "His work is near his house.",
            ], "correct": 2,
            "explanation": "«On strike» = en huelga: no había buses.",
        },
        {
            "id": "ing-08", "topic": "Conditionals", "difficulty": "avanzado",
            "text": "Choose the correct option: «If I ______ more free time, I would travel around Colombia».",
            "options": ["have", "had", "will have", "would have"], "correct": 1,
            "explanation": "Segundo condicional: If + pasado simple, would + verbo.",
        },
        {
            "id": "ing-09", "topic": "Passive Voice", "difficulty": "avanzado",
            "text": "Choose the correct option: «This bridge ______ in 1990».",
            "options": ["built", "was built", "has build", "is building"], "correct": 1,
            "explanation": "Voz pasiva en pasado: was/were + participio (built).",
        },
        {
            "id": "ing-10", "topic": "Reading", "difficulty": "avanzado",
            "context": "Maria has been studying English for three years. At first she found it "
                       "difficult, but she started watching series with subtitles and practicing "
                       "with an app every day. Now she can talk with tourists without problems.",
            "text": "What is the main idea of the text?",
            "options": [
                "English series are better than apps.",
                "Maria improved her English through constant practice.",
                "Tourists help Maria with her homework.",
                "Learning English is always easy.",
            ], "correct": 1,
            "explanation": "El texto describe cómo la práctica diaria le permitió a María mejorar.",
        },
    ],

    # ── Competencias Ciudadanas ───────────────────────────────────────────────
    "ciudadanas": [
        {
            "id": "ciu-01", "topic": "Constitución", "difficulty": "basico",
            "text": "¿En qué año se expidió la Constitución Política que rige actualmente en Colombia?",
            "options": ["1886", "1948", "1991", "2016"], "correct": 2,
            "explanation": "La Constitución vigente es la de 1991, que reemplazó a la de 1886.",
        },
        {
            "id": "ciu-02", "topic": "Derechos", "difficulty": "basico",
            "text": "¿Qué mecanismo permite pedirle a un juez la protección inmediata de un derecho "
                    "fundamental que está siendo vulnerado?",
            "options": ["El derecho de petición", "La acción de tutela", "El referendo", "La consulta popular"],
            "correct": 1,
            "explanation": "La acción de tutela (art. 86) protege de forma rápida los derechos fundamentales.",
        },
        {
            "id": "ciu-03", "topic": "Democracia", "difficulty": "basico",
            "text": "¿Qué rama del poder público se encarga principalmente de hacer las leyes?",
            "options": ["La ejecutiva", "La judicial", "La legislativa", "Los organismos de control"],
            "correct": 2,
            "explanation": "La rama legislativa, a través del Congreso, hace las leyes.",
        },
        {
            "id": "ciu-04", "topic": "Participación", "difficulty": "basico",
            "text": "¿Cuál de los siguientes es un mecanismo de participación ciudadana?",
            "options": ["El decreto", "La sentencia", "El plebiscito", "La resolución"], "correct": 2,
            "explanation": "El plebiscito es un mecanismo de participación (Ley 134 de 1994); los "
                           "demás son actos de autoridades.",
        },
        {
            "id": "ciu-05", "topic": "Convivencia", "difficulty": "intermedio",
            "context": "Dos estudiantes discuten fuertemente porque ambos quieren usar la cancha del "
                       "colegio a la misma hora del descanso.",
            "text": "¿Cuál es la forma más adecuada de resolver el conflicto?",
            "options": [
                "Que el más fuerte decida quién usa la cancha.",
                "Prohibir el uso de la cancha a ambos.",
                "Dialogar y acordar turnos, con ayuda de un mediador si es necesario.",
                "Ignorar el conflicto hasta que se olvide.",
            ], "correct": 2,
            "explanation": "El diálogo y la mediación buscan una solución en la que ambas partes ganan.",
        },
        {
            "id": "ciu-06", "topic": "Pensamiento social", "difficulty": "intermedio",
            "context": "Una empresa quiere construir una represa en un río. El alcalde la apoya porque "
                       "generará energía y empleo; los campesinos de la zona se oponen porque "
                       "inundará sus cultivos.",
            "text": "¿Qué interés defienden principalmente los campesinos?",
            "options": [
                "Aumentar la producción de energía.",
                "Conservar sus tierras y su forma de sustento.",
                "Generar empleo para la región.",
                "Reducir los costos de la empresa.",
            ], "correct": 1,
            "explanation": "Analizar las perspectivas implica reconocer qué arriesga cada actor.",
        },
        {
            "id": "ciu-07", "topic": "Pensamiento social", "difficulty": "intermedio",
            "context": "Un municipio prohíbe la venta ambulante en el centro para «recuperar el "
                       "espacio público».",
            "text": "¿Cuál es una posible consecuencia NO deseada de esta medida?",
            "options": [
                "Las calles del centro quedan más despejadas.",
                "Los peatones caminan con más facilidad.",
                "Muchos vendedores pierden su principal fuente de ingresos.",
                "Mejora la imagen del centro de la ciudad.",
            ], "correct": 2,
            "explanation": "Las otras opciones son efectos buscados; la pérdida de ingresos es un "
                           "efecto colateral que la medida debería prever.",
        },
        {
            "id": "ciu-08", "topic": "Derechos", "difficulty": "avanzado",
            "context": "Un estudiante publica en redes sociales que su profesor «roba dinero del "
                       "colegio», sin tener ninguna prueba.",
            "text": "¿Qué derechos entran en tensión en esta situación?",
            "options": [
                "El derecho a la educación y el derecho al trabajo.",
                "La libertad de expresión y el derecho a la honra y al buen nombre.",
                "El derecho a la salud y el derecho a la vida.",
                "El derecho al voto y el derecho de petición.",
            ], "correct": 1,
            "explanation": "La libertad de expresión tiene límites: no ampara afirmaciones falsas que "
                           "dañen la honra de otra persona.",
        },
        {
            "id": "ciu-09", "topic": "Convivencia", "difficulty": "avanzado",
            "text": "«Los jóvenes de ese barrio son todos peligrosos». Esta afirmación es un ejemplo de:",
            "options": [
                "Un dato estadístico comprobado.",
                "Un estereotipo que generaliza y puede llevar a la discriminación.",
                "Una norma de convivencia.",
                "Un argumento basado en evidencia.",
            ], "correct": 1,
            "explanation": "Atribuye una característica negativa a todo un grupo sin evidencia: es un "
                           "estereotipo.",
        },
        {
            "id": "ciu-10", "topic": "Constitución", "difficulty": "avanzado",
            "context": "Un colegio público obliga a todos sus estudiantes a asistir a las celebraciones "
                       "de una religión específica, sin importar sus creencias.",
            "text": "¿Qué principio de la Constitución de 1991 se estaría desconociendo?",
            "options": [
                "La libertad de cultos y de conciencia.",
                "La autonomía de las entidades territoriales.",
                "La separación de las ramas del poder.",
                "El derecho a la propiedad privada.",
            ], "correct": 0,
            "explanation": "Colombia garantiza la libertad de cultos y de conciencia (arts. 18 y 19): "
                           "nadie puede ser obligado a practicar una religión.",
        },
    ],

    # ── Pensamiento Científico ────────────────────────────────────────────────
    "cientifico": [
        {
            "id": "cie-01", "topic": "Biología", "difficulty": "basico",
            "text": "¿En qué organelo de la célula vegetal se realiza la fotosíntesis?",
            "options": ["Mitocondria", "Cloroplasto", "Núcleo", "Ribosoma"], "correct": 1,
            "explanation": "Los cloroplastos contienen clorofila y transforman la luz en energía química.",
        },
        {
            "id": "cie-02", "topic": "Método científico", "difficulty": "basico",
            "text": "En el método científico, una hipótesis es:",
            "options": [
                "Una ley comprobada que no cambia.",
                "Una posible explicación que se puede poner a prueba.",
                "El resultado final de un experimento.",
                "Una opinión que no necesita comprobarse.",
            ], "correct": 1,
            "explanation": "La hipótesis es una respuesta tentativa que se verifica con experimentos.",
        },
        {
            "id": "cie-03", "topic": "Química", "difficulty": "basico",
            "text": "¿Cuál de los siguientes es un cambio químico?",
            "options": [
                "El hielo que se derrite.",
                "Un clavo que se oxida.",
                "El agua que hierve.",
                "Un papel que se rompe.",
            ], "correct": 1,
            "explanation": "La oxidación forma una sustancia nueva (óxido de hierro); los demás son "
                           "cambios físicos.",
        },
        {
            "id": "cie-04", "topic": "Física", "difficulty": "basico",
            "text": "¿En qué unidad se mide la fuerza en el Sistema Internacional?",
            "options": ["Julio", "Vatio", "Newton", "Pascal"], "correct": 2,
            "explanation": "La fuerza se mide en newtons (N). El julio mide energía y el vatio, potencia.",
        },
        {
            "id": "cie-05", "topic": "Método científico", "difficulty": "intermedio",
            "context": "Un estudiante riega cuatro plantas iguales con 50, 100, 150 y 200 mL de agua "
                       "al día y mide cuánto crece cada una durante un mes.",
            "text": "¿Cuál es la variable independiente del experimento?",
            "options": [
                "El crecimiento de las plantas.",
                "La cantidad de agua de riego.",
                "El tipo de planta.",
                "La duración del experimento.",
            ], "correct": 1,
            "explanation": "La variable independiente es la que el investigador cambia a propósito: el agua.",
        },
        {
            "id": "cie-06", "topic": "Ecología", "difficulty": "intermedio",
            "context": "En un ecosistema, los zorros se alimentan de conejos y los conejos se alimentan "
                       "de pasto.",
            "text": "Si desaparecen los zorros, ¿qué es lo más probable que ocurra a corto plazo?",
            "options": [
                "La población de conejos disminuye.",
                "La población de conejos aumenta y el pasto disminuye.",
                "El pasto aumenta.",
                "No ocurre ningún cambio.",
            ], "correct": 1,
            "explanation": "Sin depredador, los conejos se multiplican y consumen más pasto.",
        },
        {
            "id": "cie-07", "topic": "Física", "difficulty": "intermedio",
            "text": "Un bus recorre 120 km en 2 horas con velocidad constante. ¿Cuál es su velocidad?",
            "options": ["30 km/h", "60 km/h", "120 km/h", "240 km/h"], "correct": 1,
            "explanation": "Velocidad = distancia ÷ tiempo = 120 km ÷ 2 h = 60 km/h.",
        },
        {
            "id": "cie-08", "topic": "Química", "difficulty": "avanzado",
            "text": "Cuando un ácido reacciona con una base en las cantidades adecuadas (neutralización), "
                    "se obtiene:",
            "options": [
                "Un metal y oxígeno.",
                "Una sal y agua.",
                "Solo gas hidrógeno.",
                "Otro ácido más fuerte.",
            ], "correct": 1,
            "explanation": "Ácido + base → sal + agua, y la solución queda cerca de pH 7.",
        },
        {
            "id": "cie-09", "topic": "Interpretación de datos", "difficulty": "avanzado",
            "context": "En 100 g de agua se disuelven como máximo 200 g de azúcar a 20 °C, 240 g a "
                       "40 °C y 287 g a 60 °C.",
            "text": "¿Qué conclusión se puede sacar de estos datos?",
            "options": [
                "La solubilidad del azúcar disminuye al aumentar la temperatura.",
                "La temperatura no influye en la solubilidad del azúcar.",
                "La solubilidad del azúcar aumenta al aumentar la temperatura.",
                "A 60 °C el azúcar deja de disolverse.",
            ], "correct": 2,
            "explanation": "A mayor temperatura se disuelve más azúcar en la misma cantidad de agua.",
        },
        {
            "id": "cie-10", "topic": "Biología", "difficulty": "avanzado",
            "text": "Si se cruzan dos plantas heterocigotas (Aa), donde A es dominante, ¿qué porcentaje "
                    "de la descendencia mostrará el rasgo recesivo?",
            "options": ["0 %", "25 %", "50 %", "75 %"], "correct": 1,
            "explanation": "Aa × Aa da AA, Aa, Aa y aa: solo 1 de 4 (25 %) es aa y muestra el rasgo recesivo.",
        },
    ],
}


def questions_for(competency: str) -> List[dict]:
    """Preguntas (con respuesta) de una competencia; lista vacía si no existe."""
    return BANK.get(competency, [])


def public_question(q: dict) -> dict:
    """La pregunta sin la respuesta correcta ni la explicación."""
    return {
        "id": q["id"],
        "topic": q["topic"],
        "difficulty": q["difficulty"],
        "context": q.get("context"),
        "text": q["text"],
        "options": list(q["options"]),
    }
