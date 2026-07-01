import { useState } from 'react';
import { Lock, Shield, Smartphone, LogOut, Eye, EyeOff, CheckCircle, AlertTriangle, Clock, Globe, Monitor } from 'lucide-react';

const MOCK_SESSIONS = [
  { id: 1, device: 'Chrome 126 — Windows 11',    icon: Monitor, ip: '192.168.1.10', location: 'Bogotá, Colombia', lastActive: 'Ahora mismo',    current: true  },
  { id: 2, device: 'Firefox 127 — MacOS',         icon: Monitor, ip: '192.168.1.45', location: 'Bogotá, Colombia', lastActive: 'Hace 2 horas',   current: false },
  { id: 3, device: 'Chrome Mobile — Android 14',  icon: Smartphone, ip: '181.55.12.3', location: 'Medellín, Colombia', lastActive: 'Ayer 15:30', current: false },
];

const MOCK_LOGIN_HISTORY = [
  { date: '2026-07-01 08:58', ip: '192.168.1.10', browser: 'Chrome 126', status: 'exitoso',  location: 'Bogotá' },
  { date: '2026-06-30 09:12', ip: '192.168.1.10', browser: 'Chrome 126', status: 'exitoso',  location: 'Bogotá' },
  { date: '2026-06-29 08:45', ip: '192.168.1.45', browser: 'Firefox 127',status: 'exitoso',  location: 'Bogotá' },
  { date: '2026-06-28 07:30', ip: '201.20.33.11', browser: 'Edge 125',   status: 'fallido',  location: 'Cali' },
  { date: '2026-06-27 09:05', ip: '192.168.1.10', browser: 'Chrome 126', status: 'exitoso',  location: 'Bogotá' },
];

export default function SeguridadTab() {
  const [sessions, setSessions] = useState(MOCK_SESSIONS);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwError, setPwError] = useState('');

  const revokeSession = (id: number) => {
    if (window.confirm('¿Cerrar esta sesión en el dispositivo remoto?')) {
      setSessions(prev => prev.filter(s => s.id !== id));
    }
  };

  const revokeAllSessions = () => {
    if (window.confirm('¿Cerrar TODAS las sesiones excepto la actual? Todos los dispositivos deberán iniciar sesión nuevamente.')) {
      setSessions(prev => prev.filter(s => s.current));
    }
  };

  const handleChangePassword = () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { setPwError('Completa todos los campos.'); return; }
    if (pwForm.newPw.length < 8) { setPwError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Las contraseñas no coinciden.'); return; }
    setPwError('');
    setPwSuccess('¡Contraseña actualizada exitosamente!');
    setPwForm({ current: '', newPw: '', confirm: '' });
    setShowPasswordForm(false);
    setTimeout(() => setPwSuccess(''), 4000);
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

      {/* ── Sesiones activas ── */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#191919] flex items-center gap-2">
            <Globe className="w-4 h-4 text-[#787774]" /> Sesiones activas
          </h3>
          {sessions.filter(s => !s.current).length > 0 && (
            <button onClick={revokeAllSessions}
              className="flex items-center gap-1.5 text-xs text-[#E03E3E] hover:underline font-medium">
              <LogOut className="w-3.5 h-3.5" /> Cerrar todas las demás
            </button>
          )}
        </div>
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className={`flex items-center justify-between p-3.5 rounded-lg border ${s.current ? 'border-[#A6DDD6] bg-[#EEF8F6]' : 'border-[#E9E9E7] bg-white'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-md flex items-center justify-center ${s.current ? 'bg-[#0F7B6C]/10' : 'bg-[#F7F6F3]'}`}>
                  <s.icon className={`w-5 h-5 ${s.current ? 'text-[#0F7B6C]' : 'text-[#787774]'}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#191919]">
                    {s.device} {s.current && <span className="ml-2 text-[10px] bg-[#0F7B6C] text-white px-1.5 py-0.5 rounded-full font-bold">Actual</span>}
                  </p>
                  <p className="text-xs text-[#787774]">{s.ip} · {s.location} · {s.lastActive}</p>
                </div>
              </div>
              {!s.current && (
                <button onClick={() => revokeSession(s.id)}
                  className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#E03E3E] transition-colors font-medium">
                  <LogOut className="w-3.5 h-3.5" /> Cerrar
                </button>
              )}
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
          <p className="text-sm text-[#787774]">Última actualización: <span className="text-[#37352F] font-medium">hace 45 días</span></p>
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
                  <button type="button" onClick={field.toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#AEADAB] hover:text-[#787774]">
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
            <button onClick={handleChangePassword}
              className="w-full py-2.5 bg-[#6940A5] text-white text-sm font-medium rounded-md hover:bg-[#5A358F] transition-colors">
              Guardar nueva contraseña
            </button>
          </div>
        )}
      </section>

      {/* ── Autenticación en dos pasos ── */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-9 h-9 rounded-md flex items-center justify-center ${twoFAEnabled ? 'bg-[#EEF8F6]' : 'bg-[#F7F6F3]'}`}>
              <Shield className={`w-5 h-5 ${twoFAEnabled ? 'text-[#0F7B6C]' : 'text-[#787774]'}`} />
            </div>
            <div>
              <h3 className="font-semibold text-[#191919]">Autenticación en dos pasos (2FA)</h3>
              <p className="text-xs text-[#787774] mt-0.5">Agrega una capa adicional de seguridad con una app como Google Authenticator.</p>
              {twoFAEnabled && <p className="text-xs text-[#0F7B6C] font-medium mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Activo y configurado</p>}
            </div>
          </div>
          <button
            onClick={() => setTwoFAEnabled(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${twoFAEnabled ? 'bg-[#0F7B6C]' : 'bg-[#E9E9E7]'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${twoFAEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>

      {/* ── Historial de inicios de sesión ── */}
      <section className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#787774]" />
          <h3 className="font-semibold text-[#191919]">Historial de inicios de sesión</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
            <tr>
              {['Fecha y hora','IP','Navegador','Ubicación','Estado'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {MOCK_LOGIN_HISTORY.map((h, i) => (
              <tr key={i} className="hover:bg-[#F7F6F3]/50 transition-colors">
                <td className="px-4 py-3 text-xs text-[#37352F] font-mono">{h.date}</td>
                <td className="px-4 py-3 text-xs font-mono text-[#787774]">{h.ip}</td>
                <td className="px-4 py-3 text-xs text-[#787774]">{h.browser}</td>
                <td className="px-4 py-3 text-xs text-[#787774]">{h.location}</td>
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
      </section>
    </div>
  );
}
