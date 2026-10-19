import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import {
  FileText, Download, CheckCircle, Clock,
  AlertTriangle, Building2, Users, GraduationCap,
  PieChart, type LucideIcon, RefreshCw,
} from 'lucide-react';
import api from '../../../services/api';

// ── Tipos (alineados exactamente con el backend) ─────────────────────────────
interface DashStats {
  total_teachers:  number;
  total_students:  number;
  total_groups:    number;
  avg_score:       number;           // QuizHistory promedio 0-10, real
  at_risk_count:   number;
  teacher_ranking: {
    name: string; subject: string;
    avg: number; participation: number; students: number;
  }[];
  at_risk_detail: {
    name: string; grade: string;
    avg: number; subject: string; risk: string;   // "medium" | "high"
  }[];
  students_detail?: {
    name: string; grade: string; avg: number;
    subject: string; risk: string;                // "high"|"medium"|"normal"|"Sin actividad"
    attempts: number;
  }[];
  areas_data: { label: string; pct: number }[];  // % de grupos por materia
}

interface InstitutionData {
  name:          string;
  dane_code?:    string;
  email?:        string;
  phone?:        string;
  address?:      string;
  logo_url?:     string;
  primary_color?: string;
}

interface AlertData {
  alerts: {
    priority: string; category: string;
    studentName: string; classroom: string;
    grade: string; subject: string;
    averageScore: number; totalSessions: number;
    totalTimeMinutes: number; riskLevel: string;
    riskFactors: string[];
  }[];
  total: number;
}

// ── Constructores de datos por reporte ───────────────────────────────────────
function getReportData(
  id: string, periodLabel: string,
  stats: DashStats | null,
  inst: InstitutionData | null,
  alerts: AlertData | null,
): { title: string; subtitle: string; data: { headers: string[]; rows: string[][] } } {

  switch (id) {

    case 'ejecutivo':
      return {
        title:    'Resumen Ejecutivo Institucional',
        subtitle: `Indicadores clave para toma de decisiones — ${periodLabel}`,
        data: {
          headers: ['Indicador', 'Valor', 'Contexto'],
          rows: [
            ['Institución',              inst?.name         ?? '—', inst?.dane_code ? `DANE ${inst.dane_code}` : '—'],
            ['Profesores activos',       String(stats?.total_teachers  ?? '—'), 'Docentes con acceso activo'],
            ['Estudiantes matriculados', String(stats?.total_students  ?? '—'), 'Con acceso activo al sistema'],
            ['Grupos académicos',        String(stats?.total_groups    ?? '—'), 'Grupos con docente asignado'],
            ['Promedio institucional',   stats ? `${stats.avg_score} / 10` : '—', 'Basado en actividad real de QuizHistory'],
            ['Estudiantes en riesgo',    String(stats?.at_risk_count   ?? '—'),
              stats?.total_students
                ? `${((stats.at_risk_count / stats.total_students) * 100).toFixed(1)}% de la matrícula`
                : 'Sin datos de matrícula'],
            ['Alertas activas (total)',   String(alerts?.total ?? '—'), 'Inactividad + bajo rendimiento + riesgo cognitivo'],
          ],
        },
      };

    case 'riesgo': {
      // Prioridad: usar students_detail filtrado a riesgo real; fallback: at_risk_detail
      const riskStudents = stats?.students_detail?.filter(
        s => ['high', 'medium', 'Sin actividad'].includes(s.risk)
      ) ?? stats?.at_risk_detail ?? [];

      const RISK_LABEL: Record<string, string> = {
        high:           'ALTO',
        medium:         'MEDIO',
        'Sin actividad': 'SIN ACTIVIDAD',
      };
      const ACTION: Record<string, string> = {
        high:           'Intervención inmediata — citar acudiente',
        medium:         'Seguimiento semanal — plan de refuerzo',
        'Sin actividad': 'Contactar al estudiante y verificar acceso',
      };

      return {
        title:    'Reporte de Riesgo Académico',
        subtitle: `Estudiantes que requieren atención prioritaria — ${periodLabel}`,
        data: {
          headers: ['Estudiante', 'Grado', 'Materia', 'Promedio', 'Nivel de riesgo', 'Intentos', 'Acción sugerida'],
          rows: riskStudents.map(s => [
            s.name, s.grade, s.subject,
            s.avg > 0 ? `${s.avg} / 10` : 'Sin datos',
            RISK_LABEL[s.risk] ?? s.risk.toUpperCase(),
            'attempts' in s ? String((s as any).attempts) : '—',
            ACTION[s.risk] ?? 'Monitorear',
          ]),
        },
      };
    }

    case 'docentes': {
      const ranking = stats?.teacher_ranking ?? [];
      return {
        title:    'Desempeño Docente',
        subtitle: `Rendimiento y participación por profesor — ${periodLabel}`,
        data: {
          headers: ['Docente', 'Área / Materia', 'Promedio grupo', 'Participación 7 días', 'N.º estudiantes', 'Estado'],
          rows: ranking.map(t => {
            const estado =
              t.avg >= 7 && t.participation >= 60 ? 'Destacado' :
              t.avg < 5 || t.participation < 30   ? 'Requiere acompañamiento' :
              'Normal';
            return [
              t.name, t.subject,
              t.avg > 0 ? `${t.avg} / 10` : 'Sin actividad',
              `${t.participation}%`,
              String(t.students),
              estado,
            ];
          }),
        },
      };
    }

    case 'areas': {
      // areas_data: distribución de GRUPOS por materia (no promedios de notas)
      const areas = stats?.areas_data ?? [];
      const maxPct = areas.length ? Math.max(...areas.map(a => a.pct)) : 0;
      return {
        title:    'Distribución de Grupos por Área Académica',
        subtitle: `Concentración de grupos activos por materia — ${periodLabel}`,
        data: {
          headers: ['Área / Materia', '% de grupos', 'Clasificación', 'Nota'],
          rows: areas.map(a => [
            a.label,
            `${a.pct}%`,
            a.pct === maxPct          ? 'Área con más grupos' :
            a.pct >= maxPct * 0.6    ? 'Alta cobertura'       :
            a.pct >= maxPct * 0.3    ? 'Cobertura media'      : 'Baja cobertura',
            a.pct < maxPct * 0.3
              ? 'Revisar si hay docentes asignados'
              : 'Cobertura adecuada',
          ]),
        },
      };
    }

    default:
      return { title: id, subtitle: periodLabel, data: { headers: [], rows: [] } };
  }
}

