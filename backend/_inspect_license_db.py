"""Inspección rápida: instituciones y estado de licencia en SQLite local."""
import sqlite3
import json

for db in ["backend/neurolearn.db", "backend/bots.db"]:
    try:
        con = sqlite3.connect(db)
        con.row_factory = sqlite3.Row
        cur = con.cursor()
        tables = [r[0] for r in cur.execute(
            "SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"=== {db} ===")
        print("tablas:", tables)

        if "institutions" in tables:
            cols = [d[1] for d in cur.execute("PRAGMA table_info(institutions)").fetchall()]
            print("institutions cols:", cols)
            rows = cur.execute("SELECT * FROM institutions").fetchall()
            for r in rows:
                print("  institution:", json.dumps({k: str(r[k]) for k in r.keys()}, ensure_ascii=False))

        if "users" in tables:
            rows = cur.execute(
                "SELECT id, username, email, role, institution_id, must_change_password FROM users"
            ).fetchall()
            for r in rows:
                print("  user:", json.dumps({k: r[k] for k in r.keys()}, ensure_ascii=False))
        con.close()
    except Exception as e:
        print(db, "ERROR:", e)
