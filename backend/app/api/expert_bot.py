"""
NeuroLearn AI - API de Bot Experto
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Optional, List

from app.db.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.expert_bot import ExpertBot, BotTrainingData
from app.schemas.schemas import (
    ExpertBotCreate,
    ExpertBotResponse,
    BotPersonalityConfig,
    BotStepCreate,
    BotWarningCreate,
    BotScenarioCreate,
    BotQACreate,
    BotListResponse,
)
from app.ai.expert_bot.trainer import ExpertBotTrainer

router = APIRouter(prefix="/bots", tags=["Bot Experto"])

# Almacén de entrenamientos activos (en producción usar Redis)
active_trainers: Dict[int, ExpertBotTrainer] = {}


@router.post("/create", response_model=ExpertBotResponse, status_code=status.HTTP_201_CREATED)
async def create_bot(
    request: ExpertBotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Crea un nuevo bot experto e inicia el proceso de entrenamiento"""
    # Crear bot en la base de datos
    bot = ExpertBot(
        creator_id=current_user.id,
        name=request.name,
        description=request.description,
        category=request.category,
    )
    db.add(bot)
    db.commit()
    db.refresh(bot)
    
    # Iniciar entrenador
    trainer = ExpertBotTrainer()
    trainer.start_training(
        name=request.name,
        description=request.description,
        category=request.category,
        creator_id=current_user.id,
    )
    active_trainers[bot.id] = trainer
    
    return ExpertBotResponse(
        id=bot.id,
        name=bot.name,
        description=bot.description,
        category=bot.category,
        creator_id=bot.creator_id,
        is_public=bot.is_public,
        is_active=bot.is_active,
        total_users=bot.total_users,
        avg_rating=bot.avg_rating,
        total_sessions=bot.total_sessions,
        created_at=bot.created_at,
        personality={},
        knowledge_summary={"status": "training"},
    )


