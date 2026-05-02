import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { ExpertBot, Classroom } from '../../types';
import {
  Brain,
  BookOpen,
  MessageSquare,
  TrendingUp,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

const SKILL_ICONS: Record<string, string> = {
  matematicas: '🧮',
  lectora: '📖',
  ingles: '🌎',
  ciudadanas: '🏛️',
  cientifico: '🔬',
};

const SKILL_COLORS: Record<string, string> = {
  matematicas: 'from-blue-500 to-blue-600',
  lectora: 'from-amber-500 to-orange-500',
  ingles: 'from-green-500 to-emerald-600',
  ciudadanas: 'from-purple-500 to-violet-600',
  cientifico: 'from-cyan-500 to-teal-600',
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [bots, setBots] = useState<ExpertBot[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [botsRes, classesRes] = await Promise.all([
          api.get('/bots/').catch(() => ({ data: { bots: [] } })),
          api.get('/classrooms/my-enrolled').catch(() => ({ data: { classrooms: [] } })),
        ]);
        setBots(botsRes.data.bots || []);
        setClassrooms(classesRes.data.classrooms || []);
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
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {loading && (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {greeting()}, {user?.full_name?.split(' ')[0] || user?.username} 👋
        </h1>
        <p className="text-gray-500 mt-1">
          Continúa desarrollando tus habilidades para el Saber 11
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          to="/bots"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <BookOpen className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Habilidades</h3>
              <p className="text-sm text-gray-500">{bots.length || 5} competencias transversales</p>
            </div>
          </div>
        </Link>

        <Link
          to="/chat"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-green-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <MessageSquare className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Aprender</h3>
              <p className="text-sm text-gray-500">Chat con tutor IA adaptativo</p>
            </div>
          </div>
        </Link>

        <Link
          to="/my-classes"
          className="bg-white border border-gray-200 rounded-xl p-5 hover:border-accent-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <TrendingUp className="w-6 h-6 text-accent-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Mis Clases</h3>
              <p className="text-sm text-gray-500">{classrooms.length} clases inscritas</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Skills Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-accent-500" />
            Habilidades Transversales Saber 11
          </h2>
          <Link to="/bots" className="text-primary-600 text-sm font-medium hover:text-primary-700 flex items-center gap-1">
            Ver todas <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { key: 'matematicas', name: 'Pensamiento Lógico-Matemático', desc: 'Razonamiento cuantitativo' },
            { key: 'lectora', name: 'Comprensión Lectora', desc: 'Lectura crítica y análisis' },
            { key: 'ingles', name: 'Inglés Comunicativo', desc: 'Competencia en inglés' },
            { key: 'ciudadanas', name: 'Competencias Ciudadanas', desc: 'Sociales y ciudadanía' },
            { key: 'cientifico', name: 'Pensamiento Científico', desc: 'Ciencias naturales' },
          ].map((skill) => (
            <Link
              key={skill.key}
              to={`/chat?skill=${skill.key}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 bg-gradient-to-br ${SKILL_COLORS[skill.key]} rounded-xl flex items-center justify-center text-xl shadow-sm`}>
                  {SKILL_ICONS[skill.key]}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-sm group-hover:text-primary-700 transition-colors">
                    {skill.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">{skill.desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-gradient-to-r from-primary-600 to-accent-600 rounded-2xl p-6 text-white">
        <div className="flex items-start gap-4">
          <Brain className="w-10 h-10 opacity-90 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-lg">IA Adaptativa</h3>
            <p className="text-white/80 text-sm mt-1">
              Nuestro sistema analiza tu forma de aprender en tiempo real y adapta las explicaciones,
              dificultad y estilo de enseñanza a tus necesidades. Cuanto más practiques, mejor te conocerá.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
