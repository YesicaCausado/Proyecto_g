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

/** Renderiza texto con markdown básico como JSX */
function BotMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let olBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-none space-y-0.5 my-1 pl-1">
          {listBuffer.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm">
              <span className="text-violet-400 mt-0.5 flex-shrink-0">•</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
            </li>
          ))}
        </ul>
      );
      listBuffer = [];
    }
    if (olBuffer.length) {
      elements.push(
        <ol key={`ol-${elements.length}`} className="list-none space-y-0.5 my-1 pl-1">
          {olBuffer.map((item, i) => (
            <li key={i} className="flex items-start gap-1.5 text-sm">
              <span className="text-violet-500 font-bold flex-shrink-0">{i + 1}.</span>
              <span dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />
            </li>
          ))}
        </ol>
      );
      olBuffer = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) { flushList(); elements.push(<div key={idx} className="h-1" />); return; }
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ')) { olBuffer.length && flushList(); listBuffer.push(trimmed.slice(2)); return; }
    if (/^\d+\.\s/.test(trimmed)) { listBuffer.length && flushList(); olBuffer.push(trimmed.replace(/^\d+\.\s/, '')); return; }
    flushList();
    if (trimmed.startsWith('## ')) { elements.push(<h3 key={idx} className="font-bold text-sm mt-2 mb-0.5 text-gray-800">{trimmed.slice(3)}</h3>); return; }
    if (trimmed.startsWith('# '))  { elements.push(<h2 key={idx} className="font-bold text-base mt-2 mb-1 text-gray-800">{trimmed.slice(2)}</h2>); return; }
    if (trimmed.startsWith('━'))   { elements.push(<hr key={idx} className="border-gray-200 my-2" />); return; }
    elements.push(<p key={idx} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineMarkdown(trimmed) }} />);
  });
  flushList();
  return <div className="space-y-0.5">{elements}</div>;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-xs font-mono text-violet-700">$1</code>');
}
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

  const startSession = async (skillKey: string) => {
    const skill = SKILLS.find((s) => s.key === skillKey);
    if (!skill) return;
    setSending(true);
    try {
      let data: ChatMessageResponse;
      try {
        const res = await api.post<ChatMessageResponse>("/chat/start", {
          topic: skill.topic,
          difficulty: "medium",
        });
        data = res.data;
      } catch (err: any) {
        // Solo usar demo si el backend es inalcanzable (sin respuesta de red)
        // Si hay respuesta HTTP (400, 500, 503) mostrar el error real al usuario
        if (err?.response) {
          const detail = err.response.data?.detail || `Error ${err.response.status}`;
          throw new Error(`Backend: ${detail}`);
        }
        // Sin respuesta → backend offline → demo mock
        console.warn("Backend offline, usando demo:", err?.message);
        await new Promise((r) => setTimeout(r, 600));
        data = demoStartSession(skillKey);
      }
      setSessionActive(true);
      setLastResponse(data);
      metrics.onBotMessageReceived();
      setMessages([{
        id: Date.now().toString(),
        role: "bot",
        content: data.message,
        timestamp: new Date(),
        cognitive_state: data.cognitive_state,
        action: data.action,
        suggestions: data.suggestions,
      }]);
      // TTS + VRM: siempre leer la bienvenida en voz alta y animar labios
      const wordCountStart = data.message.split(" ").length;
      vrmRef.current?.speak(wordCountStart * 380);
      voiceTutor.speakText(data.message, () => vrmRef.current?.stopSpeak());
      if (data.cognitive_state) {
        vrmRef.current?.setEmotion(data.cognitive_state as CognitiveEmotion);
      }
      // Detectar quiz en la respuesta
      const startQuiz = parseQuizFromMessage(data.message);
      setCurrentQuiz(startQuiz);
    } catch (err: any) {
      console.error("Error starting session:", err);
      // Mostrar error en pantalla como mensaje del bot
      setSessionActive(true);
      setMessages([{
        id: Date.now().toString(),
        role: "bot",
        content: `⚠️ **No se pudo iniciar la sesión:** ${err?.message ?? "Error desconocido"}\n\n💡 Si estás en Vercel, verifica que **GROQ_API_KEY** esté configurada en Settings → Environment Variables.`,
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
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

  const sendMessageWithText = async (msgContent: string) => {
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

    try {
      let data: ChatMessageResponse;
      // Intentar backend real; si falla → demo mock
      try {
        const skill = SKILLS.find((s) => s.key === selectedSkill);
        const res = await api.post<ChatMessageResponse>("/chat/message", {
          message: msgContent,
          topic: skill?.topic ?? "Tema general",
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
        // Solo usar demo si el backend es inalcanzable (sin respuesta de red)
        if (err?.response) {
          const detail = err.response.data?.detail || `Error ${err.response.status}`;
          // Mostrar error de la IA directamente en el chat como mensaje del bot
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "bot",
              content: `⚠️ **Error del tutor:** ${detail}\n\nVerifica que la variable **GROQ_API_KEY** esté configurada en Vercel (Settings → Environment Variables).`,
              timestamp: new Date(),
            },
          ]);
          return;
        }
        // Backend offline → demo
        console.warn("Backend offline, usando demo:", err?.message);
        await new Promise((r) => setTimeout(r, 800));
        data = demoSendMessage(msgContent);
      }

      setLastResponse(data);
      metrics.onBotMessageReceived();

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "bot",
          content: data.message,
          timestamp: new Date(),
          cognitive_state: data.cognitive_state,
          action: data.action,
          suggestions: data.suggestions,
        },
      ]);
      // TTS + VRM: siempre leer la respuesta en voz alta y animar labios
      const wordCountMsg = data.message.split(" ").length;
      vrmRef.current?.speak(wordCountMsg * 380);
      voiceTutor.speakText(data.message, () => vrmRef.current?.stopSpeak());
      if (data.cognitive_state) {
        vrmRef.current?.setEmotion(data.cognitive_state as CognitiveEmotion);
      }
      // Detectar quiz en la respuesta
      const msgQuiz = parseQuizFromMessage(data.message);
      setCurrentQuiz(msgQuiz);
    } catch (err) {
      console.error("Error sending message:", err);
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "bot", content: "❌ Error de conexión. Intenta de nuevo.", timestamp: new Date() },
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

  // ===== SKILL SELECTION =====
  if (!sessionActive) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">🎓 Elige tu habilidad</h1>
          <p className="text-gray-500 mt-1">Selecciona la competencia que quieres practicar</p>
          <p className="text-xs text-gray-400 mt-2">
            El sistema monitoreará tus 5 patrones neuroconductuales en tiempo real
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKILLS.map((skill) => (
            <button
              key={skill.key}
              onClick={() => { setSelectedSkill(skill.key); startSession(skill.key); }}
              disabled={sending}
              className={`text-left bg-white border-2 rounded-xl p-5 transition-all hover:shadow-md ${
                selectedSkill === skill.key ? "border-primary-500 shadow-md" : "border-gray-200 hover:border-primary-300"
              } disabled:opacity-50`}
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${skill.color} flex items-center justify-center text-2xl mb-3 shadow-sm`}>
                {skill.icon}
              </div>
              <h3 className="font-semibold text-gray-900">{skill.name}</h3>
              <p className="text-xs text-gray-400 mt-1">Saber 11 • IA Adaptativa</p>
            </button>
          ))}
        </div>
        {sending && (
          <div className="flex items-center justify-center gap-2 mt-6 text-primary-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Iniciando sesión de aprendizaje...</span>
          </div>
        )}
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
              <div className={`max-w-[85%] md:max-w-[70%] ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"}`}>
                {msg.role === "bot"
                  ? <BotMessage content={msg.content} />
                  : <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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
            <div className="flex justify-start animate-fadeIn">
              <div className="chat-bubble-bot">
                <div className="flex items-center gap-1 py-1">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
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

          {/* ── Botón para pedir quiz ────────────────────────────────────── */}
          {!currentQuiz && sessionActive && (
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