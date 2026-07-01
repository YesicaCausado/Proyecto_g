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
    ? 'border-2 border-[#6940A5] bg-gradient-to-br from-[#191919] via-[#191919] to-[#191919] rounded-md p-3 shadow-violet-500/20'
    : 'border border-[#D9CCE9] bg-[#F7F3FB] rounded-md p-4';

  const btnBase = dark
    ? 'w-full text-left text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2 font-medium'
    : 'w-full text-left text-sm px-4 py-2.5 rounded-md border transition-all flex items-center gap-3 font-medium';

  const btnIdle = dark
    ? 'border-[#37352F] bg-[#2F2D2B]/60 text-[#9B9A97] hover:bg-[#2F2D2B]/60 hover:border-[#6940A5] hover:text-white'
    : 'border-[#E9E9E7] bg-white text-[#37352F] hover:bg-[#F4EFFB] hover:border-[#6940A5]';

  const btnSelected = dark
    ? 'border-[#6940A5] bg-[#5A358F]/50 text-white'
    : 'border-[#6940A5] bg-[#F4EFFB] text-[#6940A5]';

  const handleSelect = (opt: QuizOption) => {
    if (selected) return; // ya respondió
    setSelected(opt.key);
    onAnswer(opt.key, opt.text);
  };

  return (
    <div className={base}>
      {/* Encabezado */}
      <div className="flex items-center gap-2 mb-2">
        <HelpCircle className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? 'text-[#6940A5]' : 'text-[#6940A5]'}`} />
        <span className={`text-xs font-bold uppercase tracking-wide ${dark ? 'text-[#6940A5]' : 'text-[#6940A5]'}`}>
          Pregunta
        </span>
        {selected && (
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full text-xs font-medium ${dark ? 'bg-[#0F7B6C]/20 text-[#0F7B6C]' : 'bg-[#EEF7F4] text-[#0F7B6C]'}`}>
            ✓ Respondido
          </span>
        )}
      </div>

      {/* Pregunta */}
      {quiz.question && (
        <p className={`text-xs mb-2 leading-snug font-medium ${dark ? 'text-[#D9CCE9]' : 'text-[#191919]'}`}>
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
                  ? dark ? 'bg-[#6940A5] text-white' : 'bg-[#6940A5] text-white'
                  : dark ? 'bg-[#37352F]/50 text-[#9B9A97]' : 'bg-[#F7F6F3] text-[#787774]'
              }`}>
                {opt.key}
              </span>
              <span className="flex-1 text-xs">{opt.text}</span>
              {isSelected && (
                <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? 'text-[#0F7B6C]' : 'text-[#0F7B6C]'}`} />
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <p className={`mt-2 text-xs text-center ${dark ? 'text-[#787774]' : 'text-[#9B9A97]'}`}>
          El tutor evaluará tu respuesta...
        </p>
      )}
    </div>
  );
}
