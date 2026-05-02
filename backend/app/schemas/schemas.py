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
    role: str = Field(default="estudiante", pattern="^(estudiante|profesor|admin)$")


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    role: str = "estudiante"
    is_active: bool
    is_expert: bool
    created_at: datetime
    cognitive_profile: Optional[Dict] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ===== CHAT / APRENDIZAJE =====

class StartSessionRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    difficulty: str = Field(default="medium")
    bot_id: Optional[int] = None


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    response_time_ms: float = Field(default=0, ge=0)
    typing_speed_cpm: float = Field(default=0, ge=0)
    corrections: int = Field(default=0, ge=0)
    pause_before_ms: float = Field(default=0, ge=0)
    # Datos multimodales opcionales (Patrones 3-4)
    facial_data: Optional[Dict[str, Any]] = None   # Microexpresión facial
    voice_data: Optional[Dict[str, Any]] = None     # Prosodia de voz


class ChatMessageResponse(BaseModel):
    message: str
    action: str
    difficulty: str
    cognitive_state: str
    confidence: float = 0.0
    suggestions: List[str] = []
    should_pause: bool = False
    metadata: Dict[str, Any] = {}
    # Datos multimodales de salida
    emotional_state: Optional[str] = None
    attention_level: float = 1.0
    engagement_score: float = 0.5
    error_risk: float = 0.0
    active_modalities: List[str] = []


class SessionStatsResponse(BaseModel):
    topic: str
    difficulty: str
    interactions: int
    cognitive_state: str
    concepts_taught: int = 0
    concepts_mastered: int = 0
    quiz_results: int = 0
    consecutive_errors: int = 0
    consecutive_correct: int = 0
    duration_minutes: float = 0.0
    cognitive_profile: Dict = {}

    class Config:
        extra = "ignore"


# ===== COGNITIVE EVENTS =====

class CognitiveEventCreate(BaseModel):
    event_type: str
    response_time_ms: Optional[float] = None
    typing_speed_cpm: Optional[float] = None
    error_occurred: bool = False
    correction_made: bool = False
    pause_duration_ms: Optional[float] = None
    content_length: int = 0
    metadata: Dict = {}


class CognitiveStateResponse(BaseModel):
    state: str
    confidence: float
    factors: Dict[str, float] = {}
    recommendations: List[str] = []
    should_adapt: bool = False
    suggested_difficulty: Optional[str] = None
    active_modalities: List[str] = []
    emotional_state: Optional[str] = None
    attention_level: float = 1.0
    engagement_score: float = 0.5
    error_risk: float = 0.0
    predicted_next_error: Optional[str] = None


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
