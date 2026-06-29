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
  { key: "matematicas", name: "Pensamiento Lógico-Matemático", topic: "Razonamiento cuantitativo y matemáticas para Saber 11", icon: "🧮", color: "from-blue-500 to-blue-600" },
  { key: "lectora",     name: "Comprensión Lectora",           topic: "Comprensión lectora y lectura crítica para Saber 11",  icon: "📖", color: "from-amber-500 to-orange-500" },
  { key: "ingles",      name: "Inglés Comunicativo",           topic: "Competencia comunicativa en inglés para Saber 11",     icon: "🌎", color: "from-green-500 to-emerald-600" },
  { key: "ciudadanas",  name: "Competencias Ciudadanas",       topic: "Competencias ciudadanas y sociales para Saber 11",     icon: "🏛️", color: "from-purple-500 to-violet-600" },
  { key: "cientifico",  name: "Pensamiento Científico",        topic: "Pensamiento científico y ciencias naturales para Saber 11", icon: "🔬", color: "from-cyan-500 to-teal-600" },
];

const STATE_LABELS: Record<string, { label: string; color: string }> = {
  normal:      { label: "Normal",      color: "bg-gray-100 text-gray-600" },
  fatigue:     { label: "Fatiga",      color: "bg-amber-100 text-amber-700" },
  overload:    { label: "Sobrecarga",  color: "bg-red-100 text-red-700" },
  doubt:       { label: "Duda",        color: "bg-yellow-100 text-yellow-700" },
  mastery:     { label: "Dominio",     color: "bg-emerald-100 text-emerald-700" },
  flow:        { label: "Flujo ✨",    color: "bg-blue-100 text-blue-700" },
  frustration: { label: "Frustración", color: "bg-red-100 text-red-700" },
  curiosity:   { label: "Curiosidad",  color: "bg-violet-100 text-violet-700" },
  focused:     { label: "Enfocado",    color: "bg-green-100 text-green-700" },
  learning:    { label: "Aprendiendo", color: "bg-blue-100 text-blue-700" },
  struggling:  { label: "Dificultad",  color: "bg-amber-100 text-amber-700" },
  confused:    { label: "Confundido",  color: "bg-red-100 text-red-700" },
  mastering:   { label: "Dominando",   color: "bg-emerald-100 text-emerald-700" },
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
  const skillParam = searchParams.get("skill");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [prevInput, setPrevInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(skillParam || "");
  const [lastResponse, setLastResponse] = useState<ChatMessageResponse | null>(null);
  const [showDashboard, setShowDashboard] = useState(true);
  const [quizSuggested, setQuizSuggested] = useState(false); // Flag para mostrar botón "Quiz Sugerido"
  const [freeInput, setFreeInput] = useState(""); // Input de la pantalla pre-sesión

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

  /**
   * Construye el mensaje de error visible para el usuario.
   * @deprecated — Los errores 5xx ahora caen silenciosamente al modo demo.
   * Se conserva solo por si se necesita en el futuro.
   */
  // const buildBackendErrorMessage = ...

  const startSession = async (skillKey: string, initialMessage?: string) => {
    const skill = SKILLS.find((s) => s.key === skillKey);
    if (!skill) return;
    setSending(true);

    let data: ChatMessageResponse;

    // ── Paso 1: llamada al backend. Solo ESTE bloque decide si hubo
    // un error real de red/HTTP. Nada de procesamiento de UI aquí. ──
    try {
      const res = await api.post<ChatMessageResponse>("/chat/start", {
        topic: skill.topic,
        difficulty: "medium",
      });
      data = res.data;
    } catch (err: any) {
      if (err?.response && err.response.status < 500) {
        // Error de cliente (4xx) — sí mostrar al usuario
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
      // 5xx o sin respuesta (IA no configurada, backend caído) → demo silencioso
      console.warn("Backend/IA no disponible, usando demo:", err?.response?.status ?? err?.message);
      await new Promise((r) => setTimeout(r, 600));
      data = demoStartSession(skillKey);
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
  const stateInfo = STATE_LABELS[stateKey] || { label: stateKey, color: "bg-gray-100 text-gray-600" };

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
      <div className="flex h-[calc(100vh-64px)] bg-gray-50 justify-center">
        <div className="flex flex-col w-full max-w-2xl">
          {/* ── Header ── */}
          <div className="bg-white border-b border-gray-100 px-5 py-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center text-xl shadow-md flex-shrink-0">
              🤖
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-gray-900 text-base">Asistente IA</span>
                <span className="flex items-center gap-1 text-[10px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-2 py-0.5 rounded-full">
                  ✦ Con GPT-5
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Tu tutor personal para el ICFES</p>
            </div>
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full shadow-sm flex-shrink-0" title="En línea" />
          </div>

          {/* ── Área de mensajes ── */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
            {/* Preguntas sugeridas */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Preguntas sugeridas:
              </p>
              <div className="space-y-2.5">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestedQuestion(q.skill, q.text)}
                    disabled={sending}
                    className="w-full flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 text-left text-sm text-gray-700 border border-gray-100 hover:border-indigo-200 hover:shadow-sm transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="w-9 h-9 bg-indigo-50 group-hover:bg-indigo-100 rounded-xl flex items-center justify-center text-lg flex-shrink-0 transition-colors">
                      {q.icon}
                    </span>
                    <span className="font-medium group-hover:text-indigo-700 transition-colors">{q.text}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Burbuja de bienvenida del bot */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm mt-0.5">
                🤖
              </div>
              <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-md">
                <p className="text-sm text-gray-700 leading-relaxed">
                  ¡Hola! Soy tu asistente de IA para el ICFES. Puedo ayudarte con explicaciones paso a paso, resolver
                  dudas sobre cualquier tema, y darte consejos de estudio. ¿En qué puedo ayudarte hoy?
                </p>
                <p className="text-[10px] text-gray-400 mt-2">
                  {new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>

            {/* Indicador de carga cuando se está iniciando sesión */}
            {sending && (
              <div className="flex items-start gap-3 animate-fadeIn">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center text-sm flex-shrink-0 shadow-sm mt-0.5">
                  🤖
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
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
          <div className="bg-white border-t border-gray-100 px-5 py-4">
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
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 text-sm disabled:opacity-50 bg-gray-50 transition-all"
              />
              <button
                onClick={handleFreeSubmit}
                disabled={!freeInput.trim() || sending}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              Presiona Enter para enviar, Shift + Enter para nueva línea
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ===== CHAT VIEW =====
  return (
    <div className="flex h-[calc(100vh-64px)] bg-gray-50">
      {/* Chat Panel */}
      <div className="flex flex-col flex-1 min-w-0 relative">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-accent-600 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">Tutor NeuroLearn</h2>
              <p className="text-xs text-gray-500">
                {SKILLS.find((s) => s.key === selectedSkill)?.name || "Sesión activa"}
              </p>
            </div>
            {/* Badge Modo Tutor Voz */}
            {voiceTutor.isVoiceMode && (
              <span className="flex items-center gap-1 text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium animate-pulse">
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
                      ? "bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500"
                      : facial.errorMessage
                      ? "bg-orange-50 text-orange-500 hover:bg-orange-100"
                      : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                  }`}
                >
                  {facial.isStreaming ? <Camera className="w-4 h-4" /> : <CameraOff className="w-4 h-4" />}
                  {facial.isStreaming && <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />}
                  {facial.errorMessage && !facial.isStreaming && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />}
                </button>
                {facial.errorMessage && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="font-medium mb-1">⚠️ Cámara no disponible</p>
                    <p>{facial.errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <span className="p-2 rounded-lg flex items-center gap-1 text-gray-300 cursor-default" title="Sin cámara — P3 desactivado">
                  <CameraOff className="w-4 h-4" />
                </span>
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-medium mb-1">📷 Sin cámara detectada</p>
                  <p>El Patrón 3 (microexpresión facial) no está disponible en este dispositivo.</p>
                  <p className="mt-1 text-gray-300">El sistema funciona con P1 + P2 + P5.</p>
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
                      ? "bg-blue-50 text-blue-600 hover:bg-red-50 hover:text-red-500"
                      : voice.errorMessage
                      ? "bg-orange-50 text-orange-500 hover:bg-orange-100"
                      : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                  }`}
                >
                  {voice.isStreaming ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  {voice.isStreaming && voice.snapshot.is_active && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
                  {voice.errorMessage && !voice.isStreaming && <span className="w-1.5 h-1.5 bg-orange-400 rounded-full" />}
                </button>
                {voice.errorMessage && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="font-medium mb-1">⚠️ Micrófono no disponible</p>
                    <p>{voice.errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative group">
                <span className="p-2 rounded-lg flex items-center gap-1 text-gray-300 cursor-default" title="Sin micrófono — P4 desactivado">
                  <MicOff className="w-4 h-4" />
                </span>
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-medium mb-1">🎤 Sin micrófono detectado</p>
                  <p>El Patrón 4 (prosodia de voz) no está disponible en este dispositivo.</p>
                  <p className="mt-1 text-gray-300">El sistema funciona con P1 + P2 + P5.</p>
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
                    ? "bg-violet-50 text-violet-600"
                    : "text-gray-400 hover:text-violet-500 hover:bg-violet-50"
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
                  ? 'bg-violet-600 text-white hover:bg-violet-500 shadow-sm'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title={voice.hardwareAvailable ? 'Modo Live con tutor animado' : 'Requiere micrófono'}
            >
              🎬 Live
            </button>
            <button
              onClick={() => setShowDashboard(!showDashboard)}
              className={`p-2 rounded-lg transition-colors ${showDashboard ? "bg-accent-50 text-accent-600" : "text-gray-400 hover:text-accent-500 hover:bg-accent-50"}`}
              title="Panel neuroconductual"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={endSession}
              className="p-2 text-gray-400 hover:text-danger-500 hover:bg-red-50 rounded-lg transition-colors"
              title="Terminar sesión"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Preview de cámara — cuadrito flotante esquina inferior derecha */}
        {facial.isStreaming && (
          <div className="absolute bottom-20 right-4 z-30 group">
            <div className="relative w-36 h-28 rounded-xl overflow-hidden shadow-2xl border-2 border-green-400 bg-black">
              {/* El elemento <video> existe en el DOM; lo clonamos visualmente con un canvas
                  o simplemente referenciamos el mismo stream en un <video> React */}
              <VideoPreview videoRef={facial.videoRef} />
              {/* Indicador "EN VIVO" */}
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-white text-[9px] font-semibold tracking-wide">EN VIVO</span>
              </div>
              {/* Botón cerrar encima del cuadrito */}
              <button
                onClick={facial.stopCamera}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                title="Apagar cámara"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400 mt-1">Análisis facial activo</p>
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
                  : <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
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
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-base flex-shrink-0 shadow-sm mt-0.5 select-none">
                  🤖
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-600">Asistente IA</span>
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm border border-gray-100">
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
            <div className="bg-black/80 text-white text-sm rounded-2xl px-5 py-3 text-center leading-relaxed backdrop-blur-sm shadow-xl border border-violet-500/30">
              <span className="mr-1.5 text-violet-400 text-xs font-semibold uppercase tracking-widest">🔊 Tutor</span>
              <br />
              <span className="text-base">
                {voiceTutor.subtitleProgress}
                <span className="inline-block w-2 h-[1em] bg-violet-400 ml-1 animate-pulse align-middle rounded-sm" />
              </span>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex-shrink-0">
          {/* Indicador STT: transcript en vivo mientras el usuario habla */}
          {voiceTutor.isListening && voiceTutor.liveTranscript && (
            <div className="px-4 pb-1 max-w-4xl mx-auto w-full animate-fadeIn">
              <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-3 py-2 text-xs text-violet-700">
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-ping flex-shrink-0" />
                <span className="italic">"{voiceTutor.liveTranscript}"</span>
              </div>
            </div>
          )}
          {/* Indicador mic pulsante cuando escucha y no hay transcript */}
          {voiceTutor.isListening && !voiceTutor.liveTranscript && (
            <div className="px-4 pb-1 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 text-xs text-violet-500">
                <span className="w-2 h-2 bg-violet-400 rounded-full animate-ping" />
                <span>Escuchando... habla con tu tutor</span>
              </div>
            </div>
          )}
          {/* Indicador TTS: tutor hablando */}
          {voiceTutor.isSpeaking && (
            <div className="px-4 pb-1 max-w-4xl mx-auto w-full">
              <div className="flex items-center gap-2 text-xs text-violet-600">
                <span className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                <span>El tutor está respondiendo en voz alta...</span>
                <button
                  onClick={voiceTutor.stopSpeaking}
                  className="ml-auto text-violet-400 hover:text-violet-600 underline"
                >
                  Detener
                </button>
              </div>
            </div>
          )}
          {/* Hint de pausa larga */}
          {metrics.isLongPause && sessionActive && !sending && (
          <div className="px-4 pb-1 max-w-4xl mx-auto w-full animate-fadeIn">
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
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
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 text-sm disabled:opacity-50 bg-gray-50"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="p-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          {lastResponse && (
            <div className="flex items-center gap-3 mt-2 max-w-4xl mx-auto">
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>Engagement:</span>
                <div className="w-16 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((lastResponse.engagement_score ?? 0.5) * 100)}%` }} />
                </div>
                <span>{Math.round((lastResponse.engagement_score ?? 0.5) * 100)}%</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span>Riesgo error:</span>
                <span className={`font-medium ${(lastResponse.error_risk ?? 0) > 0.5 ? "text-red-500" : "text-green-500"}`}>
                  {Math.round((lastResponse.error_risk ?? 0) * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <span className="text-gray-300">|</span>
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
                className="text-sm font-semibold bg-gradient-to-r from-violet-500 to-purple-600 text-white px-6 py-3 rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-40 flex items-center gap-2"
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
                className="text-xs text-violet-500 hover:text-violet-700 border border-violet-200 hover:bg-violet-50 px-3 py-1 rounded-full transition-colors disabled:opacity-40"
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