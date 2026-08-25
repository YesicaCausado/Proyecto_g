import { useState, useRef, useEffect } from 'react';
import { Users, GraduationCap, Upload, Plus, Download, Copy, CheckCircle, AlertCircle, FileText, Hash, Mail, User, Trash2, Pencil, X } from 'lucide-react';
import api from '../../../services/api';

// ── Utilidad: imprime solo las credenciales en una ventana nueva ─────────────
function printCredentials(credentials: any[], title: string) {
  const rows = credentials.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${c.full_name || '-'}</td>
      <td class="mono">${c.username}</td>
      <td class="pwd">${c.temp_password}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"/>
    <title>Credenciales — ${title}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:32px;color:#191919;max-width:800px;margin:0 auto}
      h1{font-size:20px;margin-bottom:4px}
      .sub{color:#787774;font-size:13px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse}
      th{background:#F7F6F3;padding:10px 14px;text-align:left;font-size:12px;color:#787774;border-bottom:1px solid #E9E9E7;text-transform:uppercase;letter-spacing:.05em}
      td{padding:10px 14px;font-size:13px;border-bottom:1px solid #F0EFED}
      .mono{font-family:monospace}
      .pwd{font-family:monospace;font-weight:700;color:#0B6E99}
      .footer{margin-top:28px;font-size:11px;color:#AEADAB;text-align:center}
      @media print{button{display:none}}
    </style></head><body>
    <h1>Credenciales Nuevas</h1>
    <p class="sub">${title} — ${new Date().toLocaleDateString('es-CO')}</p>
    <table>
      <thead><tr><th>#</th><th>Nombre completo</th><th>Usuario</th><th>Contraseña temporal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="footer">NeuroLearn AI — Documento confidencial. Entrega personal al usuario.</p>
    </body></html>`;

  const w = window.open('', '_blank', 'width=860,height=620');
  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
}

// ── Utilidad: genera y descarga un archivo CSV de plantilla ─────────────────
function downloadCsvTemplate(filename: string, headers: string, exampleRow: string) {
  const content = `${headers}\n${exampleRow}`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function CredentialsTable({ 
  credentials, 
  title, 
  icon: Icon
}: { 
  credentials: any[]; 
  title: string;
  icon: any;
}) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(credentials.map((_, i) => i)));

  if (credentials.length === 0) return null;

  const allChecked  = selected.size === credentials.length;
  const someChecked = selected.size > 0 && !allChecked;

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(credentials.map((_, i) => i)));
  }

  function toggleOne(idx: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  const selectedCreds = credentials.filter((_, i) => selected.has(i));

  return (
    <div className="mt-8 bg-white border border-[#E9E9E7] rounded-lg overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-[#E9E9E7] bg-[#F7F6F3] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-[#37352F]" />
          <h3 className="font-medium text-[#37352F]">{title}</h3>
        </div>
        <span className="text-xs text-[#787774]">
          {selected.size} de {credentials.length} seleccionados
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left bg-white">
          <thead className="bg-[#F7F6F3]/50">
            <tr>
              <th className="pl-6 pr-2 py-3">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked; }}
                  onChange={toggleAll}
                  className="w-4 h-4 accent-[#0B6E99] cursor-pointer"
                  title="Seleccionar todos"
                />
              </th>
              <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Usuario</th>
              <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Nombre completo</th>
              <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Contraseña Temporal</th>
              <th className="px-4 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E9E9E7]">
            {credentials.map((cred, idx) => (
              <tr
                key={idx}
                className={`transition-colors cursor-pointer ${selected.has(idx) ? 'bg-[#EEF6FB]' : 'hover:bg-[#F7F6F3]/50'}`}
                onClick={() => toggleOne(idx)}
              >
                <td className="pl-6 pr-2 py-4" onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(idx)}
                    onChange={() => toggleOne(idx)}
                    className="w-4 h-4 accent-[#0B6E99] cursor-pointer"
                  />
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-[#37352F] font-medium font-mono">{cred.username}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-[#787774]">{cred.full_name || '-'}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-[#37352F] font-mono tracking-wider font-semibold">{cred.temp_password}</td>
                <td className="px-4 py-4 whitespace-nowrap text-sm text-right" onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => navigator.clipboard.writeText(`Usuario: ${cred.username} | Pass: ${cred.temp_password}`)}
                    className="text-[#787774] hover:text-[#37352F] transition-colors flex items-center gap-1 justify-end ml-auto"
                    title="Copiar credenciales"
                  >
                    <Copy className="w-4 h-4" />
                    <span className="text-xs">Copiar</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-[#F7F6F3]/30 px-6 py-3 border-t border-[#E9E9E7] flex justify-between items-center hide-print">
        <p className="text-xs text-[#787774]">
          * Contraseñas temporales. Selecciona las filas que deseas incluir al imprimir.
        </p>
        <button 
          onClick={() => printCredentials(selectedCreds, title)}
          disabled={selected.size === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#37352F] bg-white border border-[#E9E9E7] rounded hover:bg-[#F7F6F3] shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Exportar / Imprimir ({selected.size})
        </button>
      </div>
    </div>
  );
}

// ── Modal de edición reutilizable (docentes / estudiantes) ───────────────────
interface EditField {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'date' | 'email';
  required?: boolean;
  options?: { value: string | number | boolean; label: string }[];
}

interface EditUserModalProps {
  title: string;
  fields: EditField[];
  initial: Record<string, any>;
  saving: boolean;
  onSave: (values: Record<string, any>) => void;
  onCancel: () => void;
}

function EditUserModal({ title, fields, initial, saving, onSave, onCancel }: EditUserModalProps) {
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    fields.forEach(f => { v[f.key] = initial[f.key] ?? ''; });
    return v;
  });

  const setValue = (key: string, val: any) => setValues(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(values);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E9E9E7]">
          <h3 className="text-lg font-semibold text-[#191919]">{title}</h3>
          <button onClick={onCancel} className="p-1.5 rounded-md text-[#787774] hover:bg-[#F7F6F3] hover:text-[#37352F] transition-colors" title="Cancelar">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-5 space-y-4">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  {f.label}{f.required && <span className="text-[#E03E3E]"> *</span>}
                </label>
                {f.type === 'select' ? (
                  <select
                    value={String(values[f.key] ?? '')}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                  >
                    {f.options?.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type || 'text'}
                    value={values[f.key] ?? ''}
                    onChange={(e) => setValue(f.key, e.target.value)}
                    required={f.required}
                    className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-[#E9E9E7] bg-[#F7F6F3]/40">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774] hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774] disabled:shadow-none"
            >
              {saving ? (
                <><span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span> Guardando...</>
              ) : (
                <>Guardar cambios</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TeachersTab({ license }: { license: any }) {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCredentials, setNewCredentials] = useState<any[]>([]);
  const [existingTeachers, setExistingTeachers] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [copiedTeacherId, setCopiedTeacherId] = useState<number | null>(null);
  const [deleteTeacherId, setDeleteTeacherId] = useState<number | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [savingTeacher, setSavingTeacher] = useState(false);

  const updateTeacher = async (values: Record<string, any>) => {
    if (!editingTeacher) return;
    setSavingTeacher(true);
    setMessage('');
    setError('');
    try {
      const payload: Record<string, any> = {};
      if (typeof values.full_name === 'string' && values.full_name.trim() && values.full_name !== editingTeacher.full_name) {
        payload.full_name = values.full_name.trim();
      }
      if (values.email !== editingTeacher.email) {
        payload.email = values.email?.trim() || '';
      }
      if (values.subject_area !== (editingTeacher.subject_area || '')) {
        payload.subject_area = values.subject_area || '';
      }
      if (values.document_type !== (editingTeacher.document_type || '')) {
        payload.document_type = values.document_type;
      }
      if (values.is_active !== editingTeacher.is_active) {
        payload.is_active = values.is_active === true || values.is_active === 'true';
      }
      if (Object.keys(payload).length === 0) {
        throw new Error('No hay cambios para guardar.');
      }
      await api.put(`/super/teachers/${editingTeacher.id}`, payload);
      setMessage('Profesor actualizado correctamente.');
      setEditingTeacher(null);
      await loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'No se pudo actualizar el profesor.');
    } finally {
      setSavingTeacher(false);
    }
  };
  // ── Flujo de carga masiva en dos pasos (preview → confirmar) ──────────────
  const [previewPendingFile, setPreviewPendingFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const previewFileInputRef = useRef<HTMLInputElement>(null);

  const loadTeachers = async () => {
    try {
      const res = await api.get('/super/teachers');
      setExistingTeachers(res.data || []);
    } catch { /* silencioso */ }
    finally { setLoadingList(false); }
  };

  useEffect(() => { loadTeachers(); }, []);

  const toggleTeacherSelection = (id: number) => {
    setSelectedTeacherIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAllTeachers = () => {
    if (selectedTeacherIds.length === existingTeachers.length) {
      setSelectedTeacherIds([]);
      return;
    }
    setSelectedTeacherIds(existingTeachers.map(t => t.id));
  };

  const copyTeacherCredentials = async (teacher: any) => {
    const text = `Usuario: ${teacher.username}\nContraseña temporal: ${teacher.temp_password || 'No disponible'}\nNombre: ${teacher.full_name || '-'}\nCorreo: ${teacher.email || '-'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTeacherId(teacher.id);
      setTimeout(() => setCopiedTeacherId(null), 1200);
    } catch {
      setError('No se pudo copiar la credencial. Inténtalo de nuevo.');
    }
  };

  const deleteTeacher = async () => {
    if (!deleteTeacherId) return;
    setDeletingTeacher(true);
    try {
      await api.delete(`/super/teachers/${deleteTeacherId}`);
      setDeleteTeacherId(null);
      setSelectedTeacherIds(prev => prev.filter(id => id !== deleteTeacherId));
      await loadTeachers();
      setMessage('Profesor eliminado correctamente.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el profesor.');
    } finally {
      setDeletingTeacher(false);
    }
  };

  // Individual Form
  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [email, setEmail]               = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState('CC');
  const [subjectArea, setSubjectArea]   = useState('');

  const handleCreateIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !documentNumber) {
      setError('Nombre, Apellido y Documento son obligatorios para generar credenciales de Profesor.');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    setError('');
    
    try {
      const response = await api.post('/super/teachers', {
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        document_type: documentType,
        document_number: documentNumber,
        email: email,
        subject_area: subjectArea,
      });
      
      setMessage('¡Profesor creado exitosamente!');
      setNewCredentials(prev => [response.data, ...prev]);
      loadTeachers();
      
      // Reset form
      setFirstName('');
      setLastName('');
      setEmail('');
      setDocumentNumber('');
      setDocumentType('CC');
      setSubjectArea('');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al crear el profesor');
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 1 de la carga masiva: validar el archivo (preview) sin crear usuarios.
  const handleReviewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = previewFileInputRef.current?.files?.[0];
    if (!file) {
      setError('Por favor sube un archivo CSV');
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');
    setPreviewResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/super/teachers/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewResult(response.data);
      setPreviewPendingFile(file);
      setMessage(response.data.message || 'Archivo revisado. Confirma para crear las cuentas.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al revisar el archivo CSV');
      setPreviewPendingFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2 de la carga masiva: confirmar y crear (solo los registros válidos).
  const handleConfirmBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = previewPendingFile;
    if (!file) {
      setError('El archivo ya no está disponible. Vuelve a cargarlo.');
      setPreviewResult(null);
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/super/teachers/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = response.data;
      setMessage(`Se han creado ${d.total_created || 0} profesor(es). ${d.total_errors || 0} registro(s) con errores fueron omitidos.`);
      setNewCredentials(d.credentials || []);
      setPreviewResult(null);
      setPreviewPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (previewFileInputRef.current) previewFileInputRef.current.value = '';
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al procesar el archivo CSV');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6 border-b border-[#E9E9E7] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center gap-2">
            <Users className="w-6 h-6" /> Gestión de Profesores
          </h2>
          <p className="text-sm text-[#787774] mt-1">
            Crea credenciales B2B para tus profesores. Limite de licencias controlado por el sistema.
          </p>
        </div>
        <div className="text-sm font-medium bg-[#F7F6F3] p-2 px-4 rounded border border-[#E9E9E7] shadow-sm">
          Licencias: <span className="text-primary">{license?.current_teachers || 0}</span> / {license?.max_teachers || '∞'}
        </div>
      </div>

      <div className="flex space-x-1 bg-[#F7F6F3] p-1 rounded-md mb-6 w-fit border border-[#E9E9E7]">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${
            activeTab === 'individual'
              ? 'bg-white text-[#37352F] shadow-sm border border-[#E9E9E7]'
              : 'text-[#787774] hover:text-[#37352F] hover:bg-white/50'
          }`}
        >
          <User className="w-4 h-4" /> Creación Individual
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${
            activeTab === 'batch'
              ? 'bg-white text-[#37352F] shadow-sm border border-[#E9E9E7]'
              : 'text-[#787774] hover:text-[#37352F] hover:bg-white/50'
          }`}
        >
          <Upload className="w-4 h-4" /> Carga Masiva (CSV)
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-md flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {message && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-6 shadow-sm">
        {activeTab === 'individual' ? (
          <form onSubmit={handleCreateIndividual} className="space-y-4">
            <h3 className="font-medium text-[#37352F] mb-4 border-b border-[#E9E9E7] pb-2">Datos del Profesor</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Nombre
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="Ej: Carlos"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Apellido
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="Ej: Martínez"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Tipo de documento
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                  required
                >
                  <option value="CC">CC — Cédula de Ciudadanía</option>
                  <option value="TI">TI — Tarjeta de Identidad</option>
                  <option value="CE">CE — Cédula de Extranjería</option>
                  <option value="PA">PA — Pasaporte</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Número de documento
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-mono"
                  placeholder="Ej: 1234567890"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Correo electrónico *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="profesor@colegio.edu.co"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Área de enseñanza (opcional)
                </label>
                <input
                  type="text"
                  value={subjectArea}
                  onChange={(e) => setSubjectArea(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="Ej: Matemáticas"
                />
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774] disabled:shadow-none"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                     <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                     Creando...
                  </span>
                ) : (
                  <>
                    <Plus className="w-4 h-4" /> Generar Credencial
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
             <div className="bg-[#F7F6F3] p-4 rounded-md border border-[#E9E9E7]">
               <h4 className="font-medium text-[#37352F] flex items-center gap-2 mb-2">
                 <FileText className="w-4 h-4" /> Formato CSV Requerido
               </h4>
               <p className="text-sm text-[#787774] mb-2">
                 El archivo CSV debe tener las siguientes cabeceras exactamente:
               </p>
               <code className="block bg-white p-2 rounded border border-[#E9E9E7] text-xs font-mono text-[#37352F] mb-3">
                 nombre_completo,tipo_documento,numero_documento,correo,area
               </code>
               <div className="text-xs text-[#787774] space-y-1 mt-2">
                 <p><span className="font-semibold text-[#37352F]">tipo_documento</span> — CC, TI, CE o PA</p>
                 <p><span className="font-semibold text-[#37352F]">correo</span> — obligatorio para profesores</p>
                 <p><span className="font-semibold text-[#37352F]">area</span> — opcional (ej: Matemáticas)</p>
               </div>
               <button
                 onClick={() => downloadCsvTemplate(
                   'plantilla_profesores.csv',
                   'nombre_completo,tipo_documento,numero_documento,correo,area',
                   'Carlos Martínez,CC,1234567890,carlos@colegio.edu.co,Matemáticas'
                 )}
                 className="text-sm text-primary hover:underline flex items-center gap-1">
                 <Download className="w-3 h-3" /> Descargar plantilla de ejemplo
               </button>
             </div>
             
             {previewResult ? (
               <form onSubmit={handleConfirmBatch} className="space-y-4">
                 {/* Resumen de validación */}
                 <div className={`${previewResult.total_valid > 0 ? 'bg-[#EEF7F4] border-[#0F7B6C]/30' : 'bg-[#FDEEEE] border-[#F4BDBD]'} border rounded-md p-4 text-sm`}>
                   <div className="flex items-center gap-2 mb-1">
                     {previewResult.total_valid > 0
                       ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" />
                       : <AlertCircle className="w-4 h-4 text-[#E03E3E]" />}
                     <span className={`font-semibold ${previewResult.total_valid > 0 ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>
                       Revisión del archivo
                     </span>
                   </div>
                   <p className="text-[#787774] mt-1">
                     <span className="font-semibold text-[#0F7B6C]">{previewResult.total_valid}</span> válido(s)
                     &nbsp;·&nbsp;
                     <span className="font-semibold text-[#D9730D]">{previewResult.total_errors}</span> con errores
                   </p>
                 </div>

                 {previewResult.errors && previewResult.errors.length > 0 && (
                   <div className="border border-[#E9E9E7] rounded-md p-3 max-h-44 overflow-y-auto">
                     <p className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2">Errores a corregir</p>
                     <ul className="space-y-1 text-xs text-[#E03E3E]">
                       {previewResult.errors.slice(0, 20).map((e: any, idx: number) => (
                         <li key={idx}>Fila {e.row}: {e.error}</li>
                       ))}
                       {previewResult.errors.length > 20 && (
                         <li className="text-[#9B9A97]">… y {previewResult.errors.length - 20} más</li>
                       )}
                     </ul>
                   </div>
                 )}

                 <div className="flex justify-end gap-2 pt-1">
                   <button
                     type="button"
                     onClick={() => { setPreviewResult(null); setPreviewPendingFile(null); setMessage(''); }}
                     disabled={isLoading}
                     className="px-4 py-2.5 text-sm border border-[#E9E9E7] rounded hover:bg-[#F7F6F3] text-[#787774] disabled:opacity-50"
                   >
                     Elegir otro archivo
                   </button>
                   <button
                     type="submit"
                     disabled={isLoading || previewResult.total_valid === 0}
                     className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774]"
                   >
                     {isLoading ? 'Creando...' : `Confirmar y crear (${previewResult.total_valid})`}
                   </button>
                 </div>
               </form>
             ) : (
               <form onSubmit={handleReviewBatch} className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-[#787774] mb-2">
                     Subir archivo (.csv)
                   </label>
                   <input
                     type="file"
                     accept=".csv"
                     ref={previewFileInputRef}
                     onChange={() => { setMessage(''); setError(''); }}
                     className="block w-full text-sm text-[#787774]
                       file:mr-4 file:py-2 file:px-4
                       file:rounded file:border-0
                       file:text-sm file:font-semibold
                       file:bg-[#F7F6F3] file:text-[#37352F]
                       hover:file:bg-[#E9E9E7] cursor-pointer
                       border border-[#E9E9E7] rounded-md p-2 transition-colors"
                   />
                 </div>

                 <div className="pt-2 flex justify-end">
                   <button
                     type="submit"
                     disabled={isLoading}
                     className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774]"
                   >
                     {isLoading ? 'Revisando...' : 'Revisar lote antes de crear'}
                   </button>
                 </div>
               </form>
             )}
          </div>
        )}
      </div>

      <CredentialsTable 
        credentials={newCredentials} 
        title="Nuevas Credenciales de Profesores" 
        icon={Users} 
      />

      {/* Lista persistente de profesores existentes */}
      {(existingTeachers.length > 0 || loadingList) && (
        <div className="mt-6 bg-white border border-[#E9E9E7] rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#E9E9E7] bg-[#F7F6F3] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#37352F]" />
              <h3 className="font-medium text-[#37352F]">Todos los Profesores Registrados</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectAllTeachers}
                className="text-xs text-[#37352F] bg-white border border-[#E9E9E7] rounded px-2 py-1 hover:bg-[#F7F6F3]"
              >
                {selectedTeacherIds.length === existingTeachers.length && existingTeachers.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
              <button
                onClick={() => {
                  const selected = existingTeachers.filter(t => selectedTeacherIds.includes(t.id));
                  if (!selected.length) return;
                  const text = selected.map(t => `Usuario: ${t.username}\nNombre: ${t.full_name || '-'}\nCorreo: ${t.email || '-'}\nDocumento: ${t.document_type || ''} ${t.document_number || ''}`).join('\n\n');
                  navigator.clipboard.writeText(text);
                }}
                disabled={selectedTeacherIds.length === 0}
                className="text-xs text-[#37352F] bg-white border border-[#E9E9E7] rounded px-2 py-1 hover:bg-[#F7F6F3] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Copiar seleccionados
              </button>
              <button
                onClick={async () => {
                  if (!selectedTeacherIds.length) return;
                  try {
                    await api.post('/super/teachers/bulk-delete', { ids: selectedTeacherIds });
                    setSelectedTeacherIds([]);
                    await loadTeachers();
                    setMessage('Profesores seleccionados eliminados correctamente.');
                  } catch (err: any) {
                    setError(err.response?.data?.detail || 'No se pudieron eliminar los profesores seleccionados.');
                  }
                }}
                disabled={selectedTeacherIds.length === 0}
                className="text-xs text-[#B42318] bg-white border border-[#F3C7C3] rounded px-2 py-1 hover:bg-[#FEF3F2] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Borrar seleccionados
              </button>
              <span className="text-xs text-[#787774]">{existingTeachers.length} profesor(es)</span>
            </div>
          </div>
          {loadingList ? (
            <div className="p-6 text-center text-sm text-[#787774]">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-white">
                <thead className="bg-[#F7F6F3]/50">
                  <tr>
                    <th className="pl-6 pr-2 py-3">
                      <input type="checkbox" checked={selectedTeacherIds.length === existingTeachers.length && existingTeachers.length > 0} onChange={toggleSelectAllTeachers} className="w-4 h-4 accent-[#0B6E99] cursor-pointer" />
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Correo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Área</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E9E7]">
                  {existingTeachers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                      <td className="pl-6 pr-2 py-3">
                        <input type="checkbox" checked={selectedTeacherIds.includes(t.id)} onChange={() => toggleTeacherSelection(t.id)} className="w-4 h-4 accent-[#0B6E99] cursor-pointer" />
                      </td>
                      <td className="px-6 py-3 text-sm text-[#37352F] font-medium">{t.full_name}</td>
                      <td className="px-6 py-3 text-sm font-mono text-[#37352F]">{t.username}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{t.document_type} {t.document_number}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{t.email || '-'}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{t.subject_area || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${t.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {t.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => copyTeacherCredentials(t)} className="p-2 hover:bg-[#F7F6F3] rounded text-[#787774] hover:text-[#37352F]" title="Copiar credencial">
                            {copiedTeacherId === t.id ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditingTeacher(t)} className="p-2 hover:bg-[#F7F6F3] rounded text-[#787774] hover:text-[#37352F]" title="Editar profesor">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTeacherId(t.id)} className="p-2 hover:bg-[#FEF3F2] rounded text-[#787774] hover:text-[#B42318]" title="Eliminar profesor">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {deleteTeacherId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#191919] mb-2">Eliminar profesor</h3>
            <p className="text-sm text-[#787774] mb-4">¿Seguro que quieres eliminar este profesor? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTeacherId(null)} className="px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774]">Cancelar</button>
              <button onClick={deleteTeacher} disabled={deletingTeacher} className="px-4 py-2 bg-[#B42318] text-white rounded-md text-sm hover:bg-[#912018] disabled:opacity-50">
                {deletingTeacher ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingTeacher && (
        <EditUserModal
          title={`Editar Profesor — ${editingTeacher.full_name || editingTeacher.username}`}
          saving={savingTeacher}
          onSave={updateTeacher}
          onCancel={() => setEditingTeacher(null)}
          initial={{
            full_name: editingTeacher.full_name || '',
            email: editingTeacher.email || '',
            subject_area: editingTeacher.subject_area || '',
            document_type: editingTeacher.document_type || 'CC',
            is_active: editingTeacher.is_active,
          }}
          fields={[
            { key: 'full_name', label: 'Nombre completo', required: true },
            { key: 'email', label: 'Correo electrónico', type: 'email', required: true },
            { key: 'subject_area', label: 'Área de enseñanza' },
            {
              key: 'document_type', label: 'Tipo de documento', type: 'select',
              options: [
                { value: 'CC', label: 'CC — Cédula de Ciudadanía' },
                { value: 'TI', label: 'TI — Tarjeta de Identidad' },
                { value: 'CE', label: 'CE — Cédula de Extranjería' },
                { value: 'PA', label: 'PA — Pasaporte' },
              ],
            },
            {
              key: 'is_active', label: 'Estado', type: 'select',
              options: [
                { value: true, label: 'Activo' },
                { value: false, label: 'Inactivo' },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}

export function StudentsTab({ license, teachers }: { license: any; teachers: any[] }) {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCredentials, setNewCredentials] = useState<any[]>([]);
  const [existingStudents, setExistingStudents] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [copiedStudentId, setCopiedStudentId] = useState<number | null>(null);
  const [deleteStudentId, setDeleteStudentId] = useState<number | null>(null);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);
  const [savingStudent, setSavingStudent] = useState(false);

  const updateStudent = async (values: Record<string, any>) => {
    if (!editingStudent) return;
    setSavingStudent(true);
    setMessage('');
    setError('');
    try {
      const payload: Record<string, any> = {};
      if (typeof values.full_name === 'string' && values.full_name.trim() && values.full_name !== editingStudent.full_name) {
        payload.full_name = values.full_name.trim();
      }
      if (values.email !== (editingStudent.email || '')) {
        payload.email = values.email?.trim() || '';
      }
      if (values.grade !== (editingStudent.grade || '')) {
        payload.grade = values.grade || '';
      }
      if (values.birth_date !== (editingStudent.birth_date || '')) {
        payload.birth_date = values.birth_date || '';
      }
      if (values.document_type !== (editingStudent.document_type || '')) {
        payload.document_type = values.document_type;
      }
      if (values.is_active !== editingStudent.is_active) {
        payload.is_active = values.is_active === true || values.is_active === 'true';
      }
      if (Object.keys(payload).length === 0) {
        throw new Error('No hay cambios para guardar.');
      }
      await api.put(`/super/students/${editingStudent.id}`, payload);
      setMessage('Estudiante actualizado correctamente.');
      setEditingStudent(null);
      await loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'No se pudo actualizar el estudiante.');
    } finally {
      setSavingStudent(false);
    }
  };
  // ── Flujo de carga masiva en dos pasos (preview → confirmar) ──────────────
  const [previewPendingFile, setPreviewPendingFile] = useState<File | null>(null);
  const [previewResult, setPreviewResult] = useState<any | null>(null);
  const previewFileInputRef = useRef<HTMLInputElement>(null);

  const loadStudents = async () => {
    try {
      const res = await api.get('/super/students');
      setExistingStudents(res.data || []);
    } catch { /* silencioso */ }
    finally { setLoadingList(false); }
  };

  useEffect(() => { loadStudents(); }, []);

  const toggleStudentSelection = (id: number) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };

  const toggleSelectAllStudents = () => {
    if (selectedStudentIds.length === existingStudents.length) {
      setSelectedStudentIds([]);
      return;
    }
    setSelectedStudentIds(existingStudents.map(s => s.id));
  };

  const copyStudentCredentials = async (student: any) => {
    const text = `Usuario: ${student.username}\nContraseña temporal: ${student.temp_password || 'No disponible'}\nNombre: ${student.full_name || '-'}\nDocumento: ${student.document_type || ''} ${student.document_number || ''}\nGrado: ${student.grade || '-'}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStudentId(student.id);
      setTimeout(() => setCopiedStudentId(null), 1200);
    } catch {
      setError('No se pudo copiar la credencial. Inténtalo de nuevo.');
    }
  };

  const deleteStudent = async () => {
    if (!deleteStudentId) return;
    setDeletingStudent(true);
    try {
      await api.delete(`/super/students/${deleteStudentId}`);
      setDeleteStudentId(null);
      setSelectedStudentIds(prev => prev.filter(id => id !== deleteStudentId));
      await loadStudents();
      setMessage('Estudiante eliminado correctamente.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'No se pudo eliminar el estudiante.');
    } finally {
      setDeletingStudent(false);
    }
  };

// Individual Form
  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType]     = useState('TI');
  const [grade, setGrade]                   = useState('');
  const [birthDate, setBirthDate]           = useState('');
  const [assignedTeacherId, setAssignedTeacherId] = useState('');


  const handleCreateIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !documentNumber) {
      setError('Nombre, Apellido y Documento son obligatorios.');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    setError('');
    
    try {
      const response = await api.post('/super/students', {
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        document_type: documentType,
        document_number: documentNumber,
        grade: grade,
        birth_date: birthDate || null,
      });
      
      setMessage('¡Estudiante creado exitosamente!');
      setNewCredentials(prev => [response.data, ...prev]);
      loadStudents();
      
      // Reset form
      setFirstName('');
      setLastName('');
      setDocumentNumber('');
      setDocumentType('TI');
      setGrade('');
      setBirthDate('');


    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al crear el estudiante');
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 1 de la carga masiva: validar el archivo (preview) sin crear usuarios.
  const handleReviewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = previewFileInputRef.current?.files?.[0];
    if (!file) {
      setError('Por favor sube un archivo CSV');
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');
    setPreviewResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/super/students/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreviewResult(response.data);
      setPreviewPendingFile(file);
      setMessage(response.data.message || 'Archivo revisado. Confirma para crear las cuentas.');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al revisar el archivo CSV');
      setPreviewPendingFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2 de la carga masiva: confirmar y crear (solo los registros válidos).
  const handleConfirmBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = previewPendingFile;
    if (!file) {
      setError('El archivo ya no está disponible. Vuelve a cargarlo.');
      setPreviewResult(null);
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    if (assignedTeacherId) {
      formData.append('default_teacher_id', assignedTeacherId);
    }

    try {
      const response = await api.post('/super/students/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = response.data;
      setMessage(`Se han creado ${d.total_created || 0} estudiante(s). ${d.total_errors || 0} registro(s) con errores fueron omitidos.`);
      setNewCredentials(d.credentials || []);
      setPreviewResult(null);
      setPreviewPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (previewFileInputRef.current) previewFileInputRef.current.value = '';
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al procesar el archivo CSV');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6 border-b border-[#E9E9E7] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center gap-2">
            <GraduationCap className="w-6 h-6" /> Gestión de Estudiantes
          </h2>
          <p className="text-sm text-[#787774] mt-1">
            Genera credenciales temporales para estudiantes y asígnalos a profesores en sistema B2B.
          </p>
        </div>
        <div className="text-sm font-medium bg-[#F7F6F3] p-2 px-4 rounded border border-[#E9E9E7] shadow-sm">
          Licencias: <span className="text-primary">{license?.current_students || 0}</span> / {license?.max_students || '∞'}
        </div>
      </div>

      <div className="flex space-x-1 bg-[#F7F6F3] p-1 rounded-md mb-6 w-fit border border-[#E9E9E7]">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${
            activeTab === 'individual'
              ? 'bg-white text-[#37352F] shadow-sm border border-[#E9E9E7]'
              : 'text-[#787774] hover:text-[#37352F] hover:bg-white/50'
          }`}
        >
          <User className="w-4 h-4" /> Creación Individual
        </button>
        <button
          onClick={() => setActiveTab('batch')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded transition-colors ${
            activeTab === 'batch'
              ? 'bg-white text-[#37352F] shadow-sm border border-[#E9E9E7]'
              : 'text-[#787774] hover:text-[#37352F] hover:bg-white/50'
          }`}
        >
          <Upload className="w-4 h-4" /> Carga Masiva (CSV)
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-600 rounded-md flex items-center gap-2 shadow-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {message && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-md flex items-center gap-2 shadow-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{message}</p>
        </div>
      )}

      <div className="bg-white border border-[#E9E9E7] rounded-lg p-6 shadow-sm">
        {activeTab === 'individual' ? (
          <form onSubmit={handleCreateIndividual} className="space-y-4">
            <h3 className="font-medium text-[#37352F] mb-4 border-b border-[#E9E9E7] pb-2">Datos del Estudiante</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  Nombre
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="Ej: Valentina"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  Apellido
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="Ej: Torres"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  Tipo de documento
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                  required
                >
                  <option value="TI">TI — Tarjeta de Identidad</option>
                  <option value="CC">CC — Cédula de Ciudadanía</option>
                  <option value="CE">CE — Cédula de Extranjería</option>
                  <option value="PA">PA — Pasaporte</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  Número de documento
                </label>
                <input
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-mono"
                  placeholder="Ej: 1234567890"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  Grado (opcional)
                </label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                  placeholder="Ej: 10°"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#787774] mb-1">
                  Fecha de nacimiento (opcional)
                </label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm"
                />
              </div>
            </div>
            
            <div className="pt-4 flex justify-end">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774]"
              >
                {isLoading ? 'Creando...' : 'Generar Credencial'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
             <div className="bg-[#F7F6F3] p-4 rounded-md border border-[#E9E9E7]">
               <h4 className="font-medium text-[#37352F] flex items-center gap-2 mb-2">
                 <FileText className="w-4 h-4" /> Formato CSV Estudiantes
               </h4>
               <p className="text-sm text-[#787774] mb-2">
                 El archivo CSV debe tener las siguientes cabeceras exactamente:
               </p>
               <code className="block bg-white p-2 rounded border border-[#E9E9E7] text-xs font-mono text-[#37352F] mb-3">
                 nombre_completo,tipo_documento,numero_documento,correo,grado,fecha_nacimiento
               </code>
               <div className="text-xs text-[#787774] space-y-1 mt-2">
                 <p><span className="font-semibold text-[#37352F]">tipo_documento</span> — CC, TI, CE o PA</p>
                 <p><span className="font-semibold text-[#37352F]">correo</span> — opcional</p>
                 <p><span className="font-semibold text-[#37352F]">grado</span> — opcional (ej: 10°)</p>
                 <p><span className="font-semibold text-[#37352F]">fecha_nacimiento</span> — opcional, formato YYYY-MM-DD</p>
               </div>
             </div>
             
             {previewResult ? (
               <form onSubmit={handleConfirmBatch} className="space-y-4">
                 {/* Resumen de validación */}
                 <div className={`${previewResult.total_valid > 0 ? 'bg-[#EEF7F4] border-[#0F7B6C]/30' : 'bg-[#FDEEEE] border-[#F4BDBD]'} border rounded-md p-4 text-sm`}>
                   <div className="flex items-center gap-2 mb-1">
                     {previewResult.total_valid > 0
                       ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" />
                       : <AlertCircle className="w-4 h-4 text-[#E03E3E]" />}
                     <span className={`font-semibold ${previewResult.total_valid > 0 ? 'text-[#0F7B6C]' : 'text-[#E03E3E]'}`}>
                       Revisión del archivo
                     </span>
                   </div>
                   <p className="text-[#787774] mt-1">
                     <span className="font-semibold text-[#0F7B6C]">{previewResult.total_valid}</span> válido(s)
                     &nbsp;·&nbsp;
                     <span className="font-semibold text-[#D9730D]">{previewResult.total_errors}</span> con errores
                   </p>
                 </div>

                 {previewResult.errors && previewResult.errors.length > 0 && (
                   <div className="border border-[#E9E9E7] rounded-md p-3 max-h-44 overflow-y-auto">
                     <p className="text-xs font-semibold text-[#787774] uppercase tracking-wider mb-2">Errores a corregir</p>
                     <ul className="space-y-1 text-xs text-[#E03E3E]">
                       {previewResult.errors.slice(0, 20).map((e: any, idx: number) => (
                         <li key={idx}>Fila {e.row}: {e.error}</li>
                       ))}
                       {previewResult.errors.length > 20 && (
                         <li className="text-[#9B9A97]">… y {previewResult.errors.length - 20} más</li>
                       )}
                     </ul>
                   </div>
                 )}

                 <div>
                   <label className="block text-sm font-medium text-[#787774] mb-1">
                     Asignar todo el lote a un Profesor (Opcional)
                   </label>
                   <select
                     value={assignedTeacherId}
                     onChange={(e) => setAssignedTeacherId(e.target.value)}
                     className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                   >
                     <option value="">-- Sin asignar --</option>
                     {(teachers || []).map(t => (
                       <option key={t.id} value={t.id}>{t.full_name}</option>
                     ))}
                   </select>
                 </div>

                 <div className="flex justify-end gap-2 pt-1">
                   <button
                     type="button"
                     onClick={() => { setPreviewResult(null); setPreviewPendingFile(null); setMessage(''); }}
                     disabled={isLoading}
                     className="px-4 py-2.5 text-sm border border-[#E9E9E7] rounded hover:bg-[#F7F6F3] text-[#787774] disabled:opacity-50"
                   >
                     Elegir otro archivo
                   </button>
                   <button
                     type="submit"
                     disabled={isLoading || previewResult.total_valid === 0}
                     className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774]"
                   >
                     {isLoading ? 'Creando...' : `Confirmar y crear (${previewResult.total_valid})`}
                   </button>
                 </div>
               </form>
             ) : (
               <form onSubmit={handleReviewBatch} className="space-y-4">
                 <div>
                   <label className="block text-sm font-medium text-[#787774] mb-2">
                     Subir archivo (.csv)
                   </label>
                   <input
                     type="file"
                     accept=".csv"
                     ref={previewFileInputRef}
                     onChange={() => { setMessage(''); setError(''); }}
                     className="block w-full text-sm text-[#787774]
                       file:mr-4 file:py-2 file:px-4
                       file:rounded file:border-0
                       file:text-sm file:font-semibold
                       file:bg-[#F7F6F3] file:text-[#37352F]
                       hover:file:bg-[#E9E9E7] cursor-pointer
                       border border-[#E9E9E7] rounded-md p-2 transition-colors"
                   />
                 </div>

                 <div>
                   <label className="block text-sm font-medium text-[#787774] mb-1">
                     Asignar todo el lote a un Profesor (Opcional)
                   </label>
                   <select
                     value={assignedTeacherId}
                     onChange={(e) => setAssignedTeacherId(e.target.value)}
                     className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                   >
                     <option value="">-- Sin asignar --</option>
                     {(teachers || []).map(t => (
                       <option key={t.id} value={t.id}>{t.full_name}</option>
                     ))}
                   </select>
                 </div>

                 <div className="pt-2 flex justify-end">
                   <button
                     type="submit"
                     disabled={isLoading}
                     className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white text-sm font-medium rounded hover:bg-primary/90 transition-all shadow-md disabled:bg-[#E9E9E7] disabled:text-[#787774]"
                   >
                     {isLoading ? 'Revisando...' : 'Revisar lote antes de crear'}
                   </button>
                 </div>
               </form>
             )}
          </div>
        )}
      </div>

      <CredentialsTable 
        credentials={newCredentials} 
        title="Nuevas Credenciales Generadas" 
        icon={GraduationCap} 
      />

      {/* Lista persistente de estudiantes existentes */}
      {(existingStudents.length > 0 || loadingList) && (
        <div className="mt-6 bg-white border border-[#E9E9E7] rounded-lg overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-[#E9E9E7] bg-[#F7F6F3] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#37352F]" />
              <h3 className="font-medium text-[#37352F]">Todos los Estudiantes Registrados</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectAllStudents}
                className="text-xs text-[#37352F] bg-white border border-[#E9E9E7] rounded px-2 py-1 hover:bg-[#F7F6F3]"
              >
                {selectedStudentIds.length === existingStudents.length && existingStudents.length > 0 ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
              <button
                onClick={() => {
                  const selected = existingStudents.filter(s => selectedStudentIds.includes(s.id));
                  if (!selected.length) return;
                  const text = selected.map(s => `Usuario: ${s.username}\nNombre: ${s.full_name || '-'}\nDocumento: ${s.document_type || ''} ${s.document_number || ''}\nGrado: ${s.grade || '-'}\nEstado: ${s.is_active ? 'Activo' : 'Inactivo'}`).join('\n\n');
                  navigator.clipboard.writeText(text);
                }}
                disabled={selectedStudentIds.length === 0}
                className="text-xs text-[#37352F] bg-white border border-[#E9E9E7] rounded px-2 py-1 hover:bg-[#F7F6F3] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Copiar seleccionados
              </button>
              <button
                onClick={async () => {
                  if (!selectedStudentIds.length) return;
                  try {
                    await api.post('/super/students/bulk-delete', { ids: selectedStudentIds });
                    setSelectedStudentIds([]);
                    await loadStudents();
                    setMessage('Estudiantes seleccionados eliminados correctamente.');
                  } catch (err: any) {
                    setError(err.response?.data?.detail || 'No se pudieron eliminar los estudiantes seleccionados.');
                  }
                }}
                disabled={selectedStudentIds.length === 0}
                className="text-xs text-[#B42318] bg-white border border-[#F3C7C3] rounded px-2 py-1 hover:bg-[#FEF3F2] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Borrar seleccionados
              </button>
              <span className="text-xs text-[#787774]">{existingStudents.length} estudiante(s)</span>
            </div>
          </div>
          {loadingList ? (
            <div className="p-6 text-center text-sm text-[#787774]">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-white">
                <thead className="bg-[#F7F6F3]/50">
                  <tr>
                    <th className="pl-6 pr-2 py-3">
                      <input type="checkbox" checked={selectedStudentIds.length === existingStudents.length && existingStudents.length > 0} onChange={toggleSelectAllStudents} className="w-4 h-4 accent-[#0B6E99] cursor-pointer" />
                    </th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Grado</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Estado</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E9E7]">
                  {existingStudents.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                      <td className="pl-6 pr-2 py-3">
                        <input type="checkbox" checked={selectedStudentIds.includes(s.id)} onChange={() => toggleStudentSelection(s.id)} className="w-4 h-4 accent-[#0B6E99] cursor-pointer" />
                      </td>
                      <td className="px-6 py-3 text-sm text-[#37352F] font-medium">{s.full_name}</td>
                      <td className="px-6 py-3 text-sm font-mono text-[#37352F]">{s.username}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{s.document_type} {s.document_number}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{s.grade || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {s.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => copyStudentCredentials(s)} className="p-2 hover:bg-[#F7F6F3] rounded text-[#787774] hover:text-[#37352F]" title="Copiar credencial">
                            {copiedStudentId === s.id ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4" />}
                          </button>
                          <button onClick={() => setEditingStudent(s)} className="p-2 hover:bg-[#F7F6F3] rounded text-[#787774] hover:text-[#37352F]" title="Editar estudiante">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteStudentId(s.id)} className="p-2 hover:bg-[#FEF3F2] rounded text-[#787774] hover:text-[#B42318]" title="Eliminar estudiante">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {deleteStudentId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-[#191919] mb-2">Eliminar estudiante</h3>
            <p className="text-sm text-[#787774] mb-4">¿Seguro que quieres eliminar este estudiante? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteStudentId(null)} className="px-4 py-2 border border-[#E9E9E7] rounded-md text-sm text-[#787774]">Cancelar</button>
              <button onClick={deleteStudent} disabled={deletingStudent} className="px-4 py-2 bg-[#B42318] text-white rounded-md text-sm hover:bg-[#912018] disabled:opacity-50">
                {deletingStudent ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingStudent && (
        <EditUserModal
          title={`Editar Estudiante — ${editingStudent.full_name || editingStudent.username}`}
          saving={savingStudent}
          onSave={updateStudent}
          onCancel={() => setEditingStudent(null)}
          initial={{
            full_name: editingStudent.full_name || '',
            email: editingStudent.email || '',
            grade: editingStudent.grade || '',
            birth_date: editingStudent.birth_date || '',
            document_type: editingStudent.document_type || 'TI',
            is_active: editingStudent.is_active,
          }}
          fields={[
            { key: 'full_name', label: 'Nombre completo', required: true },
            { key: 'email', label: 'Correo electrónico', type: 'email' },
            { key: 'grade', label: 'Grado' },
            { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date' },
            {
              key: 'document_type', label: 'Tipo de documento', type: 'select',
              options: [
                { value: 'TI', label: 'TI — Tarjeta de Identidad' },
                { value: 'CC', label: 'CC — Cédula de Ciudadanía' },
                { value: 'CE', label: 'CE — Cédula de Extranjería' },
                { value: 'PA', label: 'PA — Pasaporte' },
              ],
            },
            {
              key: 'is_active', label: 'Estado', type: 'select',
              options: [
                { value: true, label: 'Activo' },
                { value: false, label: 'Inactivo' },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
