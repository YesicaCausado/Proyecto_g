import axios from 'axios';
import type { AxiosAdapter, AxiosRequestConfig, AxiosResponse } from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
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
  return `${config.method?.toUpperCase() ?? 'GET'} ${config.baseURL}${config.url}::${JSON.stringify(config.params ?? null)}`;
}

const cachedAdapter: AxiosAdapter = async (config) => {
  const method = (config.method ?? 'get').toLowerCase();

  // Sólo cacheamos GET idempotentes.
  if (method !== 'get') {
    return defaultAdapter(config);
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
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // HashRouter: navegar vía hash para que funcione también en GitHub Pages
      window.location.href = `${window.location.pathname}#/login`;
    }
    return Promise.reject(error);
  }
);

export default api;