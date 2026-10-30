import { useState, useRef, useEffect } from 'react';
import { Users, GraduationCap, Upload, Plus, Download, Copy, CheckCircle, AlertCircle, FileText, Hash, Mail, User, Trash2, Pencil, X } from 'lucide-react';
import api from '../../../services/api';
import { FieldError } from '../../../components/FieldError';
import { useFieldErrors } from '../../../hooks/useFieldErrors';
import { fieldA11y, focusFirstInvalid } from '../../../utils/formFields';
import {
  DOCUMENT_TYPES, apiErrorMessage, apiFieldErrors, documentInputHint, escapeHtml,
  filterDocumentInput, isDocumentType, normalizeEmail, normalizePersonName, todayISO,
  validateBirthDate, validateDocumentNumber, validateEmail, validateFile, validateGrade,
  validatePersonName, validateText,
  type DocumentType, type FieldError as FieldErrorText,
} from '../../../utils/validation';

// ── Utilidad: imprime solo las credenciales en una ventana nueva ─────────────
// Los datos se escapan: un nombre cargado por CSV como «<img onerror=…>» se
// ejecutaría en la ventana nueva, que comparte origen (y sesión) con la app.
function printCredentials(credentials: any[], title: string) {
  const rows = credentials.map((c, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHtml(c.full_name || '-')}</td>
      <td class="mono">${escapeHtml(c.username)}</td>
      <td class="pwd">${escapeHtml(c.temp_password)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8"/>
    <title>Credenciales — ${escapeHtml(title)}</title>
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
    <p class="sub">${escapeHtml(title)} — ${new Date().toLocaleDateString('es-CO')}</p>
    <table>
      <thead><tr><th>#</th><th>Nombre completo</th><th>Usuario</th><th>Contraseña temporal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="footer">NeuroLearn AI — Documento confidencial. Entrega personal al usuario.</p>
    </body></html>`;

  const w = window.open('', '_blank', 'width=860,height=620');
  if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
}

// ── Plantillas de carga masiva ───────────────────────────────────────────────
// Encabezados iguales a los que exige el importador (api/credentials.py:
// TEACHER_CSV_COLUMNS / STUDENT_CSV_COLUMNS). La fila de ejemplo cumple sus
// validaciones; hay que reemplazarla por los datos reales.
const TEACHER_TEMPLATE = {
  filename: 'plantilla_profesores.csv',
  headers: 'nombre_completo,tipo_documento,numero_documento,correo,area',
  example: 'Carlos Alvarez,CC,1234567890,carlos@colegio.edu.co,Matemáticas',
};
const STUDENT_TEMPLATE = {
  filename: 'plantilla_estudiantes.csv',
  headers: 'nombre_completo,tipo_documento,numero_documento,correo,grado,fecha_nacimiento,nombre_acudiente,fecha_autorizacion_acudiente,referencia_autorizacion',
  example: 'Ana Gómez,TI,1098765432,ana.gomez@colegio.edu.co,10°,2009-05-14,Nombre real del acudiente,2026-10-20,REF-ARCHIVO-REAL',
};

// ── Utilidad: genera y descarga un archivo CSV de plantilla ─────────────────
// Se genera en el navegador (no depende del servidor ni de archivos sueltos).
// - BOM UTF-8: sin él Excel abría «Martínez» como «MartÃ­nez».
// - La URL del blob se libera después: liberarla en el mismo instante del
//   clic cancelaba la descarga en algunos navegadores (Firefox, Safari), por
//   eso a veces «no aparecía» la plantilla.
function downloadCsvTemplate(template: { filename: string; headers: string; example: string }) {
  const content = `\uFEFF${template.headers}\r\n${template.example}\r\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = template.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function TemplateButton({ template }: { template: { filename: string; headers: string; example: string } }) {
  return (
    <button
      type="button"
      onClick={() => downloadCsvTemplate(template)}
      className="text-sm text-primary hover:underline flex items-center gap-1">
      <Download className="w-3 h-3" /> Descargar plantilla ({template.filename})
    </button>
  );
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
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copyError, setCopyError] = useState(false);

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
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(`Usuario: ${cred.username} | Pass: ${cred.temp_password}`);
                        setCopiedIndex(idx);
                        setCopyError(false);
                        window.setTimeout(() => setCopiedIndex(current => current === idx ? null : current), 1500);
                      } catch {
                        setCopiedIndex(null);
                        setCopyError(true);
                      }
                    }}
                    className="text-[#787774] hover:text-[#37352F] transition-colors flex items-center gap-1 justify-end ml-auto"
                    title="Copiar credenciales"
                  >
                    {copiedIndex === idx ? <CheckCircle className="w-4 h-4 text-[#0F7B6C]" /> : <Copy className="w-4 h-4" />}
                    <span className="text-xs">{copiedIndex === idx ? 'Copiadas' : 'Copiar'}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {copyError && (
        <p className="px-6 py-2 text-xs text-[#A33A3A] bg-[#FDF4F4] border-t border-[#F2C6C6]">
          No se pudieron copiar las credenciales. Revisa los permisos del portapapeles e inténtalo de nuevo.
        </p>
      )}
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

