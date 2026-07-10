"""
NeuroLearn AI - API de Autenticación
Soporta modo con DB (local/producción) y modo demo (Vercel sin DB).
"""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer
from dataclasses import dataclass, field
from typing import Optional

import secrets
from app.db.database import get_db
from app.core.config import settings
from app.models.user import User as UserModel
from app.schemas.schemas import (
    UserCreate, UserLogin, UserResponse, Token,
    ForgotPasswordRequest, ResetPasswordRequest,
)
from app.services.email_service import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Autenticación"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
# auto_error=False → si no hay token, devuelve None en vez de lanzar 401
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


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
    """Obtiene el usuario actual consultando la DB (Supabase/PostgreSQL)."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception

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
async def register(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Crear cuenta de usuario.
    Solo puede ser usado por admin o super_profesor.
    El flujo B2B usa /admin/institutions y /super/teachers|students.
    Este endpoint queda como respaldo interno protegido.
    """
    # Solo admin y super_profesor pueden crear cuentas
    if current_user.role not in ("admin", "super_profesor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para crear cuentas. "
                   "Usa el panel de administración.",
        )

    # Un super_profesor solo puede crear profesores y estudiantes
    # Un admin puede crear cualquier rol
    roles_permitidos = {
        "admin":          ("estudiante", "profesor", "super_profesor", "admin"),
        "super_profesor": ("estudiante", "profesor"),
    }
    if user_data.role not in roles_permitidos[current_user.role]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tu rol no puede crear usuarios de tipo '{user_data.role}'.",
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
    """Iniciar sesión validando contra la base de datos (Postgres/Supabase)."""
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
        must_change_password=getattr(user, 'must_change_password', False) or False,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Obtener perfil del usuario actual."""
    return current_user
    
@router.post("/forgot-password", status_code=200)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Solicitar recuperación de contraseña.
    Siempre devuelve el mismo mensaje para no revelar
    si el email/usuario existe en el sistema.
    """
    from datetime import timezone
    from sqlalchemy import text

    GENERIC_RESPONSE = {
        "message": "Si los datos son correctos, recibirás un correo con las instrucciones."
    }

    # Buscar usuario por username O email
    user = db.query(UserModel).filter(
        (UserModel.username == payload.username) |
        (UserModel.email == payload.username)
    ).first()

    # Respuesta genérica si no existe — no revela información
    if not user or not user.is_active:
        return GENERIC_RESPONSE

    # Rate limiting básico: máx 5 tokens activos por usuario
    from app.models.password_reset import PasswordResetToken
    active_count = db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.now(timezone.utc),
    ).count()

    if active_count >= 5:
        return GENERIC_RESPONSE

    # Invalidar tokens anteriores del mismo usuario
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})

    # Generar token criptográfico seguro
    token = secrets.token_urlsafe(64)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    ip = request.headers.get("X-Forwarded-For") or getattr(request.client, "host", None)

    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        ip_address=ip,
    )
    db.add(reset_token)
    db.commit()

    # Enviar email
    send_password_reset_email(
        to_email=user.email,
        to_name=user.full_name or user.username,
        reset_token=token,
        ip_address=ip,
    )

    return GENERIC_RESPONSE


@router.get("/reset-password/validate", status_code=200)
async def validate_reset_token(token: str, db: Session = Depends(get_db)):
    """
    Valida que el token de recuperación existe, no está usado y no expiró.
    El frontend lo llama al cargar la página /reset-password?token=xxx
    """
    from datetime import timezone
    from app.models.password_reset import PasswordResetToken

    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token,
    ).first()

    if not reset:
        raise HTTPException(status_code=400, detail="Token inválido o inexistente")

    if reset.used:
        raise HTTPException(status_code=400, detail="Este enlace ya fue utilizado")

    if reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Solicita uno nuevo")

    return {"valid": True, "message": "Token válido"}


@router.post("/reset-password", status_code=200)
async def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    Restablece la contraseña usando el token recibido por email.
    El token se invalida inmediatamente después de usarse.
    """
    import re
    from datetime import timezone
    from app.models.password_reset import PasswordResetToken

    # Validar token
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
    ).first()

    if not reset or reset.used:
        raise HTTPException(status_code=400, detail="Token inválido o ya utilizado")

    if reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Solicita uno nuevo")

    # Validar fortaleza de la contraseña
    pwd = payload.new_password
    if (len(pwd) < 8
            or not re.search(r"[A-Z]", pwd)
            or not re.search(r"[a-z]", pwd)
            or not re.search(r"\d", pwd)
            or not re.search(r"[!@#$%^&*(),.?\":{}|<>]", pwd)):
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe tener mínimo 8 caracteres, "
                   "una mayúscula, una minúscula, un número y un carácter especial",
        )

    # Obtener usuario y actualizar contraseña
    user = db.query(UserModel).filter(UserModel.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.hashed_password = get_password_hash(pwd)
    user.must_change_password = False

    # Invalidar el token usado
    reset.used = True

    db.commit()

    return {"message": "Contraseña restablecida correctamente. Ya puedes iniciar sesión"}