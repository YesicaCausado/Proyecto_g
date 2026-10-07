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
- POST /auth/forgot-password            (CU-03 paso 1)
- POST /auth/reset-password/validate   (CU-03 paso 2)
- POST /auth/reset-password            (CU-03 paso 3)
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
import base64
import binascii
import logging
import re
import time

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
from app.core.permissions import FORBIDDEN_MESSAGE, Permission, has_permission
from app.models.user import User as UserModel, UserRole
from app.schemas.schemas import (
    UserCreate,
    UserLogin,
    UserResponse,
    Token,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ValidateResetTokenRequest,
)
from app.repositories.password_reset_repository import (
    SqlAlchemyAuditRecorder,
    SqlAlchemyPasswordResetTokenRepository,
    SqlAlchemyUserRepository,
)
from app.services.email_service import frontend_url
from app.services.mail.factory import get_email_sender
from app.services.password_reset_service import (
    InvalidResetTokenError,
    PasswordResetError,
    PasswordResetPolicy,
    PasswordResetService,
)

logger = logging.getLogger(__name__)


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

    ensure_institution_active(user)

    return user


INSTITUTION_INACTIVE_MESSAGE = (
    "La institución está desactivada. "
    "Contacta al administrador."
)


def ensure_institution_active(user: UserModel) -> None:
    """
    Bloquea a los usuarios de una institución desactivada por el
    Administrador. El Administrador no pertenece a ninguna institución.
    """
    if user.role == UserRole.ADMIN.value or user.institution_id is None:
        return
    institution = user.institution
    if institution is not None and not institution.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=INSTITUTION_INACTIVE_MESSAGE,
        )


def require_permission(permission: Permission):
    """
    Dependencia de FastAPI: exige que el rol del usuario tenga el permiso.

    Uso:
        current_user: UserModel = Depends(require_permission(Permission.GESTIONAR_AULAS))
    """

    def dependency(
        current_user: UserModel = Depends(get_current_user),
    ) -> UserModel:
        if not has_permission(current_user.role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=FORBIDDEN_MESSAGE,
            )
        return current_user

    return dependency


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

    ensure_institution_active(user)

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
        institution_name=user.institution_name,
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
# CU-03 RECUPERAR CONTRASEÑA
# ============================================================
#
# Los endpoints solo traducen HTTP ⇄ caso de uso. La lógica y las reglas de
# negocio viven en app/services/password_reset_service.py.
#
# Son funciones síncronas (def) a propósito: la sesión SQLAlchemy y el
# cliente HTTP de Brevo son bloqueantes, y FastAPI ejecuta los "def" en un
# hilo aparte sin bloquear el event loop.

FORGOT_PASSWORD_MESSAGE = (
    "Si los datos corresponden a una cuenta con correo registrado, "
    "recibirás un enlace para restablecer tu contraseña."
)


def get_password_reset_service(
    db: Session = Depends(get_db),
) -> PasswordResetService:
    """Composición de dependencias de CU-03 (Dependency Injection)."""
    return PasswordResetService(
        users=SqlAlchemyUserRepository(db),
        tokens=SqlAlchemyPasswordResetTokenRepository(db),
        audit=SqlAlchemyAuditRecorder(db),
        transaction=db,
        email_sender=get_email_sender(),
        hash_password=get_password_hash,
        verify_password=verify_password,
        check_password_policy=validate_password_strength,
        policy=PasswordResetPolicy(
            reset_page_url=frontend_url("/reset-password"),
            login_url=frontend_url("/login"),
            token_ttl_minutes=settings.PASSWORD_RESET_TOKEN_TTL_MINUTES,
            cooldown_seconds=settings.PASSWORD_RESET_COOLDOWN_SECONDS,
            max_requests_per_hour=settings.PASSWORD_RESET_MAX_PER_HOUR,
        ),
    )


@router.post(
    "/forgot-password",
    status_code=status.HTTP_200_OK,
)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    service: PasswordResetService = Depends(get_password_reset_service),
):
    """
    CU-03 paso 1 — Solicitar enlace de recuperación.

    Siempre responde lo mismo y con una duración mínima similar, exista o
    no la cuenta, para no revelar qué usuarios están registrados.
    """
    started = time.monotonic()

    check_origin(request)
    check_rate_limit(request, f"forgot:{payload.username.strip().lower()}")

    try:
        service.request_reset(
            identifier=payload.username,
            ip_address=get_client_ip(request),
        )
    except Exception:  # BD caída, error inesperado: no se revela al cliente
        db.rollback()
        logger.exception("CU-03: error inesperado al solicitar recuperación")

    remaining = settings.PASSWORD_RESET_MIN_RESPONSE_SECONDS - (time.monotonic() - started)
    if remaining > 0:
        time.sleep(remaining)

    return {"message": FORGOT_PASSWORD_MESSAGE}


@router.post(
    "/reset-password/validate",
    status_code=status.HTTP_200_OK,
)
def validate_reset_token(
    payload: ValidateResetTokenRequest,
    request: Request,
    service: PasswordResetService = Depends(get_password_reset_service),
):
    """CU-03 paso 2 — Comprobar que el enlace exista, no esté usado ni vencido."""
    check_origin(request)
    check_rate_limit(request)

    try:
        service.validate_token(payload.token)
    except InvalidResetTokenError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except SQLAlchemyError:
        raise HTTPException(
            status_code=503,
            detail="No fue posible validar el enlace. Intenta más tarde.",
        )

    return {"valid": True, "message": "Enlace válido."}


@router.post(
    "/reset-password",
    status_code=status.HTTP_200_OK,
)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    service: PasswordResetService = Depends(get_password_reset_service),
):
    """CU-03 paso 3 — Fijar la nueva contraseña con el token recibido."""
    check_origin(request)
    check_rate_limit(request)

    try:
        service.reset_password(
            raw_token=payload.token,
            new_password=payload.new_password,
            ip_address=get_client_ip(request),
        )
    except PasswordResetError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except SQLAlchemyError:
        db.rollback()
        logger.exception("CU-03: error de BD al restablecer contraseña")
        raise HTTPException(
            status_code=503,
            detail="No fue posible restablecer la contraseña. Intenta más tarde.",
        )

    return {
        "message": (
            "Contraseña restablecida correctamente. "
            "Ya puedes iniciar sesión."
        )
    }
