import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Volume2, MoreVertical } from 'lucide-react';

interface BotMessageWithActionsProps {
  content: string;
  messageId: string;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onSpeak?: (content: string, onStop?: () => void) => void;
  onStopSpeak?: () => void;
  onReport?: (id: string) => void;
}

export default function BotMessageWithActions({
  content,
  messageId,
  onLike,
  onDislike,
  onSpeak,
  onStopSpeak,
  onReport,
}: BotMessageWithActionsProps) {
  const [liked, setLiked] = useState<boolean | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleLike = () => {
    if (liked === true) {
      setLiked(null);
      onDislike?.(messageId);
    } else {
      setLiked(true);
      onLike?.(messageId);
    }
  };

  const handleDislike = () => {
    if (liked === false) {
      setLiked(null);
      onLike?.(messageId);
    } else {
      setLiked(false);
      onDislike?.(messageId);
    }
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      // Detener
      setIsSpeaking(false);
      onStopSpeak?.();
    } else {
      // Empezar
      setIsSpeaking(true);
      onSpeak?.(content, () => setIsSpeaking(false));
    }
  };

  return (
    <div className="flex gap-2 group">
      {/* Contenido del mensaje */}
      <div className="flex-1 bg-gradient-to-r from-violet-50 to-purple-50 rounded-lg p-4 border border-violet-100">
        <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
          {content}
        </div>
      </div>

      {/* Botones de acciones */}
      <div className="flex items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Leer en voz alta - TOGGLE */}
        <button
          onClick={handleToggleSpeak}
          className={`p-2 rounded-lg transition-colors ${
            isSpeaking
              ? 'bg-blue-500 text-white animate-pulse'
              : 'hover:bg-blue-100 text-blue-600 hover:text-blue-700'
          }`}
          title={isSpeaking ? "Detener lectura" : "Leer en voz alta"}
        >
          <Volume2 className="w-4 h-4" />
        </button>

        {/* Like */}
        <button
          onClick={handleLike}
          className={`p-2 rounded-lg transition-colors ${
            liked === true
              ? 'bg-green-100 text-green-600'
              : 'hover:bg-gray-100 text-gray-400 hover:text-green-600'
          }`}
          title="Me gusta"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>

        {/* Dislike */}
        <button
          onClick={handleDislike}
          className={`p-2 rounded-lg transition-colors ${
            liked === false
              ? 'bg-red-100 text-red-600'
              : 'hover:bg-gray-100 text-gray-400 hover:text-red-600'
          }`}
          title="No me gusta"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>

        {/* Más opciones */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            title="Más opciones"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Menú desplegable */}
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <button
                onClick={() => {
                  onReport?.(messageId);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                📋 Reportar problema
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(content);
                  setMenuOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                📋 Copiar respuesta
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Indicador de tres puntitos visible */}
      <div className="text-gray-300 text-xs mt-1">•••</div>
    </div>
  );
}
