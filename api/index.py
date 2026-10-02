"""
Vercel Serverless Entry Point — NeuroLearn AI Backend

Vercel utiliza este archivo como punto de entrada
para la aplicación FastAPI.
"""

import os
import sys


# ============================================================
# BACKEND PATH
# ============================================================

CURRENT_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

BACKEND_DIR = os.path.join(
    CURRENT_DIR,
    "..",
    "backend",
)

BACKEND_DIR = os.path.abspath(
    BACKEND_DIR
)


if BACKEND_DIR not in sys.path:
    sys.path.insert(
        0,
        BACKEND_DIR,
    )


# ============================================================
# FASTAPI APPLICATION
# ============================================================

from app.main import app  # noqa: E402,F401