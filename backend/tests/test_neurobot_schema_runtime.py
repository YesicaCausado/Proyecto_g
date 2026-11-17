"""Reparación de columnas runtime requeridas por las asignaciones de NeuroBots."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import tests.entorno_pruebas  # noqa: E402,F401

from app.main import app  # noqa: E402,F401
from app.db.database import Base  # noqa: E402
from app.db.migrate import REQUIRED_INDEXES, prepare_postgres_schema  # noqa: E402


class _Result(list):
    pass


class _Connection:
    def __init__(self, missing_columns, statements):
        self.missing_columns = missing_columns
        self.statements = statements

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query):
        sql = str(query)
        self.statements.append(sql)
        if "FROM information_schema.tables" in sql:
            return _Result((name,) for name in Base.metadata.tables)
        if "FROM information_schema.columns" in sql:
            return _Result(
                (table.name, column.name)
                for table in Base.metadata.tables.values()
                for column in table.columns
                if (table.name, column.name) not in self.missing_columns
            )
        if "FROM pg_index" in sql:
            return _Result((name, True) for name, _, _ in REQUIRED_INDEXES)
        return _Result()


class _PostgresEngine:
    class dialect:
        name = "postgresql"

    def __init__(self, missing_columns, statements):
        self.connection = _Connection(missing_columns, statements)

    def connect(self):
        return self.connection

    def begin(self):
        return self.connection


def test_prepare_postgres_schema_adds_missing_neurobot_columns():
    missing_columns = {
        ("classroom_bots", "goal_interactions"),
        ("classroom_bots", "assigned_by_id"),
    }
    statements = []

    prepare_postgres_schema(_PostgresEngine(missing_columns, statements))

    assert any(
        "classroom_bots ADD COLUMN IF NOT EXISTS goal_interactions INTEGER" in sql
        for sql in statements
    )
    assert any(
        "classroom_bots ADD COLUMN IF NOT EXISTS assigned_by_id INTEGER REFERENCES users(id)" in sql
        for sql in statements
    )
