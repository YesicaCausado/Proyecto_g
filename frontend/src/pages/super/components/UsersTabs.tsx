import { useState, useRef, useEffect } from 'react';
import { Users, GraduationCap, Upload, Plus, Download, Copy, CheckCircle, AlertCircle, FileText, Hash, Mail, User } from 'lucide-react';
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

export function TeachersTab({ license }: { license: any }) {
  const [activeTab, setActiveTab] = useState<'individual' | 'batch'>('individual');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newCredentials, setNewCredentials] = useState<any[]>([]);
  const [existingTeachers, setExistingTeachers] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadTeachers = async () => {
    try {
      const res = await api.get('/super/teachers');
      setExistingTeachers(res.data || []);
    } catch { /* silencioso */ }
    finally { setLoadingList(false); }
  };

  useEffect(() => { loadTeachers(); }, []);

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

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0]) {
      setError('Por favor sube un archivo CSV');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    setError('');
    
    const formData = new FormData();
    formData.append('file', fileInputRef.current.files[0]);
    
    try {
      const response = await api.post('/super/teachers/bulk', formData, {
      headers: {
      'Content-Type': 'multipart/form-data',
      },
    });
      
      setMessage(`Se han procesado ${response.data.total_processed} profesores en lote.`);
      setNewCredentials(response.data.credentials);
      loadTeachers();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al procesar el archivo CSV');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
             
             <form onSubmit={handleCreateBatch} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-[#787774] mb-2">
                    Subir archivo (.csv)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
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
                   {isLoading ? 'Procesando...' : 'Cargar y Generar Lote'}
                 </button>
               </div>
             </form>
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
          <div className="px-6 py-4 border-b border-[#E9E9E7] bg-[#F7F6F3] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#37352F]" />
              <h3 className="font-medium text-[#37352F]">Todos los Profesores Registrados</h3>
            </div>
            <span className="text-xs text-[#787774]">{existingTeachers.length} profesor(es)</span>
          </div>
          {loadingList ? (
            <div className="p-6 text-center text-sm text-[#787774]">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-white">
                <thead className="bg-[#F7F6F3]/50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Correo</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Área</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E9E7]">
                  {existingTeachers.map((t: any) => (
                    <tr key={t.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

  const loadStudents = async () => {
    try {
      const res = await api.get('/super/students');
      setExistingStudents(res.data || []);
    } catch { /* silencioso */ }
    finally { setLoadingList(false); }
  };

  useEffect(() => { loadStudents(); }, []);

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

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileInputRef.current?.files?.[0]) {
      setError('Por favor sube un archivo CSV');
      return;
    }
    
    setIsLoading(true);
    setMessage('');
    setError('');
    
    const formData = new FormData();
    formData.append('file', fileInputRef.current.files[0]);
    if (assignedTeacherId) {
       formData.append('default_teacher_id', assignedTeacherId);
    }
    
    try {
      const response = await api.post('/super/students/bulk', formData, {
          headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setMessage(`Se han procesado ${response.data.total_processed} estudiantes en lote.`);
      setNewCredentials(response.data.credentials);
      loadStudents();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Error al procesar el archivo CSV');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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
             
             <form onSubmit={handleCreateBatch} className="space-y-4">
               <div>
                  <label className="block text-sm font-medium text-[#787774] mb-2">
                    Subir archivo (.csv)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
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
                   {isLoading ? 'Procesando...' : 'Cargar y Generar Lote'}
                 </button>
               </div>
             </form>
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
          <div className="px-6 py-4 border-b border-[#E9E9E7] bg-[#F7F6F3] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#37352F]" />
              <h3 className="font-medium text-[#37352F]">Todos los Estudiantes Registrados</h3>
            </div>
            <span className="text-xs text-[#787774]">{existingStudents.length} estudiante(s)</span>
          </div>
          {loadingList ? (
            <div className="p-6 text-center text-sm text-[#787774]">Cargando...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left bg-white">
                <thead className="bg-[#F7F6F3]/50">
                  <tr>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Nombre</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Usuario</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Documento</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Grado</th>
                    <th className="px-6 py-3 text-xs font-semibold text-[#787774] uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9E9E7]">
                  {existingStudents.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#F7F6F3]/50 transition-colors">
                      <td className="px-6 py-3 text-sm text-[#37352F] font-medium">{s.full_name}</td>
                      <td className="px-6 py-3 text-sm font-mono text-[#37352F]">{s.username}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{s.document_type} {s.document_number}</td>
                      <td className="px-6 py-3 text-sm text-[#787774]">{s.grade || '-'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {s.is_active ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
