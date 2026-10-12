import { useEffect, useState } from 'react';
import { Download, X, Loader2, AlertCircle, FileSpreadsheet, FileText } from 'lucide-react';
import api, { invalidateApiCache } from '../../../services/api';

/**
 * Exportar reporte (GET /teacher/reports/export).
 * El backend genera el archivo con datos reales; aquí solo se eligen filtros
 * y se descarga lo que devuelve. Si no hay datos, el backend responde 404
 * con el motivo y no se descarga nada.
 */

type ReportKind = 'resumen' | 'quizzes' | 'evaluaciones';
type ReportFormat = 'csv' | 'pdf';

const KINDS: { id: ReportKind; label: string; desc: string }[] = [
  { id: 'resumen', label: 'Resumen por estudiante', desc: 'Quizzes, evaluaciones, progreso y riesgo de cada estudiante' },
  { id: 'quizzes', label: 'Quizzes adaptativos', desc: 'Cada quiz completado: competencia, puntaje y tiempo' },
  { id: 'evaluaciones', label: 'Evaluaciones', desc: 'Nota oficial (mejor intento) de cada estudiante por evaluación' },
];

interface Group { id: number; name: string }

/** El error de una petición con responseType "blob" llega como Blob: se lee el JSON. */
async function blobError(err: any, fallback: string): Promise<string> {
  const data = err?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      if (typeof parsed?.detail === 'string') return parsed.detail;
      if (Array.isArray(parsed?.detail) && parsed.detail[0]?.msg) return String(parsed.detail[0].msg);
    } catch { /* respuesta no JSON */ }
  }
  if (!err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}

function filenameFrom(disposition: string | undefined, fallback: string): string {
  const cd = disposition ?? '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star?.[1]) { try { return decodeURIComponent(star[1].trim()); } catch { /* sigue */ } }
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain?.[1]?.trim() || fallback;
}

export default function ExportReportModal({ onClose }: { onClose: () => void }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsError, setGroupsError] = useState('');
  const [kind, setKind] = useState<ReportKind>('resumen');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [classroomId, setClassroomId] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  useEffect(() => {
    api.get('/classrooms/my-classes')
      .then(r => setGroups((r.data.classrooms ?? []).map((c: any) => ({ id: c.id, name: c.name }))))
      .catch(() => setGroupsError('No se pudieron cargar tus grupos; puedes exportar todos.'));
  }, []);

  const exportReport = async () => {
    if (exporting) return;
    if (startDate && endDate && startDate > endDate) {
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    setExporting(true);
    setError('');
    setDone('');
    invalidateApiCache('/teacher/reports');
    try {
      const params: Record<string, string> = { report: kind, format };
      if (classroomId) params.classroom_id = classroomId;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await api.get('/teacher/reports/export', { params, responseType: 'blob' });
      const blob = res.data as Blob;
      if (!blob || blob.size === 0) {
        setError('El servidor devolvió un archivo vacío.');
        return;
      }
      const name = filenameFrom(res.headers?.['content-disposition'], `reporte.${format}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      const rows = res.headers?.['x-report-rows'];
      setDone(`Descargado: ${name}${rows ? ` (${rows} filas)` : ''}`);
    } catch (err) {
      setError(await blobError(err, 'No se pudo generar el reporte.'));
    } finally {
      setExporting(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB]';
  const labelCls = 'block text-xs font-semibold text-[#787774] uppercase mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#191919]">Exportar reporte</h3>
            <p className="text-xs text-[#787774]">Datos reales de tus grupos</p>
          </div>
          <button onClick={onClose} className="text-[#787774] hover:text-[#37352F]" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>Contenido</label>
            <div className="space-y-2">
              {KINDS.map(k => (
                <label key={k.id} className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer ${kind === k.id ? 'border-[#2E6FDB] bg-[#EEF3FD]' : 'border-[#E9E9E7] hover:bg-[#F7F6F3]'}`}>
                  <input type="radio" name="kind" checked={kind === k.id} onChange={() => setKind(k.id)} className="mt-0.5" />
                  <span>
                    <span className="block text-sm font-medium text-[#191919]">{k.label}</span>
                    <span className="block text-[11px] text-[#787774]">{k.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Grupo</label>
            <select value={classroomId} onChange={e => setClassroomId(e.target.value)} className={inputCls}>
              <option value="">Todos mis grupos</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {groupsError && <p className="mt-1 text-[11px] text-[#D9730D]">{groupsError}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Desde</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Hasta</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Formato</label>
            <div className="flex gap-2">
              {([['pdf', 'PDF', FileText], ['csv', 'CSV (Excel)', FileSpreadsheet]] as const).map(([id, label, Icon]) => (
                <button key={id} type="button" onClick={() => setFormat(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium ${format === id ? 'border-[#2E6FDB] bg-[#EEF3FD] text-[#2E6FDB]' : 'border-[#E9E9E7] text-[#787774] hover:bg-[#F7F6F3]'}`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-[#E03E3E] flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> {error}</p>}
          {done && <p className="text-sm text-[#0F7B6C]">{done}</p>}
        </div>
        <div className="px-6 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cerrar</button>
          <button onClick={exportReport} disabled={exporting}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-60">
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Generando…' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
