"""Persistencia privada del progreso del tutorial guiado."""
from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.auth import get_current_user
from app.db.database import get_db
from app.models.user import User

TutorialRole = Literal["admin", "super_profesor", "profesor", "estudiante"]

router = APIRouter(tags=["Tutorial"])


class TutorialStateUpdate(BaseModel):
    role: TutorialRole
    step: int = Field(ge=0, le=50)
    completed: Optional[bool] = None


@router.get("/tutorial/state")
def get_tutorial_state(current_user: User = Depends(get_current_user)):
    return {
        "completed": current_user.tutorial_completed,
        "role": current_user.tutorial_role,
        "step": current_user.tutorial_step,
    }


@router.put("/tutorial/state")
def update_tutorial_state(
    payload: TutorialStateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.role != current_user.role:
        raise HTTPException(status_code=400, detail="El rol no coincide con la sesión actual.")

    current_user.tutorial_role = payload.role
    current_user.tutorial_step = payload.step
    if payload.completed is not None:
        current_user.tutorial_completed = payload.completed

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return {
        "completed": current_user.tutorial_completed,
        "role": current_user.tutorial_role,
        "step": current_user.tutorial_step,
    }
