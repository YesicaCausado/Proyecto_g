"""
NeuroLearn IA — Borrado definitivo de usuarios e instituciones.

Antes cada endpoint mantenía a mano la lista de tablas a limpiar. La lista
quedaba desactualizada al crear tablas nuevas (notificaciones,
consentimientos, evaluaciones, progreso de NeuroBots…) y en PostgreSQL el
borrado fallaba con una violación de clave foránea (500); además citaba
tablas retiradas (`classroom_users`) que ya no existen en bases nuevas.

Aquí las dependencias se leen de las claves foráneas REALES de la base de
datos (reflexión), así que cubren también tablas heredadas que solo existan
en producción. Para cada fila que apunta a otra que se borra:

  - Se respeta el `ondelete` declarado (SET NULL / CASCADE).
  - Columnas de «autoría» (quién creó, asignó, calificó…) se dejan en NULL
    si lo admiten: el registro pertenece a otra persona y se conserva.
  - El historial del estudiante se conserva aunque desaparezca el NeuroBot o
    el grupo (`learning_sessions.bot_id`, `conversations.bot_id`,
    `quiz_history.classroom_id` → NULL).
  - Los usuarios de una institución borrada se borran con ella (aunque la FK
    sea SET NULL): no deben quedar cuentas huérfanas que puedan entrar.
  - Todo lo demás se borra en cascada.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, Iterable, List, Set, Tuple

from sqlalchemy import MetaData, Table, select, update
from sqlalchemy.orm import Session

# Columnas que referencian a un usuario como autor/actor, no como dueño.
ACTOR_COLUMNS = {
    "created_by", "created_by_id", "assigned_by_id", "assigned_to_id",
    "removed_by", "graded_by_id", "uploaded_by_id", "performed_by_id",
    "target_user_id",
}

# Referencias que se anulan (y no se borran) para conservar el historial.
KEEP_WITH_NULL = {
    ("learning_sessions", "bot_id"),
    ("conversations", "bot_id"),
    ("quiz_history", "classroom_id"),
    # Tabla heredada: puntero al último mensaje, no dueño de la conversación.
    ("user_conversations", "last_message_id"),
}

# Se borran en cascada aunque la FK declare SET NULL.
ALWAYS_DELETE = {
    ("users", "institution_id"),
}

_CHUNK = 500


def _chunks(values: Iterable[int]) -> Iterable[List[int]]:
    items = list(values)
    for start in range(0, len(items), _CHUNK):
        yield items[start:start + _CHUNK]


def _single_pk(table: Table):
    cols = list(table.primary_key.columns)
    return cols[0] if len(cols) == 1 else None


def purge(db: Session, root_table: str, ids: Iterable[int]) -> None:
    """Borra las filas `ids` de `root_table` y todo lo que dependa de ellas.

    No hace commit: el llamador decide (y hace rollback si algo falla).
    """
    ids = {int(i) for i in ids}
    if not ids:
        return

    metadata = MetaData()
    metadata.reflect(bind=db.connection())
    tables = metadata.tables

    # FKs de una sola columna hacia la PK del padre: (hijo, columna, padre, ondelete).
    refs: Dict[str, List[Tuple[Table, object, str]]] = defaultdict(list)
    for table in tables.values():
        for fk in table.foreign_keys:
            refs[fk.column.table.name].append((table, fk.parent, (fk.ondelete or "").upper()))

    to_delete: Dict[str, Set[int]] = defaultdict(set)
    # Filas sin PK simple (tablas de unión heredadas): se borran por condición.
    conditional_deletes: List[Tuple[Table, object, List[int]]] = []
    nullify: List[Tuple[Table, object, List[int]]] = []

    to_delete[root_table] |= ids
    queue: List[Tuple[str, Set[int]]] = [(root_table, ids)]
    while queue:
        parent, parent_ids = queue.pop()
        for child, column, ondelete in refs.get(parent, []):
            keep = (
                column.nullable
                and (child.name, column.name) not in ALWAYS_DELETE
                and (
                    ondelete == "SET NULL"
                    or (child.name, column.name) in KEEP_WITH_NULL
                    or (parent == "users" and column.name in ACTOR_COLUMNS)
                )
            )
            if keep:
                nullify.append((child, column, list(parent_ids)))
                continue
            pk = _single_pk(child)
            if pk is None:
                conditional_deletes.append((child, column, list(parent_ids)))
                continue
            found: Set[int] = set()
            for chunk in _chunks(parent_ids):
                found |= {row[0] for row in db.execute(select(pk).where(column.in_(chunk)))}
            new = found - to_delete[child.name]
            if new:
                to_delete[child.name] |= new
                queue.append((child.name, new))

    for child, column, parent_ids in nullify:
        for chunk in _chunks(parent_ids):
            db.execute(update(child).where(column.in_(chunk)).values({column.name: None}))
    for child, column, parent_ids in conditional_deletes:
        for chunk in _chunks(parent_ids):
            db.execute(child.delete().where(column.in_(chunk)))

    # Hijos antes que padres. No se usa metadata.sorted_tables: users ↔
    # institutions forman un ciclo que solo se rompe porque la referencia
    # anulada (institutions.created_by) ya no cuenta.
    nullified = {(child.name, column.name) for child, column, _ in nullify}
    pending = {name for name, rows in to_delete.items() if rows}
    while pending:
        blocked = {
            fk.column.table.name
            for name in pending
            for fk in tables[name].foreign_keys
            if fk.column.table.name != name
            and fk.column.table.name in pending
            and (name, fk.parent.name) not in nullified
        }
        ready = (pending - blocked) or pending  # ciclo real: se intenta igual
        for name in sorted(ready):
            pk = _single_pk(tables[name])
            for chunk in _chunks(to_delete[name]):
                db.execute(tables[name].delete().where(pk.in_(chunk)))
        pending -= ready
