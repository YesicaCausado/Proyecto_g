import { useState } from 'react';
import {
  School, User, Mail, Hash, ShieldCheck, Copy, CheckCircle,
  ArrowLeft, Eye, EyeOff, Building2, FileText, BadgeCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

type LicenseType = 'basica' | 'premium' | 'pro';
type DocType = 'CC' | 'TI' | 'CE' | 'PA';

interface FormState {
  name: string; dane_code: string; license_type: LicenseType;
  sp_full_name: string; sp_document_type: DocType;
  sp_document_number: string; sp_email: string;
}
interface Credential { full_name: string; username: string; temp_password: string; role: string; }
interface CreatedInstitution { id: number; name: string; dane_code: string; license_type: string; credential: Credential; }

const EMPTY: FormState = {
  name: '', dane_code: '', license_type: 'basica',
  sp_full_name: '', sp_document_type: 'CC', sp_document_number: '', sp_email: '',
};

const LICENSE_INFO = {
  basica:  { label: 'Basica',   teachers: 20,    students: 300,    desc: 'Instituciones pequeñas' },
  premium: { label: 'Premium',  teachers: 60,    students: 1500,   desc: 'Colegios medianos' },
  pro:     { label: 'Pro',      teachers: '∞',   students: '∞',    desc: 'Sin restricciones' },
};

export default function CreateInstitution() {
  const [form, setForm]               = useState<FormState>(EMPTY);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated]         = useState<CreatedInstitution | null>(null);
  const [showPass, setShowPass]       = useState(false);
  const [copied, setCopied]           = useState<'user' | 'pass' | 'all' | null>(null);

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = (): boolean => {
    const e: typeof errors = {};
    if (!form.name.trim())               e.name               = 'Requerido';
    if (!form.dane_code.trim())          e.dane_code          = 'Requerido';
    if (!form.sp_full_name.trim())       e.sp_full_name       = 'Requerido';
    if (!form.sp_document_number.trim()) e.sp_document_number = 'Requerido';
    if (!form.sp_email.trim())           e.sp_email           = 'Requerido';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.sp_email)) e.sp_email = 'Correo inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post<CreatedInstitution>('/admin/institutions', form);
      setCreated(data);
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? 'Error al crear la institución');
    } finally { setLoading(false); }
  };

  const copyText = (text: string, key: 'user' | 'pass' | 'all') => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Modal de credenciales ──────────────────────────────────────
  if (created) {
    const c = created.credential;
    return (
      <div className="p-8 max-w-xl mx-auto">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-[#EEF7F4] rounded-full flex items-center justify-center mb-3">
              <BadgeCheck className="w-7 h-7 text-[#0F7B6C]" />
            </div>
            <h2 className="text-xl font-bold text-[#191919]">Institución creada correctamente</h2>
            <p className="text-sm text-[#787774] mt-1">{created.name} · DANE {created.dane_code}</p>
          </div>

          <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md px-4 py-3 mb-5 flex items-center gap-3 text-sm">
            <ShieldCheck className="w-4 h-4 text-[#6940A5] shrink-0" />
            <span className="text-[#787774]">Licencia <span className="font-semibold text-[#37352F] capitalize">{created.license_type}</span> asignada</span>
          </div>

          <div className="border border-[#E9E9E7] rounded-md p-5 space-y-4 mb-5">
            <p className="text-xs font-semibold text-[#787774] uppercase tracking-wider">Credenciales del Super Profesor</p>
            <p className="text-sm font-medium text-[#191919]">{c.full_name}</p>
            {/* Usuario */}
            <div>
              <p className="text-xs text-[#787774] mb-1">Usuario (número de documento)</p>
              <div className="flex gap-2">
                <code className="flex-1 font-mono text-sm bg-[#F7F6F3] border border-[#E9E9E7] rounded-md px-3 py-2 text-[#191919]">{c.username}</code>
                <button onClick={() => copyText(c.username, 'user')} className="p-2 border border-[#E9E9E7] rounded-md hover:bg-[#F1F1EF] text-[#787774]">
                  {copied === 'user' ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Contraseña */}
            <div>
              <p className="text-xs text-[#787774] mb-1">Contraseña temporal</p>
              <div className="flex gap-2">
                <code className="flex-1 font-mono text-sm bg-[#F7F6F3] border border-[#E9E9E7] rounded-md px-3 py-2 text-[#191919]">
                  {showPass ? c.temp_password : '•'.repeat(c.temp_password.length)}
                </code>
                <button onClick={() => setShowPass(p => !p)} className="p-2 border border-[#E9E9E7] rounded-md hover:bg-[#F1F1EF] text-[#787774]">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={() => copyText(c.temp_password, 'pass')} className="p-2 border border-[#E9E9E7] rounded-md hover:bg-[#F1F1EF] text-[#787774]">
                  {copied === 'pass' ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button onClick={() => copyText(`Usuario: ${c.username}\nContraseña: ${c.temp_password}`, 'all')}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm border border-[#E9E9E7] rounded-md hover:bg-[#F1F1EF] text-[#37352F]">
              {copied === 'all' ? <><CheckCircle className="w-4 h-4 text-[#0F7B6C]" />Copiado</> : <><Copy className="w-4 h-4" />Copiar todo</>}
            </button>
          </div>

          <p className="text-xs text-[#D9730D] bg-[#FDF4EC] border border-[#F2D2B7] rounded-md p-3 mb-6">
            ⚠️ Esta contraseña solo se muestra una vez. El Super Profesor deberá cambiarla en su primer inicio de sesión.
          </p>

          <div className="flex gap-3">
            <button onClick={() => { setCreated(null); setForm(EMPTY); setErrors({}); }}
              className="flex-1 py-2.5 text-sm bg-[#37352F] text-white rounded-md hover:bg-[#2F2D2B] font-medium">
              Crear otra institución
            </button>
            <Link to="/admin" className="flex-1 py-2.5 text-sm border border-[#E9E9E7] text-[#37352F] rounded-md hover:bg-[#F1F1EF] font-medium text-center">
              Ir al panel
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Formulario ─────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-7">
        <Link to="/admin" className="p-1.5 rounded-md hover:bg-[#F1F1EF] text-[#787774]"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold text-[#191919]">Registrar institución</h1>
          <p className="text-sm text-[#787774]">Crea el colegio y genera las credenciales del rector automáticamente</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Datos institución */}
        <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
          <h2 className="text-sm font-semibold text-[#191919] flex items-center gap-2 mb-5">
            <Building2 className="w-4 h-4 text-[#787774]" /> Datos de la institución
          </h2>
          <div className="space-y-4">
            <InputField label="Nombre del colegio *" icon={School} value={form.name}
              onChange={set('name')} placeholder="Ej: Colegio Nacional San Francisco" error={errors.name} />
            <InputField label="Código DANE *" icon={Hash} value={form.dane_code}
              onChange={set('dane_code')} placeholder="Ej: 154001000149" error={errors.dane_code} />
            <div>
              <label className="block text-xs font-medium text-[#37352F] mb-2">Tipo de licencia</label>
              <div className="grid grid-cols-3 gap-3">
                {(Object.entries(LICENSE_INFO) as [LicenseType, typeof LICENSE_INFO.basica][]).map(([key, info]) => (
                  <button key={key} type="button" onClick={() => setForm(f => ({ ...f, license_type: key }))}
                    className={`p-3 border-2 rounded-md text-left transition-all ${form.license_type === key ? 'border-[#37352F] bg-[#F7F6F3]' : 'border-[#E9E9E7] hover:border-[#9B9A97]'}`}>
                    <p className="font-semibold text-sm text-[#191919]">{info.label}</p>
                    <p className="text-[10px] text-[#787774] mt-0.5">{info.desc}</p>
                    <p className="text-[10px] text-[#9B9A97] mt-1">{info.teachers} prof · {info.students} est</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Datos Super Profesor */}
        <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
          <h2 className="text-sm font-semibold text-[#191919] flex items-center gap-2 mb-5">
            <ShieldCheck className="w-4 h-4 text-[#787774]" /> Datos del Super Profesor (Rector)
          </h2>
          <div className="space-y-4">
            <InputField label="Nombre completo *" icon={User} value={form.sp_full_name}
              onChange={set('sp_full_name')} placeholder="Ej: Carlos Andrés Mendoza" error={errors.sp_full_name} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#37352F] mb-1">Tipo de documento</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
                  <select value={form.sp_document_type} onChange={set('sp_document_type')}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#E9E9E7] rounded-md bg-white text-[#191919] focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99] appearance-none">
                    {(['CC','TI','CE','PA'] as DocType[]).map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <InputField label="Número de documento *" icon={Hash} value={form.sp_document_number}
                onChange={set('sp_document_number')} placeholder="Ej: 1023456789" error={errors.sp_document_number} />
            </div>
            <InputField label="Correo electrónico *" icon={Mail} type="email" value={form.sp_email}
              onChange={set('sp_email')} placeholder="rector@colegio.edu.co" error={errors.sp_email} />
          </div>
        </section>

        {serverError && (
          <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-md p-4 text-sm text-[#E03E3E]">{serverError}</div>
        )}

        <button type="submit" disabled={loading}
          className="w-full py-3 bg-[#37352F] text-white rounded-md font-medium text-sm hover:bg-[#2F2D2B] disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creando institución…</> : <><School className="w-4 h-4" />Crear institución y generar credenciales</>}
        </button>
      </form>
    </div>
  );
}

function InputField({ label, icon: Icon, value, onChange, placeholder, type = 'text', error }: {
  label: string; icon: React.ElementType; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#37352F] mb-1">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
        <input type={type} value={value} onChange={onChange} placeholder={placeholder}
          className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-md bg-white text-[#191919] placeholder-[#9B9A97]
            focus:outline-none focus:ring-2 transition-all
            ${error ? 'border-[#E03E3E] focus:ring-[#FDEEEE]' : 'border-[#E9E9E7] focus:ring-[#E5F3FF] focus:border-[#0B6E99]'}`} />
      </div>
      {error && <p className="text-xs text-[#E03E3E] mt-1">{error}</p>}
    </div>
  );
}