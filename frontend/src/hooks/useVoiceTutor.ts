/**
 * useVoiceTutor — Tutor de Voz con Azure Neural TTS + Web Speech STT
 *
 * TTS: Azure Cognitive Services Speech (voces neurales de alta calidad)
 *      Fallback automático a Web Speech API si Azure no está configurado.
 * STT: Web Speech API (SpeechRecognition) — nativa del navegador, gratuita.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

// ── Tipos de Web Speech API ──────────────────────────────────────────────────
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend:   ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => void) | null;
  onerror:  ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => void) | null;
}
interface ISpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: ISpeechRecognitionResultList;
}
interface ISpeechRecognitionResultList {
  length: number;
  [index: number]: ISpeechRecognitionResult;
}
interface ISpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: ISpeechRecognitionAlternative;
}
interface ISpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface ISpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// ── Tipos exportados ─────────────────────────────────────────────────────────
export interface VoiceTutorState {
  isVoiceMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  liveTranscript: string;
  lastUserText: string;
  lastBotText: string;
  /** Subtítulo progresivo: se actualiza palabra a palabra mientras el TTS habla */
  subtitleProgress: string;
  subtitlesEnabled: boolean;
  supported: boolean;
}

export interface VoiceTutorControls extends VoiceTutorState {
  startVoiceMode: () => void;
  stopVoiceMode: () => void;
  toggleSubtitles: () => void;
  speakText: (text: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  /** Push-to-talk: pulsa → empieza, suelta → envía transcript */
  startPTT: () => void;
  stopPTT: () => void;
  /** Cambia el idioma del TTS (afecta selección de voz y lang) */
  setLanguage: (lang: 'es' | 'en') => void;
}

// ── Limpia markdown para TTS ─────────────────────────────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1!')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/>\s/g, '')
    .replace(/\n\n+/g, '... ')
    .replace(/\n/g, ', ')
    .replace(/([.!?])\s+/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    // Quitar emojis para que el TTS no los pronuncie
    .replace(/(\ud83c[\udf00-\udfff]|\ud83d[\udc00-\ude4f]|\ud83d[\ude80-\udeff]|\ud83e[\udd00-\uddff]|[\u2600-\u27bf]|[\u2b00-\u2bff]|\ufe0f)/g, '')
    .trim();
}

// ── Detecta el idioma predominante del texto ──────────────────────────────────
function detectLanguage(text: string): 'es' | 'en' {
  const esMatches = (text.match(/\b(el|la|los|las|de|que|en|y|a|es|un|una|por|con|para|como|más|pero|no|se|su|al|del|esto|este|esta|son|fue|hay|si|ya|también|muy|todo|cuando|donde|porque|bien|después|antes|desde|sobre|entre|hasta|sin|cada|solo|otro|puede|tiene|qué|cómo|dónde|cuándo|quién|cual|si|yo|tú|él|ella|nosotros|vamos|hacer|saber|ver|dar|decir|ir|tener|estar|haber|poder|querer|saber|llegar|pasar|deber|poner|parecer|quedar|creer|llevar|dejar|seguir|encontrar|llamar|venir|pensar|salir|volver|tomar|conocer|vivir|sentir|tratar|mirar|contar|empezar|esperar|buscar|existir|entrar|trabajar|escribir|perder|producir|ocurrir|entender|pedir|recibir|recordar|terminar|permitir|aparecer|conseguir|comenzar|servir|sacar|necesitar|mantener|resultar|leer|caer|cambiar|presentar|crear|abrir|considerar|oír|puede|tiene|hace|dice|sabe)\b/gi) || []).length;
  const enMatches = (text.match(/\b(the|a|an|and|or|but|in|on|at|to|for|of|with|by|from|is|are|was|were|be|been|have|has|had|do|does|did|will|would|could|should|this|that|these|those|i|you|he|she|it|we|they|not|can|what|when|where|who|how|if|then|so|all|some|more|also|just|like|get|make|know|think|see|look|use|find|go|say|take|come|time|good|new|first|last|great|important|between|without|about|after|before|during|through|because|which|while|although|however|therefore|thus)\b/gi) || []).length;
  return enMatches > esMatches ? 'en' : 'es';
}

// ── Selecciona voz Sofía de Bolivia (español) ─────────────────────────────────
function pickSofiaVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const isFemale = (v: SpeechSynthesisVoice) =>
    /female|mujer|woman|femenin|sof[ií]a|salom[eé]|m[oó]nica|luc[ií]a|paulina|helena|laura|sabina/i.test(v.name);
  return (
    voices.find(v => /sof[ií]a/i.test(v.name) && v.lang === 'es-BO') ||
    voices.find(v => /sof[ií]a/i.test(v.name) && v.lang.startsWith('es')) ||
    voices.find(v => /sof[ií]a/i.test(v.name)) ||
    voices.find(v => v.lang.startsWith('es') && isFemale(v)) ||
    voices.find(v => v.lang === 'es-BO') ||
    voices.find(v => v.lang.startsWith('es')) ||
    voices[0] || null
  );
}

