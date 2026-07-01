import { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const RULES = [
  { id: 'len',     label: 'Mínimo 8 caracteres',       test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: 'Una letra mayúscula',        test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: 'Una letra minúscula',        test: (p: string) => /[a-z]/.test(p) },
  { id: 'digit',   label: 'Un número',                  test: (p: string) => /\d/.test(p) },
  { id: 'special', label: 'Un carácter especial (!@#…)',test: (p: string) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function ForceChangePassword() {
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [current,  setCurrent]  = useState('');
  const [newPwd,   setNewPwd]   = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showC,    setShowC]    = useState(false);
  const [showN,    setShowN]    = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState(false);

  const rulesPassed = RULES.every(r => r.test(newPwd));
  const matches     = newPwd === confirm && confirm.length > 0;
  const canSubmit   = rulesPassed && matches && current.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/v1/auth/change-password', {
        current_password: current,
        new_password: newPwd,
      });
      setSuccess(true);
      setTimeout(() => {
        const role = user?.role;
        if (role === 'super_profesor') navigate('/super');
        else if (role === 'profesor') navigate('/');
        else navigate('/');
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? 'Error al cambiar la contraseña');
    } finally { setLoading(false); }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-10 text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-[#EEF7F4] rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-[#0F7B6C]" />
          </div>
          <h2 className="text-xl font-bold text-[#191919] mb-2">¡Contraseña actualizada!</h2>
          <p className="text-sm text-[#787774]">Redirigiendo a tu panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center p-6">
      <div className="bg-white border border-[#E9E9E7] rounded-md p-8 w-full max-w-md">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-7">
          <div className="w-12 h-12 bg-[#F7F6F3] border border-[#E9E9E7] rounded-full flex items-center justify-center mb-3">
            <KeyRound className="w-6 h-6 text-[#37352F]" />
          </div>
          <h1 className="text-xl font-bold text-[#191919]">Cambia tu contraseña</h1>
          <p className="text-sm text-[#787774] mt-1">
            Es tu primer inicio de sesión. Debes establecer una contraseña segura antes de continuar.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Contraseña actual */}
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">Contraseña temporal actual</label>
            <div className="relative">
              <input
                type={showC ? 'text' : 'password'}
                value={current}
                onChange={e => setCurrent(e.target.value)}
                placeholder="Ingresa la contraseña temporal"
                className="w-full pr-10 pl-3 py-2.5 text-sm border border-[#E9E9E7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99]"
              />
              <button type="button" onClick={() => setShowC(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9A97] hover:text-[#787774]">
                {showC ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Nueva contraseña */}
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">Nueva contraseña</label>
            <div className="relative">
              <input
                type={showN ? 'text' : 'password'}
                value={newPwd}
                onChange={e => setNewPwd(e.target.value)}
                placeholder="Crea una contraseña segura"
                className="w-full pr-10 pl-3 py-2.5 text-sm border border-[#E9E9E7] rounded-md focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99]"
              />
              <button type="button" onClick={() => setShowN(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9A97] hover:text-[#787774]">
                {showN ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Reglas de contraseña */}
            {newPwd.length > 0 && (
              <div className="mt-3 space-y-1.5 bg-[#F7F6F3] rounded-md p-3">
                {RULES.map(r => {
                  const ok = r.test(newPwd);
                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle className="w-3.5 h-3.5 text-[#0F7B6C] shrink-0" />
                        : <XCircle className="w-3.5 h-3.5 text-[#9B9A97] shrink-0" />}
                      <span className={`text-xs ${ok ? 'text-[#0F7B6C]' : 'text-[#9B9A97]'}`}>{r.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Confirmar contraseña */}
          <div>
            <label className="block text-xs font-medium text-[#37352F] mb-1">Confirmar nueva contraseña</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repite la nueva contraseña"
              className={`w-full px-3 py-2.5 text-sm border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                confirm.length > 0 && !matches
                  ? 'border-[#E03E3E] focus:ring-[#FDEEEE]'
                  : 'border-[#E9E9E7] focus:ring-[#E5F3FF] focus:border-[#0B6E99]'
              }`}
            />
            {confirm.length > 0 && !matches && (
              <p className="text-xs text-[#E03E3E] mt-1">Las contraseñas no coinciden</p>
            )}
          </div>

          {error && (
            <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-md p-3 text-sm text-[#E03E3E]">
              {error}
            </div>
          )}

          <button type="submit" disabled={!canSubmit || loading}
            className="w-full py-3 bg-[#37352F] text-white rounded-md font-medium text-sm
              hover:bg-[#2F2D2B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors
              flex items-center justify-center gap-2">
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Guardando…</>
              : <><KeyRound className="w-4 h-4" />Establecer nueva contraseña</>}
          </button>
        </form>
      </div>
    </div>
  );
}
