import { useState, useRef, useEffect } from 'react';
import {
  Camera, Lock, Bell, Eye, EyeOff, CheckCircle, XCircle, LogOut, Hash, Shield, Calendar, Save, Building2,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { institutionLabel } from '../utils/institution';
import { FieldError } from './FieldError';
import { useFieldErrors } from '../hooks/useFieldErrors';
import { fieldA11y, focusFirstInvalid } from '../utils/formFields';
import { PASSWORD_MAX, PASSWORD_RULES, passesAllPasswordRules } from '../data/passwordRules';
import {
  apiErrorMessage, normalizeEmail, normalizePersonName, validateEmail, validateFile, validatePersonName,
} from '../utils/validation';

// Foto de perfil: se comprime en el navegador a JPG (el backend acepta hasta 3 MB).
const PHOTO_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

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
  nuevaActividad: { label: 'Nueva actividad', sub: 'NeuroBots asignados o completados, evaluaciones, alertas y actividad de tus grupos' },
  mensajeDirecto: { label: 'Mensaje directo', sub: 'Cuando recibes un mensaje' },
};

// Se guardan en el servidor (/notifications/preferences): si una opción está
// desactivada, no se crean notificaciones de ese grupo para el usuario.
function fromApi(data: { nueva_actividad?: boolean; mensaje_directo?: boolean }): Prefs {
  return {
    nuevaActividad: data.nueva_actividad ?? true,
    mensajeDirecto: data.mensaje_directo ?? true,
  };
}

