
import sqlite3
import os

db_paths = [
    "e:/Stock price prediction/stock_app.db",
    "e:/Stock price prediction/backend/stock_app.db"
]

def migrate():
    for db_path in db_paths:
        if not os.path.exists(db_path):
            print(f"Database not found at {db_path}, skipping.")
            continue

        print(f"Migrating {db_path}...")
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Check if columns exist
            cursor.execute("PRAGMA table_info(stocks)")
            columns = [row[1] for row in cursor.fetchall()]
            
            if "latest_summary" not in columns:
                print("Adding 'latest_summary' column...")
                cursor.execute("ALTER TABLE stocks ADD COLUMN latest_summary TEXT")
            else:
                print("'latest_summary' already exists.")
                
            if "summary_impact" not in columns:
                print("Adding 'summary_impact' column...")
                cursor.execute("ALTER TABLE stocks ADD COLUMN summary_impact TEXT")
            else:
                print("'summary_impact' already exists.")
                
            conn.commit()
            print(f"Successfully migrated {db_path}")
            
        except Exception as e:
            print(f"Failed to migrate {db_path}: {e}")
        finally:
            if conn:
                conn.close()

if __name__ == "__main__":
    migrate()
