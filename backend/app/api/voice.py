"""
NeuroLearn IA — Voz del tutor (Azure Speech) a través del servidor.

    POST /api/v1/voice/tts   {text, lang: "es"|"en"}  →  audio/mpeg

Antes el navegador llamaba directamente a Azure con la clave en
VITE_AZURE_SPEECH_KEY, así que cualquiera podía verla en las herramientas de
desarrollo y usarla. Ahora la clave solo existe en el servidor. Si Azure no
está configurado o falla, responde 503 y el navegador usa su propia voz
(Web Speech API), como antes.
"""
from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from typing import Deque, Dict, Literal
from xml.sax.saxutils import escape

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.api.auth import get_current_user
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice", tags=["Voz del tutor"])

VOICES = {
    "es": ("es-ES-IreneNeural", "es-ES"),
    "en": ("en-US-JennyNeural", "en-US"),
}

# Límite por usuario: protege la cuota de Azure si alguien abusa del endpoint.
MAX_REQUESTS_PER_MINUTE = 30
_recent: Dict[int, Deque[float]] = defaultdict(deque)


def _allowed(user_id: int) -> bool:
    now = time.monotonic()
    q = _recent[user_id]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= MAX_REQUESTS_PER_MINUTE:
        return False
    q.append(now)
    return True


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1500)
    lang: Literal["es", "en"] = "es"


def build_ssml(text: str, lang: str) -> str:
    name, xml_lang = VOICES[lang]
    return (
        f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{xml_lang}'>"
        f"<voice name='{name}'><prosody rate='1.05'>"
        f"{escape(text, {chr(39): '&apos;', chr(34): '&quot;'})}"
        f"</prosody></voice></speak>"
    )


@router.post("/tts")
async def text_to_speech(
    data: TTSRequest,
    current_user: User = Depends(get_current_user),
):
    if not settings.AZURE_SPEECH_KEY:
        raise HTTPException(status_code=503, detail="La voz de Azure no está configurada.")
    if not _allowed(current_user.id):
        raise HTTPException(status_code=429, detail="Demasiadas solicitudes de voz. Espera un momento.")
    url = f"https://{settings.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1"
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, content=build_ssml(data.text.strip(), data.lang).encode("utf-8"), headers={
                "Ocp-Apim-Subscription-Key": settings.AZURE_SPEECH_KEY,
                "Content-Type": "application/ssml+xml",
                "X-Microsoft-OutputFormat": "audio-24khz-160kbitrate-mono-mp3",
                "User-Agent": "NeuroLearn",
            })
    except httpx.HTTPError as exc:
        logger.warning("Azure TTS no respondió: %s", exc)
        raise HTTPException(status_code=503, detail="El servicio de voz no respondió.")
    if r.status_code != 200:
        logger.warning("Azure TTS devolvió %s", r.status_code)
        raise HTTPException(status_code=503, detail="El servicio de voz no está disponible.")
    return Response(content=r.content, media_type="audio/mpeg", headers={"Cache-Control": "no-store"})
