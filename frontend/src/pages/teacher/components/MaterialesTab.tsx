/**
 * Materiales del profesor (parche 14C).
 *
 * Carpetas y archivos reales del backend. «Compartir con grupos» usa los
 * grupos activos del profesor (GET /teacher/materials → groups); antes
 * mostraba una lista fija de grupos de prueba. Los estudiantes de los grupos
 * elegidos ven el material en «Material de apoyo» y reciben una notificación.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FolderPlus, Upload, FileText, File, Presentation, Link2, Folder, Trash2, Share2,
  Eye, Download, MoreVertical, X, Loader2, AlertTriangle, Check, Users,
} from 'lucide-react';
import api from '../../../services/api';

type FileType = 'pdf' | 'doc' | 'ppt' | 'link' | 'img';

interface Group { id: number; name: string; }

interface MaterialFile {
  id: number;
  name: string;
  type: FileType;
  size: string;
  date: string;
  sharedWith: number[];
  sharedGroups: Group[];
  hasFile: boolean;
  downloadUrl: string | null;
  url: string | null;
  fromDrive?: boolean;
}

interface MaterialFolder { id: number; name: string; color: string; files: MaterialFile[]; }

const FILE_TYPE_CONFIG: Record<string, { color: string; bg: string; icon: any }> = {
  pdf:  { color: 'text-[#E03E3E]', bg: 'bg-red-50',    icon: FileText },
  doc:  { color: 'text-[#2E6FDB]', bg: 'bg-[#EEF3FD]', icon: File },
  ppt:  { color: 'text-[#D9730D]', bg: 'bg-orange-50', icon: Presentation },
  link: { color: 'text-[#0B6E99]', bg: 'bg-sky-50',    icon: Link2 },
  img:  { color: 'text-[#6940A5]', bg: 'bg-purple-50', icon: Eye },
};
const typeLook = (t: string) => FILE_TYPE_CONFIG[t] ?? FILE_TYPE_CONFIG.doc;

const MAX_BYTES = 4 * 1024 * 1024;

function apiError(e: any, fallback: string): string {
  const d = e?.response?.data?.detail;
  if (typeof d === 'string' && d.trim()) return d;
  if (Array.isArray(d) && d.length) return d.map((x: any) => x?.msg).filter(Boolean).join(' · ') || fallback;
  if (e?.response?.status === 413) return 'El archivo supera el máximo de 4 MB.';
  return fallback;
}

function toFile(m: any): MaterialFile {
  return {
    id: m.id, name: m.name, type: m.type, size: m.size, date: m.date,
    sharedWith: m.sharedWith ?? [], sharedGroups: m.sharedGroups ?? [],
    hasFile: !!m.hasFile, downloadUrl: m.downloadUrl ?? null, url: m.url ?? null, fromDrive: !!m.fromDrive,
  };
}

export default function MaterialesTab() {
  const [folders, setFolders] = useState<MaterialFolder[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [shareFile, setShareFile] = useState<MaterialFile | null>(null);
  const [shareIds, setShareIds] = useState<number[]>([]);
  const [showLink, setShowLink] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: '', url: '' });
  const fileRef = useRef<HTMLInputElement>(null);

  const ok = (text: string) => setNotice({ kind: 'ok', text });
  const fail = (text: string) => setNotice({ kind: 'error', text });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const r = await api.get('/teacher/materials', { params: { _t: Date.now() } });
      setFolders((r.data.folders ?? []).map((f: any) => ({
        id: f.id, name: f.name, color: f.color, files: (f.files ?? []).map(toFile),
      })));
      setGroups(r.data.groups ?? []);
    } catch (e) {
      setLoadError(apiError(e, 'No fue posible cargar tus materiales.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const replaceFile = (updated: MaterialFile) =>
    setFolders(prev => prev.map(fo => ({ ...fo, files: fo.files.map(f => (f.id === updated.id ? updated : f)) })));

  // ── Carpetas ────────────────────────────────────────────────────────────
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    setBusy('folder');
    try {
      const r = await api.post('/teacher/materials/folders', { name: newFolderName.trim() });
      setFolders(prev => [...prev, { id: r.data.id, name: r.data.name, color: r.data.color, files: [] }]);
      setNewFolderName('');
      setShowNewFolder(false);
      ok('Carpeta creada.');
    } catch (e) {
      fail(apiError(e, 'No fue posible crear la carpeta.'));
    } finally { setBusy(null); }
  };

  const deleteFolder = async (folder: MaterialFolder) => {
    setMenuId(null);
    if (!window.confirm(`¿Eliminar la carpeta «${folder.name}» y sus ${folder.files.length} archivo(s)? Los estudiantes dejarán de verlos.`)) return;
    setBusy(`folder-${folder.id}`);
    try {
      await api.delete(`/teacher/materials/folders/${folder.id}`);
      setFolders(prev => prev.filter(f => f.id !== folder.id));
      if (selectedId === folder.id) setSelectedId(null);
      ok('Carpeta eliminada.');
    } catch (e) {
      fail(apiError(e, 'No fue posible eliminar la carpeta.'));
    } finally { setBusy(null); }
  };

  // ── Archivos ────────────────────────────────────────────────────────────
  const upload = async (folderId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy('upload');
    let done = 0;
    const errors: string[] = [];
    for (const f of Array.from(files)) {
      if (f.size > MAX_BYTES) { errors.push(`«${f.name}» supera 4 MB`); continue; }
      const form = new FormData();
      form.append('folder_id', String(folderId));
      form.append('file', f, f.name);
      try {
        const r = await api.post('/teacher/materials/files', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        const nf = toFile(r.data);
        setFolders(prev => prev.map(fo => (fo.id === folderId ? { ...fo, files: [...fo.files, nf] } : fo)));
        done += 1;
      } catch (e) {
        errors.push(`«${f.name}»: ${apiError(e, 'no se pudo subir')}`);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
    setBusy(null);
    if (errors.length) fail(`${done} archivo(s) subido(s). No se subieron: ${errors.join('; ')}.`);
    else ok(`${done} archivo(s) subido(s). Usa «Compartir» para enviarlos a tus grupos.`);
  };

  const addLink = async (folderId: number) => {
    if (!/^https?:\/\//i.test(linkForm.url.trim())) { fail('Escribe un enlace válido que empiece por https://.'); return; }
    setBusy('link');
    try {
      const form = new FormData();
      form.append('folder_id', String(folderId));
      form.append('name', linkForm.name.trim());
      form.append('url', linkForm.url.trim());
      const r = await api.post('/teacher/materials/files', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      const nf = toFile(r.data);
      setFolders(prev => prev.map(fo => (fo.id === folderId ? { ...fo, files: [...fo.files, nf] } : fo)));
      setShowLink(false);
      setLinkForm({ name: '', url: '' });
      ok('Enlace agregado.');
    } catch (e) {
      fail(apiError(e, 'No fue posible agregar el enlace.'));
    } finally { setBusy(null); }
  };

  const deleteFile = async (folderId: number, file: MaterialFile) => {
    if (!window.confirm(`¿Eliminar «${file.name}»? Los estudiantes dejarán de verlo.`)) return;
    setBusy(`file-${file.id}`);
    try {
      await api.delete(`/teacher/materials/files/${file.id}`);
      setFolders(prev => prev.map(fo => (fo.id === folderId ? { ...fo, files: fo.files.filter(f => f.id !== file.id) } : fo)));
      ok('Archivo eliminado.');
    } catch (e) {
      fail(apiError(e, 'No fue posible eliminar el archivo.'));
    } finally { setBusy(null); }
  };

  const openFile = async (file: MaterialFile) => {
    if (file.url) { window.open(file.url, '_blank', 'noopener,noreferrer'); return; }
    if (!file.hasFile || !file.downloadUrl) { fail('Este material no tiene un archivo para descargar.'); return; }
    setBusy(`dl-${file.id}`);
    try {
      const r = await api.get(file.downloadUrl.replace(/^\/api\/v1/, ''), { responseType: 'blob' });
      const blobUrl = URL.createObjectURL(r.data as Blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (e) {
      fail(apiError(e, 'No fue posible descargar el archivo.'));
    } finally { setBusy(null); }
  };

  // ── Compartir ───────────────────────────────────────────────────────────
  const openShare = (file: MaterialFile) => { setShareFile(file); setShareIds(file.sharedWith); };
  const closeShare = () => { setShareFile(null); setShareIds([]); };
  const toggleGroup = (id: number) =>
    setShareIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const saveShare = async () => {
    if (!shareFile) return;
    setBusy('share');
    try {
      const r = await api.patch(`/teacher/materials/files/${shareFile.id}`, { sharedWith: shareIds });
      replaceFile(toFile(r.data));
      closeShare();
      ok(shareIds.length ? 'Material compartido. Los estudiantes de esos grupos ya pueden verlo.' : 'El material ya no está compartido con ningún grupo.');
    } catch (e) {
      fail(apiError(e, 'No fue posible compartir el material.'));
    } finally { setBusy(null); }
  };

  const folder = selectedId != null ? folders.find(f => f.id === selectedId) ?? null : null;

  const banner = notice && (
    <div className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${notice.kind === 'ok' ? 'bg-emerald-50 border-emerald-200 text-[#0F7B6C]' : 'bg-red-50 border-red-200 text-[#E03E3E]'}`}>
      <span className="flex items-start gap-2">
        {notice.kind === 'ok' ? <Check className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
        {notice.text}
      </span>
      <button onClick={() => setNotice(null)} aria-label="Cerrar"><X className="w-4 h-4 opacity-70" /></button>
    </div>
  );

  const shareModal = shareFile && (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#191919]">Compartir con grupos</h3>
          <button onClick={closeShare} aria-label="Cerrar"><X className="w-4 h-4 text-[#787774]" /></button>
        </div>
        <p className="text-xs text-[#787774] mb-3">Archivo: <strong className="text-[#191919]">{shareFile.name}</strong></p>
        {groups.length === 0 ? (
          <div className="text-center py-6 bg-[#F7F6F3] rounded-lg mb-4">
            <Users className="w-6 h-6 text-[#AEADAB] mx-auto mb-2" />
            <p className="text-sm text-[#787774]">No tienes grupos activos.</p>
            <p className="text-xs text-[#AEADAB] mt-1">Crea un grupo en «Mis Grupos» para compartir materiales.</p>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2.5 cursor-pointer p-2 rounded hover:bg-[#F7F6F3] border-b border-[#F7F6F3] mb-1">
              <input type="checkbox" className="w-4 h-4 rounded"
                checked={shareIds.length === groups.length}
                onChange={() => setShareIds(shareIds.length === groups.length ? [] : groups.map(g => g.id))} />
              <span className="text-sm font-medium text-[#37352F]">Todos mis grupos</span>
            </label>
            <div className="space-y-1 mb-4 max-h-64 overflow-y-auto">
              {groups.map(g => (
                <label key={g.id} className="flex items-center gap-2.5 cursor-pointer p-2 rounded hover:bg-[#F7F6F3]">
                  <input type="checkbox" checked={shareIds.includes(g.id)} onChange={() => toggleGroup(g.id)} className="w-4 h-4 rounded" />
                  <span className="text-sm text-[#37352F]">{g.name}</span>
                </label>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={closeShare} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
          <button onClick={saveShare} disabled={busy === 'share' || groups.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50">
            {busy === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-[#2E6FDB] animate-spin" /></div>;
  }
  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-[#E03E3E] rounded-lg px-4 py-3 text-sm">
        <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {loadError}</span>
        <button onClick={load} className="font-medium hover:underline">Reintentar</button>
      </div>
    );
  }

  // ── Vista de una carpeta ─────────────────────────────────────────────────
  if (folder) {
    return (
      <>
        <div className="space-y-5">
          {banner}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button onClick={() => setSelectedId(null)} className="text-sm text-[#787774] hover:text-[#37352F]">← Materiales</button>
            <div className="flex gap-2">
              <input ref={fileRef} type="file" multiple className="hidden" onChange={e => upload(folder.id, e.target.files)} />
              <button onClick={() => setShowLink(true)}
                className="flex items-center gap-2 px-3 py-2 border border-[#E9E9E7] text-[#37352F] rounded-lg text-sm font-medium hover:bg-[#F7F6F3]">
                <Link2 className="w-4 h-4" /> Agregar enlace
              </button>
              <button onClick={() => fileRef.current?.click()} disabled={busy === 'upload'}
                className="flex items-center gap-2 px-3 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50">
                {busy === 'upload' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir archivo
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white border border-[#E9E9E7] rounded-lg p-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: folder.color + '20' }}>
              <Folder className="w-5 h-5" style={{ color: folder.color }} />
            </div>
            <div>
              <h2 className="font-bold text-[#191919]">{folder.name}</h2>
              <p className="text-xs text-[#787774]">{folder.files.length} archivo(s) · máximo 4 MB por archivo</p>
            </div>
          </div>

          {folder.files.length === 0 ? (
            <div className="bg-[#F7F6F3] border border-dashed border-[#E9E9E7] rounded-xl p-10 text-center">
              <Upload className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
              <p className="text-sm text-[#787774]">Carpeta vacía. Sube un archivo o agrega un enlace.</p>
            </div>
          ) : (
            <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                    {['Archivo', 'Tamaño', 'Fecha', 'Compartido con', 'Acciones'].map(hd => (
                      <th key={hd} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">{hd}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {folder.files.map(file => {
                    const look = typeLook(file.type);
                    const FIcon = look.icon;
                    return (
                      <tr key={file.id} className="border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-7 h-7 ${look.bg} rounded flex items-center justify-center flex-shrink-0`}>
                              <FIcon className={`w-4 h-4 ${look.color}`} />
                            </div>
                            <span className="font-medium text-[#191919] truncate max-w-[200px]">{file.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-[#787774]">{file.size}</td>
                        <td className="px-4 py-3 text-xs text-[#787774]">{file.date}</td>
                        <td className="px-4 py-3 text-xs text-[#787774]">
                          {file.sharedGroups.length ? file.sharedGroups.map(g => g.name).join(', ') : 'Solo yo'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <button onClick={() => openShare(file)} title="Compartir con grupos"
                              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF3FD] text-[#2E6FDB]">
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => openFile(file)} disabled={busy === `dl-${file.id}`}
                              title={file.url ? (file.fromDrive ? 'Abrir en Drive' : 'Abrir enlace') : 'Descargar'}
                              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774]">
                              {busy === `dl-${file.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : file.url ? <Link2 className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => deleteFile(folder.id, file)} disabled={busy === `file-${file.id}`} title="Eliminar"
                              className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#AEADAB] hover:text-[#E03E3E]">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showLink && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-3">
              <h3 className="font-semibold text-[#191919]">Agregar enlace</h3>
              <input value={linkForm.name} onChange={e => setLinkForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nombre (opcional)" className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm" />
              <input value={linkForm.url} onChange={e => setLinkForm(p => ({ ...p, url: e.target.value }))}
                placeholder="https://…" className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm" />
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowLink(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
                <button onClick={() => addLink(folder.id)} disabled={busy === 'link' || !linkForm.url.trim()}
                  className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50">
                  {busy === 'link' ? 'Guardando…' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}
        {shareModal}
      </>
    );
  }

  // ── Lista de carpetas ───────────────────────────────────────────────────
  const totalFiles = folders.reduce((a, f) => a + f.files.length, 0);
  return (
    <div className="space-y-5">
      {banner}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#787774]">
          <strong className="text-[#191919]">{folders.length}</strong> carpetas · <strong className="text-[#191919]">{totalFiles}</strong> archivos · <strong className="text-[#191919]">{groups.length}</strong> grupo(s) para compartir
        </p>
        <button onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] shadow-sm">
          <FolderPlus className="w-4 h-4" /> Nueva carpeta
        </button>
      </div>

      {folders.length === 0 ? (
        <div className="bg-[#F7F6F3] border border-dashed border-[#E9E9E7] rounded-xl p-10 text-center">
          <Folder className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
          <p className="text-sm text-[#787774]">Aún no tienes carpetas. Crea una para organizar tus materiales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {folders.map(fo => {
            const shared = fo.files.filter(f => f.sharedWith.length > 0).length;
            return (
              <div key={fo.id} className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden hover:shadow-sm">
                <div className="h-1 w-full" style={{ background: fo.color }} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <button onClick={() => setSelectedId(fo.id)} className="flex items-center gap-3 text-left flex-1">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: fo.color + '20' }}>
                        <Folder className="w-5 h-5" style={{ color: fo.color }} />
                      </div>
                      <div>
                        <p className="font-semibold text-[#191919] text-sm">{fo.name}</p>
                        <p className="text-xs text-[#787774]">{fo.files.length} archivo(s) · {shared} compartido(s)</p>
                      </div>
                    </button>
                    <div className="relative">
                      <button onClick={() => setMenuId(menuId === fo.id ? null : fo.id)} aria-label="Opciones"
                        className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774]">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuId === fo.id && (
                        <div className="absolute right-0 top-8 bg-white border border-[#E9E9E7] rounded-lg shadow-lg z-20 py-1 w-32"
                          onMouseLeave={() => setMenuId(null)}>
                          <button onClick={() => deleteFolder(fo)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E03E3E] hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  {fo.files.slice(0, 3).map(f => {
                    const look = typeLook(f.type);
                    const FIcon = look.icon;
                    return (
                      <div key={f.id} className="flex items-center gap-2 py-1.5 border-t border-[#F7F6F3]">
                        <FIcon className={`w-3.5 h-3.5 ${look.color} flex-shrink-0`} />
                        <span className="text-xs text-[#787774] truncate">{f.name}</span>
                      </div>
                    );
                  })}
                  {fo.files.length > 3 && <p className="text-[11px] text-[#AEADAB] mt-1.5">+{fo.files.length - 3} más…</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNewFolder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-[#191919] mb-4">Nueva carpeta</h3>
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="Nombre de la carpeta"
              onKeyDown={e => e.key === 'Enter' && createFolder()}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewFolder(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={createFolder} disabled={!newFolderName.trim() || busy === 'folder'}
                className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50">
                Crear
              </button>
            </div>
          </div>
        </div>
      )}
      {shareModal}
    </div>
  );
}
