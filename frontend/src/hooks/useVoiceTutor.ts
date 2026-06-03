/**
 * useVoiceTutor — Tutor de Voz Interactivo en Tiempo Real
 *
 * Usa Web Speech API (nativa del navegador, sin costo):
 *  • SpeechRecognition  → STT: convierte lo que dice el usuario en texto
 *  • SpeechSynthesis    → TTS: el tutor responde hablando en voz alta
 *
 * Se activa automáticamente cuando cámara + micrófono están encendidos.
 */
import { useRef, useState, useCallback, useEffect } from 'react';

// ── Tipos de Web Speech API (no incluidos en lib.dom.d.ts estándar) ──────────
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

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface VoiceTutorState {
  isVoiceMode: boolean;       // modo tutor de voz activo
  isListening: boolean;       // STT escuchando activamente
  isSpeaking: boolean;        // TTS hablando ahora mismo
  liveTranscript: string;     // lo que el usuario está diciendo ahora (parcial)
  lastUserText: string;       // último texto confirmado del usuario
  lastBotText: string;        // último texto del bot que se está leyendo
  subtitlesEnabled: boolean;  // subtítulos visibles
  supported: boolean;         // Web Speech API disponible
}

export interface VoiceTutorControls extends VoiceTutorState {
  startVoiceMode: () => void;
  stopVoiceMode: () => void;
  toggleSubtitles: () => void;
  speakText: (text: string, onEnd?: () => void) => void;
  stopSpeaking: () => void;
  // Voces disponibles / selección
  availableVoices: () => Array<{ name: string; lang: string }>; 
  selectVoice: (name: string) => void;
}

// ── Helper: limpiar texto para TTS (quita markdown) ──────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1!')        // negrita → añade ! para énfasis
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/>\s/g, '')
    .replace(/\n\n+/g, '... ')              // párrafos → pausa larga
    .replace(/\n/g, ', ')                   // saltos de línea → pausa corta
    .replace(/([.!?])\s+/g, '$1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useVoiceTutor(
  onTranscript: (text: string) => void,  // callback cuando el usuario termina de hablar
): VoiceTutorControls {

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const synthRef       = useRef<SpeechSynthesis | null>(null);
  const silenceTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef      = useRef(false); // evita re-iniciar si ya está corriendo

  const [isVoiceMode,     setIsVoiceMode]     = useState(false);
  const [isListening,     setIsListening]     = useState(false);
  const [isSpeaking,      setIsSpeaking]      = useState(false);
  const [liveTranscript,  setLiveTranscript]  = useState('');
  const [lastUserText,    setLastUserText]     = useState('');
  const [lastBotText,     setLastBotText]      = useState('');
  const [subtitlesEnabled,setSubtitlesEnabled] = useState(true);
  const [voicesList, setVoicesList] = useState<Array<{ name: string; lang: string }>>([]);
  const selectedVoiceNameRef = useRef<string | null>(null);

  // Detectar soporte
  const SpeechRecognitionAPI =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const supported = !!(SpeechRecognitionAPI && window.speechSynthesis);

  // ── TTS: hablar ─────────────────────────────────────────────────────────────
  const speakText = useCallback((text: string, onEnd?: () => void) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // cortar cualquier audio anterior

    const clean = stripMarkdown(text);
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang   = 'es-BO';  // Bolivia — para que el navegador prefiera Sofía
    utterance.rate   = 1.12;
    utterance.pitch  = 1.3;
    utterance.volume = 1.0;

    // ── Selección de voz: Sofía de Bolivia primero, luego cualquier española ─
    const voices = window.speechSynthesis.getVoices();

    const chosen =
      // 1. Si el usuario eligió manualmente desde el selector
      (selectedVoiceNameRef.current ? voices.find(v => v.name === selectedVoiceNameRef.current) : undefined) ||
      // 2. Sofía — voz oficial Microsoft Bolivia (es-BO)
      voices.find(v => /sof[ií]a/i.test(v.name)) ||
      // 3. Cualquier voz es-BO
      voices.find(v => v.lang === 'es-BO') ||
      // 4. Cualquier voz en español
      voices.find(v => v.lang.startsWith('es')) ||
      // 5. Primera disponible
      voices[0];

    if (chosen) utterance.voice = chosen;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend   = () => {
      setIsSpeaking(false);
      onEnd?.();
      // Reanudar escucha después de que el tutor termina de hablar
      if (activeRef.current) _startListening();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      onEnd?.();
    };

    setLastBotText(clean.slice(0, 120) + (clean.length > 120 ? '…' : ''));
    synthRef.current = window.speechSynthesis;
    window.speechSynthesis.speak(utterance);
  }, []);

  // ── Gestión de voces: listar y seleccionar (expuesto al UI) ──────────────
  useEffect(() => {
    if (!window.speechSynthesis) return;
    const update = () => {
      const v = window.speechSynthesis.getVoices().map(s => ({ name: s.name, lang: s.lang }));
      setVoicesList(v);
      // seleccionar automáticamente la mejor voz femenina/española si no hay selección
      if (!selectedVoiceNameRef.current && v.length > 0) {
        const auto =
          // Sofía Bolivia — Microsoft Sofía es-BO
          v.find(x => /sof[ií]a/i.test(x.name) && x.lang === 'es-BO') ||
          v.find(x => /sof[ií]a/i.test(x.name) && x.lang.startsWith('es')) ||
          v.find(x => /sof[ií]a/i.test(x.name)) ||
          v.find(x => x.lang === 'es-BO') ||
          v.find(x => x.lang.startsWith('es')) ||
          v[0];
        if (auto) selectedVoiceNameRef.current = auto.name;
      }
    };
    update();
    window.speechSynthesis.onvoiceschanged = update;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  }, []);

  const availableVoices = useCallback(() => voicesList, [voicesList]);
  const selectVoice = useCallback((name: string) => {
    selectedVoiceNameRef.current = name;
  }, []);

  // ── STT: escuchar ───────────────────────────────────────────────────────────
  const _startListening = useCallback(() => {
    if (!SpeechRecognitionAPI || !activeRef.current) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* ok */ }
    }

    const recognition = new SpeechRecognitionAPI() as ISpeechRecognition;
    recognition.lang           = 'es-CO';
    recognition.continuous     = true;
    recognition.interimResults = true;
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
      setLiveTranscript(interim || finalText);

      // Reset silence timer cada vez que hay texto
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      if (finalText.trim()) {
        // Enviar después de 1.5s de silencio
        silenceTimer.current = setTimeout(() => {
          const trimmed = finalText.trim();
          if (trimmed && activeRef.current) {
            setLastUserText(trimmed);
            setLiveTranscript('');
            onTranscript(trimmed);
            // Pausar escucha mientras el bot habla
            recognition.stop();
          }
        }, 1500);
      }
    };

    recognition.onerror = (e: ISpeechRecognitionErrorEvent) => {
      if (e.error === 'no-speech') return; // silencio normal, ignorar
      console.warn('[VoiceTutor] STT error:', e.error);
      setIsListening(false);
      // Reintentar en 2s si el modo está activo
      if (activeRef.current) setTimeout(_startListening, 2000);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Si el modo sigue activo y no está hablando, reanudar
      if (activeRef.current && !window.speechSynthesis?.speaking) {
        setTimeout(_startListening, 500);
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch { /* ya corriendo */ }
  }, [onTranscript]);

  // ── Activar/Desactivar modo ─────────────────────────────────────────────────
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

  // Cleanup al desmontar
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
    availableVoices,
    selectVoice,
  };
}
