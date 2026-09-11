/* NeuroLearn AI — Service Worker
 * ------------------------------------------------------------------
 * Estrategia de caché:
 *  - Navegaciones (documentos): Network-first con fallback a caché y, si
 *    no hay red, a una página "offline". Así la app siempre carga la
 *    versión más reciente cuando hay conexión y sigue funcionando sin ella.
 *  - Activos versionados (assets con hash, /assets/...): Cache-first.
 *    Nunca cambian, así que se sirven al instante desde caché.
 *  - Otros estáticos (iconos, manifest, pdfs, mediapipe...): Stale-while-
 *    revalidate, para que carguen rápido y se actualicen en segundo plano.
 *  - Llamadas a la API (/api/...): NO se cachean (datos sensibles y
 *    dinámicos). Se dejan pasar a red directamente.
 * ------------------------------------------------------------------
 */

const CACHE_VERSION = 'neurolearn-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// Base de la app: se deduce del path del propio service worker, de modo que
// funcione tanto en la raíz (Vercel, local) como en un subdirectorio
// (GitHub Pages, ej. /Proyecto_g/).
const BASE = (() => {
  const path = self.location.pathname;               // ej. /Proyecto_g/sw.js
  const idx = path.lastIndexOf('/');
  const dir = idx >= 0 ? path.slice(0, idx + 1) : '/'; // ej. /Proyecto_g/
  return dir;
})();

const withBase = (p) => {
  if (p.startsWith('/')) return BASE.replace(/\/$/, '') + p;
  return p;
};

// Página mínima que se muestra cuando no hay red y la app no estaba cacheada.
const OFFLINE_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sin conexión — NeuroLearn AI</title>
<style>
  body{font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0f172a;color:#e2e8f0;
       display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px}
  .box{max-width:420px}
  h1{font-size:1.5rem;margin-bottom:.5rem}
  p{color:#94a3b8;line-height:1.6}
  button{margin-top:16px;background:#2563eb;color:#fff;border:0;border-radius:10px;
         padding:12px 20px;font-size:1rem;cursor:pointer}
</style></head><body><div class="box">
<h1>📡 Sin conexión</h1>
<p>No tienes conexión a internet y esta página aún no se ha guardado en el dispositivo.
Vuelve a intentarlo cuando tengas conexión.</p>
<button onclick="location.reload()">Reintentar</button>
</div></body></html>`;

const isApiCall = (url) => url.pathname.startsWith(BASE + 'api/') || url.pathname.startsWith('/api/');
const isNavigation = (request) => request.mode === 'navigate';
const isHashedAsset = (url) => /\/assets\/[^/]+\.[0-9a-f]{8,}\./.test(url.pathname);

self.addEventListener('install', (event) => {
  // Precacheamos el shell mínimo para que el arranque funcione sin red.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll([
        withBase('/'),
        withBase('/manifest.json'),
        withBase('/icon-192.png'),
        withBase('/icon-512.png'),
        withBase('/2d.png'),
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Limpia cachés de versiones anteriores.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => ![SHELL_CACHE, STATIC_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo gestionamos GET y protocolos http(s).
  if (request.method !== 'GET' || !request.url.startsWith('http')) return;

  // Nunca cacheamos API: pasan directo a la red.
  if (isApiCall(new URL(request.url))) return;

  // Navegación: network-first con fallback a caché → offline page.
  if (isNavigation(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(withBase('/'));
          if (offline) return offline;
          return new Response(OFFLINE_HTML, {
            status: 503,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Activos versionados: cache-first.
  if (isHashedAsset(new URL(request.url))) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
    return;
  }

  // Resto de estáticos: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});