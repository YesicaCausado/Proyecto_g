"""
NeuroLearn AI - API de Autenticación

Soporta autenticación mediante base de datos:
- Local
- Producción / Supabase / PostgreSQL
- Vercel

Endpoints principales:
- POST /auth/register
- POST /auth/login
- GET  /auth/me
- PATCH /auth/me
- POST /auth/change-password
- POST /auth/forgot-password
- GET  /auth/reset-password/validate
- POST /auth/reset-password
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import base64
import binascii
import re
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.config import settings
from app.core.security import (
    check_origin,
    check_rate_limit,
    failed_login_tracker,
)
from app.models.user import User as UserModel
from app.schemas.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
)
from app.services.email_service import send_password_reset_email


# ============================================================
# CONFIGURACIÓN
# ============================================================

router = APIRouter(
    prefix="/auth",
    tags=["Autenticación"],
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login",
    auto_error=False,
)


# ============================================================
# CONTRASEÑAS
# ============================================================

def verify_password(
    plain_password: str,
    hashed_password: str,
) -> bool:
    """
    Verifica una contraseña contra su hash.

    Retorna False si el hash es inválido para evitar que
    un hash corrupto provoque un error 500 durante el login.
    """
    try:
        return pwd_context.verify(
            plain_password,
            hashed_password,
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """
    Genera el hash seguro de una contraseña.
    """
    return pwd_context.hash(password)


def validate_password_strength(
    password: str,
) -> Optional[str]:
    """
    Valida la fortaleza de una contraseña.

    Reglas:
    - mínimo 8 caracteres
    - una mayúscula
    - una minúscula
    - un número
    - un carácter especial

    Retorna:
    - None si la contraseña es válida.
    - mensaje de error si no cumple.
    """

    if not isinstance(password, str):
        return "La contraseña no es válida."

    if len(password) < 8:
        return "La contraseña debe tener al menos 8 caracteres."

    if not re.search(r"[A-Z]", password):
        return "La contraseña debe incluir una letra mayúscula."

    if not re.search(r"[a-z]", password):
        return "La contraseña debe incluir una letra minúscula."

    if not re.search(r"\d", password):
        return "La contraseña debe incluir un número."

    if not re.search(
        r"[!@#$%^&*(),.?\":{}|<>_\-+=\[\]\\/~`';]",
        password,
    ):
        return (
            "La contraseña debe incluir un carácter especial "
            "(!@#$%^&*...)."
        )

    return None


# ============================================================
# JWT
# ============================================================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """
    Crea un JWT de acceso.
    """

    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
    )

    to_encode.update(
        {
            "exp": expire,
        }
    )

    return jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


# ============================================================
# UTILIDADES
# ============================================================

def get_client_ip(request: Request) -> Optional[str]:
    """
    Obtiene la IP del cliente.

    En producción, Vercel/proxies pueden enviar
    X-Forwarded-For con varias IP separadas por comas.

    Tomamos la primera IP.
    """

    forwarded_for = request.headers.get("X-Forwarded-For")

    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()

        if first_ip:
            return first_ip

    real_ip = request.headers.get("X-Real-IP")

    if real_ip:
        return real_ip.strip()

    if request.client:
        return request.client.host

    return None


def validate_profile_photo(
    photo: Optional[str],
) -> Optional[str]:
    """
    Valida una foto de perfil enviada como Data URL:

        data:image/jpeg;base64,...

    Reglas:
    - Debe ser Data URL.
    - Debe ser una imagen.
    - Debe contener base64 válido.
    - Máximo 3 MB aproximadamente.
    """

    # None o vacío significa eliminar la foto.
    if not photo:
        return None

    if not isinstance(photo, str):
        return "La foto no es válida."

    if not photo.startswith("data:"):
        return (
            "La foto debe enviarse como "
            "data URL de imagen."
        )

    if not photo.startswith("data:image/"):
        return "La foto debe ser una imagen."

    try:
        header, separator, payload = photo.partition(",")

        if not separator or not payload:
            return "La foto no contiene datos válidos."

        # Verificar que el header indique base64.
        if ";base64" not in header.lower():
            return (
                "La foto debe enviarse en formato "
                "base64."
            )

        # Validar base64 real.
        decoded = base64.b64decode(
            payload,
            validate=True,
        )

    except (ValueError, binascii.Error):
        return (
            "La foto no es una imagen "
            "base64 válida."
        )

    # Límite real sobre los bytes decodificados.
    max_size = 3 * 1024 * 1024

    if len(decoded) > max_size:
        return (
            "La foto supera el tamaño máximo "
            "permitido (3 MB)."
        )

    # Validar extensiones/tipos comunes.
    allowed_types = (
        "data:image/jpeg",
        "data:image/jpg",
        "data:image/png",
        "data:image/webp",
        "data:image/gif",
    )

    if not header.lower().startswith(allowed_types):
        return (
            "Formato de imagen no permitido. "
            "Usa JPG, PNG, WEBP o GIF."
        )

    return None


# ============================================================
# USUARIO ACTUAL
# ============================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    """
    Obtiene el usuario autenticado a partir del JWT.

    Flujo:

    1. Comprueba que exista token.
    2. Decodifica JWT.
    3. Obtiene username.
    4. Busca usuario en DB.
    5. Comprueba que esté activo.
    """

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        username = payload.get("sub")

        if not username:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    try:
        user = (
            db.query(UserModel)
            .filter(
                UserModel.username == username
            )
            .first()
        )

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No fue posible consultar la "
                "base de datos."
            ),
        )

    if user is None:
        raise credentials_exception

    # IMPORTANTE:
    # Un usuario desactivado no puede continuar
    # usando un token antiguo.
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Cuenta desactivada. "
                "Contacta al administrador."
            ),
        )

    return user


# ============================================================
# REGISTRO
# ============================================================

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    user_data: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    """
    Crear cuenta de usuario.

    Este endpoint es interno y protegido.

    Permisos:

    ADMIN:
        Puede crear:
        - estudiante
        - profesor
        - super_profesor
        - admin

    SUPER_PROFESOR:
        Puede crear:
        - estudiante
        - profesor

    El flujo B2B principal utiliza:
        /admin/institutions
        /super/teachers
        /super/students
    """

    check_origin(request)
    check_rate_limit(request)

    # --------------------------------------------------------
    # Verificar permisos
    # --------------------------------------------------------

    if current_user.role not in (
        "admin",
        "super_profesor",
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "No tienes permisos para crear cuentas. "
                "Usa el panel de administración."
            ),
        )

    roles_permitidos = {
        "admin": (
            "estudiante",
            "profesor",
            "super_profesor",
            "admin",
        ),
        "super_profesor": (
            "estudiante",
            "profesor",
        ),
    }

    if user_data.role not in roles_permitidos.get(
        current_user.role,
        (),
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Tu rol no puede crear usuarios "
                f"de tipo '{user_data.role}'."
            ),
        )

    # --------------------------------------------------------
    # Validar contraseña
    # --------------------------------------------------------

    strength_error = validate_password_strength(
        user_data.password
    )

    if strength_error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=strength_error,
        )

    # --------------------------------------------------------
    # Crear usuario
    # --------------------------------------------------------

    try:
        existing_username = (
            db.query(UserModel)
            .filter(
                UserModel.username
                == user_data.username
            )
            .first()
        )

        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya existe",
            )

        existing_email = (
            db.query(UserModel)
            .filter(
                UserModel.email
                == user_data.email
            )
            .first()
        )

        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email ya está registrado",
            )

        db_user = UserModel(
            username=user_data.username,
            email=user_data.email,
            hashed_password=get_password_hash(
                user_data.password
            ),
            full_name=user_data.full_name,
            role=user_data.role,
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)

        return db_user

    except HTTPException:
        db.rollback()
        raise

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No fue posible crear el usuario "
                "porque ocurrió un error en la "
                "base de datos."
            ),
        )


# ============================================================
# LOGIN
# ============================================================

@router.post(
    "/login",
    response_model=Token,
)
async def login(
    user_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Iniciar sesión.

    Seguridad:
    - Validación de Origin.
    - Rate limiting.
    - Protección contra fuerza bruta.
    - Bloqueo temporal.
    - Validación de cuenta activa.
    - JWT.
    """

    # --------------------------------------------------------
    # 1. Protección CSRF / Origin
    # --------------------------------------------------------

    check_origin(request)

    ip = get_client_ip(request)

    # --------------------------------------------------------
    # 2. Comprobar bloqueo
    # --------------------------------------------------------

    if failed_login_tracker.is_blocked(
        user_data.username,
        ip,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Demasiados intentos fallidos. "
                "Cuenta temporalmente bloqueada. "
                "Espera unos minutos e intenta de nuevo."
            ),
            headers={
                "Retry-After": str(
                    settings.RATE_LIMIT_LOCKOUT_SECONDS
                )
            },
        )

    # --------------------------------------------------------
    # 3. Rate limit
    # --------------------------------------------------------

    check_rate_limit(
        request,
        user_data.username,
    )

    # --------------------------------------------------------
    # 4. Buscar usuario
    # --------------------------------------------------------

    try:
        user = (
            db.query(UserModel)
            .filter(
                UserModel.username
                == user_data.username
            )
            .first()
        )

    except SQLAlchemyError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "No fue posible conectar con la "
                "base de datos. Intenta nuevamente."
            ),
        )

    # --------------------------------------------------------
    # 5. Validar contraseña
    # --------------------------------------------------------

    password_valid = False

    if user:
        password_valid = verify_password(
            user_data.password,
            user.hashed_password,
        )

    if not user or not password_valid:

        locked = failed_login_tracker.on_failure(
            user_data.username,
            ip,
        )

        if locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Demasiados intentos fallidos. "
                    "Cuenta temporalmente bloqueada. "
                    "Espera unos minutos e intenta de nuevo."
                ),
                headers={
                    "Retry-After": str(
                        settings.RATE_LIMIT_LOCKOUT_SECONDS
                    )
                },
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
            headers={
                "WWW-Authenticate": "Bearer"
            },
        )

    # --------------------------------------------------------
    # 6. Comprobar usuario activo
    # --------------------------------------------------------

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Cuenta desactivada. "
                "Contacta al administrador."
            ),
        )

    # --------------------------------------------------------
    # 7. Login correcto
    # --------------------------------------------------------

    failed_login_tracker.on_success(
        user_data.username,
        ip,
    )

    # --------------------------------------------------------
    # 8. Actualizar último login
    # --------------------------------------------------------

    try:
        user.last_login = datetime.now(timezone.utc)

        db.commit()

    except SQLAlchemyError:
        # No bloqueamos el login porque únicamente
        # falló la actualización de last_login.
        db.rollback()

    # --------------------------------------------------------
    # 9. Crear JWT
    # --------------------------------------------------------

    access_token = create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role,
        }
    )

    # --------------------------------------------------------
    # 10. Respuesta
    # --------------------------------------------------------

    return Token(
        access_token=access_token,
        user_id=user.id,
        role=user.role,
        full_name=user.full_name,
        must_change_password=(
            getattr(
                user,
                "must_change_password",
                False,
            )
            or False
        ),
        email=user.email,
        username=user.username,
        is_active=user.is_active,
        is_expert=(
            getattr(
                user,
                "is_expert",
                False,
            )
            or False
        ),
        photo=getattr(
            user,
            "photo",
            None,
        ),
        institution_id=getattr(
            user,
            "institution_id",
            None,
        ),
        document_number=getattr(
            user,
            "document_number",
            None,
        ),
        cognitive_profile=getattr(
            user,
            "cognitive_profile",
            None,
        ),
        created_at=user.created_at,
    )


