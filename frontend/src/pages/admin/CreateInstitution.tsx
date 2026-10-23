import { useRef, useState } from 'react';
import {
  School, User, Mail, Hash, ShieldCheck, Copy, CheckCircle,
  ArrowLeft, Eye, EyeOff, Building2, FileText, BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { FieldError } from '../../components/FieldError';
import { fieldA11y, focusFirstInvalid } from '../../utils/formFields';
import {
  DOCUMENT_TYPES, apiErrorMessage, apiFieldErrors, documentInputHint, filterDigits,
  filterDocumentInput, normalizeEmail, normalizePersonName, validateDaneCode,
  validateDocumentNumber, validateEmail, validatePersonName, validateText,
  type DocumentType,
} from '../../utils/validation';

type DocType = DocumentType;

const RULES: Record<Exclude<keyof FormState, 'sp_document_type'>, (f: FormState) => string | null> = {
  name: f => validateText(f.name, { label: 'El nombre del colegio', min: 2, max: 200 }),
  dane_code: f => validateDaneCode(f.dane_code),
  sp_full_name: f => validatePersonName(f.sp_full_name, { label: 'El nombre completo' }),
  sp_document_number: f => validateDocumentNumber(f.sp_document_number, f.sp_document_type),
  sp_email: f => validateEmail(f.sp_email),
};

interface FormState {
  name: string; dane_code: string;
  sp_full_name: string; sp_document_type: DocType;
  sp_document_number: string; sp_email: string;
}
interface Credential { full_name: string; username: string; temp_password: string; role: string; }
interface CreatedInstitution { id: number; name: string; dane_code: string; credential: Credential; }

const EMPTY: FormState = {
  name: '', dane_code: '',
  sp_full_name: '', sp_document_type: 'CC', sp_document_number: '', sp_email: '',
};

export default function CreateInstitution() {
  const [form, setForm]               = useState<FormState>(EMPTY);
  const [loading, setLoading]         = useState(false);
  const [errors, setErrors]           = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated]         = useState<CreatedInstitution | null>(null);
  const [showPass, setShowPass]       = useState(false);
  const [copied, setCopied]           = useState<'user' | 'pass' | 'all' | null>(null);

  const [notice, setNotice]           = useState<Partial<Record<keyof FormState, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const recheck = (field: keyof FormState, next: FormState, always = false) => {
    if (field === 'sp_document_type') field = 'sp_document_number';
    const rule = RULES[field as keyof typeof RULES];
    if (!rule || (!always && !errors[field])) return;
    setErrors(e => ({ ...e, [field]: rule(next) ?? undefined }));
  };

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      let value = e.target.value;
      let hint = '';
      // Campos estrictos: se descartan al escribir/pegar los caracteres que no admiten.
      if (field === 'dane_code') {
        const r = filterDigits(value, 12);
        value = r.value;
        if (r.removed) hint = 'El código DANE solo admite números (máx. 12).';
      } else if (field === 'sp_document_number') {
        const r = filterDocumentInput(value, form.sp_document_type);
        value = r.value;
        if (r.removed) hint = `Se quitaron caracteres no permitidos. ${documentInputHint(form.sp_document_type)}`;
      }
      let next = { ...form, [field]: value } as FormState;
      if (field === 'sp_document_type') {
        const r = filterDocumentInput(form.sp_document_number, value as DocType);
        next = { ...next, sp_document_number: r.value };
      }
      setNotice(n => ({ ...n, [field]: hint }));
      setForm(next);
      recheck(field, next, field === 'sp_document_type' && Boolean(next.sp_document_number));
    };

  const blur = (field: keyof FormState) => () => {
    if (String(form[field]).trim()) recheck(field, form, true);
  };

  const validate = (): boolean => {
    const e: typeof errors = {};
    (Object.keys(RULES) as (keyof typeof RULES)[]).forEach(field => {
      const message = RULES[field](form);
      if (message) e[field] = message;
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault();
    setServerError(null);
    if (!validate()) { focusFirstInvalid(formRef.current); return; }
    setLoading(true);
    try {
      const { data } = await api.post<CreatedInstitution>('/admin/institutions', {
        ...form,
        name: form.name.trim(),
        dane_code: form.dane_code.trim(),
        sp_full_name: normalizePersonName(form.sp_full_name),
        sp_document_number: form.sp_document_number.trim(),
        sp_email: normalizeEmail(form.sp_email),
      });
      setCreated(data);
    } catch (err: any) {
      const byField = apiFieldErrors(err) as typeof errors;
      if (Object.keys(byField).length) { setErrors(byField); focusFirstInvalid(formRef.current); }
      setServerError(apiErrorMessage(err, 'Error al crear la institución'));
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
      <div className="p-4 sm:p-8 max-w-xl mx-auto">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 bg-[#EEF7F4] rounded-full flex items-center justify-center mb-3">
              <BadgeCheck className="w-7 h-7 text-[#0F7B6C]" />
            </div>
            <h2 className="text-xl font-bold text-[#191919]">Institución creada correctamente</h2>
            <p className="text-sm text-[#787774] mt-1">{created.name} · DANE {created.dane_code}</p>
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-5 sm:mb-7">
        <Link to="/admin" className="p-1.5 rounded-md hover:bg-[#F1F1EF] text-[#787774]"><ArrowLeft className="w-4 h-4" /></Link>
        <div>
          <h1 className="text-xl font-bold text-[#191919]">Registrar institución</h1>
          <p className="text-sm text-[#787774]">Crea el colegio y genera las credenciales del rector automáticamente</p>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6" noValidate>

        {/* Datos institución */}
        <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
          <h2 className="text-sm font-semibold text-[#191919] flex items-center gap-2 mb-5">
            <Building2 className="w-4 h-4 text-[#787774]" /> Datos de la institución
          </h2>
          <div className="space-y-4">
            <InputField id="inst-name" label="Nombre del colegio *" icon={School} value={form.name} maxLength={200}
              onChange={set('name')} onBlur={blur('name')} placeholder="Ej: Colegio Nacional San Francisco" error={errors.name} />
            <InputField id="inst-dane" label="Código DANE *" icon={Hash} value={form.dane_code} inputMode="numeric" maxLength={12}
              onChange={set('dane_code')} onBlur={blur('dane_code')} placeholder="Ej: 154001000149" error={errors.dane_code}
              hint={notice.dane_code || 'Solo números, entre 5 y 12 dígitos.'} />
          </div>
        </section>

        {/* Datos Super Profesor */}
        <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
          <h2 className="text-sm font-semibold text-[#191919] flex items-center gap-2 mb-5">
            <ShieldCheck className="w-4 h-4 text-[#787774]" /> Datos del Super Profesor (Rector)
          </h2>
          <div className="space-y-4">
            <InputField id="inst-sp-name" label="Nombre completo *" icon={User} value={form.sp_full_name} maxLength={100}
              onChange={set('sp_full_name')} onBlur={blur('sp_full_name')} placeholder="Ej: Carlos Andrés Mendoza" error={errors.sp_full_name} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="inst-sp-doctype" className="block text-xs font-medium text-[#37352F] mb-1">Tipo de documento</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
                  <select id="inst-sp-doctype" value={form.sp_document_type} onChange={set('sp_document_type')}
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-[#E9E9E7] rounded-md bg-white text-[#191919] focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99] appearance-none">
                    {DOCUMENT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              <InputField id="inst-sp-doc" label="Número de documento *" icon={Hash} value={form.sp_document_number}
                inputMode={form.sp_document_type === 'PA' ? 'text' : 'numeric'}
                onChange={set('sp_document_number')} onBlur={blur('sp_document_number')} placeholder="Ej: 1023456789"
                error={errors.sp_document_number}
                hint={notice.sp_document_number || documentInputHint(form.sp_document_type)} />
            </div>
            <InputField id="inst-sp-email" label="Correo electrónico *" icon={Mail} type="email" inputMode="email" value={form.sp_email}
              maxLength={100} onChange={set('sp_email')} onBlur={blur('sp_email')} placeholder="rector@colegio.edu.co" error={errors.sp_email} />
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

function InputField({ id, label, icon: Icon, value, onChange, onBlur, placeholder, type = 'text', error, hint, inputMode, maxLength }: {
  id: string; label: string; icon: LucideIcon; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  placeholder?: string; type?: string; error?: string; hint?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-[#37352F] mb-1">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" aria-hidden="true" />
        <input {...fieldA11y(id, error, hint)} type={type} value={value} onChange={onChange} onBlur={onBlur}
          placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} autoComplete="off"
          className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-md bg-white text-[#191919] placeholder-[#9B9A97]
            focus:outline-none focus:ring-2 transition-all
            ${error ? 'border-[#E03E3E] focus:ring-[#FDEEEE]' : 'border-[#E9E9E7] focus:ring-[#E5F3FF] focus:border-[#0B6E99]'}`} />
      </div>
      <FieldError id={id} error={error} hint={hint} />
    </div>
  );
}