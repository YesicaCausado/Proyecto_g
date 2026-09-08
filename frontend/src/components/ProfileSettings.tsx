import { useState, useRef, useEffect } from 'react';
import {
  Camera, Lock, Bell, Eye, EyeOff, CheckCircle, LogOut, Hash, Shield, Calendar, Save,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * PerfilSettings — Componente único y reutilizable de configuración de perfil.
 *
 * Un solo bloque sencillo (sin pestañas) usado en los tres paneles de rol:
 * Super Profesor, Profesor y Estudiante. Cada campo mostrado se guarda de verdad
 * contra el backend (`/auth/me` y `/auth/change-password`) o en preferencias.
 * La información se obtiene del usuario autenticado (contexto).
 */
interface ProfileSettingsProps {
  role?: string;
  prefsStorageKey?: string;
}

const ROLE_LABELS: Record<string, string> = {
  super_profesor: 'Super Profesor',
  profesor:       'Profesor',
  estudiante:     'Estudiante',
  admin:          'Administrador',
};

const DEFAULT_PREFS = { nuevaActividad: true, mensajeDirecto: true };
type Prefs = typeof DEFAULT_PREFS;

const PREF_LABELS: Record<keyof Prefs, { label: string; sub: string }> = {
  nuevaActividad: { label: 'Nueva actividad', sub: 'Cuando hay actividad en tus clases' },
  mensajeDirecto: { label: 'Mensaje directo', sub: 'Cuando recibes un mensaje' },
};

export default function ProfileSettings({
  role,
  prefsStorageKey = 'neurolearn_notifications',
}: ProfileSettingsProps) {
  const { user, updateUser, logout } = useAuth();
  const [avatarPrev, setAvatarPrev] = useState<string | null>(user?.photo ?? null);

  const splitName = (full: string | null | undefined) => {
    const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
    return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
  };
  const initial = splitName(user?.full_name);

  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(user?.email ?? '');

  const [showPwd, setShowPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  const [prefs, setPrefs] = useState<Prefs>(() => {
    const stored = localStorage.getItem(prefsStorageKey);
    if (!stored) return { ...DEFAULT_PREFS };
    try { return { ...DEFAULT_PREFS, ...JSON.parse(stored) }; }
    catch { return { ...DEFAULT_PREFS }; }
  });

  const [saved, setSaved] = useState<'perfil' | 'password' | 'prefs' | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.full_name) {
      const parts = splitName(user.full_name);
      setFirstName(parts.firstName);
      setLastName(parts.lastName);
    }
    if (user?.email !== undefined && user?.email !== email) setEmail(user.email);
    if (user?.photo) setAvatarPrev(user.photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.full_name, user?.email, user?.photo]);

  const compressImage = (file: File, maxDim = 512, quality = 0.85): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          URL.revokeObjectURL(url);
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('image')); return; }
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let out = canvas.toDataURL('image/jpeg', quality);
          if (out.length > 3_000_000) out = canvas.toDataURL('image/jpeg', 0.6);
          resolve(out);
        } catch { reject(new Error('image')); }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); };
      img.src = url;
    });

  const handleAvatarChange = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try { setAvatarPrev(await compressImage(f)); } catch { /* keep previous */ }
  };

  const handleSaveProfile = async () => {
    setError('');
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const payload: Record<string, unknown> = { full_name: fullName, email: email.trim() };
      if (avatarPrev && avatarPrev !== user?.photo) payload.photo = avatarPrev;
      const { data: savedUser } = await api.patch('/auth/me', payload);
      updateUser({
        ...user,
        full_name: ((savedUser?.full_name ?? fullName) || user?.full_name || ''),
        email: email.trim() || user?.email || '',
        photo: savedUser?.photo ?? avatarPrev ?? user?.photo ?? null,
      });
      setSaved('perfil');
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No se pudo guardar el perfil. Inténtalo de nuevo.');
    }
  };

  const strength = (pwd: string) =>
    [pwd.length >= 8, /[A-Z]/.test(pwd), /[0-9]/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length;
  const pwdStrength = strength(newPwd);

  const savePassword = async () => {
    if (!currentPwd || !newPwd || newPwd !== confirmPwd || pwdStrength < 2) return;
    setError('');
    try {
      await api.post('/auth/change-password', { current_password: currentPwd, new_password: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setSaved('password');
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError('No se pudo actualizar la contraseña. Verifica tu contraseña actual.');
    }
  };

  const savePrefs = () => {
    localStorage.setItem(prefsStorageKey, JSON.stringify(prefs));
    setSaved('prefs');
    setTimeout(() => setSaved(null), 2000);
  };

  const roleLabel = ROLE_LABELS[role ?? user?.role ?? ''] ?? (user?.role ?? 'Usuario');
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const inputCls = 'w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]';
  const labelCls = 'block text-xs font-semibold text-[#787774] uppercase mb-1.5';

  return (
    <div className="max-w-2xl space-y-5">
      {/* Perfil */}
      <section className="bg-white border border-[#E9E9E7] rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#E9E9E7] bg-[#EEF3FD] flex items-center justify-center">
              {avatarPrev
                ? <img src={avatarPrev} className="w-full h-full object-cover" alt="foto de perfil" />
                : <span className="text-3xl font-bold text-[#0066FF]">{(firstName || 'U').charAt(0).toUpperCase()}</span>}
            </div>
            <button onClick={() => fileRef.current?.click()} title="Cambiar foto"
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#0066FF] text-white rounded-full flex items-center justify-center hover:bg-[#0052CC] transition-colors shadow-sm">
              <Camera className="w-3.5 h-3.5" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleAvatarChange(e.target.files)} />
          </div>
          <div>
            <p className="font-semibold text-[#191919]">{`${firstName} ${lastName}`.trim() || 'Nombre del usuario'}</p>
            <p className="text-sm text-[#787774]">{roleLabel} · @{user?.username}</p>
            <p className="text-xs text-[#AEADAB] mt-1">Clic en el ícono para cambiar la foto</p>
          </div>
        </div>

        <hr className="border-[#E9E9E7]" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Nombre</label>
            <input value={firstName} onChange={e => setFirstName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Apellidos</label>
            <input value={lastName} onChange={e => setLastName(e.target.value)} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Correo electrónico</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
        </div>

        {/* Info de cuenta (solo lectura) */}
        <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><Hash className="w-4 h-4 text-[#787774]" /><span className="text-[#9B9A97]">Usuario:</span><span className="text-[#37352F] font-medium">@{user?.username}</span></div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[#787774]" /><span className="text-[#9B9A97]">Rol:</span><span className="text-[#37352F] font-medium capitalize">{roleLabel}</span></div>
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-[#787774]" /><span className="text-[#9B9A97]">Cuenta creada:</span><span className="text-[#37352F] font-medium">{joined}</span></div>
        </div>

        <button onClick={handleSaveProfile}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${saved === 'perfil' ? 'bg-[#0F7B6C] text-white' : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'}`}>
          {saved === 'perfil' ? <><CheckCircle className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar cambios</>}
        </button>
      </section>

      {/* Cambio de contraseña */}
      <section className="bg-white border border-[#E9E9E7] rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-[#191919] flex items-center gap-2"><Lock className="w-4 h-4 text-[#787774]" /> Cambiar contraseña</h3>
        <div className="grid grid-cols-1 gap-3">
          {[
            { key: 'current', label: 'Contraseña actual', value: currentPwd, set: setCurrentPwd, ph: 'Tu contraseña actual', icon: true },
            { key: 'new', label: 'Nueva contraseña', value: newPwd, set: setNewPwd, ph: 'Mínimo 8 caracteres', icon: false },
            { key: 'confirm', label: 'Confirmar contraseña', value: confirmPwd, set: setConfirmPwd, ph: 'Repite la nueva contraseña', icon: false },
          ].map(f => (
            <div key={f.key}>
              <label className={labelCls}>{f.label}</label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={f.value} onChange={e => f.set(e.target.value)}
                  placeholder={f.ph} className={inputCls} />
                {f.icon && (
                  <button onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787774]">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {f.key === 'new' && newPwd && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full ${i <= pwdStrength ? (pwdStrength >= 3 ? 'bg-[#0F7B6C]' : 'bg-[#D9730D]') : 'bg-[#E9E9E7]'}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-[#787774]">{['Muy débil','Débil','Regular','Fuerte','Muy fuerte'][pwdStrength]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {newPwd && confirmPwd && newPwd !== confirmPwd && <p className="text-xs text-[#E03E3E]">⚠ Las contraseñas no coinciden.</p>}
        <button onClick={savePassword}
          disabled={!currentPwd || !newPwd || newPwd !== confirmPwd || pwdStrength < 2}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${saved === 'password' ? 'bg-[#0F7B6C] text-white' : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'}`}>
          {saved === 'password' ? <><CheckCircle className="w-4 h-4" /> Contraseña actualizada</> : <><Shield className="w-4 h-4" /> Actualizar contraseña</>}
        </button>
      </section>

      {/* Preferencias */}
      <section className="bg-white border border-[#E9E9E7] rounded-xl p-6 space-y-4">
        <h3 className="font-semibold text-[#191919] flex items-center gap-2"><Bell className="w-4 h-4 text-[#787774]" /> Preferencias de notificación</h3>
        {(Object.entries(prefs) as Array<[keyof Prefs, boolean]>).map(([key, val]) => {
          const info = PREF_LABELS[key];
          return (
            <div key={key} className="flex items-center justify-between py-2 border-b border-[#F7F6F3] last:border-0">
              <div>
                <p className="text-sm font-medium text-[#191919]">{info.label}</p>
                <p className="text-xs text-[#787774] mt-0.5">{info.sub}</p>
              </div>
              <button onClick={() => setPrefs(p => ({ ...p, [key]: !p[key] }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-[#0066FF]' : 'bg-[#E9E9E7]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          );
        })}
        <button onClick={savePrefs}
          className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${saved === 'prefs' ? 'bg-[#0F7B6C] text-white' : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'}`}>
          {saved === 'prefs' ? <><CheckCircle className="w-4 h-4" /> Guardado</> : <><Save className="w-4 h-4" /> Guardar preferencias</>}
        </button>
      </section>

      {error && <p className="text-xs text-[#E03E3E]">⚠ {error}</p>}

      {/* Cerrar sesión */}
      <button onClick={logout}
        className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-[#E9E9E7] rounded-xl text-sm font-medium text-[#E03E3E] hover:bg-[#FDEEEE] transition-colors">
        <LogOut className="w-4 h-4" /> Cerrar sesión
      </button>
    </div>
  );
}
