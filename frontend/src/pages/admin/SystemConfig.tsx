/**
 * NeuroLearn AI — Admin: Configuración del Sistema
 * Secciones: Sistema, Seguridad, IA, Límites de Licencia, Cuentas Demo
 */
import { useEffect, useState, useRef } from 'react';
import {
  Settings, RefreshCw, CheckCircle2, AlertTriangle,
  Server, Shield, Brain, Layers, Users,
  Eye, EyeOff, Info, Save,
} from 'lucide-react';
import api from '../../services/api';

interface AIProvider { name: string; model: string; active: boolean }
interface DemoAccount { username: string; role: string; password: string }
interface LicenseLimits {
  basica:  { teachers: number; students: number };
  premium: { teachers: number; students: number };
  pro:     { teachers: number; students: number };
}

interface Config {
  app_name: string;
  app_version: string;
  environment: string;
  debug_mode: boolean;
  db_connected: boolean;
  db_url_configured: boolean;
  token_expire_minutes: number;
  algorithm: string;
  email_configured: boolean;
  email_from: string;
  ai_providers: AIProvider[];
  license_limits: LicenseLimits;
  total_users: number;
  active_users: number;
  total_institutions: number;
  demo_accounts: DemoAccount[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  super_profesor: 'Super Profesor',
  profesor: 'Profesor',
  estudiante: 'Estudiante',
};

const ROLE_COLORS: Record<string, string> = {
  admin:          'bg-[#37352F] text-white',
  super_profesor: 'bg-[#6940A5] text-white',
  profesor:       'bg-[#0B6E99] text-white',
  estudiante:     'bg-[#0F7B6C] text-white',
};

// ── Componente: fila de info ─────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F3F3F1] last:border-0">
      <span className="text-sm text-[#787774]">{label}</span>
      <span className={`text-sm font-medium text-[#191919] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Componente: campo numérico editable ──────────────────────────────────────
function NumberField({
  label, value, onChange, min = 1, max = 999999,
}: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F3F3F1] last:border-0">
      <span className="text-sm text-[#787774]">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-24 text-right border border-[#E9E9E7] rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
      />
    </div>
  );
}

export default function SystemConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Campos editables
  const [tokenExpire, setTokenExpire]   = useState(1440);
  const [emailFrom,   setEmailFrom]     = useState('');
  const [debugMode,   setDebugMode]     = useState(false);
  const [limits, setLimits] = useState({
    basica_teachers:  20,   basica_students:  300,
    premium_teachers: 60,   premium_students: 1500,
    pro_teachers:     9999, pro_students:     999999,
  });

  // Feedback
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Visibilidad contraseñas demo
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  const showNotice = (type: 'ok' | 'err', msg: string) => {
    setNotice({ type, msg });
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  };

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/config');
      const c: Config = res.data;
      setConfig(c);
      setTokenExpire(c.token_expire_minutes);
      setEmailFrom(c.email_from);
      setDebugMode(c.debug_mode);
      setLimits({
        basica_teachers:  c.license_limits.basica.teachers,
        basica_students:  c.license_limits.basica.students,
        premium_teachers: c.license_limits.premium.teachers,
        premium_students: c.license_limits.premium.students,
        pro_teachers:     c.license_limits.pro.teachers,
        pro_students:     c.license_limits.pro.students,
      });
    } catch {
      setError('No se pudo cargar la configuración del sistema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/admin/config', {
        token_expire_minutes:   tokenExpire,
        debug_mode:             debugMode,
        email_from:             emailFrom,
        license_basica_teachers:  limits.basica_teachers,
        license_basica_students:  limits.basica_students,
        license_premium_teachers: limits.premium_teachers,
        license_premium_students: limits.premium_students,
        license_pro_teachers:     limits.pro_teachers,
        license_pro_students:     limits.pro_students,
      });
      showNotice('ok', res.data.message);
      fetchConfig();
    } catch (e: any) {
      showNotice('err', e?.response?.data?.detail ?? 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-[#9B9A97] gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando configuración…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-[#FDECEA] border border-[#D44C47]/30 text-[#D44C47] rounded-md p-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl space-y-6">

      {/* ── Encabezado ─────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#191919] flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#37352F]" />
            Configuración del Sistema
          </h1>
          <p className="text-sm text-[#787774] mt-1">
            Parámetros globales de NeuroLearn IA — entorno <span className="font-mono font-semibold">{config?.environment}</span>
          </p>
        </div>
        <button
          onClick={fetchConfig}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] text-[#37352F]"
        >
          <RefreshCw className="w-4 h-4" />Actualizar
        </button>
      </div>

      {/* ── Notificación ───────────────────────── */}
      {notice && (
        <div className={`flex items-center gap-2 text-sm rounded-md p-3 border ${
          notice.type === 'ok'
            ? 'bg-[#EEF7F4] border-[#0F7B6C]/30 text-[#0F7B6C]'
            : 'bg-[#FDECEA] border-[#D44C47]/30 text-[#D44C47]'
        }`}>
          {notice.type === 'ok'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {notice.msg}
        </div>
      )}

      {/* ── Aviso entorno ──────────────────────── */}
      <div className="bg-[#FEF9ED] border border-[#EDD88A] rounded-md p-3 flex items-start gap-2 text-sm text-[#D9730D]">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Los cambios se aplican <strong>en memoria</strong> hasta el próximo reinicio del servidor.
          Para persistirlos, actualiza las variables de entorno en Vercel.
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Sección: Sistema ───────────────────── */}
        <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
            <Server className="w-4 h-4 text-[#0B6E99]" />
            <h2 className="font-semibold text-[#191919] text-sm">Sistema</h2>
          </div>
          <div className="px-5 py-3">
            <InfoRow label="Nombre de la app" value={config?.app_name} />
            <InfoRow label="Versión" value={<span className="font-mono">{config?.app_version}</span>} />
            <InfoRow label="Entorno" value={
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                config?.environment === 'production' ? 'bg-[#EEF7F4] text-[#0F7B6C]' : 'bg-[#FEF9ED] text-[#D9730D]'
              }`}>
                {config?.environment}
              </span>
            } />
            <InfoRow label="Base de datos" value={
              <span className={`flex items-center gap-1 text-xs font-medium ${config?.db_connected ? 'text-[#0F7B6C]' : 'text-[#D44C47]'}`}>
                <span className={`w-2 h-2 rounded-full ${config?.db_connected ? 'bg-[#0F7B6C]' : 'bg-[#D44C47]'}`} />
                {config?.db_connected ? 'Conectada' : 'Sin conexión'}
              </span>
            } />
            <InfoRow label="Email (Resend)" value={
              config?.email_configured
                ? <span className="text-xs text-[#0F7B6C] font-medium">Configurado ✓</span>
                : <span className="text-xs text-[#D44C47] font-medium">Sin configurar</span>
            } />
            <InfoRow label="Total usuarios" value={`${config?.active_users} activos / ${config?.total_users}`} />
            <InfoRow label="Instituciones" value={config?.total_institutions} />
          </div>
        </div>

        {/* ── Sección: Seguridad ─────────────────── */}
        <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#6940A5]" />
            <h2 className="font-semibold text-[#191919] text-sm">Seguridad y Sesión</h2>
          </div>
          <div className="px-5 py-3">
            <InfoRow label="Algoritmo JWT" value={<span className="font-mono">{config?.algorithm}</span>} />
            <div className="flex items-center justify-between py-2.5 border-b border-[#F3F3F1]">
              <span className="text-sm text-[#787774]">Expiración del token</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={60}
                  max={43200}
                  value={tokenExpire}
                  onChange={e => setTokenExpire(Number(e.target.value))}
                  className="w-20 text-right border border-[#E9E9E7] rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
                />
                <span className="text-xs text-[#9B9A97]">min</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-[#F3F3F1]">
              <span className="text-sm text-[#787774]">Modo debug</span>
              <button
                onClick={() => setDebugMode(v => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                  debugMode ? 'bg-[#D9730D]' : 'bg-[#E9E9E7]'
                }`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  debugMode ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-sm text-[#787774]">Remitente de email</span>
              <input
                type="text"
                value={emailFrom}
                onChange={e => setEmailFrom(e.target.value)}
                className="w-48 border border-[#E9E9E7] rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
                placeholder="Nombre <email@dominio>"
              />
            </div>
          </div>
        </div>

        {/* ── Sección: IA y Modelos ──────────────── */}
        <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
            <Brain className="w-4 h-4 text-[#0F7B6C]" />
            <h2 className="font-semibold text-[#191919] text-sm">Proveedores de IA</h2>
          </div>
          <div className="px-5 py-3 space-y-2">
            {config?.ai_providers.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-[#F3F3F1] last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.active ? 'bg-[#0F7B6C]' : 'bg-[#D44C47]'}`} />
                  <span className="text-sm font-medium text-[#191919]">{p.name}</span>
                </div>
                <span className="font-mono text-xs text-[#787774] bg-[#F7F6F3] px-2 py-0.5 rounded">
                  {p.model}
                </span>
              </div>
            ))}
            {config?.ai_providers.length === 0 && (
              <p className="text-sm text-[#9B9A97] py-2">Sin proveedores configurados</p>
            )}
          </div>
          <div className="px-5 py-3 bg-[#F7F6F3] border-t border-[#E9E9E7]">
            <p className="text-xs text-[#787774]">
              Para cambiar los modelos de IA, actualiza <span className="font-mono">GROQ_MODEL</span> o <span className="font-mono">GEMINI_MODEL</span> en las variables de entorno de Vercel.
            </p>
          </div>
        </div>

        {/* ── Sección: Límites de Licencia ──────── */}
        <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#D9730D]" />
            <h2 className="font-semibold text-[#191919] text-sm">Límites por Tipo de Licencia</h2>
          </div>
          <div className="px-5 py-3">
            {/* Básica */}
            <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mt-1 mb-1">Básica</p>
            <NumberField label="Máx. docentes" value={limits.basica_teachers}
              onChange={v => setLimits(l => ({ ...l, basica_teachers: v }))} />
            <NumberField label="Máx. estudiantes" value={limits.basica_students}
              onChange={v => setLimits(l => ({ ...l, basica_students: v }))} />
            {/* Premium */}
            <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mt-3 mb-1">Premium</p>
            <NumberField label="Máx. docentes" value={limits.premium_teachers}
              onChange={v => setLimits(l => ({ ...l, premium_teachers: v }))} />
            <NumberField label="Máx. estudiantes" value={limits.premium_students}
              onChange={v => setLimits(l => ({ ...l, premium_students: v }))} />
            {/* Pro */}
            <p className="text-xs font-semibold text-[#787774] uppercase tracking-wide mt-3 mb-1">Pro</p>
            <NumberField label="Máx. docentes" value={limits.pro_teachers}
              onChange={v => setLimits(l => ({ ...l, pro_teachers: v }))} />
            <NumberField label="Máx. estudiantes" value={limits.pro_students}
              onChange={v => setLimits(l => ({ ...l, pro_students: v }))} />
          </div>
        </div>

      </div>

      {/* ── Sección: Cuentas Demo ──────────────── */}
      <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center gap-2">
          <Users className="w-4 h-4 text-[#37352F]" />
          <h2 className="font-semibold text-[#191919] text-sm">Cuentas de Acceso Demo</h2>
          <span className="text-xs text-[#9B9A97] ml-1">— creadas automáticamente al iniciar el servidor</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                <th className="text-left px-5 py-3 font-semibold text-[#37352F]">Usuario</th>
                <th className="text-left px-5 py-3 font-semibold text-[#37352F]">Rol</th>
                <th className="text-left px-5 py-3 font-semibold text-[#37352F]">Contraseña</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F3F1]">
              {config?.demo_accounts.map(acc => (
                <tr key={acc.username} className="hover:bg-[#FAFAFA]">
                  <td className="px-5 py-3 font-mono font-medium text-[#191919]">{acc.username}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_COLORS[acc.role] ?? 'bg-[#F7F6F3] text-[#37352F]'}`}>
                      {ROLE_LABELS[acc.role] ?? acc.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {showPwd[acc.username] ? acc.password : '••••••••'}
                      </span>
                      <button
                        onClick={() => setShowPwd(p => ({ ...p, [acc.username]: !p[acc.username] }))}
                        className="p-1 hover:bg-[#F7F6F3] rounded text-[#9B9A97]"
                      >
                        {showPwd[acc.username] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Botón Guardar ──────────────────────── */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#191919] text-white text-sm font-medium rounded-md hover:bg-[#37352F] disabled:opacity-50 transition-colors"
        >
          {saving
            ? <><RefreshCw className="w-4 h-4 animate-spin" />Guardando…</>
            : <><Save className="w-4 h-4" />Guardar cambios</>}
        </button>
      </div>

    </div>
  );
}
