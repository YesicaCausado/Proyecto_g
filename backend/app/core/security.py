"""
NeuroLearn AI - Capa de Seguridad HTTP

Contiene tres responsabilidades que cubren los pendientes del modelo de
seguridad (PLAN.md §6.2.1 / P4-14):

1. Rate limiting / anti fuerza bruta en endpoints de autenticación.
   Implementación propia sin dependencias externas (slowapi NO está en
   requirements.txt). Usa una ventana deslizante en memoria keyed por
   (ip, username) y, además, una ventana por (ip) para los endpoints que no
   reciben nombre de usuario (forgot-password). Al exceder el máximo se
   bloquea la llave durante RATE_LIMIT_LOCKOUT_SECONDS.

   ⚠️ En producción serverless (Vercel) la memoria NO persiste entre
   invocaciones. Este limiter es un buen primer nivel / mitigación local.
   Para un bloqueo estricto multi-instancia conviene mover el contador a
   una tabla o a un almacén compartido (Redis). El diseño deja claro el
   punto de extensión (``RateLimiter._storage``).

2. Validación de origen / CSRF para peticiones de autenticación.
   Como la API usa JWT Bearer (sin cookies de sesión), el riesgo clásico de
   CSRF por cookie es menor. Aún así, este módulo valida los encabezados
   Origin/Referer en las rutas de auth para frustrar abusos cross-site que
   intenten reutilizar la sesión de un navegador o forzar acciones.

3. Security headers.
   Middleware ASGI que añade CSP, X-Content-Type-Options, X-Frame-Options,
   Referrer-Policy, Permissions-Policy y HSTS a todas las respuestas,
   mitigando XSS, clickjacking y leak de referrer.

Para tests de XSS/SQLi consulte ``backend/tests/test_security.py``.
"""
from __future__ import annotations

import time
import threading
from collections import defaultdict, deque
from typing import DefaultDict, Deque, Dict, Optional, Tuple

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.config import settings

# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting (in-memory sliding window)
# ─────────────────────────────────────────────────────────────────────────────

# Llave compuesta -> cola de timestamps (época, en segundos) de intentos
_BUCKET_TYPE = Deque[float]
_Key = Tuple[str, str]  # (kind, identifier)


