import { useState } from 'react';
import { Camera, Mic, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import { useConsents, type ConsentType } from '../hooks/useConsents';

const LABELS: Record<ConsentType, { name: string; icon: typeof Camera }> = {
  camara_facial: { name: 'Cámara y detección facial', icon: Camera },
  microfono_voz: { name: 'Micrófono y análisis de voz', icon: Mic },
};

function formatDate(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
}

/**
 * Mi Perfil → Privacidad: estado de los consentimientos y opción de retirarlos.
 * Para aceptarlos se usa el botón de cámara/micrófono del chat, que muestra el texto completo.
 */
export default function PrivacyConsents() {
  const { consents, loading, error, load, revoke, errorText } = useConsents();
  const [busy, setBusy] = useState<ConsentType | null>(null);
  const [actionError, setActionError] = useState('');

  const handleRevoke = async (type: ConsentType) => {
    if (busy) return;
    if (!window.confirm(`¿Retirar el consentimiento de ${LABELS[type].name.toLowerCase()}? La función no se volverá a activar hasta que lo aceptes de nuevo.`)) return;
    setBusy(type);
    setActionError('');
    try {
      await revoke(type);
    } catch (err) {
      setActionError(errorText(err, 'No se pudo retirar el consentimiento.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-6 bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-[#2E6FDB]" />
        <h2 className="font-semibold text-[#191919] text-sm">Privacidad: cámara y micrófono</h2>
      </div>
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#2E6FDB]" /></div>
      ) : error ? (
        <div className="px-5 py-6 text-sm text-[#E03E3E] flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
          <button onClick={load} className="ml-2 text-xs font-medium text-[#2E6FDB] hover:underline">Reintentar</button>
        </div>
      ) : consents && (
        <div className="divide-y divide-[#F7F6F3]">
          {(Object.keys(LABELS) as ConsentType[]).map(type => {
            const st = consents[type];
            const Icon = LABELS[type].icon;
            return (
              <div key={type} className="px-5 py-4 flex items-start gap-3">
                <Icon className="w-4 h-4 mt-0.5 text-[#787774]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#191919]">{LABELS[type].name}</p>
                  <p className="text-xs text-[#787774] mt-0.5">
                    {st.granted
                      ? `Aceptado el ${formatDate(st.granted_at)} (versión ${st.version}).`
                      : 'No aceptado. Se te pedirá al activar la función en el chat.'}
                  </p>
                  <details className="mt-1.5">
                    <summary className="text-xs text-[#2E6FDB] cursor-pointer">Ver qué datos se usan</summary>
                    <ul className="mt-1.5 space-y-1 text-xs text-[#37352F] list-disc pl-4">
                      {st.document.processed.map(t => <li key={t}>{t}</li>)}
                      {st.document.not_stored.map(t => <li key={t}>{t}</li>)}
                    </ul>
                  </details>
                </div>
                {st.granted && (
                  <button onClick={() => handleRevoke(type)} disabled={busy !== null}
                    className="flex items-center gap-1 px-3 py-1.5 border border-[#E9E9E7] rounded-lg text-xs text-[#E03E3E] hover:bg-red-50 disabled:opacity-50">
                    {busy === type && <Loader2 className="w-3 h-3 animate-spin" />} Retirar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {actionError && <p className="px-5 pb-4 text-xs text-[#E03E3E]">{actionError}</p>}
    </section>
  );
}
