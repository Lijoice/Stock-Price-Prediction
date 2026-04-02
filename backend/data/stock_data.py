import yfinance as yf
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import Stock, StockPrice
from ..database import SessionLocal
import pandas as pd

def fetch_and_store_stock_data(ticker: str, period: str = "1y"):
    """
    Fetches stock data from Yahoo Finance and stores it in the database.
    """
    # We'll try to fetch as is first, unless it's obviously a malformed ticker.
    # We will handle normalization inside the fetching logic if empty.
    original_ticker = ticker.upper()
    print(f"Fetching data for {original_ticker}...")
    stock_data = yf.Ticker(original_ticker)
    hist = stock_data.history(period=period)

    # If empty, try to normalize for Indian stocks (e.g., RELIANCE -> RELIANCE.NS)
    if hist.empty and not any(suffix in original_ticker for suffix in [".NS", ".BO", "=", "^", "-"]):
        if len(original_ticker) >= 3 and original_ticker.isalpha():
            normalized_ticker = original_ticker + ".NS"
            print(f"No data for {original_ticker}, trying normalized: {normalized_ticker}")
            stock_data = yf.Ticker(normalized_ticker)
            hist = stock_data.history(period=period)
            if not hist.empty:
                ticker = normalized_ticker
            else:
                # Try .BO as last resort for Indian stocks
                normalized_ticker = original_ticker + ".BO"
                print(f"No data for .NS, trying .BO: {normalized_ticker}")
                stock_data = yf.Ticker(normalized_ticker)
                hist = stock_data.history(period=period)
                if not hist.empty:
                    ticker = normalized_ticker
    else:
        ticker = original_ticker
    
    if hist.empty:
        print(f"No data found for {ticker}")
        return None

    db: Session = SessionLocal()
    
    try:
        # Check if stock exists
        stock = db.query(Stock).filter(Stock.ticker == ticker).first()
        if not stock:
            # Try to get info from yf
            si = stock_data.info
            name = si.get('longName', ticker)
            exchange = si.get('exchange', 'UNKNOWN')
            sector = si.get('sector', 'Unknown')
            industry = si.get('industry', 'Unknown')
            
            # Use nested try for atomic insertion
            try:
                stock = Stock(ticker=ticker, name=name, exchange=exchange, sector=sector, industry=industry)
                db.add(stock)
                db.commit()
                db.refresh(stock)
            except Exception as inner_e:
                db.rollback()
                # Re-query in case it was created by another thread
                stock = db.query(Stock).filter(Stock.ticker == ticker).first()
                if not stock:
                    raise inner_e 
        
        # Update sector/industry if missing for existing stock
        if not stock.sector or not stock.industry:
            si = stock_data.info
            stock.sector = si.get('sector', 'Unknown')
            stock.industry = si.get('industry', 'Unknown')
            db.commit()
        
        # Store prices
        for date, row in hist.iterrows():
            # Skip if any essential price is NaN
            if pd.isna(row['Open']) or pd.isna(row['High']) or pd.isna(row['Low']) or pd.isna(row['Close']):
                continue
                
            # Check if price exists for this date
            try:
                # Normalize date to date object
                if hasattr(date, 'date'):
                    price_date = date.date()
                else:
                    price_date = pd.to_datetime(date).date()
                    
                existing_price = db.query(StockPrice).filter(
                    StockPrice.stock_id == stock.id,
                    StockPrice.date == price_date
                ).first()
                
                if not existing_price:
                    new_price = StockPrice(
                        stock_id=stock.id,
                        date=price_date,
                        open=float(row['Open']),
                        high=float(row['High']),
                        low=float(row['Low']),
                        close=float(row['Close']),
                        volume=int(row['Volume'])
                    )
                    db.add(new_price)
            except Exception as e:
                print(f"Error processing row for {date}: {e}")
                continue
        
        db.commit()
        print(f"Successfully stored data for {ticker}")
        return hist
        
    except Exception as e:
        print(f"Error storing data: {e}")
        db.rollback()
        return None
    finally:
        db.close()

if __name__ == "__main__":
    # Test
    fetch_and_store_stock_data("AAPL", period="1mo")
    fetch_and_store_stock_data("RELIANCE.NS", period="1mo")
