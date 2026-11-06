import { useEffect, useState } from 'react';
import { AlertCircle, Download, LoaderCircle, UserRound, X } from 'lucide-react';
import api from '../../../services/api';

interface StudentOption {
  id: number;
  name: string;
  username: string;
  groups: string[];
}

interface HistoryRow {
  date: string;
  source: string;
  competency_name: string;
  title: string;
  source_label: string;
  percentage: number;
  score: number | null;
  max_score: number | null;
  attempts: number;
}

interface StudentReport {
  student: StudentOption;
  period: string;
  summary: {
    results: number;
    average: number | null;
    last_result: string | null;
    quiz_results: number;
    evaluation_results: number;
    pending_review: number;
    competencies_evaluated: string[];
  };
  competencies: { key: string; name: string; results: number; average: number | null }[];
  history: HistoryRow[];
  neurodigital: {
    fatigue: number | null;
    overload: number | null;
    doubt: number | null;
    mastery: number | null;
    evidence_count: number;
  };
}

async function errorMessage(error: unknown): Promise<string> {
  const err = error as { response?: { data?: unknown }; message?: string };
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      const body = JSON.parse(await data.text());
      if (typeof body?.detail === 'string') return body.detail;
    } catch {
      return 'El servidor devolvió un error que no se pudo interpretar.';
    }
  }
  if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    return data.detail;
  }
  return err.message || 'No fue posible completar la solicitud.';
}

function percentage(value: number | null): string {
  return value === null ? 'Sin datos' : `${value.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`;
}

