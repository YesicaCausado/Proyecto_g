"""
Rate Limiter - Protección contra ataques y abuso de API
"""
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from typing import Dict, Optional
from collections import defaultdict
import time
import logging

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Rate Limiter con múltiples estrategias:
    - Por IP (para prevenir DDoS)
    - Por usuario (para prevenir abuso)
    - Por endpoint (para proteger endpoints críticos)
    """
    
    # Configuración de límites (requests por ventana de tiempo)
    ENDPOINTS = {
        "/api/v1/auth/login": {"requests": 10, "window": 60},       # 10 login/minuto
        "/api/v1/auth/register": {"requests": 5, "window": 300},    # 5 registro/5 min
        "/api/v1/auth/refresh": {"requests": 30, "window": 60},     # 30 refresh/minuto
        "/api/v1/auth/logout": {"requests": 5, "window": 60},       # 5 logout/minuto
        "/api/v1/auth/me": {"requests": 100, "window": 60},         # 100 me/minuto
        "/api/v1/chat/message": {"requests": 30, "window": 60},     # 30 chat/minuto
        "/api/v1/bots/train": {"requests": 5, "window": 3600},      # 5 train/hora
    }
    
    # Default para endpoints no especificados
    DEFAULT_LIMIT = {"requests": 100, "window": 60}
    
    def __init__(self):
        self.ip_counter: Dict[str, list] = defaultdict(list)
        self.user_counter: Dict[str, list] = defaultdict(list)
        self.endpoint_counter: Dict[str, list] = defaultdict(list)
    
    def _get_ip(self, request: Request) -> str:
        """Obtener IP del cliente (considerando proxies)"""
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
    
    def _get_user_id(self, request: Request) -> Optional[str]:
        """Obtener ID de usuario del token (si está disponible)"""
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
            # Extraer user_id del payload del token (puede mejorar decodificando)
            # Por simplicidad, usaremos el token como key temporal
            return token[:32] if len(token) > 32 else None
        return None
    
    def _get_endpoint_key(self, request: Request) -> str:
        """Obtener key del endpoint para rate limiting"""
        return request.url.path
    
    def _check_limit(self, key: str, limit: dict) -> bool:
        """Verificar si se ha superado el límite"""
        now = time.time()
        window = limit["window"]
        requests = limit["requests"]
        
        # Limpiar lista de requests antiguos
        self.ip_counter[key] = [t for t in self.ip_counter[key] if now - t < window]
        self.user_counter[key] = [t for t in self.user_counter[key] if now - t < window]
        self.endpoint_counter[key] = [t for t in self.endpoint_counter[key] if now - t < window]
        
        # Verificar cada tipo de límite
        if len(self.ip_counter[key]) >= requests:
            return False
        if len(self.user_counter[key]) >= requests:
            return False
        if len(self.endpoint_counter[key]) >= requests:
            return False
        
        return True
    
    def _record_request(self, key: str, ip: str, user_id: Optional[str]):
        """Registrar solicitud"""
        now = time.time()
        self.ip_counter[key].append(now)
        self.user_counter[key].append(now)
        self.endpoint_counter[key].append(now)
    
    async def __call__(self, request: Request, call_next):
        """Middleware rate limiter"""
        ip = self._get_ip(request)
        user_id = self._get_user_id(request)
        endpoint_key = self._get_endpoint_key(request)
        
        # Obtener límite para este endpoint
        limit = self.ENDPOINTS.get(endpoint_key, self.DEFAULT_LIMIT)
        
        # Verificar límite
        if not self._check_limit(endpoint_key, limit):
            logger.warning(f"Rate limit exceeded for {ip} on {endpoint_key}")
            
            # Respuesta rate limited
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Too many requests",
                    "message": "Has excedido el límite de solicitudes. Por favor espera antes de intentar nuevamente.",
                    "retry_after": limit["window"]
                },
                headers={
                    "Retry-After": str(limit["window"]),
                    "X-RateLimit-Limit": str(limit["requests"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time() + limit["window"]))
                }
            )
        
        # Registrar solicitud
        self._record_request(endpoint_key, ip, user_id)
        
        # Llamar al endpoint
        response = await call_next(request)
        
        # Agregar headers de rate limit al response
        response.headers["X-RateLimit-Limit"] = str(limit["requests"])
        response.headers["X-RateLimit-Remaining"] = str(limit["requests"] - len(self.endpoint_counter[endpoint_key]))
        response.headers["X-RateLimit-Reset"] = str(int(time.time() + limit["window"]))
        
        return response


# Singleton
rate_limiter = RateLimiter()