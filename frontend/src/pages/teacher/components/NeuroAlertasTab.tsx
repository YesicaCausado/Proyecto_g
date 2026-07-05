import { useState, useEffect } from 'react';
import {
  AlertTriangle, Brain, TrendingDown, Clock,
  ChevronRight, CheckCircle, Target, BookOpen, Zap, Loader2,
} from 'lucide-react';
import api from '../../../services/api';

type Priority = 'alta' | 'media' | 'baja';

interface Alert {
  id: string;
  priority: Priority;
  category: string;
  title: string;
  detail: string;
  affected: string;
  date: string;
  resolved: boolean;
}

interface Student {
  id: string;
  name: string;
  group: string;
  avg: number;
  risk: 'high' | 'medium' | 'low';
  strengths: string[];
  weaknesses: string[];
  concepts_ok: string[];
  concepts_fail: string[];
  study_time: string;
  ai_usage: number;
  trend: number[];
}




const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; dot: string }> = {
  alta:  { label:'Alta',  color:'text-[#E03E3E]', bg:'bg-red-50   border-red-200',    dot:'bg-[#E03E3E]' },
  media: { label:'Media', color:'text-[#D9730D]', bg:'bg-orange-50 border-orange-200', dot:'bg-[#D9730D]' },
  baja:  { label:'Baja',  color:'text-[#0F7B6C]', bg:'bg-emerald-50 border-emerald-200', dot:'bg-[#0F7B6C]' },
};

const RISK_CONFIG: Record<Student['risk'], { label:string; color:string; bg:string }> = {
  high:   { label:'Alto riesgo',  color:'text-[#E03E3E]', bg:'bg-red-50'    },
  medium: { label:'Riesgo medio', color:'text-[#D9730D]', bg:'bg-orange-50' },
  low:    { label:'Sin riesgo',   color:'text-[#0F7B6C]', bg:'bg-emerald-50'},
};

