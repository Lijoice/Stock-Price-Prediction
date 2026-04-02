import sqlite3
import os

db_path = "stock_app.db"
if not os.path.exists(db_path):
    print(f"DB not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE stocks ADD COLUMN latest_pros TEXT")
    print("Added latest_pros")
except sqlite3.OperationalError:
    print("latest_pros already exists")

try:
    cursor.execute("ALTER TABLE stocks ADD COLUMN latest_trend FLOAT")
    print("Added latest_trend")
except sqlite3.OperationalError:
    print("latest_trend already exists")

conn.commit()
conn.close()
print("Migration complete.")
