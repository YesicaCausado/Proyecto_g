import { useState } from 'react';
import jsPDF from 'jspdf';
import { FileText, Download, CheckCircle, Clock, Building2, Users, GraduationCap, BookOpen, Bot, AlertTriangle, TrendingUp, Calendar, FileSpreadsheet } from 'lucide-react';

// ── Datos tabulares por tipo de reporte ─────────────────────────────────────
type ReportData = { headers: string[]; rows: string[][] };

function getReportData(id: string, periodLabel: string): { title: string; subtitle: string; data: ReportData } {
  const base: Record<string, { title: string; subtitle: string; data: ReportData }> = {
    institucional: {
      title: 'Reporte Institucional', subtitle: `Resumen ejecutivo — ${periodLabel}`,
      data: { headers: ['Indicador','Valor','Variación'], rows: [
        ['Total profesores','18','+2 este mes'], ['Total estudiantes','745','+15 este mes'],
        ['Grupos activos','24','Sin cambios'], ['NeuroBots activos','8','+3 este mes'],
        ['Promedio institucional','7.8 / 10','-0.2 este mes'], ['Índice de participación','82%','+3%'],
        ['Estudiantes en riesgo','12','+4 este mes'],
      ]},
    },
    profesores: {
      title: 'Reporte por Profesor', subtitle: `Rendimiento docente — ${periodLabel}`,
      data: { headers: ['Nombre','Materia','Grupos','Promedio','Participación','Uso IA'], rows: [
        ['Sofía Castro','Tecnología','2','8.7','94%','87%'], ['Pedro Ramírez','Sociales','2','8.4','88%','72%'],
        ['Laura González','Ciencias','2','8.1','85%','68%'], ['Ana Torres','Lenguaje','2','7.8','79%','55%'],
        ['Carlos Martínez','Matemáticas','2','7.2','61%','43%'], ['María López','Física','2','6.9','74%','51%'],
      ]},
    },
    estudiantes: {
      title: 'Reporte por Estudiante', subtitle: `Rendimiento estudiantil — ${periodLabel}`,
      data: { headers: ['Nombre','Grado','Promedio','Asistencia','Última conexión'], rows: [
        ['Juan Pérez','8°A','4.2','72%','Ayer'], ['María Gómez','9°B','4.8','68%','Hace 2 días'],
        ['Luis Herrera','7°C','5.1','81%','Hoy'], ['Ana Rodríguez','10°A','4.5','65%','Hace 3 días'],
        ['Carlos Silva','8°A','7.8','90%','Hoy'], ['Valentina Torres','9°B','8.2','95%','Hoy'],
      ]},
    },
    grado: {
      title: 'Reporte por Grado', subtitle: `Comparativo por nivel — ${periodLabel}`,
      data: { headers: ['Grado','Promedio','Participación','Grupos','Estudiantes'], rows: [
        ['6°','7.2','82%','3','102'], ['7°','7.8','79%','4','126'], ['8°','6.5','71%','4','128'],
        ['9°','8.1','85%','3','121'], ['10°','8.4','88%','3','123'], ['11°','7.9','83%','2','145'],
      ]},
    },
    alertas: {
      title: 'Reporte de Alertas IA', subtitle: `NeuroAlertas generadas — ${periodLabel}`,
      data: { headers: ['Prioridad','Categoría','Descripción','Afectados','Fecha'], rows: [
        ['ALTA','Riesgo académico','18 estudiantes con descenso >20% en 4 semanas','18 est.','2026-07-01'],
        ['ALTA','Asistencia','Grado 10° con 34% más ausencias','7 est.','2026-07-01'],
        ['MEDIA','Docente','Prof. Martínez con participación 35% menor','42 est.','2026-06-30'],
        ['MEDIA','Uso IA','Matemáticas 9B: 94% de respuestas copiadas','28 est.','2026-06-29'],
        ['BAJA','Participación','Ciencias 7A: 48% tasa de entrega','24 est.','2026-06-27'],
      ]},
    },
    neurobots: {
      title: 'Uso de NeuroBots', subtitle: `Estadísticas de bots — ${periodLabel}`,
      data: { headers: ['NeuroBots','Profesor','Materia','Docs','Consultas','Estado'], rows: [
        ['TecnoBot Pro','Sofía Castro','Tecnología','18','520','Activo'],
        ['FísicaExpert','María López','Física','20','401','Activo'],
        ['MateBot 8A','Carlos Martínez','Matemáticas','12','342','Activo'],
        ['CienciasBot','Laura González','Ciencias','8','218','Activo'],
        ['LenguajeAI','Ana Torres','Lenguaje','15','189','Activo'],
      ]},
    },
    comparativo: {
      title: 'Comparativo Mensual', subtitle: 'Evolución de métricas 2026',
      data: { headers: ['Mes','Promedio','Participación','Tareas','Est. Riesgo'], rows: [
        ['Enero','7.4','78%','82%','15'], ['Febrero','7.6','80%','85%','14'],
        ['Marzo','7.5','77%','83%','13'], ['Abril','7.9','83%','88%','11'],
        ['Mayo','8.0','85%','90%','10'], ['Junio','7.8','84%','89%','12'],
      ]},
    },
    anual: {
      title: 'Comparativo Anual', subtitle: 'Histórico institucional',
      data: { headers: ['Año','Promedio','Estudiantes','Profesores','NeuroBots'], rows: [
        ['2024','7.2','680','15','3'], ['2025','7.6','712','17','5'], ['2026','7.8','745','18','8'],
      ]},
    },
  };
  return base[id] ?? { title: id, subtitle: periodLabel, data: { headers: [], rows: [] } };
}

// ── Generador real de PDF con jsPDF ─────────────────────────────────────────
function generatePDF(id: string, period: string) {
  const PERIOD_LABELS: Record<string, string> = {
    periodo1: 'Período 1 (Ene–Mar)', periodo2: 'Período 2 (Abr–Jun)',
    periodo3: 'Período 3 (Jul–Sep)', periodo4: 'Período 4 (Oct–Dic)', anual: 'Año completo 2026',
  };
  const periodLabel = PERIOD_LABELS[period] ?? period;
  const { title, subtitle, data } = getReportData(id, periodLabel);

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
  doc.text('Institución: Colegio Nacional Demo  |  NIT: 900.123.456-7', 14, 36);

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
function generateCSV(id: string, period: string) {
  const PERIOD_LABELS: Record<string, string> = {
    periodo1: 'Período 1', periodo2: 'Período 2',
    periodo3: 'Período 3', periodo4: 'Período 4', anual: 'Año completo 2026',
  };
  const periodLabel = PERIOD_LABELS[period] ?? period;
  const { title, data } = getReportData(id, periodLabel);
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

  const handleGenerate = (id: string) => {
    setGenerating(id);
    setTimeout(() => {
      setGenerating(null);
      setGenerated(prev => new Set([...prev, id]));
    }, 1200);
  };

  const handleDownload = (id: string) => {
    if (formatType === 'pdf') {
      generatePDF(id, period);
    } else {
      generateCSV(id, period);
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
