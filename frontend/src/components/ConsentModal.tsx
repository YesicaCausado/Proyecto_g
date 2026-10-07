import { useState } from 'react';
import { Camera, Mic, ShieldCheck, X, Loader2, AlertCircle, Check, Ban } from 'lucide-react';
import type { ConsentState, ConsentType } from '../hooks/useConsents';

/**
 * Modal de consentimiento previo a activar la cámara o el micrófono.
 * Muestra el texto vigente que entrega el backend y exige aceptación explícita
 * (casilla + botón). No toca la cámara ni el micrófono: eso lo hace quien lo
 * abre, y solo después de que el backend registró la aceptación.
 */
export default function ConsentModal({ type, state, loadError, onAccept, onDecline, onRetry }: {
  type: ConsentType;
  state: ConsentState | null;
  loadError: string;
  onAccept: (version: string) => Promise<void>;
  onDecline: () => void;
  onRetry: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const Icon = type === 'camara_facial' ? Camera : Mic;
  const doc = state?.document;

  const accept = async () => {
    if (!doc || !checked || saving) return;
    setSaving(true);
    setError('');
    try {
      await onAccept(doc.version);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'No se pudo registrar tu aceptación. Inténtalo de nuevo.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#EEF3FD] flex items-center justify-center">
              <Icon className="w-4 h-4 text-[#2E6FDB]" />
            </div>
            <div>
              <p className="font-semibold text-[#191919] text-sm">{doc?.title ?? 'Consentimiento'}</p>
              {doc && <p className="text-[10px] text-[#787774]">Versión {doc.version}</p>}
            </div>
          </div>
          <button onClick={onDecline} className="text-[#787774] hover:text-[#37352F]" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm text-[#37352F]">
          {!doc ? (
            loadError ? (
              <div className="text-center py-6">
                <AlertCircle className="w-6 h-6 text-[#E03E3E] mx-auto mb-2" />
                <p className="text-[#E03E3E]">{loadError}</p>
                <button onClick={onRetry} className="mt-2 text-xs font-medium text-[#2E6FDB] hover:underline">Reintentar</button>
              </div>
            ) : (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#2E6FDB]" /></div>
            )
          ) : (
            <>
              <p>{doc.purpose}</p>
              <div>
                <p className="text-xs font-semibold text-[#787774] uppercase mb-1.5">Qué datos se procesan</p>
                <ul className="space-y-1.5">
                  {doc.processed.map(t => <li key={t} className="flex gap-2"><Check className="w-3.5 h-3.5 mt-0.5 text-[#0F7B6C] flex-shrink-0" /><span>{t}</span></li>)}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold text-[#787774] uppercase mb-1.5">Qué NO se almacena</p>
                <ul className="space-y-1.5">
                  {doc.not_stored.map(t => <li key={t} className="flex gap-2"><Ban className="w-3.5 h-3.5 mt-0.5 text-[#E03E3E] flex-shrink-0" /><span>{t}</span></li>)}
                </ul>
              </div>
              <div className="p-3 rounded-lg bg-[#F7F6F3] space-y-1.5 text-xs text-[#37352F]">
                <p className="flex gap-2"><ShieldCheck className="w-3.5 h-3.5 mt-0.5 text-[#2E6FDB] flex-shrink-0" /><span>{doc.revocation}</span></p>
                <p>{doc.voluntary}</p>
                <p>{doc.minors}</p>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5 w-4 h-4" />
                <span className="text-sm">He leído la información anterior y acepto que NeuroLearn use mi {type === 'camara_facial' ? 'cámara' : 'micrófono'} de esta forma.</span>
              </label>
              {error && <p className="text-xs text-[#E03E3E] flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> {error}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#E9E9E7] flex justify-end gap-2">
          <button onClick={onDecline} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">No acepto</button>
          <button onClick={accept} disabled={!doc || !checked || saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Acepto y activar
          </button>
        </div>
      </div>
    </div>
  );
}
