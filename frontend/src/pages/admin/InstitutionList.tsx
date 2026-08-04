/**
 * InstitutionList — Lista de instituciones registradas
 * Consume GET /admin/institutions
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  School, Plus, Search, CheckCircle, XCircle,
  Users, BookOpen, ChevronRight, Loader2, RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

interface InstitutionItem {
  id: number;
  name: string;
  dane_code: string;
  license_type: 'basica' | 'premium' | 'pro';
  is_active: boolean;
  created_at: string;
  teacher_count: number;
  student_count: number;
}

const LICENSE_BADGE: Record<string, string> = {
  basica:  'bg-[#F7F6F3] text-[#787774] border-[#E9E9E7]',
  premium: 'bg-[#E5F3FF] text-[#0B6E99] border-[#BFDFF0]',
  pro:     'bg-[#F7F3FB] text-[#6940A5] border-[#D9CCE9]',
};

export default function InstitutionList() {
  const [institutions, setInstitutions] = useState<InstitutionItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState('');

  const fetchInstitutions = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<InstitutionItem[]>('/admin/institutions');
      setInstitutions(data);
    } catch {
      setError('No se pudieron cargar las instituciones. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInstitutions(); }, []);

  // Filtro local por nombre o código DANE
  const filtered = institutions.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.dane_code.includes(search)
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">

      {/* ── Encabezado ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6 sm:mb-7">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#191919]">Instituciones</h1>
          <p className="text-[#787774] text-sm mt-1">
            {institutions.length} colegio{institutions.length !== 1 ? 's' : ''} registrado{institutions.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          to="/admin/instituciones/nueva"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#37352F] text-white text-sm font-medium rounded-md hover:bg-[#2F2D2B] transition-colors self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nueva institución
        </Link>
      </div>

      {/* ── Buscador ───────────────────────────────────── */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código DANE…"
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#E9E9E7] rounded-md bg-white text-[#37352F] placeholder-[#9B9A97] focus:outline-none focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F]"
        />
      </div>

      {/* ── Estado: cargando ───────────────────────────── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-[#9B9A97]" />
          <span className="ml-3 text-sm text-[#787774]">Cargando instituciones…</span>
        </div>
      )}

      {/* ── Estado: error ──────────────────────────────── */}
      {!loading && error && (
        <div className="bg-[#FDEEEE] border border-[#F4BDBD] rounded-md p-5 flex items-center justify-between">
          <p className="text-sm text-[#E03E3E]">{error}</p>
          <button
            onClick={fetchInstitutions}
            className="flex items-center gap-1.5 text-sm text-[#E03E3E] hover:text-[#C03030] font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reintentar
          </button>
        </div>
      )}

      {/* ── Estado: vacío ──────────────────────────────── */}
      {!loading && !error && filtered.length === 0 && (
        <div className="bg-white border border-[#E9E9E7] rounded-md p-12 text-center">
          <div className="w-12 h-12 bg-[#F7F6F3] rounded-md flex items-center justify-center mx-auto mb-4">
            <School className="w-6 h-6 text-[#9B9A97]" />
          </div>
          {search ? (
            <>
              <h3 className="text-base font-semibold text-[#191919]">Sin resultados</h3>
              <p className="text-sm text-[#787774] mt-1">
                No hay instituciones que coincidan con "{search}"
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-[#191919]">
                Aún no hay instituciones registradas
              </h3>
              <p className="text-sm text-[#787774] mt-1 mb-5">
                Crea la primera institución y genera las credenciales del rector
              </p>
              <Link
                to="/admin/instituciones/nueva"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#37352F] text-white text-sm font-medium rounded-md hover:bg-[#2F2D2B] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Registrar primera institución
              </Link>
            </>
          )}
        </div>
      )}

      {/* ── Tabla ──────────────────────────────────────── */}
      {!loading && !error && filtered.length > 0 && (
        <div className="bg-white border border-[#E9E9E7] rounded-md overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#E9E9E7] bg-[#F7F6F3]">
                <th className="px-5 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">
                  Institución
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">
                  Código DANE
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">
                  Licencia
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">
                  Usuarios
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-5 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">
                  Registrada
                </th>
                <th className="px-5 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E9E9E7]">
              {filtered.map(inst => (
                <tr
                  key={inst.id}
                  className="hover:bg-[#F7F6F3]/60 transition-colors"
                >
                  {/* Nombre */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center shrink-0">
                        <School className="w-4 h-4 text-[#787774]" />
                      </div>
                      <span className="text-sm font-medium text-[#191919] truncate max-w-[200px]">
                        {inst.name}
                      </span>
                    </div>
                  </td>

                  {/* DANE */}
                  <td className="px-5 py-4">
                    <span className="text-sm font-mono text-[#787774]">
                      {inst.dane_code}
                    </span>
                  </td>

                  {/* Licencia */}
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-full capitalize ${LICENSE_BADGE[inst.license_type] ?? LICENSE_BADGE.basica}`}>
                      {inst.license_type}
                    </span>
                  </td>

                  {/* Usuarios */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3 text-xs text-[#787774]">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        {inst.teacher_count} prof.
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {inst.student_count} est.
                      </span>
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-5 py-4">
                    {inst.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#0F7B6C] font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Activa
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-[#E03E3E] font-medium">
                        <XCircle className="w-3.5 h-3.5" /> Inactiva
                      </span>
                    )}
                  </td>

                  {/* Fecha */}
                  <td className="px-5 py-4 text-xs text-[#9B9A97]">
                    {new Date(inst.created_at).toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                  </td>

                  {/* Acción */}
                  <td className="px-5 py-4">
                    <Link
                      to={`/admin/instituciones/nueva`}
                      className="text-[#9B9A97] hover:text-[#37352F] transition-colors"
                      title="Ver detalle"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer de la tabla */}
          <div className="px-5 py-3 border-t border-[#E9E9E7] bg-[#F7F6F3]/50 flex items-center justify-between">
            <p className="text-xs text-[#9B9A97]">
              Mostrando {filtered.length} de {institutions.length} instituciones
            </p>
            <button
              onClick={fetchInstitutions}
              className="flex items-center gap-1.5 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Actualizar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}