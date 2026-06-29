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

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div className="pb-6 mb-6 border-b border-[#E0E0E0]">
        <h1 className="text-2xl font-semibold text-[#2F3437]">
          {greeting()}, Prof. {user?.full_name?.split(' ')[0] || user?.username} 👋
        </h1>
        <p className="text-[#707070] text-sm mt-1">Panel de control del profesor</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-[#E0E0E0] rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#707070] font-medium">Clases activas</span>
            <BookOpen className="w-4 h-4 text-[#9B9B9B]" />
          </div>
          <p className="text-2xl font-semibold text-[#2F3437]">{classrooms.length}</p>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#707070] font-medium">Estudiantes totales</span>
            <Users className="w-4 h-4 text-[#9B9B9B]" />
          </div>
          <p className="text-2xl font-semibold text-[#2F3437]">{totalStudents}</p>
        </div>

        <div className="bg-white border border-[#E0E0E0] rounded-md p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#707070] font-medium">Bots disponibles</span>
            <BarChart3 className="w-4 h-4 text-[#9B9B9B]" />
          </div>
          <p className="text-2xl font-semibold text-[#2F3437]">5</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[#2F3437]">Mis Clases</h2>
        <Link
          to="/classrooms/new"
          className="flex items-center gap-2 px-4 py-2 bg-[#2F3437] text-white rounded-md text-sm font-medium hover:bg-[#454A4D] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Clase
        </Link>
      </div>

      {/* Classes list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[#9B9B9B]" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-12 bg-white border border-[#E0E0E0] rounded-md">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-[#D5D5D5]" />
          <p className="font-medium text-[#707070] text-sm">No tienes clases creadas</p>
          <p className="text-xs text-[#9B9B9B] mt-1">Crea tu primera clase para empezar</p>
          <Link
            to="/classrooms/new"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-[#2F3437] text-white rounded-md text-sm font-medium hover:bg-[#454A4D] transition-colors"
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
              className="bg-white border border-[#E0E0E0] rounded-md p-5 hover:border-[#9B9B9B] transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-[#2F3437] text-sm">{c.name}</h3>
                  <p className="text-xs text-[#707070] mt-0.5">{c.subject} • {c.grade || 'Sin grado'}</p>
                </div>
                <span className="text-xs bg-[#F7F6F3] text-[#707070] px-2.5 py-1 rounded border border-[#E0E0E0] font-mono">
                  {c.invite_code}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-[#9B9B9B]">
                <Users className="w-3.5 h-3.5" />
                {c.student_count} estudiantes
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
