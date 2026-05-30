"""
API de Autenticación - Auth Service
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from app.db.database import get_db
from app.core.config import settings
from app.models.user import User
from app.schemas.schemas import (
    UserCreate, UserLogin, UserResponse, Token, UserUpdate, UserPermissionUpdate
)
from app.services.auth_service import AuthService
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/auth", tags=["Autenticación"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Obtiene el usuario actual desde el token JWT"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_data = AuthService.verify_token(token)
    if not token_data:
        raise credentials_exception
    
    user = db.query(User).filter(User.username == token_data.username).first()
    if not user:
        raise credentials_exception
    
    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Registrar un nuevo usuario"""
    try:
        user = AuthService.register_user(user_data, db)
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Iniciar sesión y obtener tokens"""
    user = AuthService.authenticate_user(credentials.username, credentials.password, db)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos",
        )
    
    access_token = AuthService.create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role
        }
    )
    
    refresh_token = AuthService.create_refresh_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "type": "refresh"
        },
        db=db
    )
    
    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_token: str,
    db: Session = Depends(get_db)
):
    """Refrescar token de acceso"""
    token_data = AuthService.verify_token(refresh_token)
    
    if not token_data or token_data.username is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de refresco inválido",
        )
    
    user = db.query(User).filter(User.username == token_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    
    new_access_token = AuthService.create_access_token(
        data={
            "sub": user.username,
            "user_id": user.id,
            "role": user.role
        }
    )
    
    return Token(
        access_token=new_access_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    )


@router.post("/logout")
async def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cerrar sesión"""
    return {"message": "Sesión cerrada exitosamente"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Obtener datos del usuario actual"""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_me(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualizar datos del usuario actual"""
    # Verificar contraseña si se va a cambiar
    if user_update.new_password:
        if not user_update.current_password:
            raise HTTPException(
                status_code=400,
                detail="Se requiere contraseña actual para cambiar la contraseña"
            )
        
        if not AuthService.verify_password(
            user_update.current_password,
            current_user.hashed_password
        ):
            raise HTTPException(
                status_code=400,
                detail="Contraseña actual incorrecta"
            )
        
        current_user.hashed_password = AuthService.get_password_hash(
            user_update.new_password
        )
    
    # Actualizar otros campos
    if user_update.full_name:
        current_user.full_name = user_update.full_name
    
    if user_update.email:
        # Verificar que el email no esté en uso
        existing = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email ya está en uso")
        current_user.email = user_update.email
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/users", response_model=list[UserResponse])
async def list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar usuarios (solo admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")
    
    users = db.query(User).all()
    return users


@router.put("/users/{user_id}/permissions", response_model=UserResponse)
async def update_user_permissions(
    user_id: int,
    perms_update: UserPermissionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualizar permisos de usuario (solo admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    user.permissions = perms_update.permissions
    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Eliminar usuario (solo admin)"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="No autorizado")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    db.delete(user)
    db.commit()
    return {"message": "Usuario eliminado"}
