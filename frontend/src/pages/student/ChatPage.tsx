import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { demoStartSession, demoSendMessage } from "../../services/demoChat";
import type { ChatMessage, ChatMessageResponse } from "../../types";
import { Send, Loader2, Brain, BarChart2, X, Camera, CameraOff, Mic, MicOff, Captions } from "lucide-react";
import { useBehavioralMetrics } from "../../hooks/useBehavioralMetrics";
import { useFacialDetection } from "../../hooks/useFacialDetection";
import { useVoiceProsody } from "../../hooks/useVoiceProsody";
import { useVoiceTutor } from "../../hooks/useVoiceTutor";
import CognitiveDashboard from "../../components/CognitiveDashboard";
import type { VRMTutorHandle, CognitiveEmotion } from "../../components/VRMTutor";
import LiveModeView from "../../components/LiveModeView";
import QuizPanel, { parseQuizFromMessage, type QuizData } from "../../components/QuizPanel";
import BotMessageWithActions from "../../components/BotMessageWithActions";

function VideoPreview({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const previewRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const src = videoRef.current?.srcObject;
    if (previewRef.current && src) {
      previewRef.current.srcObject = src as MediaStream;
      previewRef.current.play().catch(() => {/* autoplay blocked, ok */});
    }
  }, [videoRef]);
  return (
    <video
      ref={previewRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover scale-x-[-1]" // espejo como selfie
    />
  );
}

const SKILLS = [
  { key: "matematicas", name: "Pensamiento Lógico-Matemático", topic: "Razonamiento cuantitativo y matemáticas para Saber 11", icon: "🧮", color: "from-[#0B6E99] to-[#0B6E99]" },
  { key: "lectora",     name: "Comprensión Lectora",           topic: "Comprensión lectora y lectura crítica para Saber 11",  icon: "📖", color: "from-[#D9730D] to-[#D9730D]" },
  { key: "ingles",      name: "Inglés Comunicativo",           topic: "Competencia comunicativa en inglés para Saber 11",     icon: "🌎", color: "from-[#0F7B6C] to-[#0F7B6C]" },
  { key: "ciudadanas",  name: "Competencias Ciudadanas",       topic: "Competencias ciudadanas y sociales para Saber 11",     icon: "🏛️", color: "from-[#6940A5] to-[#6940A5]" },
  { key: "cientifico",  name: "Pensamiento Científico",        topic: "Pensamiento científico y ciencias naturales para Saber 11", icon: "🔬", color: "from-cyan-500 to-teal-600" },
];

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  normal:      { label: "Normal",      color: "bg-[#F7F6F3] text-[#787774]" },
  fatigue:     { label: "Fatiga",      color: "bg-[#FCF6E5] text-[#DFAB01]" },
  overload:    { label: "Sobrecarga",  color: "bg-[#FDEEEE] text-[#E03E3E]" },
  doubt:       { label: "Duda",        color: "bg-[#FCF6E5] text-[#DFAB01]" },
  mastery:     { label: "Dominio",     color: "bg-[#EEF7F4] text-[#0F7B6C]" },
  flow:        { label: "Flujo ✨",    color: "bg-[#E5F3FF] text-[#0B6E99]" },
  frustration: { label: "Frustración", color: "bg-[#FDEEEE] text-[#E03E3E]" },
  curiosity:   { label: "Curiosidad",  color: "bg-[#F4EFFB] text-[#6940A5]" },
  focused:     { label: "Enfocado",    color: "bg-[#EEF7F4] text-[#0F7B6C]" },
  learning:    { label: "Aprendiendo", color: "bg-[#E5F3FF] text-[#0B6E99]" },
  struggling:  { label: "Dificultad",  color: "bg-[#FCF6E5] text-[#DFAB01]" },
  confused:    { label: "Confundido",  color: "bg-[#FDEEEE] text-[#E03E3E]" },
  mastering:   { label: "Dominando",   color: "bg-[#EEF7F4] text-[#0F7B6C]" },
};

// ─── Preguntas sugeridas para pantalla inicial ────────────────────────────────
const SUGGESTED_QUESTIONS = [
  { text: "Explícame ecuaciones cuadráticas",      icon: "📐", skill: "matematicas" },
  { text: "¿Cómo analizar un texto crítico?",       icon: "📖", skill: "lectora"     },
  { text: "Conceptos de química orgánica",          icon: "🔬", skill: "cientifico"  },
  { text: "¿Qué es la democracia participativa?",   icon: "🏛️", skill: "ciudadanas"  },
  { text: "How do I improve my English grammar?",   icon: "🌎", skill: "ingles"      },
];

