"""
Tamaño de la función Python de Vercel (api/index.py).

Vercel incluye en la función TODOS los archivos del proyecto presentes durante
el build, salvo los que excluye `functions["api/index.py"].excludeFiles` en
vercel.json. Sin esa exclusión, `frontend/public` (≈ 140 MB: PDFs de material,
el avatar VRM y los WASM de MediaPipe) se empaquetaba junto al backend y, al
sumar `cryptography` (parche 9), la función pasó de 225 MB y el despliegue
falló («Total bundle size exceeds the maximum function size»).

Estas pruebas son estáticas (no llaman a Vercel):
  * lo que necesita el backend en ejecución no está excluido;
  * el frontend, la documentación y las pruebas sí lo están;
  * los archivos del proyecto que quedan en la función suman poco, con margen
    para las dependencias de api/requirements.txt.
"""
from __future__ import annotations

import json
import os
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FUNCTION = "api/index.py"
# Límite de Vercel 225 MB; las dependencias instaladas ocupan ≈ 60–90 MB.
MAX_PROJECT_FILES_MB = 25
# Carpetas locales que no existen en el build de Vercel.
LOCAL_ONLY = {".git", ".venv", "venv", "__pycache__", "node_modules", ".pytest_cache", ".mypy_cache"}


def _expand_braces(pattern: str) -> list[str]:
    match = re.search(r"\{([^{}]*)\}", pattern)
    if not match:
        return [pattern]
    head, tail = pattern[:match.start()], pattern[match.end():]
    return [p for option in match.group(1).split(",") for p in _expand_braces(head + option + tail)]


def _glob_regex(pattern: str) -> re.Pattern:
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out += r"(?:.*/)?"
            i += 3
        elif pattern.startswith("**", i):
            out += r".*"
            i += 2
        elif pattern[i] == "*":
            out += r"[^/]*"
            i += 1
        else:
            out += re.escape(pattern[i])
            i += 1
    return re.compile(out + r"\Z")


def _patterns(value: str) -> list[re.Pattern]:
    """`{a,b}` (un glob con llaves) o `a,b` (lista separada por comas)."""
    value = value.strip()
    parts = _expand_braces(value) if "{" in value else value.split(",")
    return [_glob_regex(p.strip()) for p in parts if p.strip()]


def _project_files():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in LOCAL_ONLY]
        for name in filenames:
            full = Path(dirpath) / name
            yield full.relative_to(ROOT).as_posix(), full.stat().st_size


class VercelBundleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        config = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        cls.function = config["functions"][FUNCTION]
        cls.exclude = _patterns(cls.function.get("excludeFiles", ""))
        cls.include = _patterns(cls.function.get("includeFiles", ""))

    def excluded(self, path: str) -> bool:
        return any(p.match(path) for p in self.exclude)

    def test_runtime_files_are_not_excluded(self):
        required = ["api/index.py", "api/requirements.txt", "backend/app/main.py",
                    "backend/app/api/neurobot_assignments.py"]
        required += [p for p, _ in _project_files() if p.startswith("backend/data/") and p.endswith(".json")]
        for path in required:
            self.assertTrue((ROOT / path).exists(), path)
            self.assertFalse(self.excluded(path), f"{path} quedaría fuera de la función")
        for path in ("api/index.py", "backend/app/main.py"):
            self.assertTrue(any(p.match(path) for p in self.include), f"{path} no está en includeFiles")

    def test_frontend_docs_and_tests_are_excluded(self):
        for path in ("frontend/public/tutor.vrm", "frontend/public/material/1.pdf",
                     "frontend/dist/index.html", "frontend/node_modules/react/index.js",
                     "frontend/src/App.tsx", "docs/PRUEBAS.md", "backend/tests/test_vercel_bundle.py",
                     "backend/migrations/README.md", "backend/neurolearn.db"):
            self.assertTrue(self.excluded(path), f"{path} se empaquetaría en la función")

    def test_project_files_in_function_fit_the_limit(self):
        kept = [(p, s) for p, s in _project_files() if not self.excluded(p)]
        total_mb = sum(s for _, s in kept) / 1048576
        biggest = sorted(kept, key=lambda x: -x[1])[:5]
        self.assertLess(total_mb, MAX_PROJECT_FILES_MB,
                        f"{total_mb:.1f} MB de archivos del proyecto en la función; los más grandes: "
                        + ", ".join(f"{p} ({s / 1048576:.1f} MB)" for p, s in biggest))


if __name__ == "__main__":
    unittest.main(verbosity=2)
