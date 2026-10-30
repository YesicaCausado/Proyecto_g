"""
NeuroLearn AI - Schemas Pydantic
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import List, Dict, Optional, Any, Literal
from datetime import datetime

from app.core import validators as v


# ===== USUARIO =====

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[A-Za-z0-9._@-]+$")
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=8, max_length=v.PASSWORD_MAX)
    full_name: Optional[str] = None
    role: str = Field(
        default="estudiante",
        pattern="^(estudiante|profesor|super_profesor|admin)$"
    )

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return v.email(value)

    @field_validator("full_name")
    @classmethod
    def _full_name(cls, value: Optional[str]) -> Optional[str]:
        return v.person_name(value, label="El nombre completo", required=False)


class UserUpdate(BaseModel):
    """Campos editables por el panel de administración."""

    full_name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = Field(
        default=None,
        pattern="^(estudiante|profesor|super_profesor|admin)$",
    )
    is_active: Optional[bool] = None

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        return v.email(value, required=False)

    @field_validator("full_name")
    @classmethod
    def _full_name(cls, value: Optional[str]) -> Optional[str]:
        return v.person_name(value, label="El nombre completo", required=False)


class UserLogin(BaseModel):
    # Sin reglas de formato: el login solo compara (un error de formato aquí
    # revelaría qué usuarios existen). Solo se acota el tamaño.
    username: str = Field(..., max_length=100)
    password: str = Field(..., max_length=256)


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    full_name: Optional[str]
    role: str = "estudiante"
    is_active: bool
    is_expert: bool
    photo: Optional[str] = None
    created_at: datetime
    cognitive_profile: Optional[Dict] = None
    must_change_password: Optional[bool] = False
    institution_id: Optional[int] = None
    institution_name: Optional[str] = None
    document_number: Optional[str] = None
    privacy_notice_acknowledged_version: Optional[str] = None
    privacy_notice_required_version: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: Optional[int] = None
    role: Optional[str] = None
    full_name: Optional[str] = None
    must_change_password: Optional[bool] = False
    # Datos completos del usuario para evitar un segundo GET /auth/me
    email: Optional[str] = None
    username: Optional[str] = None
    is_active: Optional[bool] = True
    is_expert: Optional[bool] = False
    photo: Optional[str] = None
    institution_id: Optional[int] = None
    institution_name: Optional[str] = None
    document_number: Optional[str] = None
    cognitive_profile: Optional[Dict] = None
    created_at: Optional[datetime] = None
    privacy_notice_acknowledged_version: Optional[str] = None
    privacy_notice_required_version: Optional[str] = None


# ===== CHAT / APRENDIZAJE =====

class StartSessionRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    difficulty: str = Field(default="medium")
    bot_id: Optional[int] = None
    conversation_id: Optional[int] = None


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    topic: Optional[str] = None
    history: Optional[List[Dict[str, Any]]] = None
    cognitive_state: Optional[str] = None
    # Conversación (memoria entre chats tipo ChatGPT)
    conversation_id: Optional[int] = None
    # NeuroBot con el que se conversa: su base de conocimiento se usa como contexto.
    bot_id: Optional[int] = None
    # Identificador idempotente generado por el cliente: un reenvío del mismo
    # mensaje no vuelve a registrar mediciones ni a contar intentos.
    client_message_id: Optional[str] = Field(default=None, max_length=64,
                                             pattern=r"^[A-Za-z0-9_\-]+$")
    # Cómo se produjo el texto: escrito, dictado por voz o pegado.
    input_mode: Optional[Literal["typed", "voice", "pasted", "selection"]] = None
    # Patrón de teclado — ritmo de interacción (límites: valores humanos posibles)
    response_time_ms: Optional[float] = Field(default=None, ge=0, le=86_400_000)
    typing_speed_cpm: Optional[float] = Field(default=None, ge=0, le=5000)
    pause_before_ms: Optional[float] = Field(default=None, ge=0, le=86_400_000)
    keystrokes: Optional[int] = Field(default=None, ge=0, le=1_000_000)
    # Patrón de teclado — secuencia de decisión
    corrections: Optional[int] = Field(default=None, ge=0, le=1_000_000)  # caracteres borrados
    typing_bursts: Optional[int] = Field(default=None, ge=0, le=100_000)  # ráfagas separadas por pausas
    is_question: Optional[bool] = None        # mensaje termina en '?'
    message_length: Optional[int] = Field(default=None, ge=0)    # longitud del mensaje
    # Patrones facial y de voz: agregados del turno. Se validan en el chat con
    # app/schemas/neuro_signals.py; una señal inválida se descarta completa y
    # se informa como error del patrón (no bloquea el mensaje).
    facial_data: Optional[Any] = None
    voice_data: Optional[Any] = None
    # Estado del sensor en el turno (explica por qué no hay datos)
    facial_status: Optional[Literal["active", "off", "denied", "unavailable",
                                    "no_face", "insufficient", "error"]] = None
    voice_status: Optional[Literal["active", "off", "denied", "unavailable",
                                   "no_face", "insufficient", "error"]] = None
    # Patrón de interacción: eventos de la interfaz del turno
    interaction_data: Optional[Any] = None


class BotDocumentResponse(BaseModel):
    """Documento de la base de conocimiento de un NeuroBot."""
    id: int
    bot_id: int
    filename: str
    extension: str
    mime_type: str
    size_bytes: int
    text_chars: int
    chunk_count: int
    status: str = "procesado"
    truncated: bool = False
    created_at: Optional[str] = None


class BotDocumentListResponse(BaseModel):
    bot_id: int
    documents: List[BotDocumentResponse]
    total: int
    total_size_bytes: int


class ConversationCreate(BaseModel):
    subject: str = Field(default="", max_length=200)
    skill: str = Field(default="", max_length=200)
    topic: str = Field(default="", max_length=200)
    bot_id: Optional[int] = None


class ConversationRename(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)

    @field_validator("title")
    @classmethod
    def _title(cls, value: str) -> str:
        return v.clean_text(value, label="El título", max_len=200)


class ConversationMeta(BaseModel):
    """Metadatos de una conversación para listado."""
    id: int
    student_id: int
    title: str
    subject: str
    skill: str
    topic: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    last_interaction: datetime
    bot_id: Optional[int] = None    # NeuroBot de la conversación (None = competencia)
    bot_name: Optional[str] = None
    # Con NeuroBot: False si se desactivó o el estudiante ya no tiene acceso;
    # el historial se puede leer, pero no continuar (bot_unavailable_reason).
    bot_available: Optional[bool] = None
    bot_unavailable_reason: Optional[str] = None


class ConversationListResponse(BaseModel):
    conversations: List[ConversationMeta]
    total: int


class ChatMessageResponse(BaseModel):
    message: str
    action: str
    difficulty: str
    cognitive_state: str
    confidence: float
    suggestions: List[str]
    should_pause: bool
    metadata: Dict[str, Any]


class ChatPatternPayload(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    cognitive_state: Optional[str] = None
    response_time_ms: Optional[float] = Field(default=None, ge=0)
    typing_speed_cpm: Optional[float] = Field(default=None, ge=0)
    pause_before_ms: Optional[float] = Field(default=None, ge=0)
    corrections: Optional[int] = Field(default=None, ge=0)
    typing_bursts: Optional[int] = Field(default=None, ge=0)
    is_question: Optional[bool] = None
    message_length: Optional[int] = Field(default=None, ge=0)
    facial_data: Optional[Dict[str, Any]] = None
    voice_data: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    metadata: Optional[Dict[str, Any]] = None


class ChatPatternHistoryEntry(BaseModel):
    timestamp: datetime
    topic: str
    cognitive_state: Optional[str] = None
    response_time_ms: Optional[float] = None
    typing_speed_cpm: Optional[float] = None
    pause_before_ms: Optional[float] = None
    corrections: Optional[int] = None
    typing_bursts: Optional[int] = None
    is_question: Optional[bool] = None
    message_length: Optional[int] = None
    facial_data: Optional[Dict[str, Any]] = None
    voice_data: Optional[Dict[str, Any]] = None
    confidence: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None


class ChatPatternHistoryResponse(BaseModel):
    topic: Optional[str] = None
    total: int
    items: List[ChatPatternHistoryEntry]

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

class QuizQuestionPublic(BaseModel):
    """Pregunta de quiz sin respuesta ni explicación (mientras se responde)."""
    id: int
    question: str
    options: List[str]

class QuizPublicResponse(BaseModel):
    """Quiz que recibe el estudiante: la corrección llega al enviarlo."""
    quiz_id: int
    quiz_title: str
    difficulty: str
    questions: List[QuizQuestionPublic]

class QuizRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=200)
    num_questions: Optional[int] = Field(default=5, ge=1, le=20)
    difficulty: Optional[str] = Field(default=None, max_length=20)  # Opcional: Fácil/Medio/Difícil
    # Clave de la competencia Saber 11 (frontend/src/data/competencies.ts).
    competency: Optional[str] = Field(default=None, max_length=30)

class QuizHistoryEntry(BaseModel):
    """Entrada individual del historial de quizzes con adaptación"""
    id: Optional[int] = None
    date: str  # YYYY-MM-DD
    title: str
    questions_count: int
    user_score: Optional[str] = None  # "X/Y" formato
    difficulty: str
    mistakes: Optional[List[str]] = None  # Lista de preguntas falladas
    adaptation: Optional[str] = None  # Descripción de cómo se ajustó el siguiente quiz
    performance_score: Optional[float] = None  # Porcentaje de aciertos
    recommended_difficulty: Optional[str] = None  # Dificultad sugerida
    details: Optional[List[Dict[str, Any]]] = None  # Revisión por pregunta

class QuizHistoryResponse(BaseModel):
    """Respuesta con el historial completo de quizzes"""
    history: List[QuizHistoryEntry]
    total_quizzes: int

class QuizSubmission(BaseModel):
    """Envío de respuestas del quiz por parte del usuario"""
    quiz_title: str = Field(..., max_length=200)
    # Id que devuelve generate-quiz; si falta se busca el último pendiente con ese título.
    quiz_id: Optional[int] = None
    user_answers: Dict[int, str] = Field(..., max_length=50)  # {question_id: selected_answer}
    classroom_id: Optional[int] = None 
    # Segundos que tardó el estudiante (medido en el cliente). El servidor lo
    # acota al tiempo real transcurrido desde que se generó el quiz.
    duration: Optional[int] = Field(default=None, ge=0, le=86_400)

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
    # Corrección por pregunta (respuesta correcta, letra y explicación).
    review: List[Dict[str, Any]] = Field(default_factory=list)

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
    """Estadísticas de actividad del usuario en el chat (datos reales).

    FIX: el response_model anterior (session_id/topic/duration_minutes/
    avg_response_time/mastery_level/concepts_learned/cognitive_evolution) NO
    correspondía a lo que el endpoint /chat/stats devuelve realmente, lo que
    causaba un ValidationError de Pydantic (7 campos faltantes) y un 500 en
    cada consulta. Ahora el esquema refleja la respuesta real del endpoint.
    """
    total_messages: int
    correct_answers: int
    wrong_answers: int
    average_response_time: float
    topics_covered: List[str]
    session_duration: float

# ===== BOT EXPERTO =====

class ExpertBotCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    category: str = Field(default="General", max_length=50)
    is_public: bool = True


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
    description: str = Field(default="", max_length=2000)
    subject: str = Field(..., max_length=100)
    grade: str = Field(default="", max_length=20)
    max_students: int = Field(default=40, ge=1, le=200)
    color: str = Field(default="#2E6FDB", max_length=20)
    # Competencia Saber 11 del aula; vacía = la que corresponde a la materia.
    competency: Optional[str] = Field(default=None, max_length=30)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return v.clean_text(value, label="El nombre de la clase", max_len=150)

    @field_validator("subject")
    @classmethod
    def _subject(cls, value: str) -> str:
        return v.clean_text(value, label="La materia", max_len=100)

    @field_validator("description")
    @classmethod
    def _description(cls, value: str) -> str:
        return v.clean_text(value, label="La descripción", max_len=2000, required=False, multiline=True)

    @field_validator("grade")
    @classmethod
    def _grade(cls, value: str) -> str:
        return v.grade(value) or ""

    @field_validator("color")
    @classmethod
    def _color(cls, value: str) -> str:
        return v.hex_color(value, default="#2E6FDB")


class ClassroomResponse(BaseModel):
    id: int
    teacher_id: int
    name: str
    description: str = ""
    subject: str
    competency: Optional[str] = None
    grade: str
    invite_code: str
    is_active: bool
    max_students: int
    student_count: int = 0
    # Promedio 0-10 de los estudiantes con sesiones; None si aún no hay datos.
    avg: Optional[float] = None
    color: str = "#2E6FDB"
    created_at: datetime

    class Config:
        from_attributes = True


class ClassroomListResponse(BaseModel):
    classrooms: List[ClassroomResponse]
    total: int


class EnrollByCodeRequest(BaseModel):
    # Se aceptan espacios externos y minúsculas al pegar el código.
    invite_code: str = Field(..., max_length=40)

    @field_validator("invite_code")
    @classmethod
    def _code(cls, value: str) -> str:
        return v.invite_code(value)


class EnrollmentResponse(BaseModel):
    id: int
    student_id: int
    student_name: str = ""
    student_username: str = ""
    student_email: Optional[str] = None
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
    # Meta de interacciones para el progreso del estudiante (parche 11B)
    goal_interactions: Optional[int] = None


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
    top_performers: List[Dict] = Field(default_factory=list)
    struggling_students: List[Dict] = Field(default_factory=list)


class ClassroomBotResponse(BaseModel):
    bot_id: int
    name: str
    description: str = ""
    category: Optional[str] = None
    is_required: bool = False
    order_index: int = 0


class ClassroomStudentDetailResponse(BaseModel):
    """Detalle de una clase para el estudiante inscrito (vista estilo classroom)"""
    id: int
    name: str
    description: str = ""
    subject: str
    grade: str = ""
    color: str = "#2E6FDB"
    max_students: int = 40
    student_count: int = 0
    created_at: datetime
    teacher_name: str = ""
    invite_code: str = ""
    # Progreso del estudiante en esta clase
    overall_progress: float = 0.0
    total_sessions: int = 0
    total_time_minutes: float = 0.0
    average_score: float = 0.0
    risk_level: str = "none"
    last_activity: Optional[datetime] = None
    # Bots asignados a la clase (tutores)
    bots: List[ClassroomBotResponse] = Field(default_factory=list)


# ===== SISTEMA B2B — INSTITUCIONES Y CREDENCIALES =====

class InstitutionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    dane_code: str = Field(..., max_length=20)
    # Datos del Super Profesor
    sp_full_name: str = Field(..., max_length=100)
    sp_document_type: str = Field(..., max_length=2)
    sp_document_number: str = Field(..., max_length=30)
    sp_email: str = Field(..., max_length=100)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        return v.clean_text(value, label="El nombre de la institución", min_len=2, max_len=200)

    @field_validator("dane_code")
    @classmethod
    def _dane(cls, value: str) -> str:
        return v.dane_code(value)

    @field_validator("sp_full_name")
    @classmethod
    def _sp_name(cls, value: str) -> str:
        return v.person_name(value, label="El nombre del Súper Profesor")

    @field_validator("sp_document_type")
    @classmethod
    def _sp_doc_type(cls, value: str) -> str:
        return v.document_type(value)

    @field_validator("sp_email")
    @classmethod
    def _sp_email(cls, value: str) -> str:
        return v.email(value, label="El correo del Súper Profesor")

    @model_validator(mode="after")
    def _sp_doc_number(self):
        self.sp_document_number = v.document_number(self.sp_document_number, self.sp_document_type)
        return self


class CredentialItem(BaseModel):
    full_name: str
    username: str        # = document_number
    temp_password: str
    role: str


class InstitutionResponse(BaseModel):
    id: int
    name: str
    dane_code: str
    is_active: bool
    created_at: datetime
    credential: CredentialItem

    class Config:
        from_attributes = True


class BulkCreateResponse(BaseModel):
    credentials: List[CredentialItem]
    errors: List[Dict[str, Any]] = []
    total_processed: int
    total_created: int
    total_errors: int
    # Carga de estudiantes con grupo elegido: cuántos quedaron inscritos y dónde.
    enrolled: int = 0
    classroom: Optional[str] = None


class AdminStats(BaseModel):
    """Estadísticas globales del sistema para el panel del administrador"""
    total_institutions:   int
    active_institutions:  int
    total_super_profesores: int
    total_profesores:     int
    total_estudiantes:    int

    
class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., max_length=256)
    new_password: str = Field(..., min_length=8, max_length=v.PASSWORD_MAX)


class ForgotPasswordRequest(BaseModel):
    """CU-03 paso 1 — acepta usuario (n.º de documento) o correo."""
    username: str = Field(..., min_length=3, max_length=100)


class ValidateResetTokenRequest(BaseModel):
    """CU-03 paso 2 — el token viaja en el cuerpo (no en la URL ni en logs)."""
    token: str = Field(..., min_length=10, max_length=256)


class ResetPasswordRequest(BaseModel):
    """CU-03 paso 3 — restablecer contraseña con el token recibido por correo."""
    token: str = Field(..., min_length=10, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=v.PASSWORD_MAX)


class CSVValidationRow(BaseModel):
    row: int
    data: Dict[str, Any]
    error: Optional[str] = None
    valid: bool = True


# ===== SCHEMAS B2B FALTANTES =====

class _PersonFields(BaseModel):
    """Reglas compartidas por el alta y la edición de profesores y
    estudiantes (app/core/validators.py). Los campos opcionales ausentes no se
    validan; los enviados sí."""

    @field_validator("full_name", check_fields=False)
    @classmethod
    def _full_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return v.person_name(value, label="El nombre completo")

    @field_validator("document_type", check_fields=False)
    @classmethod
    def _document_type(cls, value: Optional[str]) -> Optional[str]:
        return None if value is None else v.document_type(value)

    @field_validator("grade", check_fields=False)
    @classmethod
    def _grade(cls, value: Optional[str]) -> Optional[str]:
        return v.grade(value)

    @field_validator("birth_date", check_fields=False)
    @classmethod
    def _birth_date(cls, value: Optional[str]) -> Optional[str]:
        return v.birth_date(value)

    @field_validator("subject_area", check_fields=False)
    @classmethod
    def _subject_area(cls, value: Optional[str]) -> Optional[str]:
        return v.clean_text(value, label="El área de enseñanza", max_len=100, required=False)

    @model_validator(mode="after")
    def _document_number(self):
        number = getattr(self, "document_number", None)
        if number is not None:
            self.document_number = v.document_number(number, self.document_type)
        return self


class TeacherCreate(_PersonFields):
    full_name: str = Field(..., max_length=100)
    document_type: str = Field(..., max_length=2)
    document_number: str = Field(..., max_length=30)
    email: str = Field(..., max_length=100)
    subject_area: Optional[str] = Field(None, max_length=100)

    @field_validator("email")
    @classmethod
    def _email(cls, value: str) -> str:
        return v.email(value)


class TeacherListItem(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    subject_area: Optional[str] = None
    is_active: bool = True
    temp_password: Optional[str] = None

    class Config:
        from_attributes = True


class StudentCreate(_PersonFields):
    full_name: str = Field(..., max_length=100)
    document_type: str = Field(..., max_length=2)
    document_number: str = Field(..., max_length=30)
    email: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=20)
    birth_date: Optional[str] = Field(None, max_length=20)
    guardian_authorization_confirmed: bool
    guardian_name: Optional[str] = Field(None, max_length=150)
    guardian_consent_date: Optional[str] = Field(None, max_length=10)
    guardian_authorization_reference: Optional[str] = Field(None, max_length=100)

    @field_validator("guardian_name")
    @classmethod
    def _guardian_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return v.person_name(value, label="El nombre del acudiente", max_len=150, required=False) or None

    @field_validator("guardian_consent_date")
    @classmethod
    def _guardian_consent_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        return v.birth_date(value)

    @field_validator("guardian_authorization_reference")
    @classmethod
    def _guardian_reference(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return v.clean_text(value, label="La referencia de autorización", max_len=100, required=False) or None

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        # Opcional: sin correo se le asigna una dirección interna no entregable.
        return v.email(value, required=False)


class TeacherUpdate(_PersonFields):
    """Edición parcial de un docente (solo envía los campos que cambian)."""
    full_name: Optional[str] = Field(None, max_length=100)
    document_type: Optional[str] = Field(None, max_length=2)
    email: Optional[str] = Field(None, max_length=100)
    subject_area: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = None

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        # El correo del docente es obligatorio: si se envía, no puede quedar vacío.
        return None if value is None else v.email(value)


class StudentUpdate(_PersonFields):
    """Edición parcial de un estudiante (solo envía los campos que cambian)."""
    full_name: Optional[str] = Field(None, max_length=100)
    document_type: Optional[str] = Field(None, max_length=2)
    # "" = quitar el correo (se vuelve a la dirección interna no entregable).
    email: Optional[str] = Field(None, max_length=100)
    grade: Optional[str] = Field(None, max_length=20)
    birth_date: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None
    # Autorización del acudiente para cámara y micrófono (menores de edad)
    guardian_authorized: Optional[bool] = None
    guardian_name: Optional[str] = Field(None, max_length=150)
    guardian_consent_date: Optional[str] = Field(None, max_length=10)
    guardian_authorization_reference: Optional[str] = Field(None, max_length=100)

    @field_validator("email")
    @classmethod
    def _email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return v.email(value, required=False) or ""

    @field_validator("guardian_name")
    @classmethod
    def _guardian_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return v.person_name(value, label="El nombre del acudiente", max_len=150, required=False) or ""

    @field_validator("guardian_consent_date")
    @classmethod
    def _guardian_consent_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None or value == "":
            return None
        return v.birth_date(value)

    @field_validator("guardian_authorization_reference")
    @classmethod
    def _guardian_reference(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = v.clean_text(value, label="La referencia de autorización", max_len=100, required=False)
        return cleaned or ""


class StudentListItem(BaseModel):
    id: int
    full_name: str
    username: str
    email: str
    document_type: Optional[str] = None
    document_number: Optional[str] = None
    grade: Optional[str] = None
    birth_date: Optional[str] = None
    is_active: bool = True
    guardian_required: bool = False
    guardian_authorized: bool = False
    guardian_name: Optional[str] = None
    guardian_consent_date: Optional[str] = None
    guardian_authorization_reference: Optional[str] = None

    class Config:
        from_attributes = True




class InstitutionListItem(BaseModel):
    id: int
    name: str
    dane_code: str
    is_active: bool
    created_at: datetime
    teacher_count: int
    student_count: int

class Config:
        from_attributes = True