// ── Carga masiva: el archivo debe ser CSV de texto (igual que el backend) ────
const CSV_MAX_BYTES = 1024 * 1024;

function csvFileError(file: File | undefined): string | null {
  if (!file) return 'Selecciona un archivo CSV.';
  return validateFile(file, { extensions: ['.csv', '.txt'], maxBytes: CSV_MAX_BYTES, label: 'El archivo' });
}

// Nombres de los campos del backend → campos de los formularios individuales.
const PERSON_FIELD_MAP = {
  full_name: 'lastName', document_number: 'documentNumber', document_type: 'documentNumber',
  email: 'email', subject_area: 'subjectArea', grade: 'grade', birth_date: 'birthDate',
};

// ── Modal de edición reutilizable (docentes / estudiantes) ───────────────────
interface EditField {
  key: string;
  label: string;
  type?: 'text' | 'select' | 'date' | 'email';
  required?: boolean;
  options?: { value: string | number | boolean; label: string }[];
  maxLength?: number;
  max?: string;
  autoComplete?: string;
  validate?: (value: string) => FieldErrorText;
}

interface EditUserModalProps {
  title: string;
  fields: EditField[];
  initial: Record<string, any>;
  saving: boolean;
  serverErrors?: Record<string, string>;
  onSave: (values: Record<string, any>) => void;
  onCancel: () => void;
}

