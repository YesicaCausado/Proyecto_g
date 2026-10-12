/**
 * useConsents — consentimientos de cámara y micrófono del usuario.
 *
 * Fuente: GET/POST/DELETE /api/v1/consents (backend/app/api/consents.py).
 * Los textos (y su versión) vienen del backend, que es quien los registra.
 * La cámara y el micrófono solo se activan si `granted(tipo)` es true.
 */
import { useCallback, useEffect, useState } from 'react';
import api, { invalidateApiCache } from '../services/api';

export type ConsentType = 'camara_facial' | 'microfono_voz';

export interface ConsentDocument {
  version: string;
  title: string;
  purpose: string;
  processed: string[];
  not_stored: string[];
  revocation: string;
  voluntary: string;
  minors: string;
}

export interface ConsentState {
  granted: boolean;
  version: string | null;
  granted_at: string | null;
  current_version: string;
  document: ConsentDocument;
}

type ConsentMap = Record<ConsentType, ConsentState>;

/** Autorización del acudiente (estudiantes menores o sin fecha de nacimiento). */
export interface GuardianState {
  required: boolean;
  authorized: boolean;
  blocked: boolean;
  message: string | null;
}

function errorText(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (!err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}

export function useConsents() {
  const [consents, setConsents] = useState<ConsentMap | null>(null);
  const [guardian, setGuardian] = useState<GuardianState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    invalidateApiCache('/consents');
    try {
      const res = await api.get('/consents/me');
      setConsents(res.data.consents);
      setGuardian(res.data.guardian ?? null);
    } catch (err) {
      setError(errorText(err, 'No se pudo consultar tu consentimiento.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Registra la aceptación explícita de la versión que el usuario leyó. */
  const accept = useCallback(async (type: ConsentType, version: string) => {
    const res = await api.post('/consents', { consent_type: type, version, accepted: true });
    invalidateApiCache('/consents');
    setConsents(res.data.consents);
    return res.data.consents[type] as ConsentState;
  }, []);

  const revoke = useCallback(async (type: ConsentType) => {
    const res = await api.delete(`/consents/${type}`);
    invalidateApiCache('/consents');
    setConsents(res.data.consents);
  }, []);

  const requestAuthorization = useCallback(async (type: ConsentType) => {
    const res = await api.post('/consents/request-authorization', { consent_type: type });
    return res.data as { requested: boolean; message: string };
  }, []);

  const granted = useCallback((type: ConsentType) => !!consents?.[type]?.granted, [consents]);

  return { consents, guardian, loading, error, load, accept, revoke, requestAuthorization, granted, errorText };
}
