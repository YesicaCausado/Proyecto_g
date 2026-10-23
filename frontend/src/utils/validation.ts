/**
 * Reglas de validación de los formularios de NeuroLearn IA.
 *
 * Espejo de backend/app/core/validators.py: el backend aplica las mismas
 * reglas (el frontend solo ayuda al usuario; la barrera real es la API).
 * Si cambias una regla aquí, cámbiala también allí.
 *
 * Cada `validateX` devuelve `null` si el valor es válido o el mensaje de
 * error listo para mostrar junto al campo. Las funciones `filterX` limpian lo
 * que se escribe o pega en campos estrictos (documento, teléfono, código) y
 * avisan si quitaron algo para poder informar al usuario.
 *
 * Módulo puro (sin React ni DOM): lo prueban frontend/tests/*.test.ts.
 */

export type FieldError = string | null;

// ─── Textos ──────────────────────────────────────────────────────────────────

interface TextOptions {
  label: string;
  max: number;
  min?: number;
  required?: boolean;
}

/** Texto libre: títulos, descripciones, mensajes. Admite puntuación y emojis. */
export function validateText(value: string, { label, max, min = 1, required = true }: TextOptions): FieldError {
  const text = (value ?? '').trim();
  if (!text) return required ? `${label} es obligatorio.` : null;
  const length = [...text].length;
  if (length < min) return `${label} debe tener al menos ${min} caracteres.`;
  if (length > max) return `${label} no puede superar ${max} caracteres (tiene ${length}).`;
  return null;
}

// ─── Nombres de personas ─────────────────────────────────────────────────────

// Palabra del nombre: letras de cualquier alfabeto (tildes, ñ, diéresis)
// unidas por guion o apóstrofo, con punto final opcional («Ma. José»).
const NAME_WORD = /^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*\.?$/u;

