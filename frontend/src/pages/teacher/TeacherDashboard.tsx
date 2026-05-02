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
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {greeting()}, Prof. {user?.full_name?.split(' ')[0] || user?.username} 👋
        </h1>
        <p className="text-gray-500 mt-1">Panel de control del profesor</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{classrooms.length}</p>
              <p className="text-sm text-gray-500">Clases activas</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              <p className="text-sm text-gray-500">Estudiantes totales</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">5</p>
              <p className="text-sm text-gray-500">Bots disponibles</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Mis Clases</h2>
        <Link
          to="/classrooms/new"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva Clase
        </Link>
      </div>

      {/* Classes list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        </div>
      ) : classrooms.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-600">No tienes clases creadas</p>
          <p className="text-sm text-gray-400 mt-1">Crea tu primera clase para empezar</p>
          <Link
            to="/classrooms/new"
            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Crear clase
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {classrooms.map((c) => (
            <Link
              key={c.id}
              to={`/classrooms/${c.id}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-primary-300 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{c.name}</h3>
                  <p className="text-sm text-gray-500">{c.subject} • {c.grade || 'Sin grado'}</p>
                </div>
                <span className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-mono">
                  {c.invite_code}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {c.student_count} estudiantes
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
