import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { DEMO_MODE } from '../../services/demoChat';
import type { ExpertBot, Classroom } from '../../types';
import {
  BookOpen,
  MessageSquare,
  Sparkles,
  ArrowRight,
  ClipboardCheck,
  Clock,
  Target,
  Bell,
  Flame,
  LayoutDashboard,
  Users
} from 'lucide-react';

const SKILL_ICONS: Record<string, React.ReactNode> = {
  matematicas: <div className="bg-primary-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_10px_rgba(33,150,243,0.3)]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19 3H5C3.89543 3 3 3.89543 3 5V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V5C21 3.89543 20.1046 3 19 3Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 8V8.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 8V8.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 8V8.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 12V12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 12V12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 12V12.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 16V16.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 16V16.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 16V16.01" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>,
  lectora: <div className="bg-accent-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_10px_rgba(255,152,0,0.3)]"><BookOpen className="w-6 h-6 text-white" /></div>,
  ingles: <div className="bg-secondary-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_10px_rgba(76,175,80,0.3)]"><MessageSquare className="w-6 h-6 text-white" /></div>,
  ciudadanas: <div className="bg-purple-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_10px_rgba(124,58,237,0.3)]"><Users className="w-6 h-6 text-white" /></div>,
  cientifico: <div className="bg-[#00BCD4] w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_4px_10px_rgba(0,188,212,0.3)]"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 3H15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M10 9L7 20C6.77615 20.6713 7.27364 21.3653 7.98188 21.3653H16.0181C16.7264 21.3653 17.2239 20.6713 17 20L14 9V3H10V9Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 16H16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>,
};

const SKILL_COLORS: Record<string, string> = {
  matematicas: 'bg-primary-500',
  lectora: 'bg-accent-500',
  ingles: 'bg-secondary-500',
  ciudadanas: 'bg-purple-500',
  cientifico: 'bg-[#00BCD4]',
};