@router.post("/{bot_id}/personality")
async def set_bot_personality(
    bot_id: int,
    config: BotPersonalityConfig,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Configura la personalidad del bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    result = trainer.set_personality(
        teaching_style=config.teaching_style,
        verbosity=config.verbosity,
        use_examples=config.use_examples,
        use_analogies=config.use_analogies,
    )
    
    # Actualizar en BD
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if bot:
        bot.personality = {
            "teaching_style": config.teaching_style,
            "verbosity": config.verbosity,
            "use_examples": config.use_examples,
            "use_analogies": config.use_analogies,
        }
        db.commit()
    
    return result


@router.post("/{bot_id}/steps")
async def add_bot_step(
    bot_id: int,
    step: BotStepCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Añade un paso al proceso del bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    result = trainer.add_step(
        title=step.title,
        description=step.description,
        details=step.details,
        is_critical=step.is_critical,
        common_errors=step.common_errors,
        tips=step.tips,
    )
    
    # Guardar en BD
    training_data = BotTrainingData(
        bot_id=bot_id,
        data_type="step",
        content={
            "title": step.title,
            "description": step.description,
            "details": step.details,
            "common_errors": step.common_errors,
            "tips": step.tips,
        },
        order_index=result["step_count"],
        is_critical=step.is_critical,
    )
    db.add(training_data)
    db.commit()
    
    return result


@router.post("/{bot_id}/warnings")
async def add_bot_warning(
    bot_id: int,
    warning: BotWarningCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Añade una advertencia al bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    result = trainer.add_warning(
        message=warning.message,
        severity=warning.severity,
        when_to_show=warning.when_to_show,
        related_steps=warning.related_steps,
    )
    
    training_data = BotTrainingData(
        bot_id=bot_id,
        data_type="warning",
        content={"message": warning.message, "severity": warning.severity},
        is_critical=warning.severity in ["high", "critical"],
    )
    db.add(training_data)
    db.commit()
    
    return result


@router.post("/{bot_id}/rules")
async def add_bot_rule(
    bot_id: int,
    rule: Dict,
    current_user: User = Depends(get_current_user),
):
    """Añade una regla operativa al bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    return trainer.add_rule(rule.get("rule", ""))


@router.post("/{bot_id}/tips")
async def add_bot_tip(
    bot_id: int,
    tip: Dict,
    current_user: User = Depends(get_current_user),
):
    """Añade una recomendación práctica al bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    return trainer.add_tip(tip.get("tip", ""))


@router.post("/{bot_id}/scenarios")
async def add_bot_scenario(
    bot_id: int,
    scenario: BotScenarioCreate,
    current_user: User = Depends(get_current_user),
):
    """Añade un escenario de simulación al bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    return trainer.add_scenario(
        title=scenario.title,
        description=scenario.description,
        initial_situation=scenario.initial_situation,
        expected_actions=scenario.expected_actions,
        correct_outcome=scenario.correct_outcome,
        common_mistakes=scenario.common_mistakes,
        difficulty=scenario.difficulty,
    )


@router.post("/{bot_id}/qa")
async def add_bot_qa(
    bot_id: int,
    qa: BotQACreate,
    current_user: User = Depends(get_current_user),
):
    """Añade un par de pregunta/respuesta al bot"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    return trainer.add_qa_pair(
        question=qa.question,
        answer=qa.answer,
        category=qa.category,
        difficulty=qa.difficulty,
    )


@router.get("/{bot_id}/review")
async def review_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
):
    """Obtiene la revisión del bot en entrenamiento"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    return trainer.get_review()


@router.post("/{bot_id}/finalize")
async def finalize_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finaliza el entrenamiento del bot y lo marca como activo"""
    trainer = active_trainers.get(bot_id)
    if not trainer:
        raise HTTPException(status_code=404, detail="Bot no encontrado en entrenamiento")
    
    result = trainer.finalize()
    
    # Actualizar bot en BD
    bot = db.query(ExpertBot).filter(ExpertBot.id == bot_id).first()
    if bot:
        bot.knowledge_base = result["bot_config"]["knowledge_base"]
        bot.system_prompt = str(result["bot_config"]["knowledge_base"])
        bot.is_active = True
        db.commit()
    
    # Limpiar entrenador
    active_trainers.pop(bot_id, None)
    
    return result


@router.get("/public", response_model=BotListResponse)
async def list_public_bots(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Lista los bots públicos disponibles"""
    query = db.query(ExpertBot).filter(
        ExpertBot.is_public == True,
        ExpertBot.is_active == True,
    )
    if category:
        query = query.filter(ExpertBot.category == category)
    
    bots = query.all()
    
    bot_responses = []
    for bot in bots:
        bot_responses.append(ExpertBotResponse(
            id=bot.id,
            name=bot.name,
            description=bot.description,
            category=bot.category,
            creator_id=bot.creator_id,
            is_public=bot.is_public,
            is_active=bot.is_active,
            total_users=bot.total_users,
            avg_rating=bot.avg_rating,
            total_sessions=bot.total_sessions,
            created_at=bot.created_at,
        ))
    
    return BotListResponse(bots=bot_responses, total=len(bot_responses))


@router.post("/{bot_id}/publish")
async def publish_bot(
    bot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Publica un bot para que otros usuarios lo puedan usar"""
    bot = db.query(ExpertBot).filter(
        ExpertBot.id == bot_id,
        ExpertBot.creator_id == current_user.id,
    ).first()
    
    if not bot:
        raise HTTPException(status_code=404, detail="Bot no encontrado")
    
    bot.is_public = True
    db.commit()
    
    return {"message": f"Bot '{bot.name}' publicado exitosamente"}


@router.get("/my-bots")
async def list_my_bots(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Lista los bots creados por el usuario actual"""
    bots = db.query(ExpertBot).filter(
        ExpertBot.creator_id == current_user.id
    ).all()
    
    return {
        "bots": [
            {
                "id": bot.id,
                "name": bot.name,
                "description": bot.description,
                "category": bot.category,
                "is_public": bot.is_public,
                "total_users": bot.total_users,
                "created_at": bot.created_at.isoformat(),
            }
            for bot in bots
        ],
        "total": len(bots),
    }
