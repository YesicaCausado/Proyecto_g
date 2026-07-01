import { useState, useEffect, useRef } from 'react';
import {
  Users, GraduationCap, Upload, Plus, Download, Copy, CheckCircle,
  AlertCircle, FileText, Hash, Mail, User, BookOpen, X, ChevronDown,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type DocType = 'CC' | 'TI' | 'CE' | 'PA';

interface CredentialItem {
  full_name: string;
  username: string;
  temp_password: string;
  role: string;
}

interface LicenseUsage {
  license_type: string;
  max_teachers: number;
  current_teachers: number;
  max_students: number;
  current_students: number;
}

interface BulkResult {
  created: CredentialItem[];
  errors: { row: number; error: string; data: Record<string, string> }[];
  total_processed: number;
  total_created: number;
  total_errors: number;
}

const EMPTY_TEACHER = { full_name: '', document_type: 'CC' as DocType, document_number: '', email: '', subject_area: '' };
const EMPTY_STUDENT = { full_name: '', document_type: 'CC' as DocType, document_number: '', birth_date: '', email: '', grade: '' };

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'profesores' | 'estudiantes'>('profesores');
  const [license, setLicense] = useState<LicenseUsage | null>(null);
  const [loadingLicense, setLoadingLicense] = useState(true);

  useEffect(() => {
    api.get<LicenseUsage>('/api/v1/super/license-usage')
      .then(r => setLicense(r.data))
      .catch(() => {})
      .finally(() => setLoadingLicense(false));
  }, [tab]);

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-[#191919]">Panel de gestión</h1>
        <p className="text-sm text-[#787774] mt-0.5">
          Bienvenido, {user?.full_name} · Super Profesor
        </p>
      </div>

      {/* License bar */}
      {!loadingLicense && license && (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          <LicenseBar
            label="Profesores"
            current={license.current_teachers}
            max={license.max_teachers}
            color="bg-[#0B6E99]"
          />
          <LicenseBar
            label="Estudiantes"
            current={license.current_students}
            max={license.max_students}
            color="bg-[#0F7B6C]"
          />
          <p className="sm:col-span-2 text-xs text-[#787774]">
            Licencia: <span className="font-semibold capitalize text-[#37352F]">{license.license_type}</span>
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E9E9E7] mb-6 gap-1">
        {(['profesores', 'estudiantes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-[#37352F] text-[#191919]'
                : 'border-transparent text-[#787774] hover:text-[#37352F]'
            }`}>
            {t === 'profesores' ? <><Users className="w-4 h-4 inline mr-1.5" />Profesores</> : <><GraduationCap className="w-4 h-4 inline mr-1.5" />Estudiantes</>}
          </button>
        ))}
      </div>

      {tab === 'profesores' && <TeachersTab license={license} onRefresh={() => setLoadingLicense(true)} />}
      {tab === 'estudiantes' && <StudentsTab license={license} onRefresh={() => setLoadingLicense(true)} />}
    </div>
  );
}

// ─── License Bar ─────────────────────────────────────────────────────────────

function LicenseBar({ label, current, max, color }: { label: string; current: number; max: number; color: string }) {
  const pct = max >= 9999 ? 0 : Math.min((current / max) * 100, 100);
  const isLimit = max < 9999 && current >= max;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium text-[#37352F]">{label}</span>
        <span className={isLimit ? 'text-[#E03E3E] font-semibold' : 'text-[#787774]'}>
          {current} / {max >= 9999 ? '∞' : max}
        </span>
      </div>
      {max < 9999 && (
        <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isLimit ? 'bg-[#E03E3E]' : color}`}
            style={{ width: `${pct}%` }} />
        </div>
      )}
      {max >= 9999 && <p className="text-xs text-[#0F7B6C] font-medium">Ilimitados (Pro)</p>}
    </div>
  );
}

// ─── Teachers Tab ─────────────────────────────────────────────────────────────

