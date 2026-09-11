import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// ── Suprimir warnings de consola inofensivos ──────────────────
// 1. THREE.Clock deprecation — R3F aún no migró a THREE.Timer
// 2. THREE.WebGLProgram X4122 — warnings del compilador HLSL de DirectX/ANGLE
//    en Windows. Las operaciones float son correctas; solo pierden precisión
//    en la conversión GLSL→HLSL que hace ANGLE. No afecta la escena.
// 3. PCFSoftShadowMap — Three.js >= r164 recomienda PCFShadowMap.
//    Ya corregido en RobotConfig (shadows: 'percentage'), pero R3F puede
//    emitirlo durante el primer frame antes de aplicar la config.
if (import.meta.env.DEV) {
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.includes('THREE.Clock'))              return;
    if (msg.includes('THREE.WebGLProgram'))       return;
    if (msg.includes('warning X4122'))            return;
    if (msg.includes('PCFSoftShadowMap'))         return;
    if (msg.includes('THREE.WebGLShadowMap'))     return;
    _warn(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ── Registro del Service Worker (PWA: instalable + offline) ─────
// Solo en producción: en desarrollo el SW cachearía el servidor de Vite
// e interferiría con el HMR.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    // BASE_URL respeta el base de Vite (ej. '/Proyecto_g/' en GitHub Pages)
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;
    navigator.serviceWorker
      .register(swUrl)
      .catch((err) => console.warn('[PWA] No se pudo registrar el service worker:', err));
  });
}

// ── Prompt de instalación PWA (beforeinstallprompt) ──────────────
// Guardamos el evento para poder disparar la instalación desde la UI.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e as BeforeInstallPromptEvent;
  window.dispatchEvent(new CustomEvent('pwaInstallReady'));
});

// Expone un helper global para que la UI pueda lanzar el prompt.
declare global {
  interface Window {
    __pwaInstallPrompt?: () => Promise<void>;
  }
}
window.__pwaInstallPrompt = async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
};
