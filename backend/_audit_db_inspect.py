"""Auxiliar temporal de auditoría: inspecciona la BD local."""
import sqlite3
import os
import sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
db_file = sys.argv[1] if len(sys.argv) > 1 else "neurolearn.db"
conn = sqlite3.connect(db_file)
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in cur.fetchall()]
print("TABLAS:", tables)
print()

if "users" in tables:
    cur.execute(
        "SELECT id, username, email, role, is_active, institution_id, "
        "must_change_password, full_name FROM users ORDER BY id"
    )
    rows = cur.fetchall()
    print(f"USERS ({len(rows)}):")
    for r in rows[:40]:
        print(dict(r))
    print()

if "institutions" in tables:
    cur.execute("SELECT * FROM institutions ORDER BY id")
    rows = cur.fetchall()
    print(f"INSTITUTIONS ({len(rows)}):")
    for r in rows[:20]:
        print({k: r[k] for k in r.keys()})
    print()

conn.close()