# ============================================================
# MI PERFIL
# ============================================================

@router.get(
    "/me",
    response_model=UserResponse,
)
async def get_me(
    current_user: UserModel = Depends(
        get_current_user
    ),
):
    """
    Obtener información del usuario autenticado.
    """

    return current_user


# ============================================================
# ACTUALIZAR PERFIL
# ============================================================

@router.patch(
    "/me",
    response_model=UserResponse,
)
async def update_me(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(
        get_current_user
    ),
):
    """
    Actualizar:
    - nombre
    - email
    - foto de perfil
    """

    check_origin(request)
    check_rate_limit(
        request,
        current_user.username,
    )

    # --------------------------------------------------------
    # Nombre
    # --------------------------------------------------------

    if "full_name" in data:

        full_name = data["full_name"]

        if full_name is not None:
            full_name = str(full_name).strip()

            if full_name:
                current_user.full_name = full_name

    # --------------------------------------------------------
    # Email
    # --------------------------------------------------------

    if "email" in data:

        email = data["email"]

        if email is not None:
            email = str(email).strip().lower()

            if email:

                existing = (
                    db.query(UserModel)
                    .filter(
                        UserModel.email == email,
                        UserModel.id
                        != current_user.id,
                    )
                    .first()
                )

                if existing:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            "El email ya está en uso "
                            "por otra cuenta."
                        ),
                    )

                current_user.email = email

    # --------------------------------------------------------
    # Foto
    # --------------------------------------------------------

    if "photo" in data:

        photo = data["photo"]

        photo_err = validate_profile_photo(
            photo
        )

        if photo_err:
            raise HTTPException(
                status_code=400,
                detail=photo_err,
            )

        if photo:
            current_user.photo = photo.strip()
        else:
            current_user.photo = None

    # --------------------------------------------------------
    # Guardar
    # --------------------------------------------------------

    try:
        db.commit()
        db.refresh(current_user)

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="No fue posible guardar los cambios.",
        )

    return current_user


