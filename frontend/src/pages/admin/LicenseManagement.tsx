/**
 * NeuroLearn AI — Admin: Gestión de Licencias
 * Lista todas las instituciones con su estado de licencia.
 * Permite cambiar tipo, activar/suspender, y ajustar fecha de vencimiento.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Search, RefreshCw, Shield, ShieldOff, Calendar,
  Edit2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, X,
} from 'lucide-react';
import api from '../../services/api';

interface Institution {
  id: number;
  name: string;
  dane_code: string;
  license_type: string;
  is_active: boolean;
  expiry_date: string | null;
  days_left: number | null;
  max_teachers: number;
  max_students: number;
  teachers_count: number;
  students_count: number;
  created_at: string | null;
}

const LICENSE_LABELS: Record<string, { label: string; color: string }> = {
  basica:   { label: 'Básica',   color: 'bg-[#F7F6F3] text-[#37352F]' },
  premium:  { label: 'Premium',  color: 'bg-[#E5F3FF] text-[#0B6E99]' },
  pro:      { label: 'Pro',      color: 'bg-[#F4EFFB] text-[#6940A5]' },
};

function UsageBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor = pct >= 90 ? 'bg-[#D44C47]' : pct >= 70 ? 'bg-[#D9730D]' : color;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#E9E9E7] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[#9B9A97] whitespace-nowrap">{value}/{max}</span>
    </div>
  );
}

interface EditModalProps {
  institution: Institution;
  onClose: () => void;
  onSaved: () => void;
}

function EditLicenseModal({ institution, onClose, onSaved }: EditModalProps) {
  const [licenseType, setLicenseType] = useState(institution.license_type);
  const [isActive, setIsActive] = useState(institution.is_active);
  const [expiryDate, setExpiryDate] = useState(institution.expiry_date ?? '');
  const [clearExpiry, setClearExpiry] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      await api.patch(`/admin/institutions/${institution.id}/license`, {
        license_type: licenseType,
        is_active: isActive,
        expiry_date: clearExpiry ? null : (expiryDate || null),
        clear_expiry: clearExpiry,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Error al guardar cambios');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md border border-[#E9E9E7]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7]">
          <h2 className="font-semibold text-[#191919]">Editar licencia</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#F7F6F3] rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <p className="text-xs text-[#9B9A97] mb-1">Institución</p>
            <p className="font-medium text-[#191919]">{institution.name}</p>
            <p className="text-xs text-[#787774]">DANE: {institution.dane_code}</p>
          </div>

          {/* Tipo de licencia */}
          <div>
            <label className="block text-sm font-medium text-[#37352F] mb-1.5">Tipo de licencia</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LICENSE_LABELS).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setLicenseType(key)}
                  className={`py-2.5 px-3 rounded-md border-2 text-sm font-medium transition-all ${
                    licenseType === key
                      ? 'border-[#0B6E99] bg-[#E5F3FF] text-[#0B6E99]'
                      : 'border-[#E9E9E7] text-[#787774] hover:border-[#BFDFF0]'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <div className="mt-2 text-xs text-[#787774] bg-[#F7F6F3] rounded p-2">
              {licenseType === 'basica' && '20 docentes · 300 estudiantes'}
              {licenseType === 'premium' && '60 docentes · 1 500 estudiantes'}
              {licenseType === 'pro' && 'Docentes y estudiantes ilimitados'}
            </div>
          </div>

          {/* Estado */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-[#37352F]">Estado de la institución</label>
            <button
              onClick={() => setIsActive(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors cursor-pointer ${
                isActive ? 'bg-[#0F7B6C]' : 'bg-[#E9E9E7]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${isActive ? 'text-[#0F7B6C]' : 'text-[#D44C47]'}`}>
              {isActive ? 'Activa' : 'Suspendida'}
            </span>
          </div>

          {/* Fecha de vencimiento */}
          <div>
            <label className="block text-sm font-medium text-[#37352F] mb-1.5">
              Fecha de vencimiento
            </label>
            <input
              type="date"
              value={clearExpiry ? '' : expiryDate}
              disabled={clearExpiry}
              onChange={e => setExpiryDate(e.target.value)}
              className="w-full border border-[#E9E9E7] rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40 disabled:bg-[#F7F6F3] disabled:text-[#9B9A97]"
            />
            <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-[#787774]">
              <input
                type="checkbox"
                checked={clearExpiry}
                onChange={e => setClearExpiry(e.target.checked)}
                className="rounded"
              />
              Sin fecha de vencimiento (licencia permanente)
            </label>
          </div>

          {error && (
            <div className="bg-[#FDECEA] text-[#D44C47] text-sm rounded-md p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E9E9E7]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] text-[#37352F]"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-[#0B6E99] text-white rounded-md hover:bg-[#095a7e] disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LicenseManagement() {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [search, setSearch] = useState('');
  const [licenseFilter, setLicenseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 30;

  const [editingInst, setEditingInst] = useState<Institution | null>(null);

  const fetchInstitutions = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number | boolean> = { page: p, page_size: PAGE_SIZE };
      if (search) params.search = search;
      if (licenseFilter) params.license_type = licenseFilter;
      if (statusFilter === 'active') params.is_active = true;
      if (statusFilter === 'inactive') params.is_active = false;
      const res = await api.get('/admin/institutions', { params });
      setInstitutions(res.data.institutions ?? []);
      setTotal(res.data.total ?? 0);
    } catch {
      setError('No se pudieron cargar las instituciones.');
    } finally {
      setLoading(false);
    }
  }, [page, search, licenseFilter, statusFilter]);

  useEffect(() => {
    fetchInstitutions(page);
  }, [page]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 4000);
  };

  const handleFilter = () => { setPage(1); fetchInstitutions(1); };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">

      {/* ── Encabezado ─────────────────────────── */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#191919] flex items-center gap-2">
            <Shield className="w-6 h-6 text-[#6940A5]" />
            Gestión de Licencias
          </h1>
          <p className="text-sm text-[#787774] mt-1">
            Administra el tipo, estado y vencimiento de cada institución ({total} registradas)
          </p>
        </div>
        <button
          onClick={() => fetchInstitutions(page)}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] text-[#37352F]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* ── Notificación ───────────────────────── */}
      {notice && (
        <div className="mb-4 bg-[#EEF7F4] border border-[#0F7B6C]/30 text-[#0F7B6C] rounded-md p-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </div>
      )}

      {/* ── Filtros ────────────────────────────── */}
      <div className="bg-white rounded-md border border-[#E9E9E7] p-4 mb-5 flex flex-wrap gap-3 items-end shadow-sm">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-medium text-[#787774] mb-1">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
            <input
              type="text"
              placeholder="Nombre o código DANE"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFilter()}
              className="w-full pl-9 pr-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#787774] mb-1">Licencia</label>
          <select
            value={licenseFilter}
            onChange={e => setLicenseFilter(e.target.value)}
            className="border border-[#E9E9E7] rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
          >
            <option value="">Todos los tipos</option>
            <option value="basica">Básica</option>
            <option value="premium">Premium</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#787774] mb-1">Estado</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="border border-[#E9E9E7] rounded-md text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#0B6E99]/40"
          >
            <option value="">Todos</option>
            <option value="active">Activas</option>
            <option value="inactive">Suspendidas</option>
          </select>
        </div>
        <button
          onClick={handleFilter}
          className="bg-[#0B6E99] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#095a7e] flex items-center gap-2"
        >
          <Search className="w-4 h-4" />Filtrar
        </button>
        <button
          onClick={() => { setSearch(''); setLicenseFilter(''); setStatusFilter(''); setPage(1); fetchInstitutions(1); }}
          className="text-sm text-[#787774] hover:text-[#37352F] px-3 py-2 border border-[#E9E9E7] rounded-md"
        >
          Limpiar
        </button>
      </div>

      {/* ── Error ──────────────────────────────── */}
      {error && (
        <div className="bg-[#FDECEA] border border-[#D44C47]/30 text-[#D44C47] rounded-md p-3 mb-4 flex items-center gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ── Tabla ──────────────────────────────── */}
      <div className="bg-white rounded-md border border-[#E9E9E7] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[#9B9A97] gap-2">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span className="text-sm">Cargando instituciones…</span>
          </div>
        ) : institutions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#9B9A97]">
            <Shield className="w-10 h-10 mb-2 opacity-40" />
            <p className="text-sm">No hay instituciones que coincidan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Institución</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">DANE</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Licencia</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Estado</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Vencimiento</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Docentes</th>
                  <th className="text-left px-4 py-3 font-semibold text-[#37352F]">Estudiantes</th>
                  <th className="text-right px-4 py-3 font-semibold text-[#37352F]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F3F1]">
                {institutions.map(inst => {
                  const licMeta = LICENSE_LABELS[inst.license_type] ?? { label: inst.license_type, color: 'bg-[#F7F6F3] text-[#37352F]' };
                  const isExpired = inst.expiry_date && new Date(inst.expiry_date) < new Date();
                  const isExpiringSoon = inst.days_left !== null && inst.days_left <= 30 && inst.days_left > 0;
                  return (
                    <tr key={inst.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#191919] truncate max-w-[180px]" title={inst.name}>{inst.name}</p>
                      </td>
                      <td className="px-4 py-3 text-[#787774] font-mono text-xs">{inst.dane_code}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${licMeta.color}`}>
                          {licMeta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inst.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F7B6C] bg-[#EEF7F4] px-2 py-0.5 rounded">
                            <Shield className="w-3 h-3" />Activa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#D44C47] bg-[#FDECEA] px-2 py-0.5 rounded">
                            <ShieldOff className="w-3 h-3" />Suspendida
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {inst.expiry_date ? (
                          <span className={`flex items-center gap-1 text-xs ${isExpired ? 'text-[#D44C47] font-medium' : isExpiringSoon ? 'text-[#D9730D] font-medium' : 'text-[#787774]'}`}>
                            <Calendar className="w-3 h-3" />
                            {inst.expiry_date}
                            {isExpired && ' (vencida)'}
                            {isExpiringSoon && ` (${inst.days_left}d)`}
                          </span>
                        ) : (
                          <span className="text-xs text-[#9B9A97]">Permanente</span>
                        )}
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <UsageBar value={inst.teachers_count} max={inst.max_teachers} color="bg-[#0B6E99]" />
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <UsageBar value={inst.students_count} max={inst.max_students} color="bg-[#0F7B6C]" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditingInst(inst)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] text-[#37352F]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />Editar licencia
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginación ─────────────────────────── */}
      {!loading && total > PAGE_SIZE && (
        <div className="flex items-center justify-between mt-4 text-sm text-[#787774]">
          <span>
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded border border-[#E9E9E7] hover:bg-[#F7F6F3] disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 bg-[#F7F6F3] rounded border border-[#E9E9E7]">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded border border-[#E9E9E7] hover:bg-[#F7F6F3] disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Modal edición licencia ─────────────── */}
      {editingInst && (
        <EditLicenseModal
          institution={editingInst}
          onClose={() => setEditingInst(null)}
          onSaved={() => {
            showNotice(`Licencia de "${editingInst.name}" actualizada correctamente`);
            fetchInstitutions(page);
          }}
        />
      )}
    </div>
  );
}