// ── Generador de PDF ─────────────────────────────────────────────────────────
function generatePDF(
  id: string, period: string,
  stats: DashStats | null,
  inst: InstitutionData | null,
  alerts: AlertData | null,
) {
  const PERIOD_LABELS: Record<string, string> = {
    periodo1: 'Período 1 (Ene–Mar)', periodo2: 'Período 2 (Abr–Jun)',
    periodo3: 'Período 3 (Jul–Sep)', periodo4: 'Período 4 (Oct–Dic)',
    anual: 'Año completo 2026',
  };
  const periodLabel = PERIOD_LABELS[period] ?? period;
  const { title, subtitle, data } = getReportData(id, periodLabel, stats, inst, alerts);
  const instName  = inst?.name     ?? 'NeuroLearn AI';
  const daneCode  = inst?.dane_code ?? '';
  const address   = inst?.address  ?? '';
  const email     = inst?.email    ?? '';

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();

  // ── Encabezado ──────────────────────────────────────────────────
  doc.setFillColor(105, 64, 165);
  doc.rect(0, 0, W, 32, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('NeuroLearn AI — Plataforma Educativa Institucional', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`${title}  ·  ${subtitle}`, 14, 19);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, W - 14, 19, { align: 'right' });

  // ── Datos institucionales ────────────────────────────────────────
  doc.setDrawColor(233, 233, 231);
  doc.setFillColor(250, 250, 249);
  doc.rect(14, 36, W - 28, 14, 'FD');
  doc.setTextColor(55, 53, 47);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(instName, 18, 42);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 119, 116);
  const meta = [daneCode && `DANE ${daneCode}`, address, email].filter(Boolean).join('  ·  ');
  if (meta) doc.text(meta, 18, 48);

  if (!data.rows.length) {
    doc.setFontSize(10);
    doc.setTextColor(120, 119, 116);
    doc.text('No hay datos disponibles para este reporte en el período seleccionado.', 14, 64);
    doc.save(`reporte_${id}_${period}_${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  // ── Tabla ────────────────────────────────────────────────────────
  const colCount = data.headers.length;
  const colW     = (W - 28) / colCount;
  let y = 60;

  doc.setFillColor(105, 64, 165);
  doc.rect(14, y - 5, W - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  data.headers.forEach((h, i) => doc.text(h.toUpperCase(), 16 + i * colW, y));

  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  data.rows.forEach((row, ri) => {
    y += 8;
    if (y > 188) { doc.addPage(); y = 20; }
    if (ri % 2 === 0) {
      doc.setFillColor(248, 247, 246);
      doc.rect(14, y - 5.5, W - 28, 7.5, 'F');
    }
    doc.setTextColor(25, 25, 25);
    row.forEach((cell, ci) => {
      const txt = String(cell);
      doc.text(txt.length > 40 ? txt.slice(0, 38) + '…' : txt, 16 + ci * colW, y);
    });
    doc.setDrawColor(233, 233, 231);
    doc.line(14, y + 2, W - 14, y + 2);
  });

  // ── Pie de página ────────────────────────────────────────────────
  const total = (doc.internal as any).pages.length - 1;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(174, 173, 171);
    doc.text(
      'NeuroLearn AI © 2026 — Documento generado automáticamente. Solo para uso institucional interno.',
      14, 200,
    );
    doc.text(`Página ${p} de ${total}`, W - 14, 200, { align: 'right' });
  }

  doc.save(`reporte_${id}_${period}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Generador de CSV ─────────────────────────────────────────────────────────
function generateCSV(
  id: string, period: string,
  stats: DashStats | null,
  inst: InstitutionData | null,
  alerts: AlertData | null,
) {
  const PERIOD_LABELS: Record<string, string> = {
    periodo1: 'Período 1', periodo2: 'Período 2',
    periodo3: 'Período 3', periodo4: 'Período 4', anual: 'Año completo 2026',
  };
  const periodLabel = PERIOD_LABELS[period] ?? period;
  const { title, data } = getReportData(id, periodLabel, stats, inst, alerts);

  const meta =
    `"Reporte: ${title}"\n` +
    `"Período: ${periodLabel}"\n` +
    `"Institución: ${inst?.name ?? '—'}"\n` +
    (inst?.dane_code ? `"DANE: ${inst.dane_code}"\n` : '') +
    `"Generado: ${new Date().toLocaleString('es-CO')}"\n\n`;

  const headers = data.headers.join(',');
  const rows    = data.rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob    = new Blob(['﻿' + meta + headers + '\n' + rows], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `reporte_${id}_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Definición de reportes ───────────────────────────────────────────────────
interface ReportType {
  id: string; title: string; desc: string;
  icon: LucideIcon; color: string; bg: string; border: string;
  columns: string[];
  badge?: string;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: 'ejecutivo', title: 'Resumen Ejecutivo',
    desc: 'Panorama completo: matrícula, planta docente, promedio institucional real y alertas activas. Diseñado para presentar a directivos.',
    icon: Building2, color: 'text-[#6940A5]', bg: 'bg-purple-50', border: 'border-purple-200',
    columns: ['Indicador', 'Valor', 'Contexto'],
    badge: 'Recomendado',
  },
  {
    id: 'riesgo', title: 'Riesgo Académico',
    desc: 'Lista de estudiantes con riesgo medio, alto o sin actividad. Incluye promedio real, intentos y acción sugerida por el sistema.',
    icon: AlertTriangle, color: 'text-[#E03E3E]', bg: 'bg-red-50', border: 'border-red-200',
    columns: ['Estudiante', 'Grado', 'Materia', 'Promedio', 'Riesgo', 'Intentos', 'Acción'],
  },
  {
    id: 'docentes', title: 'Desempeño Docente',
    desc: 'Ranking de docentes con promedio real del grupo (0-10), participación de la última semana, número de estudiantes y estado de gestión.',
    icon: Users, color: 'text-[#0B6E99]', bg: 'bg-blue-50', border: 'border-blue-200',
    columns: ['Docente', 'Materia', 'Promedio', 'Participación', 'Estudiantes', 'Estado'],
  },
  {
    id: 'areas', title: 'Distribución por Áreas',
    desc: 'Concentración de grupos activos por área o materia. Permite identificar materias con poca cobertura docente asignada.',
    icon: PieChart, color: 'text-[#0F7B6C]', bg: 'bg-emerald-50', border: 'border-emerald-200',
    columns: ['Área', '% de grupos', 'Clasificación', 'Nota'],
  },
];

// ── Componente principal ─────────────────────────────────────────────────────
export default function ReportesTab() {
  const [generating,   setGenerating]   = useState<string | null>(null);
  const [generated,    setGenerated]    = useState<Set<string>>(new Set());
  const [period,       setPeriod]       = useState('periodo1');
  const [formatType,   setFormatType]   = useState<'pdf' | 'csv'>('pdf');
  const [dashStats,    setDashStats]    = useState<DashStats | null>(null);
  const [instData,     setInstData]     = useState<InstitutionData | null>(null);
  const [alertData,    setAlertData]    = useState<AlertData | null>(null);
  const [loadingData,  setLoadingData]  = useState(true);
  const [loadError,    setLoadError]    = useState('');

  const loadData = () => {
    setLoadError('');
    setLoadingData(true);
    Promise.all([
      api.get('/super/stats/dashboard'),
      api.get('/super/institution'),
      api.get('/super/stats/alerts'),
    ])
      .then(([statsRes, instRes, alertsRes]) => {
        setDashStats(statsRes.data  ?? null);
        setInstData(instRes.data    ?? null);
        setAlertData(alertsRes.data ?? null);
      })
      .catch(err => {
        const msg = err?.response?.data?.detail ?? err?.message ?? 'Error desconocido';
        setLoadError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      })
      .finally(() => setLoadingData(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleGenerate = (id: string) => {
    if (!dashStats) {
      setLoadError('Aún no hay datos. Reintenta la carga antes de generar el reporte.');
      return;
    }
    setGenerating(id);
    setTimeout(() => {
      setGenerating(null);
      setGenerated(prev => new Set([...prev, id]));
    }, 900);
  };

  const handleDownload = (id: string) => {
    if (!dashStats) { setLoadError('No hay datos para generar el reporte.'); return; }
    if (formatType === 'pdf') generatePDF(id, period, dashStats, instData, alertData);
    else generateCSV(id, period, dashStats, instData, alertData);
  };

  const dataReady = !loadingData && !!dashStats;

  return (
    <div className="space-y-5">

      {/* ── Controles ── */}
      <div className="bg-white border border-[#E9E9E7] rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#191919] text-sm">Reportes institucionales</h3>
          <p className="text-xs text-[#787774] mt-0.5">
            {loadingData
              ? 'Cargando datos del backend…'
              : dashStats
              ? `Datos listos · ${instData?.name ?? 'Institución'}`
              : 'Sin datos — verifica la conexión'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Formato */}
          <div className="flex gap-1 bg-[#F7F6F3] p-1 rounded-lg border border-[#E9E9E7]">
            {(['pdf', 'csv'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFormatType(f); setGenerated(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  formatType === f
                    ? 'bg-white shadow-sm border border-[#E9E9E7] text-[#191919]'
                    : 'text-[#787774] hover:bg-white/60'
                }`}
              >
                {f === 'pdf'
                  ? <FileText className="w-3.5 h-3.5" />
                  : <GraduationCap className="w-3.5 h-3.5" />}
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Período */}
          <select
            value={period}
            onChange={e => { setPeriod(e.target.value); setGenerated(new Set()); }}
            className="px-3 py-1.5 border border-[#E9E9E7] rounded-lg text-sm focus:ring-1 focus:ring-[#6940A5] outline-none bg-white"
          >
            <option value="periodo1">Período 1 — Ene · Mar</option>
            <option value="periodo2">Período 2 — Abr · Jun</option>
            <option value="periodo3">Período 3 — Jul · Sep</option>
            <option value="periodo4">Período 4 — Oct · Dic</option>
            <option value="anual">Año completo 2026</option>
          </select>

          {/* Actualizar */}
          <button
            onClick={loadData}
            disabled={loadingData}
            className="p-2 rounded-lg border border-[#E9E9E7] bg-white hover:bg-[#F7F6F3] text-[#787774] transition-colors disabled:opacity-50"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {loadError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">No se pudieron cargar los datos</p>
              <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
            </div>
          </div>
          <button
            onClick={loadData}
            className="text-xs font-semibold text-red-700 border border-red-300 bg-white hover:bg-red-50 rounded-lg px-3 py-1.5 flex-shrink-0 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── Tarjetas ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_TYPES.map(report => {
          const isGenerating = generating === report.id;
          const isDone       = generated.has(report.id);
          const Icon         = report.icon;

          return (
            <div
              key={report.id}
              className={`bg-white border rounded-xl p-5 flex flex-col gap-4 transition-all hover:shadow-md ${report.border}`}
            >
              {/* Cabecera */}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 ${report.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${report.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[#191919] text-sm">{report.title}</h4>
                    {report.badge && (
                      <span className="text-[10px] font-semibold text-[#6940A5] bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-full">
                        {report.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#787774] mt-1 leading-relaxed">{report.desc}</p>
                </div>
              </div>

              {/* Columnas que incluye */}
              <div className="flex flex-wrap gap-1.5">
                {report.columns.map(col => (
                  <span
                    key={col}
                    className="text-[10px] font-medium text-[#787774] bg-[#F7F6F3] border border-[#E9E9E7] px-2 py-0.5 rounded-full"
                  >
                    {col}
                  </span>
                ))}
              </div>

              {/* Acciones */}
              <div className="flex items-center justify-between pt-1 border-t border-[#F7F6F3]">
                <span className="text-xs flex items-center gap-1.5 text-[#AEADAB]">
                  {isDone ? (
                    <>
                      <CheckCircle className="w-3.5 h-3.5 text-[#0F7B6C]" />
                      <span className="text-[#0F7B6C] font-medium">{formatType.toUpperCase()} listo</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      ~1 segundo
                    </>
                  )}
                </span>

                <div className="flex items-center gap-2">
                  {isDone && (
                    <button
                      onClick={() => handleDownload(report.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm ${
                        formatType === 'pdf'
                          ? 'bg-[#6940A5] text-white hover:bg-[#5A358F]'
                          : 'bg-[#0F7B6C] text-white hover:bg-[#0A6357]'
                      }`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar {formatType.toUpperCase()}
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerate(report.id)}
                    disabled={isGenerating || !dataReady}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isDone
                        ? 'bg-[#F7F6F3] text-[#787774] border border-[#E9E9E7] hover:bg-[#EFEFED]'
                        : isGenerating || !dataReady
                        ? 'bg-[#F7F6F3] text-[#AEADAB] cursor-wait'
                        : 'bg-[#37352F] text-white hover:bg-[#2F2D2B] shadow-sm'
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-[#787774] border-t-transparent animate-spin" />
                        Generando…
                      </>
                    ) : isDone ? (
                      <><CheckCircle className="w-3.5 h-3.5 text-[#0F7B6C]" /> Regenerar</>
                    ) : (
                      <><FileText className="w-3.5 h-3.5" /> Generar {formatType.toUpperCase()}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Nota ── */}
      <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-xl p-4 text-center">
        <p className="text-xs text-[#787774]">
          {formatType === 'pdf'
            ? '📄 PDF con encabezado institucional (nombre, DANE, dirección), tabla formateada y pie de página numerado.'
            : '📊 CSV con BOM UTF-8 — compatible con Excel y Google Sheets sin problemas de tildes.'}
          {' '}Todos los datos vienen directamente del backend de la institución.
        </p>
      </div>

    </div>
  );
}