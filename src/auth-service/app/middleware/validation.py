"""
Validación de Inputs y Sanitización - Protección contra ataques
"""
from fastapi import Request, HTTPException, status
from typing import Any
import re
import logging
import html

logger = logging.getLogger(__name__)


class InputValidator:
    """Validación estricta de inputs para prevenir inyecciones"""
    
    # Patrones para validar emails
    EMAIL_REGEX = re.compile(
        r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    )
    
    # Patrones para validar usernames
    USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9_]{3,20}$")
    
    # Caracteres peligrosos que deben escaparse
    DANGEROUS_CHARS = ["<", ">", "&", '"', "'", "`", "$", "\\", "/"]
    
    MAX_LENGTH = {
        "username": 20,
        "email": 254,
        "password": 128,
        "full_name": 100,
    }
    
    def __init__(self):
        pass
    
    def validate_username(self, username: str) -> str:
        """Validar y sanitizar username"""
        if not username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El username es obligatorio"
            )
        
        username = username.strip()
        
        if len(username) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El username debe tener al menos 3 caracteres"
            )
        
        if len(username) > 20:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El username no puede exceder 20 caracteres"
            )
        
        if not self.USERNAME_REGEX.match(username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El username solo puede contener letras, números y guiones bajos"
            )
        
        if username.lower() in ["admin", "root", "system"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este username no está permitido"
            )
        
        return username
    
    def validate_email(self, email: str) -> str:
        """Validar y sanitizar email"""
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email es obligatorio"
            )
        
        email = email.strip().lower()
        
        if len(email) > 254:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El email es demasiado largo"
            )
        
        if not self.EMAIL_REGEX.match(email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de email inválido"
            )
        
        # Verificar si es dominio conocido para spam
        dangerous_domains = ["tempmail.com", "10minutemail.com", "guerrillamail.com"]
        if any(domain in email for domain in dangerous_domains):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Este dominio de email no está permitido"
            )
        
        return email
    
    def validate_password(self, password: str) -> str:
        """Validar y sanitizar password"""
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña es obligatoria"
            )
        
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña debe tener al menos 8 caracteres"
            )
        
        if len(password) > 128:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña es demasiado larga"
            )
        
        if not re.search(r"[A-Z]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña debe contener al menos una letra mayúscula"
            )
        
        if not re.search(r"[a-z]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña debe contener al menos una letra minúscula"
            )
        
        if not re.search(r"[0-9]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña debe contener al menos un número"
            )
        
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La contraseña debe contener al menos un carácter especial"
            )
        
        return password
    
    def sanitize_html(self, text: str) -> str:
        """Sanitizar HTML para prevenir XSS"""
        if not text:
            return text
        
        # Escapar caracteres HTML
        return html.escape(str(text))
    
    def validate_string_length(self, value: Any, max_length: int, field_name: str = "field"):
        """Validar longitud de string"""
        if value is None:
            return None
        
        str_value = str(value).strip()
        
        if len(str_value) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} excede el límite de {max_length} caracteres"
            )
        
        return str_value
    
    async def __call__(self, request: Request, call_next):
        """Middleware de validación"""
        # Leer body si existe
        body = await request.body()
        request.raw_body = body
        
        # Parsear JSON si está disponible
        if body:
            try:
                request.body_json = body.decode("utf-8")
                import json
                request.json_data = json.loads(body.decode("utf-8"))
            except json.JSONDecodeError:
                request.json_data = None
        
        response = await call_next(request)
        return response


# Singleton
input_validator = InputValidator()