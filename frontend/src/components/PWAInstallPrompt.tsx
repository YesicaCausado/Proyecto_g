import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
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

  if (!isInstallable) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-white dark:bg-slate-800 p-4 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-bottom-5">
      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-100">Instalar App</h4>
        <p className="text-sm text-slate-500 dark:text-slate-400">Instala Proyecto G para una mejor experiencia y soporte offline.</p>
      </div>
      <div className="flex gap-2">
        <button 
          onClick={() => setIsInstallable(false)}
          className="px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          Quizás luego
        </button>
        <button 
          onClick={handleInstall}
          className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors shadow-sm"
        >
          <Download size={16} />
          Instalar
        </button>
      </div>
    </div>
  );
}
