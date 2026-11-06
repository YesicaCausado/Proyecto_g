import { useEffect, useRef, useState } from 'react';
import { WifiOff, Wifi, ChevronDown } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Aviso de conexión (RNF-11). Sin internet la app sigue abriendo las
 * pantallas ya guardadas por el service worker, pero todo lo que lee o
 * guarda datos en el servidor necesita red; el aviso dice qué.
 */
const NEEDS_CONNECTION = [
  'Tutor de IA, NeuroBots y cuestionarios',
  'Iniciar sesión y cargar datos nuevos (clases, desempeño, notificaciones)',
  'Mensajes, publicaciones, evaluaciones y materiales',
  'Respuestas por voz y dictado por voz',
];

export default function ConnectionStatus() {
  const online = useOnlineStatus();
  const [open, setOpen] = useState(false);
  const [restored, setRestored] = useState(false);
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setOpen(false);
    setRestored(true);
    const t = window.setTimeout(() => setRestored(false), 4000);
    return () => window.clearTimeout(t);
  }, [online]);

  if (online && !restored) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm z-[60]"
    >
      {online ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#0F7B6C]/30 bg-[#EEF7F4] px-4 py-3 text-sm text-[#0F7B6C] shadow-lg">
          <Wifi className="w-4 h-4 flex-shrink-0" /> Conexión restablecida.
        </div>
      ) : (
        <div className="rounded-lg border border-[#D9730D]/30 bg-[#FDF4EC] px-4 py-3 text-sm text-[#37352F] shadow-lg">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-start gap-2 text-left"
          >
            <WifiOff className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#D9730D]" />
            <span className="flex-1">
              <span className="font-semibold text-[#D9730D]">Sin conexión a internet.</span>{' '}
              Puedes seguir viendo las pantallas ya cargadas.
            </span>
            <ChevronDown className={`w-4 h-4 mt-0.5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="mt-2 pl-6">
              <p className="text-xs text-[#787774]">Necesitan conexión:</p>
              <ul className="mt-1 list-disc pl-4 text-xs text-[#37352F] space-y-0.5">
                {NEEDS_CONNECTION.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
