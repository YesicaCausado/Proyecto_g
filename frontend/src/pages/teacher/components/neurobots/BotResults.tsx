/**
 * Resultados reales de los estudiantes con un NeuroBot (GET /bots/{id}/progress):
 * estado, progreso (interacciones / meta), última actividad y fecha de completado.
 */
import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, RotateCcw, TrendingUp } from 'lucide-react';
import api from '../../../../services/api';

interface ResultRow {
  student_id: number;
  full_name: string;
  username: string;
  sources: string[];
  status: 'asignado' | 'iniciado' | 'en_progreso' | 'completado';
  status_label: string;
  percent: number;
  interactions: number;
  goal_interactions: number;
  last_activity_at: string | null;
  completed_at: string | null;
}

interface Results {
  total: number;
  summary: Record<ResultRow['status'], number>;
  students: ResultRow[];
}

const STATUS_STYLE: Record<ResultRow['status'], string> = {
  asignado:    'bg-[#F7F6F3] text-[#787774] border-[#E9E9E7]',
  iniciado:    'bg-[#FBF3DB] text-[#9F6B00] border-[#F0DDA4]',
  en_progreso: 'bg-[#EEF3FD] text-[#2E6FDB] border-[#C5D9F7]',
  completado:  'bg-[#EDF7F5] text-[#0F7B6C] border-[#B7E1D9]',
};

const SUMMARY: Array<[ResultRow['status'], string]> = [
  ['asignado', 'Asignado'], ['iniciado', 'Iniciado'], ['en_progreso', 'En progreso'], ['completado', 'Completado'],
];

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function BotResults({ botId, refreshKey }: { botId: string; refreshKey: number }) {
  const [data, setData] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<Results>(`/bots/${botId}/progress`, { params: { _t: Date.now() } });
      setData(res.data);
    } catch {
      setError('No fue posible cargar los resultados de tus estudiantes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [botId, refreshKey]);

  return (
    <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E9E9E7] flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#191919] text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#2E6FDB]" /> Progreso de tus estudiantes
          </h3>
          <p className="text-xs text-[#787774] mt-0.5">Estado real de cada estudiante al que asignaste este NeuroBot.</p>
        </div>
        <button onClick={load} disabled={loading} title="Actualizar"
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#F7F6F3] text-[#787774] disabled:opacity-50">
          <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="p-8 text-center">
          <AlertCircle className="w-8 h-8 text-[#E03E3E] mx-auto mb-2" />
          <p className="text-sm text-[#E03E3E]">{error}</p>
          <button onClick={load} className="mt-3 text-xs font-medium text-[#2E6FDB] hover:underline">Reintentar</button>
        </div>
      ) : loading && !data ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#2E6FDB]" /></div>
      ) : !data || data.total === 0 ? (
        <p className="p-8 text-center text-sm text-[#787774]">
          Todavía no has asignado este NeuroBot a estudiantes. Usa «Asignar» para hacerlo.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4 border-b border-[#E9E9E7] bg-[#FBFBFA]">
            {SUMMARY.map(([key, label]) => (
              <div key={key} className={`rounded-md border px-3 py-2 ${STATUS_STYLE[key]}`}>
                <p className="text-lg font-bold leading-none">{data.summary[key] ?? 0}</p>
                <p className="text-[11px] mt-1">{label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-[#787774] border-b border-[#E9E9E7]">
                  <th className="px-4 py-2 font-medium">Estudiante</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium min-w-[160px]">Progreso</th>
                  <th className="px-4 py-2 font-medium">Última actividad</th>
                  <th className="px-4 py-2 font-medium">Completado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F7F6F3]">
                {data.students.map(r => (
                  <tr key={r.student_id}>
                    <td className="px-4 py-2.5">
                      <p className="text-[#191919] font-medium">{r.full_name}</p>
                      <p className="text-[11px] text-[#AEADAB]">{r.sources.join(' · ')}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>
                        {r.status_label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#E9E9E7] rounded-full overflow-hidden">
                          <div className="h-full bg-[#2E6FDB]" style={{ width: `${r.percent}%` }} />
                        </div>
                        <span className="text-xs text-[#787774] whitespace-nowrap">{r.percent}%</span>
                      </div>
                      <p className="text-[11px] text-[#AEADAB] mt-0.5">{r.interactions} / {r.goal_interactions} interacciones</p>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-[#787774] whitespace-nowrap">{formatDate(r.last_activity_at)}</td>
                    <td className="px-4 py-2.5 text-xs text-[#787774] whitespace-nowrap">{formatDate(r.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