function TeachersTab({ license, onRefresh }: { license: LicenseUsage | null; onRefresh: () => void }) {
  const [mode, setMode] = useState<'none' | 'manual' | 'csv'>('none');
  const [form, setForm] = useState({ ...EMPTY_TEACHER });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvProgress, setCsvProgress] = useState(false);

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setLoading(true);
    try {
      const { data } = await api.post<CredentialItem>('/api/v1/super/teachers', form);
      setCredentials(prev => [data, ...prev]);
      setForm({ ...EMPTY_TEACHER });
      setMode('none');
      onRefresh();
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? 'Error al crear el profesor');
    } finally { setLoading(false); }
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvProgress(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post<BulkResult>('/api/v1/super/teachers/bulk', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBulkResult(data);
      setCredentials(prev => [...data.created, ...prev]);
      onRefresh();
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? 'Error procesando el CSV');
    } finally { setCsvProgress(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const limitReached = license ? license.current_teachers >= license.max_teachers && license.max_teachers < 9999 : false;

  return (
    <div className="space-y-5">
      {limitReached && (
        <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-md p-4 text-sm text-[#E03E3E] flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Has alcanzado el límite de profesores de tu licencia</p>
            <p className="mt-0.5">Profesores: {license?.current_teachers} / {license?.max_teachers}. Actualiza tu licencia para continuar.</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      {mode === 'none' && !limitReached && (
        <div className="flex gap-3">
          <button onClick={() => setMode('manual')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#37352F] text-white text-sm rounded-md hover:bg-[#2F2D2B] font-medium">
            <Plus className="w-4 h-4" /> Agregar profesor
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 border border-[#E9E9E7] text-[#37352F] text-sm rounded-md hover:bg-[#F1F1EF] cursor-pointer font-medium">
            <Upload className="w-4 h-4" /> Importar CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          </label>
          <a href="/plantilla_profesores.csv" download
            className="flex items-center gap-2 px-4 py-2.5 border border-[#E9E9E7] text-[#787774] text-sm rounded-md hover:bg-[#F1F1EF]">
            <Download className="w-4 h-4" /> Plantilla CSV
          </a>
        </div>
      )}

      {csvProgress && (
        <div className="bg-[#E5F3FF] border border-[#BFDFF0] rounded-md p-4 flex items-center gap-3 text-sm text-[#0B6E99]">
          <span className="w-4 h-4 border-2 border-[#0B6E99]/30 border-t-[#0B6E99] rounded-full animate-spin" />
          Procesando archivo CSV…
        </div>
      )}

      {/* Manual form */}
      {mode === 'manual' && (
        <form onSubmit={handleManual} className="bg-white border border-[#E9E9E7] rounded-md p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#191919]">Nuevo profesor</h3>
            <button type="button" onClick={() => { setMode('none'); setServerError(null); }}>
              <X className="w-4 h-4 text-[#787774] hover:text-[#191919]" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MiniField label="Nombre completo *" icon={User} value={form.full_name}
              onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="María García López" />
            <div className="grid grid-cols-2 gap-2">
              <MiniSelect label="Tipo doc." value={form.document_type}
                options={['CC','TI','CE','PA']} onChange={v => setForm(f => ({ ...f, document_type: v as DocType }))} />
              <MiniField label="Número doc. *" icon={Hash} value={form.document_number}
                onChange={v => setForm(f => ({ ...f, document_number: v }))} placeholder="10234567" />
            </div>
            <MiniField label="Correo *" icon={Mail} value={form.email} type="email"
              onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="prof@colegio.edu.co" />
            <MiniField label="Área / Materia" icon={BookOpen} value={form.subject_area}
              onChange={v => setForm(f => ({ ...f, subject_area: v }))} placeholder="Matemáticas" />
          </div>
          {serverError && <p className="text-xs text-[#E03E3E] bg-[#FDEEEE] rounded-md p-2">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-[#37352F] text-white text-sm rounded-md hover:bg-[#2F2D2B] disabled:opacity-50 font-medium flex items-center gap-2">
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Crear y generar credencial
            </button>
            <button type="button" onClick={() => { setMode('none'); setServerError(null); }}
              className="px-4 py-2 text-sm border border-[#E9E9E7] text-[#37352F] rounded-md hover:bg-[#F1F1EF]">Cancelar</button>
          </div>
        </form>
      )}

      {/* Bulk result summary */}
      {bulkResult && (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#191919]">Resultado de importación</h3>
            <button onClick={() => setBulkResult(null)}><X className="w-4 h-4 text-[#787774]" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div className="bg-[#F7F6F3] rounded-md p-3">
              <p className="text-2xl font-bold text-[#191919]">{bulkResult.total_processed}</p>
              <p className="text-xs text-[#787774]">Total procesados</p>
            </div>
            <div className="bg-[#EEF7F4] rounded-md p-3">
              <p className="text-2xl font-bold text-[#0F7B6C]">{bulkResult.total_created}</p>
              <p className="text-xs text-[#787774]">Creados</p>
            </div>
            <div className={`rounded-md p-3 ${bulkResult.total_errors > 0 ? 'bg-[#FDEEEE]' : 'bg-[#F7F6F3]'}`}>
              <p className={`text-2xl font-bold ${bulkResult.total_errors > 0 ? 'text-[#E03E3E]' : 'text-[#9B9A97]'}`}>{bulkResult.total_errors}</p>
              <p className="text-xs text-[#787774]">Con errores</p>
            </div>
          </div>
          {bulkResult.errors.length > 0 && (
            <div className="border border-[#F4BDBD] rounded-md p-3 bg-[#FDEEEE]">
              <p className="text-xs font-semibold text-[#E03E3E] mb-2">Errores encontrados:</p>
              <div className="space-y-1 max-h-32 overflow-auto">
                {bulkResult.errors.map((e, i) => (
                  <p key={i} className="text-xs text-[#E03E3E]">Fila {e.row}: {e.error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Credentials table */}
      {credentials.length > 0 && (
        <CredentialsTable credentials={credentials} onDownload={() => downloadCSV(credentials, 'profesores')} />
      )}
    </div>
  );
}

// ─── Students Tab ─────────────────────────────────────────────────────────────

function StudentsTab({ license, onRefresh }: { license: LicenseUsage | null; onRefresh: () => void }) {
  const [mode, setMode] = useState<'none' | 'manual' | 'csv'>('none');
  const [form, setForm] = useState({ ...EMPTY_STUDENT });
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvProgress, setCsvProgress] = useState(false);

  const handleManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setLoading(true);
    try {
      const { data } = await api.post<CredentialItem>('/api/v1/super/students', form);
      setCredentials(prev => [data, ...prev]);
      setForm({ ...EMPTY_STUDENT });
      setMode('none');
      onRefresh();
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? 'Error al crear el estudiante');
    } finally { setLoading(false); }
  };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvProgress(true);
    const fd = new FormData(); fd.append('file', file);
    try {
      const { data } = await api.post<BulkResult>('/api/v1/super/students/bulk', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setBulkResult(data);
      setCredentials(prev => [...data.created, ...prev]);
      onRefresh();
    } catch (err: any) {
      setServerError(err?.response?.data?.detail ?? 'Error procesando el CSV');
    } finally { setCsvProgress(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const limitReached = license ? license.current_students >= license.max_students && license.max_students < 9999 : false;

  return (
    <div className="space-y-5">
      {limitReached && (
        <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-md p-4 text-sm text-[#E03E3E] flex items-start gap-3">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Has alcanzado el límite de estudiantes de tu licencia</p>
            <p className="mt-0.5">Estudiantes: {license?.current_students} / {license?.max_students}. Actualiza tu licencia para continuar.</p>
          </div>
        </div>
      )}

      {mode === 'none' && !limitReached && (
        <div className="flex gap-3">
          <button onClick={() => setMode('manual')}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#37352F] text-white text-sm rounded-md hover:bg-[#2F2D2B] font-medium">
            <Plus className="w-4 h-4" /> Agregar estudiante
          </button>
          <label className="flex items-center gap-2 px-4 py-2.5 border border-[#E9E9E7] text-[#37352F] text-sm rounded-md hover:bg-[#F1F1EF] cursor-pointer font-medium">
            <Upload className="w-4 h-4" /> Importar CSV
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} />
          </label>
          <a href="/plantilla_estudiantes.csv" download
            className="flex items-center gap-2 px-4 py-2.5 border border-[#E9E9E7] text-[#787774] text-sm rounded-md hover:bg-[#F1F1EF]">
            <Download className="w-4 h-4" /> Plantilla CSV
          </a>
        </div>
      )}

      {csvProgress && (
        <div className="bg-[#E5F3FF] border border-[#BFDFF0] rounded-md p-4 flex items-center gap-3 text-sm text-[#0B6E99]">
          <span className="w-4 h-4 border-2 border-[#0B6E99]/30 border-t-[#0B6E99] rounded-full animate-spin" />
          Procesando archivo CSV…
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={handleManual} className="bg-white border border-[#E9E9E7] rounded-md p-6 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-[#191919]">Nuevo estudiante</h3>
            <button type="button" onClick={() => { setMode('none'); setServerError(null); }}>
              <X className="w-4 h-4 text-[#787774]" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <MiniField label="Nombre completo *" icon={User} value={form.full_name}
              onChange={v => setForm(f => ({ ...f, full_name: v }))} placeholder="Juan Pérez Rodríguez" />
            <div className="grid grid-cols-2 gap-2">
              <MiniSelect label="Tipo doc." value={form.document_type}
                options={['CC','TI','CE','PA']} onChange={v => setForm(f => ({ ...f, document_type: v as DocType }))} />
              <MiniField label="Número doc. *" icon={Hash} value={form.document_number}
                onChange={v => setForm(f => ({ ...f, document_number: v }))} placeholder="1023456789" />
            </div>
            <MiniField label="Fecha de nacimiento" icon={FileText} value={form.birth_date} type="date"
              onChange={v => setForm(f => ({ ...f, birth_date: v }))} />
            <MiniField label="Correo (opcional)" icon={Mail} value={form.email} type="email"
              onChange={v => setForm(f => ({ ...f, email: v }))} placeholder="estudiante@gmail.com" />
            <MiniField label="Grado" icon={GraduationCap} value={form.grade}
              onChange={v => setForm(f => ({ ...f, grade: v }))} placeholder="11°" />
          </div>
          {serverError && <p className="text-xs text-[#E03E3E] bg-[#FDEEEE] rounded-md p-2">{serverError}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="px-5 py-2 bg-[#37352F] text-white text-sm rounded-md hover:bg-[#2F2D2B] disabled:opacity-50 font-medium flex items-center gap-2">
              {loading ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Crear y generar credencial
            </button>
            <button type="button" onClick={() => { setMode('none'); setServerError(null); }}
              className="px-4 py-2 text-sm border border-[#E9E9E7] text-[#37352F] rounded-md hover:bg-[#F1F1EF]">Cancelar</button>
          </div>
        </form>
      )}

      {bulkResult && (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#191919]">Resultado de importación</h3>
            <button onClick={() => setBulkResult(null)}><X className="w-4 h-4 text-[#787774]" /></button>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div className="bg-[#F7F6F3] rounded-md p-3">
              <p className="text-2xl font-bold text-[#191919]">{bulkResult.total_processed}</p>
              <p className="text-xs text-[#787774]">Procesados</p>
            </div>
            <div className="bg-[#EEF7F4] rounded-md p-3">
              <p className="text-2xl font-bold text-[#0F7B6C]">{bulkResult.total_created}</p>
              <p className="text-xs text-[#787774]">Creados</p>
            </div>
            <div className={`rounded-md p-3 ${bulkResult.total_errors > 0 ? 'bg-[#FDEEEE]' : 'bg-[#F7F6F3]'}`}>
              <p className={`text-2xl font-bold ${bulkResult.total_errors > 0 ? 'text-[#E03E3E]' : 'text-[#9B9A97]'}`}>{bulkResult.total_errors}</p>
              <p className="text-xs text-[#787774]">Errores</p>
            </div>
          </div>
          {bulkResult.errors.length > 0 && (
            <div className="border border-[#F4BDBD] rounded-md p-3 bg-[#FDEEEE] max-h-32 overflow-auto">
              {bulkResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-[#E03E3E]">Fila {e.row}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {credentials.length > 0 && (
        <CredentialsTable credentials={credentials} onDownload={() => downloadCSV(credentials, 'estudiantes')} />
      )}
    </div>
  );
}

// ─── Credentials Table ────────────────────────────────────────────────────────

function CredentialsTable({ credentials, onDownload }: { credentials: CredentialItem[]; onDownload: () => void }) {
  const [visible, setVisible] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  const toggleVisible = (i: number) =>
    setVisible(prev => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  const copyRow = (c: CredentialItem, i: number) => {
    navigator.clipboard.writeText(`${c.full_name}\t${c.username}\t${c.temp_password}`);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-[#E9E9E7]">
        <h3 className="text-sm font-semibold text-[#191919]">
          Credenciales generadas <span className="text-[#787774] font-normal">({credentials.length})</span>
        </h3>
        <button onClick={onDownload}
          className="flex items-center gap-1.5 text-xs text-[#0B6E99] hover:text-[#37352F] border border-[#BFDFF0] rounded-md px-3 py-1.5 hover:bg-[#E5F3FF] transition-colors">
          <Download className="w-3.5 h-3.5" /> Descargar CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#F7F6F3] text-left">
              <th className="px-5 py-3 text-xs font-medium text-[#787774] uppercase tracking-wide">Nombre</th>
              <th className="px-5 py-3 text-xs font-medium text-[#787774] uppercase tracking-wide">Usuario</th>
              <th className="px-5 py-3 text-xs font-medium text-[#787774] uppercase tracking-wide">Contraseña temporal</th>
              <th className="px-5 py-3 text-xs font-medium text-[#787774] uppercase tracking-wide w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {credentials.map((c, i) => (
              <tr key={i} className="hover:bg-[#F7F6F3] transition-colors">
                <td className="px-5 py-3 font-medium text-[#191919]">{c.full_name}</td>
                <td className="px-5 py-3 font-mono text-[#37352F]">{c.username}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-[#37352F]">
                      {visible.has(i) ? c.temp_password : '•'.repeat(8)}
                    </code>
                    <button onClick={() => toggleVisible(i)} className="text-[#9B9A97] hover:text-[#787774]">
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${visible.has(i) ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => copyRow(c, i)} className="text-[#9B9A97] hover:text-[#0B6E99] transition-colors">
                    {copied === i ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Mini field helpers ───────────────────────────────────────────────────────

function MiniField({ label, icon: Icon, value, onChange, placeholder, type = 'text' }: {
  label: string; icon: React.ElementType; value: string;
  onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#37352F] mb-1">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 text-sm border border-[#E9E9E7] rounded-md bg-white text-[#191919]
            placeholder-[#9B9A97] focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99]" />
      </div>
    </div>
  );
}

function MiniSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#37352F] mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-[#E9E9E7] rounded-md bg-white text-[#191919]
          focus:outline-none focus:ring-2 focus:ring-[#E5F3FF] focus:border-[#0B6E99] appearance-none">
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ─── CSV download ─────────────────────────────────────────────────────────────

function downloadCSV(credentials: CredentialItem[], filename: string) {
  const header = 'Nombre,Usuario,Contraseña temporal\n';
  const rows = credentials.map(c => `"${c.full_name}","${c.username}","${c.temp_password}"`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `credenciales_${filename}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}
