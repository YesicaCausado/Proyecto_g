import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

// "Quizás luego" se recuerda unos días para no tapar la pantalla en cada visita.
const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

export default function PWAInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (recentlyDismissed()) return;

    // Check if there is already a deferred prompt available
    if (window.__pwaInstallPrompt && typeof window.__pwaInstallPrompt === 'function') {
        // Sometimes the event fires before this component mounts
        // We assume it's installable if the function is set, but to be sure we can check if it's a PWA
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (!isStandalone) {
           setIsInstallable(true);
        }
    }

    const handleReady = () => {
      setIsInstallable(true);
    };

    window.addEventListener('pwaInstallReady', handleReady);

    // Also listen to beforeinstallprompt just in case it fires late
    const handleBeforeInstall = () => {
        setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('pwaInstallReady', handleReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (window.__pwaInstallPrompt) {
      await window.__pwaInstallPrompt();
      setIsInstallable(false);
    }
  };

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // Sin almacenamiento: solo se oculta en esta visita.
    }
    setIsInstallable(false);
  };

  if (!isInstallable) return null;

  // En móvil se ubica por encima de la barra de navegación inferior (h-16)
  // y ocupa el ancho disponible; desde sm vuelve a la esquina inferior.
  return (
    <div className="fixed left-3 right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] sm:left-4 sm:right-auto sm:bottom-4 sm:max-w-md z-50 bg-white dark:bg-slate-800 p-3 sm:p-4 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 sm:gap-4 animate-in slide-in-from-bottom-5">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm sm:text-base text-slate-800 dark:text-slate-100">Instalar App</h4>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Instala Proyecto G para una mejor experiencia y soporte offline.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 flex-shrink-0">
        <button
          onClick={handleInstall}
          className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm sm:order-2"
        >
          <Download size={16} />
          Instalar
        </button>
        <button
          onClick={handleDismiss}
          className="px-3 py-2 text-xs sm:text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors sm:order-1"
        >
          Quizás luego
        </button>
      </div>
    </div>
  );
}
