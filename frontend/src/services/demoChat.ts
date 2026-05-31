/**
 * demoChat.ts
 * Simula las respuestas del backend para DEMO_MODE.
 * Se usa cuando DEMO_MODE = true en AuthContext, permitiendo
 * navegar por todo el chat sin necesitar backend.
 */

import type { ChatMessageResponse } from "../types";

const DEMO_MODE = true;
export { DEMO_MODE };

// ── Respuestas de bienvenida por tema ─────────────────────────────────────────
const WELCOME: Record<string, string> = {
  matematicas: "¡Hola! Soy tu tutor de **Pensamiento Lógico-Matemático** 🧮\n\nEstoy aquí para ayudarte a prepararte para el Saber 11. ¿Empezamos con álgebra, geometría o estadística?",
  lectora:     "¡Hola! Soy tu tutor de **Comprensión Lectora** 📖\n\nPracticaremos lectura crítica para el Saber 11. ¿Quieres trabajar con textos informativos, literarios o argumentativos?",
  ingles:      "Hello! I'm your **English** tutor 🌎\n\nLet's get you ready for Saber 11. Shall we practice reading comprehension, grammar or vocabulary?",
  ciudadanas:  "¡Hola! Soy tu tutor de **Competencias Ciudadanas** 🏛️\n\nExploraremos temas de democracia, convivencia y constitución. ¿Por dónde empezamos?",
  cientifico:  "¡Hola! Soy tu tutor de **Pensamiento Científico** 🔬\n\nRepasaremos física, química y biología para el Saber 11. ¿Qué área te genera más dudas?",
};

// ── Pool de respuestas demo ───────────────────────────────────────────────────
const REPLIES = [
  "¡Excelente pregunta! Déjame explicarte paso a paso:\n\n**1.** Primero identifica los datos clave del problema.\n**2.** Aplica el concepto correspondiente.\n**3.** Verifica tu resultado.\n\n¿Quieres que trabajemos un ejemplo concreto?",
  "Muy bien 💡 Eso demuestra que estás comprendiendo el concepto. Ahora intenta este desafío:\n\n> ¿Puedes explicar con tus propias palabras lo que acabas de aprender?\n\nEso refuerza mucho la memoria a largo plazo.",
  "Entiendo tu duda. Es un tema que confunde a muchos. La clave está en:\n\n- Reconocer el **patrón** detrás del ejercicio\n- Practicar con variantes del mismo tipo\n- No memorizar, sino **entender el porqué**\n\n¿Probamos con un ejercicio similar?",
  "¡Vas muy bien! Tu ritmo de aprendizaje es bueno. Recuerda que para el Saber 11 lo más importante es la **comprensión conceptual**, no la memorización.\n\n¿Continuamos con el siguiente nivel?",
  "Esa es una respuesta correcta ✅\n\nAhora un nivel más difícil: intenta aplicar el mismo razonamiento a un contexto diferente. ¿Te animas?",
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
