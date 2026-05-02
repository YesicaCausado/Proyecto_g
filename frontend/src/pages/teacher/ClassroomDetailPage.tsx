import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { Classroom, Enrollment, ClassroomStats } from '../../types';
import {
  ArrowLeft,
  Users,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

export default function ClassroomDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<Enrollment[]>([]);
  const [stats, setStats] = useState<ClassroomStats | null>(null);
  const [alerts, setAlerts] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<'students' | 'stats' | 'alerts'>('students');

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [studentsRes, statsRes, alertsRes] = await Promise.all([
          api.get(`/classrooms/${id}/students`),
          api.get(`/classrooms/${id}/stats`),
          api.get(`/classrooms/${id}/alerts`).catch(() => ({ data: { alerts: [] } })),
        ]);
        setStudents(studentsRes.data.students || studentsRes.data || []);
        setStats(statsRes.data);
        setAlerts(alertsRes.data.alerts || alertsRes.data || []);

        // Get classroom info from stats
        if (statsRes.data) {
          setClassroom({
            id: Number(id),
            teacher_id: 0,
            name: statsRes.data.classroom_name,
            description: '',
            subject: '',
            grade: '',
            invite_code: '',
            is_active: true,
            max_students: 40,
            student_count: statsRes.data.total_students,
            created_at: '',
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id]);

  const copyCode = () => {
    if (classroom?.invite_code) {
      navigator.clipboard.writeText(classroom.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const riskColor = (level: string) => {
    switch (level) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      default: return 'bg-green-100 text-green-700';
    }
  };

  const riskLabel = (level: string) => {
    switch (level) {
      case 'high': return 'Alto riesgo';
      case 'medium': return 'Riesgo medio';
      default: return 'Bien';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <button
        onClick={() => navigate('/classrooms')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Mis Clases
      </button>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {stats?.classroom_name || `Clase #${id}`}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {stats?.total_students || 0} estudiantes inscritos
            </p>
          </div>
          {classroom?.invite_code && (
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg text-sm font-mono hover:bg-gray-200 transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
              <span className="tracking-widest">{classroom.invite_code}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary-600">{stats.total_students}</p>
            <p className="text-xs text-gray-500">Estudiantes</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats.active_students}</p>
            <p className="text-xs text-gray-500">Activos</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats.avg_progress.toFixed(0)}%</p>
            <p className="text-xs text-gray-500">Progreso Prom.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.students_at_risk}</p>
            <p className="text-xs text-gray-500">En riesgo</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
        {[
          { key: 'students' as const, label: 'Estudiantes', icon: Users },
          { key: 'stats' as const, label: 'Estadísticas', icon: BarChart3 },
          { key: 'alerts' as const, label: 'Alertas', icon: AlertTriangle },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.key === 'alerts' && alerts.length > 0 && (
              <span className="bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'students' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {students.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>Aún no hay estudiantes inscritos</p>
              <p className="text-sm mt-1">Comparte el código de invitación con tus estudiantes</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase px-5 py-3">Estudiante</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3">Progreso</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3">Sesiones</th>
                  <th className="text-center text-xs font-medium text-gray-500 uppercase px-3 py-3">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{s.student_name || s.student_username}</p>
                        <p className="text-xs text-gray-400">@{s.student_username}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${Math.min(s.overall_progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600">{s.overall_progress.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-gray-600">{s.total_sessions}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${riskColor(s.risk_level)}`}>
                        {riskLabel(s.risk_level)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'stats' && stats && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            Resumen de la Clase
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Total de sesiones</p>
              <p className="text-xl font-bold text-gray-900">{stats.total_sessions}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Puntuación promedio</p>
              <p className="text-xl font-bold text-gray-900">{stats.avg_score.toFixed(1)}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Estudiantes activos</p>
              <p className="text-xl font-bold text-gray-900">{stats.active_students} / {stats.total_students}</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Estudiantes en riesgo</p>
              <p className="text-xl font-bold text-amber-600">{stats.students_at_risk}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Check className="w-10 h-10 mx-auto mb-2 text-green-400" />
              <p className="font-medium">Sin alertas</p>
              <p className="text-sm mt-1">Todos los estudiantes van bien por ahora</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-red-800 text-sm">
                      {a.student_name || a.student_username} necesita atención
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Progreso: {a.overall_progress.toFixed(0)}% • Sesiones: {a.total_sessions} • Riesgo: {riskLabel(a.risk_level)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
