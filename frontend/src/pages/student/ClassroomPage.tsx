import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { Classroom } from '../../types';
import {
  ArrowLeft,
  Users,
  GraduationCap,
  BookOpen,
  Loader2,
  Clock,
  Calendar,
  Bot,
  MessageSquare,
  Sparkles,
} from 'lucide-react';

interface ClassroomBot {
  bot_id: number;
  name: string;
  description: string;
  category: string | null;
  is_required: boolean;
  order_index: number;
}

interface StudentClassroomDetail extends Classroom {
  color?: string;
  teacher_name: string;
  // Progreso del estudiante
  overall_progress: number;
  total_sessions: number;
  total_time_minutes: number;
  average_score: number;
  risk_level: string;
  last_activity: string | null;
  bots: ClassroomBot[];
}

export default function ClassroomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<StudentClassroomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/classrooms/${id}/student-detail`);
        setClassroom(data);
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'No se pudo cargar el detalle de la clase');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const accent = classroom?.color || '#2E6FDB';

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const d = new Date(value);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-[#9B9A97]" />
      </div>
    );
  }

  if (error || !classroom) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
        <button
          onClick={() => navigate('/my-classes')}
          className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Mis Clases
        </button>
        <div className="bg-white border border-[#E9E9E7] rounded-md p-8 text-center">
          <p className="font-medium text-[#37352F]">{error || 'Clase no disponible'}</p>
          <button
            onClick={() => navigate('/my-classes')}
            className="mt-4 px-4 py-2 bg-[#37352F] text-white rounded-md text-sm hover:bg-[#2F2D2B] transition-colors"
          >
            Volver a Mis Clases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <button
        onClick={() => navigate('/my-classes')}
        className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] mb-5 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Mis Clases
      </button>

      {/* Banner estilo classroom */}
      <div
        className="rounded-lg overflow-hidden mb-6 shadow-sm"
        style={{ backgroundColor: accent }}
      >
        <div className="p-6 md:p-8">
          <h1 className="text-2xl font-bold text-white">{classroom.name}</h1>
          <p className="text-white/90 text-sm mt-1">
            {classroom.subject}
            {classroom.grade ? ` • ${classroom.grade}` : ''}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-white/85 text-xs mt-3">
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5" />
              {classroom.teacher_name || 'Profesor'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              {classroom.student_count} estudiantes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              Creada el {formatDate(classroom.created_at)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Acerca de */}
          <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
            <h2 className="font-medium text-[#37352F] text-sm flex items-center gap-2 mb-3">
              <BookOpen className="w-4 h-4 text-[#9B9A97]" />
              Acerca de esta clase
            </h2>
            {classroom.description ? (
              <p className="text-sm text-[#37352F] leading-relaxed">{classroom.description}</p>
            ) : (
              <p className="text-xs text-[#9B9A97]">El profesor aún no ha añadido una descripción.</p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#F7F6F3] rounded-md">
                <p className="text-[11px] text-[#787774] uppercase tracking-wide">Materia</p>
                <p className="text-sm font-medium text-[#37352F] mt-0.5">{classroom.subject}</p>
              </div>
              <div className="p-3 bg-[#F7F6F3] rounded-md">
                <p className="text-[11px] text-[#787774] uppercase tracking-wide">Grado</p>
                <p className="text-sm font-medium text-[#37352F] mt-0.5">{classroom.grade || '—'}</p>
              </div>
            </div>
          </section>

          {/* Tutores asignados */}
          <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
            <h2 className="font-medium text-[#37352F] text-sm flex items-center gap-2 mb-4">
              <Bot className="w-4 h-4 text-[#9B9A97]" />
              Tutores de esta clase
            </h2>
            {classroom.bots.length === 0 ? (
              <p className="text-xs text-[#9B9A97]">
                El profesor aún no ha asignado tutores a esta clase.
              </p>
            ) : (
              <div className="space-y-3">
                {classroom.bots.map((bot) => (
                  <button
                    key={bot.bot_id}
                    onClick={() =>
                      navigate(`/chat?bot_id=${bot.bot_id}&bot_name=${encodeURIComponent(bot.name)}`)
                    }
                    className="w-full text-left flex items-center gap-3 p-4 border border-[#E9E9E7] rounded-md hover:border-[#C9C7C4] hover:bg-[#F7F6F3] transition-colors group"
                  >
                    <div
                      className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: accent }}
                    >
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#37352F] text-sm flex items-center gap-2">
                        {bot.name}
                        {bot.is_required && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FCF6E5] text-[#B58900] font-medium">
                            Requerido
                          </span>
                        )}
                      </p>
                      {bot.description && (
                        <p className="text-xs text-[#787774] mt-0.5 line-clamp-2">{bot.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-[#9B9A97] flex items-center gap-1 group-hover:text-[#37352F]">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chatear
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Barra lateral */}
        <aside className="space-y-6">
          {/* Progreso del estudiante */}
          <section className="bg-white border border-[#E9E9E7] rounded-md p-6">
            <h2 className="font-medium text-[#37352F] text-sm mb-4">Tu progreso</h2>
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[#787774]">Avance general</span>
                <span className="font-medium text-[#37352F]">
                  {classroom.overall_progress.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 bg-[#E9E9E7] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(classroom.overall_progress, 100)}%`, backgroundColor: accent }}
                />
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#787774] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Sesiones
                </span>
                <span className="font-medium text-[#37352F]">{classroom.total_sessions}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#787774] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Tiempo
                </span>
                <span className="font-medium text-[#37352F]">
                  {Math.round(classroom.total_time_minutes)} min
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#787774] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Promedio
                </span>
                <span className="font-medium text-[#37352F]">
                  {classroom.average_score.toFixed(1)}
                </span>
              </div>
            </div>
            <button
              onClick={() =>
                navigate(
                  `/chat${
                    classroom.bots[0]
                      ? `?bot_id=${classroom.bots[0].bot_id}&bot_name=${encodeURIComponent(classroom.bots[0].name)}`
                      : ''
                  }`
                )
              }
              className="mt-5 w-full px-4 py-2.5 rounded-md text-sm font-medium text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: accent }}
            >
              Empezar a aprender
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}