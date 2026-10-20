// Tipos de /super/reports/* (backend/app/services/super_report_service.py).
// Los valores ausentes llegan como null: nunca se convierten en 0.

export type CompKey = 'matematicas' | 'lectora' | 'ingles' | 'ciudadanas' | 'cientifico';
export type Source = 'todas' | 'quiz' | 'evaluacion';

export interface Filters {
  start_date: string;
  end_date: string;
  classroom_id: string;
  teacher_id: string;
  student_id: string;
  competency: string;
  source: Source;
  eval_status: string;
  threshold: number;
  min_results: number;
}

export interface Meta {
  institution: { id: number; name: string; dane_code: string | null };
  generated_at: string;
  period: { start: string | null; end: string | null; label: string };
  previous_period: { start: string; end: string } | null;
  filters: {
    classroom: string | null; teacher: string | null; student: string | null;
    competency: string | null; source: Source; threshold: number; min_results: number;
  };
  scale: string;
  bands: { key: string; label: string; min: number; max: number }[];
  reference_threshold: number;
  min_students_comparison: number;
  methodology: string[];
}

export interface CompRow {
  key: CompKey; name: string;
  average: number | null; students: number; results: number;
  previous_average: number | null; change: number | null; sufficient: boolean;
}

export interface CompRef { key: CompKey; name: string; average: number | null }

export interface GroupRow {
  id: number; name: string; grade: string; subject: string; competency: CompKey | null;
  teacher: { id: number; name: string } | null;
  enrolled: number; evaluated: number; participation: number | null;
  average: number | null; results: number;
  best_competency: CompRef | null; worst_competency: CompRef | null;
  change: number | null; small_sample: boolean;
}

export interface TeacherRow {
  id: number; name: string; subject_area: string;
  groups: number; group_names: string[]; students: number; evaluated: number;
  participation: number | null; evaluations_published: number; evaluations_completed: number;
  average: number | null; results: number; worst_competency: CompRef | null;
  last_activity: string | null; small_sample: boolean;
}

export interface EvoPoint { bucket: string; average: number | null; students: number; results: number; change: number | null }
export interface Evolution {
  granularity: 'day' | 'week' | 'month' | null;
  buckets: { key: string; label: string }[];
  series: { key: CompKey | 'general'; name: string; points: EvoPoint[] }[];
  table: { period: string; bucket: string; competency: string; competency_name: string;
           average: number | null; students: number; results: number; change: number | null }[];
}

export interface Quality {
  registered_students: number; students_with_results: number; students_without_results: number;
  students_without_group: number; competencies_with_data: string[]; competencies_without_data: string[];
  graded_results: number; quiz_results: number; pending_review: number; open_submissions: number;
  pending_quizzes: number; unclassified_results: number; latest_record: string | null; warnings: string[];
}

export interface Rule { key: string; label: string; category: string; definition: string; observation: string; min_data: string }

export interface Cards {
  evaluated_students: { evaluated: number; registered: number; participation: number | null; previous_participation: number | null };
  average: { value: number | null; results: number; previous: number | null; change: number | null };
  strongest_competency: (CompRef & { students: number; results: number }) | null;
  weakest_competency: (CompRef & { students: number; results: number; gap_to_reference: number }) | null;
  followup: { students: number; activity_students: number; threshold: number; min_results: number };
  activity: {
    completed: number; completed_quizzes: number; completed_submissions: number;
    open_submissions: number; pending_quizzes: number; previous_completed: number | null; change_pct: number | null;
  };
}

export interface Overview {
  meta: Meta; cards: Cards; competencies: CompRow[];
  interpretation: { type: string; competency: CompKey; text: string }[];
  groups: GroupRow[]; teachers: TeacherRow[]; evolution: Evolution; quality: Quality;
  followup_rules: Rule[];
}

export interface FilterOptions {
  institution: { id: number; name: string };
  groups: { id: number; name: string; grade: string; teacher_id: number; teacher_name: string }[];
  teachers: { id: number; name: string }[];
  competencies: { key: CompKey; name: string }[];
  sources: { key: Source; name: string }[];
  eval_statuses: { key: string; name: string }[];
}

