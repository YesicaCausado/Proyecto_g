import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { ExpertBot, Classroom } from '../../types';
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  Clock,
  Target,
  Flame,
  LayoutDashboard,
  Users,
  Calculator,
  Zap,
  Bell,
} from 'lucide-react';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  matematicas: <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><Calculator className="w-5 h-5 text-[#787774]" /></div>,
  lectora:     <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><BookOpen    className="w-5 h-5 text-[#787774]" /></div>,
  ingles:      <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><MessageSquare className="w-5 h-5 text-[#787774]" /></div>,
  ciudadanas:  <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><Users       className="w-5 h-5 text-[#787774]" /></div>,
  cientifico:  <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><Zap         className="w-5 h-5 text-[#787774]" /></div>,
};

const SKILL_COLORS: Record<string, string> = {
  matematicas: 'bg-[#37352F]',
  lectora:     'bg-[#37352F]',
  ingles:      'bg-[#37352F]',
  ciudadanas:  'bg-[#37352F]',
  cientifico:  'bg-[#37352F]',
};

interface DashboardStats {
  progress_percentage: number;
  total_exercises: number;
  total_classes: number;
  active_skills: number;
  study_hours: number;
  streak_days: number;
  /** score 0-100 por cada skill: matematicas, lectora, ingles, ciudadanas, cientifico */
  skill_scores: Record<string, number>;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [, setBots] = useState<ExpertBot[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    progress_percentage: 0,
    total_exercises: 0,
    total_classes: 0,
    active_skills: 0,
    study_hours: 0,
    streak_days: 0,
    skill_scores: {},
  });
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [botsRes, classesRes, statsRes, perfRes] = await Promise.all([
          api.get('/bots/').catch(() => ({ data: { bots: [] } })),
          api.get('/classrooms/my-enrolled').catch(() => ({ data: { classrooms: [] } })),
          api.get('/stats/dashboard').catch(() => ({ data: null })),
          api.get('/stats/performance').catch(() => ({ data: null })),
        ]);

        setBots(botsRes.data.bots || []);
        setClassrooms(classesRes.data.classrooms || []);

        const dashData = statsRes.data;
        const perfData = perfRes.data;

        // Mapear scores por materia → claves del dashboard
        const skill_scores: Record<string, number> = {};
        if (perfData?.subjects) {
          skill_scores.matematicas = Math.round(perfData.subjects.matematicas?.score || 0);
          skill_scores.lectora     = Math.round(perfData.subjects.lectura?.score     || 0);
          skill_scores.ingles      = Math.round(perfData.subjects.ingles?.score      || 0);
          skill_scores.ciudadanas  = Math.round(perfData.subjects.sociales?.score    || 0);
          skill_scores.cientifico  = Math.round(perfData.subjects.ciencias?.score    || 0);
        }

        if (dashData) {
          setStats({
            progress_percentage: dashData.progress_percentage ?? 0,
            total_exercises:     dashData.total_exercises     ?? 0,
            total_classes:       dashData.total_classes       ?? 0,
            active_skills:       dashData.active_skills       ?? 0,
            study_hours:         dashData.study_hours         ?? 0,
            streak_days:         perfData?.overview?.streak_days ?? 0,
            skill_scores,
          });
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="p-6 md:p-10 max-w-[1400px] mx-auto">
      {/* Top action bar (Search, Streak, Notifications) */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#191919] font-heading tracking-tight flex items-center gap-2">
            ¡{greeting()}, {user?.full_name?.split(' ')[0] || user?.username}! <span role="img" aria-label="wave">👋</span>
        </h1>
        <div className="hidden md:flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#F7F6F3] border border-[#E9E9E7] px-3 py-1.5 rounded-md">
                <Flame className="w-4 h-4 text-[#D9730D]" />
                <span className="text-[#37352F] text-sm font-semibold">{stats.streak_days} {stats.streak_days === 1 ? 'día' : 'días'}</span>
                <span className="text-[#9B9A97] text-xs">racha</span>
            </div>
            <button className="relative w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center text-[#787774] hover:bg-[#F1F1EF] transition-colors">
                <Bell className="w-4 h-4" />
            </button>
        </div>
      </div>
      
      <p className="text-[#787774] text-[15px] mb-8 mt-[-24px]">Continúa desarrollando tus habilidades para el Saber 11</p>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width) - Hero, Skills, Actions */}
        <div className="xl:col-span-2 space-y-8">
            
            {/* Hero / Banner */}
            <div className="bg-[#37352F] rounded-md overflow-hidden relative h-[180px] flex items-center">
                <div className="p-8 md:p-10">
                    <p className="text-[#9B9A97] text-xs font-medium mb-2 uppercase tracking-wider">Tu aprendizaje, potenciado por</p>
                    <div className="text-white text-2xl md:text-3xl font-semibold mb-4">NeuroLearn AI</div>
                    <Link to="/bots" className="inline-flex items-center gap-2 bg-white text-[#37352F] px-4 py-2 rounded-md font-medium text-sm hover:bg-[#F7F6F3] transition-colors">
                        Continuar aprendiendo
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Overall Progress and Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Progress Card */}
                <div className="bg-white border border-[#E9E9E7] rounded-md p-6 relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-base font-semibold text-[#37352F]">Progreso Global</h3>
                            <p className="text-[#9B9A97] text-sm mt-0.5">Preparación general</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative w-20 h-20 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" stroke="#E9E9E7" strokeWidth="12" fill="none" />
                                <circle 
                                    cx="50" cy="50" r="40" 
                                    stroke="#37352F" 
                                    strokeWidth="12" 
                                    fill="none" 
                                    strokeDasharray="251.2" 
                                    strokeDashoffset={251.2 - (251.2 * stats.progress_percentage) / 100}
                                    strokeLinecap="round" 
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-semibold text-[#37352F] leading-none">{stats.progress_percentage}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-[#787774] text-sm mb-3">Estás a <strong className="text-[#37352F]">{100 - stats.progress_percentage}%</strong> de tu meta.</p>
                            <Link to="/performance" className="text-sm font-medium text-[#37352F] hover:underline flex items-center gap-1">
                                Ver analíticas <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Habilidades', value: `${stats.active_skills}/5`, icon: Target         },
                      { label: 'Clases',       value: String(stats.total_classes),  icon: BookOpen       },
                      { label: 'Ejercicios',   value: String(stats.total_exercises),icon: ClipboardCheck },
                      { label: 'Horas',        value: `${stats.study_hours}h`,      icon: Clock          },
                    ].map((s, i) => { const Icon = s.icon; return (
                      <div key={i} className="bg-white border border-[#E9E9E7] rounded-md p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-7 h-7 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0">
                            <Icon className="w-3.5 h-3.5 text-[#787774]" />
                          </div>
                          <span className="text-[#787774] text-xs">{s.label}</span>
                        </div>
                        <div className="text-xl font-semibold text-[#37352F]">{s.value}</div>
                      </div>
                    ); })}
                </div>
            </div>

            {/* Skills & Focus Areas */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-[#37352F] flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-[#9B9A97]" /> Habilidades Transversales Saber 11
                    </h3>
                    <Link to="/bots" className="text-[#787774] text-sm font-medium hover:text-[#37352F] flex items-center gap-1 transition-colors">
                        Ver todas <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>

                {/* Skills Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { key: 'matematicas', name: 'Pensamiento Lógico-Matemático', desc: 'Razonamiento cuantitativo' },
                    { key: 'lectora',     name: 'Comprensión Lectora Crítica',   desc: 'Lectura crítica y análisis' },
                    { key: 'ingles',      name: 'Inglés Comunicativo',           desc: 'Competencia en inglés' },
                    { key: 'ciudadanas',  name: 'Competencias Ciudadanas',        desc: 'Sociales y ciudadanía' },
                    { key: 'cientifico',  name: 'Pensamiento Científico',         desc: 'Ciencias naturales' },
                ].map((skill) => {
                    const progress = stats.skill_scores[skill.key] ?? 0;
                    return (
                    <Link
                    key={skill.key}
                    to={`/chat?skill=${skill.key}`}
                    className="bg-white border border-[#E9E9E7] hover:border-[#9B9A97] rounded-md p-4 transition-all group"
                    >
                    <div className="flex items-center gap-3 mb-3">
                        {SKILL_ICONS[skill.key]}
                        <div>
                            <h4 className="font-medium text-[#37352F] text-sm leading-tight">
                                {skill.name}
                            </h4>
                            <p className="text-xs text-[#9B9A97] mt-0.5">{skill.desc}</p>
                        </div>
                    </div>
                
                {/* Progress bar */}
                <div className="flex items-center gap-3">
                    <div className="w-full bg-[#E9E9E7] rounded-full h-1">
                       <div className={`${SKILL_COLORS[skill.key]} h-1 rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="text-xs font-medium text-[#787774] whitespace-nowrap">
                      {progress > 0 ? `${progress}%` : '—'}
                    </span>
                </div>
                </Link>
                    );
                })}                </div>
            </div>

            <div className="mt-2">
                <h3 className="text-base font-semibold text-[#37352F] mb-3">¿Qué quieres hacer hoy?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Link to="/chat" className="bg-white border border-[#E9E9E7] hover:border-[#9B9A97] rounded-md p-4 flex items-center gap-3 transition-all">
                        <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-[#787774]" /></div>
                        <div>
                            <div className="font-medium text-[#37352F] text-sm">Practicar</div>
                            <div className="text-xs text-[#9B9A97]">Ejercicios adaptativos</div>
                        </div>
                    </Link>
                    <Link to="/bots" className="bg-white border border-[#E9E9E7] hover:border-[#9B9A97] rounded-md p-4 flex items-center gap-3 transition-all">
                        <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><BookOpen className="w-4 h-4 text-[#787774]" /></div>
                        <div>
                            <div className="font-medium text-[#37352F] text-sm">Repasar</div>
                            <div className="text-xs text-[#9B9A97]">Contenido clave</div>
                        </div>
                    </Link>
                    <Link to="/quizzes" className="bg-white border border-[#E9E9E7] hover:border-[#9B9A97] rounded-md p-4 flex items-center gap-3 transition-all">
                        <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><Target className="w-4 h-4 text-[#787774]" /></div>
                        <div>
                            <div className="font-medium text-[#37352F] text-sm">Desafiarme</div>
                            <div className="text-xs text-[#9B9A97]">Retos por nivel</div>
                        </div>
                    </Link>
                    <Link to="/my-classes" className="bg-white border border-[#E9E9E7] hover:border-[#9B9A97] rounded-md p-4 flex items-center gap-3 transition-all">
                        <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0"><LayoutDashboard className="w-4 h-4 text-[#787774]" /></div>
                        <div>
                            <div className="font-medium text-[#37352F] text-sm">Mis clases</div>
                            <div className="text-xs text-[#9B9A97]">Clases inscritas</div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Recommended Section */}
            <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-5 flex items-center gap-4 mt-2">
                <div className="w-8 h-8 bg-white border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-[#787774]" />
                </div>
                <div>
                    <p className="text-sm font-medium text-[#37352F]">Recomendado para ti</p>
                    <p className="text-xs text-[#9B9A97] mt-0.5">Basado en tu rendimiento y objetivos</p>
                </div>
                <Link to="/performance" className="ml-auto flex items-center gap-1 text-xs font-medium text-[#787774] hover:text-[#37352F] transition-colors flex-shrink-0">
                    Ver análisis <ArrowRight className="w-3.5 h-3.5" />
                </Link>
            </div>

        </div>

        {/* Right Column */}
        <div className="space-y-5">
            
            {/* Upcoming Classes */}
            <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#37352F]">Mis Clases Recientes</h3>
                    <Link to="/my-classes" className="text-xs text-[#787774] hover:text-[#37352F] transition-colors">Ver todas</Link>
                </div>
                
                <div className="space-y-3">
                    {classrooms.length > 0 ? classrooms.slice(0, 3).map((classroom, idx) => (
                      <div key={idx} className="flex gap-3 items-center">
                          <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0 font-semibold text-[#37352F] text-sm">
                              {classroom.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-[#37352F] text-sm truncate">{classroom.name}</h4>
                              <p className="text-[#9B9A97] text-xs mt-0.5 truncate">{classroom.description?.substring(0, 40)}</p>
                          </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-[#9B9A97] text-sm">No estás inscrito en clases aún.</div>
                    )}
                </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5 text-[#787774]" />
                    </div>
                    <h3 className="text-sm font-semibold text-[#37352F]">Recomendaciones AI</h3>
                </div>
                <p className="text-xs text-[#9B9A97] mb-4">Basado en tu último desempeño en matemáticas, te sugerimos:</p>
                <div className="space-y-2">
                    {[
                        { n: '1', text: 'Repasar Álgebra Básica' },
                        { n: '2', text: 'Quiz de Comprensión Lectora' },
                    ].map(r => (
                        <div key={r.n} className="flex items-center gap-3 p-3 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md">
                            <span className="w-5 h-5 bg-white border border-[#E9E9E7] rounded text-[#787774] text-xs font-semibold flex items-center justify-center flex-shrink-0">{r.n}</span>
                            <span className="text-[#37352F] text-sm">{r.text}</span>
                        </div>
                    ))}
                </div>
            </div>

        </div>

      </div>
    </div>
  );
}