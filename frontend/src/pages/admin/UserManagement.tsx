/**
 * UserManagement — Gestión de Usuarios (Admin)
 * Consume GET/PATCH/DELETE /admin/users y POST /admin/users/{id}/reset-password
 */
import { useState, useEffect, useRef } from 'react';
import {
  Search, Filter, RefreshCw, Shield, ShieldOff, Key, Trash2,
  ChevronDown, ChevronUp, X, CheckCircle, AlertCircle, Users,
  GraduationCap, BookOpen, ShieldCheck, User, Copy, Eye, EyeOff,
} from 'lucide-react';
import api from '../../services/api';

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface UserRow {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  institution_name: string;
  institution_id: number | null;
  document_type: string;
  document_number: string;
  created_at: string | null;
  last_login: string | null;
  must_change_password: boolean;
}

// ─── Constantes ──────────────────────────────────────────────────────────────
const ROLE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  admin:          { label: 'Admin',          color: 'bg-[#F7F6F3] text-[#37352F] border border-[#E9E9E7]', icon: ShieldCheck },
  super_profesor: { label: 'Super Profesor', color: 'bg-[#F4EFFB] text-[#6940A5] border border-[#D9CCE9]', icon: Shield },
  profesor:       { label: 'Profesor',       color: 'bg-[#E5F3FF] text-[#0B6E99] border border-[#BFDFF0]', icon: BookOpen },
  estudiante:     { label: 'Estudiante',     color: 'bg-[#EEF7F4] text-[#0F7B6C] border border-[#BADFD9]', icon: GraduationCap },
};

