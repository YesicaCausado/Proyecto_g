import { useState, useRef, useEffect } from 'react';
import {
  FolderPlus, Upload, FileText, File, Presentation,
  Link2, Folder, Trash2, Share2, Eye, Download, MoreVertical, X, Loader2,
} from 'lucide-react';
import api from '../../../services/api';

type FileType = 'pdf' | 'doc' | 'ppt' | 'link' | 'img';

interface MaterialFile {
  id: string;
  name: string;
  type: FileType;
  size: string;
  date: string;
  sharedWith: string[];
}

interface MaterialFolder {
  id: string;
  name: string;
  color: string;
  files: MaterialFile[];
}

const GROUPS = ['Matemáticas 9A','Física 10B','Álgebra 8C','Cálculo 11A','Geometría 7A'];

const INITIAL_FOLDERS: MaterialFolder[] = [];

const FILE_TYPE_CONFIG: Record<FileType, { icon: any; color: string; bg: string }> = {
  pdf:  { icon: FileText,      color:'text-[#E03E3E]', bg:'bg-red-50'    },
  doc:  { icon: File,          color:'text-[#2E6FDB]', bg:'bg-[#EEF3FD]' },
  ppt:  { icon: Presentation,  color:'text-[#D9730D]', bg:'bg-orange-50' },
  link: { icon: Link2,         color:'text-[#0B6E99]', bg:'bg-sky-50'    },
  img:  { icon: Eye,           color:'text-[#6940A5]', bg:'bg-purple-50' },
};

