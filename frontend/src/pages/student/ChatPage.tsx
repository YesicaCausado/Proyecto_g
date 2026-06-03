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
import VRMTutor, { type VRMTutorHandle, type CognitiveEmotion } from "../../components/VRMTutor";

/** Mini-componente que adjunta el stream del videoRef al <video> React */
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
  const [showAvatar, setShowAvatar] = useState(true);
  const metrics = useBehavioralMetrics();
  const facial = useFacialDetection();
  const voice = useVoiceProsody();

  // Tutor de Voz — STT escucha al usuario, TTS responde en voz alta
  const voiceTutor = useVoiceTutor(async (transcript) => {
    if (!transcript.trim() || sending) return;
    setInput(transcript);
    await sendMessageWithText(transcript);
  });

  // Auto-activar modo voz cuando cámara + micrófono estén ambos activos
  useEffect(() => {
    if (!voiceTutor.supported || !sessionActive) return;
    if (facial.isStreaming && voice.isStreaming && !voiceTutor.isVoiceMode) {
      voiceTutor.startVoiceMode();
    } else if ((!facial.isStreaming || !voice.isStreaming) && voiceTutor.isVoiceMode) {
      voiceTutor.stopVoiceMode();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facial.isStreaming, voice.isStreaming, sessionActive]);

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
      // Intentar siempre el backend real primero; solo si falla → mock
      try {
        const res = await api.post<ChatMessageResponse>("/chat/start", {
          topic: skill.topic,
          difficulty: "medium",
        });
        data = res.data;
      } catch {
        // Backend no disponible → demo mock
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
      // TTS + VRM: leer bienvenida en voz alta y animar avatar
      if (voiceTutor.isVoiceMode) {
        voiceTutor.speakText(data.message);
        const wordCount = data.message.split(" ").length;
        vrmRef.current?.speak(wordCount * 350);
      }
      if (data.cognitive_state) {
        vrmRef.current?.setEmotion(data.cognitive_state as CognitiveEmotion);
      }
    } catch (err) {
      console.error("Error starting session:", err);
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
        const res = await api.post<ChatMessageResponse>("/chat/message", {
          message: msgContent,
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
      } catch {
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
      // TTS + VRM: leer respuesta en voz alta y animar avatar
      if (voiceTutor.isVoiceMode) {
        voiceTutor.speakText(data.message);
        const wordCount = data.message.split(" ").length;
        vrmRef.current?.speak(wordCount * 350);
      }
      if (data.cognitive_state) {
        vrmRef.current?.setEmotion(data.cognitive_state as CognitiveEmotion);
      }
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
            {/* Botón avatar VRM */}
            <button
              onClick={() => setShowAvatar(!showAvatar)}
              className={`p-2 rounded-lg transition-colors text-sm ${showAvatar ? "bg-violet-50 text-violet-600" : "text-gray-400 hover:text-violet-500 hover:bg-violet-50"}`}
              title="Avatar tutor 3D"
            >
              🧑‍🏫
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
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
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

        {/* Overlay de subtítulos (TTS) — aparece en la parte inferior cuando el tutor habla */}
        {voiceTutor.subtitlesEnabled && voiceTutor.isSpeaking && voiceTutor.lastBotText && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-xl pointer-events-none">
            <div className="bg-black/75 text-white text-sm rounded-xl px-4 py-2.5 text-center leading-relaxed backdrop-blur-sm">
              <span className="mr-1.5 text-violet-300">🔊</span>
              {voiceTutor.lastBotText}
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
        </div>
      </div>

      {/* Panel Avatar VRM — aparece entre el chat y el dashboard */}
      {showAvatar && (
        <div className="w-52 flex-shrink-0 bg-gradient-to-b from-violet-50 to-purple-50 border-l border-violet-100 flex flex-col">
          {/* Canvas del avatar */}
          <div className="flex-1 min-h-0">
            <VRMTutor
              ref={vrmRef}
              className="w-full h-full"
              vrmPath="/tutor.vrm"
            />
          </div>
          {/* Info estado cognitivo */}
          {lastResponse?.cognitive_state && (
            <div className="px-3 py-2 border-t border-violet-100 bg-white/60">
              <p className="text-[10px] text-violet-500 text-center font-medium">
                Estado: {STATE_LABELS[lastResponse.cognitive_state]?.label || lastResponse.cognitive_state}
              </p>
            </div>
          )}
          {/* Indicador TTS */}
          {voiceTutor.isSpeaking && (
            <div className="px-3 py-1.5 bg-violet-100 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-ping" />
              <span className="text-[10px] text-violet-600 font-medium">Hablando...</span>
            </div>
          )}
        </div>
      )}

      {/* Panel Neuroconductual */}
      <CognitiveDashboard
        response={lastResponse}
        isVisible={showDashboard}
        facialSnapshot={facial.snapshot}
        facialActive={facial.isStreaming}
        voiceSnapshot={voice.snapshot}
        voiceActive={voice.isStreaming}
      />
    </div>
  );
}