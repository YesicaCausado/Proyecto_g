import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Calendar as CalendarIcon, AlertTriangle, Check,
  Link2, Folder, Upload, Plus, ChevronRight, X, Zap,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../../../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Integration {
  id?: number;
  provider: string;
  status: string;            // connected | error | token_expired | disconnected | not_configured
  account_email?: string | null;
  account_label?: string | null;
  config: Record<string, any>;
  updated_at?: string | null;
}

interface DriveFolder { id: string; name: string; }
interface DriveFile { id: string; name: string; mime_type?: string; type?: string; size?: string | null; modified?: string | null; }
interface Cal { id: string; name: string; primary?: boolean; }

interface IntegrationState {
  googleDrive?: Integration;
  googleCalendar?: Integration;
}

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  connected:      { label: 'Conectado',           color: 'text-[#0F7B6C]', bg: 'bg-emerald-50 border-emerald-200' },
  disconnected:   { label: 'Desconectado',        color: 'text-[#787774]', bg: 'bg-[#F7F6F3] border-[#E9E9E7]' },
  error:          { label: 'Error',               color: 'text-[#E03E3E]', bg: 'bg-red-50 border-red-200' },
  token_expired:  { label: 'Token expirado',      color: 'text-[#D9730D]', bg: 'bg-orange-50 border-orange-200' },
  not_configured: { label: 'No configurado',      color: 'text-[#AEADAB]', bg: 'bg-[#F7F6F3] border-[#E9E9E7]' },
};