// Detecta la materia más probable a partir del texto libre del usuario
const detectSkillFromText = (text: string): string => {
  const t = text.toLowerCase();
  if (/matemátic|álgebra|geometr|ecuaci|función|calcul|número|trigono|estadíst|probabil|fraccion|exponente/.test(t)) return "matematicas";
  if (/texto|leer|lectura|párrafo|crítica|literario|comprens|analiz|argum|discurso|narrat|ensayo/.test(t)) return "lectora";
  if (/english|inglés|grammar|vocabulary|speaking|writing|pronunci|verb|tense|present|past/.test(t)) return "ingles";
  if (/química|físic|biolog|ciencias|átomo|célula|ecosistem|energía|mol|organ|reacción|fuerza/.test(t)) return "cientifico";
  if (/social|ciudadan|democraci|histori|colombia|polític|gobierno|derecho|económ/.test(t)) return "ciudadanas";
  return "matematicas";
};

export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const skillParam    = searchParams.get("skill");
  const botIdParam    = searchParams.get("bot_id");
  const botNameParam  = searchParams.get("bot_name");

  // If bot_id is present (teacher testing their own bot), start directly
  const isCustomBot = !!botIdParam;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [prevInput, setPrevInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(skillParam || "");
  const [lastResponse, setLastResponse] = useState<ChatMessageResponse | null>(null);
  const [showDashboard, setShowDashboard] = useState(!isCustomBot);
  const [quizSuggested, setQuizSuggested] = useState(false);
  const [freeInput, setFreeInput] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const vrmRef = useRef<VRMTutorHandle>(null);
  const [showLiveMode, setShowLiveMode] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const metrics = useBehavioralMetrics();
  const facial = useFacialDetection();
  const voice = useVoiceProsody();

  // Tutor de Voz — STT escucha al usuario, TTS responde en voz alta
  const voiceTutor = useVoiceTutor(async (transcript) => {
    if (!transcript.trim() || sending) return;
    setInput(transcript);
    await sendMessageWithText(transcript);
  });

  // Cambiar idioma del tutor según la habilidad (inglés → voz en inglés)
  useEffect(() => {
    voiceTutor.setLanguage(selectedSkill === 'ingles' ? 'en' : 'es');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSkill]);

  // Auto-activar modo voz cuando el micrófono está activo
  useEffect(() => {
    if (!voiceTutor.supported || !sessionActive) return;
    if (voice.isStreaming && !voiceTutor.isVoiceMode) {
      voiceTutor.startVoiceMode();
    } else if (!voice.isStreaming && voiceTutor.isVoiceMode) {
      voiceTutor.stopVoiceMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice.isStreaming, sessionActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (skillParam && !sessionActive) setSelectedSkill(skillParam);
  }, [skillParam]);

  // Auto-start when coming from teacher "Probar" button (?bot_id=...)
  useEffect(() => {
    if (botIdParam && !sessionActive && !sending) {
      const topic = skillParam ? decodeURIComponent(skillParam)
        : botNameParam ? decodeURIComponent(botNameParam)
        : 'General';
      setSelectedSkill(topic);
      startSession(topic);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botIdParam]);

  /**
   * Construye el mensaje de error visible para el usuario.
   * @deprecated — Los errores 5xx ahora caen silenciosamente al modo demo.
   * Se conserva solo por si se necesita en el futuro.
   */
  // const buildBackendErrorMessage = ...

  const startSession = async (skillKey: string, initialMessage?: string) => {
    const skill = SKILLS.find((s) => s.key === skillKey);
    // For custom bots, use the bot's subject as topic even if skill not in list
    const topicForBot = botIdParam
      ? (skillParam ? decodeURIComponent(skillParam) : botNameParam ? decodeURIComponent(botNameParam) : 'General')
      : null;
    const topic = topicForBot ?? skill?.topic;
    if (!topic) return;
    setSending(true);

    let data: ChatMessageResponse;

    // ── Paso 1: llamada al backend ──
    try {
      const payload: any = { topic, difficulty: "medium" };
      if (botIdParam) payload.bot_id = Number(botIdParam);
      const res = await api.post<ChatMessageResponse>("/chat/start", payload);
      data = res.data;
    } catch (err: any) {
      if (err?.response && err.response.status < 500) {
        const detail = err.response.data?.detail || `Error ${err.response.status}`;
        console.error("Error starting session (HTTP 4xx):", detail);
        setSessionActive(true);
        setMessages([{
          id: Date.now().toString(),
          role: "bot",
          content: `⚠️ No se pudo conectar con el tutor: ${detail}`,
          timestamp: new Date(),
        }]);
        setSending(false);
        inputRef.current?.focus();
        return;
      }
      console.warn("Backend/IA no disponible, usando demo:", err?.response?.status ?? err?.message);
      await new Promise((r) => setTimeout(r, 600));
      data = demoStartSession(skillKey || topic);
    }

    // ── Paso 2: blindaje de forma de la respuesta.
    // Si el backend cambia el nombre de un campo, esto evita un crash
    // silencioso que terminaba mostrándose como "error al iniciar sesión". ──
    const safeMessage = data?.message ?? "Hola, soy tu tutor. Empecemos.";
    if (!data?.message) {
      console.warn("⚠️ La respuesta de /chat/start no trae 'message'. Respuesta recibida:", data);
    }

    // ── Paso 3: procesamiento de UI. Cualquier fallo aquí es un bug
    // de frontend, no un error del backend, así que se trata aparte. ──
    try {
      setSessionActive(true);
      setLastResponse(data);
      metrics.onBotMessageReceived();
      setMessages([{
        id: Date.now().toString(),
        role: "bot",
        content: safeMessage,
        timestamp: new Date(),
        cognitive_state: data?.cognitive_state,
        action: data?.action,
        suggestions: data?.suggestions,
      }]);
      // VRM: animar labios (sin TTS automático)
      const wordCountStart = safeMessage.split(" ").length;
      vrmRef.current?.speak(wordCountStart * 380);
      // NO llamar speakText aquí - dejar que el usuario presione el botón de "Leer en voz alta"
      if (data?.cognitive_state) {
        vrmRef.current?.setEmotion(data.cognitive_state as CognitiveEmotion);
      }
      // Detectar quiz en la respuesta
      const startQuiz = parseQuizFromMessage(safeMessage);
      setCurrentQuiz(startQuiz);
    } catch (uiErr) {
      console.error("Error procesando la respuesta de inicio de sesión (bug de UI):", uiErr);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }

    // Si se pasó una pregunta inicial, enviarla automáticamente
    if (initialMessage) {
      await sendMessageWithText(initialMessage, skillKey);
    }
  };

  const handleInputChange = (val: string) => {
    metrics.onUserStartedTyping();
    metrics.onInputChange(val, prevInput);
    setPrevInput(input);
    setInput(val);
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    await sendMessageWithText(input.trim());
  };

  const sendMessageWithText = async (msgContent: string, skillKeyOverride?: string) => {
    if (!msgContent.trim() || sending) return;

    const behavioralMetrics = metrics.getMetrics(msgContent);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: msgContent,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setPrevInput("");
    setSending(true);

    let data: ChatMessageResponse;

    // ── Paso 1: llamada al backend ──
    try {
      const skill = SKILLS.find((s) => s.key === (skillKeyOverride ?? selectedSkill));
      const res = await api.post<ChatMessageResponse>("/chat/message", {
        message: msgContent,
        topic: skill?.topic ?? "Tema general",
        cognitive_state: lastResponse?.cognitive_state || "normal",
        history: messages.slice(-10).map((m) => ({
          role: m.role === "bot" ? "assistant" : "user",
          content: m.content,
        })),
        response_time_ms:  behavioralMetrics.response_time_ms,
        typing_speed_cpm:  behavioralMetrics.typing_speed_cpm,
        corrections:       behavioralMetrics.corrections,
        pause_before_ms:   behavioralMetrics.pause_before_ms,
        ...(facial.isStreaming && facial.snapshot.is_active ? {
          facial_data: {
            emotion: facial.snapshot.valence > 0.2 ? "happy" : facial.snapshot.valence < -0.2 ? "worried" : "neutral",
            valence: facial.snapshot.valence,
            arousal: facial.snapshot.arousal,
            attention_score: facial.snapshot.attention_score,
            blink_rate: facial.snapshot.blink_rate,
            brow_furrow: facial.snapshot.brow_furrow,
            smile_intensity: facial.snapshot.smile_intensity,
            gaze_direction: facial.snapshot.gaze_direction,
          }
        } : {}),
        ...(voice.isStreaming ? {
          voice_data: {
            pitch_mean_hz:       voice.snapshot.pitch_mean_hz,
            volume_db:           voice.snapshot.volume_db,
            speech_rate_wpm:     voice.snapshot.speech_rate_wpm,
            voice_tremor:        voice.snapshot.voice_tremor,
            energy_level:        voice.snapshot.energy_level,
            filler_words_count:  voice.snapshot.filler_words_count,
            silence_duration_ms: voice.snapshot.silence_duration_ms,
          }
        } : {}),
      });
      data = res.data;
    } catch (err: any) {
      if (err?.response && err.response.status < 500) {
        // Error de cliente (4xx) — sí mostrar al usuario
        const detail = err.response.data?.detail || `Error ${err.response.status}`;
        console.error("Error sending message (HTTP 4xx):", detail);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "bot",
            content: `⚠️ Error al enviar el mensaje: ${detail}`,
            timestamp: new Date(),
          },
        ]);
        setSending(false);
        inputRef.current?.focus();
        return;
      }
      // 5xx o sin respuesta (IA no configurada, backend caído) → demo silencioso
      console.warn("Backend/IA no disponible, usando demo:", err?.response?.status ?? err?.message);
      await new Promise((r) => setTimeout(r, 800));
      data = demoSendMessage(msgContent);
    }

    // ── Paso 2: blindaje de forma de la respuesta ──
    const safeMessage = data?.message ?? "(El tutor no devolvió contenido. Intenta de nuevo.)";
    if (!data?.message) {
      console.warn("⚠️ La respuesta de /chat/message no trae 'message'. Respuesta recibida:", data);
    }

    // ── Paso 3: procesamiento de UI, separado de errores de red ──
    try {
      setLastResponse(data);
      metrics.onBotMessageReceived();

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: safeMessage,
          timestamp: new Date(),
          cognitive_state: data?.cognitive_state,
          action: data?.action,
          suggestions: data?.suggestions,
        },
      ]);
      // VRM: animar labios (sin TTS automático)
      const wordCountMsg = safeMessage.split(" ").length;
      vrmRef.current?.speak(wordCountMsg * 380);
      // NO llamar speakText aquí - dejar que el usuario presione el botón de "Leer en voz alta"
      if (data?.cognitive_state) {
        vrmRef.current?.setEmotion(data.cognitive_state as CognitiveEmotion);
      }

      // Detectar si la IA SUGIERE un quiz (análisis neuroconductual)
      const isQuizSuggested = data?.metadata?.quiz_suggested === true;
      setQuizSuggested(isQuizSuggested);

      if (isQuizSuggested) {
        console.log("💡 Quiz sugerido por análisis neuroconductual - mostrar botón");
      }

      // Detectar si el mensaje contiene un quiz generado (cuando el usuario acepta el sugerido)
      const generatedQuiz = parseQuizFromMessage(safeMessage);
      if (generatedQuiz) {
        setCurrentQuiz(generatedQuiz);
        setQuizSuggested(false); // Ocultar botón si se generó el quiz
        console.log("📋 Quiz generado y mostrado");
      }
    } catch (uiErr) {
      console.error("Error procesando la respuesta del mensaje (bug de UI):", uiErr);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "bot", content: "❌ Ocurrió un error procesando la respuesta. Intenta de nuevo.", timestamp: new Date() },
      ]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const endSession = async () => {
    try { await api.post("/chat/end"); } catch { /* ignore */ }
    setSessionActive(false);
    setMessages([]);
    setLastResponse(null);
    setSelectedSkill("");
    metrics.reset();
  };

  const stateKey = lastResponse?.cognitive_state || "";
  const stateInfo = STATE_LABELS[stateKey] || { label: stateKey, color: "bg-[#F7F6F3] text-[#787774]" };

  // ===== PANTALLA INICIAL (antes de iniciar sesión) =====
  if (!sessionActive) {
    const handleSuggestedQuestion = (skill: string, text: string) => {
      if (sending) return;
      setSelectedSkill(skill);
      startSession(skill, text);
    };

    const handleFreeSubmit = () => {
      if (!freeInput.trim() || sending) return;
      const skill = detectSkillFromText(freeInput);
      setSelectedSkill(skill);
      startSession(skill, freeInput.trim());
      setFreeInput("");
    };

    return (
      <div className="flex h-[calc(100vh-64px)] bg-[#F7F6F3] justify-center">
        <div className="flex flex-col w-full max-w-2xl">
          {/* ── Header ── */}
          <div className="bg-white border-b border-[#E9E9E7] px-5 py-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-[#37352F] rounded-md flex items-center justify-center text-xl flex-shrink-0">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-[#191919] text-base">Asistente IA</span>
                <span className="flex items-center gap-1 text-[10px] font-bold bg-[#F7F3FB] text-[#6940A5] border border-[#D9CCE9] px-2 py-0.5 rounded-full">
                  ✦ Con GPT-5
                </span>
              </div>
              <p className="text-xs text-[#9B9A97] mt-0.5">Tu tutor personal para el ICFES</p>
            </div>
            <span className="w-2.5 h-2.5 bg-[#0F7B6C] rounded-full flex-shrink-0" title="En línea" />
          </div>

          {/* ── Área de mensajes ── */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
            {/* Preguntas sugeridas */}
            <div>
              <p className="text-xs font-semibold text-[#9B9A97] uppercase tracking-wide mb-3">
                Preguntas sugeridas:
              </p>
              <div className="space-y-2.5">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q.skill, q.text)}
                    disabled={sending}
                    className="w-full flex items-center gap-3 bg-white rounded-md px-4 py-3.5 text-left text-sm text-[#37352F] border border-[#E9E9E7] hover:border-[#BFDFF0] hover:shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-9 h-9 bg-[#E5F3FF] group-hover:bg-[#E5F3FF] rounded-md flex items-center justify-center text-lg flex-shrink-0 transition-colors">
                      {q.icon}
                    </span>
                    <span className="font-medium group-hover:text-[#0B6E99] transition-colors">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Burbuja de bienvenida del bot */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-[#37352F] rounded-md flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                🤖
              </div>
              <div className="bg-white rounded-md rounded-tl-sm px-4 py-3 border border-[#E9E9E7] max-w-md">
                <p className="text-sm text-[#37352F] leading-relaxed">
                  ¡Hola! Soy tu asistente de IA para el ICFES. Puedo ayudarte con explicaciones paso a paso, resolver
                  dudas sobre cualquier tema, y darte consejos de estudio. ¿En qué puedo ayudarte hoy?
                </p>
                <p className="text-[10px] text-[#9B9A97] mt-2">
                  {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {/* Indicador de carga cuando se está iniciando sesión */}
            {sending && (
              <div className="flex items-start gap-3 animate-fadeIn">
                <div className="w-8 h-8 bg-[#37352F] rounded-md flex items-center justify-center text-sm flex-shrink-0 mt-0.5">
                  🤖
                </div>
                <div className="bg-white rounded-md rounded-tl-sm px-4 py-3 border border-[#E9E9E7]">
                  <div className="flex items-center gap-1 py-1">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Input ── */}
          <div className="bg-white border-t border-[#E9E9E7] px-5 py-4">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={freeInput}
                onChange={(e) => setFreeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFreeSubmit();
                  }
                }}
                placeholder="Escribe tu pregunta aquí..."
                disabled={sending}
                className="flex-1 px-4 py-2.5 rounded-md border border-[#E9E9E7] focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99] text-sm disabled:opacity-50 bg-[#F7F6F3] transition-all"
              />
              <button
                onClick={handleFreeSubmit}
                disabled={!freeInput.trim() || sending}
                className="p-2.5 bg-[#37352F] text-white rounded-md hover:bg-[#2F2D2B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[10px] text-[#9B9A97] mt-2 text-center">
              Presiona Enter para enviar, Shift + Enter para nueva línea
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== CHAT VIEW =====
  return (
    <div className="flex h-[calc(100vh-64px)] bg-[#F7F6F3]">
      {/* Chat Panel */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Header */}
        <div className="bg-white border-b border-[#E9E9E7] px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-600 rounded-md flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-[#191919] text-sm">Tutor NeuroLearn</h2>
              <p className="text-xs text-[#787774]">
                {SKILLS.find((s) => s.key === selectedSkill)?.name || "Sesión activa"}
              </p>
            </div>
            {/* Badge Modo Tutor Voz */}
            {voiceTutor.isVoiceMode && (
              <span className="flex items-center gap-1 text-xs bg-[#F4EFFB] text-[#6940A5] px-2 py-0.5 rounded-full font-medium animate-pulse">
                🎙 Tutor Voz
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {stateKey && (
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stateInfo.color}`}>
                {stateInfo.label}
              </span>
            )}
            {/* Botón Cámara - Patrón 3 */}
            {facial.hardwareAvailable ? (
              <div className="relative group">
                <button
                  onClick={() => {
                    if (facial.errorMessage) facial.resetError();
                    facial.isStreaming ? facial.stopCamera() : facial.startCamera();
                  }}
                  title={
                    facial.errorMessage ? facial.errorMessage
                    : facial.isStreaming ? "Desactivar cámara"
                    : "Activar cámara (Patrón 3)"
                  }
                  className={`p-2 rounded-lg transition-colors text-xs flex items-center gap-1 ${
                    facial.isStreaming
                      ? "bg-[#EEF7F4] text-[#0F7B6C] hover:bg-[#FDEEEE] hover:text-[#E03E3E]"
                      : facial.errorMessage
                      ? "bg-[#FDF4EC] text-[#D9730D] hover:bg-[#FDF4EC]"
                      : "text-[#9B9A97] hover:text-[#0F7B6C] hover:bg-[#EEF7F4]"
                  }`}
                >
                  {facial.isStreaming ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  {facial.isStreaming && <span className="w-1.5 h-1.5 bg-[#0F7B6C] rounded-full animate-pulse" />}
                  {facial.errorMessage && !facial.isStreaming && <span className="w-1.5 h-1.5 bg-[#D9730D] rounded-full" />}
                </button>
                {facial.errorMessage && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-[#191919] text-white text-xs rounded-lg p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="font-medium mb-1">⚠️ Cámara no disponible</p>
                    <p>{facial.errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <span className="p-2 rounded-lg flex items-center gap-1 text-[#9B9A97] cursor-default" title="Sin cámara — P3 desactivado">
                  <CameraOff className="w-4 h-4" />
                </span>
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-[#191919] text-white text-xs rounded-lg p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-medium mb-1">📷 Sin cámara detectada</p>
                  <p>El Patrón 3 (microexpresión facial) no está disponible en este dispositivo.</p>
                  <p className="mt-1 text-[#9B9A97]">El sistema funciona con P1 + P2 + P5.</p>
                </div>
              </div>
            )}
            {/* Botón Micrófono - Patrón 4 */}
            {voice.hardwareAvailable ? (
              <div className="relative group">
                <button
                  onClick={() => {
                    if (voice.errorMessage) voice.resetError();
                    voice.isStreaming ? voice.stopMic() : voice.startMic();
                  }}
                  title={
                    voice.errorMessage ? voice.errorMessage
                    : voice.isStreaming ? "Desactivar micrófono"
                    : "Activar micrófono (Patrón 4)"
                  }
                  className={`p-2 rounded-lg transition-colors flex items-center gap-1 ${
                    voice.isStreaming
                      ? "bg-[#E5F3FF] text-[#0B6E99] hover:bg-[#FDEEEE] hover:text-[#E03E3E]"
                      : voice.errorMessage
                      ? "bg-[#FDF4EC] text-[#D9730D] hover:bg-[#FDF4EC]"
                      : "text-[#9B9A97] hover:text-[#0B6E99] hover:bg-[#E5F3FF]"
                  }`}
                >
                  {voice.isStreaming ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  {voice.isStreaming && voice.snapshot.is_active && <span className="w-1.5 h-1.5 bg-[#0B6E99] rounded-full animate-pulse" />}
                  {voice.errorMessage && !voice.isStreaming && <span className="w-1.5 h-1.5 bg-[#D9730D] rounded-full" />}
                </button>
                {voice.errorMessage && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-[#191919] text-white text-xs rounded-lg p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="font-medium mb-1">⚠️ Micrófono no disponible</p>
                    <p>{voice.errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <span className="p-2 rounded-lg flex items-center gap-1 text-[#9B9A97] cursor-default" title="Sin micrófono — P4 desactivado">
                  <MicOff className="w-4 h-4" />
                </span>
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-[#191919] text-white text-xs rounded-lg p-3 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-medium mb-1">🎤 Sin micrófono detectado</p>
                  <p>El Patrón 4 (prosodia de voz) no está disponible en este dispositivo.</p>
                  <p className="mt-1 text-[#9B9A97]">El sistema funciona con P1 + P2 + P5.</p>
                </div>
              </div>
            )}
            {/* Botón Subtítulos — solo visible en modo voz */}
            {voiceTutor.isVoiceMode && (
              <button
                onClick={voiceTutor.toggleSubtitles}
                title={voiceTutor.subtitlesEnabled ? "Ocultar subtítulos" : "Mostrar subtítulos"}
                className={`p-2 rounded-lg transition-colors ${
                  voiceTutor.subtitlesEnabled
                    ? "bg-[#F7F3FB] text-[#6940A5]"
                    : "text-[#9B9A97] hover:text-[#6940A5] hover:bg-[#F7F3FB]"
                }`}
              >
                <Captions className="w-4 h-4" />
              </button>
            )}
            {/* Botón avatar VRM — eliminado, usa Modo Live */}
            {/* Botón Modo Live — compacto en el header */}
            <button
              onClick={() => setShowLiveMode(true)}
              disabled={!voice.hardwareAvailable}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                voice.hardwareAvailable
                  ? 'bg-[#6940A5] text-white hover:bg-[#6940A5]'
                  : 'bg-[#F7F6F3] text-[#9B9A97] cursor-not-allowed'
              }`}
              title={voice.hardwareAvailable ? 'Modo Live con tutor animado' : 'Requiere micrófono'}
            >
              🎬 Live
            </button>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`p-2 rounded-lg transition-colors ${showDashboard ? "bg-accent-50 text-accent-600" : "text-[#9B9A97] hover:text-accent-500 hover:bg-accent-50"}`}
              title="Panel neuroconductual"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={endSession}
              className="p-2 text-[#9B9A97] hover:text-danger-500 hover:bg-[#FDEEEE] rounded-lg transition-colors"
              title="Terminar sesión"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview de cámara — cuadrito flotante esquina inferior derecha */}
        {facial.isStreaming && (
          <div className="absolute bottom-20 right-4 z-30 group">
            <div className="relative w-36 h-28 rounded-md overflow-hidden border-2 border-[#0F7B6C] bg-black">
              {/* El elemento <video> existe en el DOM; lo clonamos visualmente con un canvas
                  o simplemente referenciamos el mismo stream en un <video> React */}
              <VideoPreview videoRef={facial.videoRef} />
              {/* Indicador "EN VIVO" */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 bg-[#E03E3E] rounded-full animate-pulse" />
                <span className="text-white text-[9px] font-semibold tracking-wide">EN VIVO</span>
              </div>
              {/* Botón cerrar encima del cuadrito */}
              <button
                onClick={facial.stopCamera}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#E03E3E]"
                title="Apagar cámara"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-center text-[10px] text-[#9B9A97] mt-1">Análisis facial activo</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex animate-fadeIn ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={msg.role === "user" ? "max-w-[80%] md:max-w-[65%]" : "w-full"}>
                {msg.role === "bot"
                  ? <BotMessageWithActions 
                      content={msg.content}
                      messageId={msg.id}
                      onLike={(id) => sendMessageWithText(`✅ Tu respuesta "me gusta" ha sido registrada para ${id}`)}
                      onDislike={(id) => sendMessageWithText(`❌ Tu respuesta "no me gusta" ha sido registrada para ${id}`)}
                      onSpeak={(text, onEnd) => voiceTutor.speakText(text, onEnd)}
                      onStopSpeak={() => voiceTutor.stopSpeaking()}
                      onReport={(id) => console.log(`Reporte de mensaje: ${id}`)}
                    />
                  : <div className="bg-[#37352F] text-white rounded-md rounded-tr-sm px-4 py-3">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                }
                {msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.suggestions.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(sug); inputRef.current?.focus(); }}
                        className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full hover:bg-primary-100 transition-colors"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start animate-fadeIn w-full">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-[#37352F] flex items-center justify-center text-base flex-shrink-0 mt-0.5 select-none">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-[#787774]">Asistente IA</span>
                  </div>
                  <div className="bg-white rounded-md rounded-tl-sm px-4 py-3.5 border border-[#E9E9E7]">
                    <div className="flex items-center gap-1 py-0.5">
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                      <span className="typing-dot" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Overlay de subtítulos progresivos — avanza palabra a palabra */}
        {voiceTutor.subtitlesEnabled && voiceTutor.isSpeaking && voiceTutor.subtitleProgress && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-2xl pointer-events-none">
            <div className="bg-black/80 text-white text-sm rounded-md px-5 py-3 text-center leading-relaxed backdrop-blur-sm border border-[#6940A5]/30">
              <span className="mr-1.5 text-[#6940A5] text-xs font-semibold uppercase tracking-widest">🔊 Tutor</span>
              <br />
              <span className="text-base">
                {voiceTutor.subtitleProgress}
                <span className="inline-block w-2 h-[1em] bg-[#6940A5] ml-1 animate-pulse align-middle rounded-sm" />
              </span>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-[#E9E9E7] px-4 py-3 flex-shrink-0">
          {/* Indicador STT: transcript en vivo mientras el usuario habla */}
          {voiceTutor.isListening && voiceTutor.liveTranscript && (
            <div className="px-4 pb-1 max-w-4xl mx-auto w-full animate-fadeIn">
              <div className="flex items-center gap-2 bg-[#F7F3FB] border border-[#D9CCE9] rounded-md px-3 py-2 text-xs text-[#6940A5]">
                <span className="w-2 h-2 bg-[#6940A5] rounded-full animate-ping flex-shrink-0" />
                <span className="italic">"{voiceTutor.liveTranscript}"</span>
              </div>
            </div>
          )}
          {/* Indicador mic pulsante cuando escucha y no hay transcript */}
          {voiceTutor.isListening && !voiceTutor.liveTranscript && (
            <div className="px-4 pb-1 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 text-xs text-[#6940A5]">
                <span className="w-2 h-2 bg-[#6940A5] rounded-full animate-ping" />
                <span>Escuchando... habla con tu tutor</span>
              </div>
            </div>
          )}
          {/* Indicador TTS: tutor hablando */}
          {voiceTutor.isSpeaking && (
            <div className="px-4 pb-1 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 text-xs text-[#6940A5]">
                <span className="w-2 h-2 bg-[#6940A5] rounded-full animate-pulse" />
                <span>El tutor está respondiendo en voz alta...</span>
                <button
                  onClick={voiceTutor.stopSpeaking}
                  className="ml-auto text-[#6940A5] hover:text-[#6940A5] underline"
                >
                  Detener
                </button>
              </div>
            </div>
          )}
          {/* Hint de pausa larga */}
          {metrics.isLongPause && sessionActive && !sending && (
          <div className="px-4 pb-1 max-w-4xl mx-auto w-full animate-fadeIn">
            <div className="flex items-center gap-2 bg-[#FCF6E5] border border-[#EDD88A] rounded-md px-3 py-2 text-xs text-[#DFAB01]">
              <span className="text-base">🤔</span>
              <span>
                <strong>¿Necesitas ayuda?</strong> Llevas{" "}
                {Math.round(metrics.realTimePauseMs / 1000)}s sin responder.
                Escribe <em>"no entiendo"</em> o <em>"dame una pista"</em> y el tutor te guía.
              </span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Escribe tu respuesta..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 rounded-md border border-[#E9E9E7] focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 text-sm disabled:opacity-50 bg-[#F7F6F3]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="p-2.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          {lastResponse && (
            <div className="flex items-center gap-3 mt-2 max-w-4xl mx-auto">
              <div className="flex items-center gap-1 text-xs text-[#9B9A97]">
                <span>Engagement:</span>
                <div className="w-16 h-1 bg-[#F7F6F3] rounded-full overflow-hidden">
                  <div className="h-full bg-[#0B6E99] rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((lastResponse.engagement_score ?? 0.5) * 100)}%` }} />
                </div>
                <span>{Math.round((lastResponse.engagement_score ?? 0.5) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#9B9A97]">
                <span>Riesgo error:</span>
                <span className={`font-medium ${(lastResponse.error_risk ?? 0) > 0.5 ? "text-[#E03E3E]" : "text-[#0F7B6C]"}`}>
                  {Math.round((lastResponse.error_risk ?? 0) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#9B9A97]">
                <span className="text-[#9B9A97]">|</span>
                <span>{(lastResponse.active_modalities ?? []).length}/5 patrones activos</span>
              </div>
            </div>
          )}

          {/* ── Quiz interactivo (modal flotante) ────────────────────────────────────────── */}
          {currentQuiz && (
            <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-sm z-50 animate-fadeIn">
              <QuizPanel
                quiz={currentQuiz}
                onAnswer={(key, text) => {
                  setCurrentQuiz(null);
                  sendMessageWithText(`Mi respuesta es ${key}) ${text}`);
                }}
                dark
              />
            </div>
          )}

          {/* ── Botón Quiz Sugerido (análisis neuroconductual) ────────────────────────────────────── */}
          {!currentQuiz && sessionActive && quizSuggested && (
            <div className="max-w-4xl mx-auto w-full mb-2 flex justify-center animate-fadeIn">
              <button
                onClick={async () => {
                  setQuizSuggested(false);
                  // Solicitar quiz explícitamente
                  await sendMessageWithText("Generame el quiz sobre el tema que acabamos de ver con exactamente 4 opciones (A, B, C, D)");
                }}
                disabled={sending}
                className="text-sm font-semibold bg-[#6940A5] text-white px-6 py-3 rounded-full hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-40 flex items-center gap-2"
              >
                <span className="text-lg">📋</span>
                <span>Quiz Sugerido</span>
                <span className="text-xs opacity-80">(Recomendado por IA)</span>
              </button>
            </div>
          )}

          {/* ── Botón para pedir quiz manual ────────────────────────────────────── */}
          {!currentQuiz && sessionActive && !quizSuggested && (
            <div className="max-w-4xl mx-auto w-full mb-2 flex justify-end">
              <button
                onClick={() => sendMessageWithText("Dame un quiz de opción múltiple (A, B, C, D) sobre lo que acabamos de ver para verificar que aprendí.")}
                disabled={sending}
                className="text-xs text-[#6940A5] hover:text-[#6940A5] border border-[#D9CCE9] hover:bg-[#F7F3FB] px-3 py-1 rounded-full transition-colors disabled:opacity-40"
              >
                🧠 Quiz rápido
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Panel Neuroconductual */}
      <CognitiveDashboard
        response={lastResponse}
        isVisible={showDashboard}
        facialSnapshot={facial.snapshot}
        facialActive={facial.isStreaming}
        voiceSnapshot={voice.snapshot}
        voiceActive={voice.isStreaming}
      />

      {/* Modo Live — overlay full-screen */}
      {showLiveMode && (
        <LiveModeView
          vrmRef={vrmRef}
          voiceTutor={voiceTutor}
          lastResponse={lastResponse}
          onSendMessage={sendMessageWithText}
          facial={facial}
          voice={voice}
          onExit={() => {
            voiceTutor.stopVoiceMode();
            setShowLiveMode(false);
          }}
        />
      )}
    </div>
  );
}