import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PRIVACY_POLICY_PATH } from '../../data/legal';
import { apiErrorMessage } from '../../utils/validation';

interface PrivacyNotice {
  version: string;
  title: string;
  summary: string;
  purposes: string[];
  patterns: string;
  rights: string;
  legal_basis: string;
}

interface NoticeResponse {
  notice: PrivacyNotice;
  presented_at: string;
  acknowledged_at: string | null;
  acknowledged: boolean;
}

export default function StudentPrivacyNoticePage() {
  const navigate = useNavigate();
  const { updateUser } = useAuth();
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.get<NoticeResponse>('/privacy-notice/me')
      .then(({ data }) => {
        if (!active) return;
        if (data.acknowledged) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setNotice(data.notice);
      })
      .catch(err => {
        if (active) setError(apiErrorMessage(err, 'No se pudo cargar el aviso de privacidad.'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [navigate]);

  const continueToPlatform = async () => {
    if (!notice) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/privacy-notice/acknowledge', {
        version: notice.version,
        acknowledged: true,
      });
      updateUser({
        privacy_notice_acknowledged_version: notice.version,
        privacy_notice_required_version: notice.version,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar el acuse. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F7F6F3]">
      <Loader2 className="h-8 w-8 animate-spin text-[#0B6E99]" aria-label="Cargando aviso" />
    </div>;
  }

  return (
    <main className="min-h-screen bg-[#F7F6F3] px-4 py-8 sm:py-12">
      <section className="mx-auto max-w-2xl rounded-xl border border-[#E9E9E7] bg-white p-6 shadow-sm sm:p-9">
        <div className="mb-5 flex items-center gap-3 text-[#0B6E99]">
          <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-wide">Aviso de privacidad · versión {notice?.version}</span>
        </div>
        <h1 className="text-2xl font-bold text-[#191919]">{notice?.title ?? 'Aviso de privacidad'}</h1>
        {notice && (
          <div className="mt-5 space-y-5 text-sm leading-6 text-[#37352F]">
            <p>{notice.summary}</p>
            <div>
              <h2 className="mb-2 font-semibold text-[#191919]">¿Para qué se usan tus datos?</h2>
              <ul className="list-disc space-y-1 pl-5">
                {notice.purposes.map(purpose => <li key={purpose}>{purpose}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-[#191919]">Patrones neurodigitales</h2>
              <p>{notice.patterns}</p>
            </div>
            <div>
              <h2 className="mb-1 font-semibold text-[#191919]">Tus derechos</h2>
              <p>{notice.rights}</p>
            </div>
            <p className="rounded-md border border-[#D8E9F4] bg-[#F3F9FC] p-3">{notice.legal_basis}</p>
          </div>
        )}
        <div className="mt-6 flex flex-col gap-3 border-t border-[#E9E9E7] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <Link to={PRIVACY_POLICY_PATH} className="text-sm font-medium text-[#2E6FDB] underline underline-offset-2">
            Consultar la Política de Privacidad completa
          </Link>
          <button type="button" onClick={continueToPlatform} disabled={!notice || submitting}
            className="rounded-md bg-[#0B6E99] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#095A7D] disabled:cursor-not-allowed disabled:opacity-50">
            {submitting ? 'Guardando…' : 'He leído el aviso, continuar'}
          </button>
        </div>
        {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-[#B42318]">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </p>}
      </section>
    </main>
  );
}
