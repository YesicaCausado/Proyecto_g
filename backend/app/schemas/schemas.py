"""
NeuroLearn AI - Schemas Pydantic
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime


# ===== USUARIO =====

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None
    role: str = Field(
        default="estudiante",
        pattern="^(estudiante|profesor|super_profesor|admin)$"
    )


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str = "estudiante"
    is_active: bool
    is_expert: bool
    created_at: datetime
    cognitive_profile: Optional[Dict] = None
    must_change_password: Optional[bool] = False
    institution_id: Optional[int] = None
    document_number: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: Optional[int] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    must_change_password: Optional[bool] = False


# ===== CHAT / APRENDIZAJE =====

class StartSessionRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    difficulty: str = Field(default="medium")
    bot_id: Optional[int] = None


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    topic: Optional[str] = None          # ← NUEVO: tema para modo stateless
    history: Optional[List[Dict[str, Any]]] = None  # ← NUEVO: historial para serverless
    cognitive_state: Optional[str] = None  # ← Estado cognitivo actual del estudiante
    response_time_ms: float = Field(default=0, ge=0)
    typing_speed_cpm: float = Field(default=0, ge=0)
    corrections: int = Field(default=0, ge=0)
    pause_before_ms: float = Field(default=0, ge=0)
    # Datos multimodales opcionales (Patrones 3-4)
    facial_data: Optional[Dict[str, Any]] = None
    voice_data: Optional[Dict[str, Any]] = None


class ChatMessageResponse(BaseModel):
    message: str
    action: str
    difficulty: str
    cognitive_state: str
    confidence: float
    suggestions: List[str]
    should_pause: bool
    metadata: Dict[str, Any]

# ===== QUIZ COGNITIVO (Formato Gemini) =====

class QuizQuestionGemini(BaseModel):
    """Pregunta individual en formato Gemini"""
    id: int
    question: str
    options: List[str]  # Lista simple de opciones
    answer: str  # La opción correcta textual
    explanation: str

class QuizResponseGemini(BaseModel):
    """Respuesta completa del quiz en formato Gemini"""
    quiz_title: str
    difficulty: str  # Fácil/Medio/Difícil
    questions: List[QuizQuestionGemini]

class QuizRequest(BaseModel):
    topic: str
    num_questions: Optional[int] = 5
    difficulty: Optional[str] = None  # Opcional: Fácil/Medio/Difícil

class QuizHistoryEntry(BaseModel):
    """Entrada individual del historial de quizzes con adaptación"""
    date: str  # YYYY-MM-DD
    title: str
    questions_count: int
    user_score: Optional[str] = None  # "X/Y" formato
    difficulty: str
    mistakes: Optional[List[str]] = None  # Lista de preguntas falladas
    adaptation: Optional[str] = None  # Descripción de cómo se ajustó el siguiente quiz
    performance_score: Optional[float] = None  # Porcentaje de aciertos
    recommended_difficulty: Optional[str] = None  # Dificultad sugerida

class QuizHistoryResponse(BaseModel):
    """Respuesta con el historial completo de quizzes"""
    history: List[QuizHistoryEntry]
    total_quizzes: int

class QuizSubmission(BaseModel):
    """Envío de respuestas del quiz por parte del usuario"""
    quiz_title: str
    user_answers: Dict[int, str]  # {question_id: selected_answer}

class QuizAnalysisResponse(BaseModel):
    """Respuesta del análisis de quiz con recomendaciones adaptativas"""
    score: str
    correct_answers: int
    wrong_answers: int
    percentage: float
    mistakes: List[Dict[str, Any]]  # Detalles de errores
    weak_concepts: List[str]  # Conceptos a reforzar
    recommended_difficulty: str
    adaptation_message: str

# ===== SCHEMAS LEGACY (mantener compatibilidad) =====

class QuizOption(BaseModel):
    id: str
    text: str

class QuizQuestion(BaseModel):
    id: int
    question: str
    options: List[QuizOption]
    correct_option: str
    explanation: str

class QuizResponse(BaseModel):
    topic: str
    difficulty: str
    cognitive_level: str
    questions: List[QuizQuestion]

class SessionStatsResponse(BaseModel):
    session_id: int
    topic: str
    duration_minutes: float
    total_messages: int
    avg_response_time: float
    mastery_level: float
    concepts_learned: List[str]
    cognitive_evolution: List[Dict[str, Any]]

# ===== BOT EXPERTO =====

class ExpertBotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str
    category: str = Field(..., max_length=50)


class ExpertBotResponse(BaseModel):
    id: int
    name: str
    description: str
    category: str
    creator_id: int
    is_public: bool
    is_active: bool
    total_users: int
    avg_rating: float
    total_sessions: int
    created_at: datetime
    personality: Dict = {}
    knowledge_summary: Dict = {}

    class Config:
        from_attributes = True


class BotPersonalityConfig(BaseModel):
    teaching_style: str = Field(default="balanced")
    verbosity: str = Field(default="medium")
    use_examples: bool = True
    use_analogies: bool = True


class BotStepCreate(BaseModel):
    title: str
    description: str
    details: str = ""
    is_critical: bool = False
    common_errors: List[str] = []
    tips: List[str] = []


class BotWarningCreate(BaseModel):
    message: str
    severity: str = "medium"
    when_to_show: str = ""
    related_steps: List[int] = []


class BotScenarioCreate(BaseModel):
    title: str
    description: str
    initial_situation: str
    expected_actions: List[str]
    correct_outcome: str
    common_mistakes: List[str] = []
    difficulty: str = "medium"


class BotQACreate(BaseModel):
    question: str
    answer: str
    category: str = ""
    difficulty: str = "medium"


class BotListResponse(BaseModel):
    bots: List[ExpertBotResponse]
    total: int


# ===== CLASES (ROL PROFESOR) =====

class ClassroomCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    description: str = ""
    subject: str = Field(..., max_length=100)
    grade: str = Field(default="", max_length=20)
    max_students: int = Field(default=40, ge=1, le=100)
    color: str = Field(default="#2E6FDB", max_length=20)


class ClassroomResponse(BaseModel):
    id: int
    teacher_id: int
    name: str
    description: str
    subject: str
    grade: str
    invite_code: str
    is_active: bool
    max_students: int
    student_count: int = 0
    color: str = "#2E6FDB"
    created_at: datetime

    class Config:
        from_attributes = True


class ClassroomListResponse(BaseModel):
    classrooms: List[ClassroomResponse]
    total: int


class EnrollByCodeRequest(BaseModel):
    invite_code: str = Field(..., min_length=8, max_length=8)


class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    student_name: str = ""
    student_username: str = ""
    classroom_id: int
    enrolled_at: datetime
    overall_progress: float
    total_sessions: int
    total_time_minutes: float
    average_score: float
    risk_level: str
    last_activity: Optional[datetime] = None

    class Config:
        from_attributes = True


class AssignBotRequest(BaseModel):
    bot_id: int
    is_required: bool = False
    order_index: int = 0


class StudentProgressResponse(BaseModel):
    student_id: int
    student_name: str
    username: str
    overall_progress: float
    total_sessions: int
    total_time_minutes: float
    average_score: float
    risk_level: str
    last_activity: Optional[datetime] = None
    cognitive_profile: Optional[Dict] = None


class ClassroomStatsResponse(BaseModel):
    classroom_id: int
    classroom_name: str
    total_students: int
    active_students: int
    avg_progress: float
    avg_score: float
    total_sessions: int
    students_at_risk: int
    top_performers: List[Dict] = []
    struggling_students: List[Dict] = []


# ===== SISTEMA B2B — INSTITUCIONES Y CREDENCIALES =====

class InstitutionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    dane_code: str = Field(..., min_length=3, max_length=20)
    license_type: str = Field(default="basica", pattern="^(basica|premium|pro)$")
    # Datos del Super Profesor
    sp_full_name: str = Field(..., min_length=2, max_length=100)
    sp_document_type: str = Field(..., pattern="^(CC|TI|CE|PA)$")
    sp_document_number: str = Field(..., min_length=4, max_length=30)
    sp_email: str = Field(..., max_length=100)


class CredentialItem(BaseModel):
    full_name: str
    username: str        # = document_number
    temp_password: str
    role: str


class InstitutionResponse(BaseModel):
    id: int
    name: str
    dane_code: str
    license_type: str
    is_active: bool
    created_at: datetime
    credential: CredentialItem

    class Config:
        from_attributes = True


class InstitutionListItem(BaseModel):
    id: int
    name: str
    dane_code: str
    license_type: str
    is_active: bool
    created_at: datetime
    teacher_count: int = 0
    student_count: int = 0

    class Config:
        from_attributes = True


class TeacherCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    document_type: str = Field(..., pattern="^(CC|TI|CE|PA)$")
    document_number: str = Field(..., min_length=4, max_length=30)
    email: str = Field(..., max_length=100)
    subject_area: str = Field(default="", max_length=100)


class StudentCreate(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    document_type: str = Field(..., pattern="^(CC|TI|CE|PA)$")
    document_number: str = Field(..., min_length=4, max_length=30)
    birth_date: Optional[str] = None    # YYYY-MM-DD
    email: Optional[str] = None
    grade: str = Field(default="", max_length=20)


class BulkCreateResponse(BaseModel):
    created: List[CredentialItem]
    errors: List[Dict[str, Any]] = []
    total_processed: int
    total_created: int
    total_errors: int


class LicenseUsage(BaseModel):
    license_type: str
    max_teachers: int
    current_teachers: int
    max_students: int
    current_students: int


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    """Solicitud de recuperación — acepta username o email"""
    username: str = Field(..., min_length=3)


class ResetPasswordRequest(BaseModel):
    """Restablecer contraseña con token recibido por email"""
    token: str = Field(..., min_length=10)
    new_password: str = Field(..., min_length=8)


class CSVValidationRow(BaseModel):
    row: int
    data: Dict[str, Any]
    error: Optional[str] = None
    valid: bool = True
