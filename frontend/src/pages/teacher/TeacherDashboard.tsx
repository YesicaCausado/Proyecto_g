import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import type { Classroom } from '../../types';
import {
  Users,
  Plus,
  BookOpen,
  BarChart3,
  Loader2,
} from 'lucide-react';
import NeuronWelcome from '../../components/NeuronWelcome';
import NeuronAvatar from '../../components/NeuronAvatar';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await api.get('/classrooms/my-classes');
        setClassrooms(data.classrooms || []);
      } catch {
        setClassrooms([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalStudents = classrooms.reduce((sum, c) => sum + c.student_count, 0);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Neuron Welcome Banner */}
      <NeuronWelcome
        name={user?.full_name || user?.username || ''}
        subtitle="Gestiona tus clases y monitorea el progreso de tus estudiantes"
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#787774] font-medium">Clases activas</span>
            <BookOpen className="w-4 h-4 text-[#9B9A97]" />
          </div>
          <p className="text-2xl font-semibold text-[#37352F]">{classrooms.length}</p>
        </div>

        <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#787774] font-medium">Estudiantes totales</span>
            <Users className="w-4 h-4 text-[#9B9A97]" />
          </div>
          <p className="text-2xl font-semibold text-[#37352F]">{totalStudents}</p>
        </div>

        <div className="bg-white border border-[#E9E9E7] rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#787774] font-medium">Bots disponibles</span>
            <BarChart3 className="w-4 h-4 text-[#9B9A97]" />
          </div>
          <p className="text-2xl font-semibold text-[#37352F]">5</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#37352F]">Mis Clases</h2>
        <Link
          to="/classrooms/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Clase
        </Link>
      </div>

      {/* Classes list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#9B9A97]" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-12 bg-white border border-[#E9E9E7] rounded-md">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-[#E9E9E7]" />
          <p className="font-medium text-[#787774] text-sm">No tienes clases creadas</p>
          <p className="text-xs text-[#9B9A97] mt-1">Crea tu primera clase para empezar</p>
          <Link
            to="/classrooms/new"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear clase
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {classrooms.map((c) => (
            <Link
              key={c.id}
              to={`/classrooms/${c.id}`}
              className="bg-white border border-[#E9E9E7] rounded-md p-5 hover:border-[#9B9A97] transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-[#37352F] text-sm">{c.name}</h3>
                  <p className="text-xs text-[#787774] mt-0.5">{c.subject} • {c.grade || 'Sin grado'}</p>
                </div>
                <span className="text-xs bg-[#F7F6F3] text-[#787774] px-2.5 py-1 rounded border border-[#E9E9E7] font-mono">
                  {c.invite_code}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#9B9A97]">
                <Users className="w-3.5 h-3.5" />
                {c.student_count} estudiantes
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Motivacional */}
      <div
        className="relative rounded-xl overflow-hidden mt-6"
        style={{ height: '130px', background: 'linear-gradient(135deg, #ede9ff 0%, #ddd5ff 50%, #c8baff 100%)' }}
      >
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)' }} />
        <div className="relative z-10 flex flex-col justify-center h-full pl-6 pr-32">
          <p className="text-[14px] font-bold text-[#2e1065] leading-tight mb-1">¡Sigue adelante!</p>
          <p className="text-[11px] text-[#6d28d9] leading-snug opacity-85">
            Tu dedicación marca la diferencia en tus estudiantes 🌟
          </p>
        </div>
        <div className="absolute right-6 top-0 bottom-0 flex items-center justify-center pointer-events-none">
          <NeuronAvatar size={80} online variant="gradient" />
        </div>
      </div>

    </div>
  );
}
