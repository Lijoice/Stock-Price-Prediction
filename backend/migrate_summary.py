
import sqlite3
import os

db_path = "e:/Stock price prediction/stock_app.db"

def migrate():
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        print("Checking for missing columns...")
        
        # Check if columns exist
        cursor.execute("PRAGMA table_info(stocks)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "latest_summary" not in columns:
            print("Adding 'latest_summary' column to 'stocks' table...")
            cursor.execute("ALTER TABLE stocks ADD COLUMN latest_summary TEXT")
        else:
            print("'latest_summary' already exists.")
            
        if "summary_impact" not in columns:
            print("Adding 'summary_impact' column to 'stocks' table...")
            cursor.execute("ALTER TABLE stocks ADD COLUMN summary_impact TEXT")
        else:
            print("'summary_impact' already exists.")
            
        conn.commit()
        print("Migration completed successfully.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    migrate()
