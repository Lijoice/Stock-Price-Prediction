from backend.database import engine, Base
from backend.models import Stock, StockPrice, Sentiment, Prediction, User

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")

if __name__ == "__main__":
    init_db()
