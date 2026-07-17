import { useEffect, useState } from 'react';
import {
  Users, GraduationCap, BookOpen, Bot, TrendingUp, TrendingDown,
  ShieldCheck, ExternalLink, AlertTriangle, BarChart2, LineChart,
  PieChart, Trophy, Activity
} from 'lucide-react';
import api from '../../../services/api';

interface DashStats {
  total_teachers: number;
  total_students: number;
  total_groups: number;
  avg_score: number;
  at_risk_count: number;
  teacher_ranking: { name: string; subject: string; avg: number; participation: number; students: number }[];
  at_risk_detail: { name: string; grade: string; avg: number; subject: string; risk: string }[];
  areas_data: { label: string; pct: number }[];
}

const AREA_COLORS = ['#0B6E99','#0F7B6C','#6940A5','#D9730D','#E03E3E','#AEADAB','#2E6FDB','#37352F'];

export default function DashboardGeneral({ license, onNavigate }: { license: any; onNavigate?: (tab: string) => void }) {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [institution, setInstitution] = useState<{ name: string } | null>(null);

  useEffect(() => {
    api.get('/super/stats/dashboard').then(r => setStats(r.data)).catch(() => {});
    api.get('/super/institution').then(r => setInstitution(r.data)).catch(() => {});
  }, []);

  // Días reales desde el backend (license viene de /super/license-usage)
  const institutionName = institution?.name ?? license?.institution_name ?? '—';;

  const metrics = [
    { label: 'Profesores activos', value: stats?.total_teachers ?? license?.current_teachers ?? '—', trend: '',   status: 'good',    icon: Users,          tab: 'profesores' },
    { label: 'Estudiantes',        value: stats?.total_students ?? license?.current_students ?? '—', trend: '',   status: 'good',    icon: GraduationCap,  tab: 'estudiantes' },
    { label: 'Grupos',             value: stats?.total_groups ?? '—',                                trend: '',   status: 'neutral', icon: BookOpen,       tab: 'grupos' },
    { label: 'NeuroBots',          value: '—',                                                       trend: '',   status: 'good',    icon: Bot,            tab: 'neurobots' },
    { label: 'Promedio general',   value: stats ? `${stats.avg_score}/10` : '—',                     trend: '',   status: stats && stats.avg_score >= 7 ? 'good' : 'warning', icon: TrendingUp, tab: null },
    { label: 'En riesgo',          value: stats?.at_risk_count ?? '—',                               trend: '',   status: 'danger',  icon: AlertTriangle,  tab: 'alertas' },
  ];

  const daysLeft   = license?.days_left ?? null;
  const isExpiring = daysLeft !== null && daysLeft <= 30 && daysLeft > 0;

  return (
    <div className="space-y-6">

      {/* Banner DEMO — visible cuando license es null (backend offline) */}
      {!license && (
        <div className="bg-[#FCF6E5] border border-[#EDD88A] rounded-md px-4 py-2.5 flex items-center gap-2 text-xs text-[#D9730D] font-medium">
          <span className="bg-[#D9730D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">DEMO</span>
          El backend no está disponible. Los datos mostrados son de ejemplo. Inicia el servidor para ver datos reales.
        </div>
      )}

      {/* ── Alerta de licencia ── */}
      {isExpiring && (
        <div className="bg-[#FCF6E5] border border-[#EDD88A] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-[#D9730D] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-[#D9730D] text-sm">Tu licencia vence en {daysLeft} días</p>
            <p className="text-xs text-[#D9730D]/80 mt-0.5">Renueva pronto para evitar interrupciones del servicio.</p>
          </div>
          <button
            onClick={() => onNavigate?.('licencia')}
            className="text-xs font-semibold text-[#D9730D] hover:text-[#B85C00] flex items-center gap-1 flex-shrink-0"
          >
            Gestionar <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* ── Licencia Card ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden flex flex-col md:flex-row">
        <div className="bg-gradient-to-br from-[#6940A5] to-[#5A358F] text-white p-6 md:w-56 flex-shrink-0 flex flex-col justify-between">
          <div>
            <ShieldCheck className="w-7 h-7 opacity-70 mb-3" />
            <h2 className="text-lg font-bold">Licencia {license?.license_type || 'Premium'}</h2>
            <div className="inline-flex items-center gap-1.5 mt-2 bg-white/20 px-2.5 py-1 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Activa
            </div>
          </div>
          <div className="mt-5">
            {daysLeft !== null ? (
              <>
                <p className="text-xs opacity-70 mb-0.5">Vence en</p>
                <p className="text-3xl font-bold">{daysLeft}</p>
                <p className="text-xs opacity-70">días</p>
              </>
            ) : (
              <>
                <p className="text-xs opacity-70 mb-0.5">Vigencia</p>
                <p className="text-lg font-bold">Sin límite</p>
              </>
            )}
          </div>
        </div>

        <div className="p-6 flex-1 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { label: 'Docentes', current: license?.current_teachers ?? 18, max: license?.max_teachers ?? 60, color: '#0B6E99' },
            { label: 'Estudiantes', current: license?.current_students ?? 745, max: license?.max_students ?? 1500, color: '#0F7B6C' },
          ].map(item => {
            const pct = Math.round((item.current / item.max) * 100);
            return (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-semibold text-[#191919]">{item.label}</span>
                  <span className="text-[#787774]">{item.current} de {item.max > 90000 ? 'Ilimitado' : item.max}</span>
                </div>
                <div className="h-2 bg-[#F7F6F3] rounded-full overflow-hidden border border-[#E9E9E7]">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                </div>
                <p className="text-[10px] text-[#AEADAB] mt-0.5 text-right">{pct}%</p>
              </div>
            );
          })}
          <div className="md:col-span-2 pt-4 border-t border-[#E9E9E7] flex justify-between items-center">
            <p className="text-xs text-[#787774]">Institución: <span className="font-semibold text-[#37352F]">{institutionName}</span></p>
            <button onClick={() => onNavigate?.('licencia')} className="text-xs font-medium text-[#6940A5] hover:underline flex items-center gap-1">
              Administrar Licencia <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => {
          const isNeg = m.trend.startsWith('-');
          const isNeutral = m.trend === '0';
          const Icon = m.icon;
          return (
            <button
              key={i}
              onClick={() => m.tab && onNavigate?.(m.tab)}
              className={`bg-white border border-[#E9E9E7] rounded-lg p-4 flex flex-col gap-2 text-left transition-all hover:shadow-sm ${m.tab ? 'cursor-pointer hover:border-[#AEADAB]' : 'cursor-default'}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-[#787774] font-medium leading-tight">{m.label}</p>
                <Icon className="w-3.5 h-3.5 text-[#AEADAB]" />
              </div>
              <p className="text-2xl font-bold text-[#191919]">{m.value}</p>
              <div className={`text-xs font-semibold flex items-center gap-1 ${
                m.status === 'good' ? 'text-[#0F7B6C]' :
                m.status === 'warning' ? 'text-[#D9730D]' :
                m.status === 'danger' ? 'text-[#E03E3E]' : 'text-[#787774]'
              }`}>
                {isNeutral ? <Activity className="w-3 h-3" /> : isNeg ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                {m.trend} este mes
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Gráficas + Ranking ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Rendimiento por grado */}
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-[#787774]" /> Rendimiento por grado
            </h3>
            <select className="text-xs border border-[#E9E9E7] rounded px-2 py-1 bg-white text-[#787774] outline-none">
              <option>Período 1</option><option>Período 2</option>
            </select>
          </div>
          <div className="flex items-end justify-between gap-2 h-40 px-1">
            {[
              { g: '6°', h: 72 }, { g: '7°', h: 78 }, { g: '8°', h: 65 },
              { g: '9°', h: 81 }, { g: '10°', h: 84 }, { g: '11°', h: 79 },
            ].map(({ g, h }) => (
              <div key={g} className="flex flex-col items-center gap-1 flex-1 group">
                <span className="text-[10px] text-[#787774] font-semibold opacity-0 group-hover:opacity-100 transition-opacity">{(h / 10).toFixed(1)}</span>
                <div className="w-full relative" style={{ height: `${h}%` }}>
                  <div className="absolute bottom-0 w-full bg-[#E5F3FF] rounded-t-md group-hover:bg-[#0B6E99] transition-colors" style={{ height: '100%' }} />
                  <div className="absolute bottom-0 w-full bg-[#0B6E99] rounded-t-md opacity-70 group-hover:opacity-100 transition-opacity" style={{ height: `${h - 10}%` }} />
                </div>
                <span className="text-xs font-medium text-[#787774]">{g}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tendencia institucional */}
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2">
              <LineChart className="w-4 h-4 text-[#787774]" /> Tendencia institucional
            </h3>
          </div>
          <div className="h-36 border-b border-l border-[#E9E9E7] relative ml-4">
            <svg viewBox="0 0 200 100" className="w-full h-full" preserveAspectRatio="none">
              {/* Promedio */}
              <polyline points="0,60 33,50 66,55 100,30 133,35 167,20 200,25"
                fill="none" stroke="#0F7B6C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              {/* Participación */}
              <polyline points="0,75 33,68 66,72 100,55 133,50 167,45 200,40"
                fill="none" stroke="#0B6E99" strokeWidth="1.5" strokeDasharray="4 2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-[#787774]">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#0F7B6C] inline-block rounded" /> Promedio</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-[#0B6E99] inline-block rounded border-dashed" style={{ borderBottom: '1px dashed #0B6E99' }} /> Participación</span>
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-[#AEADAB] px-1">
            {['Ene','Feb','Mar','Abr','May','Jun','Jul'].map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
      </div>

      {/* ── Ranking profesores + Distribución áreas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Ranking profesores */}
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5 lg:col-span-2">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2 mb-4">
            <Trophy className="w-4 h-4 text-[#D9730D]" /> Ranking de Profesores
          </h3>
          <div className="space-y-2">
            {(stats?.teacher_ranking ?? []).map((t, idx) => (
              <div key={t.name} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-[#F7F6F3] transition-colors">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-600' :
                  idx === 1 ? 'bg-slate-100 text-slate-500' :
                  idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-[#F7F6F3] text-[#787774]'
                }`}>{idx + 1}</span>
                <div className="w-7 h-7 rounded-full bg-[#6940A5]/10 flex items-center justify-center text-xs font-bold text-[#6940A5] flex-shrink-0">
                  {t.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#191919] truncate">{t.name}</p>
                  <p className="text-xs text-[#787774]">{t.subject} · {t.students} estudiantes</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-bold ${t.avg >= 8 ? 'text-[#0F7B6C]' : t.avg >= 7 ? 'text-[#D9730D]' : 'text-[#E03E3E]'}`}>{t.avg}</p>
                  <p className="text-[10px] text-[#787774]">{t.participation}% partic.</p>
                </div>
              </div>
            ))}
            {!stats && <p className="text-xs text-[#AEADAB] text-center py-4">Cargando datos reales…</p>}
          </div>
        </div>

        {/* Distribución por áreas */}
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-[#787774]" /> Distribución por Áreas
          </h3>
          <div className="space-y-2.5">
            {(stats?.areas_data ?? []).map((area, i) => (
              <div key={area.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#37352F] font-medium">{area.label}</span>
                  <span className="text-[#787774]">{area.pct}%</span>
                </div>
                <div className="h-2 bg-[#F7F6F3] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${area.pct}%`, backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }} />
                </div>
              </div>
            ))}
            {!stats && <p className="text-xs text-[#AEADAB] text-center py-4">Cargando…</p>}
          </div>
        </div>
      </div>

      {/* ── Estudiantes en Riesgo ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#E03E3E]" /> Estudiantes en Riesgo
            <span className="ml-1 px-2 py-0.5 bg-[#FDEEEE] text-[#E03E3E] text-xs rounded-full font-bold">{stats?.at_risk_count ?? '—'}</span>
          </h3>
          <button onClick={() => onNavigate?.('alertas')} className="text-xs text-[#787774] hover:text-[#37352F] transition-colors flex items-center gap-1">
            Ver NeuroAlertas <ExternalLink className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(stats?.at_risk_detail ?? []).map(s => (
            <div key={s.name} className="border border-[#F4BDBD] bg-[#FDEEEE]/40 rounded-md p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-6 h-6 bg-[#FDEEEE] rounded-full flex items-center justify-center text-xs font-bold text-[#E03E3E]">
                  {s.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#37352F] truncate">{s.name}</p>
                  <p className="text-[10px] text-[#787774]">{s.grade} · {s.subject}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-[#E03E3E]">{s.avg}</span>
                <span className="text-xs text-[#E03E3E] flex items-center gap-0.5 font-semibold">
                  <TrendingDown className="w-3 h-3" /> riesgo
                </span>
              </div>
            </div>
          ))}
          {!stats && <p className="text-xs text-[#AEADAB] col-span-4 text-center py-4">Cargando datos reales…</p>}
        </div>
      </div>

    </div>
  );
}

