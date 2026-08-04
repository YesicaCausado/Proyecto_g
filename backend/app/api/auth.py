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
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
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

    # FIX #5: sin esto, un usuario desactivado sigue autenticado hasta que
    # su token expira (hasta 24h con ACCESS_TOKEN_EXPIRE_MINUTES=1440).
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cuenta desactivada. Contacta al administrador.",
        )

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
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_expert=getattr(user, 'is_expert', False) or False,
        institution_id=getattr(user, 'institution_id', None),
        document_number=getattr(user, 'document_number', None),
        cognitive_profile=getattr(user, 'cognitive_profile', None),
        created_at=user.created_at,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user=Depends(get_current_user)):
    """Obtener perfil del usuario actual."""
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Actualizar nombre y/o email del usuario autenticado."""
    if "full_name" in data and data["full_name"]:
        current_user.full_name = data["full_name"]
    if "email" in data and data["email"]:
        existing = db.query(UserModel).filter(
            UserModel.email == data["email"],
            UserModel.id != current_user.id,
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está en uso por otra cuenta.")
        current_user.email = data["email"]
    try:
        db.commit()
        db.refresh(current_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")
    return current_user


@router.post("/change-password", status_code=204)
async def change_password(
    data: dict,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """Cambiar contraseña del usuario autenticado."""
    current_pwd = data.get("current_password", "")
    new_pwd     = data.get("new_password", "")

    if not verify_password(current_pwd, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta.")
    if len(new_pwd) < 8:
        raise HTTPException(status_code=400, detail="La nueva contraseña debe tener al menos 8 caracteres.")

    current_user.hashed_password = get_password_hash(new_pwd)
    current_user.must_change_password = False
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar: {str(e)}")


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
    GENERIC_RESPONSE = {
        "message": "Si los datos son correctos, recibirás un correo con las instrucciones."
    }

    user = db.query(UserModel).filter(
        (UserModel.username == payload.username) |
        (UserModel.email == payload.username)
    ).first()

    if not user or not user.is_active:
        return GENERIC_RESPONSE

    from app.models.password_reset import PasswordResetToken
    active_count = db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.now(timezone.utc),
    ).count()

    if active_count >= 5:
        return GENERIC_RESPONSE

    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,
    ).update({"used": True})

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

    send_password_reset_email(
        to_email=user.email,
        to_name=user.full_name or user.username,
        reset_token=token,
        ip_address=ip,
    )

    return GENERIC_RESPONSE


@router.get("/reset-password/validate", status_code=200)
async def validate_reset_token(token: str, db: Session = Depends(get_db)):
    """Valida que el token de recuperación existe, no está usado y no expiró."""
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
    """Restablece la contraseña usando el token recibido por email."""
    import re
    from app.models.password_reset import PasswordResetToken

    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token,
    ).first()

    if not reset or reset.used:
        raise HTTPException(status_code=400, detail="Token inválido o ya utilizado")
    if reset.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="El enlace ha expirado. Solicita uno nuevo")

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

    user = db.query(UserModel).filter(UserModel.id == reset.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    user.hashed_password = get_password_hash(pwd)
    user.must_change_password = False
    reset.used = True
    db.commit()

    return {"message": "Contraseña restablecida correctamente. Ya puedes iniciar sesión"}

