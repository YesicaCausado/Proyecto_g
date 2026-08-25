"""
NeuroLearn AI - Proveedor de IA: Groq
API Gratuita: 14,400 peticiones/día
https://console.groq.com/

Límites de tokens por minuto (TPM) según modelo:
  openai/gpt-oss-120b       →  modelo chat principal de Groq Cloud (JSON estable)
  (los modelos llama-3.1-8b-instant y qwen3-32b fueron retirados de Groq)

La clase reintenta automáticamente 1 vez si recibe 429,
esperando el tiempo indicado por Retry-After (máx. 8 s).
"""
import asyncio
import re
import httpx
from typing import Optional, List, Dict
import logging

logger = logging.getLogger(__name__)


class GroqProvider:
    """Proveedor de IA usando Groq Cloud (Llama 3, gratuito)"""

    BASE_URL = "https://api.groq.com/openai/v1/chat/completions"

    def __init__(self, api_key: str, model: str = "openai/gpt-oss-120b"):
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
        Genera una respuesta usando Groq (Llama 3 / GPT-OSS).
        
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

                # --- Retry automático si hay rate-limit (429) ---
                if response.status_code == 429:
                    # Groq indica cuántos ms esperar en el mensaje de error
                    retry_after = 1.0  # default 1 segundo
                    try:
                        err_msg = response.json().get("error", {}).get("message", "")
                        m = re.search(r"try again in (\d+(?:\.\d+)?)(\w+)", err_msg, re.I)
                        if m:
                            val = float(m.group(1))
                            unit = m.group(2).lower()
                            retry_after = val / 1000 if "ms" in unit else val
                            retry_after = min(retry_after + 0.2, 8.0)  # máx 8 s
                    except Exception:
                        pass
                    logger.warning(f"Groq 429 ({self.model}): esperando {retry_after:.1f}s y reintentando...")
                    await asyncio.sleep(retry_after)
                    response = await client.post(
                        self.BASE_URL,
                        json=payload,
                        headers=self.headers,
                    )

                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                # Los modelos de razonamiento (p.ej. qwen3) anteponen un bloque
                # grande de "thinking" al contenido real. Ese bloque no es JSON
                # utilizable y además roba los tokens de salida, así que lo
                # descartamos y nos quedamos con la parte final del texto, que
                # es la respuesta real (el JSON estructurado).
                if content and " thinking" in content:
                    _parts = content.split(" thinking", 1)[1] if content.startswith(" thinking") else content
                    # Si el modelo cierra su pensamiento con la marca "response",
                    # nos quedamos con lo que aparece a partir de ese cierre.
                    _after_response = re.split(r"\bresponse\b", _parts, flags=re.I)
                    if len(_after_response) > 1:
                        _parts = _after_response[-1]
                    content = _parts.strip()
                return content or None

        except httpx.TimeoutException:
            logger.warning(f"Groq ({self.model}): Timeout en la petición")
            return None
        except httpx.HTTPStatusError as e:
            logger.warning(f"Groq ({self.model}): Error HTTP {e.response.status_code}: {e.response.text}")
            return None
        except Exception as e:
            logger.warning(f"Groq ({self.model}): Error inesperado: {e}")
            return None

    def is_available(self) -> bool:
        """Verifica si el proveedor está configurado"""
        return bool(self.api_key)