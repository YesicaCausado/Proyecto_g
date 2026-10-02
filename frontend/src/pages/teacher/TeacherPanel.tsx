import { useState, useEffect } from 'react';
import {
  Plus,
  Copy,
  Share2,
  Users,
  BookOpen,
  MoreVertical,
  Check,
  ChevronLeft,
  ClipboardList,
  UserCheck,
  Trash2,
  Eye,
  Loader2,
} from 'lucide-react';

import api from '../../services/api';
import { useLicense } from '../../context/LicenseContext';

// ============================================================
// TIPOS
// ============================================================

interface Group {
  id: string;
  name: string;
  subject: string;
  grade: string;
  description: string;
  color: string;
  students: number;
  maxStudents: number;
  code: string;
}

interface StudentRow {
  id: string;
  name: string;
  email: string;
  avg: number | null;
  last: string;
  status: 'risk' | 'active';
}

interface RawGroup {
  id: string | number;
  name?: string;
  subject?: string;
  grade?: string;
  description?: string;
  color?: string;
  student_count?: number;
  max_students?: number;
  invite_code?: string;
  code?: string;
}

interface RawStudent {
  id?: number;
  student_id?: string | number;
  student_name?: string;
  student_username?: string;
  student_email?: string | null;
  average_score?: number | null;
  total_sessions?: number;
  last_activity?: string | null;
  risk_level?: string;
}

interface ClassroomStats {
  total_students: number;
  active_students: number;
  avg_score: number;
  students_at_risk: number;
}

type Tab = 'inicio' | 'estudiantes';

// ============================================================
// COLORES
// ============================================================

const COLORS = [
  { name: 'Azul', value: '#2E6FDB' },
  { name: 'Verde', value: '#0F7B6C' },
  { name: 'Naranja', value: '#D9730D' },
  { name: 'Morado', value: '#6940A5' },
  { name: 'Rojo', value: '#E03E3E' },
  { name: 'Teal', value: '#0B6E99' },
];

// ============================================================
// CONVERSIÓN DE PROMEDIO
// ============================================================
//
// El componente trabaja internamente con escala 0-10.
//
// Si el backend devuelve 0-100, convertimos.
// Si ya devuelve 0-10, lo dejamos igual.
//

function normalizeScore(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) {
    return 0;
  }

  const normalized = value > 10 ? value / 10 : value;

  return Math.round(normalized * 10) / 10;
}

// ============================================================
// MAPEO DE GRUPO
// ============================================================

function mapGroup(raw: RawGroup): Group {
  return {
    id: String(raw.id),
    name: raw.name ?? 'Sin nombre',
    subject: raw.subject ?? 'Sin materia',
    grade: raw.grade ?? '',
    description: raw.description ?? '',
    color: raw.color ?? COLORS[0].value,
    students: raw.student_count ?? 0,
    maxStudents: raw.max_students ?? 40,

    code: raw.invite_code ?? raw.code ?? '',

  };
}

// ============================================================
// MAPEO DE ESTUDIANTE
// ============================================================

function mapStudent(raw: RawStudent): StudentRow {
  const average = raw.total_sessions
    ? normalizeScore(raw.average_score)
    : null;

  const lastActivityDate = raw.last_activity
    ? new Date(raw.last_activity)
    : null;

  const isRisk =
    raw.risk_level === 'medium' ||
    raw.risk_level === 'high';

  return {
    id: String(raw.student_id ?? raw.id ?? ''),
    name: raw.student_name ?? raw.student_username ?? '—',
    email: raw.student_email ?? 'Sin correo registrado',

    avg: average,

    last:
      lastActivityDate && !Number.isNaN(lastActivityDate.getTime())
        ? lastActivityDate.toLocaleDateString('es-CO')
        : 'Sin actividad',

    status: isRisk ? 'risk' : 'active',
  };
}

// ============================================================
// DETALLE DEL GRUPO
// ============================================================

