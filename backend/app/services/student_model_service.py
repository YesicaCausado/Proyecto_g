"""
NeuroLearn AI — StudentModelService

Orquesta el Student Model con la base de datos. DERIVA el modelo SOLO de datos
reales persistidos (quiz_history, cognitive_session_state, cognitive_events,
student_mastery, learning_state, student_memory) y actualiza esos registros
después de cada interacción significativa.

Si una pregunta no ha sido respondida nunca, no se inventa dominio: mastery=0
y evidence=0, y el motor de adaptación lo trata como "sin evidencia".
"""
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from sqlalchemy.orm import Session

from app.ai.adaptive.student_model import (
    StudentModel,
    SkillMastery,
    LearningState as LS,
    TeachingStrategy,
)


def _coerce_float(v, default: float = 0.0) -> float:
    try:
        if v is None:
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


class StudentModelService:

    def load_model(self, db: Session, student_id: int,
                   skill: Optional[str] = None) -> StudentModel:
        """Construye el modelo del estudiante leyendo la BD (solo datos reales)."""
        model = StudentModel(student_id=student_id)

        # ── 1) Mastery por habilidad desde student_mastery ──
        model.skills = self._load_mastery(db, student_id, skill)

        # ── 2) Estado de aprendizaje (continuidad) ──
        if skill:
            model.state = self._load_learning_state(db, student_id, skill)

        # ── 3) Memoria episódica + semántica relevante ──
        if skill:
            model.episodic_memories, model.semantic_memories = \
                self._load_memories(db, student_id, skill)

        # ── 4) Tasa de error reciente del chat (rendimiento en tiempo real) ──
        model.recent_chat_error_rate, model.recent_error_streak = \
            self._load_chat_metrics(db, student_id, skill)
        return model

    def _load_mastery(self, db: Session, student_id: int,
                      skill: Optional[str]) -> Dict[str, SkillMastery]:
        out: Dict[str, SkillMastery] = {}
        try:
            from app.models.adaptive import StudentMastery
            q = db.query(StudentMastery).filter(
                StudentMastery.student_id == student_id)
            if skill:
                q = q.filter(StudentMastery.skill == skill)
            for row in q.all():
                sm = SkillMastery(
                    skill=row.skill,
                    subject=row.subject or "",
                    topic=row.topic or "",
                    mastery=_coerce_float(row.mastery),
                    attempts=row.attempts or 0,
                    correct=row.correct or 0,
                    consecutive_wrong=row.consecutive_wrong or 0,
                    weak_concepts=list(row.weak_concepts or []),
                    strength_concepts=list(row.strength_concepts or []),
                    last_source="student_mastery",
                    last_confidence=0.8,
                    evidence_count=row.attempts or 0,
                )
                out[sm.skill] = sm
        except Exception:
            # tabla no creada aún → sin datos (no se inventa)
            pass
        return out

    def _load_learning_state(self, db: Session, student_id: int,
                             skill: Optional[str]) -> Optional[LS]:
        try:
            from app.models.adaptive import LearningState
            q = db.query(LearningState).filter(
                LearningState.student_id == student_id)
            if skill:
                q = q.filter(LearningState.skill == skill)
            row = q.order_by(LearningState.updated_at.desc()).first()
            if row is None:
                return None
            return LS(
                subject=row.subject or "",
                skill=row.skill or "",
                topic=row.topic or "",
                current_step=row.current_step or "",
                difficulty=row.difficulty or "medium",
                mastery=_coerce_float(row.mastery),
                last_activity=row.last_activity or "",
                last_result=row.last_result or "",
                detected_difficulty=row.detected_difficulty or "",
                next_recommended_action=row.next_recommended_action or "",
            )
        except Exception:
            return None

    def _load_memories(self, db: Session, student_id: int,
                       skill: Optional[str]) -> Tuple[List[str], List[str]]:
        episodic: List[str] = []
        semantic: List[str] = []
        try:
            from app.models.adaptive import StudentMemory
            q = db.query(StudentMemory).filter(
                StudentMemory.student_id == student_id,
                StudentMemory.memory_type.in_(("episodio", "semantica")),
            )
            if skill:
                q = q.filter(StudentMemory.skill == skill)
            for row in q.order_by(StudentMemory.event_ts.desc()).limit(12).all():
                content = (row.content or "").strip()
                if not content:
                    continue
                if row.memory_type == "semantica":
                    semantic.append(content)
                else:
                    episodic.append(content)
        except Exception:
            pass
        return episodic, semantic

    def _load_chat_metrics(self, db: Session, student_id: int,
                           skill: Optional[str]) -> Tuple[float, int]:
        try:
            from app.models.learning import CognitiveSessionState
            q = db.query(CognitiveSessionState).filter(
                CognitiveSessionState.user_id == student_id)
            if skill:
                q = q.filter(CognitiveSessionState.topic.ilike(f"%{skill}%"))
            rows = q.all()
            total_err = 0.0
            streak = 0
            for row in rows:
                answers = list(row.chat_answers or [])
                marked = [a.get("c") for a in answers if a.get("c") is not None]
                if marked:
                    total_err = max(total_err, sum(1 for c in marked if c == 0) / len(marked))
                streak = max(streak, row.error_streak or 0)
            return total_err, streak
        except Exception:
            return 0.0, 0

    # ═════════════════════════════════════════════════════════════════════
    # ACTUALIZACIÓN tras interacciones (se llama al final de /chat/message)
    # ═════════════════════════════════════════════════════════════════════
    def record_interaction(
        self,
        db: Session,
        student_id: int,
        subject: str,
        skill: str,
        topic: str,
        correct: Optional[bool],
        difficulty: str,
        weak_concepts: Optional[List[str]],
    ) -> None:
        """Actualiza student_mastery + learning_state a partir del resultado real."""
        # Aplicar en la misma transacción al final del request (no commit parcial)
        try:
            from app.models.adaptive import StudentMastery, LearningState as LSt

            row = db.query(StudentMastery).filter(
                StudentMastery.student_id == student_id,
                StudentMastery.skill == skill,
            ).first()
            if row is None:
                row = StudentMastery(
                    student_id=student_id,
                    subject=subject,
                    skill=skill,
                    topic=topic,
                    weak_concepts=[],
                    strength_concepts=[],
                )
                db.add(row)

            if correct is not None:
                row.attempts = (row.attempts or 0) + 1
                if correct:
                    row.correct = (row.correct or 0) + 1
                    row.consecutive_wrong = 0
                    if weak_concepts:
                        # avanzar fortalezas
                        for wc in weak_concepts:
                            if wc not in (row.strength_concepts or []):
                                row.strength_concepts = (row.strength_concepts or []) + [wc]
                        row.strength_concepts = (row.strength_concepts or [])[:6]
                else:
                    row.consecutive_wrong = (row.consecutive_wrong or 0) + 1
                    if weak_concepts:
                        for wc in weak_concepts:
                            if wc not in (row.weak_concepts or []):
                                row.weak_concepts = (row.weak_concepts or []) + [wc]
                        row.weak_concepts = (row.weak_concepts or [])[:8]

            # Mastery = aciertos reales / intentos reales (0 si aún no hay intentos)
            attempts = row.attempts or 0
            row.mastery = (row.correct or 0) / attempts if attempts > 0 else 0.0
            row.last_activity_at = datetime.utcnow()

            # Learning state (continuidad), por habilidad
            state = db.query(LSt).filter(
                LSt.student_id == student_id,
                LSt.skill == skill,
            ).first()
            if state is None:
                state = LSt(student_id=student_id, subject=subject, skill=skill)
                db.add(state)
            state.topic = topic
            state.difficulty = difficulty
            state.mastery = row.mastery
            state.last_result = "correct" if correct is True else \
                ("incorrect" if correct is False else state.last_result)
            state.last_activity = topic
            state.updated_at = datetime.utcnow()

            db.flush()
        except Exception:
            db.rollback()

    def generate_next_recommendation(
        self, engine, model: StudentModel, strategy: TeachingStrategy
    ) -> str:
        """Produce una recomendación legible de siguiente acción (continuidad)."""
        if strategy.repeat_explanation:
            return "Repetir la explicación del concepto con un enfoque distinto."
        if strategy.prior_recovery:
            return "Recuperar conocimientos previos y reforzar fundamentos."
        if strategy.reduce_difficulty:
            return "Reducir dificultad y proponer un ejercicio guiado."
        if strategy.increase_difficulty:
            return "Aumentar dificultad con un ejercicio de aplicación autónoma."
        if strategy.let_solve_alone:
            return "Dejar que el estudiante resuelva por sí solo y verificar."
        if strategy.propose_exercise:
            return "Proponer un ejercicio y verificar comprensión."
        return "Continuar la unidad y verificar comprensión."

    def save_episodic_memory(
        self, db: Session, student_id: int, subject: str, skill: str,
        content: str, source: str, importance: float = 0.5, confidence: float = 0.6,
        memory_type: str = "episodio",
    ) -> None:
        """Guarda un recuerdo de aprendizaje importante y auto-contenido."""
        try:
            from app.models.adaptive import StudentMemory
            db.add(StudentMemory(
                student_id=student_id,
                memory_type=memory_type,
                subject=subject,
                skill=skill,
                content=content,
                source=source,
                importance=max(0.0, min(1.0, importance)),
                confidence=max(0.0, min(1.0, confidence)),
                event_ts=datetime.utcnow(),
            ))
            db.flush()
        except Exception:
            db.rollback()