function EditUserModal({ title, fields, initial, saving, serverErrors, onSave, onCancel }: EditUserModalProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<Record<string, any>>(() => {
    const v: Record<string, any> = {};
    fields.forEach(f => { v[f.key] = initial[f.key] ?? ''; });
    return v;
  });
  const rules = Object.fromEntries(
    fields.map(f => [f.key, (value: string) => (f.validate ? f.validate(value) : null)]),
  ) as Record<string, (value: string) => FieldErrorText>;
  const { errors, setErrors, onBlur, onChange, validateAll } = useFieldErrors(rules);

  useEffect(() => {
    if (serverErrors && Object.keys(serverErrors).length) {
      setErrors(serverErrors);
      focusFirstInvalid(formRef.current);
    }
  }, [serverErrors, setErrors]);

  const setValue = (key: string, val: any) => {
    setValues(prev => ({ ...prev, [key]: val }));
    onChange(key, String(val ?? ''));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const asText = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v ?? '')]));
    if (!validateAll(asText)) {
      focusFirstInvalid(formRef.current);
      return;
    }
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
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-5 space-y-4">
            {fields.map(f => {
              const id = `edit-${f.key}`;
              const error = errors[f.key];
              return (
                <div key={f.key}>
                  <label htmlFor={id} className="block text-sm font-medium text-[#787774] mb-1">
                    {f.label}{f.required && <span className="text-[#E03E3E]" aria-hidden="true"> *</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select
                      id={id}
                      value={String(values[f.key] ?? '')}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                    >
                      {f.options?.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      {...fieldA11y(id, error)}
                      type={f.type || 'text'}
                      value={values[f.key] ?? ''}
                      onChange={(e) => setValue(f.key, e.target.value)}
                      onBlur={(e) => onBlur(f.key, e.target.value)}
                      required={f.required}
                      maxLength={f.maxLength}
                      max={f.max}
                      autoComplete={f.autoComplete ?? 'off'}
                      className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${error ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                    />
                  )}
                  <FieldError id={id} error={error} />
                </div>
              );
            })}
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

export function TeachersTab() {
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
  const [editTeacherErrors, setEditTeacherErrors] = useState<Record<string, string>>({});

  const updateTeacher = async (values: Record<string, any>) => {
    if (!editingTeacher) return;
    setSavingTeacher(true);
    setMessage('');
    setError('');
    setEditTeacherErrors({});
    try {
      const payload: Record<string, any> = {};
      const fullName = normalizePersonName(values.full_name ?? '');
      if (fullName && fullName !== editingTeacher.full_name) {
        payload.full_name = fullName;
      }
      if (normalizeEmail(values.email ?? '') !== (editingTeacher.email || '').toLowerCase()) {
        payload.email = normalizeEmail(values.email ?? '');
      }
      if ((values.subject_area ?? '').trim() !== (editingTeacher.subject_area || '')) {
        payload.subject_area = (values.subject_area ?? '').trim();
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
      setEditTeacherErrors(apiFieldErrors(err));
      setError(err?.response ? apiErrorMessage(err, 'No se pudo actualizar el profesor.') : (err.message || 'No se pudo actualizar el profesor.'));
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
    } catch {
      setError('No se pudieron cargar los profesores. Inténtalo de nuevo.');
    }
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
      setError('');
      setMessage(`Credenciales de ${teacher.full_name || teacher.username} copiadas correctamente.`);
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
      setError(apiErrorMessage(err, 'No se pudo eliminar el profesor.'));
    } finally {
      setDeletingTeacher(false);
    }
  };

  // Individual Form
  const [firstName, setFirstName]       = useState('');
  const [lastName, setLastName]         = useState('');
  const [email, setEmail]               = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('CC');
  const [subjectArea, setSubjectArea]   = useState('');
  const [docNotice, setDocNotice]       = useState('');
  const teacherFormRef = useRef<HTMLFormElement>(null);
  const teacherForm = { firstName, lastName, documentNumber, email, subjectArea };
  const fields = useFieldErrors<keyof typeof teacherForm>({
    firstName: v => validatePersonName(v, { label: 'El nombre', max: 60 }),
    lastName: v => validatePersonName(v, { label: 'El apellido', max: 60 })
      ?? (normalizePersonName(`${firstName} ${v}`).length > 100 ? 'El nombre completo no puede superar 100 caracteres.' : null),
    documentNumber: v => validateDocumentNumber(v, documentType),
    email: v => validateEmail(v),
    subjectArea: v => validateText(v, { label: 'El área de enseñanza', max: 100, required: false }),
  });

  const onDocumentInput = (raw: string, type: DocumentType = documentType) => {
    const { value, removed } = filterDocumentInput(raw, type);
    setDocumentNumber(value);
    setDocNotice(removed ? `Se quitaron caracteres no permitidos. ${documentInputHint(type)}` : '');
    fields.onChange('documentNumber', value);
  };

  const handleCreateIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.validateAll(teacherForm)) {
      focusFirstInvalid(teacherFormRef.current);
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/super/teachers', {
        full_name: normalizePersonName(`${firstName} ${lastName}`),
        document_type: documentType,
        document_number: documentNumber.trim(),
        email: normalizeEmail(email),
        subject_area: subjectArea.trim(),
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
      setDocNotice('');
      fields.reset();
    } catch (err: any) {
      const byField = apiFieldErrors(err, PERSON_FIELD_MAP);
      if (Object.keys(byField).length) {
        fields.setErrors(byField);
        focusFirstInvalid(teacherFormRef.current);
      }
      setError(apiErrorMessage(err, 'Error al crear el profesor'));
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 1 de la carga masiva: validar el archivo (preview) sin crear usuarios.
  const handleReviewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = previewFileInputRef.current?.files?.[0];
    const fileError = csvFileError(file);
    if (fileError || !file) {
      setError(fileError ?? 'Selecciona un archivo CSV.');
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
      setError(apiErrorMessage(err, 'Error al revisar el archivo CSV'));
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
      setError(apiErrorMessage(err, 'Error al procesar el archivo CSV'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 border-b border-[#E9E9E7] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center gap-2">
            <Users className="w-6 h-6" /> Gestión de Profesores
          </h2>
          <p className="text-sm text-[#787774] mt-1">
            Crea credenciales B2B para tus profesores.
          </p>
        </div>
        <div className="text-sm font-medium bg-[#F7F6F3] p-2 px-4 rounded border border-[#E9E9E7] shadow-sm">
          Profesores registrados: <span className="text-primary">{loadingList ? '…' : existingTeachers.length}</span>
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
          <form ref={teacherFormRef} onSubmit={handleCreateIndividual} className="space-y-4" noValidate>
            <h3 className="font-medium text-[#37352F] mb-4 border-b border-[#E9E9E7] pb-2">Datos del Profesor</h3>
            <p className="text-xs text-[#9B9A97] -mt-2">Los campos marcados con * son obligatorios.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="teacher-firstName" className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Nombre *
                </label>
                <input
                  {...fieldA11y('teacher-firstName', fields.errors.firstName)}
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); fields.onChange('firstName', e.target.value); }}
                  onBlur={(e) => fields.onBlur('firstName', e.target.value)}
                  autoComplete="off"
                  maxLength={60}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.firstName ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: Carlos"
                  required
                />
                <FieldError id="teacher-firstName" error={fields.errors.firstName} />
              </div>
              <div>
                <label htmlFor="teacher-lastName" className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Apellido *
                </label>
                <input
                  {...fieldA11y('teacher-lastName', fields.errors.lastName)}
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); fields.onChange('lastName', e.target.value); }}
                  onBlur={(e) => fields.onBlur('lastName', e.target.value)}
                  autoComplete="off"
                  maxLength={60}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.lastName ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: Martínez"
                  required
                />
                <FieldError id="teacher-lastName" error={fields.errors.lastName} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="teacher-documentType" className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Tipo de documento *
                </label>
                <select
                  id="teacher-documentType"
                  value={documentType}
                  onChange={(e) => {
                    const type = isDocumentType(e.target.value) ? e.target.value : 'CC';
                    setDocumentType(type);
                    onDocumentInput(documentNumber, type);
                    if (documentNumber) fields.setOne('documentNumber', validateDocumentNumber(filterDocumentInput(documentNumber, type).value, type));
                  }}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                  required
                >
                  {DOCUMENT_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="teacher-documentNumber" className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Número de documento *
                </label>
                <input
                  {...fieldA11y('teacher-documentNumber', fields.errors.documentNumber, docNotice || documentInputHint(documentType))}
                  type="text"
                  inputMode={documentType === 'PA' ? 'text' : 'numeric'}
                  autoComplete="off"
                  value={documentNumber}
                  onChange={(e) => onDocumentInput(e.target.value)}
                  onBlur={(e) => fields.onBlur('documentNumber', e.target.value)}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-mono ${fields.errors.documentNumber ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: 1234567890"
                  required
                />
                <FieldError id="teacher-documentNumber" error={fields.errors.documentNumber} hint={docNotice || documentInputHint(documentType)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="teacher-email" className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Correo electrónico *
                </label>
                <input
                  {...fieldA11y('teacher-email', fields.errors.email)}
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  maxLength={100}
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); fields.onChange('email', e.target.value); }}
                  onBlur={(e) => fields.onBlur('email', e.target.value)}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.email ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="profesor@colegio.edu.co"
                  required
                />
                <FieldError id="teacher-email" error={fields.errors.email} />
              </div>
              <div>
                <label htmlFor="teacher-subjectArea" className="block text-sm font-medium text-[#787774] mb-1 flex items-center gap-1">
                  <User className="w-3 h-3" /> Área de enseñanza (opcional)
                </label>
                <input
                  {...fieldA11y('teacher-subjectArea', fields.errors.subjectArea)}
                  type="text"
                  maxLength={100}
                  value={subjectArea}
                  onChange={(e) => { setSubjectArea(e.target.value); fields.onChange('subjectArea', e.target.value); }}
                  onBlur={(e) => fields.onBlur('subjectArea', e.target.value)}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.subjectArea ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: Matemáticas"
                />
                <FieldError id="teacher-subjectArea" error={fields.errors.subjectArea} />
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
               <code className="block bg-white p-2 rounded border border-[#E9E9E7] text-xs font-mono text-[#37352F] mb-3 break-all">
                 {TEACHER_TEMPLATE.headers}
               </code>
               <div className="text-xs text-[#787774] space-y-1 mt-2">
                 <p><span className="font-semibold text-[#37352F]">tipo_documento</span> — CC, TI, CE o PA</p>
                 <p><span className="font-semibold text-[#37352F]">correo</span> — obligatorio para profesores</p>
                 <p><span className="font-semibold text-[#37352F]">area</span> — opcional (ej: Matemáticas)</p>
               </div>
               <p className="text-xs text-[#787774] mt-2 mb-2">
                 Separador coma o punto y coma (Excel en español). Reemplaza la fila de ejemplo por tus datos antes de subirla.
               </p>
               <TemplateButton template={TEACHER_TEMPLATE} />
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
                     accept=".csv,text/csv"
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
                    setError(apiErrorMessage(err, 'No se pudieron eliminar los profesores seleccionados.'));
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
                          <button onClick={() => copyTeacherCredentials(t)} className="p-2 hover:bg-[#F7F6F3] rounded text-[#787774] hover:text-[#37352F]" title={copiedTeacherId === t.id ? "Credenciales copiadas" : "Copiar credencial"} aria-label={copiedTeacherId === t.id ? "Credenciales copiadas" : "Copiar credencial"}>
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
        <div className="fixed inset-0 p-4 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-h-[90dvh] overflow-y-auto max-w-md">
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
          serverErrors={editTeacherErrors}
          onSave={updateTeacher}
          onCancel={() => { setEditingTeacher(null); setEditTeacherErrors({}); }}
          initial={{
            full_name: editingTeacher.full_name || '',
            email: editingTeacher.email || '',
            subject_area: editingTeacher.subject_area || '',
            document_type: editingTeacher.document_type || 'CC',
            is_active: editingTeacher.is_active,
          }}
          fields={[
            { key: 'full_name', label: 'Nombre completo', required: true, maxLength: 100,
              validate: v => validatePersonName(v, { label: 'El nombre completo' }) },
            { key: 'email', label: 'Correo electrónico', type: 'email', required: true, maxLength: 100,
              validate: v => validateEmail(v) },
            { key: 'subject_area', label: 'Área de enseñanza', maxLength: 100,
              validate: v => validateText(v, { label: 'El área de enseñanza', max: 100, required: false }) },
            {
              key: 'document_type', label: 'Tipo de documento', type: 'select',
              options: DOCUMENT_TYPES,
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

export function StudentsTab() {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');
  // Grupos activos de la institución donde se puede inscribir un lote.
  const [classroomOptions, setClassroomOptions] = useState<{ id: number; name: string; teacher: string; students: number }[]>([]);
  useEffect(() => {
    api.get('/super/classrooms')
      .then(r => setClassroomOptions((r.data.classrooms ?? []).filter((c: any) => c.status === 'activo')))
      .catch(() => setClassroomOptions([]));
  }, []);
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
  const [editStudentErrors, setEditStudentErrors] = useState<Record<string, string>>({});

  const updateStudent = async (values: Record<string, any>) => {
    if (!editingStudent) return;
    setSavingStudent(true);
    setMessage('');
    setError('');
    setEditStudentErrors({});
    try {
      const payload: Record<string, any> = {};
      const fullName = normalizePersonName(values.full_name ?? '');
      if (fullName && fullName !== editingStudent.full_name) {
        payload.full_name = fullName;
      }
      // Correo vacío = sin correo (el servidor le asigna una dirección interna).
      if (normalizeEmail(values.email ?? '') !== (editingStudent.email || '').toLowerCase()) {
        payload.email = normalizeEmail(values.email ?? '');
      }
      if ((values.grade ?? '').trim() !== (editingStudent.grade || '')) {
        payload.grade = (values.grade ?? '').trim();
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
      if (normalizePersonName(values.guardian_name ?? '') !== (editingStudent.guardian_name || '')) {
        payload.guardian_name = normalizePersonName(values.guardian_name ?? '');
      }
      const guardianAuthorized = values.guardian_authorized === true || values.guardian_authorized === 'true';
      if (guardianAuthorized !== Boolean(editingStudent.guardian_authorized)) {
        payload.guardian_authorized = guardianAuthorized;
      }
      if (Object.keys(payload).length === 0) {
        throw new Error('No hay cambios para guardar.');
      }
      await api.put(`/super/students/${editingStudent.id}`, payload);
      setMessage('Estudiante actualizado correctamente.');
      setEditingStudent(null);
      await loadStudents();
    } catch (err: any) {
      setEditStudentErrors(apiFieldErrors(err));
      setError(err?.response ? apiErrorMessage(err, 'No se pudo actualizar el estudiante.') : (err.message || 'No se pudo actualizar el estudiante.'));
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
    } catch {
      setError('No se pudieron cargar los estudiantes. Inténtalo de nuevo.');
    }
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
      setError('');
      setMessage(`Credenciales de ${student.full_name || student.username} copiadas correctamente.`);
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
      setError(apiErrorMessage(err, 'No se pudo eliminar el estudiante.'));
    } finally {
      setDeletingStudent(false);
    }
  };

// Individual Form
  const [firstName, setFirstName]           = useState('');
  const [lastName, setLastName]             = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [documentType, setDocumentType]     = useState<DocumentType>('TI');
  const [grade, setGrade]                   = useState('');
  const [birthDate, setBirthDate]           = useState('');
  const [guardianAuthorizationConfirmed, setGuardianAuthorizationConfirmed] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianConsentDate, setGuardianConsentDate] = useState('');
  const [guardianAuthorizationReference, setGuardianAuthorizationReference] = useState('');
  const [batchAuthorizationConfirmed, setBatchAuthorizationConfirmed] = useState(false);
  const [assignedClassroomId, setAssignedClassroomId] = useState('');
  const [docNotice, setDocNotice]           = useState('');
  const studentFormRef = useRef<HTMLFormElement>(null);
  const studentForm = { firstName, lastName, documentNumber, grade, birthDate };
  const birth = birthDate ? new Date(`${birthDate}T00:00:00`) : null;
  const today = new Date();
  const studentAge = birth
    ? today.getFullYear() - birth.getFullYear() -
      ((today.getMonth() < birth.getMonth() ||
        (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) ? 1 : 0)
    : null;
  const guardianRequired = studentAge === null || studentAge < 18;
  const fields = useFieldErrors<keyof typeof studentForm>({
    firstName: v => validatePersonName(v, { label: 'El nombre', max: 60 }),
    lastName: v => validatePersonName(v, { label: 'El apellido', max: 60 })
      ?? (normalizePersonName(`${firstName} ${v}`).length > 100 ? 'El nombre completo no puede superar 100 caracteres.' : null),
    documentNumber: v => validateDocumentNumber(v, documentType),
    grade: v => validateGrade(v),
    birthDate: v => validateBirthDate(v),
  });

  const onDocumentInput = (raw: string, type: DocumentType = documentType) => {
    const { value, removed } = filterDocumentInput(raw, type);
    setDocumentNumber(value);
    setDocNotice(removed ? `Se quitaron caracteres no permitidos. ${documentInputHint(type)}` : '');
    fields.onChange('documentNumber', value);
  };

  const handleCreateIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fields.validateAll(studentForm)) {
      focusFirstInvalid(studentFormRef.current);
      return;
    }
    if (!guardianAuthorizationConfirmed) {
      setError('Confirma que la autorización del acudiente está verificada o que no aplica por mayoría de edad.');
      return;
    }
    if (guardianRequired && (!guardianName.trim() || !guardianConsentDate || !guardianAuthorizationReference.trim())) {
      setError('Para menores o sin fecha de nacimiento registra nombre, fecha y referencia del soporte real de autorización.');
      return;
    }

    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await api.post('/super/students', {
        full_name: normalizePersonName(`${firstName} ${lastName}`),
        document_type: documentType,
        document_number: documentNumber.trim(),
        grade: grade.trim(),
        birth_date: birthDate || null,
        guardian_authorization_confirmed: guardianAuthorizationConfirmed,
        guardian_name: guardianRequired ? guardianName.trim() : null,
        guardian_consent_date: guardianRequired ? guardianConsentDate : null,
        guardian_authorization_reference: guardianRequired ? guardianAuthorizationReference.trim() : null,
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
      setGuardianAuthorizationConfirmed(false);
      setGuardianName('');
      setGuardianConsentDate('');
      setGuardianAuthorizationReference('');
      setDocNotice('');
      fields.reset();
    } catch (err: any) {
      const byField = apiFieldErrors(err, PERSON_FIELD_MAP);
      if (Object.keys(byField).length) {
        fields.setErrors(byField);
        focusFirstInvalid(studentFormRef.current);
      }
      setError(apiErrorMessage(err, 'Error al crear el estudiante'));
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 1 de la carga masiva: validar el archivo (preview) sin crear usuarios.
  const handleReviewBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = previewFileInputRef.current?.files?.[0];
    const fileError = csvFileError(file);
    if (fileError || !file) {
      setError(fileError ?? 'Selecciona un archivo CSV.');
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
      setError(apiErrorMessage(err, 'Error al revisar el archivo CSV'));
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
    if (assignedClassroomId) {
      formData.append('classroom_id', assignedClassroomId);
    }
    formData.append('authorization_confirmed', String(batchAuthorizationConfirmed));

    try {
      const response = await api.post('/super/students/bulk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = response.data;
      const enrolledText = d.classroom ? ` ${d.enrolled} inscrito(s) en «${d.classroom}».` : '';
      setMessage(`Se han creado ${d.total_created || 0} estudiante(s).${enrolledText} ${d.total_errors || 0} registro(s) con errores fueron omitidos.`);
      setNewCredentials(d.credentials || []);
      setPreviewResult(null);
      setPreviewPendingFile(null);
      setBatchAuthorizationConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (previewFileInputRef.current) previewFileInputRef.current.value = '';
      loadStudents();
    } catch (err: any) {
      setError(apiErrorMessage(err, 'Error al procesar el archivo CSV'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6 border-b border-[#E9E9E7] pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center gap-2">
            <GraduationCap className="w-6 h-6" /> Gestión de Estudiantes
          </h2>
          <p className="text-sm text-[#787774] mt-1">
            Genera credenciales temporales para estudiantes e inscríbelos en los grupos de tu institución.
          </p>
        </div>
        <div className="text-sm font-medium bg-[#F7F6F3] p-2 px-4 rounded border border-[#E9E9E7] shadow-sm">
          Estudiantes registrados: <span className="text-primary">{loadingList ? '…' : existingStudents.length}</span>
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
          <form ref={studentFormRef} onSubmit={handleCreateIndividual} className="space-y-4" noValidate>
            <h3 className="font-medium text-[#37352F] mb-4 border-b border-[#E9E9E7] pb-2">Datos del Estudiante</h3>
            <p className="text-xs text-[#9B9A97] -mt-2">Los campos marcados con * son obligatorios.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="student-firstName" className="block text-sm font-medium text-[#787774] mb-1">
                  Nombre *
                </label>
                <input
                  {...fieldA11y('student-firstName', fields.errors.firstName)}
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); fields.onChange('firstName', e.target.value); }}
                  onBlur={(e) => fields.onBlur('firstName', e.target.value)}
                  autoComplete="off"
                  maxLength={60}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.firstName ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: Valentina"
                  required
                />
                <FieldError id="student-firstName" error={fields.errors.firstName} />
              </div>
              <div>
                <label htmlFor="student-lastName" className="block text-sm font-medium text-[#787774] mb-1">
                  Apellido *
                </label>
                <input
                  {...fieldA11y('student-lastName', fields.errors.lastName)}
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); fields.onChange('lastName', e.target.value); }}
                  onBlur={(e) => fields.onBlur('lastName', e.target.value)}
                  autoComplete="off"
                  maxLength={60}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.lastName ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: Torres"
                  required
                />
                <FieldError id="student-lastName" error={fields.errors.lastName} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="student-documentType" className="block text-sm font-medium text-[#787774] mb-1">
                  Tipo de documento *
                </label>
                <select
                  id="student-documentType"
                  value={documentType}
                  onChange={(e) => {
                    const type = isDocumentType(e.target.value) ? e.target.value : 'TI';
                    setDocumentType(type);
                    onDocumentInput(documentNumber, type);
                    if (documentNumber) fields.setOne('documentNumber', validateDocumentNumber(filterDocumentInput(documentNumber, type).value, type));
                  }}
                  className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                  required
                >
                  {['TI', 'CC', 'CE', 'PA'].map(code => {
                    const d = DOCUMENT_TYPES.find(t => t.value === code)!;
                    return <option key={d.value} value={d.value}>{d.label}</option>;
                  })}
                </select>
              </div>
              <div>
                <label htmlFor="student-documentNumber" className="block text-sm font-medium text-[#787774] mb-1">
                  Número de documento *
                </label>
                <input
                  {...fieldA11y('student-documentNumber', fields.errors.documentNumber, docNotice || documentInputHint(documentType))}
                  type="text"
                  inputMode={documentType === 'PA' ? 'text' : 'numeric'}
                  autoComplete="off"
                  value={documentNumber}
                  onChange={(e) => onDocumentInput(e.target.value)}
                  onBlur={(e) => fields.onBlur('documentNumber', e.target.value)}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm font-mono ${fields.errors.documentNumber ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: 1234567890"
                  required
                />
                <FieldError id="student-documentNumber" error={fields.errors.documentNumber} hint={docNotice || documentInputHint(documentType)} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="student-grade" className="block text-sm font-medium text-[#787774] mb-1">
                  Grado (opcional)
                </label>
                <input
                  {...fieldA11y('student-grade', fields.errors.grade)}
                  type="text"
                  maxLength={20}
                  value={grade}
                  onChange={(e) => { setGrade(e.target.value); fields.onChange('grade', e.target.value); }}
                  onBlur={(e) => fields.onBlur('grade', e.target.value)}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.grade ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                  placeholder="Ej: 10°"
                />
                <FieldError id="student-grade" error={fields.errors.grade} />
              </div>
              <div>
                <label htmlFor="student-birthDate" className="block text-sm font-medium text-[#787774] mb-1">
                  Fecha de nacimiento (opcional)
                </label>
                <input
                  {...fieldA11y('student-birthDate', fields.errors.birthDate)}
                  type="date"
                  min="1900-01-01"
                  max={todayISO()}
                  value={birthDate}
                  onChange={(e) => { setBirthDate(e.target.value); fields.onChange('birthDate', e.target.value); }}
                  onBlur={(e) => fields.onBlur('birthDate', e.target.value)}
                  className={`w-full p-2 border rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm ${fields.errors.birthDate ? 'border-[#E03E3E]' : 'border-[#E9E9E7]'}`}
                />
                <FieldError id="student-birthDate" error={fields.errors.birthDate} />
              </div>
            </div>
            <div className="rounded-md border border-[#E9E9E7] bg-[#F7F6F3] p-4 space-y-3">
              <label className="flex items-start gap-2 text-sm text-[#37352F]">
                <input type="checkbox" checked={guardianAuthorizationConfirmed}
                  onChange={e => setGuardianAuthorizationConfirmed(e.target.checked)}
                  required className="mt-0.5 h-4 w-4 accent-[#0B6E99]" />
                <span>
                  Confirmo que he verificado la autorización previa, informada y válida del padre,
                  madre o acudiente cuando el estudiante es menor de edad; si es mayor de edad,
                  confirmo que la autorización de acudiente no aplica. Esta casilla registra mi
                  verificación institucional, no constituye la autorización del acudiente.
                </span>
              </label>
              {guardianRequired && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="text-xs font-medium text-[#787774]">
                    Nombre del acudiente *
                    <input value={guardianName} onChange={e => setGuardianName(e.target.value)}
                      maxLength={150} required className="mt-1 w-full rounded border border-[#E9E9E7] p-2 text-sm"
                      autoComplete="off" />
                  </label>
                  <label className="text-xs font-medium text-[#787774]">
                    Fecha de autorización *
                    <input type="date" value={guardianConsentDate} onChange={e => setGuardianConsentDate(e.target.value)}
                      max={todayISO()} required className="mt-1 w-full rounded border border-[#E9E9E7] p-2 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-[#787774]">
                    Referencia del soporte institucional *
                    <input value={guardianAuthorizationReference}
                      onChange={e => setGuardianAuthorizationReference(e.target.value)}
                      maxLength={100} required placeholder="Código real del expediente"
                      className="mt-1 w-full rounded border border-[#E9E9E7] p-2 text-sm" autoComplete="off" />
                  </label>
                </div>
              )}
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
               <code className="block bg-white p-2 rounded border border-[#E9E9E7] text-xs font-mono text-[#37352F] mb-3 break-all">
                 {STUDENT_TEMPLATE.headers}
               </code>
               <div className="text-xs text-[#787774] space-y-1 mt-2">
                 <p><span className="font-semibold text-[#37352F]">tipo_documento</span> — CC, TI, CE o PA</p>
                 <p><span className="font-semibold text-[#37352F]">correo</span> — opcional</p>
                 <p><span className="font-semibold text-[#37352F]">grado</span> — opcional (ej: 10°)</p>
                 <p><span className="font-semibold text-[#37352F]">fecha_nacimiento</span> — opcional, formato AAAA-MM-DD (también DD/MM/AAAA)</p>
                  <p><span className="font-semibold text-[#37352F]">nombre_acudiente, fecha_autorizacion_acudiente, referencia_autorizacion</span> — requeridos para menores o sin fecha de nacimiento; usa datos reales del soporte institucional.</p>
               </div>
               <p className="text-xs text-[#787774] mt-2 mb-2">
                 Separador coma o punto y coma (Excel en español). Reemplaza la fila de ejemplo por tus datos antes de subirla.
               </p>
               <TemplateButton template={STUDENT_TEMPLATE} />
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
                     Inscribir todo el lote en un grupo (opcional)
                   </label>
                   <select
                     value={assignedClassroomId}
                     onChange={(e) => setAssignedClassroomId(e.target.value)}
                     className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                   >
                     <option value="">-- Sin inscribir en un grupo --</option>
                     {classroomOptions.map(c => (
                       <option key={c.id} value={c.id}>{c.name} · {c.teacher} ({c.students} inscritos)</option>
                     ))}
                   </select>
                   <p className="text-[11px] text-[#9B9A97] mt-1">
                     El profesor del grupo verá a estos estudiantes en sus grupos y reportes.
                   </p>
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
                     accept=".csv,text/csv"
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

                 <label className="flex items-start gap-2 rounded-md border border-[#E9E9E7] bg-[#F7F6F3] p-3 text-sm text-[#37352F]">
                   <input type="checkbox" required checked={batchAuthorizationConfirmed}
                     onChange={e => setBatchAuthorizationConfirmed(e.target.checked)}
                     className="mt-0.5 h-4 w-4 accent-[#0B6E99]" />
                   <span>Confirmo que revisé cada fila y que las autorizaciones de acudiente aplicables existen y están respaldadas por la referencia registrada. Esta confirmación es mía y no sustituye la autorización real.</span>
                 </label>

                 <div>
                   <label className="block text-sm font-medium text-[#787774] mb-1">
                     Inscribir todo el lote en un grupo (opcional)
                   </label>
                   <select
                     value={assignedClassroomId}
                     onChange={(e) => setAssignedClassroomId(e.target.value)}
                     className="w-full p-2 border border-[#E9E9E7] rounded focus:ring-1 focus:ring-primary focus:border-primary transition-all text-sm bg-white"
                   >
                     <option value="">-- Sin inscribir en un grupo --</option>
                     {classroomOptions.map(c => (
                       <option key={c.id} value={c.id}>{c.name} · {c.teacher} ({c.students} inscritos)</option>
                     ))}
                   </select>
                   <p className="text-[11px] text-[#9B9A97] mt-1">
                     El profesor del grupo verá a estos estudiantes en sus grupos y reportes.
                   </p>
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
                    setError(apiErrorMessage(err, 'No se pudieron eliminar los estudiantes seleccionados.'));
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
                        {s.guardian_required && !s.guardian_authorized && (
                          <span
                            className="ml-1.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-700"
                            title="Menor de edad o sin fecha de nacimiento: no puede usar cámara ni micrófono hasta registrar la autorización del acudiente."
                          >
                            Falta autorización del acudiente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button onClick={() => copyStudentCredentials(s)} className="p-2 hover:bg-[#F7F6F3] rounded text-[#787774] hover:text-[#37352F]" title={copiedStudentId === s.id ? "Credenciales copiadas" : "Copiar credencial"} aria-label={copiedStudentId === s.id ? "Credenciales copiadas" : "Copiar credencial"}>
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
        <div className="fixed inset-0 p-4 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-h-[90dvh] overflow-y-auto max-w-md">
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
          serverErrors={editStudentErrors}
          onSave={updateStudent}
          onCancel={() => { setEditingStudent(null); setEditStudentErrors({}); }}
          initial={{
            full_name: editingStudent.full_name || '',
            email: editingStudent.email || '',
            grade: editingStudent.grade || '',
            birth_date: editingStudent.birth_date || '',
            document_type: editingStudent.document_type || 'TI',
            is_active: editingStudent.is_active,
            guardian_name: editingStudent.guardian_name || '',
            guardian_authorized: Boolean(editingStudent.guardian_authorized),
            guardian_consent_date: editingStudent.guardian_consent_date || '',
            guardian_authorization_reference: editingStudent.guardian_authorization_reference || '',
          }}
          fields={[
            { key: 'full_name', label: 'Nombre completo', required: true, maxLength: 100,
              validate: v => validatePersonName(v, { label: 'El nombre completo' }) },
            { key: 'email', label: 'Correo electrónico (opcional)', type: 'email', maxLength: 100,
              validate: v => validateEmail(v, { required: false }) },
            { key: 'grade', label: 'Grado', maxLength: 20, validate: v => validateGrade(v) },
            { key: 'birth_date', label: 'Fecha de nacimiento', type: 'date', max: todayISO(),
              validate: v => validateBirthDate(v) },
            {
              key: 'document_type', label: 'Tipo de documento', type: 'select',
              options: DOCUMENT_TYPES,
            },
            {
              key: 'is_active', label: 'Estado', type: 'select',
              options: [
                { value: true, label: 'Activo' },
                { value: false, label: 'Inactivo' },
              ],
            },
            // Ley 1581: los menores necesitan la autorización de su acudiente
            // para usar cámara y micrófono en el chat.
            { key: 'guardian_name', label: 'Acudiente que autorizó (madre, padre o acudiente)', maxLength: 150,
              validate: v => validatePersonName(v, { label: 'El nombre del acudiente', max: 150, required: false }) },
            { key: 'guardian_consent_date', label: 'Fecha de autorización del acudiente', type: 'date', max: todayISO() },
            { key: 'guardian_authorization_reference', label: 'Referencia del soporte institucional', maxLength: 100 },
            {
              key: 'guardian_authorized', label: 'Autorización firmada para cámara y micrófono', type: 'select',
              options: [
                { value: true, label: 'Sí, la institución la recibió' },
                { value: false, label: 'No' },
              ],
            },
          ]}
        />
      )}
    </div>
  );
}
