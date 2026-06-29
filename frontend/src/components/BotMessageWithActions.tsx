import { useState } from 'react';
import type { ReactNode } from 'react';
import { ThumbsUp, ThumbsDown, Volume2, VolumeX, Copy, Check } from 'lucide-react';

// ─── Inline Markdown: **bold**, *italic*, `code` ──────────────────────────────
function parseInline(text: string): ReactNode {
  const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let k = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1]) {
      parts.push(<strong key={k++} className="font-semibold text-gray-900">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={k++} className="italic text-gray-700">{match[4]}</em>);
    } else if (match[5]) {
      parts.push(
        <code key={k++} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-md text-[12px] font-mono">
          {match[6]}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) return text;
  if (parts.length === 1) return parts[0];
  return <>{parts}</>;
}

// ─── Block Types ──────────────────────────────────────────────────────────────
type MdBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'hr' };

function parseBlocks(content: string): MdBlock[] {
  const lines = content.split('\n');
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    // Code fence
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) { codeLines.push(lines[i]); i++; }
      blocks.push({ type: 'code', lang, text: codeLines.join('\n') });
      i++; continue;
    }
    if (/^-{3,}$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue; }
    if (line.startsWith('## ')) { blocks.push({ type: 'h2', text: line.slice(3) }); i++; continue; }
    if (line.startsWith('### ')) { blocks.push({ type: 'h3', text: line.slice(4) }); i++; continue; }
    if (line.startsWith('> ')) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) { qLines.push(lines[i].trim().slice(2)); i++; }
      blocks.push({ type: 'quote', text: qLines.join(' ') }); continue;
    }
    if (/^[-*+] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*+] /.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-*+] /, '')); i++; }
      blocks.push({ type: 'ul', items }); continue;
    }
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+\. /, '')); i++; }
      blocks.push({ type: 'ol', items }); continue;
    }
    blocks.push({ type: 'p', text: line }); i++;
  }
  return blocks;
}

function renderBlocks(content: string): ReactNode {
  return (
    <>
      {parseBlocks(content).map((block, idx) => {
        switch (block.type) {
          case 'h2':
            return (
              <h3 key={idx} className="text-[15px] font-bold text-gray-900 mt-4 mb-2 pb-1.5 border-b border-gray-100 first:mt-0">
                {parseInline(block.text)}
              </h3>
            );
          case 'h3':
            return (
              <h4 key={idx} className="text-sm font-bold text-gray-800 mt-3 mb-1 first:mt-0">
                {parseInline(block.text)}
              </h4>
            );
          case 'p':
            return (
              <p key={idx} className="text-sm text-gray-700 leading-[1.75] mb-2 last:mb-0">
                {parseInline(block.text)}
              </p>
            );
          case 'ul':
            return (
              <ul key={idx} className="my-2 space-y-1.5">
                {block.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <span className="mt-[8px] w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                    <span className="leading-relaxed flex-1">{parseInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={idx} className="my-2 space-y-2">
                {block.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[11px] font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed flex-1">{parseInline(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case 'quote':
            return (
              <div key={idx} className="my-2.5 bg-amber-50 border-l-[3px] border-amber-400 rounded-r-lg px-3.5 py-2.5">
                <p className="text-sm text-amber-800 leading-relaxed italic">{parseInline(block.text)}</p>
              </div>
            );
          case 'code':
            return (
              <div key={idx} className="my-3 rounded-xl overflow-hidden border border-gray-200">
                {block.lang && (
                  <div className="bg-gray-800 text-gray-400 text-[10px] font-mono px-3 py-1.5 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span className="ml-1 text-gray-300">{block.lang}</span>
                  </div>
                )}
                <pre className="bg-gray-900 text-green-300 text-xs font-mono px-4 py-3 overflow-x-auto leading-relaxed whitespace-pre">
                  {block.text}
                </pre>
              </div>
            );
          case 'hr':
            return <hr key={idx} className="my-3 border-gray-100" />;
          default:
            return null;
        }
      })}
    </>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface BotMessageWithActionsProps {
  content: string;
  messageId: string;
  onLike?: (id: string) => void;
  onDislike?: (id: string) => void;
  onSpeak?: (content: string, onStop?: () => void) => void;
  onStopSpeak?: () => void;
  onReport?: (id: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function BotMessageWithActions({
  content,
  messageId,
  onLike,
  onDislike,
  onSpeak,
  onStopSpeak,
}: BotMessageWithActionsProps) {
  const [liked, setLiked]         = useState<boolean | null>(null);
  const [copied, setCopied]       = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleLike = () => {
    const next = liked === true ? null : true;
    setLiked(next);
    if (next === true) onLike?.(messageId);
  };

  const handleDislike = () => {
    const next = liked === false ? null : false;
    setLiked(next);
    if (next === false) onDislike?.(messageId);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSpeak = () => {
    if (isSpeaking) { setIsSpeaking(false); onStopSpeak?.(); }
    else { setIsSpeaking(true); onSpeak?.(content, () => setIsSpeaking(false)); }
  };

  return (
    <div className="flex items-start gap-3 w-full group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-base flex-shrink-0 shadow-sm mt-0.5 select-none">
        🤖
      </div>

      {/* Content column */}
      <div className="flex-1 min-w-0">
        {/* Sender label */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-gray-600">Asistente IA</span>
          <span className="text-[9px] font-bold bg-violet-50 text-violet-600 border border-violet-200 px-1.5 py-0.5 rounded-full leading-none">
            ✦ GPT-5
          </span>
        </div>

        {/* Bubble */}
        <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm border border-gray-100 min-w-0">
          {renderBlocks(content)}
        </div>

        {/* Action bar — visible on hover */}
        <div className="flex items-center gap-0.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {onSpeak && (
            <button
              onClick={handleToggleSpeak}
              title={isSpeaking ? 'Detener lectura' : 'Leer en voz alta'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isSpeaking
                  ? 'bg-violet-100 text-violet-700'
                  : 'text-gray-400 hover:text-violet-600 hover:bg-violet-50'
              }`}
            >
              {isSpeaking ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isSpeaking ? 'Detener' : 'Leer'}</span>
            </button>
          )}
          <button
            onClick={handleCopy}
            title="Copiar respuesta"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              copied
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado' : 'Copiar'}</span>
          </button>
          <span className="w-px h-4 bg-gray-200 mx-1 flex-shrink-0" />
          <button
            onClick={handleLike}
            title="Respuesta útil"
            className={`p-1.5 rounded-lg transition-colors ${
              liked === true
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-300 hover:text-emerald-500 hover:bg-emerald-50'
            }`}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDislike}
            title="Respuesta poco útil"
            className={`p-1.5 rounded-lg transition-colors ${
              liked === false
                ? 'text-red-500 bg-red-50'
                : 'text-gray-300 hover:text-red-400 hover:bg-red-50'
            }`}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
