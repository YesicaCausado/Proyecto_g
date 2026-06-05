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

// ── Parser: detecta quiz con EXACTAMENTE 4 opciones A, B, C, D ──────────────
export function parseQuizFromMessage(text: string): QuizData | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Buscar exactamente A, B, C y D (no más, no menos)
  const findOpt = (key: string) =>
    lines.find(l => new RegExp(`^${key}[\\)\\.:]\\s+.+`).test(l));

  const optA = findOpt('A');
  const optB = findOpt('B');
  const optC = findOpt('C');
  const optD = findOpt('D');

  // Requiere las 4 opciones exactas
  if (!optA || !optB || !optC || !optD) return null;

  const firstOptIdx = lines.findIndex(l => /^A[\)\.:]\s+/.test(l));
  if (firstOptIdx < 0) return null;

  // La pregunta son las líneas anteriores a A (excluir la línea "❓" sola)
  const questionLines = lines
    .slice(Math.max(0, firstOptIdx - 4), firstOptIdx)
    .filter(l => l !== '❓');
  const question = questionLines.join(' ').replace(/^❓\s*\*?\*?/, '').replace(/\*\*/g, '').trim();

  const parseOpt = (line: string) => line.replace(/^[A-D][\)\.:]\s+/, '').trim();

  return {
    question,
    options: [
      { key: 'A', text: parseOpt(optA) },
      { key: 'B', text: parseOpt(optB) },
      { key: 'C', text: parseOpt(optC) },
      { key: 'D', text: parseOpt(optD) },
    ],
  };
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function QuizPanel({ quiz, onAnswer, dark = false }: QuizPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const base = dark
    ? 'border-2 border-violet-500 bg-gradient-to-br from-violet-900 via-violet-950 to-black rounded-xl p-3 shadow-2xl shadow-violet-500/20'
    : 'border border-violet-200 bg-violet-50 rounded-2xl p-4';

  const btnBase = dark
    ? 'w-full text-left text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 font-medium'
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
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? 'text-violet-300' : 'text-violet-600'}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${dark ? 'text-violet-300' : 'text-violet-600'}`}>
          Pregunta
        </span>
        {selected && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full text-xs font-medium ${dark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
            ✓ Respondido
          </span>
        )}
      </div>

      {/* Pregunta */}
      {quiz.question && (
        <p className={`text-xs mb-2 leading-snug font-medium ${dark ? 'text-violet-200' : 'text-gray-800'}`}>
          {quiz.question}
        </p>
      )}

      {/* Opciones */}
      <div className="space-y-1.5">
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
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                isSelected
                  ? dark ? 'bg-violet-400 text-white' : 'bg-violet-600 text-white'
                  : dark ? 'bg-gray-700/50 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}>
                {opt.key}
              </span>
              <span className="flex-1 text-xs">{opt.text}</span>
              {isSelected && (
                <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? 'text-green-400' : 'text-green-500'}`} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className={`mt-2 text-xs text-center ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
          El tutor evaluará tu respuesta...
        </p>
      )}
    </div>
  );
}
