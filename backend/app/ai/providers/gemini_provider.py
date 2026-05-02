"""
NeuroLearn AI - Proveedor de IA: Google Gemini
API Gratuita: 1,500 peticiones/día
https://aistudio.google.com/
"""
import httpx
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)


class GeminiProvider:
    """Proveedor de IA usando Google Gemini (gratuito)"""

    BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models"

    def __init__(self, api_key: str, model: str = "gemini-2.0-flash"):
        self.api_key = api_key
        self.model = model

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 1024,
        context_messages: Optional[List[Dict]] = None,
    ) -> Optional[str]:
        """
        Genera una respuesta usando Google Gemini.
        
        Args:
            prompt: Mensaje del usuario
            system_prompt: Instrucciones del sistema
            temperature: Creatividad (0.0-1.0)
            max_tokens: Máximo de tokens en la respuesta
            context_messages: Historial de conversación previo
            
        Returns:
            Texto generado o None si falla
        """
        # Construir el contenido para Gemini
        contents = []

        # Agregar historial de contexto
        if context_messages:
            for msg in context_messages:
                role = "user" if msg["role"] == "user" else "model"
                contents.append({
                    "role": role,
                    "parts": [{"text": msg["content"]}],
                })

        # Agregar mensaje actual
        contents.append({
            "role": "user",
            "parts": [{"text": prompt}],
        })

        payload = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }

        # System instruction
        if system_prompt:
            payload["systemInstruction"] = {
                "parts": [{"text": system_prompt}]
            }

        url = f"{self.BASE_URL}/{self.model}:generateContent?key={self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                data = response.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts:
                        return parts[0].get("text", "")
                return None
        except httpx.TimeoutException:
            logger.warning("Gemini: Timeout en la petición")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"Gemini: Error HTTP {e.response.status_code}: {e.response.text}")
            return None
        except Exception as e:
            logger.warning(f"Gemini: Error inesperado: {e}")
            return None

    def is_available(self) -> bool:
        """Verifica si el proveedor está configurado"""
        return bool(self.api_key)