export default function IntegracionesTab({ onNavigate }: { onNavigate?: (t: string) => void }) {
  const [loading,      setLoading]      = useState(true);
  const [googleReady,  setGoogleReady]  = useState(true);
  const [state,        setState]        = useState<IntegrationState>({});
  const [busyKey,      setBusyKey]      = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);
  const [success,      setSuccess]      = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/integrations', { params: { _t: Date.now() } });
      const ints: Integration[] = res.data?.integrations ?? [];
      const byProvider: IntegrationState = {};
      for (const i of ints) {
        if (i.provider === 'google_drive')   byProvider.googleDrive   = i;
        if (i.provider === 'google_calendar') byProvider.googleCalendar = i;
      }
      setState(byProvider);
      setGoogleReady(res.data?.google_configured !== false);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setError(typeof detail === 'string' && detail ? detail : 'No pudimos cargar las integraciones. Inténtalo nuevamente.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Resultado del regreso de Google OAuth (antes un error se perdía en silencio).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const oauthError = searchParams.get('integration_error');
    const oauthOk = searchParams.get('integration_ok');
    if (!oauthError && !oauthOk) return;
    if (oauthError) { setError(oauthError); setSuccess(null); }
    else { setSuccess('Cuenta de Google conectada correctamente.'); setError(null); }
    const next = new URLSearchParams(searchParams);
    ['integration_error', 'integration_ok', 'integration'].forEach(k => next.delete(k));
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const flash = (kind: 'error' | 'success', msg: string) => {
    if (kind === 'error') { setError(msg); setSuccess(null); }
    else { setSuccess(msg); setError(null); }
  };

  const wrap = async (key: string, fn: () => Promise<void>) => {
    setBusyKey(key);
    setError(null);
    setSuccess(null);
    try { await fn(); } catch (e: any) {
      const detail = e?.response?.data?.detail;
      flash('error', typeof detail === 'string' && detail ? detail : 'Ocurrió un error. Inténtalo nuevamente.');
    } finally { setBusyKey(null); }
  };

  const isBusy = (key: string) => busyKey === key;

  // ── OAuth connect / disconnect ──────────────────────────────────────────────
  const connect = async (provider: 'drive' | 'calendar') => {
    setBusyKey(provider);
    setError(null);
    try {
      const res = await api.post(`/integrations/google/${provider}/connect`);
      const url = res.data?.url;
      if (url) window.location.href = url;
      else flash('error', 'No pudimos generar el enlace de Google.');
    } catch (e: any) {
      const d = e?.response?.status === 503
        ? 'Google no está configurado en el servidor (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).'
        : (e?.response?.data?.detail || 'No pudimos conectar Google. Inténtalo nuevamente.');
      flash('error', d);
    } finally { setBusyKey(null); }
  };

  const disconnect = async (provider: 'google_drive' | 'google_calendar') => {
    if (!window.confirm('¿Desconectar esta integración? Se revocarán las credenciales de Google.')) return;
    await wrap(`disconnect-${provider}`, async () => {
      await api.delete(`/integrations/${provider}`);
      await loadAll();
      flash('success', 'Integración desconectada y credenciales revocadas.');
    });
  };

  // ── Drive: seleccionar carpeta e importar ───────────────────────────────────
  const drive = state.googleDrive;
  const driveConnected = drive?.status === 'connected';
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [driveFilesOf, setDriveFilesOf] = useState<string | null>(null);
  const [folderLoading, setFolderLoading] = useState(false);

  const openDrivePicker = async () => {
    setFolderLoading(true);
    setError(null);
    try {
      const res = await api.get('/integrations/google/drive/folders');
      setDriveFolders(res.data?.folders ?? []);
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos listar las carpetas de Drive.');
    } finally { setFolderLoading(false); }
  };

  const openFolder = async (f: DriveFolder) => {
    setDriveFilesOf(f.id);
    setFolderLoading(true);
    setError(null);
    try {
      const res = await api.get(`/integrations/google/drive/folders/${f.id}/files`);
      // Solo se exploran los archivos: abrir una carpeta ya no la guarda
      // como carpeta predeterminada (era un efecto lateral no pedido).
      setDriveFiles(res.data?.files ?? []);
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos listar los archivos de la carpeta.');
    } finally { setFolderLoading(false); }
  };

  const importFromDrive = async (fileIds: string[], folderId: string | null) => {
    const files = driveFiles.filter(f => fileIds.includes(f.id));
    if (files.length === 0) return;
    await wrap('import', async () => {
      const res = await api.post('/integrations/google/drive/import', {
        files,
        folder_id: folderId || undefined,
      });
      flash('success', `${res.data?.count ?? files.length} archivo(s) agregado(s) a Materiales › «Desde Google Drive» como enlace (se abren en Drive).`);
    });
  };

  // ── Calendar ────────────────────────────────────────────────────────────────
  const calendar = state.googleCalendar;
  const calendarConnected = calendar?.status === 'connected';
  const [cals, setCals] = useState<Cal[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showCalForm, setShowCalForm] = useState(false);
  const [calForm, setCalForm] = useState({ title: '', calendar_id: '', event_date: '', event_time: '', description: '' });

  const openCalendarPicker = async () => {
    setCalendarLoading(true);
    setError(null);
    try {
      const res = await api.get('/integrations/google/calendar/calendars');
      setCals(res.data?.calendars ?? []);
    } catch (e: any) {
      flash('error', e?.response?.data?.detail || 'No pudimos consultar Google Calendar.');
    } finally { setCalendarLoading(false); }
  };

  const selectCalendar = async (c: Cal) => {
    await wrap('calendar-select', async () => {
      await api.post('/integrations/google/calendar/select', { calendar_id: c.id, calendar_name: c.name });
      await loadAll();
      flash('success', `Calendario «${c.name}» seleccionado.`);
    });
  };

  const createCalendarEvent = async () => {
    if (!calForm.title.trim() || !calForm.event_date || !calForm.calendar_id) return;
    await wrap('calendar-create', async () => {
      await api.post('/integrations/google/calendar/events', {
        title: calForm.title.trim(),
        calendar_id: calForm.calendar_id,
        event_date: calForm.event_date,
        event_time: calForm.event_time || null,
        description: calForm.description,
        event_type: 'clase',
      });
      setShowCalForm(false);
      setCalForm({ title: '', calendar_id: '', event_date: '', event_time: '', description: '' });
      flash('success', 'Evento creado en Google Calendar.');
    });
  };

  // ── UI helpers ──────────────────────────────────────────────────────────────
  const badge = (_provider: string, status: string) => {
    const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.not_configured;
    return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
  };

  const ActionButton = ({ disabled, onClick, children, color = 'blue' }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
        color === 'red' ? 'text-[#E03E3E] hover:bg-red-50'
        : color === 'ghost' ? 'text-[#2E6FDB] hover:bg-[#EEF3FD]'
        : 'bg-[#2E6FDB] text-white hover:bg-[#255DC0]'}`}
    >
      {children}
    </button>
  );

  const busy = (key: string) => isBusy(key);

  return (
    <div className="space-y-6">
      {/* Mensajes de estado */}
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

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-[#2E6FDB] animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Google Drive ─────────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden">
            <div className="p-5 flex items-center gap-4 border-b border-[#E9E9E7]">
              <div className="w-11 h-11 rounded-lg bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center flex-shrink-0 text-xl">📁</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[#191919]">Google Drive</h3>
                  {drive && badge('google_drive', drive.status)}
                </div>
                <p className="text-xs text-[#787774] mt-0.5">Importa archivos desde tu Google Drive a los Materiales de NeuroLearn.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {driveConnected ? (
                  <ActionButton color="red" disabled={busy('disconnect-google_drive')} onClick={() => disconnect('google_drive')}>Desconectar</ActionButton>
                ) : (
                  <ActionButton disabled={busy('drive') || !googleReady} onClick={() => connect('drive')}>
                    {busy('drive') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    Conectar Drive
                  </ActionButton>
                )}
              </div>
            </div>

            {!googleReady && (
              <div className="px-5 py-4 text-sm text-[#D9730D]">Google no está configurado en el servidor. El administrador debe setear GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.</div>
            )}

            {driveConnected && (
              <div className="p-5 space-y-4">
                {/* Cuenta conectada */}
                <div className="rounded-lg bg-[#F7F6F3] border border-[#E9E9E7] px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0F7B6C] flex items-center justify-center"><Check className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium text-[#191919]">{drive.account_email || 'Cuenta de Google'}</p>
                    <p className="text-xs text-[#0F7B6C]">Conectado como: {drive.account_email || 'cuenta conectada'}</p>
                  </div>
                </div>

                {/* Selección de carpeta */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-[#787774] uppercase">Carpeta de Drive</p>
                    <button onClick={openDrivePicker} disabled={folderLoading}
                      className="flex items-center gap-1.5 text-xs text-[#2E6FDB] hover:underline font-medium">
                      {folderLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Folder className="w-3.5 h-3.5" />}
                      Seleccionar carpeta
                    </button>
                  </div>

                  {driveFolders.length === 0 && !folderLoading && drive.config?.folder_name && (
                    <p className="text-sm text-[#787774] mb-2">Carpeta seleccionada: <strong className="text-[#191919]">{drive.config.folder_name}</strong></p>
                  )}

                  {folderLoading ? (
                    <div className="flex items-center gap-2 text-sm text-[#787774] py-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando carpetas…</div>
                  ) : driveFolders.length > 0 && !driveFilesOf ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                      {driveFolders.map(f => (
                        <button key={f.id} onClick={() => openFolder(f)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[#E9E9E7] hover:bg-[#EEF3FD] transition-colors text-left">
                          <Folder className="w-4 h-4 text-[#D9730D]" />
                          <span className="text-sm text-[#37352F] truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Archivos de la carpeta abierta */}
                {driveFilesOf && (
                  <DriveFilesList
                    files={driveFiles}
                    onBack={() => { setDriveFilesOf(null); setDriveFiles([]); }}
                    onImport={importFromDrive}
                  />
                )}
              </div>
            )}
          </div>

          {/* ── Google Calendar ───────────────────────────────────────────── */}
          <div className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden">
            <div className="p-5 flex items-center gap-4 border-b border-[#E9E9E7]">
              <div className="w-11 h-11 rounded-lg bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center flex-shrink-0 text-xl">📅</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-[#191919]">Google Calendar</h3>
                  {calendar && badge('google_calendar', calendar.status)}
                </div>
                <p className="text-xs text-[#787774] mt-0.5">Crea eventos y sincroniza tus actividades académicas.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {calendarConnected ? (
                  <ActionButton color="red" disabled={busy('disconnect-google_calendar')} onClick={() => disconnect('google_calendar')}>Desconectar</ActionButton>
                ) : (
                  <ActionButton disabled={busy('calendar') || !googleReady} onClick={() => connect('calendar')}>
                    {busy('calendar') ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    Conectar Calendar
                  </ActionButton>
                )}
              </div>
            </div>

            {!googleReady && <div className="px-5 py-4 text-sm text-[#D9730D]">Google no está configurado en el servidor.</div>}

            {calendarConnected && (
              <div className="p-5 space-y-4">
                <div className="rounded-lg bg-[#F7F6F3] border border-[#E9E9E7] px-4 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#0F7B6C] flex items-center justify-center"><Check className="w-4 h-4" /></div>
                  <div>
                    <p className="text-sm font-medium text-[#191919]">{calendar.account_email || 'Cuenta de Google'}</p>
                    <p className="text-xs text-[#0F7B6C]">Conectado como: {calendar.account_email || 'cuenta conectada'}</p>
                    {calendar.config?.calendar_name && (
                      <p className="text-xs text-[#787774] mt-0.5">Calendario: {calendar.config.calendar_name}</p>
                    )}
                  </div>
                </div>

                {/* Selector de calendario */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-[#787774] uppercase">Seleccionar calendario</p>
                  <button onClick={openCalendarPicker} disabled={calendarLoading}
                    className="flex items-center gap-1.5 text-xs text-[#2E6FDB] hover:underline font-medium">
                    {calendarLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarIcon className="w-3.5 h-3.5" />}
                    Cambiar calendario
                  </button>
                </div>

                {calendarLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[#787774] py-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando calendarios…</div>
                ) : cals.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {cals.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-[#E9E9E7]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CalendarIcon className="w-4 h-4 text-[#2E6FDB] flex-shrink-0" />
                          <span className="text-sm text-[#37352F] truncate">{c.name} {c.primary ? '(principal)' : ''}</span>
                        </div>
                        <button onClick={() => selectCalendar(c)}
                          className="text-xs text-[#2E6FDB] hover:underline font-medium flex-shrink-0">Usar</button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Crear evento */}
                <div className="flex items-center justify-between pt-2 border-t border-[#F7F6F3]">
                  <p className="text-xs font-semibold text-[#787774] uppercase">Crear evento</p>
                  <button onClick={() => setShowCalForm(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6FDB] text-white rounded-lg text-xs font-medium hover:bg-[#255DC0] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Nuevo evento
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sugerencia de automatizaciones */}
          <div className="flex items-center justify-between bg-white border border-[#E9E9E7] rounded-xl p-5">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-[#2E6FDB]" />
              <div>
                <h3 className="font-semibold text-[#191919] text-sm">Conecta y automatiza</h3>
                <p className="text-xs text-[#787774]">Crea automatizaciones que usen estas integraciones para ahorrar tiempo.</p>
              </div>
            </div>
            {onNavigate && (
              <button onClick={() => onNavigate('automatizaciones')}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#2E6FDB] text-white rounded-lg text-xs font-medium hover:bg-[#255DC0] transition-colors flex-shrink-0">
                Ir a Automatizaciones <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Modal crear evento de calendario */}
      {showCalForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#191919]">Crear evento en Google Calendar</h3>
              <button onClick={() => setShowCalForm(false)}><X className="w-4 h-4 text-[#787774]" /></button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Título *</label>
              <input value={calForm.title} onChange={e => setCalForm(p => ({ ...p, title: e.target.value }))}
                placeholder="ej. Examen parcial — Física"
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Calendario</label>
              <select value={calForm.calendar_id} onChange={e => setCalForm(p => ({ ...p, calendar_id: e.target.value }))}
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm bg-white">
                <option value="">Seleccionar calendario…</option>
                {cals.length === 0 && <option value={calendar?.config?.calendar_id}>{calendar?.config?.calendar_name || 'Calendario principal'}</option>}
                {cals.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                {calendar?.config?.calendar_id && !cals.some(c => c.id === calendar.config.calendar_id) && (
                  <option value={calendar.config.calendar_id}>{calendar.config.calendar_name || 'Calendario configurado'}</option>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Fecha *</label>
                <input type="date" value={calForm.event_date} onChange={e => setCalForm(p => ({ ...p, event_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Hora (opcional)</label>
                <input type="time" value={calForm.event_time} onChange={e => setCalForm(p => ({ ...p, event_time: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#787774] uppercase mb-1.5">Descripción</label>
              <textarea value={calForm.description} onChange={e => setCalForm(p => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Detalles del evento"
                className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCalForm(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={createCalendarEvent} disabled={!calForm.title.trim() || !calForm.event_date || !calForm.calendar_id || busy('calendar-create')}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                {busy('calendar-create') ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarIcon className="w-4 h-4" />} Crear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Lista de archivos de Drive ────────────────────────────────────────────────
function DriveFilesList({ files, onBack, onImport }: {
  files: DriveFile[];
  onBack: () => void;
  onImport: (ids: string[], folderId: string | null) => void;
}) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const toggle = (id: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const runImport = async () => {
    setImporting(true);
    await onImport(Array.from(selectedFiles), null);
    setImporting(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-sm text-[#787774] hover:text-[#37352F] transition-colors">← Volver a carpetas</button>
        <button onClick={runImport} disabled={selectedFiles.size === 0 || importing}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2E6FDB] text-white rounded-lg text-xs font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Importar ({selectedFiles.size})
        </button>
      </div>
      {files.length === 0 ? (
        <p className="text-sm text-[#AEADAB] text-center py-4 bg-[#F7F6F3] rounded-lg">Esta carpeta no tiene archivos.</p>
      ) : (
        <div className="border border-[#E9E9E7] rounded-lg overflow-hidden max-h-72 overflow-y-auto">
          {files.map(f => (
            <label key={f.id} className="flex items-center gap-3 px-4 py-2.5 border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50 cursor-pointer transition-colors">
              <input type="checkbox" checked={selectedFiles.has(f.id)} onChange={() => toggle(f.id)} className="w-4 h-4 text-[#2E6FDB] rounded" />
              <FileIcon type={f.type} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#191919] truncate">{f.name}</p>
                {f.size && <p className="text-[11px] text-[#787774]">{formatSize(f.size)}</p>}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function FileIcon({ type }: { type?: string }) {
  const map: Record<string, string> = {
    pdf: '📄', doc: '📝', sheet: '📊', ppt: '📽️', txt: '📃', img: '🖼️',
  };
  return <span className="text-lg flex-shrink-0">{map[type || 'file'] ?? '📄'}</span>;
}

function formatSize(size: string | number | null): string {
  if (!size) return '';
  const n = Number(size);
  if (!isFinite(n)) return String(size);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}