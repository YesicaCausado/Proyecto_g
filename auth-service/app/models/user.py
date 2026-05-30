"""
Modelo de Usuario - Auth Service
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, Enum
from datetime import datetime
from app.db.database import Base
import enum


class UserRole(str, enum.Enum):
    """Roles de usuario"""
    ESTUDIANTE = "estudiante"
    PROFESOR = "profesor"
    ADMIN = "admin"


class User(Base):
    """Modelo de usuario en PostgreSQL"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    role = Column(String(20), default=UserRole.ESTUDIANTE.value, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    is_expert = Column(Boolean, default=False)
    
    # Perfil cognitivo dinámico
    cognitive_profile = Column(JSON, default={
        "learning_speed": 0.5,
        "error_tolerance": 0.5,
        "preferred_difficulty": "medium",
        "fatigue_pattern": [],
        "strong_areas": [],
        "weak_areas": [],
        "total_sessions": 0,
        "avg_session_duration": 0,
    })
    
    # Control de acceso
    permissions = Column(JSON, default={
        "can_create_bots": False,
        "can_train_bots": False,
        "can_share_bots": False,
        "can_manage_classroom": False,
    })
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.username}>"


class Permission(Base):
    """Permisos del sistema"""
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Permission {self.name}>"


class RefreshToken(Base):
    """Tokens de refresco para sesiones prolongadas"""
    __tablename__ = "refresh_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    token = Column(String(500), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)

    def __repr__(self):
        return f"<RefreshToken user_id={self.user_id}>"
