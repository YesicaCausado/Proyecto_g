"""
Schemas Pydantic - Auth Service
"""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any
from datetime import datetime


class UserBase(BaseModel):
    """Base de usuario"""
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "estudiante"


class UserCreate(UserBase):
    """Crear usuario"""
    password: str = Field(..., min_length=8)


class UserLogin(BaseModel):
    """Login de usuario"""
    username: str
    password: str


class UserUpdate(BaseModel):
    """Actualizar usuario"""
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserResponse(UserBase):
    """Respuesta de usuario"""
    id: int
    is_active: bool
    is_expert: bool
    cognitive_profile: Dict[str, Any] = {}
    permissions: Dict[str, bool] = {}
    created_at: datetime
    updated_at: datetime
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    """Token JWT"""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Datos del token"""
    username: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None


class PermissionResponse(BaseModel):
    """Respuesta de permiso"""
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserPermissionUpdate(BaseModel):
    """Actualizar permisos de usuario"""
    permissions: Dict[str, bool]
