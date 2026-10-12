/**
 * Tipos y utilidades compartidas de las evaluaciones del estudiante
 * (EvaluationsPage y la lista dentro de cada clase).
 * Fuente de datos: /api/v1/student/evaluations (student_evaluations.py).
 */

export type EvalState = 'pendiente' | 'en_curso' | 'pendiente_revision' | 'calificada' | 'no_entregada';

export interface AttemptInfo {
  id: number;
  attempt_number: number;
  status: 'en_curso' | 'pendiente_revision' | 'calificada';
  score: number | null;
  max_score: number | null;
  percentage: number | null;
  auto_submitted: boolean;
  started_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
}

export interface StudentEvaluation {
  id: number;
  title: string;
  type: 'cuestionario' | 'examen';
  classroom_id: number;
  classroom_name: string;
  status: 'publicada' | 'cerrada';
  deadline: string | null;
  date: string;
  duration: number;
  attempts_allowed: number;
  attempts_used: number;
  questions_count: number;
  max_score: number;
  state: EvalState;
  can_start: boolean;
  in_progress_id: number | null;
  official: AttemptInfo | null;
  corrections_available: boolean;
}

export const STATE_LABELS: Record<EvalState, { label: string; cls: string }> = {
  pendiente:          { label: 'Pendiente',              cls: 'bg-[#FEF3E7] text-[#D9730D]' },
  en_curso:           { label: 'En curso',               cls: 'bg-[#EEF3FD] text-[#2E6FDB]' },
  pendiente_revision: { label: 'En revisión del profesor', cls: 'bg-purple-50 text-[#6940A5]' },
  calificada:         { label: 'Calificada',             cls: 'bg-[#EEF7F4] text-[#0F7B6C]' },
  no_entregada:       { label: 'No entregada',           cls: 'bg-red-50 text-[#E03E3E]' },
};

/** Fecha y hora local legible a partir de un ISO UTC del backend. */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Mensaje de error real del backend (FastAPI `detail`). */
export function apiError(err: any, fallback: string): string {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg).replace(/^Value error,\s*/i, '');
  if (!err?.response) return 'No se pudo conectar con el servidor. Revisa tu conexión.';
  return fallback;
}
