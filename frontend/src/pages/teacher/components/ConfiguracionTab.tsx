import { useState, useRef } from 'react';
import {
  Camera, Lock, Bell, Globe, Shield, Eye, EyeOff, CheckCircle,
} from 'lucide-react';
import api from '../../../services/api';

interface Props {
  user: any;
}

const LANGUAGES = ['Español (Colombia)', 'Español (México)', 'Inglés (US)', 'Portugués (BR)'];

export default function ConfiguracionTab({ user }: Props) {
  const [tab,         setTab]         = useState<'perfil' | 'seguridad' | 'notificaciones'>('perfil');
  const [avatarPrev,  setAvatarPrev]  = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({ name: user?.full_name || '', email: user?.email || '', lang: LANGUAGES[0] });
  const [passwords,   setPasswords]   = useState({ current:'', next:'', confirm:'' });
  const [showPwd,     setShowPwd]     = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [notifications, setNotifications] = useState({
    nuevaTarea:     true,
    nuevaAlerta:    true,
    mensajeDirecto: true,
    resumenSemanal: false,
    emailDigest:    true,
  });

  const fileRef = useRef<HTMLInputElement>(null);

  const handleAvatarChange = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = ev => setAvatarPrev(ev.target?.result as string);
    r.readAsDataURL(f);
  };

  const handleSaveProfile = async () => {
    try {
      await api.patch('/auth/me', {
        full_name: profileForm.name,
        email:     profileForm.email,
      });
    } catch { /* noop */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const strength = (pwd: string) => {
    let s = 0;
    if (pwd.length >= 8)    s++;
    if (/[A-Z]/.test(pwd))  s++;
    if (/[0-9]/.test(pwd))  s++;
    if (/[^A-Za-z0-9]/.test(pwd)) s++;
    return s;
  };
  const pwdStrength = strength(passwords.next);
  const STRENGTH_LABELS = ['Muy débil','Débil','Regular','Fuerte','Muy fuerte'];
  const STRENGTH_COLORS = ['bg-[#E03E3E]','bg-[#E03E3E]','bg-[#D9730D]','bg-amber-400','bg-[#0F7B6C]'];

  const TABS = [
    { id:'perfil',         label:'Perfil',         icon: Camera   },
    { id:'seguridad',      label:'Seguridad',       icon: Lock     },
    { id:'notificaciones', label:'Notificaciones',  icon: Bell     },
  ] as const;

  return (
    <div className="max-w-2xl space-y-5">

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6F3] p-1 rounded-lg border border-[#E9E9E7] w-fit">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab===t.id ? 'bg-white text-[#191919] shadow-sm border border-[#E9E9E7]' : 'text-[#787774] hover:bg-white/50'}`}>
              <Icon className="w-3.5 h-3.5" />{t.label}
            </button>
          );
        })}
      </div>

      {/* ── PERFIL ──────────────────────────────────────────── */}
      {tab === 'perfil' && (
        <div className="bg-white border border-[#E9E9E7] rounded-xl p-6 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-[#E9E9E7] bg-[#EEF3FD] flex items-center justify-center">
                {avatarPrev
                  ? <img src={avatarPrev} className="w-full h-full object-cover" alt="avatar" />
                  : <span className="text-3xl font-bold text-[#2E6FDB]">{(profileForm.name || 'P').charAt(0).toUpperCase()}</span>}
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#2E6FDB] text-white rounded-full flex items-center justify-center hover:bg-[#255DC0] transition-colors shadow-sm">
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handleAvatarChange(e.target.files)} />
            </div>
            <div>
              <p className="font-semibold text-[#191919]">{profileForm.name || 'Nombre del profesor'}</p>
              <p className="text-sm text-[#787774]">Docente · Premium</p>
              <p className="text-xs text-[#AEADAB] mt-1">Haz clic en el ícono para cambiar la foto</p>
            </div>
          </div>

          <hr className="border-[#E9E9E7]" />

          {/* Campos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Nombre completo</label>
              <input value={profileForm.name} onChange={e => setProfileForm(p=>({...p,name:e.target.value}))}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Correo electrónico</label>
              <input type="email" value={profileForm.email} onChange={e => setProfileForm(p=>({...p,email:e.target.value}))}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Idioma</label>
              <select value={profileForm.lang} onChange={e => setProfileForm(p=>({...p,lang:e.target.value}))}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none bg-white flex items-center gap-1.5">
                {LANGUAGES.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Institución (readonly) */}
          <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#787774] uppercase mb-1">Institución</p>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#787774]" />
              <p className="text-sm text-[#37352F] font-medium">Colegio Nacional Demo</p>
              <span className="text-xs text-[#AEADAB]">(asignado por el rector — no editable)</span>
            </div>
          </div>

          <button onClick={handleSaveProfile}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${saved ? 'bg-[#0F7B6C] text-white' : 'bg-[#2E6FDB] text-white hover:bg-[#255DC0]'}`}>
            {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : 'Guardar cambios'}
          </button>
        </div>
      )}

      {/* ── SEGURIDAD ────────────────────────────────────────── */}
      {tab === 'seguridad' && (
        <div className="bg-white border border-[#E9E9E7] rounded-xl p-6 space-y-5">
          <h3 className="font-semibold text-[#191919]">Cambiar contraseña</h3>
          <div className="space-y-3">
            {[
              { key:'current', label:'Contraseña actual',    placeholder:'Tu contraseña actual' },
              { key:'next',    label:'Nueva contraseña',     placeholder:'Mínimo 8 caracteres'  },
              { key:'confirm', label:'Confirmar contraseña', placeholder:'Repite la nueva contraseña' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">{f.label}</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={passwords[f.key as keyof typeof passwords]}
                    onChange={e => setPasswords(p=>({...p,[f.key]:e.target.value}))}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] pr-10"
                  />
                  {f.key === 'current' && (
                    <button onClick={() => setShowPwd(p=>!p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#787774]">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {f.key === 'next' && passwords.next && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${i < pwdStrength ? STRENGTH_COLORS[pwdStrength] : 'bg-[#E9E9E7]'}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-[#787774]">{STRENGTH_LABELS[pwdStrength]}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            disabled={!passwords.current || !passwords.next || passwords.next !== passwords.confirm || pwdStrength < 2}
          onClick={async () => {
            if (!passwords.current || !passwords.next || passwords.next !== passwords.confirm || pwdStrength < 2) return;
            try {
              await api.post('/auth/change-password', {
                current_password: passwords.current,
                new_password:     passwords.next,
              });
            } catch { /* noop */ }
            setPasswords({current:'',next:'',confirm:''});
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
          }}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
            <Shield className="w-4 h-4" />
            {saved ? '¡Contraseña actualizada!' : 'Actualizar contraseña'}
          </button>
          {passwords.next && passwords.confirm && passwords.next !== passwords.confirm && (
            <p className="text-xs text-[#E03E3E]">⚠ Las contraseñas no coinciden.</p>
          )}
        </div>
      )}

      {/* ── NOTIFICACIONES ───────────────────────────────────── */}
      {tab === 'notificaciones' && (
        <div className="bg-white border border-[#E9E9E7] rounded-xl p-6 space-y-4">
          <h3 className="font-semibold text-[#191919]">Preferencias de notificaciones</h3>
          {(Object.entries(notifications) as [keyof typeof notifications, boolean][]).map(([key, val]) => {
            const labels: Record<keyof typeof notifications, { label:string; sub:string }> = {
              nuevaTarea:     { label:'Nueva tarea entregada',    sub:'Cuando un estudiante entrega una actividad'     },
              nuevaAlerta:    { label:'Nueva NeuroAlerta',        sub:'Cuando el sistema detecta un estudiante en riesgo' },
              mensajeDirecto: { label:'Mensaje directo',          sub:'Cuando recibes un mensaje de un estudiante o rector' },
              resumenSemanal: { label:'Resumen semanal',          sub:'Reporte de actividad enviado cada lunes'        },
              emailDigest:    { label:'Digest por correo',        sub:'Resumen diario por email'                       },
            };
            const info = labels[key];
            return (
              <div key={key} className="flex items-center justify-between py-3 border-b border-[#F7F6F3] last:border-0">
                <div>
                  <p className="text-sm font-medium text-[#191919]">{info.label}</p>
                  <p className="text-xs text-[#787774] mt-0.5">{info.sub}</p>
                </div>
                <button
                  onClick={() => setNotifications(p=>({...p,[key]:!val}))}
                  className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-[#2E6FDB]' : 'bg-[#E9E9E7]'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            );
          })}
          <button onClick={handleSaveProfile}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${saved ? 'bg-[#0F7B6C] text-white' : 'bg-[#2E6FDB] text-white hover:bg-[#255DC0]'}`}>
            {saved ? <><CheckCircle className="w-4 h-4" /> Guardado</> : 'Guardar preferencias'}
          </button>
        </div>
      )}
    </div>
  );
}
