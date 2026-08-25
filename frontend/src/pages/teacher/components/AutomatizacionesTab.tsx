import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Plus, Zap, Play, Trash2, History, AlertTriangle, Check,
  X, Power, ChevronRight, FlaskConical, Brain, RefreshCw,
} from 'lucide-react';
import api from '../../../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Automation {
  id: number;
  name: string;
  trigger: string;
  action: string;
  configuration: Record<string, any>;
  enabled: boolean;
  created_at?: string | null;
  updated_at?: string | null;
}

interface AutomationOption { value: string; label: string; available?: boolean; }

interface Execution { id: number; event?: string | null; status: string; detail?: string | null; executed_at?: string | null; }

const TRIGGERS: AutomationOption[] = [
  { value: 'nuevo_estudiante', label: 'Nuevo estudiante' },
  { value: 'nueva_actividad',  label: 'Nueva actividad' },
  { value: 'bajo_rendimiento', label: 'Bajo rendimiento' },
  { value: 'reporte_generado', label: 'Reporte generado' },
];

const ACTIONS: Record<string, { label: string; displayConfig?: boolean }> = {
  crear_alerta:        { label: 'Crear alerta',        displayConfig: true },
  enviar_notificacion: { label: 'Enviar notificación', displayConfig: false },
  google_calendar:     { label: 'Google Calendar',     displayConfig: false },
  webhook:             { label: 'Webhook',             displayConfig: false },
};

const TRIGGER_EMOJI: Record<string, string> = {
  nuevo_estudiante: '👨‍🎓', nueva_actividad: '📝', bajo_rendimiento: '📉', reporte_generado: '📊',
};

const ACTION_EMOJI: Record<string, string> = {
  crear_alerta: '🛎️', enviar_notificacion: '🔔', google_calendar: '📅', webhook: '🔗',
};

