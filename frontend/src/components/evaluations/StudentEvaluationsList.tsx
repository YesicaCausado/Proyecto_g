import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Clock, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import { STATE_LABELS, apiError, formatDateTime, type StudentEvaluation } from './shared';

/**
 * Lista de evaluaciones del estudiante (GET /student/evaluations).
 * Se usa en la página Evaluaciones y dentro de cada clase (con `classroomId`).
 */
export default function StudentEvaluationsList({ classroomId, title }: { classroomId?: number; title?: string }) {
  const [items, setItems] = useState<StudentEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/student/evaluations', {
          params: classroomId ? { classroom_id: classroomId } : undefined,
        });
        setItems(res.data?.evaluations ?? []);
      } catch (err) {
        setError(apiError(err, 'No se pudieron cargar las evaluaciones.'));
      } finally {
        setLoading(false);
      }
    })();
  }, [classroomId]);

  const pending = items.filter(e => e.state === 'pendiente' || e.state === 'en_curso');
  const done = items.filter(e => !(e.state === 'pendiente' || e.state === 'en_curso'));

  const Row = ({ ev }: { ev: StudentEvaluation }) => {
    const st = STATE_LABELS[ev.state];
    return (
      <Link to={`/evaluations?id=${ev.id}`}
        className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7F6F3] transition-colors">
        <div className="w-9 h-9 rounded-lg bg-[#EEF3FD] flex items-center justify-center flex-shrink-0">
          <ClipboardCheck className="w-4 h-4 text-[#2E6FDB]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#191919] truncate">{ev.title}</p>
          <p className="text-[11px] text-[#787774] flex items-center gap-1.5 flex-wrap">
            {!classroomId && <span>{ev.classroom_name} ·</span>}
            <span>{ev.questions_count} preguntas · {ev.duration} min</span>
            {ev.deadline && <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> hasta {formatDateTime(ev.deadline)}</span>}
          </p>
        </div>
        {ev.official?.percentage != null && (
          <span className="text-sm font-bold text-[#0F7B6C]">{ev.official.percentage}%</span>
        )}
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${st.cls}`}>{st.label}</span>
        <ChevronRight className="w-4 h-4 text-[#AEADAB]" />
      </Link>
    );
  };

  return (
    <div className="bg-white border border-[#E9E9E7] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E9E9E7] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#191919]">{title ?? 'Evaluaciones'}</h3>
        {pending.length > 0 && (
          <span className="text-[11px] font-semibold text-[#D9730D]">{pending.length} por responder</span>
        )}
      </div>
      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-[#2E6FDB]" /></div>
      ) : error ? (
        <p className="px-4 py-6 text-sm text-[#E03E3E] flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>
      ) : items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-[#787774]">No hay evaluaciones publicadas.</p>
      ) : (
        <div className="divide-y divide-[#F7F6F3]">
          {pending.map(ev => <Row key={ev.id} ev={ev} />)}
          {done.map(ev => <Row key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  );
}
