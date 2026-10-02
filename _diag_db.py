import sqlite3

con = sqlite3.connect(r"backend/neurolearn.db")
cur = con.cursor()

try:
    rows = cur.execute(
        "SELECT id, username, role, is_active, substr(hashed_password,1,7), length(hashed_password) FROM users"
    ).fetchall()
    print("users:", len(rows))
    for r in rows[:15]:
        print(r)
except Exception as e:
    print("ERR users:", e)

tables = [t[0] for t in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
print("tables:", tables)