function GroupDetail({
  group,
  onBack,
}: {
  group: Group;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<Tab>('inicio');

  const [students, setStudents] = useState<StudentRow[]>([]);

  const [loadingStudents, setLoadingStudents] =
    useState(false);

  const [studentsError, setStudentsError] =
    useState('');
  const [stats, setStats] = useState<ClassroomStats | null>(null);

  useEffect(() => {
    let cancelled = false;

    api.get<ClassroomStats>(`/classrooms/${group.id}/stats`)
      .then(({ data }) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch((error: unknown) => {
        console.error('Error cargando estadísticas del grupo:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [group.id]);

  // ----------------------------------------------------------
  // Cargar estudiantes
  // ----------------------------------------------------------

  useEffect(() => {
    if (tab !== 'estudiantes') {
      return;
    }

    let cancelled = false;

    const loadStudents = async () => {
      setLoadingStudents(true);
      setStudentsError('');

      try {
        const response = await api.get<RawStudent[]>(
          `/classrooms/${group.id}/students`
        );

        if (cancelled) {
          return;
        }

        setStudents(response.data.map(mapStudent));
      } catch (error) {
        console.error(
          'Error cargando estudiantes:',
          error
        );

        if (!cancelled) {
          setStudents([]);
          setStudentsError(
            'No se pudieron cargar los estudiantes.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingStudents(false);
        }
      }
    };

    loadStudents();

    return () => {
      cancelled = true;
    };
  }, [tab, group.id]);

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="space-y-4">

      {/* =====================================================
          BOTÓN VOLVER
      ====================================================== */}

      <div className="flex items-center gap-3">

        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#787774] hover:text-[#37352F] transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />

          Mis Grupos
        </button>

      </div>

      {/* =====================================================
          HEADER DEL GRUPO
      ====================================================== */}

      <div className="flex items-center gap-4 bg-white border border-[#E9E9E7] rounded-lg p-5">

        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0"
          style={{
            background: group.color,
          }}
        >
          {group.name.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">

          <h2 className="text-lg font-bold text-[#191919] truncate">
            {group.name}
          </h2>

          <p className="text-sm text-[#787774]">
            {group.subject}

            {group.grade && (
              <> · Grado {group.grade}</>
            )}
          </p>

        </div>

        <div className="text-right">

          <p className="text-xs text-[#787774]">
            Código
          </p>

          <code className="text-sm font-mono font-bold text-[#191919] bg-[#F7F6F3] px-2 py-0.5 rounded">
            {group.code || '—'}
          </code>

        </div>

      </div>

      {/* =====================================================
          TABS
      ====================================================== */}

      <div className="flex border-b border-[#E9E9E7]">

        {[
          {
            id: 'inicio' as Tab,
            label: 'Inicio',
            icon: BookOpen,
          },
          {
            id: 'estudiantes' as Tab,
            label: 'Estudiantes',
            icon: Users,
          },
        ].map((item) => {

          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === item.id
                  ? 'border-[#2E6FDB] text-[#2E6FDB]'
                  : 'border-transparent text-[#787774] hover:text-[#37352F]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />

              {item.label}
            </button>
          );
        })}

      </div>

      {/* =====================================================
          INICIO
      ====================================================== */}

      {tab === 'inicio' && (

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">

          {[
            {
              label: 'Estudiantes',
              value: group.students,
              icon: Users,
            },

            {
              label: 'Promedio',
              value: stats?.total_students
                ? `${normalizeScore(stats.avg_score)}/10`
                : '—',
              icon: ClipboardList,
            },

            {
              label: 'Estudiantes activos',
              value: stats?.active_students ?? '—',
              icon: ClipboardList,
            },

            {
              label: 'Estudiantes en riesgo',
              value: stats?.students_at_risk ?? '—',
              icon: UserCheck,
            },

          ].map((card) => {

            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="bg-white border border-[#E9E9E7] rounded-lg p-4"
              >

                <Icon className="w-4 h-4 text-[#787774] mb-2" />

                <p className="text-xl font-bold text-[#191919]">
                  {card.value}
                </p>

                <p className="text-xs text-[#787774]">
                  {card.label}
                </p>

              </div>
            );
          })}

          <div className="col-span-full bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4">

            <p className="text-sm text-[#787774]">

              Descripción:{' '}

              <span className="text-[#37352F]">
                {group.description || 'Sin descripción'}
              </span>

            </p>

          </div>

        </div>
      )}

      {/* =====================================================
          ESTUDIANTES
      ====================================================== */}

      {tab === 'estudiantes' && (

        <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">

          {loadingStudents && (

            <div className="flex items-center justify-center py-8 gap-2 text-sm text-[#787774]">

              <Loader2 className="w-4 h-4 animate-spin" />

              Cargando estudiantes…

            </div>
          )}

          {!loadingStudents && studentsError && (

            <div className="py-8 text-center">

              <p className="text-sm text-[#E03E3E]">
                {studentsError}
              </p>

            </div>
          )}

          {!loadingStudents &&
            !studentsError && (

              <div className="overflow-x-auto">

                <table className="w-full text-sm">

                  <thead>

                    <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">

                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">
                        Estudiante
                      </th>

                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">
                        Correo
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">
                        Promedio
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">
                        Última conexión
                      </th>

                      <th className="px-4 py-3 text-center text-xs font-semibold text-[#787774] uppercase">
                        Estado
                      </th>

                    </tr>

                  </thead>

                  <tbody>

                    {students.map((student) => (

                      <tr
                        key={student.id}
                        className="border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50 transition-colors"
                      >

                        <td className="px-4 py-3">

                          <div className="flex items-center gap-2">

                            <div className="w-7 h-7 rounded-full bg-[#EEF3FD] text-[#2E6FDB] flex items-center justify-center text-xs font-bold flex-shrink-0">

                              {student.name
                                .charAt(0)
                                .toUpperCase()}

                            </div>

                            <span className="font-medium text-[#191919]">
                              {student.name}
                            </span>

                          </div>

                        </td>

                        <td className="px-4 py-3 text-[#787774] text-xs">
                          {student.email}
                        </td>

                        <td className="px-4 py-3 text-center">

                          <span
                            className={`text-sm font-bold ${
                              student.avg === null
                                ? 'text-[#787774]'
                                : student.avg < 4
                                ? 'text-[#E03E3E]'
                                : student.avg < 7
                                  ? 'text-[#D9730D]'
                                  : 'text-[#0F7B6C]'
                            }`}
                          >
                            {student.avg === null ? 'Sin datos' : `${student.avg}/10`}
                          </span>

                        </td>

                        <td className="px-4 py-3 text-center text-xs text-[#787774]">
                          {student.last}
                        </td>

                        <td className="px-4 py-3 text-center">

                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              student.status === 'risk'
                                ? 'bg-red-50 text-[#E03E3E]'
                                : 'bg-emerald-50 text-[#0F7B6C]'
                            }`}
                          >
                            {student.status === 'risk'
                              ? 'En riesgo'
                              : 'Activo'}
                          </span>

                        </td>

                      </tr>
                    ))}

                    {students.length === 0 && (

                      <tr>

                        <td
                          colSpan={5}
                          className="text-center py-8 text-xs text-[#787774]"
                        >
                          Sin estudiantes inscritos aún.
                        </td>

                      </tr>
                    )}

                  </tbody>

                </table>

              </div>
            )}

        </div>
      )}

    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function MisGruposTab() {
  const { licenseInfo: license } = useLicense();

  const [groups, setGroups] =
    useState<Group[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState('');

  const [createError, setCreateError] =
    useState('');

  const [creating, setCreating] =
    useState(false);

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [showModal, setShowModal] =
    useState(false);

  const [copiedId, setCopiedId] =
    useState<string | null>(null);

  const [menuId, setMenuId] =
    useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] =
    useState<string | null>(null);

  // ==========================================================
  // FORMULARIO
  // ==========================================================

  const [form, setForm] = useState({
    name: '',
    subject: '',
    grade: '',
    description: '',
    color: COLORS[0].value,
  });

  // ==========================================================
  // CARGAR GRUPOS
  // ==========================================================

  useEffect(() => {

    let cancelled = false;

    const loadGroups = async () => {

      setLoading(true);
      setLoadError('');

      try {

        const response =
          await api.get('/classrooms/my-classes');

        if (cancelled) {
          return;
        }

        const rawClassrooms =
          Array.isArray(response.data)
            ? response.data
            : response.data?.classrooms ?? [];

        setGroups(
          rawClassrooms.map(mapGroup)
        );

      } catch (error) {

        console.error(
          'Error cargando grupos:',
          error
        );

        if (!cancelled) {

          setGroups([]);

          setLoadError(
            'No se pudieron cargar los grupos.'
          );
        }

      } finally {

        if (!cancelled) {
          setLoading(false);
        }

      }
    };

    loadGroups();

    return () => {
      cancelled = true;
    };

  }, []);

  // ==========================================================
  // LICENCIA
  // ==========================================================

  const maxGroups = Math.max(Number(license?.groups_limit ?? 10), 0);

  const usedGroups =
    groups.length;

  const canCreateGroup =
    usedGroups < maxGroups;

  // ==========================================================
  // GRUPO SELECCIONADO
  // ==========================================================

  const selected =
    selectedId
      ? groups.find(
          group => group.id === selectedId
        ) ?? null
      : null;

  // ==========================================================
  // COPIAR CÓDIGO
  // ==========================================================

  const copyCode = async (
    id: string,
    code: string
  ) => {

    if (!code) {
      return;
    }

    try {

      await navigator.clipboard.writeText(code);

      setCopiedId(id);

      window.setTimeout(() => {
        setCopiedId(null);
      }, 2000);

    } catch (error) {

      console.error(
        'No se pudo copiar el código:',
        error
      );

    }
  };

  // ==========================================================
  // ELIMINAR GRUPO
  // ==========================================================

  const deleteGroup = async (
    id: string
  ) => {

    if (actionLoadingId) {
      return;
    }

    const confirmed =
      window.confirm(
        '¿Archivar esta clase? Dejará de aparecer entre tus clases activas.'
      );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(id);

    try {

      await api.delete(
        `/classrooms/${id}`
      );

      setGroups(prev =>
        prev.filter(
          group => group.id !== id
        )
      );

      if (selectedId === id) {
        setSelectedId(null);
      }

    } catch (error) {

      console.error(
        'Error eliminando grupo:',
        error
      );

      /*
       * MUY IMPORTANTE:
       * No eliminamos el grupo del estado
       * si el backend falló.
       */

      alert(
        'No se pudo eliminar el grupo. Intenta nuevamente.'
      );

    } finally {

      setActionLoadingId(null);

    }
  };

  // ==========================================================
  // RESET FORMULARIO
  // ==========================================================

  const resetForm = () => {

    setForm({
      name: '',
      subject: '',
      grade: '',
      description: '',
      color: COLORS[0].value,
    });

    setCreateError('');
  };

  // ==========================================================
  // CREAR GRUPO
  // ==========================================================

  const handleCreate = async () => {

    if (!form.name.trim()) {
      setCreateError(
        'El nombre del grupo es obligatorio.'
      );
      return;
    }

    if (!form.subject.trim()) {
      setCreateError(
        'La materia es obligatoria.'
      );
      return;
    }

    if (!canCreateGroup) {
      setCreateError(
        'Has alcanzado el límite de grupos de tu licencia.'
      );
      return;
    }

    if (creating) {
      return;
    }

    setCreating(true);
    setCreateError('');

    try {

      const response =
        await api.post(
          '/classrooms/',
          {
            name: form.name.trim(),
            subject: form.subject.trim(),
            grade: form.grade.trim(),
            description: form.description.trim(),
            max_students: 40,
            color: form.color,
          }
        );

      const createdGroup =
        mapGroup(response.data);

      setGroups(prev => [
        createdGroup,
        ...prev,
      ]);

      setShowModal(false);

      resetForm();

    } catch (error: any) {

      console.error(
        'Error creando grupo:',
        error
      );

      const detail =
        error?.response?.data?.detail;

      setCreateError(
        typeof detail === 'string'
          ? detail
          : 'Error al crear el grupo. Intenta de nuevo.'
      );

    } finally {

      setCreating(false);

    }
  };

  // ==========================================================
  // SI HAY GRUPO SELECCIONADO
  // ==========================================================

  if (selected) {

    return (
      <GroupDetail
        group={selected}
        onBack={() =>
          setSelectedId(null)
        }
      />
    );
  }

  // ==========================================================
  // RENDER PRINCIPAL
  // ==========================================================

  return (

    <div className="space-y-5">

      {/* =====================================================
          LOADING
      ====================================================== */}

      {loading && (

        <div className="flex items-center justify-center py-6 gap-2 text-sm text-[#787774]">

          <Loader2 className="w-4 h-4 animate-spin" />

          Cargando grupos…

        </div>
      )}

      {/* =====================================================
          ERROR CARGANDO
      ====================================================== */}

      {!loading && loadError && (

        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">

          <p className="text-sm text-[#E03E3E]">
            {loadError}
          </p>

        </div>
      )}

      {/* =====================================================
          BARRA SUPERIOR
      ====================================================== */}

      <div className="flex items-center justify-between gap-4">

        <div>

          <p className="text-sm text-[#787774]">

            <span className="font-semibold text-[#191919]">
              {usedGroups}
            </span>{' '}

            de {maxGroups} grupos — plan{' '}

            {license?.license_type ?? 'básica'}

          </p>

          <div className="mt-1 w-40 h-1.5 bg-[#E9E9E7] rounded-full overflow-hidden">

            <div
              className="h-full bg-[#2E6FDB] rounded-full transition-all"
              style={{
                width: `${Math.min(
                  (usedGroups / maxGroups) * 100,
                  100
                )}%`,
              }}
            />

          </div>

        </div>

        <button
          onClick={() => {
            if (canCreateGroup) {
              setCreateError('');
              setShowModal(true);
            }
          }}
          disabled={!canCreateGroup}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >

          <Plus className="w-4 h-4" />

          Crear Grupo

        </button>

      </div>

      {/* =====================================================
          GRID
      ====================================================== */}

      {!loading && !loadError && groups.length === 0 ? (

        <div className="bg-white border border-dashed border-[#E9E9E7] rounded-xl p-12 text-center">

          <BookOpen className="w-12 h-12 text-[#E9E9E7] mx-auto mb-3" />

          <p className="text-sm font-medium text-[#787774]">
            No tienes grupos creados
          </p>

          <button
            onClick={() => {

              if (!canCreateGroup) {
                return;
              }

              setCreateError('');
              setShowModal(true);
            }}
            disabled={!canCreateGroup}
            className="mt-3 text-sm text-[#2E6FDB] hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {canCreateGroup
              ? 'Crear mi primer grupo'
              : 'Has alcanzado el límite de grupos'}
          </button>

        </div>

      ) : (

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

          {groups.map((group) => {

            const isLoading =
              actionLoadingId === group.id;

            return (

              <div
                key={group.id}
                className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden hover:shadow-sm transition-all"
              >

                {/* =================================================
                    COLOR
                ================================================== */}

                <div
                  className="h-1.5 w-full"
                  style={{
                    background: group.color,
                  }}
                />

                <div className="p-5">

                  {/* =================================================
                      HEADER
                  ================================================== */}

                  <div className="flex items-start justify-between mb-3">

                    <button
                      onClick={() =>
                        setSelectedId(group.id)
                      }
                      className="flex items-center gap-3 text-left flex-1 min-w-0"
                    >

                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                        style={{
                          background: group.color,
                        }}
                      >
                        {group.name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div className="min-w-0">

                        <p className="font-semibold text-[#191919] text-sm truncate">
                          {group.name}
                        </p>

                        <p className="text-xs text-[#787774]">
                          {group.subject}

                          {group.grade && (
                            <> · {group.grade}</>
                          )}
                        </p>

                      </div>

                    </button>

                    {/* =================================================
                        MENU
                    ================================================== */}

                    <div className="relative">

                      <button
                        onClick={() =>
                          setMenuId(
                            menuId === group.id
                              ? null
                              : group.id
                          )
                        }
                        disabled={isLoading}
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774] disabled:opacity-50"
                      >

                        {isLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MoreVertical className="w-4 h-4" />
                        )}

                      </button>

                      {menuId === group.id && (

                        <div
                          className="absolute right-0 top-8 bg-white border border-[#E9E9E7] rounded-lg shadow-lg z-20 w-40 py-1"
                          onMouseLeave={() =>
                            setMenuId(null)
                          }
                        >

                          <button
                            onClick={() => {
                              setSelectedId(group.id);
                              setMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#37352F] hover:bg-[#F7F6F3]"
                          >

                            <Eye className="w-3.5 h-3.5" />

                            Ver grupo

                          </button>

                          <hr className="my-1 border-[#E9E9E7]" />

                          <button
                            onClick={async () => {

                              setMenuId(null);

                              await deleteGroup(
                                group.id
                              );

                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E03E3E] hover:bg-red-50"
                          >

                            <Trash2 className="w-3.5 h-3.5" />

                            Archivar clase

                          </button>

                        </div>
                      )}

                    </div>

                  </div>

                  {/* =================================================
                      STATS
                  ================================================== */}

                  <div className="flex items-center gap-4 mb-3 text-xs text-[#787774]">

                    <span className="flex items-center gap-1">

                      <Users className="w-3 h-3" />

                      {group.students}/{group.maxStudents} cupos

                    </span>

                  </div>

                  {/* =================================================
                      CÓDIGO
                  ================================================== */}

                  <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-2.5">

                    <p className="text-[10px] text-[#AEADAB] mb-1 font-medium">
                      CÓDIGO DE INVITACIÓN
                    </p>

                    <div className="flex items-center justify-between gap-2">

                      <code className="font-mono text-xs font-bold text-[#191919] tracking-wider">

                        {group.code || 'Sin código'}

                      </code>

                      <div className="flex gap-1">

                        {/* COPIAR */}

                        <button
                          onClick={() =>
                            copyCode(
                              group.id,
                              group.code
                            )
                          }
                          disabled={!group.code}
                          title="Copiar código"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-[#787774] hover:text-[#2E6FDB] transition-colors disabled:opacity-40"
                        >

                          {copiedId === group.id ? (
                            <Check className="w-3.5 h-3.5 text-[#0F7B6C]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}

                        </button>

                        {/* COMPARTIR */}

                        <button
                          onClick={async () => {

                            if (!group.code) {
                              return;
                            }

                            if (!navigator.share) {

                              await copyCode(
                                group.id,
                                group.code
                              );

                              return;
                            }

                            try {

                              await navigator.share({
                                title: group.name,
                                text:
                                  `Únete a ${group.name} con el código: ${group.code}`,
                                url:
                                  window.location.href,
                              });

                            } catch (error) {

                              console.log(
                                'Compartir cancelado'
                              );

                            }

                          }}
                          disabled={!group.code}
                          title="Compartir"
                          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-[#787774] hover:text-[#2E6FDB] transition-colors disabled:opacity-40"
                        >

                          <Share2 className="w-3.5 h-3.5" />

                        </button>

                      </div>

                    </div>

                  </div>

                </div>

              </div>
            );
          })}

        </div>
      )}

      {/* ========================================================
          MODAL CREAR GRUPO
      ========================================================= */}

      {showModal && (

        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onMouseDown={(event) => {

            if (event.target === event.currentTarget) {

              if (!creating) {
                setShowModal(false);
                resetForm();
              }

            }
          }}
        >

          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">

            {/* ==================================================
                HEADER
            =================================================== */}

            <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between">

              <h3 className="font-semibold text-[#191919]">
                Crear nuevo grupo
              </h3>

              <button
                onClick={() => {

                  if (creating) {
                    return;
                  }

                  setShowModal(false);
                  resetForm();

                }}
                className="text-[#787774] hover:text-[#37352F] text-xl leading-none"
              >
                ×
              </button>

            </div>

            {/* ==================================================
                FORM
            =================================================== */}

            <div className="p-6 space-y-4">

              {/* NOMBRE */}

              <div>

                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">

                  Nombre del grupo *

                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm(prev => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  placeholder="ej. Matemáticas 9A"
                  disabled={creating}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] disabled:bg-[#F7F6F3]"
                />

              </div>

              {/* MATERIA / GRADO */}

              <div className="grid grid-cols-2 gap-3">

                <div>

                  <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">

                    Materia *

                  </label>

                  <input
                    value={form.subject}
                    onChange={(event) =>
                      setForm(prev => ({
                        ...prev,
                        subject:
                          event.target.value,
                      }))
                    }
                    placeholder="ej. Matemáticas"
                    disabled={creating}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] disabled:bg-[#F7F6F3]"
                  />

                </div>

                <div>

                  <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">

                    Grado

                  </label>

                  <input
                    value={form.grade}
                    onChange={(event) =>
                      setForm(prev => ({
                        ...prev,
                        grade:
                          event.target.value,
                      }))
                    }
                    placeholder="ej. 9°A"
                    disabled={creating}
                    className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] disabled:bg-[#F7F6F3]"
                  />

                </div>

              </div>

              {/* DESCRIPCIÓN */}

              <div>

                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">

                  Descripción

                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm(prev => ({
                      ...prev,
                      description:
                        event.target.value,
                    }))
                  }
                  placeholder="Breve descripción del grupo..."
                  rows={2}
                  disabled={creating}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] resize-none disabled:bg-[#F7F6F3]"
                />

              </div>

              {/* COLOR */}

              <div>

                <label className="block text-xs font-semibold text-[#787774] mb-1.5 uppercase tracking-wide">

                  Color del grupo

                </label>

                <div className="flex gap-2">

                  {COLORS.map(color => (

                    <button
                      key={color.value}
                      type="button"
                      onClick={() =>
                        setForm(prev => ({
                          ...prev,
                          color: color.value,
                        }))
                      }
                      disabled={creating}
                      title={color.name}
                      className={`w-7 h-7 rounded-full transition-all ${
                        form.color === color.value
                          ? 'ring-2 ring-offset-2 ring-[#37352F] scale-110'
                          : ''
                      }`}
                      style={{
                        background:
                          color.value,
                      }}
                    />

                  ))}

                </div>

              </div>

            </div>

            {/* ==================================================
                FOOTER
            =================================================== */}

            <div className="px-6 pb-5 flex flex-col gap-2">

              {createError && (

                <p className="text-xs text-[#E03E3E] bg-red-50 border border-red-100 rounded-lg px-3 py-2">

                  {createError}

                </p>
              )}

              <div className="flex justify-end gap-2">

                <button
                  onClick={() => {

                    if (creating) {
                      return;
                    }

                    setShowModal(false);
                    resetForm();

                  }}
                  disabled={creating}
                  className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleCreate}
                  disabled={
                    !form.name.trim() ||
                    !form.subject.trim() ||
                    creating ||
                    !canCreateGroup
                  }
                  className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >

                  {creating ? (

                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />

                      Creando…

                    </>

                  ) : (

                    <>
                      <Plus className="w-4 h-4" />

                      Crear Grupo

                    </>

                  )}

                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