// ── Perfil individual del estudiante ─────────────────────────────────────────
function StudentProfile({ student, onBack }: { student: Student; onBack: () => void }) {
  const risk = RISK_CONFIG[student.risk];
  const maxTrend = Math.max(...student.trend);
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-[#787774] hover:text-[#37352F] transition-colors">← NeuroAlertas</button>

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center font-bold text-xl flex-shrink-0">
          {student.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#191919]">{student.name}</h2>
          <p className="text-sm text-[#787774]">Grupo {student.group}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-2xl font-bold text-[#191919]">{student.avg}<span className="text-sm font-normal text-[#787774]">/10</span></span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${risk.bg} ${risk.color}`}>{risk.label}</span>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Tiempo de estudio', value:student.study_time, icon:Clock     },
          { label:'Uso de IA',          value:`${student.ai_usage}%`, icon:Brain },
          { label:'Tendencia',          value: student.trend[5] > student.trend[0] ? '📈 Positiva' : '📉 Negativa', icon:TrendingDown },
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

      {/* Gráfico evolución */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
        <h3 className="font-semibold text-[#191919] text-sm mb-4">Evolución del promedio (últimas 6 semanas)</h3>
        <div className="flex items-end gap-2 h-20">
          {student.trend.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-[#787774]">{v}</span>
              <div className="w-full rounded-t-sm"
                style={{ height:`${(v/maxTrend)*60}px`, background: v < 5 ? '#E03E3E' : v < 7 ? '#D9730D' : '#0F7B6C' }} />
              <span className="text-[9px] text-[#AEADAB]">S{i+1}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Fortalezas y debilidades */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#0F7B6C] text-sm mb-3 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Fortalezas
          </h3>
          {student.strengths.length === 0
            ? <p className="text-xs text-[#AEADAB]">Sin datos suficientes</p>
            : <ul className="space-y-1.5">{student.strengths.map(s => (
                <li key={s} className="text-xs text-[#37352F] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F7B6C] flex-shrink-0" />{s}
                </li>
              ))}</ul>}
        </div>
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#E03E3E] text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Debilidades
          </h3>
          {student.weaknesses.length === 0
            ? <p className="text-xs text-[#AEADAB]">¡Sin áreas críticas detectadas!</p>
            : <ul className="space-y-1.5">{student.weaknesses.map(w => (
                <li key={w} className="text-xs text-[#37352F] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#E03E3E] flex-shrink-0" />{w}
                </li>
              ))}</ul>}
        </div>
      </div>

      {/* Conceptos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#0F7B6C]" /> Conceptos dominados
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {student.concepts_ok.map(c => (
              <span key={c} className="px-2 py-0.5 bg-emerald-50 text-[#0F7B6C] rounded text-[11px] font-medium">{c}</span>
            ))}
            {student.concepts_ok.length === 0 && <p className="text-xs text-[#AEADAB]">Sin datos</p>}
          </div>
        </div>
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#191919] text-sm mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#E03E3E]" /> Conceptos pendientes
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {student.concepts_fail.map(c => (
              <span key={c} className="px-2 py-0.5 bg-red-50 text-[#E03E3E] rounded text-[11px] font-medium">{c}</span>
            ))}
            {student.concepts_fail.length === 0 && <p className="text-xs text-[#AEADAB]">¡Sin pendientes!</p>}
          </div>
        </div>
      </div>

      {/* NeuroInsight */}
      {student.risk !== 'low' && (
        <div className="bg-gradient-to-br from-[#EEF3FD] to-[#F0F7FF] border border-[#C5D9F7] rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-[#2E6FDB] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[#2E6FDB] mb-1">NeuroInsight generado por IA</p>
              <p className="text-xs text-[#37352F] leading-relaxed">
                "{student.name} presenta dificultades en <strong>{student.weaknesses[0] ?? 'áreas clave'}</strong>.
                Se recomienda reforzar con ejercicios prácticos y aumentar el uso del NeuroBot a diario.
                El tiempo de estudio actual ({student.study_time}) está por debajo del promedio recomendado."
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function NeuroAlertasTab() {
  const [alerts,      setAlerts]      = useState<Alert[]>([]);
  const [students,    setStudents]    = useState<Student[]>([]);
  const [selected,    setSelected]    = useState<Student | null>(null);
  const [filterPrio,  setFilterPrio]  = useState<Priority | 'todas'>('todas');
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    // Load alerts + derive at-risk students list from classroom alerts
    api.get('/classrooms/my-classes')
      .then(async r => {
        const classrooms: any[] = r.data.classrooms ?? [];
        const alertsList: Alert[] = [];
        const studentsMap = new Map<string, Student>();

        for (const c of classrooms) {
          const res = await api.get(`/classrooms/${c.id}/alerts`).catch(() => ({ data: { alerts: [] } }));
          for (const a of (res.data.alerts ?? [])) {
            alertsList.push({
              id:       String(a.id ?? `${c.id}-${a.student_id}`),
              priority: a.severity === 'high' ? 'alta' : a.severity === 'medium' ? 'media' : 'baja',
              category: a.category ?? 'Académico',
              title:    a.title ?? a.message ?? 'Alerta académica',
              detail:   a.detail ?? a.description ?? '',
              affected: a.student ?? a.student_name ?? 'Estudiante',
              date:     (a.created_at ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
              resolved: a.resolved ?? false,
            });
            const key = String(a.student_id);
            if (!studentsMap.has(key)) {
              studentsMap.set(key, {
                id:           key,
                name:         a.student ?? a.student_name ?? `Estudiante ${key}`,
                group:        c.grade ?? c.name ?? '',
                avg:          a.average_score != null ? Math.round(a.average_score * 10) / 10 : 0,
                risk:         a.severity === 'high' ? 'high' : a.severity === 'medium' ? 'medium' : 'low',
                strengths:    [],
                weaknesses:   [a.message ?? 'Bajo rendimiento'],
                concepts_ok:  [],
                concepts_fail:[],
                study_time:   '—',
                ai_usage:     0,
                trend:        [],
              });
            }
          }
        }

        setAlerts(alertsList);
        setStudents(Array.from(studentsMap.values()));
      })
      .catch(() => { setAlerts([]); setStudents([]); })
      .finally(() => setLoading(false));
  }, []);

  const resolve = (id: string) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, resolved: true } : a));

  const filtered = alerts.filter(a => filterPrio === 'todas' || a.priority === filterPrio);
  const unresolved = alerts.filter(a => !a.resolved).length;

  if (selected) return <StudentProfile student={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-6">
      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-sm text-[#787774]">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando alertas…
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label:'Estudiantes en riesgo', value:'2',   color:'text-[#E03E3E]', bg:'bg-red-50'     },
          { label:'Alertas activas',        value:String(unresolved), color:'text-[#D9730D]', bg:'bg-orange-50' },
          { label:'Promedio general',       value:'7.8', color:'text-[#0F7B6C]', bg:'bg-emerald-50' },
          { label:'Tiempo prom. estudio',   value:'35 min', color:'text-[#2E6FDB]', bg:'bg-[#EEF3FD]'  },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-[#E9E9E7] rounded-lg p-4`}>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-[#787774] mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-[#191919] text-sm">Alertas Académicas</h3>
          <div className="flex gap-1">
            {(['todas','alta','media','baja'] as const).map(p => (
              <button key={p} onClick={() => setFilterPrio(p)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${filterPrio===p ? 'bg-[#37352F] text-white' : 'bg-[#F7F6F3] text-[#787774] hover:bg-[#E9E9E7]'}`}>
                {p}
              </button>
            ))}
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
                    <span className="text-[10px] text-[#AEADAB]">· {alert.category} · {alert.date}</span>
                  </div>
                  <p className="text-sm font-medium text-[#191919]">{alert.title}</p>
                  <p className="text-xs text-[#787774] mt-0.5">{alert.detail}</p>
                  <p className="text-[11px] text-[#AEADAB] mt-1">Afecta: {alert.affected}</p>
                </div>
                {!alert.resolved && (
                  <button onClick={() => resolve(alert.id)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-[#F7F6F3] text-[#787774] border border-[#E9E9E7] rounded text-xs hover:bg-[#E9E9E7] flex-shrink-0 transition-colors">
                    <CheckCircle className="w-3 h-3" /> Resolver
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Analítica individual */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E9E9E7]">
          <h3 className="font-semibold text-[#191919] text-sm">Analítica Individual</h3>
          <p className="text-xs text-[#787774] mt-0.5">Selecciona un estudiante para ver su perfil completo</p>
        </div>
        <div className="divide-y divide-[#F7F6F3]">
          {students.map(student => {
            const risk = RISK_CONFIG[student.risk];
            return (
              <button key={student.id} onClick={() => setSelected(student)}
                className="w-full px-5 py-3 flex items-center gap-4 hover:bg-[#F7F6F3] transition-colors text-left">
                <div className="w-8 h-8 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {student.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#191919] truncate">{student.name}</p>
                  <p className="text-xs text-[#AEADAB]">Grupo {student.group} · {student.study_time}</p>
                </div>
                <span className={`text-lg font-bold ${student.avg < 6 ? 'text-[#E03E3E]' : student.avg < 7.5 ? 'text-[#D9730D]' : 'text-[#0F7B6C]'}`}>{student.avg}</span>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${risk.bg} ${risk.color} flex-shrink-0`}>{risk.label}</span>
                <ChevronRight className="w-4 h-4 text-[#AEADAB] flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
