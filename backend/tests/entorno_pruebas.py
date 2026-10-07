"""
Entorno aislado para las pruebas automáticas de NeuroLearn IA.

Debe importarse ANTES que cualquier módulo de `app` (la configuración se lee
al importar `app.core.config`, y `app.main` crea el esquema al importarse):

    sys.path.insert(0, ...backend...)
    import tests.entorno_pruebas  # noqa: E402,F401

Lo importan conftest.py (pytest) y cada archivo de pruebas que usa la app, de
modo que también queda aislado al ejecutar con `python -m unittest`.

Garantías:
  - Nunca se usa la base de datos real (DATABASE_URL del .env o de Vercel):
    SQLite en memoria.
  - Nunca se envían correos reales (EMAIL_PROVIDER=console; las pruebas que
    verifican correos los capturan con un doble).
  - Nunca se llama a los proveedores de IA (claves vacías; las pruebas que
    necesitan IA usan unittest.mock).
  - Clave JWT fija y exclusiva de pruebas.

Las variables de entorno tienen prioridad sobre el archivo .env, por lo que
los valores de aquí se imponen aunque exista un .env con datos reales.
"""
import os

TEST_ENV = {
    "DATABASE_URL": "sqlite:///:memory:?check_same_thread=False",
    "SECRET_KEY": "test-secret-key-para-pruebas-0123456789",
    "EMAIL_PROVIDER": "console",
    "PASSWORD_RESET_MIN_RESPONSE_SECONDS": "0",
    "GROQ_API_KEY": "",
    "GEMINI_API_KEY": "",
    "DEBUG": "true",
}

for _key, _value in TEST_ENV.items():
    os.environ[_key] = _value
