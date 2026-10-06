import { useEffect, useState } from 'react';
import {
  Users, GraduationCap, BookOpen, Bot, TrendingUp, TrendingDown,
  ShieldCheck, ExternalLink, AlertTriangle, BarChart2, LineChart,
  PieChart, Trophy
} from 'lucide-react';
import api from '../../../services/api';
import NeuronAvatar from '../../../components/NeuronAvatar';

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

export default function DashboardGeneral({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [institution, setInstitution] = useState<{ name: string; dane_code?: string } | null>(null);

  const loadDashboardData = async () => {
    const [statsData, institutionData] = await Promise.all([
      api.get('/super/stats/dashboard').then(r => r.data).catch(() => null),
      api.get('/super/institution').then(r => r.data).catch(() => null),
    ]);
    setStats(statsData);
    setInstitution(institutionData);
  };

  useEffect(() => {
    loadDashboardData();
    const onInstitutionUpdated = () => {
      loadDashboardData();
    };
    window.addEventListener('institution-config-updated', onInstitutionUpdated);

    return () => {
      window.removeEventListener('institution-config-updated', onInstitutionUpdated);
    };
  }, []);

  const institutionName = institution?.name ?? '—';

  const metrics = [
    { label: 'Profesores activos', value: stats?.total_teachers != null ? String(stats.total_teachers) : '—', status: 'good', icon: Users, tab: 'profesores' },
    { label: 'Estudiantes', value: stats?.total_students != null ? String(stats.total_students) : '—', status: 'good', icon: GraduationCap, tab: 'estudiantes' },
    { label: 'Grupos', value: stats?.total_groups != null ? String(stats.total_groups) : '—', status: 'neutral', icon: BookOpen, tab: 'grupos' },
    { label: 'NeuroBots', value: '—', status: 'neutral', icon: Bot, tab: 'neurobots' },
    { label: 'Promedio general', value: stats?.avg_score != null ? `${stats.avg_score}/10` : '—', status: stats && stats.avg_score >= 7 ? 'good' : 'neutral', icon: TrendingUp, tab: null },
    { label: 'En riesgo', value: stats?.at_risk_count != null ? String(stats.at_risk_count) : '—', status: 'danger', icon: AlertTriangle, tab: 'alertas' },
  ];

  return (
    <div className="space-y-6">

      {!stats && (
        <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md px-4 py-2.5 text-xs text-[#787774] font-medium">
          Cargando datos reales de la institución…
        </div>
      )}

      {/* ── Institución ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg px-5 py-4 flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-[#6940A5] flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs text-[#787774]">Institución</p>
          <p className="text-base font-bold text-[#191919] truncate">{institutionName}</p>
        </div>
        {institution?.dane_code && (
          <span className="ml-auto text-xs text-[#787774] flex-shrink-0">DANE {institution.dane_code}</span>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m, i) => {
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
            </button>
          );
        })}
      </div>

      {/* ── Gráficas + Ranking ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-[#787774]" /> Rendimiento por grado
          </h3>
          {stats && stats.areas_data?.length ? (
            <div className="space-y-3">
              {stats.areas_data.map((area, i) => (
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
            </div>
          ) : (
            <p className="text-xs text-[#AEADAB] py-8 text-center">Aún no hay datos suficientes para graficar rendimiento institucional.</p>
          )}
        </div>

        <div className="bg-white border border-[#E9E9E7] rounded-lg p-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2 mb-4">
            <LineChart className="w-4 h-4 text-[#787774]" /> Tendencia institucional
          </h3>
          {stats ? (
            <div className="space-y-3">
              <p className="text-sm text-[#37352F] font-medium">Promedio general: {stats.avg_score}/10</p>
              <p className="text-xs text-[#787774]">La tendencia se calcula con los registros reales de la institución disponibles en el backend.</p>
            </div>
          ) : (
            <p className="text-xs text-[#AEADAB] py-8 text-center">No hay información histórica disponible aún.</p>
          )}
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

      {/* Motivacional con Neuron */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ height: '130px', background: 'linear-gradient(135deg, #ede9ff 0%, #ddd5ff 50%, #c8baff 100%)' }}
      >
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />
        <div className="relative z-10 flex flex-col justify-center h-full pl-6 pr-32">
          <p className="text-[14px] font-bold text-[#2e1065] leading-tight mb-1">¡Neuron está listo!</p>
          <p className="text-[11px] text-[#6d28d9] leading-snug opacity-85">
            Tu institución avanza. Monitorea, decide, transforma 🚀
          </p>
        </div>
        <div className="absolute right-6 top-0 bottom-0 flex items-center justify-center pointer-events-none">
          <NeuronAvatar size={80} online variant="gradient" />
        </div>
      </div>

    </div>
  );
}

