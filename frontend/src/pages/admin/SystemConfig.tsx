/**
 * NeuroLearn AI — Admin: Configuración del Sistema
 * Secciones: Sistema, Seguridad, IA
 *
 * Solo lectura. Antes permitía editar la expiración del token, el modo debug
 * y el remitente de correo, pero esos cambios vivían en la memoria de una
 * instancia del servidor: en Vercel se perdían enseguida. Ahora se muestran
 * los valores reales y se explica dónde se cambian (variables de entorno).
 */
import { useEffect, useState } from 'react';
import {
  Settings, RefreshCw, AlertTriangle,
  Server, Shield, Brain,
  Info,
} from 'lucide-react';
import api from '../../services/api';

interface AIProvider { name: string; model: string; active: boolean }

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
  total_users: number;
  active_users: number;
  total_institutions: number;
}

// ── Componente: fila de info ─────────────────────────────────────────────────
function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#F3F3F1] last:border-0">
      <span className="text-sm text-[#787774]">{label}</span>
      <span className={`text-sm font-medium text-[#191919] ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function SystemConfig() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/config');
      setConfig(res.data as Config);
    } catch {
      setError('No se pudo cargar la configuración del sistema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfig(); }, []);

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

      {/* ── Aviso entorno ──────────────────────── */}
      <div className="bg-[#FEF9ED] border border-[#EDD88A] rounded-md p-3 flex items-start gap-2 text-sm text-[#D9730D]">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Estos valores se leen de las variables de entorno del servidor. Para cambiarlos, edítalas en
          Vercel (Settings → Environment Variables) y vuelve a desplegar. La lista está en
          <span className="font-mono"> docs/VARIABLES_ENTORNO.md</span>.
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
            <InfoRow label="Email (Brevo)" value={
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
            <InfoRow label="Expiración de la sesión" value={`${config?.token_expire_minutes} min`} />
            <InfoRow label="Modo debug" value={
              <span className={`text-xs font-medium ${config?.debug_mode ? 'text-[#D9730D]' : 'text-[#0F7B6C]'}`}>
                {config?.debug_mode ? 'Activado' : 'Desactivado'}
              </span>
            } />
            <InfoRow label="Remitente de correo" value={<span className="text-xs">{config?.email_from || '—'}</span>} />
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

      </div>

    </div>
  );
}
