"""Fechas de asignación mixtas (con y sin zona) no deben romper Mis NeuroBots."""
from __future__ import annotations

import os
import sys
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from app.services.neurobot_service import _assignments_for_students  # noqa: E402


def test_assignments_accept_aware_and_naive_datetimes():
    student_id = 17
    bot_id = 29
    classroom_assignment = SimpleNamespace(
        bot_id=bot_id,
        assigned_at=datetime(2026, 11, 16, 12),
        goal_interactions=10,
        assigned_by_id=3,
        is_required=False,
    )
    classroom = SimpleNamespace(id=5, name="Grupo", teacher_id=3)
    individual_assignment = SimpleNamespace(
        student_id=student_id,
        bot_id=bot_id,
        goal_interactions=4,
        teacher_id=3,
        assigned_at=datetime(2026, 11, 16, 10, tzinfo=timezone.utc),
    )

    classroom_query = MagicMock()
    classroom_query.join.return_value = classroom_query
    classroom_query.filter.return_value = classroom_query
    classroom_query.all.return_value = [(student_id, classroom_assignment, classroom)]
    individual_query = MagicMock()
    individual_query.filter.return_value = individual_query
    individual_query.all.return_value = [individual_assignment]
    db = MagicMock()
    db.query.side_effect = [classroom_query, individual_query]

    assignments = _assignments_for_students(db, [student_id])

    assert assignments[(student_id, bot_id)]["assigned_at"] == individual_assignment.assigned_at