# ============================================================
# CAMBIAR CONTRASEÑA
# ============================================================

@router.post(
    "/change-password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def change_password(
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(
        get_current_user
    ),
):
    """
    Cambiar contraseña estando autenticado.
    """

    check_origin(request)

    check_rate_limit(
        request,
        current_user.username,
    )

    current_pwd = data.get(
        "current_password",
        "",
    )

    new_pwd = data.get(
        "new_password",
        "",
    )

    # --------------------------------------------------------
    # Validar contraseña actual
    # --------------------------------------------------------

    if not verify_password(
        current_pwd,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "La contraseña actual "
                "es incorrecta."
            ),
        )

    # --------------------------------------------------------
    # Evitar reutilizar la misma contraseña
    # --------------------------------------------------------

    if verify_password(
        new_pwd,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "La nueva contraseña debe ser "
                "diferente de la contraseña actual."
            ),
        )

    # --------------------------------------------------------
    # Fortaleza
    # --------------------------------------------------------

    strength_error = validate_password_strength(
        new_pwd
    )

    if strength_error:
        raise HTTPException(
            status_code=400,
            detail=strength_error,
        )

    # --------------------------------------------------------
    # Guardar
    # --------------------------------------------------------

    current_user.hashed_password = (
        get_password_hash(new_pwd)
    )

    current_user.must_change_password = False

    try:
        db.commit()

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "No fue posible cambiar "
                "la contraseña."
            ),
        )

    return None