export default function ProfileSettings({
  role,
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

  const [prefs, setPrefs] = useState<Prefs>({ ...DEFAULT_PREFS });
  const [prefsState, setPrefsState] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    api.get('/notifications/preferences', { params: { _t: Date.now() } })
      .then(res => { setPrefs(fromApi(res.data)); setPrefsState('listo'); })
      .catch(() => setPrefsState('error'));
  }, []);

  const [saved, setSaved] = useState<'perfil' | 'password' | 'prefs' | null>(null);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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
    setAvatarError('');
    const fileError = validateFile(f, { extensions: PHOTO_EXTENSIONS, maxBytes: PHOTO_MAX_BYTES, label: 'La foto' });
    if (fileError || !f.type.startsWith('image/')) {
      setAvatarError(fileError ?? 'Elige una imagen JPG, PNG, WebP o GIF.');
      return;
    }
    try { setAvatarPrev(await compressImage(f)); } catch {
      setAvatarError('No se pudo leer la imagen. Elige otro archivo JPG, PNG, WebP o GIF.');
    }
  };

  const profileFields = useFieldErrors({
    firstName: v => validatePersonName(v, { label: 'El nombre', max: 60 }),
    lastName: v => validatePersonName(v, { label: 'Los apellidos', max: 60, required: false })
      ?? (normalizePersonName(`${firstName} ${v}`).length > 100 ? 'El nombre completo no puede superar 100 caracteres.' : null),
    email: v => validateEmail(v),
  });

  const handleSaveProfile = async () => {
    setError('');
    if (!profileFields.validateAll({ firstName, lastName, email })) {
      focusFirstInvalid(profileRef.current);
      return;
    }
    try {
      const fullName = normalizePersonName(`${firstName} ${lastName}`);
      const payload: Record<string, unknown> = { full_name: fullName, email: normalizeEmail(email) };
      if (avatarPrev && avatarPrev !== user?.photo) payload.photo = avatarPrev;
      const { data: savedUser } = await api.patch('/auth/me', payload);
      updateUser({
        ...user,
        full_name: ((savedUser?.full_name ?? fullName) || user?.full_name || ''),
        email: savedUser?.email ?? (normalizeEmail(email) || user?.email || ''),
        photo: savedUser?.photo ?? avatarPrev ?? user?.photo ?? null,
      });
      setSaved('perfil');
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      setError(apiErrorMessage(e, 'No se pudo guardar el perfil. Inténtalo de nuevo.'));
    }
  };

  const pwdRulesOk = passesAllPasswordRules(newPwd);
  const pwdMatches = newPwd === confirmPwd;
  const canSavePassword = Boolean(currentPwd) && pwdRulesOk && pwdMatches && newPwd !== currentPwd;

  const savePassword = async () => {
    if (!canSavePassword) return;
    setError('');
    try {
      await api.post('/auth/change-password', { current_password: currentPwd, new_password: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      setSaved('password');
      setTimeout(() => setSaved(null), 2000);
    } catch (e: any) {
      // El backend explica el motivo (contraseña actual incorrecta, política…).
      setError(apiErrorMessage(e, 'No se pudo actualizar la contraseña. Verifica tu contraseña actual.'));
    }
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    setError('');
    try {
      const res = await api.put('/notifications/preferences', {
        nueva_actividad: prefs.nuevaActividad,
        mensaje_directo: prefs.mensajeDirecto,
      });
      setPrefs(fromApi(res.data));
      setSaved('prefs');
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError('No fue posible guardar tus preferencias de notificación.');
    } finally {
      setSavingPrefs(false);
    }
  };

  const roleLabel = ROLE_LABELS[role ?? user?.role ?? ''] ?? (user?.role ?? 'Usuario');
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

  const inputCls = 'w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0066FF]/30 focus:border-[#0066FF]';
  const labelCls = 'block text-xs font-semibold text-[#787774] uppercase mb-1.5';
  const errorCls = 'w-full px-3 py-2 border border-[#E03E3E] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E03E3E]/20 focus:border-[#E03E3E]';

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
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={e => handleAvatarChange(e.target.files)} />
          </div>
          <div>
            <p className="font-semibold text-[#191919]">{`${firstName} ${lastName}`.trim() || 'Nombre del usuario'}</p>
            <p className="text-sm text-[#787774]">{roleLabel} · @{user?.username}</p>
            <p className="text-xs text-[#AEADAB] mt-1">Clic en el ícono para cambiar la foto</p>
          </div>
        </div>

        <hr className="border-[#E9E9E7]" />

        <div ref={profileRef} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="profile-firstName" className={labelCls}>Nombre *</label>
            <input {...fieldA11y('profile-firstName', profileFields.errors.firstName)}
              value={firstName} maxLength={60} autoComplete="given-name"
              onChange={e => { setFirstName(e.target.value); profileFields.onChange('firstName', e.target.value); }}
              onBlur={e => profileFields.onBlur('firstName', e.target.value)}
              className={`${profileFields.errors.firstName ? errorCls : inputCls}`} />
            <FieldError id="profile-firstName" error={profileFields.errors.firstName} />
          </div>
          <div>
            <label htmlFor="profile-lastName" className={labelCls}>Apellidos</label>
            <input {...fieldA11y('profile-lastName', profileFields.errors.lastName)}
              value={lastName} maxLength={60} autoComplete="family-name"
              onChange={e => { setLastName(e.target.value); profileFields.onChange('lastName', e.target.value); }}
              onBlur={e => profileFields.onBlur('lastName', e.target.value)}
              className={`${profileFields.errors.lastName ? errorCls : inputCls}`} />
            <FieldError id="profile-lastName" error={profileFields.errors.lastName} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="profile-email" className={labelCls}>Correo electrónico *</label>
            <input {...fieldA11y('profile-email', profileFields.errors.email)}
              type="email" inputMode="email" autoComplete="email" maxLength={100} value={email}
              onChange={e => { setEmail(e.target.value); profileFields.onChange('email', e.target.value); }}
              onBlur={e => profileFields.onBlur('email', e.target.value)}
              className={`${profileFields.errors.email ? errorCls : inputCls}`} />
            <FieldError id="profile-email" error={profileFields.errors.email} />
          </div>
        </div>
        {avatarError && <FieldError id="profile-photo" error={avatarError} />}

        {/* Info de cuenta (solo lectura) */}
        <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><Hash className="w-4 h-4 text-[#787774]" /><span className="text-[#9B9A97]">Usuario:</span><span className="text-[#37352F] font-medium">@{user?.username}</span></div>
          <div className="flex items-center gap-2"><Shield className="w-4 h-4 text-[#787774]" /><span className="text-[#9B9A97]">Rol:</span><span className="text-[#37352F] font-medium capitalize">{roleLabel}</span></div>
          <div className="flex items-center gap-2 min-w-0"><Building2 className="w-4 h-4 text-[#787774] flex-shrink-0" /><span className="text-[#9B9A97]">Institución:</span><span className="text-[#37352F] font-medium truncate" title={institutionLabel(user)}>{institutionLabel(user)}</span></div>
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
            { key: 'current', label: 'Contraseña actual', value: currentPwd, set: setCurrentPwd, ph: 'Tu contraseña actual', icon: true, auto: 'current-password' },
            { key: 'new', label: 'Nueva contraseña', value: newPwd, set: setNewPwd, ph: 'Mínimo 8 caracteres', icon: false, auto: 'new-password' },
            { key: 'confirm', label: 'Confirmar contraseña', value: confirmPwd, set: setConfirmPwd, ph: 'Repite la nueva contraseña', icon: false, auto: 'new-password' },
          ].map(f => (
            <div key={f.key}>
              <label htmlFor={`pwd-${f.key}`} className={labelCls}>{f.label}</label>
              <div className="relative">
                {/* La contraseña no se recorta ni se transforma. */}
                <input id={`pwd-${f.key}`} type={showPwd ? 'text' : 'password'} value={f.value} onChange={e => f.set(e.target.value)}
                  autoComplete={f.auto} maxLength={PASSWORD_MAX} spellCheck={false} autoCapitalize="off"
                  aria-invalid={f.key === 'confirm' && confirmPwd && !pwdMatches ? true : undefined}
                  aria-describedby={f.key === 'new' ? 'pwd-rules' : f.key === 'confirm' && confirmPwd && !pwdMatches ? 'pwd-confirm-error' : undefined}
                  placeholder={f.ph} className={inputCls} />
                {f.icon && (
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    aria-label={showPwd ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-[#787774]">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              {f.key === 'new' && newPwd && (
                <ul id="pwd-rules" className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {PASSWORD_RULES.map(rule => {
                    const passed = rule.test(newPwd);
                    return (
                      <li key={rule.id} className={`flex items-center gap-1.5 text-xs ${passed ? 'text-[#0F7B6C]' : 'text-[#9B9A97]'}`}>
                        {passed ? <CheckCircle className="w-3.5 h-3.5" aria-hidden="true" /> : <XCircle className="w-3.5 h-3.5" aria-hidden="true" />}
                        {rule.label}<span className="sr-only">{passed ? ' (cumplido)' : ' (pendiente)'}</span>
                      </li>
                    );
                  })}
                  {currentPwd && newPwd === currentPwd && (
                    <li className="text-xs text-[#E03E3E] sm:col-span-2">La nueva contraseña debe ser diferente de la actual.</li>
                  )}
                </ul>
              )}
            </div>
          ))}
        </div>
        {newPwd && confirmPwd && !pwdMatches && <FieldError id="pwd-confirm" error="Las contraseñas no coinciden." />}
        <button onClick={savePassword}
          disabled={!canSavePassword}
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
                role="switch" aria-checked={val} aria-label={info.label}
                className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors after:absolute after:-inset-2.5 ${val ? 'bg-[#0066FF]' : 'bg-[#E9E9E7]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          );
        })}
        {prefsState === 'error' && (
          <p className="text-xs text-[#E03E3E]">No fue posible cargar tus preferencias. Recarga la página para intentarlo de nuevo.</p>
        )}
        <button onClick={savePrefs} disabled={prefsState !== 'listo' || savingPrefs}
          className={`disabled:opacity-60 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${saved === 'prefs' ? 'bg-[#0F7B6C] text-white' : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'}`}>
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
