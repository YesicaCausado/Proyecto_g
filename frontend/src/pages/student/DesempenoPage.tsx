import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp, TrendingDown, Target, Clock,
  Zap, Brain, BookOpen, MessageSquare, Users,
  BarChart3, Award, Flame, CheckCircle,
  AlertTriangle, Sparkles, Calculator, Activity,
  ChevronRight, Star, Trophy, Minus, Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'desempeno' | 'progreso' | 'analisis' | 'logros';

interface SubjectApiData {
  score: number; prev_score: number; trend: number;
  quizzes: number; avg_time_min: number;
  topics: string[]; strengths: string[]; weaknesses: string[];
}
interface WeekPoint  { day: string; score: number; hours: number; }
interface HistEntry  { materia: string; topic_key: string; fecha: string; score: number; total: number; tiempo: string; diff: string; }
interface Achievement { key: string; icon: string; title: string; desc: string; earned: boolean; pts: number; progress: number; }
interface Overview {
  avg_score: number; total_quizzes: number; total_xp: number;
  streak_days: number; total_hours: number; precision: number;
  weekly_avg: number; prev_weekly_avg: number; weekly_diff: number;
  total_correct: number; best_day: string; best_time: string;
  consistency_pct: number; avg_session_min: number;
}
interface CognitiveData { fatigue: number; overload: number; doubt: number; mastery: number; }
interface PerfData {
  subjects: Record<string, SubjectApiData>;
  weekly: WeekPoint[]; calendar: number[];
  recent_history: HistEntry[]; overview: Overview;
  cognitive: CognitiveData; achievements: Achievement[];
  hourly_distribution: number[];
}