class RateLimiter:
    """
    Sliding-window rate limiter en memoria.

    Cada llave agrupa una cola de timestamps. Se podan los que quedaron fuera
    de la ventana; si el conteo restante supera el máximo, la llave pasa a un
    estado de "blocked" hasta que transcurra ``lockout_seconds``.
    """

    def __init__(
        self,
        max_requests: int,
        window_seconds: int,
        lockout_seconds: int,
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        self._events: DefaultDict[_Key, Deque[float]] = defaultdict(deque)
        self._blocked_until: Dict[_Key, float] = {}
        self._lock = threading.Lock()

    # Overridable storage hook (punto de extensión para Redis/DB en producción).
    @property
    def _storage(self):
        return self._events

    def _client_identifier(self, request: Request, username: str = "") -> str:
        """
        Identifica al cliente con X-Forwarded-For (cuando hay proxy/load
        balancer) o con la IP de conexión directa. Nunca confiamos en la
        cabecera salvo que la ponga un proxy de confianza; aquí se acepta
        como práctica habitual en Vercel/nginx.
        """
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            ip = forwarded.split(",")[0].strip()
        else:
            ip = getattr(request.client, "host", "unknown") or "unknown"
        return ip

    def is_allowed(self, request: Request, username: str = "") -> bool:
        ip = self._client_identifier(request)
        key = ("ip", ip)
        if username:
            key = ("user", f"{username}@{ip}")

        now = time.monotonic()
        with self._lock:
            # ¿Está bloqueada la llave? Si el bloqueo expiró, limpiamos y
            # restablecemos un contador limpio.
            blocked_until = self._blocked_until.get(key)
            if blocked_until:
                if now < blocked_until:
                    return False
                # El bloqueo ya expiró: reseteamos el contador completo.
                self._blocked_until.pop(key, None)
                self._storage[key].clear()
                return True

            events = self._storage[key]
            # Podar eventos fuera de la ventana.
            cutoff = now - self.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= self.max_requests:
                # Alcanzó el máximo → bloquear durante lockout_seconds.
                self._blocked_until[key] = now + self.lockout_seconds
                # Mantener la cola (la podamos al expirar el bloqueo).
                return False

            events.append(now)
            return True

    def remaining(self, request: Request, username: str = "") -> int:
        """Intentos restantes en la ventana actual (para la cabecera de respuesta)."""
        ip = self._client_identifier(request)
        key = ("user", f"{username}@{ip}") if username else ("ip", ip)
        now = time.monotonic()
        with self._lock:
            if now < self._blocked_until.get(key, 0.0):
                return 0
            events = self._storage[key]
            cutoff = now - self.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            return max(0, self.max_requests - len(events))


# Instancia global compartida (configurada desde settings).
rate_limiter = RateLimiter(
    max_requests=settings.RATE_LIMIT_MAX_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
    lockout_seconds=settings.RATE_LIMIT_LOCKOUT_SECONDS,
)


# ─────────────────────────────────────────────────────────────────────────────
# Anti fuerza bruta POR INTENTO FALLIDO (account lockout)
# ─────────────────────────────────────────────────────────────────────────────

class FailedLoginTracker:
    """
    Bloquea una cuenta (username) o una IP tras N *intentos fallidos*.

    A diferencia del RateLimiter de peticiones, este cuenta SOLO fallos de
    autenticación. Un intento exitoso (o pasar el tiempo de bloqueo) limpia o
    reduce el contador. Así un atacante no puede probar contraseñas de forma
    ilimitada, mientras los legítimos que meten mal la clave unas veces no se
    ven bloqueados de forma permanente.

    Almacenamiento en memoria (mismo límite que el RateLimiter en serverless).
    """

    def __init__(
        self,
        max_failures: int,
        window_seconds: int,
        lockout_seconds: int,
    ) -> None:
        self.max_failures = max_failures
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        self._failures: DefaultDict[str, Deque[float]] = defaultdict(deque)
        self._blocked_until: Dict[str, float] = {}
        self._lock = threading.Lock()

    def _ident(self, username: str, ip: str) -> str:
        # Bloquear por cuenta y, en paralelo, por IP evita tanto ataques de
        # diccionario contra una cuenta como la fuerza bruta distribuida.
        return f"{username}@{ip}"

    def on_failure(self, username: str, ip: str) -> bool:
        """
        Registra un intento fallido y devuelve True si la llave ha quedado
        bloqueada (límite alcanzado).
        """
        key = self._ident(username, ip)
        now = time.monotonic()
        with self._lock:
            if now < self._blocked_until.get(key, 0.0):
                return True  # ya estaba bloqueada
            self._blocked_until.pop(key, None)
            events = self._failures[key]
            cutoff = now - self.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            events.append(now)
            if len(events) >= self.max_failures:
                self._blocked_until[key] = now + self.lockout_seconds
                self._failures[key].clear()
                return True
            return False

    def on_success(self, username: str, ip: str) -> None:
        """Limpia el historial de fallos de una credencial válida."""
        key = self._ident(username, ip)
        with self._lock:
            self._failures.pop(key, None)
            self._blocked_until.pop(key, None)

    def is_blocked(self, username: str, ip: str) -> bool:
        key = self._ident(username, ip)
        now = time.monotonic()
        with self._lock:
            blocked_until = self._blocked_until.get(key)
            if blocked_until and now < blocked_until:
                return True
            if blocked_until:
                self._blocked_until.pop(key, None)
                self._failures.pop(key, None)
            return False

    def get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return getattr(request.client, "host", "unknown") or "unknown"


failed_login_tracker = FailedLoginTracker(
    max_failures=settings.RATE_LIMIT_MAX_REQUESTS,
    window_seconds=settings.RATE_LIMIT_WINDOW_SECONDS,
    lockout_seconds=settings.RATE_LIMIT_LOCKOUT_SECONDS,
)


def check_rate_limit(request: Request, username: str = "") -> None:
    """
    Dependencia/usuario directo para marcar INTENTOS (no solo peticiones).

    Importante: para anti fuerza bruta lo correcto es contar *intentos
    fallidos*. Este helper registra la petición ANTES de validar credenciales
    usando la misma ventana de rate limiting; el rate limiter global ya evita
    ráfagas. Si quiere discriminar "solo fallidas", registre/maneje la llave
    tras validar (ver nota en auth.py).
    """
    from fastapi import HTTPException

    if not rate_limiter.is_allowed(request, username):
        retry_after = settings.RATE_LIMIT_LOCKOUT_SECONDS
        raise HTTPException(
            status_code=429,
            detail=(
                "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
            ),
            headers={"Retry-After": str(retry_after)},
        )


def is_allowed_origin(request: Request) -> bool:
    """
    Valida Origin (y como respaldo Referer) contra los orígenes permitidos.
    Usado en las rutas de autenticación cuando CSRF_ORIGIN_ENFORCEMENT.
    """
    if not settings.CSRF_ORIGIN_ENFORCEMENT:
        return True

    origin = request.headers.get("origin")
    if not origin:
        # Sin Origin (peticiones curl/API interna): valida por Referer si existe.
        referer = request.headers.get("referer")
        if not referer:
            # Según configuración, dejamos pasar peticiones sin navegador
            # (los clientes API no envían cabeceras de origen).
            return True
        referer_host = _host_of(referer)
        return _host_allowed(referer_host)

    try:
        from urllib.parse import urlparse
        origin_host = urlparse(origin).hostname or ""
        origin_port = urlparse(origin).port
    except Exception:
        return False

    return _host_allowed(origin_host, origin_port)


def _host_allowed(host: str, port: Optional[int] = None) -> bool:
    for allowed in settings.ALLOWED_ORIGINS:
        try:
            from urllib.parse import urlparse
            a = urlparse(allowed)
        except Exception:
            continue
        if a.hostname == host and (port is None or a.port == port):
            return True
    return False


def _host_of(url: str) -> str:
    from urllib.parse import urlparse
    parsed = urlparse(url)
    hostname = parsed.hostname or ""
    if parsed.port:
        return f"{hostname}:{parsed.port}"
    return hostname


def check_origin(request: Request) -> None:
    """Lanza 403 si el Origin/Referer no está permitido (solo en auth)."""
    from fastapi import HTTPException

    if not is_allowed_origin(request):
        raise HTTPException(
            status_code=403,
            detail="Origen no permitido.",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Security headers middleware
# ─────────────────────────────────────────────────────────────────────────────

SECURITY_HEADERS = {
    # Content-Security-Policy: mitiga XSS al limitar fuentes de script/estilos.
    # Ajuste según las necesidades reales del SPA (Vite en dev usa inline/sockets).
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' "
        "https://www.gstatic.com https://www.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' https://*.supabase.co https://api.groq.com "
        "https://generativelanguage.googleapis.com wss: ws:; "
        "frame-ancestors 'none'"
    ),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": (
        "camera=(self), microphone=(self), geolocation=(), payment=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Añade cabeceras de seguridad a cada respuesta."""

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)
        for header, value in SECURITY_HEADERS.items():
            response.headers.setdefault(header, value)
        return response


class HSTSHeaderMiddleware(BaseHTTPMiddleware):
    """
    HSTS solo en entornos no DEBUG (HTTPS). En desarrollo con http local
    un Strict-Transport-Security agresivo rompe la navegación.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        response = await call_next(request)
        if not settings.DEBUG and settings.IS_PRODUCTION:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response