import axios from 'axios';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: agregar token JWT a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Caché GET con TTL (evita re-fetch de lecturas que cambian poco) ─────────
// Las dashboards re-disparan las mismas lecturas (bots, clases, stats) en cada
// navegación. Este adapter cachea las respuestas de GET idempotentes durante un
// TTL corto y comparte la promesa en vuelo para peticiones concurrentes
// idénticas. Caduca automáticamente y no cachea errores.
const GET_CACHE_TTL_MS = 15_000; // 15 s

interface CacheEntry {
  ts: number;
  promise: Promise<AxiosResponse>;
}

const _cache = new Map<string, CacheEntry>();
// En Axios 1.x, `api.defaults.adapter` es una cadena ('xhr'|'http'|'fetch') o un
// array de ellas — NO una función. Resolverla con axios.getAdapter() para obtener
// el adapter invocable. Llamarla directamente provocaba "defaultAdapter is not a function".
const defaultAdapter = axios.getAdapter(api.defaults.adapter);

function cacheKey(config: AxiosRequestConfig): string {
  // El token forma parte de la clave: si otra persona inicia sesión en el
  // mismo equipo antes de 15 s, no debe ver las respuestas de la cuenta
  // anterior. (El texto completo del token no se guarda, solo su final.)
  const auth = String((config.headers as any)?.Authorization ?? '').slice(-24);
  return `${config.method?.toUpperCase() ?? 'GET'} ${config.baseURL}${config.url}::${JSON.stringify(config.params ?? null)}::${auth}`;
}

const cachedAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();

  // Sólo cacheamos GET idempotentes. Cualquier escritura (crear, editar,
  // borrar) vacía la caché: así la pantalla que se recarga después muestra
  // el dato guardado y no la copia vieja.
  if (method !== 'get') {
    try {
      return await defaultAdapter(config);
    } finally {
      _cache.clear();
    }
  }

  const key = cacheKey(config);
  const now = Date.now();
  const hit = _cache.get(key);

  if (hit && now - hit.ts < GET_CACHE_TTL_MS) {
    return hit.promise;
  }

  // Ejecuta la petición real; guarda la promesa (compartida entre concurrentes).
  const promise = defaultAdapter(config).then(
    (response) => {
      // Guardamos la respuesta resuelta y refrescamos el timestamp.
      _cache.set(key, { ts: Date.now(), promise: Promise.resolve(response) });
      return response;
    },
    (error) => {
      // No cachear errores: borramos la entrada para reintentar en el siguiente call.
      const cur = _cache.get(key);
      if (cur?.promise === promise) {
        _cache.delete(key);
      }
      throw error;
    }
  );

  _cache.set(key, { ts: now, promise });
  return promise;
};

api.defaults.adapter = cachedAdapter;

// Interceptor: manejar errores 401 (token expirado)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url: string = error.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register');
    // Solo redirigir a login si NO es una llamada de autenticación y hay un token real
    if (error.response?.status === 401 && !isAuthEndpoint && localStorage.getItem('token')) {
      _cache.clear();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // HashRouter: navegar vía hash para que funcione también en GitHub Pages
      window.location.href = `${window.location.pathname}#/login`;
    }
    return Promise.reject(error);
  }
);

export default api;
/**
 * Invalida las lecturas GET cacheadas cuyo URL empiece por `prefix`
 * (p. ej. '/bots' después de subir o eliminar un documento de un NeuroBot).
 */
/** Vacía toda la caché de lecturas (al iniciar o cerrar sesión). */
export function clearApiCache(): void {
  _cache.clear();
}

export function invalidateApiCache(prefix: string): void {
  for (const key of Array.from(_cache.keys())) {
    if (key.includes(` /api/v1${prefix}`)) {
      _cache.delete(key);
    }
  }
}
