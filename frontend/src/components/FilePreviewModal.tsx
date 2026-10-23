/**
 * Visor de vista previa de materiales (biblioteca del estudiante, material que
 * comparten los profesores y carpetas del profesor).
 *
 * - El archivo privado se pide con el cliente de la API (lleva el token) y se
 *   muestra desde un blob local: nunca se expone una URL pública.
 * - Solo se muestran dentro del visor los formatos que el navegador puede
 *   representar de verdad (PDF, imágenes, texto, audio y video). Word,
 *   PowerPoint y Excel no tienen visor integrado: se avisa y se ofrece la
 *   descarga, sin servicios externos que tendrían que leer el documento.
 * - Cada apertura carga su propio archivo y libera el anterior al cerrar.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Download, ExternalLink, FileText, Loader2, X } from 'lucide-react';

export type PreviewKind = 'pdf' | 'image' | 'text' | 'audio' | 'video' | 'office' | 'unsupported';

const EXT_KIND: Record<string, PreviewKind> = {
  pdf: 'pdf',
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image',
  txt: 'text', csv: 'text', md: 'text',
  mp3: 'audio', wav: 'audio', ogg: 'audio',
  mp4: 'video', webm: 'video',
  doc: 'office', docx: 'office', ppt: 'office', pptx: 'office', xls: 'office', xlsx: 'office',
};

const KIND_MIME: Partial<Record<string, string>> = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain', csv: 'text/csv', md: 'text/plain',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', mp4: 'video/mp4', webm: 'video/webm',
};

const MAX_TEXT_CHARS = 200_000;

function extOf(name?: string | null): string {
  const n = (name ?? '').toLowerCase().split('?')[0];
  return n.includes('.') ? n.slice(n.lastIndexOf('.') + 1) : '';
}

/** Tipo de vista previa según el MIME (si es útil) o la extensión del nombre. */
function previewKind(mime?: string | null, name?: string | null): PreviewKind {
  const m = (mime ?? '').toLowerCase();
  if (m === 'application/pdf') return 'pdf';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('text/')) return 'text';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m.includes('msword') || m.includes('officedocument') || m.includes('ms-excel') || m.includes('ms-powerpoint')) return 'office';
  return EXT_KIND[extOf(name)] ?? 'unsupported';
}

/** El navegador no puede incrustar PDF (p. ej. Chrome en Android, iOS antiguo). */
function pdfInlineUnsupported(): boolean {
  const nav = navigator as Navigator & { pdfViewerEnabled?: boolean };
  return nav.pdfViewerEnabled === false;
}

