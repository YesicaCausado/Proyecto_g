import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { FileText, Download, CheckCircle, Clock, Building2, Users, GraduationCap, BookOpen, Bot, AlertTriangle, TrendingUp, Calendar, FileSpreadsheet } from 'lucide-react';
import api from '../../../services/api';

// ── Tipos ────────────────────────────────────────────────────────────────────
type ReportData = { headers: string[]; rows: string[][] };

interface DashStats {
  total_teachers: number;
  total_students: number;
  total_groups: number;
  avg_score: number;
  at_risk_count: number;
  teacher_ranking: { name: string; subject: string; avg: number; participation: number; students: number }[];
  at_risk_detail: { name: string; grade: string; avg: number; subject: string; risk: string }[];
  areas_data: { label: string; pct: number }[];
}

function getReportData(id: string, periodLabel: string, stats: DashStats | null, instName: string): { title: string; subtitle: string; data: ReportData } {
  const base: Record<string, { title: string; subtitle: string; data: ReportData }> = {
    institucional: {
      title: 'Reporte Institucional', subtitle: `Resumen ejecutivo — ${periodLabel}`,
      data: { headers: ['Indicador','Valor'], rows: [
        ['Total profesores',    String(stats?.total_teachers  ?? '—')],
        ['Total estudiantes',   String(stats?.total_students  ?? '—')],
        ['Grupos activos',      String(stats?.total_groups    ?? '—')],
        ['Promedio institucional', stats ? `${stats.avg_score} / 10` : '—'],
        ['Estudiantes en riesgo',  String(stats?.at_risk_count ?? '—')],
      ]},
    },
    profesores: {
      title: 'Reporte por Profesor', subtitle: `Rendimiento docente — ${periodLabel}`,
      data: { headers: ['Nombre','Materia','Promedio','Participación','Estudiantes'], rows:
        stats?.teacher_ranking.map(t => [
          t.name, t.subject, String(t.avg), `${t.participation}%`, String(t.students),
        ]) ?? [],
      },
    },
    estudiantes: {
      title: 'Reporte por Estudiante', subtitle: `Estudiantes en riesgo — ${periodLabel}`,
      data: { headers: ['Nombre','Grado','Promedio','Materia','Riesgo'], rows:
        stats?.at_risk_detail.map(s => [
          s.name, s.grade, String(s.avg), s.subject, s.risk.toUpperCase(),
        ]) ?? [],
      },
    },
    grado: {
      title: 'Reporte por Área', subtitle: `Distribución por áreas — ${periodLabel}`,
      data: { headers: ['Área','% del total'], rows:
        stats?.areas_data.map(a => [a.label, `${a.pct}%`]) ?? [],
      },
    },
    alertas: {
      title: 'Reporte de Alertas IA', subtitle: `Estudiantes en riesgo académico — ${periodLabel}`,
      data: { headers: ['Nombre','Grado','Promedio','Materia','Nivel de riesgo'], rows:
        stats?.at_risk_detail.map(s => [
          s.name, s.grade, String(s.avg), s.subject, s.risk.toUpperCase(),
        ]) ?? [],
      },
    },
    neurobots: {
      title: 'Uso de NeuroBots', subtitle: `Estadísticas institucionales — ${periodLabel}`,
      data: { headers: ['Indicador','Valor'], rows: [
        ['Total profesores con bots', String(stats?.total_teachers ?? '—')],
        ['Grupos activos', String(stats?.total_groups ?? '—')],
        ['Institución', instName || '—'],
      ]},
    },
    comparativo: {
      title: 'Comparativo Mensual', subtitle: `Métricas actuales — ${periodLabel}`,
      data: { headers: ['Indicador','Valor Actual'], rows: [
        ['Promedio institucional', stats ? `${stats.avg_score} / 10` : '—'],
        ['Total estudiantes', String(stats?.total_students ?? '—')],
        ['Estudiantes en riesgo', String(stats?.at_risk_count ?? '—')],
        ['Grupos activos', String(stats?.total_groups ?? '—')],
      ]},
    },
    anual: {
      title: 'Resumen Anual', subtitle: `Histórico institucional — ${periodLabel}`,
      data: { headers: ['Indicador','Valor'], rows: [
        ['Profesores activos', String(stats?.total_teachers ?? '—')],
        ['Estudiantes activos', String(stats?.total_students ?? '—')],
        ['Grupos', String(stats?.total_groups ?? '—')],
        ['Promedio general', stats ? `${stats.avg_score} / 10` : '—'],
      ]},
    },
  };
  return base[id] ?? { title: id, subtitle: periodLabel, data: { headers: [], rows: [] } };
}

