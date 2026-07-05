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
      case 'high': return 'bg-[#FDEEEE] text-[#E03E3E]';
      case 'medium': return 'bg-[#FCF6E5] text-[#DFAB01]';
      default: return 'bg-[#EEF7F4] text-[#0F7B6C]';
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
    <div className="p-6 md:p-8 max-w-5xl mx-auto" style={{ fontFamily: "'Inter', sans-serif" }}>
      <button
        onClick={() => navigate('/classrooms')}
        className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] mb-6 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Mis Clases
      </button>

      {/* Header */}
      <div className="bg-white border border-[#E9E9E7] rounded-md p-6 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#37352F]">
              {stats?.classroom_name || `Clase #${id}`}
            </h1>
            <p className="text-[#787774] text-sm mt-1">
              {stats?.total_students || 0} estudiantes inscritos
            </p>
          </div>
          {classroom?.invite_code && (
            <button
              onClick={copyCode}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md text-sm font-mono hover:border-[#9B9A97] transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4 text-[#9B9A97]" />}
              <span className="tracking-widest text-[#37352F]">{classroom.invite_code}</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Estudiantes',   value: stats.total_students },
            { label: 'Activos',       value: stats.active_students },
            { label: 'Progreso Prom.', value: `${stats.avg_progress.toFixed(0)}%` },
            { label: 'En riesgo',     value: stats.students_at_risk },
          ].map((s) => (
            <div key={s.label} className="bg-white border border-[#E9E9E7] rounded-md p-4 text-center">
              <p className="text-xl font-semibold text-[#37352F]">{s.value}</p>
              <p className="text-xs text-[#787774] mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md p-1 mb-5">
        {[
          { key: 'students' as const, label: 'Estudiantes', icon: Users },
          { key: 'stats' as const, label: 'Estadísticas', icon: BarChart3 },
          { key: 'alerts' as const, label: 'Alertas', icon: AlertTriangle },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white text-[#37352F] border border-[#E9E9E7]'
                : 'text-[#787774] hover:text-[#37352F]'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
            {t.key === 'alerts' && alerts.length > 0 && (
              <span className="bg-[#37352F] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'students' && (
        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          {students.length === 0 ? (
            <div className="text-center py-12 text-[#787774]">
              <Users className="w-10 h-10 mx-auto mb-2 text-[#E9E9E7]" />
              <p className="text-sm">Aún no hay estudiantes inscritos</p>
              <p className="text-xs mt-1 text-[#9B9A97]">Comparte el código de invitación con tus estudiantes</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                <tr>
                  <th className="text-left text-[11px] font-medium text-[#787774] uppercase px-5 py-3">Estudiante</th>
                  <th className="text-center text-[11px] font-medium text-[#787774] uppercase px-3 py-3">Progreso</th>
                  <th className="text-center text-[11px] font-medium text-[#787774] uppercase px-3 py-3">Sesiones</th>
                  <th className="text-center text-[11px] font-medium text-[#787774] uppercase px-3 py-3">Riesgo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7]">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F7F6F3] transition-colors">
                    <td className="px-5 py-3">
                      <div>
                        <p className="font-medium text-[#37352F] text-sm">{s.student_name || s.student_username}</p>
                        <p className="text-xs text-[#9B9A97]">@{s.student_username}</p>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1 bg-[#E9E9E7] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#37352F] rounded-full"
                            style={{ width: `${Math.min(s.overall_progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#787774]">{s.overall_progress.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-sm text-[#787774]">{s.total_sessions}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-md font-medium ${riskColor(s.risk_level)}`}>
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
        <div className="bg-white border border-[#E9E9E7] rounded-md p-6">
          <h3 className="font-medium text-[#37352F] text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#9B9A97]" />
            Resumen de la Clase
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Total de sesiones',     value: stats.total_sessions },
              { label: 'Puntuación promedio',   value: stats.avg_score.toFixed(1) },
              { label: 'Estudiantes activos',   value: `${stats.active_students} / ${stats.total_students}` },
              { label: 'Estudiantes en riesgo', value: stats.students_at_risk },
            ].map((s) => (
              <div key={s.label} className="p-4 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md">
                <p className="text-xs text-[#787774]">{s.label}</p>
                <p className="text-lg font-semibold text-[#37352F] mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'alerts' && (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-6">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-[#787774]">
              <Check className="w-8 h-8 mx-auto mb-2 text-[#0F7B6C]" />
              <p className="font-medium text-sm">Sin alertas</p>
              <p className="text-xs mt-1 text-[#9B9A97]">Todos los estudiantes van bien por ahora</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-4 bg-[#FDEEEE] border border-[#F4BDBD] rounded-md">
                  <AlertTriangle className="w-4 h-4 text-[#E03E3E] flex-shrink-0" />
                  <div>
                    <p className="font-medium text-[#37352F] text-sm">
                      {a.student_name || a.student_username} necesita atención
                    </p>
                    <p className="text-xs text-[#E03E3E] mt-0.5">
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
