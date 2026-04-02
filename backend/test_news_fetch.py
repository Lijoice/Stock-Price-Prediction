
import os
import sys

# Add the parent directory to sys.path so we can import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.data.news_data import fetch_news_sentiment
from backend.database import SessionLocal
from backend.models import Stock

def test():
    ticker = "GOOGL"
    print(f"Testing fetch_news_sentiment for {ticker}...")
    
    # Ensure stock exists in DB
    db = SessionLocal()
    stock = db.query(Stock).filter(Stock.ticker == ticker).first()
    if not stock:
        print(f"Creating dummy stock record for {ticker}")
        stock = Stock(ticker=ticker, name="Alphabet Inc.", exchange="NASDAQ")
        db.add(stock)
        db.commit()
    db.close()
    
    fetch_news_sentiment(ticker)
    
    # Check if summary was updated
    db = SessionLocal()
    stock = db.query(Stock).filter(Stock.ticker == ticker).first()
    print(f"Latest Summary: {stock.latest_summary}")
    print(f"Summary Impact: {stock.summary_impact}")
    db.close()

if __name__ == "__main__":
    test()
