/**
 * demoChat.ts
 * Modo demo: cuando DEMO_MODE = true en AuthContext,
 * el frontend intenta login con demo/demo1234 para obtener JWT real
 * y usar la IA del backend. Solo si eso falla, se usan estas
 * respuestas simuladas locales como último recurso.
 */

import type { ChatMessageResponse } from "../types";

// DEMO_MODE: true = auto-login como demo, con fallback a mock si no hay backend
const DEMO_MODE = true;
export { DEMO_MODE };

// ── Respuestas de bienvenida por tema ─────────────────────────────────────────
const WELCOME: Record<string, string> = {
  matematicas: `## ¡Bienvenido a Matemáticas! 🧮

Soy tu tutor de **Pensamiento Lógico-Matemático** para el Saber 11.

Podemos trabajar en:
- **Álgebra** — ecuaciones, funciones, sistemas
- **Geometría** — áreas, volúmenes, trigonometría
- **Estadística** — probabilidad, análisis de datos

¿Por cuál área empezamos?`,

  lectora: `## ¡Bienvenido a Lectura Crítica! 📖

Soy tu tutor de **Comprensión Lectora** para el Saber 11.

Practicaremos:
- **Textos informativos** — extracción de ideas clave
- **Textos argumentativos** — análisis de posiciones y argumentos
- **Textos literarios** — interpretación y sentido implícito

¿Con qué tipo de texto quieres comenzar?`,

  ingles: `## Welcome to English! 🌎

I'm your **English** tutor for the Saber 11 exam.

We can practice:
- **Reading comprehension** — understanding texts in English
- **Grammar** — verb tenses, sentence structure
- **Vocabulary** — common words and phrases

What would you like to work on first?`,

  ciudadanas: `## ¡Bienvenido a Ciencias Sociales! 🏛️

Soy tu tutor de **Competencias Ciudadanas** para el Saber 11.

Exploraremos temas como:
- **Democracia y constitución** colombiana
- **Convivencia** y derechos humanos
- **Historia** y geografía

¿Por dónde empezamos?`,

  cientifico: `## ¡Bienvenido a Ciencias Naturales! 🔬

Soy tu tutor de **Pensamiento Científico** para el Saber 11.

Cubriremos:
- **Biología** — célula, ecosistemas, genética
- **Química** — reacciones, tabla periódica, soluciones
- **Física** — movimiento, energía, ondas

¿Qué área te genera más dudas?`,
};

// ── Pool de respuestas demo ───────────────────────────────────────────────────
const REPLIES = [
  `## Explicación paso a paso

Para resolver este tipo de problema, sigue estos pasos:

1. **Identifica los datos clave** del enunciado
2. **Selecciona el concepto** o fórmula que aplica
3. **Sustituye y simplifica** cuidadosamente
4. **Verifica el resultado** con las unidades o el contexto

> Este tipo de pregunta aparece frecuentemente en el Saber 11.

¿Quieres que trabajemos un ejemplo concreto con números?`,

  `¡Muy bien! 💡 Estás comprendiendo el concepto.

La clave que debes recordar:

- **No memorices** → comprende el *porqué*
- **Practica con variantes** del mismo tipo de ejercicio
- Cuando puedas explicarlo con tus propias palabras, lo dominaste

> "La diferencia entre saber y entender es lo que separa un puntaje promedio de uno sobresaliente."

¿Quieres intentar un ejercicio similar por tu cuenta?`,

  `Entiendo tu duda, es un error muy común.

## ¿Por qué ocurre la confusión?

- No distinguir **cuándo** aplicar cada concepto
- Confundir los signos al operar con variables
- Saltar pasos en lugar de resolverlo ordenadamente

---

El truco es **identificar el patrón** antes de calcular. ¿Probamos primero con un ejercicio más sencillo?`,

  `✅ ¡Correcto!

Ahora sube un nivel: aplica el mismo razonamiento a este contexto diferente.

> Cuando puedas explicar un concepto de forma sencilla, es señal de que verdaderamente lo entendiste.

Para el Saber 11, recuerda que lo más importante es la **comprensión conceptual**, no memorizar fórmulas. ¿Continuamos con el siguiente nivel?`,

  `## Resumen del tema

Hasta aquí hemos cubierto:

- El **concepto base** y su definición
- Cómo **aplicarlo** en preguntas tipo Saber 11
- Los **errores más comunes** y cómo evitarlos

---

¿Seguimos con el siguiente subtema o quieres practicar más este antes de avanzar?`,
];

const STATES = ["normal", "learning", "focused", "curiosity", "mastery"];
const SUGGESTIONS = [
  ["Explícame con un ejemplo", "¿Puedes simplificarlo?", "Siguiente tema"],
  ["Dame otro ejercicio", "¿Cómo se aplica esto?", "Repasa el concepto"],
  ["Entendido, sigamos", "Tengo una duda", "¿Qué tan importante es esto?"],
];

let _turn = 0;

function makeResponse(message: string): ChatMessageResponse {
  const state = STATES[_turn % STATES.length];
  const sugs = SUGGESTIONS[_turn % SUGGESTIONS.length];
  _turn++;
  return {
    message,
    cognitive_state: state,
    action: "continue",
    suggestions: sugs,
    difficulty: "medium",
    confidence: 0.8,
    should_pause: false,
    metadata: {},
    emotional_state: null,
    attention_level: 0.75,
    engagement_score: 0.8,
    error_risk: 0.1,
    active_modalities: ["text"],
  };
}

export function demoStartSession(skillKey: string): ChatMessageResponse {
  _turn = 0;
  const welcome = WELCOME[skillKey] ?? WELCOME["matematicas"];
  return makeResponse(welcome);
}

export function demoSendMessage(_userMessage: string): ChatMessageResponse {
  const reply = REPLIES[_turn % REPLIES.length];
  return makeResponse(reply);
}
