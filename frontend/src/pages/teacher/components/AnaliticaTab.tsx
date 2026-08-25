import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  Users, TrendingUp, AlertTriangle, Brain,
  BarChart2, Award, Activity, Clock, Target, Sparkles,
  ArrowUpRight, ArrowDownRight, Bot, Layers, ShieldCheck, BookOpen,
  type LucideIcon,
} from 'lucide-react';
import api from '../../../services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface GroupPerf { name: string; avg: number; count: number; color: string; }
interface TopStudent { name: string; group: string; avg: number; trend: string | null; }
interface AiUsage { name: string; pct: number; color: string; }
interface TopicPerf { topic: string; avg: number; attempts: number; color: string; }
interface RiskDist { bajo: number; medio: number; alto: number; }
interface WeeklyActivity { label: string; count: number; pct: number; }

interface TeacherStats {
  total_groups: number;
  total_students: number;
  avg_global: number;
  active_bots: number;
  alert_count: number;
  score: number | null;
  has_data: boolean;
  risk_dist: RiskDist;
  groups_perf: GroupPerf[];
  top_students: TopStudent[];
  topics_perf: TopicPerf[];
  weekly_activity: WeeklyActivity[];
  ai_usage: AiUsage[];
  upcoming?: { type: string; label: string; date: string; color: string }[];
}

// Paleta del design system del proyecto (Notion)
const ACCENTS = {
  primary:   '#2E6FDB',  // azul principal
  primaryDark:'#255DC0', // hover azul
  violet:    '#6940A5',  // morado
  mint:      '#0F7B6C',  // verde
  amber:     '#D9730D',  // naranja
  rose:      '#E03E3E',  // rojo
  line:      '#E9E9E7',  // bordes
  track:     '#F7F6F3',  // fondo de barras
  textMain:  '#191919',  // texto principal
  textSub:   '#37352F',  // texto secundario
  textMuted: '#787774',  // texto tenue
  textDim:   '#AEADAB',  // texto muy tenue
  blueSoft:  '#EEF3FD',  // fondo azul suave
  blueBorder:'#C5D9F7',  // borde azul suave
};