/** Mensaje legible para un fallo al pedir el archivo (la respuesta de error llega como blob). */
async function loadErrorText(e: unknown): Promise<string> {
  const response = (e as { response?: { status?: number; data?: unknown } } | null)?.response;
  const status = response?.status;
  let detail = '';
  const data = response?.data;
  if (data instanceof Blob) {
    try { detail = JSON.parse(await data.text())?.detail ?? ''; } catch { /* no era JSON */ }
  }
  if (status === 404) return 'El archivo ya no existe o dejó de estar compartido contigo.';
  if (status === 403) return 'No tienes permiso para ver este archivo.';
  if (status === 401) return 'Tu sesión expiró. Inicia sesión de nuevo.';
  if (!response) return 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  return detail || 'No fue posible cargar el archivo.';
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'material';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PreviewSource {
  /** Nombre visible (y de descarga). */
  name: string;
  /** Subtítulo opcional (páginas, profesor, tamaño…). */
  subtitle?: string;
  /** Tipo MIME conocido; si falta se deduce del nombre o de la respuesta. */
  mimeType?: string | null;
  /** Archivo público de la app (biblioteca general). */
  src?: string;
  /** Archivo privado: se descarga con el token del usuario. */
  load?: () => Promise<Blob>;
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; url: string; kind: PreviewKind; blob: Blob | null; text?: string; truncated?: boolean };

export default function FilePreviewModal({ source: initialSource, onClose }: { source: PreviewSource; onClose: () => void }) {
  // La fuente se fija al abrir (el visor se monta con una `key` por archivo):
  // un re-render del padre no vuelve a descargar ni mezcla archivos.
  const [source] = useState(initialSource);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ status: 'loading' });
    setFrameLoaded(false);

    (async () => {
      if (source.src) {
        const kind = previewKind(source.mimeType, source.src);
        if (kind === 'text') {
          try {
            const r = await fetch(source.src);
            if (!r.ok) throw new Error(String(r.status));
            const body = await r.text();
            if (!cancelled) setState({ status: 'ready', url: source.src, kind, blob: null, text: body.slice(0, MAX_TEXT_CHARS), truncated: body.length > MAX_TEXT_CHARS });
          } catch {
            if (!cancelled) setState({ status: 'error', message: 'No fue posible cargar el archivo.' });
          }
          return;
        }
        if (!cancelled) setState({ status: 'ready', url: source.src, kind, blob: null });
        return;
      }
      if (!source.load) {
        setState({ status: 'error', message: 'Este material no tiene un archivo para mostrar.' });
        return;
      }
      try {
        const raw = await source.load();
        if (cancelled) return;
        if (!raw || raw.size === 0) {
          setState({ status: 'error', message: 'El archivo está vacío o no se pudo leer.' });
          return;
        }
        // Un JSON o HTML en lugar del archivo indica una respuesta de error, no el material.
        const rawType = (raw.type || '').toLowerCase();
        const kind = previewKind(source.mimeType || rawType, source.name);
        if ((rawType.includes('json') || rawType.includes('html')) && kind !== 'text') {
          setState({ status: 'error', message: 'El servidor no devolvió el archivo. Inténtalo de nuevo.' });
          return;
        }
        // Se fija el tipo correcto: un PDF con tipo genérico se descargaría en vez de mostrarse.
        const type = source.mimeType || KIND_MIME[extOf(source.name)] || rawType || 'application/octet-stream';
        const blob = raw.type === type ? raw : new Blob([raw], { type });
        if (kind === 'text') {
          const body = await blob.text();
          if (!cancelled) setState({ status: 'ready', url: '', kind, blob, text: body.slice(0, MAX_TEXT_CHARS), truncated: body.length > MAX_TEXT_CHARS });
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setState({ status: 'ready', url: objectUrl, kind, blob });
      } catch (e) {
        const message = await loadErrorText(e);
        if (!cancelled) setState({ status: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [source, attempt]);

  // Escape cierra el visor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = state.status === 'ready' ? state : null;

  const download = () => {
    if (ready?.blob) saveBlob(ready.blob, source.name);
  };

  const downloadButton = ready && (ready.blob ? (
    <button onClick={download}
      className="flex items-center gap-1.5 bg-[#37352F] hover:bg-[#2F2D2B] text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
      <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Descargar</span>
    </button>
  ) : (
    <a href={ready.url} download
      className="flex items-center gap-1.5 bg-[#37352F] hover:bg-[#2F2D2B] text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
      <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Descargar</span>
    </a>
  ));

  const openButton = ready && ready.url && ['pdf', 'image', 'audio', 'video'].includes(ready.kind) && (
    <a href={ready.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-1.5 bg-[#F7F6F3] hover:bg-[#F1F1EF] border border-[#E9E9E7] text-[#787774] text-xs font-medium px-3 py-1.5 rounded-md transition-colors">
      <ExternalLink className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Abrir</span>
    </a>
  );

  const notice = (title: string, text: string) => (
    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10 gap-3">
      <div className="w-10 h-10 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center">
        <FileText className="w-5 h-5 text-[#9B9A97]" />
      </div>
      <p className="text-sm font-medium text-[#37352F]">{title}</p>
      <p className="text-xs text-[#787774] max-w-sm">{text}</p>
      <div className="flex gap-2 mt-1">{downloadButton}{openButton}</div>
    </div>
  );

  let body: React.ReactNode;
  if (state.status === 'loading') {
    body = (
      <div className="h-full flex items-center justify-center gap-2 text-sm text-[#9B9A97]" aria-busy="true">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando archivo…
      </div>
    );
  } else if (state.status === 'error') {
    body = (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 gap-3" role="alert">
        <AlertCircle className="w-6 h-6 text-[#E03E3E]" />
        <p className="text-sm text-[#E03E3E] max-w-sm">{state.message}</p>
        <button onClick={() => setAttempt(a => a + 1)} className="text-xs font-medium text-[#2E6FDB] hover:underline">Reintentar</button>
      </div>
    );
  } else if (state.kind === 'pdf') {
    body = pdfInlineUnsupported()
      ? notice('Este navegador no muestra PDF dentro de la página', 'Ábrelo en una pestaña nueva o descárgalo para leerlo.')
      : (
        <div className="relative w-full h-full">
          {!frameLoaded && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-[#9B9A97] bg-white">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando documento…
            </div>
          )}
          <iframe src={`${state.url}#toolbar=1&navpanes=1`} title={source.name}
            onLoad={() => setFrameLoaded(true)} className="w-full h-full border-0" />
        </div>
      );
  } else if (state.kind === 'image') {
    body = (
      <div className="w-full h-full overflow-auto bg-[#F7F6F3] flex items-center justify-center p-4">
        <img src={state.url} alt={source.name}
          onError={() => setState({ status: 'error', message: 'La imagen no se pudo mostrar. Puede estar dañada.' })}
          className="max-w-full max-h-full object-contain" />
      </div>
    );
  } else if (state.kind === 'text') {
    body = (
      <div className="w-full h-full overflow-auto">
        <pre className="p-4 text-xs text-[#37352F] whitespace-pre-wrap break-words font-mono">{state.text}</pre>
        {state.truncated && <p className="px-4 pb-4 text-[11px] text-[#9B9A97]">Vista previa recortada. Descarga el archivo para verlo completo.</p>}
      </div>
    );
  } else if (state.kind === 'audio') {
    body = <div className="h-full flex items-center justify-center p-6"><audio controls src={state.url} className="w-full max-w-md" /></div>;
  } else if (state.kind === 'video') {
    body = <div className="h-full flex items-center justify-center bg-black"><video controls src={state.url} className="max-w-full max-h-full" /></div>;
  } else if (state.kind === 'office') {
    body = notice('Vista previa no disponible para este formato',
      'Los documentos de Word, PowerPoint y Excel no se pueden mostrar dentro de NeuroLearn. Descárgalo y ábrelo con una aplicación compatible.');
  } else {
    body = notice('Vista previa no disponible', 'Este tipo de archivo no se puede mostrar en el navegador. Descárgalo para abrirlo.');
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center sm:p-4" onClick={onClose}
      role="dialog" aria-modal="true" aria-label={`Vista previa de ${source.name}`}>
      <div className="bg-white border border-[#E9E9E7] sm:rounded-md w-full max-w-4xl h-[100dvh] sm:h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-[#E9E9E7]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-[#F7F6F3] border border-[#E9E9E7] rounded-md flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-[#787774]" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-[#37352F] text-sm truncate">{source.name}</p>
              {source.subtitle && <p className="text-[11px] text-[#9B9A97] truncate">{source.subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {downloadButton}
            {openButton}
            <button onClick={onClose} aria-label="Cerrar vista previa"
              className="w-7 h-7 rounded-md text-[#9B9A97] hover:text-[#37352F] hover:bg-[#F7F6F3] flex items-center justify-center transition-colors border border-[#E9E9E7]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">{body}</div>
      </div>
    </div>
  );
}
