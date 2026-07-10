/**
 * ResetPasswordPage — Establecer nueva contraseña con token del email
 * Se accede desde el enlace recibido por correo: /reset-password?token=xxx
 */
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import api from '../../services/api';

const RULES = [
  { id: 'len',     label: 'Mínimo 8 caracteres',        test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'Una letra mayúscula',         test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Una letra minúscula',         test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit',   label: 'Un número',                   test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'Un carácter especial (!@#…)', test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

type PageState = 'validating' | 'valid' | 'invalid' | 'success';

export default function ResetPasswordPage() {
  const navigate          = useNavigate();
  const [params]          = useSearchParams();
  const token             = params.get('token') ?? '';

  const [pageState, setPageState]   = useState<PageState>('validating');
  const [tokenError, setTokenError] = useState('');
  const [newPwd, setNewPwd]         = useState('');
  const [confirm, setConfirm]       = useState('');
  const [showNew, setShowNew]       = useState(false);
  const [showCon, setShowCon]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const rulesPassed = RULES.every(r => r.test(newPwd));
  const matches     = newPwd === confirm && confirm.length > 0;
  const canSubmit   = rulesPassed && matches && !loading;

  // Validar token al cargar la página
  useEffect(() => {
    if (!token) {
      setTokenError('No se encontró el token en el enlace. Solicita uno nuevo.');
      setPageState('invalid');
      return;
    }

    const validate = async () => {
      try {
        await api.get(`/auth/reset-password/validate?token=${token}`);
        setPageState('valid');
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail
          ?? 'El enlace es inválido o ha expirado.';
        setTokenError(msg);
        setPageState('invalid');
      }
    };

    validate();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError('');
    setLoading(true);

    try {
      await api.post('/auth/reset-password', {
        token,
        new_password: newPwd,
      });
      setPageState('success');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
        ?? 'Error al restablecer la contraseña. Intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Validando token ───────────────────────────────────────────
  if (pageState === 'validating') {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#37352F]" />
          <p className="text-sm text-[#787774]">Verificando enlace…</p>
        </div>
      </div>
    );
  }

  // ── Token inválido o expirado ─────────────────────────────────
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-[#FDEEEE] rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-7 h-7 text-[#E03E3E]" />
          </div>
          <h2 className="text-lg font-bold text-[#191919] mb-2">
            Enlace inválido
          </h2>
          <p className="text-sm text-[#787774] mb-6">{tokenError}</p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors"
          >
            Solicitar nuevo enlace
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-1.5 mt-3 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  // ── Contraseña restablecida con éxito ─────────────────────────
  if (pageState === 'success') {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-8 max-w-sm w-full text-center">
          <div className="w-14 h-14 bg-[#EEF7F4] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-[#0F7B6C]" />
          </div>
          <h2 className="text-xl font-bold text-[#191919] mb-2">
            ¡Contraseña restablecida!
          </h2>
          <p className="text-sm text-[#787774]">
            Tu contraseña fue actualizada correctamente.
            <br />Redirigiendo al inicio de sesión…
          </p>
        </div>
      </div>
    );
  }

  // ── Formulario principal ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center px-4">
      <div className="bg-white border border-[#E9E9E7] rounded-md p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-12 h-12 bg-[#F7F6F3] border border-[#E9E9E7] rounded-full flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-[#37352F]" />
          </div>
          <h1 className="text-xl font-bold text-[#191919]">
            Establece tu nueva contraseña
          </h1>
          <p className="text-sm text-[#787774] mt-1">
            Debe ser diferente a tu contraseña anterior
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Nueva contraseña */}
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Crea una contraseña segura"
                autoFocus
                className="w-full pr-10 pl-3 py-2.5 text-sm border border-[#E9E9E7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99]"
              />
              <button
                type="button"
                onClick={() => setShowNew(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9A97] hover:text-[#787774]"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Indicador de fortaleza */}
            {newPwd.length > 0 && (
              <div className="mt-3 space-y-1.5 bg-[#F7F6F3] rounded-md p-3">
                {RULES.map(r => {
                  const ok = r.test(newPwd);
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
                        : <XCircle    className="w-3.5 h-3.5 text-[#9B9A97] shrink-0" />
                      }
                      <span className={`text-xs ${ok ? 'text-[#0F7B6C]' : 'text-[#9B9A97]'}`}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">
              Confirmar nueva contraseña
            </label>
            <div className="relative">
              <input
                type={showCon ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repite la nueva contraseña"
                className={`w-full pr-10 pl-3 py-2.5 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  confirm.length > 0 && !matches
                    ? 'border-[#E03E3E] focus:ring-[#FDEEEE]'
                    : 'border-[#E9E9E7] focus:ring-[#E5F3FF] focus:border-[#0B6E99]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCon(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9A97] hover:text-[#787774]"
              >
                {showCon ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm.length > 0 && !matches && (
              <p className="text-xs text-[#E03E3E] mt-1">
                Las contraseñas no coinciden
              </p>
            )}
          </div>

          {error && (
            <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-md p-3 text-sm text-[#E03E3E]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full py-3 bg-[#37352F] text-white rounded-md font-medium text-sm hover:bg-[#2F2D2B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</>
              : <><KeyRound className="w-4 h-4" />Restablecer contraseña</>
            }
          </button>
        </form>

        <div className="flex justify-center mt-5">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}