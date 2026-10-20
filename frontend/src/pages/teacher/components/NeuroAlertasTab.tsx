import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, Clock, ChevronRight, CheckCircle, BookOpen, Loader2, Activity, Hash, RefreshCw,
} from 'lucide-react';
import api from '../../../services/api';

// Las alertas salen de GET /classrooms/{id}/alerts: reglas comunes con el
// Súper Profesor (backend/app/services/neuroalert_service.py) sobre los datos
// reales de cada inscripción. «Resolver» se guarda en el backend y la alerta
// se reabre sola si la condición que la originó cambia.

type Priority = 'alta' | 'media' | 'baja';
type AlertType = 'inactivity' | 'never_started' | 'low_performance' | 'cognitive_risk';

interface Alert {
  id: string;
  classroomId: number;
  classroomName: string;
  type: AlertType;
  priority: Priority;
  title: string;
  studentId: string;
  affected: string;
  resolved: boolean;
}

interface Student {
  id: string;
  name: string;
  groups: string[];
  avg: number | null;   // 0-10; null = sin sesiones con calificación (no 0)
  risk: 'high' | 'medium';
  sessions: number;
  minutes: number;
  lastActivity: string | null;
  riskFactors: string[];
  alerts: Alert[];
}

const CATEGORY: Record<AlertType, string> = {
  inactivity: 'Inactividad',
  never_started: 'Sin inicio',
  low_performance: 'Bajo rendimiento',
  cognitive_risk: 'Riesgo cognitivo',
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  alta:  { label:'Alta',  color:'text-[#E03E3E]', bg:'bg-red-50   border-red-200',    dot:'bg-[#E03E3E]' },
  media: { label:'Media', color:'text-[#D9730D]', bg:'bg-orange-50 border-orange-200', dot:'bg-[#D9730D]' },
  baja:  { label:'Baja',  color:'text-[#0F7B6C]', bg:'bg-emerald-50 border-emerald-200', dot:'bg-[#0F7B6C]' },
};

const RISK_CONFIG: Record<Student['risk'], { label:string; color:string; bg:string }> = {
  high:   { label:'Prioridad alta',  color:'text-[#E03E3E]', bg:'bg-red-50'    },
  medium: { label:'Prioridad media', color:'text-[#D9730D]', bg:'bg-orange-50' },
};

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CO') : 'Sin actividad');

