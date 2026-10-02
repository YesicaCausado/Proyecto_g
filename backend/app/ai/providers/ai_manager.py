"""
NeuroLearn AI - Gestor de Proveedores de IA

Cadena de fallback (sin costo):
1. Groq (modelo configurable, por defecto openai/gpt-oss-120b)
2. Google Gemini (modelo configurable, por defecto gemini-3.6-flash)
3. Local: templates de respaldo (siempre funciona)

El conocimiento curado (JSON de los bots) se inyecta como contexto
en el system prompt, y la IA genera respuestas naturales basadas
en esa información verificada.
"""
import asyncio
import inspect
import json
import logging
from typing import Dict, List, Optional

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
        request_timeout: float = 20.0,
    ):
        self.providers: List[Dict] = []
        self.active_provider: Optional[str] = None
        self.request_timeout = request_timeout

        # Proveedor 1: Groq
        if groq_api_key:
            self.providers.append({
                "name": "groq",
                "provider": GroqProvider(api_key=groq_api_key, model=groq_model),
            })
            logger.info("Proveedor Groq registrado: %s", groq_model)

        # Proveedor 2: Google Gemini (respaldo gratuito)
        if gemini_api_key:
            self.providers.append({
                "name": "gemini",
                "provider": GeminiProvider(api_key=gemini_api_key, model=gemini_model),
            })
            logger.info("Proveedor Gemini registrado: %s", gemini_model)

        if not self.providers:
            logger.warning("Sin proveedores de IA. Se usara modo local unicamente.")

    # ------------------------------------------------------------------
    # Generación con fallback
    # ------------------------------------------------------------------
    async def _call_provider(self, provider, **kwargs) -> str:
        """
        Llama al proveedor con timeout. Si su método generate es síncrono,
        lo ejecuta en un hilo para no bloquear el event loop.
        """
        if inspect.iscoroutinefunction(provider.generate):
            coro = provider.generate(**kwargs)
        else:
            coro = asyncio.to_thread(provider.generate, **kwargs)
        return await asyncio.wait_for(coro, timeout=self.request_timeout)

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        context_messages: Optional[List[Dict]] = None,
        expect_json: bool = False,
    ) -> Dict:
        """
        Genera una respuesta usando la cadena de proveedores:
        Groq -> Gemini -> respuesta local.

        Ningún error de un proveedor rompe el flujo del chat.

        Args:
            expect_json: True si el llamador espera un JSON (p. ej. un quiz).
                Solo afecta al fallback local.

        Returns:
            {
                "response": str,
                "provider": "groq" | "gemini" | "local",
                "fallback_used": bool,  # True si NO respondió el primer
                                        # proveedor configurado
            }
        """
        for i, entry in enumerate(self.providers):
            name = entry["name"]
            provider = entry["provider"]

            # 1. Disponibilidad
            try:
                if not provider.is_available():
                    logger.warning("Proveedor %s no disponible.", name)
                    continue
            except Exception:
                logger.exception("Error comprobando disponibilidad de %s", name)
                continue

            logger.info("Intentando con proveedor: %s", name)

            # 2. Generación
            try:
                response = await self._call_provider(
                    provider,
                    prompt=prompt,
                    system_prompt=system_prompt,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    context_messages=context_messages,
                )

                if response and response.strip():
                    self.active_provider = name
                    logger.info("Proveedor %s respondio correctamente.", name)
                    return {
                        "response": response.strip(),
                        "provider": name,
                        "fallback_used": i > 0,
                    }

                logger.warning("Proveedor %s devolvio una respuesta vacia.", name)

            except asyncio.TimeoutError:
                logger.warning(
                    "Proveedor %s excedio el timeout de %ss.",
                    name, self.request_timeout,
                )
            except Exception:
                # No relanzamos: continuamos con el siguiente proveedor.
                logger.exception("Error ejecutando proveedor %s", name)

        # 3. Fallback local
        logger.warning("Todos los proveedores externos fallaron. Activando respuesta local.")

        try:
            local_text = self._generate_local_response(
                prompt, system_prompt, expect_json=expect_json
            )
        except Exception:
            logger.exception("Error generando respuesta local")
            local_text = (
                "🤖 En este momento no pude procesar tu mensaje. "
                "Puedes intentarlo nuevamente en unos segundos."
            )

        self.active_provider = "local"
        return {
            "response": local_text,
            "provider": "local",
            "fallback_used": True,
        }

    def _generate_local_response(
        self,
        prompt: str,
        system_prompt: str = "",
        expect_json: bool = False,
    ) -> str:
        """
        Respuesta local de respaldo cuando todos los proveedores fallan
        o no están configurados. No inventa datos: reconoce que no hay
        conexión con el motor de IA y pide al estudiante que continúe
        escribiendo con normalidad.
        """
        # Si el llamador espera JSON (quiz), devolvemos un template válido.
        if expect_json:
            quiz = {
                "questions": [
                    {
                        "id": 1,
                        "question": "Explica con tus propias palabras el concepto principal de este tema.",
                        "options": [
                            "No lo sé aún",
                            "Puedo intentarlo",
                            "Lo tengo claro, déjame explicarlo",
                        ],
                        "answer": "Lo tengo claro, déjame explicarlo",
                        "explanation": "Esta es una pregunta de diagnóstico: responde según lo que recuerdes.",
                    }
                ]
            }
            return json.dumps(quiz, ensure_ascii=False)

        # Recuperamos el tema desde el system prompt para personalizar.
        topic = ""
        for line in (system_prompt or "").splitlines():
            if line.startswith("TEMA ACTUAL:"):
                topic = line.split(":", 1)[1].strip()
                break

        if topic:
            return (
                f"📚 Quiero ayudarte con **{topic}**, pero ahora mismo no "
                f"tengo conexión con el motor de IA.\n\n"
                f"Mientras se restablece, puedes:\n"
                f"1️⃣ Contarme con tus palabras qué sabes ya sobre este tema.\n"
                f"2️⃣ Escribirme tu duda concreta y la retomo apenas pueda.\n"
                f"3️⃣ Repasar tus apuntes y volver a intentarlo en unos segundos.\n\n"
                f"Volveré a conectarme automáticamente en tu próximo mensaje. 😊"
            )

        return (
            "🤖 En este momento no tengo conexión con el motor de IA, pero "
            "estoy listo para retomar en tu próximo mensaje.\n\n"
            "Mientras tanto, cuéntame qué tema estás estudiando o qué "
            "pregunta tienes y te ayudaré en cuanto pueda."
        )

    # ------------------------------------------------------------------
    # Estado
    # ------------------------------------------------------------------
    def get_status(self) -> Dict:
        """Retorna el estado de todos los proveedores sin romperse si uno falla."""
        providers_status = []
        for entry in self.providers:
            try:
                available = bool(entry["provider"].is_available())
            except Exception:
                logger.exception("Error comprobando estado de %s", entry["name"])
                available = False
            providers_status.append({"name": entry["name"], "available": available})

        return {
            "providers": providers_status,
            "active_provider": self.active_provider,
            "total_providers": len(self.providers),
            "has_ai": len(self.providers) > 0,
        }

    # ------------------------------------------------------------------
    # System prompt pedagógico
    # ------------------------------------------------------------------
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
10. Al final de cada respuesta, haz una pregunta breve para verificar comprensión,
    EXCEPTO en estado FLOW, donde solo preguntas si es natural y no rompe el ritmo

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