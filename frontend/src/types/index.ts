// ===== Tipos de la API de NeuroLearn AI =====

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string | null;
  role: 'estudiante' | 'profesor' | 'super_profesor' | 'admin';
  is_active: boolean;
  is_expert: boolean;
  created_at: string;
  cognitive_profile: Record<string, unknown> | null;
  // B2B fields
  must_change_password?: boolean;
  institution_id?: number | null;
  document_number?: string | null;
}

export interface Token {
  access_token: string;
  token_type: string;
  user_id?: number;
  role?: string;
  full_name?: string | null;
  must_change_password?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  role: 'estudiante' | 'profesor' | 'super_profesor';
}
// ===== Chat =====

export interface StartSessionRequest {
  topic: string;
  difficulty?: string;
  bot_id?: number;
}

export interface ChatMessageRequest {
  message: string;
  response_time_ms?: number;
  typing_speed_cpm?: number;
  corrections?: number;
  pause_before_ms?: number;
}

export interface ChatMessageResponse {
  message: string;
  action: string;
  difficulty: string;
  cognitive_state: string;
  confidence: number;
  suggestions: string[];
  should_pause: boolean;
  metadata: Record<string, unknown>;
  emotional_state: string | null;
  attention_level: number;
  engagement_score: number;
  error_risk: number;
  active_modalities: string[];
}

export interface SessionStats {
  topic: string;
  difficulty: string;
  interactions: number;
  cognitive_state: string;
  concepts_taught: number;
  concepts_mastered: number;
  quiz_results: number;
  consecutive_errors: number;
  consecutive_correct: number;
  duration_minutes: number;
  cognitive_profile: Record<string, unknown>;
}

// ===== Bot Experto =====

export interface ExpertBot {
  id: number;
  name: string;
  description: string;
  category: string;
  creator_id: number;
  is_public: boolean;
  is_active: boolean;
  total_users: number;
  avg_rating: number;
  total_sessions: number;
  created_at: string;
  personality: Record<string, unknown>;
  knowledge_summary: Record<string, unknown>;
}

// ===== Classroom =====

export interface Classroom {
  id: number;
  teacher_id: number;
  name: string;
  description: string;
  subject: string;
  grade: string;
  invite_code: string;
  is_active: boolean;
  max_students: number;
  student_count: number;
  created_at: string;
}

export interface ClassroomCreate {
  name: string;
  description?: string;
  subject: string;
  grade?: string;
  max_students?: number;
}

export interface Enrollment {
  id: number;
  student_id: number;
  student_name: string;
  student_username: string;
  classroom_id: number;
  enrolled_at: string;
  overall_progress: number;
  total_sessions: number;
  total_time_minutes: number;
  average_score: number;
  risk_level: string;
  last_activity: string | null;
}

export interface ClassroomStats {
  classroom_id: number;
  classroom_name: string;
  total_students: number;
  active_students: number;
  avg_progress: number;
  avg_score: number;
  total_sessions: number;
  students_at_risk: number;
  top_performers: Record<string, unknown>[];
  struggling_students: Record<string, unknown>[];
}

// ===== UI State =====

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
  cognitive_state?: string;
  action?: string;
  suggestions?: string[];
}