export default function MaterialesTab({ license: _license }: { license: any }) {
  const [folders,    setFolders]    = useState<MaterialFolder[]>(INITIAL_FOLDERS);
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<MaterialFolder | null>(null);
  const [menuId,     setMenuId]     = useState<string | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showShare,  setShowShare]  = useState<MaterialFile | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [shareGroups,   setShareGroups]   = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── Load folders from backend ─────────────────────────────────────── */
  useEffect(() => {
    api.get('/teacher/materials')
      .then(r => setFolders((r.data.folders ?? []).map((f: any) => ({
        id:    String(f.id),
        name:  f.name,
        color: f.color,
        files: (f.files ?? []).map((m: any) => ({
          id:         String(m.id),
          name:       m.name,
          type:       m.type as FileType,
          size:       m.size,
          date:       m.date,
          sharedWith: m.sharedWith ?? [],
        })),
      }))))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      const r = await api.post('/teacher/materials/folders', { name: newFolderName.trim() });
      const f: MaterialFolder = { id: String(r.data.id), name: r.data.name, color: r.data.color, files: [] };
      setFolders(prev => [...prev, f]);
    } catch { /* noop */ }
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const handleUpload = async (folderId: string, files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const fileType: FileType = f.name.endsWith('.pdf') ? 'pdf'
        : f.name.endsWith('.pptx') || f.name.endsWith('.ppt') ? 'ppt' : 'doc';
      const payload = {
        folder_id:  folderId,
        name:       f.name,
        type:       fileType,
        size:       `${(f.size / 1024 / 1024).toFixed(1)} MB`,
        sharedWith: [],
      };
      try {
        const r = await api.post('/teacher/materials/files', payload);
        const newFile: MaterialFile = {
          id:         String(r.data.id),
          name:       r.data.name,
          type:       r.data.type as FileType,
          size:       r.data.size,
          date:       r.data.date,
          sharedWith: r.data.sharedWith ?? [],
        };
        setFolders(prev => prev.map(fo => fo.id === folderId ? { ...fo, files: [...fo.files, newFile] } : fo));
        setSelected(prev => prev?.id === folderId ? { ...prev, files: [...prev.files, newFile] } : prev);
      } catch { /* noop */ }
    }
  };

  const handleDeleteFile = async (folderId: string, fileId: string) => {
    try {
      await api.delete(`/teacher/materials/files/${fileId}`);
    } catch { /* noop */ }
    setFolders(prev => prev.map(fo => fo.id === folderId ? { ...fo, files: fo.files.filter(f => f.id !== fileId) } : fo));
    setSelected(prev => prev ? { ...prev, files: prev.files.filter(f => f.id !== fileId) } : prev);
  };

  const handleShare = async () => {
    if (!showShare || shareGroups.length === 0) return;
    try {
      await api.patch(`/teacher/materials/files/${showShare.id}`, { sharedWith: shareGroups });
    } catch { /* noop */ }
    setFolders(prev => prev.map(fo => ({
      ...fo,
      files: fo.files.map(f => f.id === showShare.id ? { ...f, sharedWith: shareGroups } : f),
    })));
    setShowShare(null);
    setShareGroups([]);
  };

  const toggleGroup = (g: string) => {
    setShareGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  };

  if (selected) {
    const folder = folders.find(f => f.id === selected.id) ?? selected;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <button onClick={() => setSelected(null)} className="text-sm text-[#787774] hover:text-[#37352F] transition-colors">← Materiales</button>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" multiple className="hidden"
              onChange={e => handleUpload(folder.id, e.target.files)} />
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors">
              <Upload className="w-4 h-4" /> Subir archivo
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white border border-[#E9E9E7] rounded-lg p-4">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: folder.color + '20' }}>
            <Folder className="w-5 h-5" style={{ color: folder.color }} />
          </div>
          <div>
            <h2 className="font-bold text-[#191919]">{folder.name}</h2>
            <p className="text-xs text-[#787774]">{folder.files.length} archivos</p>
          </div>
        </div>

        {folder.files.length === 0 ? (
          <div className="bg-[#F7F6F3] border border-dashed border-[#E9E9E7] rounded-xl p-10 text-center">
            <Upload className="w-10 h-10 text-[#E9E9E7] mx-auto mb-2" />
            <p className="text-sm text-[#787774]">Carpeta vacía. Sube tu primer archivo.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F7F6F3] border-b border-[#E9E9E7]">
                  {['Archivo','Tamaño','Fecha','Compartido con','Acciones'].map(h=>(
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-[#787774] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {folder.files.map(file => {
                  const fc = FILE_TYPE_CONFIG[file.type];
                  const FIcon = fc.icon;
                  return (
                    <tr key={file.id} className="border-b border-[#F7F6F3] hover:bg-[#F7F6F3]/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 ${fc.bg} rounded flex items-center justify-center flex-shrink-0`}>
                            <FIcon className={`w-4 h-4 ${fc.color}`} />
                          </div>
                          <span className="font-medium text-[#191919] truncate max-w-[180px]">{file.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#787774]">{file.size}</td>
                      <td className="px-4 py-3 text-xs text-[#787774]">{file.date}</td>
                      <td className="px-4 py-3 text-xs text-[#787774]">{file.sharedWith.join(', ') || 'Solo yo'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setShowShare(file)} title="Compartir"
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#EEF3FD] text-[#2E6FDB] transition-colors">
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                          <button title="Descargar"
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774] transition-colors">
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteFile(folder.id, file.id)} title="Eliminar"
                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-50 text-[#AEADAB] hover:text-[#E03E3E] transition-colors">
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
    );
  }

  return (
    <div className="space-y-5">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-[#2E6FDB] animate-spin" />
        </div>
      )}
      {!loading && <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#787774]"><strong className="text-[#191919]">{folders.length}</strong> carpetas · <strong className="text-[#191919]">{folders.reduce((a,f)=>a+f.files.length,0)}</strong> archivos</p>
        <button onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] transition-colors shadow-sm">
          <FolderPlus className="w-4 h-4" /> Nueva carpeta
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {folders.map(folder => {
          const totalSize = folder.files.filter(f=>f.size!=='—').reduce((a,f)=>a+parseFloat(f.size),0);
          return (
            <div key={folder.id} className="bg-white border border-[#E9E9E7] rounded-xl overflow-hidden hover:shadow-sm transition-all group">
              <div className="h-1 w-full" style={{ background: folder.color }} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <button onClick={() => setSelected(folder)} className="flex items-center gap-3 text-left flex-1">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: folder.color + '20' }}>
                      <Folder className="w-5 h-5" style={{ color: folder.color }} />
                    </div>
                    <div>
                      <p className="font-semibold text-[#191919] text-sm">{folder.name}</p>
                      <p className="text-xs text-[#787774]">{folder.files.length} archivos · {totalSize > 0 ? `${totalSize.toFixed(1)} MB` : '—'}</p>
                    </div>
                  </button>
                  <div className="relative">
                    <button onClick={() => setMenuId(menuId===folder.id ? null : folder.id)}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774]">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuId===folder.id && (
                      <div className="absolute right-0 top-8 bg-white border border-[#E9E9E7] rounded-lg shadow-lg z-20 py-1 w-32"
                        onMouseLeave={() => setMenuId(null)}>
                        <button onClick={async () => { try { await api.delete(`/teacher/materials/folders/${folder.id}`); } catch { /* noop */ } setFolders(prev=>prev.filter(f=>f.id!==folder.id)); setMenuId(null); }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#E03E3E] hover:bg-red-50">
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {folder.files.slice(0,3).map(f => {
                  const fc = FILE_TYPE_CONFIG[f.type];
                  const FIcon = fc.icon;
                  return (
                    <div key={f.id} className="flex items-center gap-2 py-1.5 border-t border-[#F7F6F3]">
                      <FIcon className={`w-3.5 h-3.5 ${fc.color} flex-shrink-0`} />
                      <span className="text-xs text-[#787774] truncate">{f.name}</span>
                    </div>
                  );
                })}
                {folder.files.length > 3 && (
                  <p className="text-[11px] text-[#AEADAB] mt-1.5">+{folder.files.length - 3} más...</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nueva carpeta */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-[#191919] mb-4">Nueva carpeta</h3>
            <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nombre de la carpeta"
              onKeyDown={e => e.key==='Enter' && handleCreateFolder()}
              className="w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2E6FDB]/30 focus:border-[#2E6FDB] mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNewFolder(false)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={handleCreateFolder} disabled={!newFolderName.trim()}
                className="px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal compartir */}
      {showShare && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[#191919]">Compartir con grupos</h3>
              <button onClick={() => setShowShare(null)}><X className="w-4 h-4 text-[#787774]" /></button>
            </div>
            <p className="text-xs text-[#787774] mb-3">Archivo: <strong className="text-[#191919]">{showShare.name}</strong></p>
            <div className="space-y-2 mb-4">
              {['Todos', ...GROUPS].map(g => (
                <label key={g} className="flex items-center gap-2.5 cursor-pointer p-2 rounded hover:bg-[#F7F6F3] transition-colors">
                  <input type="checkbox" checked={shareGroups.includes(g)} onChange={() => toggleGroup(g)}
                    className="w-4 h-4 text-[#2E6FDB] rounded" />
                  <span className="text-sm text-[#37352F]">{g}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowShare(null)} className="px-4 py-2 text-sm text-[#787774] hover:bg-[#F7F6F3] rounded-lg">Cancelar</button>
              <button onClick={handleShare} disabled={shareGroups.length===0}
                className="flex items-center gap-1.5 px-5 py-2 bg-[#2E6FDB] text-white rounded-lg text-sm font-medium hover:bg-[#255DC0] disabled:opacity-50 transition-colors">
                <Share2 className="w-4 h-4" /> Compartir
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
