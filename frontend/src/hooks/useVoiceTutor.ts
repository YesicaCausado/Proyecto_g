/**
 * useVoiceTutor — Tutor de Voz Interactivo en Tiempo Real
 *
 * Usa Web Speech API (nativa del navegador, sin costo):
 *  • SpeechRecognition  → STT: convierte lo que dice el usuario en texto
 *  • SpeechSynthesis    → TTS: el tutor responde hablando en voz alta
 *
 * Voz fija: Sofía (es-BO) — sin selector de voces en el frontend.
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
  const [subtitlesEnabled, setSubtitlesEnabled]  = useState(true);

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

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) return;

    // ★ CRÍTICO: detener STT antes de hablar para evitar auto-escucha (feedback loop)
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch { /* ok */ }
      recognitionRef.current = null;
    }
    setIsListening(false);
    ttsActiveRef.current = true;

    window.speechSynthesis.cancel();

    const clean = stripMarkdown(text);
    if (!clean) { ttsActiveRef.current = false; return; }

    const isEn = languageRef.current === 'en';
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang   = isEn ? 'en-US' : 'es-BO';
    utterance.rate   = 1.1;
    utterance.pitch  = isEn ? 1.1 : 1.3;
    utterance.volume = 1.0;

    const voice = isEn ? pickEnglishVoice() : pickSofiaVoice();
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => {
      ttsActiveRef.current = false;
      setIsSpeaking(false);
      onEnd?.();
      // Reanudar STT solo si el modo voz sigue activo (con delay para que el eco se disipe)
      if (activeRef.current) setTimeout(_startListening, 900);
    };
    utterance.onerror = () => {
      ttsActiveRef.current = false;
      setIsSpeaking(false);
      onEnd?.();
    };

    setLastBotText(clean.slice(0, 140) + (clean.length > 140 ? '…' : ''));
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.speak(utterance);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
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

  // Cleanup
  useEffect(() => {
    return () => {
      activeRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, []);

  return {
    isVoiceMode,
    isListening,
    isSpeaking,
    liveTranscript,
    lastUserText,
    lastBotText,
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
