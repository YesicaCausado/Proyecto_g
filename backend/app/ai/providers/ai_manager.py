"""
NeuroLearn AI - Gestor de Proveedores de IA

Cadena de fallback (sin costo):
1. Groq openai/gpt-oss-120b  →  modelo chat principal de Groq Cloud (JSON estable)
2. Google Gemini gemini-3.6-flash →  respaldo gratuito
3. Local                      → Templates + JSON curado (siempre funciona)

El conocimiento curado (JSON de los bots) se inyecta como contexto
en el system prompt, y la IA genera respuestas naturales basadas
en esa información verificada.
"""
from typing import Optional, List, Dict
import logging

from app.ai.providers.groq_provider import GroqProvider
from app.ai.providers.gemini_provider import GeminiProvider

logger = logging.getLogger(__name__)


class AIManager:
    """
    Gestor centralizado de proveedores de IA.
    Maneja la cadena de fallback automáticamente.
    """

    def __init__(
        self,
        groq_api_key: Optional[str] = None,
        groq_model: str = "openai/gpt-oss-120b",
        gemini_api_key: Optional[str] = None,
        gemini_model: str = "gemini-3.6-flash",
    ):
        self.providers = []
        self.active_provider: Optional[str] = None

        # Proveedor 1: Groq (modelo chat principal — openai/gpt-oss-120b)
        if groq_api_key:
            self.providers.append({
                "name": "groq",
                "provider": GroqProvider(api_key=groq_api_key, model=groq_model),
            })
            logger.info(f"✅ Proveedor Groq registrado: {groq_model}")

        # Proveedor 2: Google Gemini (respaldo gratuito)
        if gemini_api_key:
            self.providers.append({
                "name": "gemini",
                "provider": GeminiProvider(api_key=gemini_api_key, model=gemini_model),
            })
            logger.info(f"✅ Proveedor Gemini registrado: {gemini_model}")

        if not self.providers:
            logger.warning("⚠️ Sin proveedores de IA. Se usará modo local únicamente.")

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        context_messages: Optional[List[Dict]] = None,
    ) -> Dict:
        """
        Genera una respuesta usando la cadena de fallback.
        
        Returns:
            Dict con:
            - response: Texto generado (SIEMPRE: si todos los proveedores
                        fallan, se devuelve un template local de respaldo)
            - provider: Nombre del proveedor que respondió ("local" si degradó)
            - fallback_used: Si se usó un proveedor alternativo o el local
        """
        for i, entry in enumerate(self.providers):
            name = entry["name"]
            provider = entry["provider"]

            if not provider.is_available():
                continue

            logger.info(f"🤖 Intentando con proveedor: {name}")

            response = await provider.generate(
                prompt=prompt,
                system_prompt=system_prompt,
                temperature=temperature,
                max_tokens=max_tokens,
                context_messages=context_messages,
            )

            if response:
                self.active_provider = name
                return {
                    "response": response,
                    "provider": name,
                    "fallback_used": i > 0,
                }

            logger.warning(f"⚠️ Proveedor {name} falló. Intentando siguiente...")

        # Todos los proveedores fallaron → modo local (templates curados)
        logger.warning("🔄 Todos los proveedores fallaron. Usando modo local.")
        local_text = self._generate_local_response(prompt, system_prompt)
        return {
            "response": local_text,
            "provider": "local",
            "fallback_used": True,
        }

    def _generate_local_response(self, prompt: str, system_prompt: str = "") -> str:
        """
        Genera una respuesta local de respaldo (template) cuando todos los
        proveedores externos fallan o no están configurados.

        Degrada con tronco pedagógico útil en español, SIN inventar datos:
        reconoce de forma honesta que no hay conectividad y ofrece orientación
        y siguientes pasos, de modo que el chat nunca quede en blanco.
        """
        # Intentamos recuperar el tema desde el system prompt para personalizar.
        topic = ""
        for line in (system_prompt or "").splitlines():
            if line.startswith("TEMA ACTUAL:"):
                topic = line.split(":", 1)[1].strip()
                break

        # Si el prompt pide generar un quiz/JSON, devolvemos un template
        # coherente con lo que se espera (el caller lo valida de todos modos).
        prompt_lower = (prompt or "").lower()
        if "quiz" in prompt_lower or '"questions"' in prompt or "questions" in prompt_lower:
            import json
            quiz = {
                "questions": [
                    {
                        "id": 1,
                        "question": "Explica con tus propias palabras el concepto principal de este tema.",
                        "options": ["No lo sé aún", "Puedo intentarlo", "Lo tengo claro, déjame explicarlo"],
                        "answer": "Lo tengo claro, déjame explicarlo",
                        "explanation": "Esta es una pregunta de diagnóstico: responde según lo que recuerdes.",
                    }
                ]
            }
            return json.dumps(quiz, ensure_ascii=False)

        if topic:
            return (
                f"📚 Estoy aquí para ayudarte con **{topic}** aunque ahora mismo no "
                f"tengo conexión con el motor de IA.\n\n"
                f"Para continuar, te propongo:\n"
                f"1️⃣ Explícame en tus palabras qué sabes ya sobre este tema.\n"
                f"2️⃣ Escribe `ejemplo` para revisar un caso práctico.\n"
                f"3️⃣ Escribe `evaluar` para poner a prueba tus conocimientos.\n\n"
                f"Volveré a conectarme automáticamente en tu próximo mensaje. 😊"
            )

        return (
            "🤖 En este momento no tengo conexión con el motor de IA, pero "
            "estoy listo para retomar en tu próximo mensaje.\n\n"
            "Mientras tanto, cuéntame qué tema estás estudiando o qué "
            "pregunta tienes y te ayudaré en cuanto pueda."
        )

    def get_status(self) -> Dict:
        """Retorna el estado de todos los proveedores"""
        return {
            "providers": [
                {
                    "name": entry["name"],
                    "available": entry["provider"].is_available(),
                }
                for entry in self.providers
            ],
            "active_provider": self.active_provider,
            "total_providers": len(self.providers),
            "has_ai": len(self.providers) > 0,
        }

    def build_tutor_system_prompt(
        self,
        topic: str,
        difficulty: str,
        cognitive_state: str,
        knowledge_context: str = "",
        teaching_style: str = "balanced",
    ) -> str:
        """
        Construye el system prompt pedagógico para el tutor IA.
        
        Este prompt convierte a la IA en un tutor especializado
        que usa el conocimiento curado (JSON) como fuente de verdad.
        """
        prompt = f"""Eres un tutor educativo especializado de la plataforma NeuroLearn AI.
Tu rol es enseñar de forma adaptativa a estudiantes de bachillerato en Colombia.

TEMA ACTUAL: {topic}
NIVEL DE DIFICULTAD: {difficulty}
ESTADO COGNITIVO DEL ESTUDIANTE: {cognitive_state}
ESTILO DE ENSEÑANZA: {teaching_style}

REGLAS PEDAGÓGICAS:
1. Adapta tu lenguaje al nivel del estudiante
2. Si el estudiante está en estado de FATIGA, simplifica y sé más breve
3. Si está en estado de DUDA, da más ejemplos y explicaciones
4. Si está en FLOW o MASTERY, puedes aumentar la complejidad
5. Si está en FRUSTRACIÓN, sé empático, da ánimos y simplifica
6. Si está en OVERLOAD, reduce la información y sugiere una pausa
7. Usa ejemplos del contexto colombiano cuando sea posible
8. Responde SIEMPRE en español
9. Sé conciso pero completo
10. Al final de cada respuesta, haz una pregunta para verificar comprensión

COMPORTAMIENTO SEGÚN ESTADO COGNITIVO:
- normal: Enseña normalmente con preguntas de verificación
- fatigue: Respuestas cortas, sugiere pausas, usa contenido más ligero
- overload: Simplifica mucho, una idea a la vez, ofrece descanso
- doubt: Más ejemplos, analogías, paso a paso detallado
- mastery: Desafíos avanzados, preguntas de pensamiento crítico
- flow: Mantén el ritmo, contenido progresivo, no interrumpas
- frustration: Empatía, simplifica, refuerza logros previos
- curiosity: Explora temas relacionados, datos curiosos, profundiza"""

        if knowledge_context:
            prompt += f"""

CONOCIMIENTO VERIFICADO (usa esto como fuente de verdad):
{knowledge_context}

IMPORTANTE: Basa tus respuestas en el conocimiento verificado anterior.
Puedes expandir con explicaciones naturales, pero la información base
debe provenir del contenido curado."""

        return prompt