# ============================================================
# OLVIDÉ MI CONTRASEÑA
# ============================================================

@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
)
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Solicitar recuperación de contraseña.

    Por seguridad, siempre devuelve el mismo mensaje
    independientemente de si el usuario existe.

    Esto evita revelar:
    - usuarios registrados
    - emails registrados
    - existencia de cuentas
    """

    check_origin(request)
    check_rate_limit(request)

    generic_response = {
        "message": (
            "Si los datos son correctos, recibirás "
            "un correo con las instrucciones."
        )
    }

    # --------------------------------------------------------
    # Buscar usuario
    # --------------------------------------------------------

    try:
        user = (
            db.query(UserModel)
            .filter(
                (UserModel.username == payload.username)
                | (UserModel.email == payload.username)
            )
            .first()
        )

    except SQLAlchemyError:
        # No revelamos información sobre el usuario.
        return generic_response

    if not user or not user.is_active:
        return generic_response

    # --------------------------------------------------------
    # Importación local
    # --------------------------------------------------------

    from app.models.password_reset import (
        PasswordResetToken
    )

    now = datetime.now(timezone.utc)

    # --------------------------------------------------------
    # Limitar tokens activos
    # --------------------------------------------------------

    try:

        active_count = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.user_id
                == user.id,
                PasswordResetToken.used == False,
                PasswordResetToken.expires_at > now,
            )
            .count()
        )

    except SQLAlchemyError:
        db.rollback()
        return generic_response

    if active_count >= 5:
        return generic_response

    # --------------------------------------------------------
    # Invalidar tokens anteriores
    # --------------------------------------------------------

    try:

        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id
            == user.id,
            PasswordResetToken.used == False,
        ).update(
            {
                "used": True
            },
            synchronize_session=False,
        )

        # ----------------------------------------------------
        # Crear nuevo token
        # ----------------------------------------------------

        token = secrets.token_urlsafe(64)

        expires_at = (
            now + timedelta(minutes=15)
        )

        ip = get_client_ip(request)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=expires_at,
            ip_address=ip,
        )

        db.add(reset_token)

        # ----------------------------------------------------
        # Enviar correo antes de confirmar la transacción.
        #
        # Si el correo falla, hacemos rollback para evitar
        # crear un token inutilizable.
        # ----------------------------------------------------

        try:

            send_password_reset_email(
                to_email=user.email,
                to_name=(
                    user.full_name
                    or user.username
                ),
                reset_token=token,
                ip_address=ip,
            )

        except Exception:
            db.rollback()

            # No revelamos si el usuario existe.
            return generic_response

        # ----------------------------------------------------
        # Confirmar creación del token
        # ----------------------------------------------------

        db.commit()

    except SQLAlchemyError:
        db.rollback()

        return generic_response

    return generic_response


# ============================================================
# VALIDAR TOKEN DE RECUPERACIÓN
# ============================================================

@router.get(
    "/reset-password/validate",
    status_code=status.HTTP_200_OK,
)
async def validate_reset_token(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Valida un token de recuperación.

    Condiciones:
    - debe existir
    - no debe estar usado
    - no debe estar expirado
    """

    from app.models.password_reset import (
        PasswordResetToken
    )

    try:

        reset = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token
                == token
            )
            .first()
        )

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible validar "
                "el enlace."
            ),
        )

    if not reset:
        raise HTTPException(
            status_code=400,
            detail=(
                "Token inválido o inexistente."
            ),
        )

    if reset.used:
        raise HTTPException(
            status_code=400,
            detail=(
                "Este enlace ya fue utilizado."
            ),
        )

    now = datetime.now(timezone.utc)

    # Normalización para evitar problemas cuando
    # SQLAlchemy devuelve un datetime sin timezone.
    expires_at = reset.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < now:
        raise HTTPException(
            status_code=400,
            detail=(
                "El enlace ha expirado. "
                "Solicita uno nuevo."
            ),
        )

    return {
        "valid": True,
        "message": "Token válido",
    }