export default function AutomatizacionesTab({ onNavigate }: { onNavigate?: (t: string) => void }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [options,     setOptions]     = useState<{ actions: AutomationOption[]; calendar_connected: boolean; webhook_configured: boolean } | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [busyKey,     setBusyKey]     = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [success,     setSuccess]     = useState<string | null>(null);

  const [showModal,   setShowModal]   = useState(false);
  const [form,        setForm]        = useState({ name: '', trigger: 'nueva_actividad', action: 'crear_alerta', enabled: true, threshold: 60 });
  const [executionsOf, setExecutionsOf] = useState<number | null>(null);
  const [executions,  setExecutions]  = useState<Execution[]>([]);
  const [execLoading, setExecLoading]  = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [autoRes, optRes] = await Promise.all([
        api.get('/automations'),
        api.get('/automation-options'),
      ]);
      setAutomations(autoRes.data?.automations ?? []);
      setOptions({
        actions: optRes.data?.actions ?? [],
        calendar_connected: !!optRes.data?.calendar_connected,
        webhook_configured: !!optRes.data?.webhook_configured,
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'No pudimos cargar las automatizaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const flash = (kind: 'error' | 'success', msg: string) => {
    if (kind === 'error') { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
  };

  const isBusy = (k: string) => busyKey === k;

  // ── Crear / editar ──────────────────────────────────────────────────────────
  const availableActions = (options?.actions ?? []).filter(a => a.available !== false);

  const saveAutomation = async () => {
    if (!form.name.trim()) { flash('error', 'El nombre es obligatorio.'); return; }
    setBusyKey('save');
    setError(null);
    setSuccess(null);
    try {
      const configuration: Record<string, any> = {};
      if (form.trigger === 'bajo_rendimiento' && ACTIONS[form.action]?.displayConfig) {
        configuration.threshold = Number(form.threshold) || 60;
      }
      await api.post('/automations', {
        name: form.name.trim(),
        trigger: form.trigger,
        action: form.action,
        configuration,
        enabled: form.enabled,
      });
      setShowModal(false);
      setForm({ name: '', trigger: 'nueva_actividad', action: 'crear_alerta', enabled: true, threshold: 60 });
      flash('success', 'Automatización creada y guardada.');
      await loadAll();
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos guardar la automatización.');
    } finally { setBusyKey(null); }
  };

  // ── Acciones por fila ───────────────────────────────────────────────────────
  const toggleAutomation = async (a: Automation) => {
    setBusyKey(`toggle-${a.id}`);
    try {
      await api.post(`/automations/${a.id}/toggle`, { enabled: !a.enabled });
      await loadAll();
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos cambiar el estado.');
    } finally { setBusyKey(null); }
  };

  const runAutomation = async (a: Automation) => {
    setBusyKey(`run-${a.id}`);
    try {
      const res = await api.post(`/automations/${a.id}/run`);
      const ok = res.data?.ok;
      flash(ok ? 'success' : 'error', ok ? `Automatización ejecutada: ${res.data?.detail || 'ok'}` : `Error: ${res.data?.detail || 'desconocido'}`);
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos ejecutar la automatización.');
    } finally { setBusyKey(null); }
  };

  const deleteAutomation = async (a: Automation) => {
    if (!window.confirm(`¿Eliminar la automatización «${a.name}»?`)) return;
    setBusyKey(`delete-${a.id}`);
    try {
      await api.delete(`/automations/${a.id}`);
      await loadAll();
      flash('success', 'Automatización eliminada.');
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos eliminar la automatización.');
    } finally { setBusyKey(null); }
  };

  const openHistory = async (id: number) => {
    setExecutionsOf(id);
    setExecLoading(true);
    setError(null);
    try {
      const res = await api.get(`/automations/${id}/executions`);
      setExecutions(res.data?.executions ?? []);
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos cargar el historial.');
    } finally { setExecLoading(false); }
  };

  const checkLowPerformance = async () => {
    setBusyKey('check-low');
    setError(null); setSuccess(null);
    try {
      const res = await api.post('/automations/check-low-performance', { threshold: 60 });
      const d = res.data;
      flash('success',
        d?.count ? `Se detectaron ${d.count} estudiante(s) con bajo rendimiento y se ejecutaron ${(d.executions ?? []).length} alerta(s).`
                 : (d?.message || 'No se detectaron estudiantes por debajo del umbral.'));
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos evaluar el rendimiento.');
    } finally { setBusyKey(null); }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-[#E03E3E] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#E03E3E]">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
          <Check className="w-4 h-4 text-[#0F7B6C] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#0F7B6C]">{success}</p>
        </div>
      )}

      {/* ── Cabecera de acciones ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-[#787774]">
          <strong className="text-[#191919]">{automations.length}</strong> automatizaciones configuradas.
          {options?.calendar_connected ? ' · Google Calendar conectado ✅' : ' · Conecta Google Calendar para usar esa acción.'}
        </p>
        <div className="flex gap-2">
          <button onClick={checkLowPerformance} disabled={isBusy('check-low')}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#E9E9E7] text-[#2E6FDB] hover:bg-[#EEF3FD] rounded-lg text-sm font-medium transition-colors">
            {isBusy('check-low') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            Evaluar bajo rendimiento
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nueva automatización
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#2E6FDB] animate-spin" />
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-[#F7F6F3] border border-dashed border-[#E9E9E7] rounded-xl p-12 text-center">
          <FlaskConical className="w-10 h-10 text-[#E9E9E7] mx-auto mb-3" />
          <p className="text-sm text-[#787774]">Aún no tienes automatizaciones.</p>
          <p className="text-xs text-[#AEADAB] mt-1 mb-4">Crea una para que NeuroLearn actúe automáticamente cuando ocurra un evento.</p>
          <button onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors">
            <Plus className="w-4 h-4" /> Nueva automatización
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => {
            const trigLabel = TRIGGERS.find(t => t.value === a.trigger)?.label ?? a.trigger;
            const actLabel = ACTIONS[a.action]?.label ?? a.action;
            return (
              <div key={a.id} className="bg-white border border-[#E9E9E7] rounded-xl p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#EEF3FD] flex items-center justify-center text-lg flex-shrink-0">
                  {ACTION_EMOJI[a.action] ?? '⚙️'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[#191919] text-sm">{a.name}</h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${a.enabled ? 'bg-emerald-50 text-[#0F7B6C]' : 'bg-[#F7F6F3] text-[#AEADAB]'}`}>
                      {a.enabled ? 'Activa' : 'Inactiva'}
                    </span>
                  </div>
                  <p className="text-xs text-[#787774] mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>{TRIGGER_EMOJI[a.trigger] ?? ''} Cuando: <strong className="text-[#37352F]">{trigLabel}</strong></span>
                    <ChevronRight className="w-3 h-3 text-[#AEADAB]" />
                    <span>Acción: <strong className="text-[#37352F]">{actLabel}</strong></span>
                    {a.trigger === 'bajo_rendimiento' && a.configuration?.threshold != null && (
                      <span className="text-[#AEADAB]">· umbral {a.configuration.threshold}%</span>
                    )}
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => openHistory(a.id)} title="Historial"
                    className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EEF3FD] text-[#2E6FDB] transition-colors">
                    <History className="w-4 h-4" />
                  </button>
                  <button onClick={() => runAutomation(a)} disabled={isBusy(`run-${a.id}`)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0F7B6C] hover:bg-emerald-50 transition-colors">
                    {isBusy(`run-${a.id}`) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Ejecutar
                  </button>
                  <button onClick={() => toggleAutomation(a)} title={a.enabled ? 'Desactivar' : 'Activar'}
                    className={`w-9 h-8 flex items-center justify-center rounded-lg border transition-colors ${a.enabled ? 'bg-[#0F7B6C] text-white border-[#0F7B6C]' : 'bg-[#F7F6F3] text-[#AEADAB] border-[#E9E9E7]'}`}>
                    <Power className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteAutomation(a)} title="Eliminar"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[#AEADAB] hover:text-[#E03E3E] hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Historial de una automatización ────────────────────────────────── */}
      {executionsOf != null && (
        <div className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
            <h3 className="font-semibold text-[#191919] text-sm">Historial de ejecuciones</h3>
            <button onClick={() => setExecutionsOf(null)}><X className="w-4 h-4 text-[#787774]" /></button>
          </div>
          {execLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 text-[#2E6FDB] animate-spin" /></div>
          ) : executions.length === 0 ? (
            <p className="text-sm text-[#AEADAB] text-center py-8">Esta automatización aún no se ha ejecutado.</p>
          ) : (
            <div className="divide-y divide-[#F7F6F3]">
              {executions.map(ex => (
                <div key={ex.id} className="px-5 py-3 flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${ex.status === 'ok' ? 'bg-[#0F7B6C]' : 'bg-[#E03E3E]'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[#191919]">{ex.event || 'Ejecución'}</p>
                    <p className="text-[11px] text-[#787774] mt-0.5">{(ex.executed_at || '').replace('T', ' ').slice(0, 19)}</p>
                    {ex.detail && <p className="text-[11px] text-[#AEADAB] mt-0.5">{ex.detail}</p>}
                  </div>
                  <span className={`text-[10px] font-bold uppercase flex-shrink-0 ${ex.status === 'ok' ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>{ex.status === 'ok' ? 'OK' : 'Error'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Ejemplos reales ────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
        <h3 className="font-semibold text-[#191919] text-sm mb-4 flex items-center gap-2"><Zap className="w-4 h-4 text-[#2E6FDB]" /> Ejemplos sugeridos</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { e: 'Bajo rendimiento', a: 'Crear alerta', d: 'Cuando el promedio de un estudiante baje del umbral, crea una alerta para el docente.' },
            { e: 'Nueva actividad', a: 'Google Calendar', d: 'Cuando publiques una actividad, crea un evento en tu calendario conectado.', disabled: !options?.calendar_connected },
            { e: 'Nueva actividad', a: 'Webhook', d: 'Cuando publiques una actividad, envía un POST real a tu webhook.', disabled: !options?.webhook_configured },
          ].map((eg, i) => (
            <div key={i} className="border border-[#E9E9E7] rounded-lg p-4 bg-[#F7F6F3]/40">
              <p className="text-[10px] font-bold uppercase text-[#787774]">{eg.e} → {eg.a}</p>
              <p className="text-xs text-[#787774] mt-1.5 leading-relaxed">{eg.d}</p>
              {eg.disabled && <p className="text-[10px] text-[#D9730D] mt-2">Conecta la integración para usar esta acción.</p>}
              <button onClick={() => { setForm({ name: `${eg.e} → ${eg.a}`, trigger: eg.e === 'Bajo rendimiento' ? 'bajo_rendimiento' : 'nueva_actividad', action: eg.a === 'Google Calendar' ? 'google_calendar' : eg.a === 'Webhook' ? 'webhook' : 'crear_alerta', enabled: true, threshold: 60 }); setShowModal(true); }}
                disabled={!!eg.disabled}
                className="mt-3 flex items-center gap-1 text-xs text-[#2E6FDB] hover:underline font-medium disabled:opacity-40 disabled:no-underline cursor-pointer disabled:cursor-not-allowed">
                <RefreshCw className="w-3 h-3" /> Usar esta plantilla
              </button>
            </div>
          ))}
        </div>
        {onNavigate && (
          <button onClick={() => onNavigate('integraciones')} className="mt-4 text-xs text-[#2E6FDB] hover:underline font-medium">
            Conectar integraciones →
          </button>
        )}
      </div>

      {/* ── Modal crear automatización ─────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#191919]">Nueva automatización</h3>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4 text-[#787774]" /></button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Nombre *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="ej. Alerta de bajo rendimiento"
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Evento</label>
                <select value={form.trigger} onChange={e => setForm(p => ({ ...p, trigger: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm bg-white">
                  {TRIGGERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Acción</label>
                <select value={form.action} onChange={e => setForm(p => ({ ...p, action: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm bg-white">
                  {availableActions.length === 0 ? (
                    <option value="crear_alerta">Crear alerta</option>
                  ) : (
                    availableActions.map(a => <option key={a.value} value={a.value}>{ACTIONS[a.value]?.label ?? a.label}</option>))
                    }
                  {availableActions.length === 0 && (
                    <option value="enviar_notificacion" disabled>Enviar notificación</option>
                  )}
                </select>
                {form.action === 'google_calendar' && !options?.calendar_connected && (
                  <p className="text-[10px] text-[#D9730D] mt-1">Conecta Google Calendar para usar esta acción.</p>
                )}
                {form.action === 'webhook' && !options?.webhook_configured && (
                  <p className="text-[10px] text-[#D9730D] mt-1">Configura un webhook para usar esta acción.</p>
                )}
              </div>
            </div>

            {form.trigger === 'bajo_rendimiento' && ACTIONS[form.action]?.displayConfig && (
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Umbral de rendimiento (%)</label>
                <input type="number" min={0} max={100} value={form.threshold}
                  onChange={e => setForm(p => ({ ...p, threshold: Number(e.target.value) }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm" />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Estado</label>
              <div className="flex gap-2">
                {[true, false].map(active => (
                  <button key={String(active)} onClick={() => setForm(p => ({ ...p, enabled: active }))}
                    className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${form.enabled === active ? 'bg-[#2E6FDB] text-white border-[#2E6FDB]' : 'bg-white text-[#787774] border-[#E9E9E7]'}`}>
                    {active ? 'Activa' : 'Inactiva'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={saveAutomation} disabled={!form.name.trim() || isBusy('save')}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                {isBusy('save') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}