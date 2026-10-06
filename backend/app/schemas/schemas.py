"""
NeuroLearn AI - Esquemas Pydantic (MODIFICADO)
===============================================

Actualizado para eliminar el sistema de licencias.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


# ===== AUTENTICACIÓN =====

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class User(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role: str
    is_active: bool
    institution_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., regex=r"^[^@]+@[^@]+\.[^@]+$")
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., pattern="^(estudiante|profesor|super_profesor|admin)$")
    institution_id: Optional[int] = None

class UserUpdate(BaseModel):
    email: Optional[str] = Field(None, regex=r"^[^@]+@[^@]+\.[^@]+$")
    full_name: Optional[str] = Field(None, min_length=2, max_length=100)
    role: Optional[str] = Field(None, pattern="^(estudiante|profesor|super_profesor|admin)$")
    institution_id: Optional[int] = None
    is_active: Optional[bool] = None

class UserInDBBase(User):
    hashed_password: str

class UserInDB(UserInDBBase):
    pass

# ===== SISTEMA B2B — INSTITUCIONES Y CREDENCIALES =====

class InstitutionCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    dane_code: str = Field(..., min_length=3, max_length=20)
    # NOTA: license_type ha sido eliminada - el sistema ya no usa licencias
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
    # NOTA: license_type ha sido eliminada - el sistema ya no usa licencias
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


# NOTA: La clase LicenseUsage ha sido eliminada completamente
# ya que el sistema ya no usa licencias ni tracking de uso por licencia


class AdminStats(BaseModel):
    """Estadísticas globales del sistema para el panel del administrador"""
    total_institutions:   int
    active_institutions:  int
    total_super_profesores: int
    total_profesores:     int
    total_estudiantes:    int
    total_admins:         int
    
    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)


class ForgotPasswordRequest(BaseModel):
    """CU-03 paso 1 — acepta usuario (n.º de documento) o correo."""
    username: str = Field(..., min_length=3, max_length=100)


class ValidateResetTokenRequest(BaseModel):
    """CU-03 paso 2 — el token viaja en el cuerpo (no en la URL ni en logs)."""
    token: str = Field(..., min_length=10, max_length=256)


class ResetPasswordRequest(BaseModel):
<<<<<<< HEAD
    username: str = Field(..., min_length=3)
    token: str
    new_password: str = Field(..., min_length=8)
=======
    """CU-03 paso 3 — restablecer contraseña con el token recibido por correo."""
    token: str = Field(..., min_length=10, max_length=256)
    new_password: str = Field(..., min_length=8, max_length=128)
>>>>>>> c2854c22917fa587265fa11eaec38604e06de41d


# ===== MENSAJERÍA =====

class MessageBase(BaseModel):
    content: str
    message_type: str = "text"

class MessageCreate(MessageBase):
    conversation_id: int

class MessageResponse(MessageBase):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    created_at: datetime
    is_read: bool

    class Config:
        from_attributes = True


class ConversationBase(BaseModel):
    pass

class ConversationCreate(ConversationBase):
    participant_ids: List[int]  # IDs de usuarios con quienes iniciar la conversación

class ConversationResponse(ConversationBase):
    id: int
    participant_ids: List[int]
    participant_names: List[str]
    created_at: datetime
    updated_at: datetime
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0

    class Config:
        from_attributes = True


# ===== AULAS Y GRUPOS =====

class ClassroomBase(BaseModel):
    name: str
    subject_area: Optional[str] = None
    grade: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomResponse(ClassroomBase):
    id: int
    teacher_id: int
    teacher_name: str
    student_count: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    subject_area: Optional[str] = None
    grade: Optional[str] = None
    academic_year: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ClassroomUserBase(BaseModel):
    user_id: int
    role: str  # student, teacher, etc.
    joined_at: datetime
    is_active: bool

class ClassroomUserCreate(ClassroomUserBase):
    pass

class ClassroomUserResponse(ClassroomUserBase):
    id: int
    user_id: int
    user_name: str
    role: str
    joined_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


# ===== CALENDARIO =====

class EventBase(BaseModel):
    title: str
    event_type: str = "clase"  # examen|tarea|clase|anuncio|evento|feriado
    event_date: str  # YYYY-MM-DD
    event_time: Optional[str] = None
    description: str = ""

class EventCreate(EventBase):
    classroom_id: Optional[int] = None  # None = evento global/institucional

class EventResponse(EventBase):
    id: int
    classroom_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    is_global: bool
    classroom_name: Optional[str] = None

    class Config:
        from_attributes = True


class EventUpdate(BaseModel):
    title: Optional[str] = None
    event_type: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    description: Optional[str] = None


# ===== EVALUACIONES =====

class EvaluationBase(BaseModel):
    title: str
    description: Optional[str] = None
    points: float = Field(..., ge=0, le=100)
    due_date: str  # YYYY-MM-DD

class EvaluationCreate(EvaluationBase):
    classroom_id: int

class EvaluationResponse(EvaluationBase):
    id: int
    classroom_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvaluationSubmission(BaseModel):
    evaluation_id: int
    score: float = Field(..., ge=0, le=100)
    submitted_at: str  # YYYY-MM-DD HH:MM:SS


class EvaluationGrade(BaseModel):
    evaluation_id: int
    student_id: int
    score: float
    feedback: Optional[str] = None
    graded_at: str  # YYYY-MM-DD HH:MM:SS


# ===== RECURSOS =====

class ResourceBase(BaseModel):
    title: str
    description: Optional[str] = None
    url: str
    resource_type: str = "link"  # link, video, document, etc.

class ResourceCreate(ResourceBase):
    classroom_id: int

class ResourceResponse(ResourceBase):
    id: int
    classroom_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== PERFIL =====

class ProfileBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., regex=r"^[^@]+@[^@]+\.[^@]+$")
    phone: Optional[str] = None
    birth_date: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = Field(None, pattern="^(M|F|O)$")
    address: Optional[str] = None
    avatar_url: Optional[str] = None

class ProfileUpdate(ProfileBase):
    pass

class ProfileResponse(ProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== NOTIFICACIONES =====

class NotificationBase(BaseModel):
    title: str
    message: str
    notification_type: str = "info"  # info, warning, error, success
    is_read: bool = False

class NotificationCreate(NotificationBase):
    user_id: int

class NotificationResponse(NotificationBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ===== DATOS DE ESTUDIANTE =====

class StudentBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., regex=r"^[^@]+@[^@]+\.[^@]+$")
    phone: Optional[str] = None
    birth_date: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = Field(None, pattern="^(M|F|O)$")
    address: Optional[str] = None
    student_id: str = Field(..., min_length=1, max_length=20)
    grade: Optional[str] = None
    academic_year: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class StudentResponse(StudentBase):
    id: int
    institution_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== DATOS DE PROFESOR =====

class TeacherBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., regex=r"^[^@]+@[^@]+\.[^@]+$")
    phone: Optional[str] = None
    birth_date: Optional[str] = None  # YYYY-MM-DD
    gender: Optional[str] = Field(None, pattern="^(M|F|O)$")
    address: Optional[str] = None
    employee_id: str = Field(..., min_length=1, max_length=20)
    subject_area: Optional[str] = None
    hire_date: Optional[str = None  # YYYY-MM-DD

class TeacherCreate(TeacherBase):
    pass

class TeacherResponse(TeacherBase):
    id: int
    institution_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== CONFIGURACIÓN DE LICENCIA (ELIMINADA) =====
# NOTA: Todas las clases relacionadas con licencias han sido eliminadas
# ya que el sistema ya no usa el modelo de licencias.
# Esto incluye:
# - LicenseUsage (eliminada completamente)
# - Cualquier otro esquema relacionado con licencias