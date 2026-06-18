import { useState } from 'react';
import {
  School, User, Mail, Hash, Users, BookOpen,
  Save, Eye, EyeOff, Copy, CheckCircle, ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

interface InstitutionForm {
  name:            string;
  dane_code:       string;
  admin_full_name: string;
  admin_document:  string;
  admin_email:     string;
  student_limit:   number;
  teacher_limit:   number;
}

interface CreatedCredentials {
  institution_name:         string;
  super_profesor_username:  string;
  super_profesor_temp_password: string;
}

const EMPTY_FORM: InstitutionForm = {
  name:            '',
  dane_code:       '',
  admin_full_name: '',
  admin_document:  '',
  admin_email:     '',
  student_limit:   100,
  teacher_limit:   10,
};

export default function CreateInstitution() {
  const [form, setForm]               = useState<InstitutionForm>(EMPTY_FORM);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const [showPass, setShowPass]       = useState(false);
  const [copied, setCopied]           = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? Math.max(1, parseInt(value) || 1) : value,
    }));
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (form.dane_code.replace(/\D/g, '').length < 6) {
      setError('El código DANE debe tener al menos 6 dígitos numéricos.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<CreatedCredentials>('/admin/institutions', form);
      setCredentials(data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })
        ?.response?.data?.detail
        ?? 'Error al crear la institución. Verifica los datos e intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── PANTALLA DE ÉXITO ───────────────────────────────────────────
  if (credentials) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Cabecera verde */}
          <div className="bg-emerald-500 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg leading-tight">
                  Institución creada exitosamente
                </h2>
                <p className="text-emerald-100 text-sm">{credentials.institution_name}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="text-sm text-gray-600 mb-5 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
              ⚠️ <strong>Guarda estas credenciales ahora.</strong> La contraseña temporal
              no se podrá ver de nuevo. El rector deberá cambiarla en su primer inicio de sesión.
            </p>

            {/* Credenciales */}
            <div className="space-y-3 mb-6">
              <CredentialRow
                label="Usuario del Super Profesor"
                value={credentials.super_profesor_username}
                visible
                copied={copied === 'user'}
                onCopy={() => copyToClipboard(credentials.super_profesor_username, 'user')}
              />
              <CredentialRow
                label="Contraseña temporal"
                value={credentials.super_profesor_temp_password}
                visible={showPass}
                copied={copied === 'pass'}
                onCopy={() => copyToClipboard(credentials.super_profesor_temp_password, 'pass')}
                onToggle={() => setShowPass(v => !v)}
                showToggle
              />
            </div>

            {/* Instrucciones */}
            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1 mb-6">
              <p className="font-medium text-gray-800 mb-2">Próximos pasos:</p>
              <p>1. Comparte el usuario y contraseña temporal con el rector.</p>
              <p>2. El rector inicia sesión en <strong>/login</strong> y cambia su contraseña.</p>
              <p>3. El rector crea las cuentas de profesores desde su panel.</p>
              <p>4. Los profesores crean o invitan a sus estudiantes.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setCredentials(null); setForm(EMPTY_FORM); }}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Registrar otra institución
              </button>
              <Link
                to="/admin"
                className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-center"
              >
                Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── FORMULARIO ──────────────────────────────────────────────────
  return (
    <div className="p-8 max-w-3xl">

      {/* Encabezado */}
      <div className="mb-7">
        <Link
          to="/admin/instituciones"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Instituciones
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Registrar nueva institución</h1>
        <p className="text-gray-500 text-sm mt-1">
          Al guardar se crean automáticamente las credenciales temporales del rector.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Error global */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Bloque 1: Datos del colegio ── */}
        <FormSection
          title="Datos de la institución educativa"
          icon={<School className="w-4 h-4 text-indigo-600" />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field
                label="Nombre del colegio *"
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ej: Institución Educativa San José"
                required
              />
            </div>
            <Field
              label="Código DANE *"
              name="dane_code"
              value={form.dane_code}
              onChange={handleChange}
              placeholder="Ej: 168001000123"
              required
              icon={<Hash className="w-4 h-4" />}
              hint="Asignado por el Ministerio de Educación de Colombia"
            />
          </div>
        </FormSection>

        {/* ── Bloque 2: Datos del rector ── */}
        <FormSection
          title="Datos del rector — Super Profesor"
          icon={<User className="w-4 h-4 text-indigo-600" />}
          subtitle="Este perfil tendrá acceso para gestionar profesores y licencias de su institución"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Field
                label="Nombre completo *"
                name="admin_full_name"
                value={form.admin_full_name}
                onChange={handleChange}
                placeholder="Ej: María Fernanda Gómez Torres"
                required
              />
            </div>
            <Field
              label="Número de documento *"
              name="admin_document"
              value={form.admin_document}
              onChange={handleChange}
              placeholder="Cédula de ciudadanía"
              required
              icon={<Hash className="w-4 h-4" />}
            />
            <Field
              label="Correo electrónico institucional *"
              name="admin_email"
              type="email"
              value={form.admin_email}
              onChange={handleChange}
              placeholder="rector@colegio.edu.co"
              required
              icon={<Mail className="w-4 h-4" />}
            />
          </div>
        </FormSection>

        {/* ── Bloque 3: Límites de licencia ── */}
        <FormSection
          title="Límites de licencia"
          icon={<Users className="w-4 h-4 text-indigo-600" />}
          badge="Gestión de licencias — próximamente"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Límite de estudiantes *"
              name="student_limit"
              type="number"
              value={String(form.student_limit)}
              onChange={handleChange}
              placeholder="100"
              required
              icon={<BookOpen className="w-4 h-4" />}
              hint="Máximo de estudiantes activos permitidos"
            />
            <Field
              label="Límite de profesores *"
              name="teacher_limit"
              type="number"
              value={String(form.teacher_limit)}
              onChange={handleChange}
              placeholder="10"
              required
              icon={<Users className="w-4 h-4" />}
              hint="Máximo de docentes activos permitidos"
            />
          </div>
        </FormSection>

        {/* Botón guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 px-7 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm text-sm"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Guardar y generar credenciales
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Sub-componentes reutilizables ──────────────────────────────────

interface FormSectionProps {
  title:    string;
  icon:     React.ReactNode;
  subtitle?: string;
  badge?:   string;
  children: React.ReactNode;
}

function FormSection({ title, icon, subtitle, badge, children }: FormSectionProps) {
  return (
    <section className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 text-sm">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-gray-500 mt-1 ml-6">{subtitle}</p>}
        </div>
        {badge && (
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full shrink-0 ml-4">
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

interface FieldProps {
  label:       string;
  name:        string;
  value:       string;
  onChange:    (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?:       string;
  required?:   boolean;
  icon?:       React.ReactNode;
  hint?:       string;
}

function Field({ label, name, value, onChange, placeholder, type = 'text', required, icon, hint }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          min={type === 'number' ? 1 : undefined}
          className={`w-full border border-gray-300 rounded-lg py-2.5 pr-3 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow ${icon ? 'pl-9' : 'pl-3'}`}
        />
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

interface CredentialRowProps {
  label:       string;
  value:       string;
  visible:     boolean;
  copied:      boolean;
  onCopy:      () => void;
  showToggle?: boolean;
  onToggle?:   () => void;
}

function CredentialRow({ label, value, visible, copied, onCopy, showToggle, onToggle }: CredentialRowProps) {
  return (
    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="font-mono text-sm font-semibold text-gray-900 truncate">
          {visible ? value : '••••••••••••'}
        </p>
      </div>
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          title={visible ? 'Ocultar' : 'Mostrar'}
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      )}
      <button
        type="button"
        onClick={onCopy}
        className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
        title="Copiar"
      >
        {copied
          ? <CheckCircle className="w-4 h-4 text-emerald-500" />
          : <Copy className="w-4 h-4" />
        }
      </button>
    </div>
  );
}