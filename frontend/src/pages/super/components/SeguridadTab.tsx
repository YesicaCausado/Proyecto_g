import { useState, useEffect } from 'react';
import { Lock, LogOut, Eye, EyeOff, CheckCircle, AlertTriangle, Clock, Globe, Loader2 } from 'lucide-react';
import api, { invalidateApiCache } from '../../../services/api';

// Usuarios de la institución que iniciaron sesión en las últimas 24 h.
interface ActiveSession {
  id: number; user: string; role: string; lastActive: string; current: boolean; revoked: boolean;
}

interface LoginEntry {
  date: string; user: string; ip: string; status: 'exitoso' | 'fallido';
}

const ROLE_LABEL: Record<string, string> = {
  super_profesor: 'Súper Profesor', profesor: 'Profesor', estudiante: 'Estudiante', admin: 'Administrador',
};

const fmtDate = (iso: string) => (iso ?? '').replace('T', ' ').slice(0, 16);

export default function SeguridadTab() {
  const [sessions, setSessions]           = useState<ActiveSession[]>([]);
  const [loginHistory, setLoginHistory]   = useState<LoginEntry[]>([]);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm]               = useState({ current: '', newPw: '', confirm: '' });
  const [showCurrent, setShowCurrent]     = useState(false);
  const [showNew, setShowNew]             = useState(false);
  const [pwSuccess, setPwSuccess]         = useState('');
  const [pwError, setPwError]             = useState('');
  const [pwLoading, setPwLoading]         = useState(false);

  const [loadError, setLoadError]         = useState('');
  const [busy, setBusy]                   = useState<number | 'me' | null>(null);
  const [sessionMsg, setSessionMsg]       = useState('');

  const loadSecurity = () => {
    setLoadError('');
    return api.get('/super/stats/security')
      .then(r => {
        const raw = r.data ?? {};
        setSessions(
          (raw.active_sessions ?? []).map((s: any): ActiveSession => ({
            id:         s.id,
            user:       s.user ?? '—',
            role:       ROLE_LABEL[s.role] ?? s.role ?? '',
            lastActive: fmtDate(s.last_login),
            current:    Boolean(s.current),
            revoked:    Boolean(s.revoked),
          }))
        );
        setLoginHistory(
          (raw.login_history ?? []).map((h: any): LoginEntry => ({
            date:   fmtDate(h.created_at),
            user:   h.user ?? '—',
            ip:     h.ip ?? '—',
            // Antes los intentos fallidos aparecían como «exitoso».
            status: h.action === 'login_failed' ? 'fallido' : 'exitoso',
          }))
        );
      })
      .catch(err => {
        setSessions([]); setLoginHistory([]);
        setLoadError(err?.response?.data?.detail || 'No se pudo cargar la información de seguridad.');
      });
  };

  useEffect(() => { loadSecurity(); }, []);

  // Cierre real: los tokens de ese usuario dejan de funcionar en el servidor.
  const revokeSession = async (s: ActiveSession) => {
    if (!window.confirm(`¿Cerrar todas las sesiones de ${s.user}? Tendrá que volver a iniciar sesión.`)) return;
    setBusy(s.id);
    setSessionMsg('');
    try {
      await api.post(`/super/users/${s.id}/revoke-sessions`);
      invalidateApiCache('/super/stats/security');
      setSessionMsg(`Se cerraron las sesiones de ${s.user}.`);
      await loadSecurity();
    } catch (err: any) {
      setSessionMsg(err?.response?.data?.detail || 'No se pudo cerrar la sesión.');
    } finally {
      setBusy(null);
    }
  };

  // Cierra las sesiones propias en los demás dispositivos; este sigue conectado.
  const revokeMyOtherSessions = async () => {
    if (!window.confirm('¿Cerrar tu sesión en todos los demás dispositivos?')) return;
    setBusy('me');
    setSessionMsg('');
    try {
      const { data } = await api.post('/auth/logout-all');
      if (data?.access_token) localStorage.setItem('token', data.access_token);
      setSessionMsg('Se cerró tu sesión en los demás dispositivos.');
    } catch (err: any) {
      setSessionMsg(err?.response?.data?.detail || 'No se pudieron cerrar tus otras sesiones.');
    } finally {
      setBusy(null);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { setPwError('Completa todos los campos.'); return; }
    if (pwForm.newPw.length < 8) { setPwError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Las contraseñas no coinciden.'); return; }
    setPwError('');
    setPwLoading(true);
    try {
      await api.post('/auth/change-password', {
        current_password: pwForm.current,
        new_password: pwForm.newPw,
      });
      setPwSuccess('¡Contraseña actualizada exitosamente!');
      setPwForm({ current: '', newPw: '', confirm: '' });
      setShowPasswordForm(false);
      setTimeout(() => setPwSuccess(''), 4000);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'No se pudo actualizar la contraseña.';
      setPwError(msg);
    } finally {
      setPwLoading(false);
    }
  };

  const passwordStrength = (pw: string) => {
    let score = 0;
    if (pw.length >= 8)   score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };
  const strength = passwordStrength(pwForm.newPw);
  const strengthColors = ['bg-[#E03E3E]', 'bg-[#D9730D]', 'bg-yellow-400', 'bg-[#0F7B6C]'];
  const strengthLabels = ['Muy débil', 'Débil', 'Media', 'Fuerte'];

  return (
    <div className="space-y-6 max-w-3xl">

      {/* Mensajes globales */}
      {pwSuccess && (
        <div className="p-3 bg-[#EEF8F6] border border-[#A6DDD6] rounded-md flex items-center gap-2 text-sm text-[#0F7B6C] font-medium">
          <CheckCircle className="w-4 h-4" /> {pwSuccess}
        </div>
      )}

      {/* ── Sesiones ── */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
          <h3 className="font-semibold text-[#191919] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#787774]" /> Usuarios conectados (últimas 24 h)
          </h3>
          <button onClick={revokeMyOtherSessions} disabled={busy === 'me'}
            className="flex items-center gap-1.5 text-xs text-[#E03E3E] hover:underline font-medium disabled:opacity-50">
            {busy === 'me' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Cerrar mis otras sesiones
          </button>
        </div>
        <p className="text-xs text-[#787774] mb-4">
          Si un usuario dejó la sesión abierta en un equipo compartido, puedes cerrársela aquí.
        </p>
        {sessionMsg && <p className="text-xs text-[#37352F] bg-[#F7F6F3] rounded-md px-3 py-2 mb-3">{sessionMsg}</p>}
        {loadError && <p className="text-xs text-[#E03E3E] mb-3">{loadError}</p>}
        <div className="space-y-3">
          {sessions.length === 0 && !loadError && (
            <p className="text-xs text-[#AEADAB]">Nadie de la institución ha iniciado sesión en las últimas 24 horas.</p>
          )}
          {sessions.map(s => (
            <div key={s.id} className={`flex items-center justify-between p-3.5 rounded-lg border ${s.current ? 'border-[#A6DDD6] bg-[#EEF8F6]' : 'border-[#E9E9E7] bg-white'}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#191919]">
                  {s.user}
                  {s.current && <span className="ml-2 text-[10px] bg-[#0F7B6C] text-white px-1.5 py-0.5 rounded-full font-bold">Tú</span>}
                </p>
                <p className="text-xs text-[#787774]">{s.role} · último inicio {s.lastActive}</p>
              </div>
              {!s.current && (s.revoked ? (
                <span className="text-xs text-[#AEADAB]">Sesión cerrada</span>
              ) : (
                <button onClick={() => revokeSession(s)} disabled={busy === s.id}
                  className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#E03E3E] transition-colors font-medium disabled:opacity-50">
                  {busy === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />} Cerrar sesión
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── Contraseña ── */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#191919] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#787774]" /> Contraseña
          </h3>
          <button onClick={() => setShowPasswordForm(v => !v)}
            className="text-xs font-medium text-[#6940A5] hover:underline">
            {showPasswordForm ? 'Cancelar' : 'Cambiar contraseña'}
          </button>
        </div>
        {!showPasswordForm ? (
          <p className="text-sm text-[#787774]">Última actualización: <span className="text-[#37352F] font-medium">—</span></p>
        ) : (
          <div className="space-y-4 max-w-sm">
            {pwError && (
              <div className="p-3 bg-[#FDEEEE] border border-[#F4BDBD] rounded-md flex items-center gap-2 text-xs text-[#E03E3E]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {pwError}
              </div>
            )}
            {[
              { label: 'Contraseña actual', key: 'current', show: showCurrent, toggle: () => setShowCurrent(v=>!v) },
              { label: 'Nueva contraseña',  key: 'newPw',   show: showNew,     toggle: () => setShowNew(v=>!v) },
              { label: 'Confirmar nueva',   key: 'confirm', show: showNew,     toggle: () => setShowNew(v=>!v) },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-semibold text-[#787774] mb-1 uppercase tracking-wide">{field.label}</label>
                <div className="relative">
                  <input
                    type={field.show ? 'text' : 'password'}
                    value={(pwForm as any)[field.key]}
                    onChange={e => setPwForm({...pwForm, [field.key]: e.target.value})}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm outline-none focus:ring-1 focus:ring-[#6940A5] pr-10"
                  />
                  <button type="button" onClick={field.toggle} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#AEADAB] hover:text-[#787774]">
                    {field.show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ))}
            {/* Indicador de fortaleza */}
            {pwForm.newPw && (
              <div>
                <div className="flex gap-1 mb-1">
                  {Array.from({length: 4}).map((_,i) => (
                    <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < strength ? strengthColors[strength-1] : 'bg-[#E9E9E7]'}`} />
                  ))}
                </div>
                <p className="text-xs text-[#787774]">{strengthLabels[strength-1] ?? 'Ingresa una contraseña'}</p>
              </div>
            )}
            <button onClick={handleChangePassword} disabled={pwLoading}
              className={`w-full py-2.5 bg-[#6940A5] text-white text-sm font-medium rounded-md hover:bg-[#5A358F] transition-colors ${pwLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {pwLoading ? 'Guardando…' : 'Guardar nueva contraseña'}
            </button>
          </div>
        )}
      </section>

      {/* ── Historial de inicios de sesión ── */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#787774]" />
          <h3 className="font-semibold text-[#191919]">Historial de inicios de sesión</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              {['Fecha y hora','Usuario','IP','Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {loginHistory.map((h: LoginEntry, i: number) => (
              <tr key={i} className="hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-4 py-3 text-xs text-[#37352F] font-mono">{h.date}</td>
                <td className="px-4 py-3 text-xs text-[#37352F]">{h.user}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#787774]">{h.ip}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${h.status === 'exitoso' ? 'bg-[#EEF8F6] text-[#0F7B6C]' : 'bg-[#FDEEEE] text-[#E03E3E]'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${h.status === 'exitoso' ? 'bg-[#0F7B6C]' : 'bg-[#E03E3E]'}`} />
                    {h.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loginHistory.length === 0 && (
          <p className="px-5 py-6 text-xs text-[#AEADAB]">No hay inicios de sesión registrados en los últimos 30 días.</p>
        )}
      </section>
    </div>
  );
}
