/**
 * «Material de mis profesores» (parche 14C): lo que los profesores
 * compartieron con los grupos del estudiante (GET /student/materials).
 */
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, ExternalLink, Eye, FileText, Loader2, RotateCcw, Users } from 'lucide-react';
import api from '../../services/api';
import FilePreviewModal from '../../components/FilePreviewModal';
import { downloadStudentMaterial, fetchStudentMaterial } from './materialDownload';

interface SharedMaterial {
  id: number;
  name: string;
  type: string;
  size: string;
  date: string;
  folder: string | null;
  teacher: string;
  groups: string[];
  hasFile: boolean;
  url: string | null;
  mimeType?: string | null;
  originalName?: string | null;
}

export default function TeacherMaterials({ search }: { search: string }) {
  const [items, setItems] = useState<SharedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [rowError, setRowError] = useState('');
  const [previewing, setPreviewing] = useState<SharedMaterial | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/student/materials', { params: { _t: Date.now() } });
      setItems(r.data?.materials ?? []);
    } catch {
      setError('No fue posible cargar el material de tus profesores.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = async (m: SharedMaterial) => {
    setRowError('');
    if (m.url) { window.open(m.url, '_blank', 'noopener,noreferrer'); return; }
    setBusy(m.id);
    try {
      await downloadStudentMaterial(m.id, m.name);
    } catch {
      setRowError(`No fue posible descargar «${m.name}». Puede que el profesor haya dejado de compartirlo.`);
    } finally {
      setBusy(null);
    }
  };

  const q = search.trim().toLowerCase();
  const shown = items.filter(m => !q || [m.name, m.teacher, m.folder ?? '', ...m.groups].some(v => v.toLowerCase().includes(q)));

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-[#37352F] text-sm flex items-center gap-2">
          <Users className="w-4 h-4 text-[#2E6FDB]" /> Material de mis profesores
        </h2>
        {!loading && !error && <span className="text-xs text-[#9B9A97]">{shown.length} archivo(s)</span>}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[#9B9A97] py-6 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
        </div>
      ) : error ? (
        <div className="flex items-center justify-between gap-3 bg-[#FDEEEE] border border-[#F5C7C7] text-[#E03E3E] rounded-md p-3 text-sm">
          <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</span>
          <button onClick={load} className="flex items-center gap-1 font-medium hover:underline"><RotateCcw className="w-3.5 h-3.5" /> Reintentar</button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[#787774] bg-[#F7F6F3] border border-dashed border-[#E9E9E7] rounded-md p-5 text-center">
          Tus profesores aún no han compartido material con tus grupos.
        </p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-[#787774] py-4 text-center">Ningún material de tus profesores coincide con la búsqueda.</p>
      ) : (
        <>
          {rowError && <p className="text-xs text-[#E03E3E] mb-2">{rowError}</p>}
          <div className="bg-white border border-[#E9E9E7] rounded-md divide-y divide-[#F7F6F3]">
            {shown.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="w-4 h-4 text-[#9B9A97] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#37352F] truncate">{m.name}</p>
                  <p className="text-[11px] text-[#9B9A97] truncate">
                    {m.teacher} · {m.groups.join(', ')}{m.folder ? ` · ${m.folder}` : ''} · {m.date}{m.size && m.size !== '—' ? ` · ${m.size}` : ''}
                  </p>
                </div>
                {!m.url && m.hasFile && (
                  <button onClick={() => { setRowError(''); setPreviewing(m); }} title="Vista previa"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#E9E9E7] text-[#37352F] hover:bg-[#F7F6F3]">
                    <Eye className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Vista previa</span>
                  </button>
                )}
                <button onClick={() => open(m)} disabled={busy === m.id || (!m.url && !m.hasFile)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-[#E9E9E7] text-[#2E6FDB] hover:bg-[#EEF3FD] disabled:opacity-50">
                  {busy === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : m.url ? <ExternalLink className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                  {m.url ? 'Abrir' : 'Descargar'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {previewing && (
        <FilePreviewModal
          key={previewing.id}
          source={{
            name: previewing.originalName || previewing.name,
            subtitle: `${previewing.teacher}${previewing.size && previewing.size !== '—' ? ` · ${previewing.size}` : ''}`,
            mimeType: previewing.mimeType,
            load: () => fetchStudentMaterial(previewing.id),
          }}
          onClose={() => setPreviewing(null)}
        />
      )}
    </section>
  );
}