const ROLE_OPTIONS = [
  { value: '', label: 'Todos los roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_profesor', label: 'Super Profesor' },
  { value: 'profesor', label: 'Profesor' },
  { value: 'estudiante', label: 'Estudiante' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Todos los estados' },
  { value: 'true', label: 'Activos' },
  { value: 'false', label: 'Inactivos' },
];

function Badge({ role }: { role: string }) {
  const cfg = ROLE_LABELS[role] ?? { label: role, color: 'bg-gray-100 text-gray-600', icon: User };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function UserManagement() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // Notificaciones
  const [notice, setNotice] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal editar
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', role: '', is_active: true });
  const [editLoading, setEditLoading] = useState(false);

  // Modal reset password
  const [resetUser, setResetUser] = useState<UserRow | null>(null);
  const [newPwd, setNewPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  // Modal confirmar eliminar
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Carga ──────────────────────────────────────────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), page_size: String(PAGE_SIZE) };
      if (search)       params.search   = search;
      if (roleFilter)   params.role     = roleFilter;
      if (statusFilter) params.is_active = statusFilter;
      const { data } = await api.get('/admin/users', { params });
      setUsers(data.users);
      setTotal(data.total);
    } catch {
      notify('err', 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [search, roleFilter, statusFilter, page]);

  const notify = (type: 'ok' | 'err', msg: string) => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice({ type, msg });
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  // ─── Activar / Desactivar rápido ────────────────────────────────────────────
  const toggleActive = async (u: UserRow) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { is_active: !u.is_active });
      notify('ok', `Usuario ${u.is_active ? 'desactivado' : 'activado'} correctamente`);
      fetchUsers();
    } catch (e: any) {
      notify('err', e.response?.data?.detail || 'Error al cambiar estado');
    }
  };

  // ─── Editar ─────────────────────────────────────────────────────────────────
  const openEdit = (u: UserRow) => {
    setEditing(u);
    setEditForm({ full_name: u.full_name, email: u.email, role: u.role, is_active: u.is_active });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setEditLoading(true);
    try {
      await api.patch(`/admin/users/${editing.id}`, editForm);
      notify('ok', 'Usuario actualizado');
      setEditing(null);
      fetchUsers();
    } catch (e: any) {
      notify('err', e.response?.data?.detail || 'Error al guardar');
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Reset password ─────────────────────────────────────────────────────────
  const doReset = async () => {
    if (!resetUser) return;
    setResetLoading(true);
    try {
      const { data } = await api.post(`/admin/users/${resetUser.id}/reset-password`);
      setNewPwd(data.temp_password);
    } catch (e: any) {
      notify('err', e.response?.data?.detail || 'Error al resetear contraseña');
      setResetUser(null);
    } finally {
      setResetLoading(false);
    }
  };

  // ─── Eliminar ───────────────────────────────────────────────────────────────
  const doDelete = async () => {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/users/${deleteUser.id}`);
      notify('ok', 'Usuario eliminado');
      setDeleteUser(null);
      fetchUsers();
    } catch (e: any) {
      notify('err', e.response?.data?.detail || 'Error al eliminar');
    } finally {
      setDeleteLoading(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">

      {/* Notificación flotante */}
      {notice && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all
          ${notice.type === 'ok' ? 'bg-[#EEF7F4] border border-[#BADFD9] text-[#0F7B6C]' : 'bg-[#FDEEEE] border border-[#F4BDBD] text-[#E03E3E]'}`}>
          {notice.type === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {notice.msg}
          <button onClick={() => setNotice(null)}><X className="w-4 h-4 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {/* ── Encabezado ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#191919] flex items-center gap-2">
            <Users className="w-6 h-6 text-[#787774]" /> Gestión de Usuarios
          </h1>
          <p className="text-sm text-[#787774] mt-0.5">{total} usuario{total !== 1 ? 's' : ''} encontrados</p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 px-3 py-2 text-sm text-[#787774] border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3] transition-colors">
          <RefreshCw className="w-4 h-4" /> Actualizar
        </button>
      </div>

      {/* ── Filtros ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9B9A97]" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, usuario, email o documento..."
            className="w-full pl-9 pr-4 py-2.5 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] focus:border-[#37352F] outline-none"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9A97] hover:text-[#37352F]"><X className="w-4 h-4" /></button>}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9B9A97]" />
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
              className="pl-8 pr-8 py-2.5 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#37352F] appearance-none">
              {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2.5 border border-[#E9E9E7] rounded-md text-sm outline-none bg-white focus:ring-1 focus:ring-[#37352F]">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Tabla ─────────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-[#787774]">Cargando usuarios…</div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#787774]">No se encontraron usuarios con los filtros aplicados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Usuario</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Rol</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider hidden md:table-cell">Institución</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider hidden lg:table-cell">Último acceso</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9E9E7]">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#191919]">{u.full_name || u.username}</p>
                      <p className="text-xs text-[#787774] font-mono">{u.username}</p>
                      {u.email && <p className="text-xs text-[#AEADAB]">{u.email}</p>}
                      {u.must_change_password && (
                        <span className="text-[10px] text-[#D9730D] bg-[#FCF6E5] px-1.5 py-0.5 rounded-full border border-[#EDD88A] inline-block mt-0.5">
                          Debe cambiar contraseña
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3"><Badge role={u.role} /></td>
                    <td className="px-4 py-3 hidden md:table-cell text-xs text-[#787774]">{u.institution_name}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-[#787774]">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('es-CO') : 'Nunca'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        {/* Editar */}
                        <button onClick={() => openEdit(u)}
                          className="p-1.5 text-[#787774] hover:text-[#37352F] hover:bg-[#F7F6F3] rounded transition-colors"
                          title="Editar usuario">
                          <User className="w-4 h-4" />
                        </button>
                        {/* Activar / Desactivar */}
                        <button onClick={() => toggleActive(u)}
                          className={`p-1.5 rounded transition-colors ${u.is_active ? 'text-[#E03E3E] hover:bg-red-50' : 'text-[#0F7B6C] hover:bg-green-50'}`}
                          title={u.is_active ? 'Desactivar' : 'Activar'}>
                          {u.is_active ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </button>
                        {/* Reset password */}
                        <button onClick={() => { setResetUser(u); setNewPwd(''); setShowPwd(false); }}
                          className="p-1.5 text-[#787774] hover:text-[#D9730D] hover:bg-orange-50 rounded transition-colors"
                          title="Resetear contraseña">
                          <Key className="w-4 h-4" />
                        </button>
                        {/* Eliminar (solo profesores/estudiantes) */}
                        {(u.role === 'profesor' || u.role === 'estudiante') && (
                          <button onClick={() => setDeleteUser(u)}
                            className="p-1.5 text-[#787774] hover:text-[#E03E3E] hover:bg-red-50 rounded transition-colors"
                            title="Eliminar usuario">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-[#E9E9E7] flex items-center justify-between text-sm text-[#787774]">
            <span>Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}</span>
            <div className="flex gap-1">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded border border-[#E9E9E7] disabled:opacity-40 hover:bg-[#F7F6F3] transition-colors">
                <ChevronUp className="w-4 h-4 rotate-[-90deg]" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`px-3 py-1 rounded border text-xs transition-colors ${pg === page ? 'bg-[#37352F] text-white border-[#37352F]' : 'border-[#E9E9E7] hover:bg-[#F7F6F3]'}`}>
                    {pg}
                  </button>
                );
              })}
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded border border-[#E9E9E7] disabled:opacity-40 hover:bg-[#F7F6F3] transition-colors">
                <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══ Modal: Editar usuario ════════════════════════════════════════════════ */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7]">
              <h2 className="font-semibold text-[#191919]">Editar usuario</h2>
              <button onClick={() => setEditing(null)} className="text-[#787774] hover:text-[#37352F]"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1">Nombre completo</label>
                <input value={editForm.full_name} onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1">Correo electrónico</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#787774] mb-1">Rol</label>
                <select value={editForm.role} onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white">
                  <option value="admin">Admin</option>
                  <option value="super_profesor">Super Profesor</option>
                  <option value="profesor">Profesor</option>
                  <option value="estudiante">Estudiante</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="is_active" checked={editForm.is_active}
                  onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                  className="w-4 h-4 accent-[#0B6E99]" />
                <label htmlFor="is_active" className="text-sm text-[#37352F]">Cuenta activa</label>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E9E9E7] flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-[#787774] border border-[#E9E9E7] rounded-md hover:bg-[#F7F6F3]">Cancelar</button>
              <button onClick={saveEdit} disabled={editLoading}
                className="px-4 py-2 text-sm font-medium bg-[#37352F] text-white rounded-md hover:bg-[#2F2D2B] disabled:opacity-50 transition-colors">
                {editLoading ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Reset contraseña ══════════════════════════════════════════════ */}
      {resetUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7]">
              <h2 className="font-semibold text-[#191919]">Resetear contraseña</h2>
              <button onClick={() => { setResetUser(null); setNewPwd(''); }} className="text-[#787774] hover:text-[#37352F]"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5">
              {!newPwd ? (
                <>
                  <p className="text-sm text-[#787774] mb-4">
                    Se generará una contraseña temporal para <strong className="text-[#37352F]">{resetUser.full_name || resetUser.username}</strong>.
                    El usuario deberá cambiarla en su próximo inicio de sesión.
                  </p>
                  <button onClick={doReset} disabled={resetLoading}
                    className="w-full py-2.5 bg-[#D9730D] text-white rounded-md text-sm font-medium hover:bg-[#B85C00] disabled:opacity-50 transition-colors">
                    {resetLoading ? 'Generando...' : 'Generar contraseña temporal'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#0F7B6C] mb-3 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Contraseña generada exitosamente</p>
                  <div className="bg-[#F7F6F3] rounded-md px-4 py-3 flex items-center gap-3 border border-[#E9E9E7]">
                    <span className={`flex-1 font-mono text-sm font-semibold text-[#37352F] ${showPwd ? '' : 'tracking-widest'}`}>
                      {showPwd ? newPwd : '•'.repeat(newPwd.length)}
                    </span>
                    <button onClick={() => setShowPwd(v => !v)} className="text-[#787774] hover:text-[#37352F]">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { navigator.clipboard.writeText(newPwd); notify('ok', 'Contraseña copiada'); }}
                      className="text-[#787774] hover:text-[#37352F]" title="Copiar">
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[#787774] mt-2">Comparte esta contraseña de forma segura con el usuario.</p>
                  <button onClick={() => { setResetUser(null); setNewPwd(''); fetchUsers(); }}
                    className="w-full mt-4 py-2 bg-[#37352F] text-white rounded-md text-sm font-medium hover:bg-[#2F2D2B] transition-colors">
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ Modal: Confirmar eliminación ══════════════════════════════════════════ */}
      {deleteUser && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6 text-[#E03E3E]" />
              </div>
              <h2 className="text-center font-semibold text-[#191919] mb-2">¿Eliminar usuario?</h2>
              <p className="text-center text-sm text-[#787774]">
                Se eliminará permanentemente <strong className="text-[#37352F]">{deleteUser.full_name || deleteUser.username}</strong>.
                Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setDeleteUser(null)} className="flex-1 py-2.5 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-[#F7F6F3]">Cancelar</button>
                <button onClick={doDelete} disabled={deleteLoading}
                  className="flex-1 py-2.5 bg-[#E03E3E] text-white rounded-md text-sm font-medium hover:bg-[#C52F2F] disabled:opacity-50 transition-colors">
                  {deleteLoading ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