interface DashboardStats {
  progress_percentage: number;
  total_exercises: number;
  total_classes: number;
  active_skills: number;
  study_hours: number;
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
    study_hours: 0
  });
  const [, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (DEMO_MODE) {
        setLoading(false);
        return; // en demo no hay backend — bots y clases quedan vacíos
      }
      try {
        const [botsRes, classesRes, statsRes] = await Promise.all([
          api.get('/bots/').catch(() => ({ data: { bots: [] } })),
          api.get('/classrooms/my-enrolled').catch(() => ({ data: { classrooms: [] } })),
          api.get('/stats/dashboard').catch(() => ({ data: {
            progress_percentage: 0,
            total_exercises: 0,
            total_classes: 0,
            active_skills: 0,
            study_hours: 0
          } }))
        ]);
        setBots(botsRes.data.bots || []);
        setClassrooms(classesRes.data.classrooms || []);
        if (statsRes.data && statsRes.data.progress_percentage !== undefined) {
             setStats(statsRes.data);
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
        <h1 className="text-3xl font-bold text-gray-900 font-heading tracking-tight flex items-center gap-2">
            ¡{greeting()}, {user?.full_name?.split(' ')[0] || user?.username}! <span role="img" aria-label="wave">👋</span>
        </h1>
        <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-gray-100">
                <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                <div>
                   <div className="text-[10px] uppercase font-bold text-gray-400 leading-none">Racha</div>
                   <div className="font-bold text-gray-900 text-sm leading-none mt-1">7 días</div>
                </div>
            </div>
            <button className="relative w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-gray-100 text-gray-500 hover:text-primary-500 hover:bg-primary-50 transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-primary-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] text-white font-bold">3</span>
            </button>
        </div>
      </div>
      
      <p className="text-gray-500 text-[15px] mb-8 mt-[-24px]">Continúa desarrollando tus habilidades para el Saber 11</p>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width) - Hero, Skills, Actions */}
        <div className="xl:col-span-2 space-y-8">
            
            {/* Hero / Banner */}
            <div className="bg-[#0f172a] rounded-[24px] overflow-hidden relative shadow-[0_10px_30px_rgba(15,23,42,0.15)] h-[240px] flex items-center">
                {/* Background effects */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#1e3a8a] to-[#7c3aed] opacity-50"></div>
                <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                
                <div className="relative z-10 p-8 md:p-10 max-w-[60%]">
                    <div className="text-blue-200 text-sm font-semibold mb-2 tracking-wide uppercase">Tu aprendizaje, potenciado por</div>
                    <div className="text-white text-3xl md:text-5xl font-bold font-heading mb-4">NeuroLearn AI</div>
                    <Link to="/bots" className="inline-flex items-center gap-2 bg-white text-[#1e3a8a] px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors shadow-lg">
                        Continuar aprendiendo
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Overall Progress and Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Progress Card */}
                <div className="bg-white rounded-3xl p-6 md:p-8 card-shadow relative overflow-hidden">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 font-heading">Progreso Global</h3>
                            <p className="text-gray-500 text-sm mt-1">Preparación general</p>
                        </div>
                        <div className="bg-green-50 text-green-600 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1">
                            +2.4% <Sparkles className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="relative w-24 h-24 flex-shrink-0">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" stroke="#f1f5f9" strokeWidth="12" fill="none" />
                                <circle 
                                    cx="50" cy="50" r="40" 
                                    stroke="#3b82f6" 
                                    strokeWidth="12" 
                                    fill="none" 
                                    strokeDasharray="251.2" 
                                    strokeDashoffset={251.2 - (251.2 * stats.progress_percentage) / 100}
                                    strokeLinecap="round" 
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center flex-col">
                                <span className="text-2xl font-bold text-gray-900 leading-none">{stats.progress_percentage}%</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-gray-600 text-sm mb-2">¡Vas por buen camino! Estás a <strong>{100 - stats.progress_percentage}%</strong> de alcanzar tu meta de puntaje objetivo.</p>
                            <Link to="/quizzes" className="text-primary-600 font-semibold text-sm hover:text-primary-700 flex items-center gap-1">
                                Ver analíticas completas <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-[20px] p-5 card-shadow flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-primary-50 p-2.5 rounded-xl text-primary-500">
                                <Target className="w-5 h-5" />
                            </div>
                            <span className="text-gray-500 font-medium text-sm">Habilidades</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 font-heading">{stats.active_skills}/5</div>
                    </div>
                    
                    <div className="bg-white rounded-[20px] p-5 card-shadow flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-accent-50 p-2.5 rounded-xl text-accent-500">
                                <BookOpen className="w-5 h-5" />
                            </div>
                            <span className="text-gray-500 font-medium text-sm">Clases</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 font-heading">{stats.total_classes}</div>
                    </div>

                    <div className="bg-white rounded-[20px] p-5 card-shadow flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-secondary-50 p-2.5 rounded-xl text-secondary-500">
                                <ClipboardCheck className="w-5 h-5" />
                            </div>
                            <span className="text-gray-500 font-medium text-sm">Ejercicios</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 font-heading">{stats.total_exercises}</div>
                    </div>

                    <div className="bg-white rounded-[20px] p-5 card-shadow flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="bg-purple-50 p-2.5 rounded-xl text-purple-500">
                                <Clock className="w-5 h-5" />
                            </div>
                            <span className="text-gray-500 font-medium text-sm">Horas</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900 font-heading">{stats.study_hours}h</div>
                    </div>
                </div>
            </div>

            {/* Skills & Focus Areas */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2 font-heading tracking-tight">
                        <Sparkles className="w-5 h-5 text-gray-400" /> Habilidades Transversales Saber 11
                    </h3>
                    <Link to="/bots" className="text-primary-500 text-sm font-bold hover:text-primary-600 flex items-center gap-1 transition-colors">
                        Ver todas <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {/* Skills Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { key: 'matematicas', name: 'Pensamiento Lógico-Matemático', desc: 'Razonamiento cuantitativo', progress: 72 },
                    { key: 'lectora', name: 'Comprensión Lectora Crítica', desc: 'Lectura crítica y análisis', progress: 68 },
                    { key: 'ingles', name: 'Inglés Comunicativo', desc: 'Competencia en inglés', progress: 55 },
                    { key: 'ciudadanas', name: 'Competencias Ciudadanas', desc: 'Sociales y ciudadanía', progress: 60 },
                    { key: 'cientifico', name: 'Pensamiento Científico', desc: 'Ciencias naturales', progress: 70 },
                ].map((skill) => (
                    <Link
                    key={skill.key}
                    to={`/chat?skill=${skill.key}`}
                    className="bg-white border hover:border-gray-300 border-gray-100 rounded-[20px] p-5 card-shadow transition-all group overflow-hidden relative"
                    >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex gap-4 items-center">
                            {SKILL_ICONS[skill.key]}
                            <div>
                                <h4 className="font-bold text-gray-900 text-[15px] leading-tight mb-0.5 group-hover:text-primary-500 transition-colors">
                                    {skill.name}
                            </h4>
                            <p className="text-[12px] text-gray-500">{skill.desc}</p>
                        </div>
                    </div>
                </div>
                
                {/* Progress bar */}
                <div className="mt-4 flex items-center gap-3">
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                       <div className={`${SKILL_COLORS[skill.key]} h-1.5 rounded-full`} style={{ width: `${skill.progress}%` }}></div>
                    </div>
                    <span className={`text-xs font-bold ${SKILL_COLORS[skill.key].replace('bg-', 'text-').replace('text-[#00BCD4]', 'text-cyan-500')} whitespace-nowrap`}>{skill.progress}%</span>
                </div>
                </Link>
            ))}
                </div>
            </div>

            {/* Actions Section */}
            <div className="mt-2">
                <h3 className="text-lg font-bold text-gray-900 mb-4 font-heading tracking-tight">¿Qué quieres hacer hoy?</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Link to="/chat" className="bg-white border hover:border-primary-200 border-gray-100 rounded-[16px] p-4 card-shadow flex items-center gap-4 transition-all group">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"><MessageSquare className="w-5 h-5 text-primary-500" /></div>
                        <div>
                            <div className="font-bold text-gray-900 text-sm">Practicar</div>
                            <div className="text-[11px] text-gray-500">Ejercicios adaptativos</div>
                        </div>
                    </Link>
                    <Link to="/bots" className="bg-white border hover:border-secondary-200 border-gray-100 rounded-[16px] p-4 card-shadow flex items-center gap-4 transition-all group">
                        <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"><BookOpen className="w-5 h-5 text-secondary-500" /></div>
                        <div>
                            <div className="font-bold text-gray-900 text-sm">Repasar</div>
                            <div className="text-[11px] text-gray-500">Contenido clave</div>
                        </div>
                    </Link>
                    <Link to="/quizzes" className="bg-white border hover:border-accent-200 border-gray-100 rounded-[16px] p-4 card-shadow flex items-center gap-4 transition-all group">
                        <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"><Target className="w-5 h-5 text-accent-500" /></div>
                        <div>
                            <div className="font-bold text-gray-900 text-sm">Desafiarme</div>
                            <div className="text-[11px] text-gray-500">Retos por nivel</div>
                        </div>
                    </Link>
                    <Link to="/my-classes" className="bg-white border hover:border-purple-200 border-gray-100 rounded-[16px] p-4 card-shadow flex items-center gap-4 transition-all group">
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform"><LayoutDashboard className="w-5 h-5 text-purple-500" /></div>
                        <div>
                            <div className="font-bold text-gray-900 text-sm">Ver mis clases</div>
                            <div className="text-[11px] text-gray-500">Clases inscritas</div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Recommended Section Bottom */}
            <div className="bg-gradient-to-r from-gray-50 to-white rounded-[24px] p-6 border border-gray-100 card-shadow flex items-center relative overflow-hidden mt-6">
                 <div className="flex-1 z-10">
                     <div className="flex items-center gap-2 mb-2">
                         <Sparkles className="w-4 h-4 text-purple-500" />
                         <span className="font-bold text-sm text-gray-800">Recomendado para ti</span>
                     </div>
                     <p className="text-xs text-gray-500 mb-4">Basado en tu rendimiento y objetivos</p>
                 </div>
                 {/* Illustration placeholder */}
                  <div className="absolute right-0 bottom-0 opacity-20">
                     <Target className="w-32 h-32 text-purple-500 transform translate-x-8 translate-y-8" />
                  </div>
            </div>

        </div>

        {/* Right Column (1/3 width) - Upcoming, Notifications, Calendar */}
        <div className="space-y-8">
            
            {/* Upcoming Classes */}
            <div className="bg-white rounded-3xl p-6 md:p-8 card-shadow">
                <h3 className="text-xl font-bold text-gray-900 font-heading mb-6 flex items-center justify-between">
                    Mis Clases Recientes
                    <Link to="/classrooms" className="text-sm font-semibold text-primary-500 hover:text-primary-600">Ver todas</Link>
                </h3>
                
                <div className="space-y-5">
                    {classrooms.length > 0 ? classrooms.slice(0, 3).map((classroom, idx) => (
                      <div key={idx} className="flex gap-4 items-start group">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary-50 text-primary-500 font-bold font-heading text-lg`}>
                              {classroom.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                              <h4 className="font-bold text-gray-900 text-[15px] group-hover:text-primary-500 transition-colors">{classroom.name}</h4>
                              <p className="text-gray-500 text-sm mt-0.5">{classroom.description?.substring(0, 40)}...</p>
                          </div>
                      </div>
                    )) : (
                      <div className="text-center py-6 text-gray-500">No estás inscrito en clases aún.</div>
                    )}
                </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-gradient-to-br from-primary-500 to-indigo-600 rounded-3xl p-1 shadow-lg text-white">
                <div className="bg-white/10 backdrop-blur-sm rounded-[22px] p-6">
                    <h3 className="text-xl font-bold font-heading mb-2 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-yellow-300" />
                        Recomendaciones AI
                    </h3>
                    <p className="text-blue-50 text-sm mb-4">Basado en tu último desempeño en matemáticas, te sugerimos:</p>
                    <ul className="space-y-3">
                        <li className="flex items-center gap-3 bg-white/20 p-3 rounded-xl hover:bg-white/30 transition-colors cursor-pointer">
                            <span className="w-8 h-8 rounded-full bg-white text-primary-600 flex items-center justify-center font-bold text-sm">1</span>
                            <span className="font-medium text-sm">Repasar Álgebra Básica</span>
                        </li>
                        <li className="flex items-center gap-3 bg-white/20 p-3 rounded-xl hover:bg-white/30 transition-colors cursor-pointer">
                            <span className="w-8 h-8 rounded-full bg-white text-primary-600 flex items-center justify-center font-bold text-sm">2</span>
                            <span className="font-medium text-sm">Hacer quiz de Comprensión Lectora</span>
                        </li>
                    </ul>
                </div>
            </div>

        </div>

      </div>
    </div>
  );
}