import { Activity, Award, BarChart3, LifeBuoy, Target, Users } from 'lucide-react';
import { Delta, StatCard } from './ui';
import { fmtNum, fmtPct } from './lib';
import type { Overview } from './types';

export default function ResumenCards({ data, onGo }: { data: Overview; onGo: (tab: string) => void }) {
  const c = data.cards;
  const ev = c.evaluated_students;
  const avg = c.average;
  const act = c.activity;
  const minN = data.meta.min_students_comparison;
  const participationChange = ev.participation !== null && ev.previous_participation !== null
    ? Math.round((ev.participation - ev.previous_participation) * 10) / 10 : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      <StatCard
        icon={Users} title="Estudiantes evaluados"
        value={<>{ev.evaluated}<span className="text-sm font-semibold text-[#787774]"> / {ev.registered}</span></>}
        context={ev.registered
          ? <>Participación <b className="text-[#37352F]">{fmtPct(ev.participation)}</b>: estudiantes únicos con al menos un resultado entre los registrados del alcance.</>
          : 'No hay estudiantes registrados en el alcance seleccionado.'}
        footer={<Delta value={participationChange} label="Sin período comparable" />}
        onClick={() => onGo('calidad')}
      />
      <StatCard
        icon={BarChart3} title="Rendimiento académico promedio"
        value={avg.value === null ? 'Sin resultados' : fmtNum(avg.value)} unit="%" muted={avg.value === null}
        context={avg.value === null
          ? 'No hay resultados calificados en el período.'
          : <>% de aciertos · {avg.results} resultado(s) · cada estudiante pesa lo mismo.
              {avg.previous !== null && <> Período anterior: {fmtPct(avg.previous)}.</>}</>}
        footer={<Delta value={avg.change} />}
        onClick={() => onGo('evolucion')}
      />
      <StatCard
        icon={Award} title="Competencia más fortalecida"
        value={c.strongest_competency ? c.strongest_competency.name : 'Datos insuficientes'}
        muted={!c.strongest_competency}
        context={c.strongest_competency
          ? <>Promedio <b className="text-[#37352F]">{fmtPct(c.strongest_competency.average)}</b> · {c.strongest_competency.students} estudiantes · {c.strongest_competency.results} resultados</>
          : `Se necesitan al menos ${minN} estudiantes evaluados en dos o más competencias para compararlas.`}
        onClick={() => onGo('competencias')}
      />
      <StatCard
        icon={Target} title="Competencia que requiere más atención"
        value={c.weakest_competency ? c.weakest_competency.name : 'Datos insuficientes'}
        muted={!c.weakest_competency}
        context={c.weakest_competency
          ? <>Promedio <b className="text-[#37352F]">{fmtPct(c.weakest_competency.average)}</b> ·{' '}
              {c.weakest_competency.gap_to_reference >= 0 ? '+' : '−'}{fmtNum(Math.abs(c.weakest_competency.gap_to_reference))} pp frente
              al umbral de referencia ({data.meta.reference_threshold} %). Resultado académico para revisión pedagógica, no un diagnóstico.</>
          : `Se necesitan al menos ${minN} estudiantes evaluados en dos o más competencias para compararlas.`}
        onClick={() => onGo('competencias')}
      />
      <StatCard
        icon={LifeBuoy} title="Estudiantes que requieren seguimiento"
        value={c.followup.students}
        context={<>Cumplen una regla de rendimiento: promedio de sus últimos {c.followup.min_results} resultados de una
          competencia bajo {c.followup.threshold} % o descenso persistente.
          {c.followup.activity_students > 0 && <> Además, {c.followup.activity_students} solo por actividad (evaluaciones vencidas o inactividad).</>}</>}
        onClick={() => onGo('seguimiento')}
      />
      <StatCard
        icon={Activity} title="Actividad académica"
        value={act.completed}
        context={<>Completadas: {act.completed_quizzes} quizzes adaptativos y {act.completed_submissions} entregas de evaluaciones.
          {' '}Iniciadas sin terminar: {act.open_submissions} intento(s) en curso
          {act.pending_quizzes > 0 && <> · {act.pending_quizzes} quiz(zes) generados sin completar</>}.</>}
        footer={<Delta value={act.change_pct} unit="%" label={act.previous_completed === 0 ? 'Sin actividad en el período anterior' : undefined} />}
        onClick={() => onGo('evaluaciones')}
      />
    </div>
  );
}
