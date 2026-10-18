import { useEffect, useState } from 'react';
import {
  Users, GraduationCap, BookOpen, TrendingDown,
  ShieldCheck, ExternalLink, AlertTriangle, BarChart2,
  PieChart, Trophy, Activity, RefreshCw, type LucideIcon
} from 'lucide-react';
import api from '../../../services/api';
import NeuronAvatar from '../../../components/NeuronAvatar';

interface DashStats {
  total_teachers: number;
  total_students: number;
  total_groups: number;
  at_risk_count: number;
  teacher_ranking: { name: string; subject: string; avg: number; participation: number; students: number }[];
  at_risk_detail: { name: string; grade: string; avg: number; subject: string; risk: string }[];
  areas_data: { label: string; pct: number }[];
}

const AREA_COLORS = ['#0B6E99','#0F7B6C','#6940A5','#D9730D','#E03E3E','#2E6FDB','#AEADAB','#37352F'];

function StatCard({
  label, value, icon: Icon, status, onClick,
}: {
  label: string; value: string; icon: LucideIcon;
  status: 'good' | 'neutral' | 'danger'; onClick?: () => void;
}) {
  const accent =
    status === 'danger' ? 'text-[#E03E3E]' :
    status === 'good'   ? 'text-[#0F7B6C]' :
    'text-[#191919]';

  return (
    <button
      onClick={onClick}
      className={`bg-white border border-[#E9E9E7] rounded-xl p-4 flex flex-col gap-3 text-left
        transition-all hover:shadow-md hover:border-[#C8C7C5] active:scale-[.98]
        ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-[#787774] font-semibold uppercase tracking-wide leading-tight">{label}</p>
        <span className={`p-1.5 rounded-lg ${
          status === 'danger' ? 'bg-[#FDEEEE]' :
          status === 'good'   ? 'bg-[#EEF8F6]' : 'bg-[#F7F6F3]'
        }`}>
          <Icon className={`w-3.5 h-3.5 ${
            status === 'danger' ? 'text-[#E03E3E]' :
            status === 'good'   ? 'text-[#0F7B6C]' : 'text-[#787774]'
          }`} />
        </span>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${accent}`}>{value}</p>
    </button>
  );
}

