"""
Servicios de Autenticación - Auth Service
"""
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User, RefreshToken, UserRole
from app.schemas.schemas import UserCreate, TokenData
from typing import Optional


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class AuthService:
    """Servicio de autenticación"""

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        """Verificar contraseña contra hash bcrypt"""
        return pwd_context.verify(plain_password, hashed_password)

    @staticmethod
    def get_password_hash(password: str) -> str:
        """Generar hash bcrypt de una contraseña"""
        return pwd_context.hash(password)

    @staticmethod
    def create_access_token(
        data: dict,
        expires_delta: Optional[timedelta] = None
    ) -> str:
        """Crear token de acceso JWT"""
        to_encode = data.copy()
        expire = datetime.utcnow() + (
            expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    @staticmethod
    def create_refresh_token(
        data: dict,
        expires_delta: Optional[timedelta] = None,
        db: Optional[Session] = None,
    ) -> str:
        """Crear token de refresco y persistirlo en BD"""
        to_encode = data.copy()
        expire = datetime.utcnow() + (
            expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )
        to_encode.update({"exp": expire, "type": "refresh"})
        token = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        if db and "user_id" in data:
            refresh_token = RefreshToken(
                user_id=data["user_id"],
                token=token,
                expires_at=expire
            )
            db.add(refresh_token)
            db.commit()

        return token

    @staticmethod
    def verify_token(token: str) -> Optional[TokenData]:
        """Verificar y decodificar token JWT"""
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
            )
            username: str = payload.get("sub")
            user_id: int = payload.get("user_id")
            role: str = payload.get("role")

            if username is None:
                return None

            return TokenData(username=username, user_id=user_id, role=role)
        except JWTError:
            return None

    @staticmethod
    def register_user(user_data: UserCreate, db: Session) -> User:
        """Registrar nuevo usuario"""
        if db.query(User).filter(User.username == user_data.username).first():
            raise ValueError("El usuario ya existe")

        if db.query(User).filter(User.email == user_data.email).first():
            raise ValueError("El email ya está registrado")

        db_user = User(
            username=user_data.username,
            email=user_data.email,
            hashed_password=AuthService.get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role=user_data.role or UserRole.ESTUDIANTE.value,
            permissions={
                "can_create_bots":        user_data.role in ("profesor", "admin"),
                "can_train_bots":         user_data.role in ("profesor", "admin"),
                "can_share_bots":         user_data.role in ("profesor", "admin"),
                "can_manage_classroom":   user_data.role in ("profesor", "admin"),
                "can_manage_institution": user_data.role in ("super_profesor", "admin"),
            }
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user

    @staticmethod
    def authenticate_user(
        username: str, password: str, db: Session
    ) -> Optional[User]:
        """Autenticar usuario"""
        user = db.query(User).filter(User.username == username).first()

        if not user:
            return None

        if not AuthService.verify_password(password, user.hashed_password):
            return None

        if not user.is_active:
            return None

        user.last_login = datetime.utcnow()
        db.commit()

        return user

    @staticmethod
    def revoke_refresh_token(token: str, db: Session) -> bool:
        """Revocar token de refresco"""
        refresh_token = db.query(RefreshToken).filter(
            RefreshToken.token == token
        ).first()

        if refresh_token:
            refresh_token.revoked = True
            db.commit()
            return True

        return False