export function validatePersonName(
  value: string,
  { label = 'El nombre', max = 100, required = true }: { label?: string; max?: number; required?: boolean } = {},
): FieldError {
  const text = (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
  if (!text) return required ? `${label} es obligatorio.` : null;
  if (/\p{N}/u.test(text)) return `Ingresa un nombre válido. No se permiten números en este campo.`;
  if (!text.split(' ').every(word => NAME_WORD.test(word))) {
    return `${label} solo admite letras, espacios, guiones y apóstrofos.`;
  }
  if ((text.match(/\p{L}/gu) ?? []).length < 2) return `${label} debe tener al menos 2 letras.`;
  if (text.length > max) return `${label} no puede superar ${max} caracteres.`;
  return null;
}

/** Nombre listo para enviar: sin espacios sobrantes; conserva tildes y mayúsculas. */
export function normalizePersonName(value: string): string {
  return (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

// ─── Correo electrónico ──────────────────────────────────────────────────────

const EMAIL_LOCAL = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const EMAIL_LABEL = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

export function normalizeEmail(value: string): string {
  return (value ?? '').trim().toLowerCase();
}

export function validateEmail(
  value: string,
  { label = 'El correo electrónico', max = 100, required = true }: { label?: string; max?: number; required?: boolean } = {},
): FieldError {
  const text = normalizeEmail(value);
  if (!text) return required ? `${label} es obligatorio.` : null;
  const message = 'Introduce un correo electrónico con un formato válido (ej.: nombre@colegio.edu.co).';
  if (/\s/.test(text) || text.split('@').length !== 2) return message;
  const [local, domain] = text.split('@');
  const labels = domain.split('.');
  if (
    !local || local.length > 64 || !EMAIL_LOCAL.test(local)
    || labels.length < 2 || !labels.every(part => EMAIL_LABEL.test(part))
    || !/^[a-z]{2,63}$/.test(labels[labels.length - 1])
  ) return message;
  if (text.length > max) return `${label} no puede superar ${max} caracteres.`;
  return null;
}

// ─── Documentos de identidad ─────────────────────────────────────────────────

export type DocumentType = 'CC' | 'TI' | 'CE' | 'PA';

export const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'CC', label: 'CC — Cédula de Ciudadanía' },
  { value: 'TI', label: 'TI — Tarjeta de Identidad' },
  { value: 'CE', label: 'CE — Cédula de Extranjería' },
  { value: 'PA', label: 'PA — Pasaporte' },
];

/** Igual que DOCUMENT_RULES en backend/app/core/validators.py. */
export const DOCUMENT_RULES: Record<DocumentType, { numeric: boolean; min: number; max: number; name: string }> = {
  CC: { numeric: true, min: 4, max: 10, name: 'cédula de ciudadanía' },
  TI: { numeric: true, min: 6, max: 11, name: 'tarjeta de identidad' },
  CE: { numeric: true, min: 4, max: 10, name: 'cédula de extranjería' },
  PA: { numeric: false, min: 5, max: 20, name: 'pasaporte' },
};

export function isDocumentType(value: string): value is DocumentType {
  return value in DOCUMENT_RULES;
}

/**
 * Limpia lo escrito o pegado en el número de documento. Para tipos numéricos
 * solo deja dígitos (un «1.234.567» pegado queda «1234567»); para pasaporte,
 * letras y números en mayúscula. Nunca convierte a número: conserva los ceros
 * iniciales. `removed` indica si se descartó algún carácter.
 */
export function filterDocumentInput(raw: string, type: DocumentType): { value: string; removed: boolean } {
  const rule = DOCUMENT_RULES[type];
  const cleaned = rule.numeric
    ? raw.replace(/\D/g, '')
    : raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const value = cleaned.slice(0, rule.max);
  // Puntos, espacios y guiones de formato no cuentan como «caracteres no válidos».
  const meaningful = raw.replace(/[\s.\-]/g, '');
  const expected = rule.numeric ? meaningful : meaningful.toUpperCase();
  return { value, removed: expected !== cleaned || cleaned.length > rule.max };
}

export function documentInputHint(type: DocumentType): string {
  const rule = DOCUMENT_RULES[type];
  return rule.numeric
    ? `Solo números, entre ${rule.min} y ${rule.max} dígitos.`
    : `Letras y números, entre ${rule.min} y ${rule.max} caracteres.`;
}

export function validateDocumentNumber(value: string, type: DocumentType): FieldError {
  const text = (value ?? '').trim();
  const rule = DOCUMENT_RULES[type];
  if (!text) return 'El número de documento es obligatorio.';
  if (/\s/.test(text)) return 'El número de documento no puede contener espacios.';
  const pattern = rule.numeric ? /^\d+$/ : /^[A-Z0-9]+$/i;
  if (!pattern.test(text)) {
    return rule.numeric
      ? `El documento debe contener únicamente números para ${rule.name}.`
      : `El ${rule.name} admite solo letras y números, sin espacios ni símbolos.`;
  }
  if (text.length < rule.min || text.length > rule.max) {
    return `El número de ${rule.name} debe tener entre ${rule.min} y ${rule.max} caracteres.`;
  }
  return null;
}

// ─── Teléfono ────────────────────────────────────────────────────────────────

/** Deja dígitos, espacios, guiones, paréntesis y un «+» solo al inicio. */
export function filterPhoneInput(raw: string): { value: string; removed: boolean } {
  const trimmedStart = raw.replace(/^\s+/, '');
  const plus = trimmedStart.startsWith('+') ? '+' : '';
  const body = (plus ? trimmedStart.slice(1) : trimmedStart).replace(/[^\d\s()-]/g, '');
  const value = (plus + body).slice(0, 25);
  return { value, removed: value !== trimmedStart };
}

export function validatePhone(value: string, { label = 'El teléfono', required = false } = {}): FieldError {
  const text = (value ?? '').trim();
  if (!text) return required ? `${label} es obligatorio.` : null;
  if (!/^\+?[\d\s()-]+$/.test(text)) {
    return `${label} solo admite números, «+» al inicio, espacios, guiones o paréntesis.`;
  }
  const digits = text.replace(/\D/g, '').length;
  if (digits < 7 || digits > 15) return `${label} debe tener entre 7 y 15 dígitos.`;
  return null;
}

// ─── Fechas y horas ──────────────────────────────────────────────────────────

/** Fecha local de hoy en AAAA-MM-DD (sin desfase por zona horaria UTC). */
export function todayISO(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** ¿AAAA-MM-DD es una fecha real? (rechaza 2025-02-30). Sin usar Date UTC. */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  const days = new Date(y, mo, 0).getDate();
  return d <= days;
}

export function validateDate(
  value: string,
  { label = 'La fecha', required = true, min, max }: { label?: string; required?: boolean; min?: string; max?: string } = {},
): FieldError {
  const text = (value ?? '').trim();
  if (!text) return required ? `${label} es obligatoria.` : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${label} debe tener el formato AAAA-MM-DD.`;
  if (!isRealDate(text)) return `${label} no es una fecha válida.`;
  if (min && text < min) return `${label} no puede ser anterior a ${min}.`;
  if (max && text > max) return `${label} no puede ser posterior a ${max}.`;
  return null;
}

/** Fecha de nacimiento: opcional, no futura, desde 1900. No impone edad mínima. */
export function validateBirthDate(value: string, today: string = todayISO()): FieldError {
  const text = (value ?? '').trim();
  if (!text) return null;
  if (!isRealDate(text)) return 'La fecha de nacimiento no es válida (usa AAAA-MM-DD).';
  if (text > today) return 'La fecha no puede ser posterior al día de hoy.';
  if (text < '1900-01-01') return 'La fecha de nacimiento debe ser posterior a 1900.';
  return null;
}

/** Rango de fechas: el final no puede ser anterior al inicio. */
export function validateDateRange(from: string, to: string): FieldError {
  if (from && to && to < from) return 'La fecha final no puede ser anterior a la inicial.';
  return null;
}

export function validateTime(value: string, { label = 'La hora' } = {}): FieldError {
  const text = (value ?? '').trim();
  if (!text) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(text) ? null : `${label} debe tener el formato HH:MM.`;
}

// ─── URL ─────────────────────────────────────────────────────────────────────

export function validateUrl(
  value: string,
  { label = 'El enlace', max = 500, required = true }: { label?: string; max?: number; required?: boolean } = {},
): FieldError {
  const text = (value ?? '').trim();
  if (!text) return required ? `${label} es obligatorio.` : null;
  if (/\s/.test(text)) return `${label} no puede contener espacios.`;
  if (text.length > max) return `${label} no puede superar ${max} caracteres.`;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return `${label} debe ser una dirección web que empiece por https://`;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
    return `${label} debe ser una dirección web que empiece por https://`;
  }
  if (url.username || url.password) return `${label} no puede incluir usuario ni contraseña.`;
  return null;
}