export default function IndividualStudentReportModal({ onClose }: { onClose: () => void }) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentId, setStudentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<StudentReport | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [format, setFormat] = useState<'pdf' | 'csv'>('pdf');

  useEffect(() => {
    let active = true;
    api.get<{ items: StudentOption[] }>('/teacher/reports/students')
      .then(response => { if (active) setStudents(response.data.items); })
      .catch(async err => { if (active) setError(await errorMessage(err)); })
      .finally(() => { if (active) setLoadingStudents(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!studentId) {
      setData(null);
      setError('');
      setLoadingReport(false);
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      setData(null);
      setError('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    let active = true;
    setData(null);
    setLoadingReport(true);
    setError('');
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    api.get<StudentReport>(`/teacher/reports/students/${studentId}`, { params })
      .then(response => { if (active) setData(response.data); })
      .catch(async err => { if (active) setError(await errorMessage(err)); })
      .finally(() => { if (active) setLoadingReport(false); });
    return () => { active = false; };
  }, [studentId, startDate, endDate]);

  const download = async () => {
    if (!studentId || exporting || (startDate && endDate && startDate > endDate)) return;
    setExporting(true);
    setError('');
    const params: Record<string, string> = { report: 'estudiante', student_id: studentId, format };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    try {
      const response = await api.get('/teacher/reports/export', { params, responseType: 'blob' });
      const blob = response.data as Blob;
      if (!blob.size) {
        setError('El servidor devolvió un archivo vacío.');
        return;
      }
      const disposition = String(response.headers?.['content-disposition'] ?? '');
      const filename = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
      const fallback = `reporte_estudiante.${format}`;
      const name = filename ? decodeURIComponent(filename) : fallback;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(await errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const inputClass = 'w-full px-3 py-2 border border-[#E9E9E7] rounded-lg text-sm bg-white';
  const selectedStudent = data?.student;
  const neuroIndicators: { label: string; value: number | null }[] = data ? [
    { label: 'Fatiga', value: data.neurodigital.fatigue },
    { label: 'Sobrecarga', value: data.neurodigital.overload },
    { label: 'Duda', value: data.neurodigital.doubt },
    { label: 'Dominio / flujo', value: data.neurodigital.mastery },
  ] : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="student-report-title">
      <div className="w-full max-w-4xl max-h-[92dvh] overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E9E9E7] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-[#2E6FDB]" />
            <div>
              <h3 id="student-report-title" className="font-semibold text-[#191919]">Reporte individual</h3>
              <p className="text-xs text-[#787774]">Solo estudiantes activos de tus grupos</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#787774] hover:text-[#37352F]" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-semibold text-[#787774]">
              Estudiante
              <select aria-label="Estudiante" value={studentId} onChange={event => setStudentId(event.target.value)}
                disabled={loadingStudents} className={`${inputClass} mt-1 font-normal`}>
                <option value="">{loadingStudents ? 'Cargando estudiantes…' : 'Selecciona un estudiante'}</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} · {student.groups.join(', ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#787774]">
              Desde
              <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
            <label className="text-xs font-semibold text-[#787774]">
              Hasta
              <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className={`${inputClass} mt-1`} />
            </label>
          </div>

          {error && <p role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-[#E03E3E]">
            <AlertCircle className="h-4 w-4 shrink-0" />{error}
          </p>}
          {loadingReport && <p className="flex items-center gap-2 text-sm text-[#787774]"><LoaderCircle className="h-4 w-4 animate-spin" />Cargando el reporte…</p>}
          {!loadingStudents && students.length === 0 && !error && (
            <p className="text-sm text-[#787774]">No tienes estudiantes activos inscritos en tus grupos activos.</p>
          )}

          {data && !loadingReport && (
            <div className="space-y-4">
              <div>
                <h4 className="text-lg font-bold text-[#191919]">{selectedStudent?.name}</h4>
                <p className="text-xs text-[#787774]">@{selectedStudent?.username} · {selectedStudent?.groups.join(', ')} · {data.period}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  ['Resultados', String(data.summary.results)],
                  ['Promedio', percentage(data.summary.average)],
                  ['Quizzes', String(data.summary.quiz_results)],
                  ['Evaluaciones', String(data.summary.evaluation_results)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-[#E9E9E7] p-3">
                    <p className="text-xs text-[#787774]">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-[#191919]">{value}</p>
                  </div>
                ))}
              </div>

              {data.summary.results === 0 ? (
                <p className="rounded-lg bg-[#F7F6F3] p-3 text-sm text-[#787774]">
                  No hay evaluaciones ni quizzes calificados para este estudiante en el período seleccionado.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[#E9E9E7]">
                  <table className="w-full min-w-[620px] text-left text-xs">
                    <thead className="bg-[#F7F6F3] text-[#787774]">
                      <tr>{['Fecha', 'Competencia', 'Actividad', 'Fuente', 'Resultado'].map(label => <th key={label} className="px-3 py-2 font-semibold">{label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {data.history.map((row, index) => (
                        <tr key={`${row.source}-${row.title}-${index}`} className="border-t border-[#E9E9E7]">
                          <td className="px-3 py-2 whitespace-nowrap">{row.date || '—'}</td>
                          <td className="px-3 py-2">{row.competency_name}</td>
                          <td className="px-3 py-2">{row.title}</td>
                          <td className="px-3 py-2">{row.source_label}</td>
                          <td className="px-3 py-2 font-semibold">{percentage(row.percentage)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <section className="rounded-lg border border-[#E9E9E7] p-3">
                <h5 className="mb-2 text-sm font-semibold text-[#191919]">Competencias evaluadas</h5>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.competencies.filter(item => item.results > 0).map(item => (
                    <p key={item.key} className="text-xs text-[#37352F]">{item.name}: {percentage(item.average)} · {item.results} resultado(s)</p>
                  ))}
                  {data.summary.competencies_evaluated.length === 0 && (
                    <p className="text-xs text-[#787774]">Sin competencias evaluadas en el período.</p>
                  )}
                </div>
                {data.summary.pending_review > 0 && (
                  <p className="mt-2 text-xs text-[#D9730D]">{data.summary.pending_review} evaluación(es) pendiente(s) de revisión; no se incluyen en el promedio.</p>
                )}
              </section>

              <section className="rounded-lg border border-[#E9E9E7] p-3">
                <h5 className="mb-1 text-sm font-semibold text-[#191919]">Indicadores neurodigitales</h5>
                <p className="mb-2 text-[11px] text-[#787774]">
                  {data.neurodigital.evidence_count > 0
                    ? `${data.neurodigital.evidence_count} eventos con evidencia suficiente`
                    : 'No hay eventos con evidencia suficiente en el período; no se estiman valores.'}
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {neuroIndicators.map(indicator => (
                    <div key={indicator.label} className="rounded bg-[#F7F6F3] p-2 text-center">
                      <p className="text-[11px] text-[#787774]">{indicator.label}</p>
                      <p className="text-sm font-semibold text-[#191919]">{percentage(indicator.value)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-[#E9E9E7] bg-white px-5 py-4">
          <select aria-label="Formato del reporte" value={format} onChange={event => setFormat(event.target.value as 'pdf' | 'csv')}
            className="rounded-lg border border-[#E9E9E7] bg-white px-3 py-2 text-sm">
            <option value="pdf">PDF</option>
            <option value="csv">CSV</option>
          </select>
          <button onClick={download} disabled={!studentId || exporting || loadingReport || (!!startDate && !!endDate && startDate > endDate)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#2E6FDB] px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            {exporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Descargar reporte
          </button>
        </div>
      </div>
    </div>
  );
}