// ── SVG: Gauge radial (índice de salud académica) ─────────────────────────────
function HealthGauge({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(1, (score || 0) / 100));
  if (!score) {
    return (
      <div className="relative w-40 h-40 mx-auto flex flex-col items-center justify-center">
        <ShieldCheck className="w-10 h-10 text-[#AEADAB]" />
        <p className="text-[11px] text-[#AEADAB] mt-2 text-center px-3">Sin evaluaciones reales todavía</p>
      </div>
    );
  }
  const r = 66, cx = 84, cy = 84, C = 2 * Math.PI * r;
  const dash = C * pct;
  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 168 168" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={ACCENTS.line} strokeWidth="12" />
        <motion.circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${dash} ${C - dash}` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
        <defs>
          <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ACCENTS.primary} />
            <stop offset="100%" stopColor={ACCENTS.violet} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-[#191919]">{Math.round(score)}</span>
        <span className="text-[10px] uppercase tracking-widest text-[#AEADAB]">/ 100</span>
      </div>
    </div>
  );
}

// ── SVG: Donut de riesgo (real desde Enrollment.risk_level) ──────────────────
function RiskDonut({ dist }: { dist: RiskDist }) {
  const low = dist.bajo, mid = dist.medio, high = dist.alto;
  const r = 54, cx = 70, cy = 70, C = 2 * Math.PI * r;
  const total = low + mid + high;
  const segs = [
    { val: low,  color: ACCENTS.mint },
    { val: mid,  color: ACCENTS.amber },
    { val: high, color: ACCENTS.rose },
  ].filter(s => s.val > 0);
  let acc = 0;
  const arcs = segs.map(s => {
    const frac = total > 0 ? s.val / total : 0;
    const off = acc * C;
    acc += frac;
    const dash = frac * C;
    return { ...s, off, dash };
  });
  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={ACCENTS.line} strokeWidth="16" />
        {arcs.map((a, i) => (
          <motion.circle
            key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${a.dash} ${C - a.dash}`}
            strokeDashoffset={-a.off}
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${a.dash} ${C - a.dash}` }}
            transition={{ delay: 0.3 + i * 0.15, duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold text-[#191919]">{high}</span>
        <span className="text-[9px] uppercase tracking-widest text-[#AEADAB]">en riesgo</span>
      </div>
    </div>
  );
}

// ── Barras de rendimiento por tema (análisis real) ───────────────────────────
function TopicsChart({ data }: { data: TopicPerf[] }) {
  const max = Math.max(1, ...data.map(d => d.avg)) * 10;
  return (
    <div className="w-full space-y-3">
      {data.map((t, i) => (
        <div key={t.topic}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[#37352F] truncate max-w-[60%]">{t.topic}</span>
            <span className="text-[11px] font-semibold text-[#191919]">
              {t.avg}/10 <span className="font-normal text-[#AEADAB]">· {t.attempts} intentos</span>
            </span>
          </div>
          <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg,#2E6FDB,#6940A5)' }}
              initial={{ width: 0 }}
              animate={{ width: `${(t.avg / max) * 100}%` }}
              transition={{ delay: 0.2 + i * 0.08, duration: 0.7 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Mapa de calor de la semana (actividad real) ───────────────────────────────
function HeatCells({ data }: { data: WeeklyActivity[] }) {
  return (
    <div className="grid grid-cols-6 gap-2">
      {data.map((d, i) => {
        const hot = d.pct >= 70;
        const mid = d.pct >= 40 && d.pct < 70;
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              className="w-full aspect-square rounded-lg transition-all flex items-center justify-center"
              style={{
                background: hot ? 'linear-gradient(135deg,#0F7B6C,#2E6FDB)' : mid ? 'linear-gradient(135deg,#2E6FDB,#6940A5)' : '#EEF3FD',
                boxShadow: hot || mid ? `0 0 12px ${mid ? 'rgba(46,111,219,0.35)' : 'rgba(15,123,108,0.35)'}` : 'none',
              }}
            >
              {d.count > 0 && (
                <span className="text-[10px] font-bold text-white">{d.count}</span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-[#37352F]">{d.count}</span>
            <span className="text-[9px] text-[#787774]">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── SVG: Tendencia semanal (valores reales) ──────────────────────────────────
function TrendArea({ data }: { data: WeeklyActivity[] }) {
  const W = 340, H = 120, pad = 6;
  const vals = data.map(d => d.count);
  const max = Math.max(...vals, 1) * 1.1;
  const step = (W - pad * 2) / (Math.max(1, data.length) - 1);
  const pts = data.map((d, i) => [
    pad + (i * step),
    H - pad - ((d.count - 0) / (max - 0)) * (H - pad * 2)
  ] as const);
  const line = pts.map(p => `${p[0]},${p[1]}`).join(' ');
  const path = pts.length > 1
    ? `M ${pts.map(p => `${p[0]} ${p[1]}`).join(' L ')} L ${pts[pts.length - 1][0]} ${H - pad} L ${pad} ${H - pad} Z`
    : `M ${pad} ${H - pad} L ${W - pad} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(46,111,219,0.3)" />
          <stop offset="100%" stopColor="rgba(46,111,219,0)" />
        </linearGradient>
      </defs>
      <motion.path
        d={path} fill="url(#trendGrad)"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}
      />
      <motion.polyline
        points={line} fill="none" stroke={ACCENTS.primary} strokeWidth="2.5" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }}
      />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r="3" fill={ACCENTS.primary} />
          <text x={p[0]} y={H - 2} textAnchor="middle" fill="#787774" fontSize="9">
            {data[i]?.label ?? ''}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Anillos de desempeño por grupo (solo real) ────────────────────────────────
function ringColor(avg: number): string {
  return avg >= 8 ? ACCENTS.mint : avg >= 6.5 ? ACCENTS.primary : avg >= 5 ? ACCENTS.amber : ACCENTS.rose;
}
function GroupRing({ name, avg }: { name: string; avg: number }) {
  const r = 26, cx = 34, cy = 34, C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, avg / 10));
  const color = ringColor(avg);
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg viewBox="0 0 68 68" className="w-full h-full -rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={ACCENTS.line} strokeWidth="6" />
          <motion.circle
            cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${pct * C} ${C}`}
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${pct * C} ${C}` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#191919]">
          {avg}
        </span>
      </div>
      <p className="text-[11px] text-[#787774] mt-2 text-center leading-tight max-w-[72px]">{name}</p>
    </div>
  );
}