// ── Selecciona voz inglesa natural ────────────────────────────────────────────
function pickEnglishVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => /zira|aria|natasha|samantha|karen|moira|tessa|siri/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US' && /female|woman/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-GB' && /female|woman/i.test(v.name)) ||
    voices.find(v => v.lang === 'en-US') ||
    voices.find(v => v.lang.startsWith('en')) ||
    null
  );
}

// ── Azure TTS ─────────────────────────────────────────────────────────────────
// Claves configuradas en frontend/.env.local  o  Vercel Environment Variables
const AZURE_KEY    = import.meta.env.VITE_AZURE_SPEECH_KEY    as string | undefined;
const AZURE_REGION = (import.meta.env.VITE_AZURE_SPEECH_REGION as string) || 'eastus';

// Voces neurales de Azure: naturales, sin robótica
const AZURE_VOICES: Record<'es' | 'en', { name: string; lang: string }> = {
  es: { name: 'es-ES-IreneNeural',   lang: 'es-ES' },  // España, femenino
  en: { name: 'en-US-JennyNeural',   lang: 'en-US' },  // US English, femenino
};

/** Sintetiza texto con Azure TTS y devuelve el HTMLAudioElement listo para reproducir */
async function azureSynth(text: string, lang: 'es' | 'en'): Promise<HTMLAudioElement | null> {
  if (!AZURE_KEY) return null;
  const { name, lang: xmlLang } = AZURE_VOICES[lang];
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='${xmlLang}'>` +
    `<voice name='${name}'><prosody rate='1.05'>${escaped}</prosody></voice></speak>`;
  try {
    const res = await fetch(
      `https://${AZURE_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-160kbitrate-mono-mp3',
        },
        body: ssml,
      },
    );
    if (!res.ok) {
      console.warn(`[Azure TTS] Error ${res.status}:`, await res.text().catch(() => ''));
      return null;
    }
    const url   = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    // Liberar la URL de objeto cuando el audio termine
    const cleanup = () => URL.revokeObjectURL(url);
    audio.addEventListener('ended',  cleanup, { once: true });
    audio.addEventListener('error',  cleanup, { once: true });
    return audio;
  } catch (err) {
    console.warn('[Azure TTS] fetch error:', err);
    return null;
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useVoiceTutor(
  onTranscript: (text: string) => void,
): VoiceTutorControls {

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef       = useRef<SpeechSynthesis | null>(null);
  const silenceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef      = useRef(false);
  const ttsActiveRef   = useRef(false);   // true mientras el TTS está hablando → STT NO escucha
  const languageRef    = useRef<'es' | 'en'>('es'); // idioma actual del tutor

  const [isVoiceMode,      setIsVoiceMode]      = useState(false);
  const [isListening,      setIsListening]      = useState(false);
  const [isSpeaking,       setIsSpeaking]       = useState(false);
  const [liveTranscript,   setLiveTranscript]   = useState('');
  const [lastUserText,     setLastUserText]      = useState('');
  const [lastBotText,      setLastBotText]       = useState('');
  const [subtitleProgress, setSubtitleProgress] = useState('');
  const [subtitlesEnabled, setSubtitlesEnabled]  = useState(true);
  const subtitleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioRef         = useRef<HTMLAudioElement | null>(null); // elemento Audio de Azure

  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const supported = !!(SpeechRecognitionAPI && window.speechSynthesis);

  // Precargar voces al montar (el navegador las carga de forma asíncrona)
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => { window.speechSynthesis.getVoices(); };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  // ── TTS (Azure Neural → Web Speech fallback) ────────────────────────────────
  const speakText = useCallback((text: string, onEnd?: () => void) => {
    // 1. Detener STT para evitar auto-escucha
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ok */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    ttsActiveRef.current = true;

    // 2. Detener TTS previo (Web Speech + Azure)
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    // 3. Limpiar subtítulos
    if (subtitleTimerRef.current) { clearInterval(subtitleTimerRef.current); subtitleTimerRef.current = null; }
    setSubtitleProgress('');

    const clean = stripMarkdown(text);
    if (!clean) { ttsActiveRef.current = false; return; }

    // 4. Auto-detectar idioma → voz correcta automáticamente
    const detectedLang = detectLanguage(clean);
    languageRef.current = detectedLang;
    const isEn = detectedLang === 'en';
    setLastBotText(clean.slice(0, 140) + (clean.length > 140 ? '…' : ''));

    // 5. Subtítulos progresivos (estimación WPM)
    const words    = clean.split(' ').filter(Boolean);
    const msPerWord = 60000 / (isEn ? 165 : 150);
    let wordIdx = 0;
    const startSubtitles = () => {
      subtitleTimerRef.current = setInterval(() => {
        wordIdx = Math.min(wordIdx + 2, words.length);
        setSubtitleProgress(words.slice(0, wordIdx).join(' '));
        if (wordIdx >= words.length) {
          clearInterval(subtitleTimerRef.current!);
          subtitleTimerRef.current = null;
        }
      }, msPerWord * 2);
    };

    // 6. Handler unificado de fin
    const handleEnd = () => {
      if (subtitleTimerRef.current) { clearInterval(subtitleTimerRef.current); subtitleTimerRef.current = null; }
      setSubtitleProgress('');
      ttsActiveRef.current = false;
      setIsSpeaking(false);
      audioRef.current = null;
      onEnd?.();
      if (activeRef.current) setTimeout(_startListening, 900);
    };

    // 7. Web Speech como respaldo
    function useWebSpeech() {
      if (!window.speechSynthesis) { handleEnd(); return; }
      const utterance  = new SpeechSynthesisUtterance(clean);
      utterance.lang   = isEn ? 'en-US' : 'es-BO';
      utterance.rate   = 1.1;
      utterance.pitch  = isEn ? 1.1 : 1.3;
      utterance.volume = 1.0;
      const voice = isEn ? pickEnglishVoice() : pickSofiaVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { setIsSpeaking(true); startSubtitles(); };
      utterance.onend   = handleEnd;
      utterance.onerror = handleEnd;
      synthRef.current  = window.speechSynthesis;
      window.speechSynthesis.speak(utterance);
    }

    // 8. Azure TTS (principal) → Web Speech (fallback)
    if (AZURE_KEY) {
      azureSynth(clean, detectedLang).then(audio => {
        if (!audio) { useWebSpeech(); return; }
        audioRef.current = audio;
        audio.onended = () => { if (audioRef.current === audio) handleEnd(); };
        audio.onerror = () => { if (audioRef.current === audio) handleEnd(); };
        setIsSpeaking(true);
        startSubtitles();
        audio.play().catch(() => handleEnd());
      });
      return;
    }
    useWebSpeech();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (subtitleTimerRef.current) { clearInterval(subtitleTimerRef.current); subtitleTimerRef.current = null; }
    setSubtitleProgress('');
    ttsActiveRef.current = false;
    setIsSpeaking(false);
  }, []);

  // ── STT ──────────────────────────────────────────────────────────────────────
  const _startListening = useCallback(() => {
    if (!SpeechRecognitionAPI || !activeRef.current) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ok */ }
    }

    const recognition = new SpeechRecognitionAPI() as ISpeechRecognition;
    recognition.lang            = 'es-BO';
    recognition.continuous      = true;
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      // Mostrar transcripción en vivo en el input
      setLiveTranscript(interim || finalText);

      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (finalText.trim()) {
        // Enviar tras 1.5 s de silencio
        silenceTimer.current = setTimeout(() => {
          const trimmed = finalText.trim();
          if (trimmed && activeRef.current) {
            setLastUserText(trimmed);
            setLiveTranscript('');
            onTranscript(trimmed);
            recognition.stop();
          }
        }, 1500);
      }
    };

    recognition.onerror = (e: ISpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return;
      console.warn('[VoiceTutor] STT error:', e.error);
      setIsListening(false);
      if (activeRef.current) setTimeout(_startListening, 2000);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Solo reanudar si el modo está activo Y el TTS NO está hablando
      if (activeRef.current && !ttsActiveRef.current && !window.speechSynthesis?.speaking) {
        setTimeout(_startListening, 800);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* ya corriendo */ }
  }, [onTranscript]);

  // ── Activar / Desactivar modo voz ────────────────────────────────────────────
  const startVoiceMode = useCallback(() => {
    if (!supported) return;
    activeRef.current = true;
    setIsVoiceMode(true);
    setLiveTranscript('');
    setLastUserText('');
    setLastBotText('');
    _startListening();
  }, [supported, _startListening]);

  const stopVoiceMode = useCallback(() => {
    activeRef.current = false;
    setIsVoiceMode(false);
    setIsListening(false);
    setIsSpeaking(false);
    setLiveTranscript('');
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  const toggleSubtitles = useCallback(() => setSubtitlesEnabled(v => !v), []);

  const setLanguage = useCallback((lang: 'es' | 'en') => {
    languageRef.current = lang;
  }, []);

  // ── Push-to-talk (Modo Live) ──────────────────────────────────────────────
  const startPTT = useCallback(() => {
    // Detener TTS si estaba hablando (usuario interrumpe al tutor)
    if (ttsActiveRef.current || window.speechSynthesis?.speaking) {
      window.speechSynthesis?.cancel();
      ttsActiveRef.current = false;
      setIsSpeaking(false);
    }
    if (!SpeechRecognitionAPI) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ok */ }
    }
    const recognition = new SpeechRecognitionAPI() as ISpeechRecognition;
    recognition.lang            = 'es-BO';
    recognition.continuous      = false;  // una sola frase por pulsación
    recognition.interimResults  = true;
    recognition.maxAlternatives = 1;

    let captured = '';

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: ISpeechRecognitionEvent) => {
      let interim = '';
      captured = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) captured += t;
        else interim += t;
      }
      setLiveTranscript(interim || captured);
    };

    recognition.onend = () => {
      setIsListening(false);
      setLiveTranscript('');
      const trimmed = captured.trim();
      if (trimmed) {
        setLastUserText(trimmed);
        onTranscript(trimmed);
      }
    };

    recognition.onerror = (e: ISpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return;
      setIsListening(false);
      setLiveTranscript('');
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* ya corriendo */ }
  }, [onTranscript]);

  const stopPTT = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (subtitleTimerRef.current) clearInterval(subtitleTimerRef.current);
    };
  }, []);

  return {
    isVoiceMode,
    isListening,
    isSpeaking,
    liveTranscript,
    lastUserText,
    lastBotText,
    subtitleProgress,
    subtitlesEnabled,
    supported,
    startVoiceMode,
    stopVoiceMode,
    toggleSubtitles,
    speakText,
    stopSpeaking,
    startPTT,
    stopPTT,
    setLanguage,
  };
}
