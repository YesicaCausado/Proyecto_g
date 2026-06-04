/**
 * QuizPanel — Quiz interactivo en tiempo real
 *
 * Detecta automáticamente preguntas de opción múltiple en las respuestas de la IA.
 * El usuario selecciona su respuesta y recibe retroalimentación instantánea.
 */
import { useState } from 'react';
import { CheckCircle, HelpCircle } from 'lucide-react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizData {
  question: string;
  options: QuizOption[];
}

export interface QuizPanelProps {
  quiz: QuizData;
  /** Callback cuando el usuario selecciona. Recibe la opción elegida para enviarla a la IA */
  onAnswer: (optionKey: string, optionText: string) => void;
  /** Fondo oscuro para Modo Live */
  dark?: boolean;
}

// ── Parser: detecta quiz en texto del bot ─────────────────────────────────────
export function parseQuizFromMessage(text: string): QuizData | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const optionLines = lines.filter(l => /^[A-Da-d][\)\.]\s+.+/.test(l));
  if (optionLines.length < 2) return null;

  const firstIdx = lines.findIndex(l => /^[A-Da-d][\)\.]\s+/.test(l));
  if (firstIdx < 0) return null;

  const question = lines.slice(0, firstIdx).join(' ').trim() ||
    lines.slice(Math.max(0, firstIdx - 2), firstIdx).join(' ').trim();

  const options: QuizOption[] = optionLines.map(line => ({
    key: line[0].toUpperCase(),
    text: line.replace(/^[A-Da-d][\)\.]\s+/, '').trim(),
  }));

  return { question, options };
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function QuizPanel({ quiz, onAnswer, dark = false }: QuizPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const base = dark
    ? 'border border-violet-800 bg-violet-950/50 rounded-2xl p-4'
    : 'border border-violet-200 bg-violet-50 rounded-2xl p-4';

  const btnBase = dark
    ? 'w-full text-left text-sm px-4 py-2.5 rounded-xl border transition-all flex items-center gap-3 font-medium'
    : 'w-full text-left text-sm px-4 py-2.5 rounded-xl border transition-all flex items-center gap-3 font-medium';

  const btnIdle = dark
    ? 'border-gray-700 bg-gray-800/60 text-gray-300 hover:bg-violet-900/60 hover:border-violet-600 hover:text-white'
    : 'border-gray-200 bg-white text-gray-700 hover:bg-violet-100 hover:border-violet-400';

  const btnSelected = dark
    ? 'border-violet-500 bg-violet-700/50 text-white'
    : 'border-violet-500 bg-violet-100 text-violet-800';

  const handleSelect = (opt: QuizOption) => {
    if (selected) return; // ya respondió
    setSelected(opt.key);
    onAnswer(opt.key, opt.text);
  };

  return (
    <div className={base}>
      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-3">
        <HelpCircle className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-violet-400' : 'text-violet-600'}`} />
        <span className={`text-xs font-semibold uppercase tracking-wide ${dark ? 'text-violet-400' : 'text-violet-600'}`}>
          Quiz de verificación
        </span>
        {selected && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-violet-800 text-violet-300' : 'bg-violet-200 text-violet-700'}`}>
            Respondido ✓
          </span>
        )}
      </div>

      {/* Pregunta */}
      {quiz.question && (
        <p className={`text-sm mb-3 leading-relaxed ${dark ? 'text-gray-200' : 'text-gray-800'}`}>
          {quiz.question}
        </p>
      )}

      {/* Opciones */}
      <div className="space-y-2">
        {quiz.options.map((opt) => {
          const isSelected = selected === opt.key;
          return (
            <button
              key={opt.key}
              onClick={() => handleSelect(opt)}
              disabled={!!selected}
              className={`${btnBase} ${isSelected ? btnSelected : btnIdle} ${selected && !isSelected ? 'opacity-40' : ''}`}
            >
              {/* Badge de letra */}
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isSelected
                  ? dark ? 'bg-violet-500 text-white' : 'bg-violet-600 text-white'
                  : dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {opt.key}
              </span>
              <span className="flex-1">{opt.text}</span>
              {isSelected && (
                <CheckCircle className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-violet-400' : 'text-violet-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className={`mt-3 text-xs text-center ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          El tutor evaluará tu respuesta...
        </p>
      )}
    </div>
  );
}
