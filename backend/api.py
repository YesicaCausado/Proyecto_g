"""
Wrapper ASGI para Vercel
Expone la app FastAPI desde aquí
"""
from app.main import app

# Vercel busca esta variable
__all__ = ['app']
