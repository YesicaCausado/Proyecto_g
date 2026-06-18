"""
NeuroLearn AI - API de Autenticación
Soporta modo con DB (local/producción) y modo demo (Vercel sin DB).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from dataclasses import dataclass, field
from typing import Optional

from app.db.database import get_db, IS_DB_DISABLED
from app.core.config import settings
from app.models.user import User as UserModel
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["Autenticación"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False → si no hay token, devuelve None en vez de lanzar 401
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


# ── Usuario de demostración (sin base de datos) ───────────────────────────────
@dataclass
class DemoUser:
    """Sustituye al modelo ORM cuando IS_DB_DISABLED=True."""
    id: int = 1
    username: str = "demo"
    email: str = "demo@neurolearn.ai"
    full_name: str = "Usuario Demo"
    role: str = "estudiante"
    is_active: bool = True
    is_expert: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    cognitive_profile: Optional[dict] = None


DEMO_USER = DemoUser()
# ─────────────────────────────────────────────────────────────────────────────


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """Obtiene el usuario actual. En modo demo devuelve DEMO_USER sin consultar DB."""
    if IS_DB_DISABLED:
        return DEMO_USER

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(UserModel).filter(UserModel.username == username).first()
    if user is None:
        raise credentials_exception
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Registrar un nuevo usuario (deshabilitado en modo demo)."""
    if IS_DB_DISABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="El registro está deshabilitado en modo demo.",
        )
    try:
        if db.query(UserModel).filter(UserModel.username == user_data.username).first():
            raise HTTPException(status_code=400, detail="El nombre de usuario ya existe")
        if db.query(UserModel).filter(UserModel.email == user_data.email).first():
            raise HTTPException(status_code=400, detail="El email ya está registrado")

        db_user = UserModel(
            username=user_data.username,
            email=user_data.email,
            hashed_password=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            role=user_data.role,
        )
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error de base de datos: {str(e)}. Verifica DATABASE_URL en Vercel.",
        )


@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Iniciar sesión. En modo demo acepta cualquier contraseña."""
    if IS_DB_DISABLED:
        access_token = create_access_token(data={"sub": DEMO_USER.username})
        return Token(access_token=access_token)

    try:
        user = db.query(UserModel).filter(UserModel.username == user_data.username).first()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error de base de datos: {str(e)}. Verifica DATABASE_URL en Vercel.",
        )

    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada. Contacta al administrador.",
        )

    try:
        user.last_login = datetime.utcnow()
        db.commit()
    except Exception:
        pass  # No es crítico si falla el update de last_login

    access_token = create_access_token(data={
        "sub": user.username,
        "user_id": user.id,
        "role": user.role,
    })
    return Token(
        access_token=access_token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Obtener perfil del usuario actual."""
    return current_user