// ── Perfil individual del estudiante (solo datos registrados) ────────────────
function StudentProfile({ student, onBack, onResolve, busyId }: {
  student: Student; onBack: () => void; onResolve: (a: Alert) => void; busyId: string | null;
}) {
  const risk = RISK_CONFIG[student.risk];
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-[#787774] hover:text-[#37352F] transition-colors">← NeuroAlertas</button>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center font-bold text-xl flex-shrink-0">
          {student.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-[#191919]">{student.name}</h2>
          <p className="text-sm text-[#787774] truncate">{student.groups.join(' · ')}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-2xl font-bold text-[#191919]">{student.avg ?? '—'}<span className="text-sm font-normal text-[#787774]">/10</span></span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>{risk.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Sesiones registradas', value: String(student.sessions), icon: Hash },
          { label:'Tiempo total de estudio', value: `${student.minutes} min`, icon: Clock },
          { label:'Última actividad', value: fmtDate(student.lastActivity), icon: Activity },
        ].map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="bg-white border border-[#E9E9E7] rounded-lg p-4">
              <Icon className="w-4 h-4 text-[#787774] mb-2" />
              <p className="text-base font-bold text-[#191919]">{m.value}</p>
              <p className="text-xs text-[#787774]">{m.label}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
        <h3 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-[#E03E3E]" /> Situaciones detectadas
        </h3>
        <ul className="divide-y divide-[#F7F6F3]">
          {student.alerts.map(a => (
            <li key={a.id} className={`py-2.5 flex items-center gap-3 ${a.resolved ? 'opacity-50' : ''}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_CONFIG[a.priority].dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#191919]">{a.title}</p>
                <p className="text-[11px] text-[#AEADAB]">{CATEGORY[a.type]} · {a.classroomName}</p>
              </div>
              <button onClick={() => onResolve(a)} disabled={busyId === a.id}
                className="text-xs text-[#787774] hover:text-[#37352F] disabled:opacity-50 flex items-center gap-1">
                {busyId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                {a.resolved ? 'Reabrir' : 'Resolver'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
        <h3 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[#2E6FDB]" /> Factores de riesgo calculados
        </h3>
        {student.riskFactors.length === 0
          ? <p className="text-xs text-[#AEADAB]">El motor neuroconductual no registró factores para este estudiante.</p>
          : <div className="flex flex-wrap gap-1.5">{student.riskFactors.map(f => (
              <span key={f} className="px-2 py-0.5 bg-red-50 text-[#E03E3E] rounded text-[11px] font-medium">{f}</span>
            ))}</div>}
        <p className="text-[11px] text-[#AEADAB] mt-3">
          Son señales orientativas para acompañar al estudiante, no un diagnóstico.
        </p>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function NeuroAlertasTab() {
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [filterPrio,  setFilterPrio]  = useState<Priority | 'todas'>('todas');
  const [showResolved, setShowResolved] = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [busyId,      setBusyId]      = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  // Clases cuyas alertas no se pudieron cargar (no se muestran como "sin alertas")
  const [failedClasses, setFailedClasses] = useState<string[]>([]);
  const [loadError,   setLoadError]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const r = await api.get('/classrooms/my-classes');
      const classrooms: any[] = r.data.classrooms ?? [];
      const failed: string[] = [];
      const results = await Promise.all(classrooms.map(c =>
        api.get(`/classrooms/${c.id}/alerts`, { params: { _t: Date.now() } })
          .then(res => ({ c, list: res.data.alerts ?? [] }))
          .catch(() => { failed.push(c.name ?? `Clase ${c.id}`); return { c, list: [] }; })));

      const alertsList: Alert[] = [];
      const byStudent = new Map<string, Student>();
      for (const { c, list } of results) {
        for (const a of list) {
          const alert: Alert = {
            id:            `${c.id}:${a.id}`,
            classroomId:   c.id,
            classroomName: c.name,
            type:          a.type,
            priority:      a.severity === 'high' ? 'alta' : a.severity === 'medium' ? 'media' : 'baja',
            title:         a.message,
            studentId:     String(a.student_id),
            affected:      a.student,
            resolved:      !!a.resolved,
          };
          alertsList.push(alert);
          const key = String(a.student_id);
          const prev = byStudent.get(key);
          const s: Student = prev ?? {
            id: key, name: a.student, groups: [], avg: null, risk: 'medium',
            sessions: 0, minutes: 0, lastActivity: null, riskFactors: [], alerts: [],
          };
          if (!s.groups.includes(c.name)) {
            s.groups.push(c.name);
            s.sessions += a.total_sessions ?? 0;
            s.minutes  += a.total_time_minutes ?? 0;
          }
          if (a.average_score != null) {
            // Promedio del grupo con la nota más baja (el que origina la alerta).
            const avg10 = Math.round(a.average_score) / 10;
            s.avg = s.avg == null ? avg10 : Math.min(s.avg, avg10);
          }
          if (a.severity === 'high') s.risk = 'high';
          if (a.last_activity && (!s.lastActivity || a.last_activity > s.lastActivity)) s.lastActivity = a.last_activity;
          for (const f of a.risk_factors ?? []) if (!s.riskFactors.includes(f)) s.riskFactors.push(f);
          s.alerts.push(alert);
          byStudent.set(key, s);
        }
      }
      setAlerts(alertsList);
      setStudents(Array.from(byStudent.values()).sort((a, b) =>
        (a.risk === b.risk ? 0 : a.risk === 'high' ? -1 : 1) || a.name.localeCompare(b.name)));
      setFailedClasses(failed);
    } catch {
      setAlerts([]); setStudents([]); setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleResolved = async (alert: Alert) => {
    const resolved = !alert.resolved;
    const backendId = alert.id.slice(alert.id.indexOf(':') + 1);
    setBusyId(alert.id);
    setActionError('');
    try {
      await api.post(`/classrooms/${alert.classroomId}/alerts/${encodeURIComponent(backendId)}/resolve`, null, { params: { resolved } });
      const mark = (a: Alert) => (a.id === alert.id ? { ...a, resolved } : a);
      setAlerts(prev => prev.map(mark));
      setStudents(prev => prev.map(s => ({ ...s, alerts: s.alerts.map(mark) })));
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setActionError(typeof detail === 'string' ? detail : 'No fue posible actualizar la alerta.');
      if (err?.response?.status === 404) load();
    } finally {
      setBusyId(null);
    }
  };

  const filtered = alerts.filter(a => (filterPrio === 'todas' || a.priority === filterPrio) && (showResolved || !a.resolved));
  const unresolved = alerts.filter(a => !a.resolved).length;
  const resolvedCount = alerts.length - unresolved;
  const studentsWithAlerts = new Set(alerts.filter(a => !a.resolved).map(a => a.studentId)).size;
  // Promedio solo sobre estudiantes con calificación registrada.
  const withAvg = students.filter((s): s is Student & { avg: number } => s.avg != null);
  const avgScore = withAvg.length
    ? (withAvg.reduce((sum, s) => sum + s.avg, 0) / withAvg.length).toFixed(1)
    : '—';
  const withTime = students.filter(s => s.sessions > 0);
  const avgStudy = withTime.length
    ? `${Math.round(withTime.reduce((a, s) => a + s.minutes, 0) / withTime.length)} min`
    : '—';

  const selected = students.find(s => s.id === selectedId) ?? null;
  if (selected) {
    return <StudentProfile student={selected} onBack={() => setSelectedId(null)} onResolve={toggleResolved} busyId={busyId} />;
  }

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-sm text-[#787774]">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando alertas…
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-[#F4BDBD] bg-[#FDEEEE] px-4 py-3 text-sm text-[#E03E3E] flex items-center justify-between gap-3">
          <span>No fue posible obtener las alertas.</span>
          <button onClick={load} className="font-medium hover:underline">Reintentar</button>
        </div>
      )}
      {actionError && (
        <div className="rounded-md border border-[#F4BDBD] bg-[#FDEEEE] px-4 py-3 text-sm text-[#E03E3E]">{actionError}</div>
      )}
      {!loadError && failedClasses.length > 0 && (
        <div className="rounded-md border border-[#EDD88A] bg-[#FCF6E5] px-4 py-3 text-sm text-[#9F6B00]">
          No se pudieron cargar las alertas de: {failedClasses.join(', ')}. Los indicadores no incluyen esas clases.
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Estudiantes con alertas activas', value:String(studentsWithAlerts), color:'text-[#E03E3E]', bg:'bg-red-50' },
          { label:'Alertas activas', value:String(unresolved), color:'text-[#D9730D]', bg:'bg-orange-50' },
          { label:'Promedio de estos estudiantes', value:String(avgScore), color:'text-[#0F7B6C]', bg:'bg-emerald-50' },
          { label:'Tiempo prom. de estudio', value:avgStudy, color:'text-[#2E6FDB]', bg:'bg-[#EEF3FD]' },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-[#E9E9E7] rounded-lg p-4`}>
            <p className={`text-xl font-bold ${k.color}`}>{loadError ? '—' : k.value}</p>
            <p className="text-xs text-[#787774] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-[#191919] text-sm">Alertas Académicas</h3>
          <div className="flex items-center gap-3 flex-wrap">
            {resolvedCount > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-[#787774] cursor-pointer">
                <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} />
                Mostrar resueltas ({resolvedCount})
              </label>
            )}
            <div className="flex gap-1">
              {(['todas','alta','media'] as const).map(p => (
                <button key={p} onClick={() => setFilterPrio(p)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filterPrio===p ? 'bg-[#37352F] text-white' : 'bg-[#F7F6F3] text-[#787774] hover:bg-[#E9E9E7]'}`}>
                  {p}
                </button>
              ))}
            </div>
            <button onClick={load} title="Actualizar" className="text-[#787774] hover:text-[#37352F]"><RefreshCw className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        <div className="divide-y divide-[#F7F6F3]">
          {filtered.map(alert => {
            const pc = PRIORITY_CONFIG[alert.priority];
            return (
              <div key={alert.id} className={`px-5 py-4 flex items-start gap-4 ${alert.resolved ? 'opacity-50' : ''}`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${pc.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-bold uppercase ${pc.color}`}>{pc.label}</span>
                    <span className="text-[10px] text-[#AEADAB]">· {CATEGORY[alert.type] ?? alert.type} · {alert.classroomName}</span>
                  </div>
                  <p className="text-sm font-medium text-[#191919]">{alert.title}</p>
                  <p className="text-[11px] text-[#AEADAB] mt-1">Afecta: {alert.affected}</p>
                </div>
                <button onClick={() => toggleResolved(alert)} disabled={busyId === alert.id}
                  className="flex items-center gap-1 px-2.5 py-1 bg-[#F7F6F3] text-[#787774] border border-[#E9E9E7] rounded text-xs hover:bg-[#E9E9E7] flex-shrink-0 transition-colors disabled:opacity-50">
                  {busyId === alert.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                  {alert.resolved ? 'Reabrir' : 'Resolver'}
                </button>
              </div>
            );
          })}
          {filtered.length === 0 && !loading && (
            <p className="px-5 py-8 text-center text-xs text-[#787774]">
              {loadError ? 'Sin datos: no se pudieron consultar las alertas.' : 'No hay alertas activas en tus grupos.'}
            </p>
          )}
        </div>
      </div>

      {/* Analítica individual */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7]">
          <h3 className="font-semibold text-[#191919] text-sm">Estudiantes con alertas</h3>
          <p className="text-xs text-[#787774] mt-0.5">Selecciona un estudiante para ver sus datos registrados</p>
        </div>
        <div className="divide-y divide-[#F7F6F3]">
          {students.map(student => {
            const risk = RISK_CONFIG[student.risk];
            return (
              <button key={student.id} onClick={() => setSelectedId(student.id)}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-[#F7F6F3] transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#191919] truncate">{student.name}</p>
                  <p className="text-xs text-[#AEADAB] truncate">{student.groups.join(' · ')} · {student.alerts.length} {student.alerts.length === 1 ? 'alerta' : 'alertas'}</p>
                </div>
                <span className={`text-lg font-bold ${student.avg == null ? 'text-[#9B9A97]' : student.avg < 6 ? 'text-[#E03E3E]' : student.avg < 7.5 ? 'text-[#D9730D]' : 'text-[#0F7B6C]'}`}>{student.avg ?? '—'}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${risk.bg} ${risk.color} flex-shrink-0`}>{risk.label}</span>
                <ChevronRight className="w-4 h-4 text-[#AEADAB] flex-shrink-0" />
              </button>
            );
          })}
          {students.length === 0 && !loading && !loadError && (
            <p className="px-5 py-8 text-center text-xs text-[#787774]">Ningún estudiante de tus grupos tiene alertas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
