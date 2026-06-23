from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.user import User
from app.models.learning import QuizHistory, LearningSession
from app.api.auth import get_current_user

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    
    # 1. Total Exercises (sum of questions answered in quizzes)
    total_exercises = db.query(func.sum(QuizHistory.questions_count)).filter(
        QuizHistory.user_id == user_id
    ).scalar() or 0
    
    # 2. Total Class Sessions
    total_classes = db.query(LearningSession).filter(
        LearningSession.user_id == user_id
    ).count()
    
    # 3. Overall Progress (%)
    avg_performance = db.query(func.avg(QuizHistory.performance_score)).filter(
        QuizHistory.user_id == user_id,
        QuizHistory.performance_score != None
    ).scalar() or 0
    
    # 4. Total Study Time (hours)
    # Estimate based on learning sessions 
    # (Here we sum session time if added later, but for now we fallback to standard 1 hour per session approximation or use Quiz time spent if we had it populated always)
    total_study_time_seconds = db.query(func.sum(QuizHistory.time_spent_seconds)).filter(
        QuizHistory.user_id == user_id
    ).scalar() or 0
    total_study_hours = (total_study_time_seconds / 3600) + (total_classes * 0.5) 
    
    # 5. Active Skills (Topics attempted)
    active_skills_query = db.query(QuizHistory.topic).filter(
        QuizHistory.user_id == user_id
    ).distinct().all()
    active_skills_count = len(active_skills_query)
    
    return {
        "progress_percentage": int(avg_performance),
        "total_exercises": int(total_exercises),
        "total_classes": total_classes,
        "active_skills": active_skills_count,
        "study_hours": round(total_study_hours, 1)
    }
