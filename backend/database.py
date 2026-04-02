from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

# Use absolute path for SQLite to avoid path ambiguity in different environments
try:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    ROOT_DIR = os.path.dirname(BASE_DIR)
    # Standardize to forward slashes for SQLAlchemy compatibility
    DB_PATH = os.path.join(ROOT_DIR, "stock_app_v2.db").replace("\\", "/")
    
    # Priority 1: Cloud-provided DATABASE_URL (for Postgres)
    # Priority 2: Generic .env DATABASE_URL
    # Priority 3: Default SQLite local path
    DATABASE_URL = os.getenv("DATABASE_URL")
    if not DATABASE_URL:
        DATABASE_URL = f"sqlite:///{DB_PATH}"
    
    # Render and Railway often provide "postgres://" urls, but SQLAlchemy requires "postgresql://"
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
        
    print(f"!!! USING DATABASE_URL: {DATABASE_URL} !!!")
except Exception as e:
    print(f"Error setting up DATABASE_URL: {e}")
    DATABASE_URL = "sqlite:///./stock_app_v2.db"

# Create Engine with specific args based on DB type
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False, "timeout": 30}
    )
else:
    # Postgres engine
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True, # Recommended for remote DBs to prevent 'Server has closed' errors
        pool_size=10,
        max_overflow=20
    )

# Enable WAL mode for better concurrency in SQLite
from sqlalchemy import event

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()  

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
