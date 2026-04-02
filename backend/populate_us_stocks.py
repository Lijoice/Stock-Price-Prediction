import yfinance as yf
from backend.database import SessionLocal, engine
from backend.models import Base, Stock
import time

def populate_us_stocks():
    # Ensure tables exist (they should, but safe)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # List of top US stocks across various sectors
    us_stocks = [
        # Technology
        ("AAPL", "Apple Inc.", "Technology", "Consumer Electronics", "NASDAQ"),
        ("MSFT", "Microsoft Corporation", "Technology", "Software—Infrastructure", "NASDAQ"),
        ("NVDA", "NVIDIA Corporation", "Technology", "Semiconductors", "NASDAQ"),
        ("AMD", "Advanced Micro Devices", "Technology", "Semiconductors", "NASDAQ"),
        ("CRM", "Salesforce, Inc.", "Technology", "Software—Application", "NYSE"),
        
        # Consumer Cyclical
        ("AMZN", "Amazon.com, Inc.", "Consumer Cyclical", "Internet Retail", "NASDAQ"),
        ("TSLA", "Tesla, Inc.", "Consumer Cyclical", "Auto Manufacturers", "NASDAQ"),
        ("HD", "The Home Depot, Inc.", "Consumer Cyclical", "Home Improvement Retail", "NYSE"),
        
        # Communication Services
        ("GOOGL", "Alphabet Inc.", "Communication Services", "Internet Content & Information", "NASDAQ"),
        ("META", "Meta Platforms, Inc.", "Communication Services", "Internet Content & Information", "NASDAQ"),
        ("NFLX", "Netflix, Inc.", "Communication Services", "Entertainment", "NASDAQ"),
        ("DIS", "The Walt Disney Company", "Communication Services", "Entertainment", "NYSE"),
        
        # Financial Services
        ("JPM", "JPMorgan Chase & Co.", "Financial Services", "Banks—Diversified", "NYSE"),
        ("V", "Visa Inc.", "Financial Services", "Credit Services", "NYSE"),
        ("MA", "Mastercard Incorporated", "Financial Services", "Credit Services", "NYSE"),
        
        # Healthcare
        ("JNJ", "Johnson & Johnson", "Healthcare", "Drug Manufacturers—General", "NYSE"),
        ("UNH", "UnitedHealth Group Inc.", "Healthcare", "Healthcare Plans", "NYSE"),
        ("PFE", "Pfizer Inc.", "Healthcare", "Drug Manufacturers—General", "NYSE"),
        
        # Energy
        ("XOM", "Exxon Mobil Corporation", "Energy", "Oil & Gas Integrated", "NYSE"),
        ("CVX", "Chevron Corporation", "Energy", "Oil & Gas Integrated", "NYSE"),
    ]
    
    print(f"Starting US stock population for {len(us_stocks)} stocks...")
    
    for ticker, name, sector, industry, exchange in us_stocks:
        try:
            # Check if stock already exists
            existing = db.query(Stock).filter(Stock.ticker == ticker).first()
            if existing:
                print(f"Updating {ticker}...")
                existing.name = name
                existing.sector = sector
                existing.industry = industry
                existing.exchange = exchange
            else:
                print(f"Adding {ticker}...")
                new_stock = Stock(
                    ticker=ticker,
                    name=name,
                    sector=sector,
                    industry=industry,
                    exchange=exchange
                )
                db.add(new_stock)
            
            db.commit()
            
        except Exception as e:
            print(f"Error adding {ticker}: {e}")
            db.rollback()
            
    db.close()
    print("US stock population complete.")

if __name__ == "__main__":
    populate_us_stocks()
