import sqlite3

for path in ['team_pulse/team_pulse.db', 'C:/Users/ELCOT/Desktop/teampulse/team_pulse.db']:
    try:
        conn = sqlite3.connect(path)
        cur = conn.cursor()
        tables = [row[0] for row in cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        print(f"=== DB: {path} ===")
        print("Tables:", tables)
        for t in tables:
            cur.execute(f"SELECT count(*) FROM {t}")
            cnt = cur.fetchone()[0]
            print(f"  {t}: {cnt} rows")
    except Exception as e:
        print(f"Error on {path}: {e}")
