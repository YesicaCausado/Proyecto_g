r"""
Verificación del endpoint de exportación de reportes (teacher_reports.py).
================================================================================
Valida que /teacher/reports/export:

1. Usa campos REALES del modelo (no AttributeError por atributos inexistentes):
   - QuizHistory.time_spent_seconds / performance_score / topic / quiz_title /
     completed_at / created_at
   - QuizHistory.user.full_name
   - QuizHistory.session (LearningSession) .bot (ExpertBot) .name
2. CSV: devuelve filas correctas incluso si sesión o bot son NULL.
3. PDF: requiere reportlab; si no está instalado devuelve 400 con mensaje claro
   (fallback seguro) — en despliegue reportlab==4.1.0 está en requirements.txt.

No toca la base de datos real (usa SQLite en memoria).

Ejecutar:
    cd backend
    .venv\Scripts\python.exe tests\test_teacher_reports.py
"""
import os
import sys

os.environ.setdefault("SECRET_KEY", "test-secret-key-para-pruebas-0123456789")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:?check_same_thread=False")

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Importamos TODOS los modelos para que SQLAlchemy conozca el grafo de tablas.
from app.db.database import Base
import app.models.user
import app.models.expert_bot
import app.models.institution
import app.models.learning
import app.models.classroom

from app.models.user import User, UserRole
from app.models.expert_bot import ExpertBot
from app.models.learning import LearningSession, QuizHistory, DifficultyLevel

from fastapi.testclient import TestClient
from app.main import app
from app.api import teacher_reports

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def _get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


# Profeso/a autenticado
def _get_current_user():
    db = TestingSession()
    u = db.query(User).filter(User.username == "profe").first()
    return u


app.dependency_overrides[teacher_reports.get_db] = _get_db
app.dependency_overrides[teacher_reports.get_current_user] = _get_current_user

client = TestClient(app)

passed = 0
failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name}  {detail}")


def main():
    Base.metadata.create_all(bind=engine)
    db = TestingSession()

    # Usuarios
    prof = User(username="profe", hashed_password="x", full_name="Profesor A",
                role=UserRole.PROFESOR.value)
    estudiante = User(username="alumno1", hashed_password="x", full_name="Estudiante Uno",
                      role=UserRole.ESTUDIANTE.value)
    db.add_all([prof, estudiante])
    db.commit()

    # Bot experto + sesión de aprendizaje vinculada a un quiz
    bot = ExpertBot(creator_id=prof.id, name="Bot de Matemáticas")
    db.add(bot)
    db.commit()

    sesion = LearningSession(
        user_id=estudiante.id, bot_id=bot.id, topic="Álgebra",
        current_difficulty=DifficultyLevel.MEDIUM.value,
        total_interactions=3, correct_responses=2, errors_count=0,
        avg_response_time_ms=1200.0,
    )
    db.add(sesion)
    db.commit()

    # Quiz con todos los campos que usa teacher_reports.py
    quiz = QuizHistory(
        user_id=estudiante.id,
        session_id=sesion.id,
        classroom_id=None,
        quiz_title="Título Álgebra",
        topic="Álgebra",
        difficulty="Medio",
        questions_count=5,
        user_score="4/5",
        correct_answers=4,
        wrong_answers=1,
        quiz_data={},
        performance_score=80.0,
        time_spent_seconds=7200,  # 120 min
    )
    # second quiz: sesión y bot NULL (caso borde)
    quiz2 = QuizHistory(
        user_id=estudiante.id,
        session_id=None,
        classroom_id=None,
        quiz_title="Sin Sesión",
        topic="Geometría",
        difficulty="Fácil",
        questions_count=3,
        user_score="3/3",
        correct_answers=3,
        wrong_answers=0,
        quiz_data={},
        performance_score=100.0,
        time_spent_seconds=300,
    )
    db.add_all([quiz, quiz2])
    db.commit()
    db.close()

    # ── CSV (sin reportlab) ────────────────────────────────────────────────
    print("\n▶ CSV export")
    r = client.get("/api/v1/teacher/reports/export", params={"format": "csv"})
    check("CSV 200", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}")
    if r.status_code == 200:
        data = r.json()
        rows = data["rows"]
        check("CSV rows presentes", isinstance(rows, list) and len(rows) >= 3,
              f"rows={rows}")
        joined = "\n".join(rows)
        check("CSV incluye full_name del estudiante", "Estudiante Uno" in joined)
        check("CSV incluye name del bot", "Bot de Matemáticas" in joined)
        check("CSV incluye topics_covered", "Álgebra" in joined)
        check("CSV duration_minutes calculado (120)", any("120" in row and "Álgebra" in row for row in rows))
        check("CSV con sesión NULL no rompe (row presente)", any("Geometría" in row for row in rows))

    # ── PDF sin reportlab → 400 claro ─────────────────────────────────────
    print("\n▶ PDF export (sin reportlab instalado → fallback seguro)")
    r = client.get("/api/v1/teacher/reports/export", params={"format": "pdf"})
    check("PDF sin reportlab → 400", r.status_code == 400, f"status={r.status_code}")
    check("PDF mensaje pide instalar reportlab", "reportlab" in r.text.lower())

    print(f"\n=== RESULTADO: {passed} ok, {failed} fallos ===")
    app.dependency_overrides.clear()
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()