// ── Generador real de PDF con jsPDF ─────────────────────────────────────────
function generatePDF(id: string, period: string, stats: DashStats | null, instName: string) {
  const PERIOD_LABELS: Record<string, string> = {
    periodo1: 'Período 1 (Ene–Mar)', periodo2: 'Período 2 (Abr–Jun)',
    periodo3: 'Período 3 (Jul–Sep)', periodo4: 'Período 4 (Oct–Dic)', anual: 'Año completo 2026',
  };
  const periodLabel = PERIOD_LABELS[period] ?? period;
  const { title, subtitle, data } = getReportData(id, periodLabel, stats, instName);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // Header morado
  doc.setFillColor(105, 64, 165);
  doc.rect(0, 0, W, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('NeuroLearn AI — Plataforma Educativa Institucional', 14, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`${title}  |  ${subtitle}`, 14, 20);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, W - 14, 20, { align: 'right' });

  doc.setTextColor(55, 53, 47);
  doc.setFontSize(8.5);
  doc.text(`Institución: ${instName || 'NeuroLearn AI'}`, 14, 36);

  // Cabecera de tabla
  const colCount = data.headers.length;
  const colW = (W - 28) / colCount;
  let y = 44;

  doc.setFillColor(247, 246, 243);
  doc.rect(14, y - 5, W - 28, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(120, 119, 116);
  data.headers.forEach((h, i) => {
    doc.text(h.toUpperCase(), 16 + i * colW, y);
  });

  y += 4;
  doc.setDrawColor(233, 233, 231);
  doc.line(14, y, W - 14, y);

  // Filas de datos
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  data.rows.forEach((row, ri) => {
    y += 8;
    if (y > 188) { doc.addPage(); y = 20; }
    if (ri % 2 === 0) {
      doc.setFillColor(252, 252, 251);
      doc.rect(14, y - 5.5, W - 28, 7.5, 'F');
    }
    doc.setTextColor(25, 25, 25);
    row.forEach((cell, ci) => doc.text(String(cell), 16 + ci * colW, y));
    doc.setDrawColor(240, 240, 238);
    doc.line(14, y + 2, W - 14, y + 2);
  });

  // Footer en cada página
  const total = (doc.internal as any).pages.length - 1;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(174, 173, 171);
    doc.text('NeuroLearn AI © 2026 — Documento generado automáticamente. Solo para uso institucional interno.', 14, 200);
    doc.text(`Página ${p} de ${total}`, W - 14, 200, { align: 'right' });
  }

  doc.save(`reporte_${id}_${period}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ── Generador real de CSV ────────────────────────────────────────────────────
function generateCSV(id: string, period: string, stats: DashStats | null, instName: string) {
  const PERIOD_LABELS: Record<string, string> = {
    periodo1: 'Período 1', periodo2: 'Período 2',
    periodo3: 'Período 3', periodo4: 'Período 4', anual: 'Año completo 2026',
  };
  const periodLabel = PERIOD_LABELS[period] ?? period;
  const { title, data } = getReportData(id, periodLabel, stats, instName);
  const meta    = `"Reporte: ${title}"\n"Periodo: ${periodLabel}"\n"Generado: ${new Date().toLocaleString('es-CO')}"\n\n`;
  const headers = data.headers.join(',');
  const rows    = data.rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const content = meta + headers + '\n' + rows;
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const link    = document.createElement('a');
  link.href     = url;
  link.download = `reporte_${id}_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const REPORT_TYPES = [
  { id: 'institucional', title: 'Reporte Institucional',   desc: 'Resumen ejecutivo: profesores, estudiantes, grupos, promedios y alertas.', icon: Building2,     color: 'text-[#6940A5]', bg: 'bg-purple-50',   border: 'border-purple-200'   },
  { id: 'profesores',    title: 'Reporte por Profesor',    desc: 'Rendimiento docente: grupos, participación, uso de IA y estadísticas.',     icon: Users,         color: 'text-[#0B6E99]', bg: 'bg-blue-50',     border: 'border-blue-200'     },
  { id: 'estudiantes',   title: 'Reporte por Estudiante',  desc: 'Perfil académico: promedio, asistencia, uso de NeuroBot y evolución.',      icon: GraduationCap, color: 'text-[#0F7B6C]', bg: 'bg-emerald-50',  border: 'border-emerald-200'  },
  { id: 'grado',         title: 'Reporte por Grado',       desc: 'Comparativo por nivel: promedios, participación y distribución.',           icon: BookOpen,      color: 'text-[#D9730D]', bg: 'bg-orange-50',   border: 'border-orange-200'   },
  { id: 'alertas',       title: 'Reporte de Alertas IA',   desc: 'Historial de NeuroAlertas del período: resueltas y pendientes.',           icon: AlertTriangle, color: 'text-[#E03E3E]', bg: 'bg-red-50',      border: 'border-red-200'      },
  { id: 'neurobots',     title: 'Uso de NeuroBots',        desc: 'Estadísticas de uso de bots: consultas, materias, grupos y tendencias.',   icon: Bot,           color: 'text-[#787774]', bg: 'bg-[#F7F6F3]',  border: 'border-[#E9E9E7]'   },
  { id: 'comparativo',   title: 'Comparativo Mensual',     desc: 'Evolución de métricas clave mes a mes durante el año académico.',          icon: TrendingUp,    color: 'text-[#0F7B6C]', bg: 'bg-emerald-50',  border: 'border-emerald-200'  },
  { id: 'anual',         title: 'Comparativo Anual',       desc: 'Comparativa institucional interanual con tendencias históricas.',          icon: Calendar,      color: 'text-[#6940A5]', bg: 'bg-purple-50',   border: 'border-purple-200'   },
];

export default function ReportesTab() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generated,  setGenerated]  = useState<Set<string>>(new Set());
  const [period,     setPeriod]     = useState('periodo1');
  const [formatType, setFormatType] = useState<'pdf' | 'csv'>('pdf');
  const [dashStats,  setDashStats]  = useState<DashStats | null>(null);
  const [instName,   setInstName]   = useState('');

  useEffect(() => {
    api.get('/super/stats/dashboard').then(r => setDashStats(r.data)).catch(() => {});
    api.get('/super/institution').then(r => setInstName(r.data?.name ?? '')).catch(() => {});
  }, []);

  const handleGenerate = (id: string) => {
    setGenerating(id);
    setTimeout(() => {
      setGenerating(null);
      setGenerated(prev => new Set([...prev, id]));
    }, 1200);
  };

  const handleDownload = (id: string) => {
    if (formatType === 'pdf') {
      generatePDF(id, period, dashStats, instName);
    } else {
      generateCSV(id, period, dashStats, instName);
    }
  };

  return (
    <div className="space-y-6">

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-white border border-[#E9E9E7] rounded-lg p-4">
        <div>
          <h3 className="font-semibold text-[#191919] text-sm">Configuración del reporte</h3>
          <p className="text-xs text-[#787774] mt-0.5">Selecciona el período y el formato antes de generar</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">

          {/* Selector de formato PDF / CSV */}
          <div className="flex gap-1 bg-[#F7F6F3] p-1 rounded-md border border-[#E9E9E7]">
            <button
              onClick={() => { setFormatType('pdf'); setGenerated(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${formatType === 'pdf' ? 'bg-white shadow-sm border border-[#E9E9E7] text-[#191919]' : 'text-[#787774] hover:bg-white/50'}`}
            >
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={() => { setFormatType('csv'); setGenerated(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${formatType === 'csv' ? 'bg-white shadow-sm border border-[#E9E9E7] text-[#191919]' : 'text-[#787774] hover:bg-white/50'}`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
            </button>
          </div>

          {/* Selector de período */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#787774]">Período:</label>
            <select
              value={period}
              onChange={e => { setPeriod(e.target.value); setGenerated(new Set()); }}
              className="px-3 py-1.5 border border-[#E9E9E7] rounded-md text-sm focus:ring-1 focus:ring-[#37352F] outline-none bg-white"
            >
              <option value="periodo1">Período 1 (Ene – Mar)</option>
              <option value="periodo2">Período 2 (Abr – Jun)</option>
              <option value="periodo3">Período 3 (Jul – Sep)</option>
              <option value="periodo4">Período 4 (Oct – Dic)</option>
              <option value="anual">Año completo 2026</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de reportes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {REPORT_TYPES.map(report => {
          const isGenerating = generating === report.id;
          const isDone       = generated.has(report.id);
          const ReportIcon   = report.icon;

          return (
            <div key={report.id} className={`bg-white border rounded-lg p-5 flex flex-col gap-4 transition-all hover:shadow-sm ${report.border}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 ${report.bg} rounded-md flex items-center justify-center flex-shrink-0`}>
                  <ReportIcon className={`w-5 h-5 ${report.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-[#191919] text-sm">{report.title}</h4>
                  <p className="text-xs text-[#787774] mt-0.5 leading-relaxed">{report.desc}</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[#AEADAB] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {isDone
                    ? <span className={`font-medium ${formatType === 'pdf' ? 'text-[#6940A5]' : 'text-[#0F7B6C]'}`}>{formatType.toUpperCase()} listo para descargar</span>
                    : '~2 segundos'
                  }
                </span>
                <div className="flex gap-2">
                  {isDone && (
                    <button
                      onClick={() => handleDownload(report.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all shadow-sm ${formatType === 'pdf' ? 'bg-[#6940A5] text-white hover:bg-[#5A358F]' : 'bg-[#0F7B6C] text-white hover:bg-[#0A6357]'}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar {formatType.toUpperCase()}
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerate(report.id)}
                    disabled={isGenerating}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      isDone
                        ? 'bg-[#F7F6F3] text-[#787774] border border-[#E9E9E7] hover:bg-[#E9E9E7]'
                        : isGenerating
                        ? 'bg-[#F7F6F3] text-[#787774] cursor-wait'
                        : 'bg-[#37352F] text-white hover:bg-[#2F2D2B] shadow-sm'
                    }`}
                  >
                    {isGenerating ? (
                      <><span className="w-3 h-3 rounded-full border-2 border-[#787774] border-t-transparent animate-spin" /> Generando...</>
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

      {/* Footer informativo */}
      <div className="bg-[#F7F6F3] border border-[#E9E9E7] rounded-lg p-4">
        <p className="text-xs text-[#787774] text-center">
          {formatType === 'pdf'
            ? '📄 Los reportes PDF incluyen encabezado institucional, tabla de datos formateada y pie de página numerado.'
            : '📊 Los reportes CSV son compatibles con Excel, Google Sheets y cualquier hoja de cálculo.'}
        </p>
      </div>
    </div>
  );
}