# ============================================================
# RESTABLECER CONTRASEÑA
# ============================================================

@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
)
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Restablece la contraseña utilizando
    un token enviado por correo.
    """

    check_origin(request)
    check_rate_limit(request)

    from app.models.password_reset import (
        PasswordResetToken
    )

    # --------------------------------------------------------
    # Buscar token
    # --------------------------------------------------------

    try:

        reset = (
            db.query(PasswordResetToken)
            .filter(
                PasswordResetToken.token
                == payload.token
            )
            .first()
        )

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible procesar "
                "la solicitud."
            ),
        )

    # --------------------------------------------------------
    # Validar token
    # --------------------------------------------------------

    if not reset or reset.used:
        raise HTTPException(
            status_code=400,
            detail=(
                "Token inválido o ya utilizado."
            ),
        )

    now = datetime.now(timezone.utc)

    expires_at = reset.expires_at

    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(
            tzinfo=timezone.utc
        )

    if expires_at < now:
        raise HTTPException(
            status_code=400,
            detail=(
                "El enlace ha expirado. "
                "Solicita uno nuevo."
            ),
        )

    # --------------------------------------------------------
    # Validar nueva contraseña
    # --------------------------------------------------------

    pwd = payload.new_password

    strength_error = validate_password_strength(
        pwd
    )

    if strength_error:
        raise HTTPException(
            status_code=400,
            detail=strength_error,
        )

    # --------------------------------------------------------
    # Buscar usuario
    # --------------------------------------------------------

    try:

        user = (
            db.query(UserModel)
            .filter(
                UserModel.id == reset.user_id
            )
            .first()
        )

    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail=(
                "No fue posible consultar "
                "el usuario."
            ),
        )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuario no encontrado.",
        )

    # --------------------------------------------------------
    # Evitar reutilizar contraseña anterior
    # --------------------------------------------------------

    if verify_password(
        pwd,
        user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "La nueva contraseña debe ser "
                "diferente de la anterior."
            ),
        )

    # --------------------------------------------------------
    # Actualizar contraseña
    # --------------------------------------------------------

    try:

        user.hashed_password = (
            get_password_hash(pwd)
        )

        user.must_change_password = False

        # Marcar token como utilizado.
        reset.used = True

        db.commit()

    except SQLAlchemyError:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail=(
                "No fue posible restablecer "
                "la contraseña."
            ),
        )

    return {
        "message": (
            "Contraseña restablecida correctamente. "
            "Ya puedes iniciar sesión."
        )
    }