// ── Panel reutilizable ────────────────────────────────────────────────────────
type CmdPanelProps = {
  title: string;
  icon: LucideIcon;
  accent: string;
  right?: ReactNode;
  children: ReactNode;
  center?: boolean;
};
function CmdPanel({ title, icon: Icon, accent, right, children, center }: CmdPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="bg-white border border-[#E9E9E7] rounded-lg p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2"
          style={{ color: accent }}>
          <Icon className="w-4 h-4" style={{ color: accent }} /> {title}
        </h3>
        {right}
      </div>
      <div className={center ? 'flex flex-col items-center' : ''}>{children}</div>
    </motion.div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function AnaliticaTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [stats, setStats] = useState<TeacherStats | null>(null);

  useEffect(() => {
    api.get('/teacher/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const loading = !stats;
  const hasData = stats?.has_data ?? false;
  const avg = stats?.avg_global ?? 0;
  const score = stats?.score ?? null;
  const risk = stats?.risk_dist ?? { bajo: 0, medio: 0, alto: 0 };
  const heat = stats?.weekly_activity ?? [];
  const topics = stats?.topics_perf ?? [];
  const groups = stats?.groups_perf ?? [];
  const top = stats?.top_students ?? [];
  const highRisk = risk.alto;

  const modelCards = [
    { icon: Brain, label: 'NeuroBots activos', value: stats?.active_bots != null ? String(stats.active_bots) : '—', accent: ACCENTS.violet },
    { icon: Users, label: 'Estudiantes rastreados', value: stats?.total_students != null ? String(stats.total_students) : '—', accent: ACCENTS.primary },
    { icon: Layers, label: 'Grupos analizados', value: stats?.total_groups != null ? String(stats.total_groups) : '—', accent: ACCENTS.mint },
  ];

  const emptyState = (msg = 'Sin datos suficientes.') => (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <BookOpen className="w-6 h-6 text-[#AEADAB] mb-2" />
      <p className="text-xs text-[#AEADAB]">{msg}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ══ Cabecera ══ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between flex-wrap gap-3"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#EEF3FD] flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-[#2E6FDB]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#191919]">Centro de Analítica <span className="text-[#2E6FDB]">Académica</span></h2>
            <p className="text-sm text-[#787774]">Panel de rendimiento, participación y riesgo con datos reales</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium bg-[#EEF3FD] border border-[#C5D9F7] rounded-lg px-3 py-2 text-[#2E6FDB]">
          <Sparkles className="w-4 h-4" />
          Plan Pro · Analítica avanzada
        </div>
      </motion.div>

      {/* ══ Hero: gauge de salud + modelos ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 bg-white border border-[#E9E9E7] rounded-lg p-6 flex flex-col items-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-[#0F7B6C]" />
            <span className="text-xs font-semibold uppercase tracking-widest text-[#787774]">
              Índice de Salud Académica
            </span>
          </div>
          <HealthGauge score={score ?? 0} />
          <div className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-[#191919]">
            {avg >= 7 ? <ArrowUpRight className="w-4 h-4 text-[#0F7B6C]" /> : <ArrowDownRight className="w-4 h-4 text-[#E03E3E]" />}
            Promedio global <span className="text-[#0F7B6C]">{avg}/10</span>
          </div>
          <p className="text-[11px] text-[#787774] mt-1 text-center">promedio real del historial de evaluaciones de tus estudiantes</p>
        </motion.div>

        {/* Modelos */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {modelCards.map((m, i) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="bg-white border border-[#E9E9E7] rounded-lg p-5 flex flex-col justify-between hover:border-[#2E6FDB]/60 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center"
                    style={{ background: `${m.accent}15`, color: m.accent }}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <span className={`w-2 h-2 rounded-full ${loading ? 'bg-[#E9E9E7] animate-pulse' : hasData ? 'bg-[#0F7B6C]' : 'bg-[#E9E9E7]'}`} />
                </div>
                <div>
                  <p className="text-3xl font-extrabold text-[#191919]">{m.value}</p>
                  <p className="text-xs text-[#787774] mt-0.5">{m.label}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ══ Fila: Rendimiento por tema + Participación semanal ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CmdPanel title="Rendimiento por tema" icon={BarChart2} accent={ACCENTS.primary}
          right={<span className="text-[11px] text-[#787774]">promedio real por tema</span>}>
          {topics.length > 0 ? <TopicsChart data={topics} /> : emptyState('Aún no hay evaluaciones por tema registradas.')}
        </CmdPanel>
        <CmdPanel title="Participación semanal" icon={Activity} accent={ACCENTS.primary}
          right={<span className="text-[11px] text-[#787774]">últimos 6 días</span>}>
          {heat.length > 0 ? (
            <>
              <HeatCells data={heat} />
              <div className="mt-4">
                <TrendArea data={heat} />
              </div>
            </>
          ) : emptyState('Sin actividad de aprendizaje en los últimos días.')}
        </CmdPanel>
      </div>

      {/* ══ Fila: Riesgo + Desempeño por grupo ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <CmdPanel title="Distribución de riesgo" icon={AlertTriangle} accent={ACCENTS.rose} center>
          <RiskDonut dist={risk} />
          {risk.bajo + risk.medio + risk.alto === 0 && (
            <p className="text-[11px] text-[#AEADAB] text-center mt-1">Sin niveles de riesgo registrados aún.</p>
          )}
          <div className="w-full grid grid-cols-3 gap-2 mt-4">
            {[
              { label: 'Bajo', v: risk.bajo, c: ACCENTS.mint },
              { label: 'Medio', v: risk.medio, c: ACCENTS.amber },
              { label: 'Alto', v: risk.alto, c: ACCENTS.rose },
            ].map(r => (
              <div key={r.label} className="text-center">
                <p className="text-lg font-bold text-[#191919]">{r.v}</p>
                <span className="inline-flex items-center gap-1 text-[10px] text-[#787774]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.c }} /> {r.label}
                </span>
              </div>
            ))}
          </div>
          {highRisk > 0 && (
            <button
              onClick={() => onNavigate?.('alertas')}
              className="mt-4 w-full flex items-center justify-center gap-1 text-xs font-medium py-2 rounded-lg border border-red-200 text-[#E03E3E] hover:bg-red-50 transition-colors"
            >
              Atender {highRisk} alertas activas <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </CmdPanel>

        <CmdPanel
          title="Rendimiento por grupo"
          icon={Target}
          accent={ACCENTS.violet}
          right={<span className="text-[11px] text-[#787774]">solo grupos con datos</span>}
          center
        >
          {groups.length > 0 ? (
            <div className="flex flex-wrap items-start justify-center gap-5">
              {groups.map(g => (
                <GroupRing key={g.name} name={g.name} avg={g.avg} />
              ))}
            </div>
          ) : (
            emptyState('Los grupos aún no tienen evaluaciones.')
          )}
          <p className="text-[11px] text-[#787774] mt-4 text-center">promedio real por grupo · solo los que registran actividad</p>
        </CmdPanel>

        {/* Top estudiantes */}
        <CmdPanel title="Tendencia de estudiantes" icon={Award} accent={ACCENTS.amber}
          right={<button onClick={() => onNavigate?.('alertas')} className="text-[11px] text-[#2E6FDB] hover:underline">detalle</button>}>
          <div className="space-y-2.5">
            {top.map((s, i) => {
              const trendClass = s.trend == null ? 'text-[#AEADAB]'
                : (s.trend.startsWith('-') ? 'text-[#E03E3E]' : 'text-[#0F7B6C]');
              return (
                <div key={s.name} className="flex items-center gap-3">
                  <span className="text-[11px] font-black text-[#AEADAB] w-5">{i + 1}</span>
                  <div className="w-8 h-8 rounded-full bg-[#EEF3FD] flex items-center justify-center text-xs font-bold text-[#2E6FDB] flex-shrink-0">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-[#37352F] truncate">{s.name}</p>
                    <p className="text-[10px] text-[#AEADAB]">Grupo {s.group}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#191919]">{s.avg}</p>
                    <span className={`text-[10px] font-semibold ${trendClass}`}>
                      {s.trend ?? '—'}
                    </span>
                  </div>
                </div>
              );
            })}
            {top.length === 0 && (
              emptyState('Sin datos suficientes aún.')
            )}
          </div>
        </CmdPanel>
      </div>

      {/* ══ Fila inferior: NeuroBots + nota metodológica ══ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CmdPanel title="Uso de NeuroBots por grupo" icon={Bot} accent={ACCENTS.violet}
          right={<TrendingUp className="w-4 h-4 text-[#0F7B6C]" />}
          center>
          <div className="w-full space-y-3">
            {stats?.ai_usage && stats.ai_usage.length > 0 ? (
              stats.ai_usage.map(a => (
                <div key={a.name} className="w-full">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#787774] truncate">{a.name}</span>
                    <span className="text-[#191919] font-semibold">{a.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#F7F6F3] rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg,#2E6FDB,#6940A5)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${a.pct}%` }}
                      transition={{ delay: 0.3, duration: 0.9 }}
                    />
                  </div>
                </div>
              ))
            ) : (
              emptyState('Sin bots creados o sin uso registrado.')
            )}
          </div>
        </CmdPanel>

        <div className="md:col-span-2 flex flex-col justify-between gap-4 bg-gradient-to-br from-[#EEF3FD] to-[#F0F7FF] border border-[#C5D9F7] rounded-lg p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-md bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#2E6FDB]">NeuroInsight del día</p>
              <p className="text-xs text-[#37352F] leading-relaxed mt-1">
                {hasData && highRisk > 0
                  ? `Hay ${highRisk} estudiantes en alto riesgo. Prioriza sesiones de refuerzo en los temas con menor rendimiento y revisa la evolución de tus grupos más afectados.`
                  : hasData
                    ? 'La salud académica de tus grupos es estable. Sigue consolidando práctica diaria para ampliar el rendimiento y refinar la predicción.'
                    : 'Aún no hay suficientes datos de aprendizaje registrados para generar un análisis completo.'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 text-[11px] text-[#787774] border-t border-[#C5D9F7] pt-3">
            <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Todas las métricas se calculan en el backend con el servicio {''}
              <span className="font-mono text-[#2E6FDB]">/teacher/stats</span> a partir de registros reales de
              clases, inscripciones, evaluaciones (QuizHistory), sesiones de aprendizaje y niveles de riesgo
              (Enrollment.risk_level). Si no hay datos, se muestra "sin datos" en vez de inventar valores.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}