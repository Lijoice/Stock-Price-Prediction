
import os
import sys

# Add the parent directory to sys.path so we can import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.data.stock_data import fetch_and_store_stock_data
from backend.database import SessionLocal
from backend.models import Stock, StockPrice

def test():
    ticker = "AAPL"
    print(f"Testing fetch_and_store_stock_data for {ticker}...")
    
    hist = fetch_and_store_stock_data(ticker, period="1mo")
    
    if hist is not None:
        print(f"Fetched {len(hist)} rows for {ticker}")
        
        # Check DB
        db = SessionLocal()
        stock = db.query(Stock).filter(Stock.ticker == ticker).first()
        if stock:
            prices = db.query(StockPrice).filter(StockPrice.stock_id == stock.id).count()
            print(f"Prices in DB for {ticker}: {prices}")
        else:
            print(f"Stock {ticker} still not in DB after fetch!")
        db.close()
    else:
        print(f"Failed to fetch data for {ticker}")

if __name__ == "__main__":
    test()
