"""
NeuroLearn AI - Proveedor de IA: Groq (Llama 3)
API Gratuita: 14,400 peticiones/día
https://console.groq.com/
"""
import httpx
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)


class GroqProvider:
    """Proveedor de IA usando Groq Cloud (Llama 3, gratuito)"""

    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str = "llama-3.1-8b-instant"):
        self.api_key = api_key
        self.model = model
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        context_messages: Optional[List[Dict]] = None,
    ) -> Optional[str]:
        """
        Genera una respuesta usando Groq (Llama 3).
        
        Args:
            prompt: Mensaje del usuario
            system_prompt: Instrucciones del sistema (rol del tutor)
            temperature: Creatividad (0.0-1.0)
            max_tokens: Máximo de tokens en la respuesta
            context_messages: Historial de conversación previo
            
        Returns:
            Texto generado o None si falla
        """
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Agregar historial de contexto
        if context_messages:
            messages.extend(context_messages)

        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    self.BASE_URL,
                    json=payload,
                    headers=self.headers,
                )
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
        except httpx.TimeoutException:
            logger.warning("Groq: Timeout en la petición")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"Groq: Error HTTP {e.response.status_code}: {e.response.text}")
            return None
        except Exception as e:
            logger.warning(f"Groq: Error inesperado: {e}")
            return None

    def is_available(self) -> bool:
        """Verifica si el proveedor está configurado"""
        return bool(self.api_key)
