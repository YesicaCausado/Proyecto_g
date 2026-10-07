"""
NeuroLearn IA — Las dependencias de producción cubren lo que importa la app.

Vercel instala solo `api/requirements.txt`. Si el código de `backend/app`
importa una librería que no está ahí, en producción falla aunque en local
funcione (así pasó con `cryptography`: conectar Google Drive daba error 500
porque la importación estaba protegida con try/except y fallaba en silencio).

La prueba es estática: recorre los `import` de `backend/app` con `ast` (no
importa nada, no depende de lo que esté instalado) y exige que cada módulo
externo esté declarado en `api/requirements.txt`, salvo los opcionales
justificados en OPCIONALES.

Ejecutar desde backend/:

    python -m pytest tests/test_dependencias_produccion.py -v
"""
from __future__ import annotations

import ast
import re
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
APP_DIR = BACKEND_DIR / "app"
API_REQUIREMENTS = BACKEND_DIR.parent / "api" / "requirements.txt"

# Módulo importado → paquete de PyPI que lo provee (cuando el nombre difiere,
# o cuando llega como dependencia de otro paquete declarado).
MODULO_A_PAQUETE = {
    "jose": "python-jose",
    "pydantic_settings": "pydantic-settings",
    "starlette": "fastapi",          # dependencia directa de FastAPI
    "multipart": "python-multipart",
    "dotenv": "python-dotenv",
    "psycopg2": "psycopg2-binary",
}

# Módulos que la app importa pero que NO deben instalarse en producción.
# Cada uno necesita una justificación verificable.
OPCIONALES = {
    "openai": "Solo lo usa AdaptiveChatbot (app/ai/chatbot), que ninguna ruta de la "
              "API importa; Groq y Gemini se llaman por REST con httpx.",
}


def _normalizar(nombre: str) -> str:
    return re.sub(r"[-_.]+", "-", nombre).lower()


def paquetes_declarados() -> set[str]:
    paquetes = set()
    for linea in API_REQUIREMENTS.read_text(encoding="utf-8").splitlines():
        linea = linea.split("#", 1)[0].strip()
        if not linea or linea.startswith("-"):
            continue
        nombre = re.split(r"[\[<>=!~;\s]", linea, maxsplit=1)[0]
        paquetes.add(_normalizar(nombre))
    return paquetes


def modulos_externos_importados() -> dict[str, set[str]]:
    """{módulo de primer nivel: {archivos que lo importan}} para backend/app."""
    stdlib = set(sys.stdlib_module_names)
    encontrados: dict[str, set[str]] = {}
    for archivo in sorted(APP_DIR.rglob("*.py")):
        arbol = ast.parse(archivo.read_text(encoding="utf-8"), filename=str(archivo))
        for nodo in ast.walk(arbol):
            if isinstance(nodo, ast.Import):
                modulos = [alias.name for alias in nodo.names]
            elif isinstance(nodo, ast.ImportFrom) and nodo.level == 0 and nodo.module:
                modulos = [nodo.module]
            else:
                continue
            for modulo in modulos:
                raiz = modulo.split(".")[0]
                if raiz in stdlib or raiz == "app" or raiz == "__future__":
                    continue
                encontrados.setdefault(raiz, set()).add(
                    archivo.relative_to(BACKEND_DIR).as_posix())
    return encontrados


class ProductionDependenciesTest(unittest.TestCase):
    def test_every_imported_library_is_installed_in_production(self):
        declarados = paquetes_declarados()
        faltantes = []
        for modulo, archivos in sorted(modulos_externos_importados().items()):
            if modulo in OPCIONALES:
                continue
            paquete = _normalizar(MODULO_A_PAQUETE.get(modulo, modulo))
            if paquete not in declarados:
                faltantes.append(f"{modulo} (paquete '{paquete}'), usado en: {', '.join(sorted(archivos))}")
        self.assertEqual(
            faltantes, [],
            "Estas librerías se importan en backend/app pero no están en api/requirements.txt "
            "(Vercel no las instalará). Agréguelas, o si el nombre del paquete difiere, "
            "regístrelo en MODULO_A_PAQUETE:\n  " + "\n  ".join(faltantes),
        )

    def test_optional_modules_are_still_imported(self):
        """Evita que OPCIONALES acumule excepciones que ya no aplican."""
        importados = modulos_externos_importados()
        sobrantes = sorted(set(OPCIONALES) - set(importados))
        self.assertEqual(sobrantes, [], "Ya no se importan; quítelos de OPCIONALES.")

    def test_cryptography_is_a_production_dependency(self):
        # Regresión concreta: Integraciones cifra los tokens de Google Drive.
        self.assertIn("cryptography", paquetes_declarados())

    def test_dev_requirements_reuse_production_requirements(self):
        dev = (BACKEND_DIR / "requirements-dev.txt").read_text(encoding="utf-8")
        self.assertIn("-r ../api/requirements.txt", dev.splitlines())


if __name__ == "__main__":
    unittest.main(verbosity=2)