export interface Band { key: string; label: string; min: number; max: number; students: number; pct: number | null }

export interface Page<T> { items: T[]; total: number; page: number; size: number; pages: number }

export interface StudentListRow {
  id: number; name: string; username: string; grade: string; groups: string[];
  results: number; average: number | null; last_result: string | null;
}

export interface Evidence { date: string | null; title: string; source: string; source_label: string; pct: number | null }

export interface FollowupCase {
  id: string; student: { id: number; name: string; username: string }; groups: string[];
  competency: CompKey | null; competency_name: string; rule: string; rule_label: string; category: string;
  reason: string; evidence: Evidence[]; considered: Evidence[]; detected_at: string | null;
  evolution: { first: number; last: number; change: number; results: number } | null;
  missing: string[]; recommendations: string[];
}

export interface HistoryRow {
  date: string; competency: CompKey | null; competency_name: string; title: string;
  source: 'quiz' | 'evaluacion'; source_label: string; pct: number; score: number | null;
  max_score: number | null; seconds: number | null; attempts: number; status: string;
  change_vs_previous: number | null;
}

export interface StudentDetail {
  meta: Meta;
  student: { id: number; name: string; username: string; grade: string; groups: string[] };
  summary: { results: number; average: number | null; last_result: string | null; competencies_evaluated: string[] };
  competencies: { key: CompKey; name: string; results: number; average: number | null; first: number | null;
                  last: number | null; change: number | null; status: string }[];
  history: HistoryRow[];
  points: { date: string; pct: number; competency: CompKey | null; title: string; source: string }[];
  followup: FollowupCase[];
}

export interface GroupDetail {
  meta: Meta; group: GroupRow;
  summary: { enrolled: number; evaluated: number; average: number | null; completed_evaluations: number;
             quiz_results: number; change: number | null };
  competencies: CompRow[]; distribution: Band[]; evolution: Evolution;
  students: { id: number; name: string; username: string; average: number | null; results: number;
              competencies: string[]; last_result: string | null; change: number | null;
              followup: boolean; followup_rules: string[] }[];
}

export interface EvaluationRow {
  id: number; title: string; type: string; competency: CompKey | null; competency_name: string;
  group: { id: number; name: string }; teacher: { id: number; name: string };
  created_at: string | null; published_at: string | null; closed_at: string | null; deadline: string | null;
  status: string; status_label: string; assigned: number; started: number; completed: number;
  abandoned: number; pending_review: number; completion_rate: number | null; average: number | null;
  graded: number; distribution: Record<string, number>;
}

export interface TeacherDetail {
  meta: Meta; teacher: TeacherRow; groups: GroupRow[]; competencies: CompRow[];
  evolution: Evolution; evaluations: EvaluationRow[]; comparison_note: string | null;
}

export interface CompetencyDetail {
  meta: Meta; competency: CompRow; distribution: Band[]; evolution: Evolution; groups: GroupRow[];
  students: { id: number; name: string; username: string; groups: string[]; average: number;
              results: number; last_result: string; band: string }[];
}

export interface EvaluationsReport extends Page<EvaluationRow> {
  meta: Meta;
  indicators: {
    evaluations: number; assigned: number; started: number; completed: number;
    completion_rate: number | null; abandonment_rate: number | null; average: number | null;
    distribution: { key: string; label: string; count: number }[];
    by_group: { id: number; name: string; assigned: number; completed: number; evaluations: number; completion_rate: number | null }[];
    completed_over_time: { bucket: string; results: number }[];
    definitions: Record<string, string>;
  };
}

export interface EvaluationDetail {
  meta: Meta; evaluation: EvaluationRow | null;
  students: { id: number; name: string; status: string; attempts: number; pct: number | null; submitted_at: string | null }[];
}

export interface FollowupReport extends Page<FollowupCase> {
  meta: Meta; rules: Rule[]; totals: Record<string, number>; neurodigital_note: string;
}
