import { useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

// Logo que el Súper Profesor sube en Configuración (GET /auth/institution-branding).
// Se pide una vez por usuario y se actualiza al guardar la configuración
// (evento «institution-config-updated» de ConfiguracionTab).

let cached: { key: string; logo: string | null } | null = null;
let inflight: { key: string; promise: Promise<string | null> } | null = null;

function fetchLogo(key: string): Promise<string | null> {
  if (inflight?.key === key) return inflight.promise;
  const promise = api.get('/auth/institution-branding')
    .then(r => (r.data?.logo_url as string | null) ?? null)
    .then(logo => { cached = { key, logo }; return logo; })
    .catch(() => null)
    .finally(() => { inflight = null; });
  inflight = { key, promise };
  return promise;
}

export function useInstitutionLogo(): string | null {
  const { user } = useAuth();
  const key = user && user.role !== 'admin' && user.institution_id ? `${user.id}:${user.institution_id}` : '';
  const [state, setState] = useState<{ key: string; logo: string | null } | null>(null);

  useEffect(() => {
    if (!key) return;
    let alive = true;
    if (cached?.key !== key) fetchLogo(key).then(logo => { if (alive) setState({ key, logo }); });
    const onUpdate = (e: Event) => {
      const logo = (e as CustomEvent).detail?.logo_url ?? null;
      cached = { key, logo };
      setState({ key, logo });
    };
    window.addEventListener('institution-config-updated', onUpdate);
    return () => { alive = false; window.removeEventListener('institution-config-updated', onUpdate); };
  }, [key]);

  if (!key) return null;
  if (state?.key === key) return state.logo;
  return cached?.key === key ? cached.logo : null;
}