export default function DashboardGeneral({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [institution, setInstitution] = useState<{ name: string; dane_code?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboardData = async () => {
    setLoading(true);
    const [statsData, institutionData] = await Promise.all([
      api.get('/super/stats/dashboard').then(r => r.data).catch(() => null),
      api.get('/super/institution').then(r => r.data).catch(() => null),
    ]);
    setStats(statsData);
    setInstitution(institutionData);
    setLastUpdated(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadDashboardData();
    const onInstitutionUpdated = () => loadDashboardData();
    window.addEventListener('institution-config-updated', onInstitutionUpdated);
    return () => window.removeEventListener('institution-config-updated', onInstitutionUpdated);
  }, []);

  const institutionName = institution?.name ?? '—';
  const maxPct = stats?.areas_data?.length ? Math.max(...stats.areas_data.map(a => a.pct)) : 100;

  return (
    <div className="space-y-5">

      {/* ── Cabecera institución ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-xl px-5 py-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-[#6940A5]/10 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-[#6940A5]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-[#787774] font-semibold uppercase tracking-wide">Institución</p>
          <p className="text-base font-bold text-[#191919] truncate">{institutionName}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {institution?.dane_code && (
            <span className="text-xs text-[#787774] bg-[#F7F6F3] px-2.5 py-1 rounded-lg font-medium">
              DANE {institution.dane_code}
            </span>
          )}
          <button
            onClick={loadDashboardData}
            disabled={loading}
            title="Actualizar datos"
            className="p-1.5 rounded-lg hover:bg-[#F7F6F3] text-[#AEADAB] hover:text-[#787774] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Profesores activos" value={stats?.total_teachers != null ? String(stats.total_teachers) : '—'} status="good" icon={Users} onClick={() => onNavigate?.('profesores')} />
        <StatCard label="Estudiantes" value={stats?.total_students != null ? String(stats.total_students) : '—'} status="good" icon={GraduationCap} onClick={() => onNavigate?.('estudiantes')} />
        <StatCard label="Grupos" value={stats?.total_groups != null ? String(stats.total_groups) : '—'} status="neutral" icon={BookOpen} onClick={() => onNavigate?.('grupos')} />
        <StatCard label="En riesgo" value={stats?.at_risk_count != null ? String(stats.at_risk_count) : '—'} status="danger" icon={AlertTriangle} onClick={() => onNavigate?.('alertas')} />
      </div>

      {/* ── Rendimiento + Distribución ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Rendimiento por área */}
        <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2 mb-5">
            <BarChart2 className="w-4 h-4 text-[#0B6E99]" />
            Rendimiento por área
          </h3>
          {stats?.areas_data?.length ? (
            <div className="space-y-4">
              {stats.areas_data.map((area, i) => (
                <div key={area.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-[#37352F] font-medium">{area.label}</span>
                    <span className="font-semibold text-[#37352F]">{area.pct}%</span>
                  </div>
                  <div className="h-2 bg-[#F7F6F3] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(area.pct / maxPct) * 100}%`, backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <BarChart2 className="w-8 h-8 text-[#E9E9E7]" />
              <p className="text-xs text-[#AEADAB]">Aún no hay datos para graficar rendimiento.</p>
            </div>
          )}
        </div>

        {/* Distribución por áreas */}
        <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2 mb-5">
            <PieChart className="w-4 h-4 text-[#6940A5]" />
            Distribución por áreas
          </h3>
          {stats?.areas_data?.length ? (
            <div className="space-y-3">
              {stats.areas_data.map((area, i) => (
                <div key={area.label} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }}
                  />
                  <span className="text-xs text-[#37352F] font-medium flex-1 truncate">{area.label}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-20 h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${area.pct}%`, backgroundColor: AREA_COLORS[i % AREA_COLORS.length] }}
                      />
                    </div>
                    <span className="text-xs text-[#787774] w-8 text-right">{area.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
              <PieChart className="w-8 h-8 text-[#E9E9E7]" />
              <p className="text-xs text-[#AEADAB]">Sin datos de distribución aún.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Ranking profesores ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#D9730D]" />
            Ranking de Profesores
          </h3>
          {stats?.teacher_ranking?.length ? (
            <span className="text-xs text-[#787774] bg-[#F7F6F3] px-2 py-1 rounded-lg">
              {stats.teacher_ranking.length} docentes
            </span>
          ) : null}
        </div>

        {stats?.teacher_ranking?.length ? (
          <div className="divide-y divide-[#F7F6F3]">
            {stats.teacher_ranking.map((t, idx) => (
              <div key={t.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:bg-[#FAFAFA] -mx-2 px-2 rounded-lg transition-colors">
                <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  idx === 0 ? 'bg-yellow-100 text-yellow-600' :
                  idx === 1 ? 'bg-slate-100 text-slate-500' :
                  idx === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-[#F7F6F3] text-[#787774]'
                }`}>{idx + 1}</span>

                <div className="w-8 h-8 rounded-full bg-[#6940A5]/10 flex items-center justify-center text-xs font-bold text-[#6940A5] flex-shrink-0">
                  {t.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#191919] truncate">{t.name}</p>
                  <p className="text-xs text-[#787774]">{t.subject} · {t.students} estudiantes</p>
                </div>

                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-sm font-bold ${
                    t.avg >= 8 ? 'text-[#0F7B6C]' :
                    t.avg >= 6 ? 'text-[#D9730D]' : 'text-[#E03E3E]'
                  }`}>{t.avg}</span>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3 h-3 text-[#AEADAB]" />
                    <span className="text-[10px] text-[#787774]">{t.participation}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <Trophy className="w-8 h-8 text-[#E9E9E7]" />
            <p className="text-xs text-[#AEADAB]">
              {loading ? 'Cargando ranking…' : 'No hay datos de ranking disponibles aún.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Estudiantes en Riesgo ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#E03E3E]" />
            Estudiantes en Riesgo
            {stats?.at_risk_count != null && stats.at_risk_count > 0 && (
              <span className="px-2 py-0.5 bg-[#FDEEEE] text-[#E03E3E] text-xs rounded-full font-bold">
                {stats.at_risk_count}
              </span>
            )}
          </h3>
          <button
            onClick={() => onNavigate?.('alertas')}
            className="text-xs text-[#787774] hover:text-[#37352F] transition-colors flex items-center gap-1 font-medium"
          >
            Ver NeuroAlertas <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {stats?.at_risk_detail?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.at_risk_detail.map(s => (
              <div key={s.name} className="border border-[#F4BDBD] bg-[#FDEEEE]/30 rounded-xl p-3.5 hover:bg-[#FDEEEE]/50 transition-colors">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 bg-[#FDEEEE] rounded-full flex items-center justify-center text-xs font-bold text-[#E03E3E] flex-shrink-0">
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#37352F] truncate">{s.name}</p>
                    <p className="text-[10px] text-[#787774]">{s.grade} · {s.subject}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold text-[#E03E3E]">{s.avg}</span>
                  <span className="text-xs text-[#E03E3E] flex items-center gap-1 font-semibold bg-[#FDEEEE] px-2 py-0.5 rounded-full">
                    <TrendingDown className="w-3 h-3" /> riesgo
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-[#EEF8F6] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-[#0F7B6C]" />
            </div>
            <p className="text-sm font-semibold text-[#37352F]">
              {loading ? 'Cargando…' : '¡Sin alertas activas!'}
            </p>
            <p className="text-xs text-[#787774]">
              {loading ? '' : 'Todos los estudiantes están dentro del rango esperado.'}
            </p>
          </div>
        )}
      </div>

      {/* ── Banner motivacional ── */}
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ height: '120px', background: 'linear-gradient(135deg, #ede9ff 0%, #ddd5ff 50%, #c8baff 100%)' }}
      >
        <div
          className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
        />
        <div className="relative z-10 flex flex-col justify-center h-full pl-6 pr-32">
          <p className="text-sm font-bold text-[#2e1065] leading-tight mb-1">¡Neuron está listo!</p>
          <p className="text-xs text-[#6d28d9] leading-snug opacity-90">
            Tu institución avanza. Monitorea, decide, transforma 🚀
          </p>
          {lastUpdated && (
            <p className="text-[10px] text-[#7c3aed]/60 mt-2">
              Actualizado a las {lastUpdated.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <div className="absolute right-6 top-0 bottom-0 flex items-center justify-center pointer-events-none">
          <NeuronAvatar size={76} online variant="gradient" />
        </div>
      </div>

    </div>
  );
}