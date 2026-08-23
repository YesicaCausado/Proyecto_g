"""
🧪 NeuroLearn AI - Pruebas de Seguridad (PLAN.md §6.2.1 / P4-14)

Cubre los tres pendientes del modelo de seguridad:

1. Rate limiting / anti fuerza bruta en `/auth/login` y endpoints de auth.
2. CSRF / validación de origen (+ pruebas de XSS y SQLi en endpoints).
3. Cabeceras de seguridad HTTP (CSP, X-Content-Type-Options, etc.).

Usa un TestClient en proceso con la dependencia de base de datos anulada
(stub sin usuarios), de modo que NO toca la base de datos real de Supabase.

Ejecutar (requiere el entorno del backend que ya trae httpx/TestClient):

    cd backend
    .venv\\Scripts\\python.exe -m pytest tests\\test_security.py -v

También puede ejecutarse como script standalone:

    .venv\\Scripts\\python.exe tests\\test_security.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Consola Windows (cp1252) no imprime emojis; forzamos UTF-8 para stdout.
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.auth import router as auth_router
from app.core.security import (
    SecurityHeadersMiddleware,
    HSTSHeaderMiddleware,
    rate_limiter,
    failed_login_tracker,
    is_allowed_origin,
)
from app.db.database import get_db


# ── Harness: app minimal sin tocar la base de datos real ─────────────────────
class _EmptyQuery:
    def filter(self, *args, **kwargs):
        return self

    def first(self):
        return None


class _EmptyDB:
    """Stub de sesión que nunca encuentra usuarios (todos los logins fallan)."""
    def query(self, *_a, **_kw):
        return _EmptyQuery()

    def add(self, *_a, **_kw):
        pass

    def commit(self, *_a, **_kw):
        pass

    def rollback(self, *_a, **_kw):
        pass

    def refresh(self, *_a, **_kw):
        pass


def _stub_db():
    db = _EmptyDB()
    try:
        yield db
    finally:
        pass


_test_app = FastAPI()
_test_app.add_middleware(HSTSHeaderMiddleware)
_test_app.add_middleware(SecurityHeadersMiddleware)
_test_app.include_router(auth_router, prefix="/api/v1")
_test_app.dependency_overrides[get_db] = _stub_db


def _reset_limiters() -> None:
    """Limpia el estado de los límites en memoria para que cada test arranque limpio."""
    rate_limiter._events.clear()
    rate_limiter._blocked_until.clear()
    failed_login_tracker._failures.clear()
    failed_login_tracker._blocked_until.clear()


def _login_headers(origin: str = "http://localhost:5173"):
    return {"Origin": origin}


# ─────────────────────────────────────────────────────────────────────────────
# 1) RATE LIMITING / ANTI FUERZA BRUTA
# ─────────────────────────────────────────────────────────────────────────────

def test_login_rejects_allowed_origin():
    """El login acepta peticiones legítimas desde un origen permitido."""
    _reset_limiters()
    with TestClient(_test_app) as client:
        r = client.post(
            "/api/v1/auth/login",
            json={"username": "usuario_inexistente_sec_1", "password": "Test1234!"},
            headers=_login_headers(),
        )
        # El usuario no existe → 401 (no 403 de origen, no 429 de rate-limit).
        assert r.status_code == 401, f"Se esperaba 401, obtuvo {r.status_code}: {r.text}"


def test_csrf_origin_rejected_on_login():
    """
    CSRF: un Origin no permitido debe ser rechazado con 403 en los endpoints
    de autenticación (check_origin). Cubre §6.2.1.4.
    """
    _reset_limiters()
    with TestClient(_test_app) as client:
        r = client.post(
            "/api/v1/auth/login",
            json={"username": "x", "password": "y"},
            # Origin hostil que NO está en ALLOWED_ORIGINS → debe ser rechazado.
            headers={"Origin": "https://attacker.evil"},
        )
        assert r.status_code == 403, f"Se esperaba 403 por origen no permitido, obtuvo {r.status_code}: {r.text}"


def _force_failed_logins(client: TestClient, username: str, count: int):
    """Hace `count` intentos de login fallidos contra un usuario y devuelve el último status."""
    last = None
    for _ in range(count):
        last = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "MalaClave!1"},
            headers=_login_headers(),
        ).status_code
    return last


def test_bruteforce_locks_account_after_failures():
    """
    Anti fuerza bruta: tras N intentos fallidos la cuenta pasa a 429
    (bloqueada), no se puede seguir probando contraseñas. (§6.2.1, P4-14)
    """
    _reset_limiters()
    max_failures = failed_login_tracker.max_failures
    with TestClient(_test_app) as client:
        # El usuario no existe, así que cada intento es un fallo.
        username = f"no_existe_bf_{max_failures}"

        # Justo antes del límite → los intentos fallidos devuelven 401.
        last = _force_failed_logins(client, username, max_failures - 1)
        assert last == 401, f"Antes del límite debería dar 401, obtuvo {last}"

        # El intento que alcanza el límite introduce el bloqueo → 429.
        r = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "MalaClave!1"},
            headers=_login_headers(),
        )
        assert r.status_code == 429, f"Se esperaba 429 al bloquear, obtuvo {r.status_code}: {r.text}"

        # Sigue bloqueado en los siguientes intentos.
        r2 = client.post(
            "/api/v1/auth/login",
            json={"username": username, "password": "MalaClave!1"},
            headers=_login_headers(),
        )
        assert r2.status_code == 429, f"Cuenta bloqueada debería seguir en 429, obtuvo {r2.status_code}"
        assert r2.headers.get("retry-after") is not None, "Falta cabecera Retry-After"


# ─────────────────────────────────────────────────────────────────────────────
# 2) XSS / SQLi — inyección en payloads (mitigación de entrada)
# ─────────────────────────────────────────────────────────────────────────────

XSS_SAMPLES = [
    "<script>alert(1)</script>",
    '"><img src=x onerror=alert(1)>',
    "<svg/onload=alert(1)>",
    "javascript:alert(1)",
    '<iframe src="javascript:alert(1)"></iframe>',
]

SQLI_SAMPLES = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT username,hashed_password FROM users--",
    '" OR 1=1--',
    "' OR 1=1 /*",
]


def test_xss_payloads_rejected_by_login():
    """
    XSS (§6.2.1.2): payloads de script/HTML/JS en el login no deben causar
    inyección ni reflejarse en la respuesta. El backend los trata como dato,
    devuelve 401/422 controlado y nunca los refleja como HTML ejecutable.
    """
    _reset_limiters()
    with TestClient(_test_app) as client:
        for i, payload in enumerate(XSS_SAMPLES):
            r = client.post(
                "/api/v1/auth/login",
                json={"username": payload, "password": "x"},
                headers=_login_headers(),
            )
            # Debe ser un fallo de credencial/validación, no un 200 con contenido.
            assert r.status_code in (401, 422, 400), (
                f"XSS payload #{i} dio {r.status_code}: {r.text} — posible reflexión de input"
            )
            # Sin reflexión del payload en el cuerpo de la respuesta.
            assert payload not in r.text, (
                f"Posible reflexión XSS sin escapado en #{i}: {payload}"
            )


def test_sqli_payloads_rejected_by_login():
    """
    SQLi (§6.2.1.3): payloads de inyección SQL no deben ingresar en el query.
    El backend usa SQLAlchemy parametrizado (query(UserModel)...==username),
    por lo que estos payloads se tratan como dato y devuelven 401/422.
    """
    _reset_limiters()
    with TestClient(_test_app) as client:
        for i, payload in enumerate(SQLI_SAMPLES):
            r = client.post(
                "/api/v1/auth/login",
                json={"username": payload, "password": "x"},
                headers=_login_headers(),
            )
            assert r.status_code in (401, 422, 400), (
                f"SQLi payload #{i} dio {r.status_code}: {r.text}"
            )
        # Verificación de que no se inyectó ni rompió nada: el login normal
        # sigue respondiendo de forma controlada (401).
        r = client.post(
            "/api/v1/auth/login",
            json={"username": "no_existe_tras_sqli", "password": "x"},
            headers=_login_headers(),
        )
        assert r.status_code in (401, 422), "El sistema no debería haberse roto tras payloads SQLi"


# ─────────────────────────────────────────────────────────────────────────────
# 3) CABECERAS DE SEGURIDAD HTTP
# ─────────────────────────────────────────────────────────────────────────────

def test_security_headers_present():
    """Cada respuesta incluye las cabeceras de seguridad mínimas."""
    _reset_limiters()
    with TestClient(_test_app) as client:
        r = client.get("/docs")
        headers = r.headers
        assert "content-security-policy" in headers, "Falta Content-Security-Policy"
        assert "x-frame-options" in headers and headers["x-frame-options"] == "DENY", \
            "Falta/incorrecto X-Frame-Options"
        assert headers.get("x-content-type-options") == "nosniff", \
            "Falta X-Content-Type-Options: nosniff"
        assert "referrer-policy" in headers, "Falta Referrer-Policy"


def test_origin_allowlist_logic():
    """La lógica de orígenes permitidos acepta los configurados y rechaza otros."""
    _reset_limiters()
    from starlette.requests import Request

    def make_request(origin: str) -> Request:
        scope = {
            "type": "http",
            "headers": [(b"origin", origin.encode())],
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/api/v1/auth/login",
            "query_string": b"",
            "server": ("127.0.0.1", 8000),
            "client": ("127.0.0.1", 12345),
        }
        return Request(scope)

    assert is_allowed_origin(make_request("http://localhost:5173")) is True
    assert is_allowed_origin(make_request("https://evil.example")) is False


# ─────────────────────────────────────────────────────────────────────────────
# Runner standalone (sin pytest)
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    tests = [
        ("login acepta origen permitido", test_login_rejects_allowed_origin),
        ("CSRF rechaza origen no permitido", test_csrf_origin_rejected_on_login),
        ("anti fuerza bruta bloquea tras fallos", test_bruteforce_locks_account_after_failures),
        ("XSS rechazado", test_xss_payloads_rejected_by_login),
        ("SQLi rechazado", test_sqli_payloads_rejected_by_login),
        ("cabeceras de seguridad presentes", test_security_headers_present),
        ("allowlist de origenes", test_origin_allowlist_logic),
    ]
    print("\n NeuroLearn - PRUEBAS DE SEGURIDAD")
    print("=" * 60)
    failures = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  [OK] {name}")
        except AssertionError as e:
            print(f"  [FAIL] {name}\n     {e}")
            failures += 1
        except Exception as e:
            print(f"  [ERROR] {name} (error inesperado): {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            failures += 1
    print("=" * 60)
    print(f"{'PASS' if failures == 0 else 'FAIL'} {len(tests) - failures}/{len(tests)} pruebas superadas" + (f', {failures} fallidas' if failures else ''))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())