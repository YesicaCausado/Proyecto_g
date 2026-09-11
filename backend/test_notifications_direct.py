#!/usr/bin/env python3
"""Diagnóstico directo de _build_notifications contra Supabase."""
import os, sys, traceback
from pathlib import Path

_BACKEND_DIR = Path(__file__).parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))
os.chdir(_BACKEND_DIR)

# Importar modelos primero
import app.models.institution        # noqa: F401
import app.models.user               # noqa: F401
import app.models.learning           # noqa: F401
import app.models.expert_bot         # noqa: F401
import app.models.classroom          # noqa: F401
import app.models.posts              # noqa: F401
import app.models.events             # noqa: F401
import app.models.messages           # noqa: F401
import app.models.password_reset     # noqa: F401

from app.db.database import SessionLocal, IS_DB_DISABLED
from app.models.user import User
from app.models.learning import QuizHistory, LearningSession
from app.api.notifications import _build_notifications

print(f"IS_DB_DISABLED={IS_DB_DISABLED}")

db = SessionLocal()
try:
    users = db.query(User).limit(20).all()
    print(f"Usuarios totales: {db.query(User).count()}")
    for u in users:
        print(f"  - id={u.id} username={u.username!r} role={u.role!r}")
        qh = db.query(QuizHistory).filter(QuizHistory.user_id == u.id).count()
        ls = db.query(LearningSession).filter(LearningSession.user_id == u.id).count()
        print(f"       quiz_history={qh} learning_sessions={ls}")
        try:
            n = _build_notifications(u, db)
            print(f"       notificaciones={len(n)} -> ids={[x['id'] for x in n]}")
        except Exception:
            print("       *** EXCEPTION en _build_notifications ***")
            traceback.print_exc()
finally:
    db.close()