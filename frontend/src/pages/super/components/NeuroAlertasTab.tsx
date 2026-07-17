import { useState, useEffect } from 'react';
import {
  BrainCircuit, AlertTriangle, TrendingDown, UserX, Users, BookOpen,
  Clock, Filter, RefreshCw, ChevronRight, CheckCircle, Info, Zap, Loader2
} from 'lucide-react';
import api from '../../../services/api';

type Priority = 'alta' | 'media' | 'baja';

interface Alert {
  id: number;
  priority: Priority;
  category: string;
  title: string;
  description: string;
  prediction?: string;
  affectedCount: number;
  affectedLabel: string;
  time: string;
  resolved: boolean;
}

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; border: string; dot: string; icon: any }> = {
  alta:  { label: 'Alta',   color: 'text-[#E03E3E]', bg: 'bg-[#FDEEEE]',  border: 'border-[#F4BDBD]', dot: 'bg-[#E03E3E]', icon: AlertTriangle },
  media: { label: 'Media',  color: 'text-[#D9730D]', bg: 'bg-[#FCF6E5]',  border: 'border-[#EDD88A]', dot: 'bg-[#D9730D]', icon: TrendingDown },
  baja:  { label: 'Baja',   color: 'text-[#0F7B6C]', bg: 'bg-[#EEF8F6]',  border: 'border-[#A6DDD6]', dot: 'bg-[#0F7B6C]', icon: Info },
};

const PREDICTIVE_INSIGHTS = [
  { icon: Zap, color: 'text-[#6940A5]', bg: 'bg-purple-50', text: 'El grado 8° presenta un descenso del 12% en Matemáticas durante las últimas cuatro semanas.' },
  { icon: UserX, color: 'text-[#E03E3E]', bg: 'bg-red-50', text: 'Existe un 83% de probabilidad de que 18 estudiantes requieran acompañamiento académico este período.' },
  { icon: Users, color: 'text-[#D9730D]', bg: 'bg-orange-50', text: 'El profesor Carlos Martínez tiene un nivel de participación 35% inferior al promedio institucional.' },
  { icon: BookOpen, color: 'text-[#0B6E99]', bg: 'bg-blue-50', text: '3 grupos muestran una tendencia de mejora sostenida del 8% en los últimos 30 días.' },
];

export default function NeuroAlertasTab() {
  const [filterPriority, setFilterPriority] = useState<Priority | 'todas'>('todas');
  const [resolved, setResolved] = useState<Set<number>>(new Set());
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/super/stats/alerts')
      .then(r => setAlerts(r.data.alerts ?? []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = alerts.filter(a =>
    (filterPriority === 'todas' || a.priority === filterPriority) && !resolved.has(a.id)
  );

  const counts = {
    alta:  alerts.filter(a => a.priority === 'alta'  && !resolved.has(a.id)).length,
    media: alerts.filter(a => a.priority === 'media' && !resolved.has(a.id)).length,
    baja:  alerts.filter(a => a.priority === 'baja'  && !resolved.has(a.id)).length,
  };

  return (
    <div className="space-y-8">

      {loading && (
        <div className="flex items-center justify-center py-6 gap-2 text-sm text-[#787774]">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando alertas…
        </div>
      )}

      {/* ── Analítica Predictiva ── */}
      <div className="bg-gradient-to-r from-[#6940A5]/5 to-[#0B6E99]/5 border border-[#E9E9E7] rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <BrainCircuit className="w-5 h-5 text-[#6940A5]" />
          <h3 className="font-semibold text-[#191919] text-sm">Analítica Predictiva — IA Institucional</h3>
          <span className="ml-auto text-[10px] bg-[#6940A5] text-white px-2 py-0.5 rounded-full font-medium">Premium</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PREDICTIVE_INSIGHTS.map((insight, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-md ${insight.bg} border border-white/60`}>
              <insight.icon className={`w-4 h-4 ${insight.color} mt-0.5 flex-shrink-0`} />
              <p className="text-xs text-[#37352F] leading-relaxed">"{insight.text}"</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Resumen de Alertas ── */}
      <div className="grid grid-cols-3 gap-4">
        {(['alta', 'media', 'baja'] as Priority[]).map(p => {
          const cfg = PRIORITY_CONFIG[p];
          return (
            <button
              key={p}
              onClick={() => setFilterPriority(filterPriority === p ? 'todas' : p)}
              className={`p-4 rounded-lg border text-left transition-all ${
                filterPriority === p ? `${cfg.bg} ${cfg.border} ring-1 ring-offset-1 ring-current` : 'bg-white border-[#E9E9E7] hover:bg-[#F7F6F3]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>Prioridad {cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-[#191919]">{counts[p]}</p>
              <p className="text-xs text-[#787774]">alertas activas</p>
            </button>
          );
        })}
      </div>

      {/* ── Lista de Alertas ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-[#191919] flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#787774]" />
            {filterPriority === 'todas' ? 'Todas las alertas' : `Alertas de prioridad ${PRIORITY_CONFIG[filterPriority].label}`}
            <span className="text-sm text-[#787774] font-normal">({filtered.length})</span>
          </h3>
          <button
            onClick={() => setFilterPriority('todas')}
            className="flex items-center gap-1 text-xs text-[#787774] hover:text-[#37352F] transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Ver todas
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-[#787774]">
            <CheckCircle className="w-10 h-10 mx-auto mb-3 text-[#0F7B6C] opacity-60" />
            <p className="font-medium">Sin alertas activas en esta categoría</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(alert => {
              const cfg = PRIORITY_CONFIG[alert.priority];
              const PriorityIcon = cfg.icon;
              return (
                <div
                  key={alert.id}
                  className={`bg-white border rounded-lg p-5 ${cfg.border} transition-all hover:shadow-sm`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-md ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <PriorityIcon className={`w-4 h-4 ${cfg.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} mb-1.5`}>
                            {cfg.label} · {alert.category}
                          </span>
                          <h4 className="text-sm font-semibold text-[#191919]">{alert.title}</h4>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-xs text-[#787774] flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {alert.time}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-[#787774] mb-2 leading-relaxed">{alert.description}</p>

                      {alert.prediction && (
                        <div className="flex items-start gap-2 bg-[#F7F6F3] rounded-md p-2.5 mb-3">
                          <BrainCircuit className="w-3.5 h-3.5 text-[#6940A5] mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-[#6940A5] leading-relaxed font-medium">{alert.prediction}</p>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[#787774]">
                          Afecta a <span className="font-semibold text-[#37352F]">{alert.affectedCount} {alert.affectedLabel}</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <button className="text-xs text-[#787774] hover:text-[#37352F] flex items-center gap-1 transition-colors">
                            Ver detalles <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setResolved(prev => new Set([...prev, alert.id]))}
                            className="text-xs text-[#0F7B6C] hover:text-[#0A6357] flex items-center gap-1 transition-colors font-medium"
                          >
                            <CheckCircle className="w-3 h-3" /> Marcar resuelta
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