/** Solo devuelve la URL si es http(s): evita abrir enlaces javascript: o data:. */
export function safeHref(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost/';
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

// ─── Códigos ─────────────────────────────────────────────────────────────────

/** Código de invitación: 8 letras o números; no distingue mayúsculas. */
export function filterInviteCode(raw: string): { value: string; removed: boolean } {
  const upper = raw.toUpperCase();
  const cleaned = upper.replace(/[^A-Z0-9]/g, '');
  return { value: cleaned.slice(0, 8), removed: cleaned !== upper.replace(/\s/g, '') || cleaned.length > 8 };
}

export function validateInviteCode(value: string): FieldError {
  const text = (value ?? '').trim().toUpperCase();
  if (!text) return 'Debes ingresar un código de invitación.';
  if (!/^[A-Z0-9]{8}$/.test(text)) return 'El código de invitación tiene 8 letras o números, sin espacios ni símbolos.';
  return null;
}

export function filterDigits(raw: string, maxLength: number): { value: string; removed: boolean } {
  const cleaned = raw.replace(/\D/g, '');
  return { value: cleaned.slice(0, maxLength), removed: cleaned !== raw.replace(/[\s.]/g, '') || cleaned.length > maxLength };
}

/** Código DANE de la institución: solo dígitos, entre 5 y 12. */
export function validateDaneCode(value: string): FieldError {
  const text = (value ?? '').trim();
  if (!text) return 'El código DANE es obligatorio.';
  if (!/^\d+$/.test(text)) return 'El código DANE solo admite números.';
  if (text.length < 5 || text.length > 12) return 'El código DANE debe tener entre 5 y 12 dígitos.';
  return null;
}

/** Grado escolar: «10°», «11-A», «Décimo», «9 B». */
export function validateGrade(value: string, { required = false } = {}): FieldError {
  const text = (value ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return required ? 'El grado es obligatorio.' : null;
  if (!/^[\p{L}\p{N}]+(?:[\s\-./°º#][\p{L}\p{N}]*)*[°º]?$/u.test(text)) {
    return 'El grado solo admite letras, números, «°», guion o espacio (ej.: 10°, 11-A).';
  }
  if (text.length > 20) return 'El grado no puede superar 20 caracteres.';
  return null;
}

// ─── Números ─────────────────────────────────────────────────────────────────

/**
 * Número dentro de un rango. Rechaza vacío (si es obligatorio), NaN, infinitos
 * y decimales cuando el campo es entero.
 */
export function validateNumber(
  value: string | number,
  { label, min, max, integer = true, required = true }: { label: string; min: number; max: number; integer?: boolean; required?: boolean },
): FieldError {
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return required ? `${label} es obligatorio.` : null;
  const n = Number(text);
  if (!Number.isFinite(n)) return `${label} debe ser un número válido.`;
  if (integer && !Number.isInteger(n)) return `${label} debe ser un número entero.`;
  if (n < min) return `${label} debe ser al menos ${min}.`;
  if (n > max) return `El valor supera el máximo permitido (${max}).`;
  return null;
}

// ─── Archivos ────────────────────────────────────────────────────────────────

/** Formatos de material de apoyo (igual que UPLOAD_EXTENSIONS en teacher_materials.py). */
export const MATERIAL_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.zip', '.mp4', '.mp3',
];
export const MATERIAL_MAX_BYTES = 4 * 1024 * 1024;

export function fileExtension(name: string): string {
  const dot = (name ?? '').lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Extensión permitida, no vacío y tamaño máximo (el backend revisa además el contenido real). */
export function validateFile(
  file: { name: string; size: number },
  { extensions, maxBytes, label = 'El archivo' }: { extensions: string[]; maxBytes: number; label?: string },
): FieldError {
  const ext = fileExtension(file.name);
  if (!extensions.includes(ext)) {
    return `«${file.name}» no tiene un formato permitido (${extensions.join(', ')}).`;
  }
  if (file.size === 0) return `${label} «${file.name}» está vacío.`;
  if (file.size > maxBytes) return `${label} «${file.name}» supera el tamaño máximo admitido (${formatBytes(maxBytes)}).`;
  return null;
}

// ─── HTML ────────────────────────────────────────────────────────────────────

/** Escapa texto para insertarlo en HTML construido a mano (ventanas de impresión). */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Errores del backend ─────────────────────────────────────────────────────

type ApiError = { response?: { data?: { detail?: unknown; errors?: { field?: string; message?: string }[] } } };

/** Mensaje del backend listo para mostrar (`detail` texto o lista de Pydantic). */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const e = err as ApiError & { message?: string };
  const detail = e?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length) {
    const msg = (detail[0] as { msg?: string })?.msg;
    if (msg) return String(msg).replace(/^Value error,\s*/i, '');
  }
  if (!e?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}

/**
 * Errores por campo de una respuesta 422 (`errors: [{field, message}]`), con
 * los nombres de campo del backend traducidos a los del formulario.
 */
export function apiFieldErrors(err: unknown, fieldMap: Record<string, string> = {}): Record<string, string> {
  const list = (err as ApiError)?.response?.data?.errors;
  const out: Record<string, string> = {};
  if (!Array.isArray(list)) return out;
  for (const item of list) {
    const field = item?.field ?? '';
    const key = fieldMap[field] ?? field;
    if (key && item?.message && !(key in out)) out[key] = item.message;
  }
  return out;
}