// ─── Styling constants (sin datos numéricos) ──────────────────────────────────
const SUBJECT_STYLES = [
  { key: 'matematicas', label: 'Matemáticas',    shortLabel: 'Mat.',  Icon: Calculator,   color: '#2563EB', bg: 'bg-blue-50',    text: 'text-blue-600',    bar: 'bg-blue-500'    },
  { key: 'lectura',     label: 'Lectura Crítica', shortLabel: 'Lec.',  Icon: BookOpen,     color: '#f59e0b', bg: 'bg-amber-50',   text: 'text-amber-600',   bar: 'bg-amber-500'   },
  { key: 'ingles',      label: 'Inglés',          shortLabel: 'Ing.',  Icon: MessageSquare,color: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  { key: 'ciencias',    label: 'Ciencias',        shortLabel: 'Cien.', Icon: Zap,          color: '#06b6d4', bg: 'bg-cyan-50',    text: 'text-cyan-600',    bar: 'bg-cyan-500'    },
  { key: 'sociales',    label: 'Sociales',        shortLabel: 'Soc.',  Icon: Users,        color: '#8b5cf6', bg: 'bg-violet-50',  text: 'text-violet-600',  bar: 'bg-violet-500'  },
] as const;

type StyleEntry = typeof SUBJECT_STYLES[number];
type Subject = StyleEntry & SubjectApiData;

const EMPTY_SUBJ: SubjectApiData = { score: 0, prev_score: 0, trend: 0, quizzes: 0, avg_time_min: 0, topics: [], strengths: [], weaknesses: [] };

function buildSubjects(data: Record<string, SubjectApiData>): Subject[] {
  return SUBJECT_STYLES.map(s => ({ ...s, ...(data[s.key] ?? EMPTY_SUBJ) }));
}

// ─── SVG: Radar Chart ─────────────────────────────────────────────────────────
function RadarChart({ subjects }: { subjects: Subject[] }) {
  const cx = 160, cy = 155, maxR = 112, n = subjects.length;
  const getXY = (r: number, i: number) => {
    const a = (-Math.PI / 2) + (2 * Math.PI * i) / n;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const gridPath = (l: number) =>
    subjects.map((_, i) => { const p = getXY(maxR * l, i); return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' ') + 'Z';
  const dataPoints = subjects.map((s, i) => getXY(maxR * (s.score / 100), i));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + 'Z';
  return (
    <svg viewBox="0 0 320 310" className="w-full max-w-xs mx-auto">
      {[0.25, 0.5, 0.75, 1.0].map(l => <path key={l} d={gridPath(l)} fill={l === 1.0 ? '#f8fafc' : 'none'} stroke="#e2e8f0" strokeWidth="1.5" />)}
      {subjects.map((_, i) => { const o = getXY(maxR, i); return <line key={i} x1={cx} y1={cy} x2={o.x.toFixed(1)} y2={o.y.toFixed(1)} stroke="#e2e8f0" strokeWidth="1.5" />; })}
      {[25, 50, 75].map(pct => { const p = getXY(maxR * (pct / 100), 0); return <text key={pct} x={p.x + 4} y={p.y} fontSize="9" fill="#94a3b8">{pct}%</text>; })}
      <path d={dataPath} fill="rgba(37,99,235,0.12)" stroke="#2563EB" strokeWidth="2.5" strokeLinejoin="round" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="5" fill={subjects[i].color} stroke="white" strokeWidth="2.5" />)}
      {subjects.map((s, i) => { const lp = getXY(maxR + 24, i); return <text key={i} x={lp.x.toFixed(1)} y={lp.y.toFixed(1)} textAnchor="middle" dominantBaseline="middle" fontSize="11.5" fill="#475569" fontWeight="600">{s.shortLabel}</text>; })}
    </svg>
  );
}

// ─── SVG: Weekly Bar Chart ────────────────────────────────────────────────────
function WeeklyBarChart({ data }: { data: WeekPoint[] }) {
  if (!data.length) return null;
  const maxH = 110, barW = 34, gap = 12;
  const maxScore = Math.max(...data.map(d => d.score), 1);
  const totalW = data.length * (barW + gap) + 10;
  return (
    <svg viewBox={`0 0 ${totalW} ${maxH + 36}`} className="w-full">
      {[25, 50, 75, 100].map(val => { const y = maxH - (val / 100) * maxH; return (<g key={val}><line x1="0" y1={y} x2={totalW} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4,4" /><text x="2" y={y - 3} fontSize="8" fill="#cbd5e1">{val}%</text></g>); })}
      {data.map((d, i) => {
        const x = i * (barW + gap) + 5;
        const barH = (d.score / 100) * maxH;
        const y = maxH - barH;
        const isMax = d.score === maxScore;
        return (
          <g key={i}>
            <rect x={x} y={d.score > 0 ? y : maxH} width={barW} height={Math.max(barH, 0)} rx="7" fill={isMax ? '#2563EB' : '#c7d2fe'} />
            <text x={x + barW / 2} y={maxH + 16} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="600">{d.day}</text>
            {d.score > 0 && <text x={x + barW / 2} y={Math.max(y - 5, 12)} textAnchor="middle" fontSize="10" fill={isMax ? '#1d4ed8' : '#818cf8'} fontWeight="700">{d.score}%</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ─── SVG: Ring Progress ───────────────────────────────────────────────────────
function RingProgress({ value, color, size = 84 }: { value: number; color: string; size?: number }) {
  const r = 34, cx = 42, cy = 42, circum = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 84 84">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={circum} strokeDashoffset={circum - (value / 100) * circum}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill="#1e293b">{value}%</text>
    </svg>
  );
}

// ─── Trend badge ──────────────────────────────────────────────────────────────
function Trend({ v }: { v: number }) {
  if (v > 0) return <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{v}%</span>;
  if (v < 0) return <span className="text-[11px] font-bold text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{v}%</span>;
  return <span className="text-[11px] font-bold text-gray-400 flex items-center gap-0.5"><Minus className="w-3 h-3" />0%</span>;
}

// ─── Tab 1: Desempeño ─────────────────────────────────────────────────────────
function TabDesempeno({ subjects, history }: { subjects: Subject[]; history: HistEntry[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar */}
        <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
          <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#9B9B9B]" /> Perfil de Competencias
          </h3>
          <p className="text-[#9B9B9B] text-xs mb-4">Comparación de tu rendimiento por materia</p>
          <RadarChart subjects={subjects} />
          <div className="flex flex-wrap gap-3 mt-2 justify-center">
            {subjects.map(s => (
              <div key={s.key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-xs text-gray-500 font-medium">{s.label}: <strong style={{ color: s.color }}>{s.score}%</strong></span>
              </div>
            ))}
          </div>
        </div>

        {/* Subject bars */}
        <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
          <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#9B9B9B]" /> Por Materia
          </h3>
          <p className="text-[#9B9B9B] text-xs mb-4">Haz clic para ver detalles de cada materia</p>
          <div className="space-y-2">
            {subjects.map(s => {
              const Icon = s.Icon;
              const isOpen = expanded === s.key;
              return (
                <div key={s.key}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : s.key)}
                    className={`w-full text-left rounded-md p-3 hover:bg-[#F7F6F3] border transition-all ${isOpen ? 'border-[#E0E0E0] bg-[#F7F6F3]' : 'border-transparent'}`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 ${s.bg} border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${s.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-[#2F3437] text-sm">{s.label}</span>
                          <div className="flex items-center gap-2">
                            <Trend v={s.trend} />
                            <span className="font-semibold text-sm text-[#2F3437]">{s.score}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-[#E0E0E0] rounded-full h-1">
                            <div className={`${s.bar} h-1 rounded-full transition-all duration-500`} style={{ width: `${s.score}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[11px] text-[#9B9B9B] pl-11">
                      <span>{s.quizzes} {s.quizzes === 1 ? 'quiz' : 'quizzes'}</span>
                      {s.avg_time_min > 0 && <><span>·</span><span>~{s.avg_time_min} min/quiz</span></>}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="mx-2 mb-2 p-3 bg-[#F7F6F3] rounded-md border border-[#E0E0E0] animate-fadeIn">
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[11px] font-semibold text-[#9B9B9B] uppercase mb-1.5">✅ Fortalezas</p>
                          {(s.strengths.length ? s.strengths : ['Sin datos aún']).map(t => (
                            <p key={t} className="text-xs text-[#707070] flex items-center gap-1.5 mb-1">
                              <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />{t}
                            </p>
                          ))}
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-[#9B9B9B] uppercase mb-1.5">⚠️ Mejorar</p>
                          {(s.weaknesses.length ? s.weaknesses : ['Sin datos aún']).map(t => (
                            <p key={t} className="text-xs text-[#707070] flex items-center gap-1.5 mb-1">
                              <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />{t}
                            </p>
                          ))}
                        </div>
                      </div>
                      {s.topics.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {s.topics.map(t => <span key={t} className="bg-[#E0E0E0] text-[#707070] text-[11px] font-medium px-2.5 py-1 rounded-md">{t}</span>)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent history table */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <h3 className="font-semibold text-[#2F3437] text-sm mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#9B9B9B]" /> Historial Reciente
        </h3>
        {history.length === 0 ? (
          <div className="text-center py-8 text-[#9B9B9B]">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aún no has completado ningún quiz.</p>
            <Link to="/quizzes" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#2F3437] hover:underline">
              Ir a Desafíos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E0E0E0]">
                  {['Materia', 'Fecha', 'Resultado', 'Tiempo', 'Dificultad'].map(h => (
                    <th key={h} className={`font-medium text-[#707070] pb-3 text-xs uppercase tracking-wider ${h === 'Materia' || h === 'Fecha' ? 'text-left' : 'text-center'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E0E0E0]">
                {history.map((h, i) => {
                  const pct = (h.score / h.total) * 100;
                  const style = SUBJECT_STYLES.find(s => s.key === h.topic_key);
                  return (
                    <tr key={i} className="hover:bg-[#F7F6F3] transition-colors">
                      <td className="py-3 font-medium text-[#2F3437] text-sm">
                        <div className="flex items-center gap-2.5">
                          {style && (
                            <div className={`w-6 h-6 ${style.bg} border border-[#E0E0E0] rounded-md flex items-center justify-center`}>
                              <style.Icon className={`w-3 h-3 ${style.text}`} />
                            </div>
                          )}
                          {h.materia}
                        </div>
                      </td>
                      <td className="py-3 text-[#9B9B9B] text-xs">{h.fecha}</td>
                      <td className="py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`font-semibold text-sm ${pct >= 70 ? 'text-green-700' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{h.score}/{h.total}</span>
                          <div className="w-14 bg-[#E0E0E0] rounded-full h-1 hidden md:block">
                            <div className={`h-1 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-center text-[#707070] text-xs">{h.tiempo}</td>
                      <td className="py-3 text-center">
                        <span className={`text-[11px] font-medium px-2.5 py-1 rounded-md ${h.diff === 'Difícil' ? 'bg-red-50 text-red-600' : h.diff === 'Medio' ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-700'}`}>{h.diff}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tab 2: Progreso ──────────────────────────────────────────────────────────
function TabProgreso({ subjects, weekly, calendar, overview }: {
  subjects: Subject[]; weekly: WeekPoint[]; calendar: number[]; overview: Overview;
}) {
  const calColor = (l: number) => l === 0 ? 'bg-gray-100' : l === 1 ? 'bg-indigo-200' : l === 2 ? 'bg-indigo-400' : 'bg-indigo-600';
  const weekDiff = overview.weekly_diff ?? 0;
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly bar chart */}
        <div className="lg:col-span-2 bg-white border border-[#E0E0E0] rounded-md p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-[#2F3437] text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#9B9B9B]" /> Puntuación Semanal
              </h3>
              <p className="text-[#9B9B9B] text-xs mt-0.5">Promedio: <strong className="text-[#2F3437]">{overview.weekly_avg}%</strong></p>
            </div>
            {weekDiff !== 0 && (
              <div className={`text-xs font-medium px-3 py-1.5 rounded-md flex items-center gap-1 border ${weekDiff >= 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {weekDiff >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {weekDiff >= 0 ? '+' : ''}{weekDiff}% vs. semana anterior
              </div>
            )}
          </div>
          <WeeklyBarChart data={weekly} />
          <div className="mt-4 grid grid-cols-7 gap-1">
            {weekly.map((d, i) => (
              <div key={i} className="text-center text-[10px] text-gray-400 font-medium">{d.hours > 0 ? `${d.hours}h` : ''}</div>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-1">Horas de estudio por día</p>
        </div>

        {/* Stats column */}
        <div className="space-y-3">
          <div className="bg-white border border-[#E0E0E0] rounded-md p-5">
            <p className="text-xs font-medium text-[#9B9B9B] uppercase tracking-wider mb-3">Totales acumulados</p>
            {[
              { label: 'Total quizzes',        value: String(overview.total_quizzes), icon: Target,      },
              { label: 'Respuestas correctas', value: String(overview.total_correct), icon: CheckCircle, },
              { label: 'Horas de estudio',     value: `${overview.total_hours}h`,     icon: Clock,       },
              { label: 'Mejor día',            value: overview.best_day || '—',       icon: Star,        },
            ].map((item, idx) => { const Icon = item.icon; return (
              <div key={idx} className="flex items-center gap-3 py-2.5 border-b border-[#E0E0E0] last:border-0">
                <div className="w-7 h-7 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0"><Icon className="w-3.5 h-3.5 text-[#707070]" /></div>
                <span className="text-sm text-[#707070] flex-1">{item.label}</span>
                <span className="font-semibold text-[#2F3437] text-sm">{item.value}</span>
              </div>
            ); })}
          </div>
          <div className="bg-white border border-[#E0E0E0] rounded-md p-5">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wider mb-1">Velocidad de aprendizaje</p>
            <p className="text-2xl font-semibold text-[#2F3437]">{weekDiff >= 0 ? '+' : ''}{weekDiff}%</p>
            <p className="text-[#9B9B9B] text-xs mt-1">Variación vs. semana anterior</p>
            <div className="mt-3 w-full bg-[#E0E0E0] rounded-full h-1.5">
              <div className="bg-[#2F3437] h-1.5 rounded-full" style={{ width: `${Math.min(overview.weekly_avg, 100)}%` }} />
            </div>
            <p className="text-[#9B9B9B] text-[10px] mt-1">{overview.weekly_avg}% promedio → meta 85%</p>
          </div>
        </div>
      </div>

      {/* Subject evolution */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#9B9B9B]" /> Evolución por Materia
        </h3>
        <p className="text-[#9B9B9B] text-xs mb-5">Comparación respecto al período anterior (14 días)</p>
        <div className="space-y-3">
          {subjects.map(s => {
            const Icon = s.Icon;
            return (
              <div key={s.key} className="flex items-center gap-4">
                <div className={`w-8 h-8 ${s.bg} border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0`}><Icon className={`w-3.5 h-3.5 ${s.text}`} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-[#2F3437]">{s.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#9B9B9B]">{s.prev_score}%</span>
                      <ChevronRight className="w-3 h-3 text-[#D5D5D5]" />
                      <span className="font-semibold text-sm text-[#2F3437]">{s.score}%</span>
                      <span className={`text-xs font-medium rounded-md px-2 py-0.5 ${s.trend > 0 ? 'bg-green-50 text-green-700' : s.trend < 0 ? 'bg-red-50 text-red-600' : 'bg-[#F7F6F3] text-[#9B9B9B]'}`}>
                        {s.trend > 0 ? '+' : ''}{s.trend}%
                      </span>
                    </div>
                  </div>
                  <div className="relative w-full bg-[#E0E0E0] rounded-full h-1.5">
                    <div className="absolute top-0 left-0 h-1.5 rounded-full bg-[#C0C0C0]" style={{ width: `${s.prev_score}%` }} />
                    <div className={`absolute top-0 left-0 h-1.5 rounded-full ${s.bar} transition-all duration-700`} style={{ width: `${s.score}%` }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[#D5D5D5] mt-4">Barra gris: período anterior · Barra oscura: período actual</p>
      </div>

      {/* Activity calendar */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" /> Calendario de Actividad
        </h3>
        <p className="text-[#9B9B9B] text-xs mb-4">
          Últimos 28 días · Consistencia: <strong className="text-[#2F3437]">{overview.consistency_pct}%</strong>
        </p>
        <div className="grid grid-cols-7 gap-2">
          {calendar.map((level, i) => (
            <div key={i} className={`h-8 rounded-lg ${calColor(level)} transition-all hover:opacity-80`}
              title={level === 0 ? 'Sin actividad' : level === 1 ? '1 quiz' : level === 2 ? '2 quizzes' : '3+ quizzes'} />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-4 justify-end">
          <span className="text-[11px] text-gray-400">Menos</span>
          {[0, 1, 2, 3].map(l => <div key={l} className={`w-4 h-4 rounded ${calColor(l)}`} />)}
          <span className="text-[11px] text-gray-400">Más</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Análisis IA ───────────────────────────────────────────────────────
function TabAnalisisIA({ avgScore, cognitive, subjects, overview, hourly }: {
  avgScore: number; cognitive: CognitiveData;
  subjects: Subject[]; overview: Overview; hourly: number[];
}) {
  const COGNITIVO = [
    {
      label: 'Fatiga Cognitiva', value: cognitive.fatigue, threshold: 70,
      desc: cognitive.fatigue < 40 ? 'Buen nivel de energía mental' : cognitive.fatigue < 70 ? 'Fatiga moderada — toma pausas' : 'Alta fatiga — descansa antes de continuar',
      color: cognitive.fatigue < 40 ? '#10b981' : '#f59e0b',
      bg: cognitive.fatigue < 40 ? 'bg-emerald-50' : 'bg-amber-50',
      text: cognitive.fatigue < 40 ? 'text-emerald-700' : 'text-amber-700',
      status: cognitive.fatigue < 40 ? 'BAJO' : cognitive.fatigue < 70 ? 'MODERADO' : 'ALTO',
    },
    {
      label: 'Carga de Trabajo', value: cognitive.overload, threshold: 80,
      desc: cognitive.overload < 45 ? 'Ritmo saludable y sostenible' : cognitive.overload < 80 ? 'Carga moderada — bien encaminado' : 'Carga alta — reduce el ritmo',
      color: cognitive.overload < 45 ? '#10b981' : '#f59e0b',
      bg: cognitive.overload < 45 ? 'bg-emerald-50' : 'bg-amber-50',
      text: cognitive.overload < 45 ? 'text-emerald-700' : 'text-amber-700',
      status: cognitive.overload < 45 ? 'BAJO' : cognitive.overload < 80 ? 'MODERADO' : 'ALTO',
    },
    {
      label: 'Nivel de Duda', value: cognitive.doubt, threshold: 60,
      desc: cognitive.doubt < 30 ? 'Comprensión sólida del contenido' : cognitive.doubt < 60 ? 'Algunas dudas en conceptos clave' : 'Muchas dudas — repasa los temas',
      color: cognitive.doubt < 30 ? '#10b981' : '#f59e0b',
      bg: cognitive.doubt < 30 ? 'bg-emerald-50' : 'bg-amber-50',
      text: cognitive.doubt < 30 ? 'text-emerald-700' : 'text-amber-700',
      status: cognitive.doubt < 30 ? 'BAJO' : cognitive.doubt < 60 ? 'MODERADO' : 'ALTO',
    },
    {
      label: 'Dominio del Contenido', value: cognitive.mastery, threshold: 85,
      desc: cognitive.mastery >= 85 ? '¡Nivel de maestría alcanzado!' : cognitive.mastery >= 60 ? 'Avanzando hacia la maestría' : 'Continúa practicando para dominar',
      color: '#2563EB', bg: 'bg-blue-50', text: 'text-blue-700',
      status: cognitive.mastery >= 85 ? 'MAESTRÍA' : 'EN PROGRESO',
    },
  ];

  const sortedByScore = [...subjects].sort((a, b) => a.score - b.score);
  const RECS = sortedByScore.slice(0, 4).map(s => ({
    priority: s.score < 60 ? 'Alta' : s.score < 75 ? 'Media' : 'Baja',
    labelCls: s.score < 60 ? 'bg-red-50 text-red-600 border-red-200' : s.score < 75 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Icon: s.Icon, subject: s.label,
    msg: s.weaknesses[0] && s.weaknesses[0] !== 'Sin datos aún'
      ? `Refuerza "${s.weaknesses[0]}". ${s.score < 60 ? 'Prioridad alta — hazlo hoy.' : 'Haz 2 quizzes esta semana.'}`
      : `Practica ${s.label} para subir de ${s.score}% a tu meta del 85%.`,
  }));

  const patrones = [
    { label: 'Mejor hora del día',      value: overview.best_time || '—',                                        icon: Clock    },
    { label: 'Sesión promedio',         value: overview.avg_session_min > 0 ? `${overview.avg_session_min} min` : '—', icon: Target   },
    { label: 'Día más productivo',      value: overview.best_day || '—',                                         icon: Flame    },
    { label: 'Consistencia de estudio', value: `${overview.consistency_pct}%`,                                    icon: Activity },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Banner */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-medium text-[#9B9B9B] uppercase tracking-wider mb-2">Diagnóstico NeuroLearn AI</p>
            <h2 className="text-4xl font-semibold text-[#2F3437]">{avgScore}%</h2>
            <p className="text-[#707070] text-sm mt-1">Índice de Preparación Saber 11</p>
          </div>
          <Brain className="w-8 h-8 text-[#E0E0E0]" />
        </div>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1 bg-[#E0E0E0] rounded-full h-2">
            <div className="bg-[#2F3437] h-2 rounded-full" style={{ width: `${avgScore}%` }} />
          </div>
          <span className="text-[#9B9B9B] text-xs font-medium">Meta: 85%</span>
        </div>
        <p className="text-[#9B9B9B] text-xs mt-3">
          Basado en {overview.total_quizzes} quiz{overview.total_quizzes !== 1 ? 'zes' : ''} completados
        </p>
      </div>

      {/* Cognitive indicators */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#9B9B9B]" /> Indicadores Cognitivos
        </h3>
        <p className="text-[#9B9B9B] text-xs mb-5">Derivados de tus patrones de respuesta reales</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {COGNITIVO.map((c, i) => (
            <div key={i} className="bg-[#F7F6F3] border border-[#E0E0E0] rounded-md p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium text-[#2F3437] text-sm">{c.label}</p>
                  <p className="text-[#707070] text-xs mt-0.5">{c.desc}</p>
                </div>
                <span className="text-[10px] font-medium text-[#707070] bg-white border border-[#E0E0E0] px-2 py-1 rounded-md">{c.status}</span>
              </div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <div className="flex justify-between text-[11px] text-[#9B9B9B] mb-1">
                    <span>Actual: <strong style={{ color: c.color }}>{c.value}%</strong></span>
                    <span>Umbral: {c.threshold}%</span>
                  </div>
                  <div className="w-full bg-[#E0E0E0] rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${c.value}%`, backgroundColor: c.color }} />
                  </div>
                  <div className="relative mt-1 h-2">
                    <div className="absolute top-0 w-0.5 h-2 bg-gray-400 opacity-60 rounded" style={{ left: `${c.threshold}%` }} />
                  </div>
                </div>
                <RingProgress value={c.value} color={c.color} size={62} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Patterns + Strengths/Weaknesses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
          <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#9B9B9B]" /> Patrón de Aprendizaje
          </h3>
          <p className="text-[#9B9B9B] text-xs mb-5">Detectado a partir de tus sesiones reales</p>
          <div className="space-y-2">
            {patrones.map((p, i) => { const Icon = p.icon; return (
              <div key={i} className="flex items-center gap-3 p-3 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md">
                <div className="w-7 h-7 bg-white border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0">
                  <Icon className="w-3.5 h-3.5 text-[#707070]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-[#9B9B9B]">{p.label}</p>
                  <p className="font-medium text-[#2F3437] text-sm">{p.value}</p>
                </div>
              </div>
            ); })}
          </div>
          <div className="mt-5">
            <p className="text-xs font-medium text-[#9B9B9B] uppercase mb-2">Distribución horaria de actividad</p>
            <div className="flex gap-1 h-8 items-end">
              {hourly.map((v, i) => (
                <div key={i}
                  className="flex-1 rounded-t-sm bg-blue-400 opacity-40 transition-all hover:opacity-80"
                  style={{ height: `${v > 0 ? Math.max((v / 60) * 100, 8) : 0}%` }}
                  title={`${i}:00`} />
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-[#D5D5D5] mt-1">
              <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
          <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#9B9B9B]" /> Fortalezas y Áreas de Mejora
          </h3>
          <p className="text-[#9B9B9B] text-xs mb-5">Identificadas a partir de tus resultados reales</p>
          <div className="mb-5">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" /> Temas con mejor desempeño
            </p>
            <div className="space-y-2">
              {subjects.filter(s => s.score >= 70).length === 0
                ? <p className="text-xs text-gray-400 italic">Aún sin temas consolidados — ¡sigue practicando!</p>
                : subjects.filter(s => s.score >= 70).map(s => (
                  <div key={s.key} className="flex items-center gap-2.5 text-sm text-gray-700 bg-emerald-50 px-3 py-2 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{s.label}</span>
                    <span className="ml-auto font-bold text-emerald-600">{s.score}%</span>
                  </div>
                ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-bold text-red-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Áreas de mejora prioritarias
            </p>
            <div className="space-y-2">
              {subjects.filter(s => s.score < 70).length === 0
                ? <p className="text-xs text-gray-400 italic">¡Todas las materias superan el 70%!</p>
                : subjects.filter(s => s.score < 70).map(s => (
                  <div key={s.key} className="flex items-center gap-2.5 text-sm text-gray-700 bg-red-50 px-3 py-2 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{s.label}</span>
                    <span className="ml-auto font-bold text-red-500">{s.score}%</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <h3 className="font-semibold text-[#2F3437] text-sm mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#9B9B9B]" /> Recomendaciones Personalizadas
        </h3>
        <p className="text-[#9B9B9B] text-xs mb-5">Generadas a partir de tu historial real de desempeño</p>
        <div className="space-y-3">
          {RECS.map((r, i) => { const Icon = r.Icon; return (
            <div key={i} className={`border rounded-2xl p-4 flex items-start gap-4 ${r.labelCls}`}>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <span className="text-[10px] font-bold opacity-70 uppercase">{r.priority}</span>
                <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm mb-0.5">{r.subject}</p>
                <p className="text-sm opacity-80 leading-relaxed">{r.msg}</p>
              </div>
              <Link to="/quizzes">
                <ChevronRight className="w-4 h-4 opacity-40 flex-shrink-0 mt-2" />
              </Link>
            </div>
          ); })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Logros ────────────────────────────────────────────────────────────
function TabLogros({ overview, achievements }: { overview: Overview; achievements: Achievement[] }) {
  const earned  = achievements.filter(a => a.earned);
  const pending = achievements.filter(a => !a.earned);
  const xp      = overview.total_xp;
  const level   = Math.max(1, Math.floor(xp / 500) + 1);
  const xpInLevel = xp % 500;
  const xpNext  = 500;
  const levelTitles: Record<number, string> = {
    1: 'Principiante', 2: 'Aprendiz', 3: 'Explorador', 4: 'Aventurero',
    5: 'Estudiante Avanzado', 6: 'Aspirante al Saber', 7: 'Explorador del Saber',
    8: 'Estratega', 9: 'Maestro en Formación', 10: 'Campeón Saber 11',
  };
  const title = levelTitles[Math.min(level, 10)] || `Nivel ${level}`;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Level card */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6 relative overflow-hidden">
        <div className="absolute right-4 top-0 bottom-0 flex items-center opacity-5">
          <Trophy className="w-36 h-36 text-[#2F3437]" />
        </div>
        <div className="relative z-10 flex items-center gap-6">
          <div className="w-16 h-16 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex flex-col items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-[#2F3437] leading-none">{level}</span>
            <span className="text-[10px] text-[#9B9B9B] font-medium uppercase">nivel</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#9B9B9B] font-medium uppercase tracking-wider mb-0.5">Título actual</p>
            <h2 className="text-xl font-semibold text-[#2F3437]">{title}</h2>
            <div className="mt-3">
              <div className="flex justify-between text-xs text-[#9B9B9B] mb-1.5">
                <span>{xp.toLocaleString()} XP</span>
                <span>Nivel {level + 1} en {(xpNext - xpInLevel).toLocaleString()} XP</span>
              </div>
              <div className="w-full bg-[#E0E0E0] rounded-full h-1.5">
                <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${Math.min((xpInLevel / xpNext) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Logros desbloqueados', value: `${earned.length}/${achievements.length}`, icon: Trophy, ic: 'text-amber-500'   },
          { label: 'XP acumulados',        value: xp.toLocaleString(),                        icon: Star,   ic: 'text-blue-500'    },
          { label: 'Quizzes completados',  value: String(overview.total_quizzes),             icon: Target, ic: 'text-emerald-500' },
          { label: 'Días de racha',        value: String(overview.streak_days),               icon: Flame,  ic: 'text-orange-500'  },
        ].map((s, i) => { const Icon = s.icon; return (
          <div key={i} className="bg-white border border-[#E0E0E0] rounded-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#707070]">{s.label}</span>
              <Icon className={`w-3.5 h-3.5 ${s.ic}`} />
            </div>
            <p className="text-xl font-semibold text-[#2F3437]">{s.value}</p>
          </div>
        ); })}
      </div>

      {/* Earned badges */}
      {earned.length > 0 && (
        <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
          <h3 className="font-semibold text-[#2F3437] text-sm mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-[#9B9B9B]" /> Logros Desbloqueados
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {earned.map((a, i) => (
              <div key={i} className="flex flex-col items-center text-center p-4 bg-amber-50 border border-amber-100 rounded-md">
                <div className="text-4xl mb-2">{a.icon}</div>
                <p className="font-medium text-[#2F3437] text-sm leading-tight">{a.title}</p>
                <p className="text-xs text-[#9B9B9B] mt-1 leading-tight">{a.desc}</p>
                <span className="mt-2 bg-amber-100 text-amber-700 text-[11px] font-medium px-2.5 py-1 rounded-md">+{a.pts} XP</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending badges */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-6">
        <h3 className="font-semibold text-[#2F3437] text-sm mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-[#9B9B9B]" />
          {earned.length === 0 ? 'Todos los Logros' : 'En Progreso'}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pending.map((a, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md">
              <div className="text-3xl grayscale opacity-40">{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-[#2F3437] text-sm">{a.title}</p>
                  <span className="text-xs font-medium text-[#9B9B9B]">{a.progress}%</span>
                </div>
                <p className="text-xs text-[#9B9B9B] mb-2">{a.desc}</p>
                <div className="w-full bg-[#E0E0E0] rounded-full h-1">
                  <div className="bg-[#2F3437] h-1 rounded-full transition-all" style={{ width: `${a.progress}%` }} />
                </div>
              </div>
              <span className="text-xs font-medium text-[#9B9B9B] bg-white border border-[#E0E0E0] px-2 py-1 rounded-md flex-shrink-0">+{a.pts} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Loading State ────────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Loader2 className="w-8 h-8 text-[#9B9B9B] animate-spin" />
      <p className="text-[#707070] text-sm">Cargando tu análisis de desempeño…</p>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
      <div className="w-16 h-16 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md flex items-center justify-center">
        <BarChart3 className="w-8 h-8 text-[#9B9B9B]" />
      </div>
      <h2 className="text-lg font-semibold text-[#2F3437]">Aún no hay datos de desempeño</h2>
      <p className="text-[#707070] text-sm max-w-sm">
        Completa tu primer quiz para que NeuroLearn AI genere tu análisis personalizado.
      </p>
      <Link to="/quizzes" className="mt-2 inline-flex items-center gap-2 bg-[#2F3437] hover:bg-[#454A4D] text-white px-5 py-2.5 rounded-md text-sm font-medium transition-colors">
        Ir a Desafíos <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export default function DesempenoPage() {
  const { user }  = useAuth();
  const [tab, setTab]         = useState<Tab>('desempeno');
  const [perf, setPerf]       = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);

  useEffect(() => {
    api.get('/stats/performance')
      .then(r => { setPerf(r.data); setApiError(false); })
      .catch(() => setApiError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-10"><LoadingState /></div>;

  if (apiError) return (
    <div className="p-10 flex flex-col items-center justify-center min-h-[60vh] gap-3 text-center">
      <AlertTriangle className="w-8 h-8 text-[#9B9B9B]" />
      <p className="text-[#2F3437] font-medium text-sm">No se pudo conectar con el servidor.</p>
      <p className="text-[#9B9B9B] text-xs">Verifica que el backend esté corriendo en localhost:8000</p>
    </div>
  );

  if (!perf || perf.overview.total_quizzes === 0) return <div className="p-10"><EmptyState /></div>;

  const subjects = buildSubjects(perf.subjects);
  const avgScore = Math.round(perf.overview.avg_score);
  const overview = perf.overview;

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'desempeno', label: 'Desempeño',   icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'progreso',  label: 'Progreso',    icon: <TrendingUp className="w-4 h-4" /> },
    { id: 'analisis',  label: 'Análisis IA', icon: <Brain className="w-4 h-4" /> },
    { id: 'logros',    label: 'Logros',      icon: <Award className="w-4 h-4" /> },
  ];

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <div className="pb-6 mb-6 border-b border-[#E0E0E0]">
        <h1 className="text-2xl font-semibold text-[#2F3437]">Mi Desempeño</h1>
        <p className="text-[#707070] mt-1 text-sm">
          Análisis detallado de tu preparación Saber 11
          {user?.full_name && `, ${user.full_name.split(' ')[0]}`}
        </p>
      </div>

      {/* ── KPI Summary ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Puntos XP',        value: overview.total_xp.toLocaleString(), sub: `${overview.total_quizzes} quizzes`,       icon: Star,   kBg: 'bg-amber-50',  kIcon: 'text-amber-500'  },
          { label: 'Precisión Global', value: `${overview.precision}%`,            sub: 'Respuestas correctas',                   icon: Target, kBg: 'bg-blue-50',   kIcon: 'text-blue-500'   },
          { label: 'Racha Activa',     value: `${overview.streak_days} días`,      sub: overview.streak_days >= 5 ? '¡Sigue así!' : 'Estudia cada día', icon: Flame, kBg: 'bg-orange-50', kIcon: 'text-orange-500' },
          { label: 'Tiempo Total',     value: `${overview.total_hours}h`,          sub: 'Horas de estudio',                       icon: Clock,  kBg: 'bg-slate-50',  kIcon: 'text-slate-400'  },
        ].map((s, i) => { const Icon = s.icon; return (
          <div key={i} className="bg-white border border-[#E0E0E0] rounded-md p-4 flex items-start gap-3">
            <div className={`w-8 h-8 ${s.kBg} border border-[#E0E0E0] rounded-md flex items-center justify-center flex-shrink-0`}>
              <Icon className={`w-4 h-4 ${s.kIcon}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#707070]">{s.label}</p>
              <p className="text-lg font-semibold text-[#2F3437] leading-tight">{s.value}</p>
              <p className="text-xs text-[#9B9B9B] mt-0.5">{s.sub}</p>
            </div>
          </div>
        ); })}
      </div>

      {/* ── Global progress bar ── */}
      <div className="bg-white border border-[#E0E0E0] rounded-md p-4 mb-6 flex items-center gap-5">
        <div className="flex-shrink-0 text-center w-12">
          <p className="text-xl font-semibold text-[#2F3437]">{avgScore}%</p>
          <p className="text-[10px] text-[#9B9B9B] leading-tight">índice global</p>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-[#9B9B9B] mb-1.5">
            <span>Progreso hacia meta Saber 11</span>
            <span className="font-medium text-[#707070]">Meta: 85%</span>
          </div>
          <div className="w-full bg-[#E0E0E0] rounded-full h-2 relative overflow-hidden">
            <div className="h-2 rounded-full bg-[#2F3437] transition-all duration-700" style={{ width: `${Math.min(avgScore, 100)}%` }} />
            <div className="absolute top-0 bottom-0 w-0.5 bg-[#9B9B9B]" style={{ left: '85%' }} />
          </div>
          <div className="flex justify-between text-[10px] text-[#D5D5D5] mt-1">
            <span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span>
          </div>
        </div>
        <div className="flex-shrink-0 hidden md:flex gap-3">
          {subjects.map(s => { const Icon = s.Icon; return (
            <div key={s.key} className="text-center">
              <div className={`w-8 h-8 ${s.bg} border border-[#E0E0E0] rounded-md flex items-center justify-center mx-auto`}>
                <Icon className={`w-3.5 h-3.5 ${s.text}`} />
              </div>
              <p className="text-[10px] font-semibold mt-0.5 text-[#2F3437]">{s.score}%</p>
            </div>
          ); })}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex flex-wrap gap-1.5 mb-6 bg-[#F7F6F3] border border-[#E0E0E0] rounded-md p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-white text-[#2F3437] border border-[#E0E0E0]'
                : 'text-[#707070] hover:text-[#2F3437]'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      {tab === 'desempeno' && <TabDesempeno subjects={subjects} history={perf.recent_history} />}
      {tab === 'progreso'  && <TabProgreso  subjects={subjects} weekly={perf.weekly} calendar={perf.calendar} overview={overview} />}
      {tab === 'analisis'  && <TabAnalisisIA avgScore={avgScore} cognitive={perf.cognitive} subjects={subjects} overview={overview} hourly={perf.hourly_distribution} />}
      {tab === 'logros'    && <TabLogros     overview={overview} achievements={perf.achievements} />}
    </div>
  );
}
