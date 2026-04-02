import yfinance as yf
import os
import sys

# Add backend to path to import models/database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.database import SessionLocal
from backend.models import Stock, StockPrice, Prediction
from backend.data.stock_data import fetch_and_store_stock_data
from backend.ml.pipeline import MLPipeline

NIFTY_30_TICKERS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS", "INFY.NS", 
    "BHARTIARTL.NS", "SBIN.NS", "ITC.NS", "HINDUNILVR.NS", "LT.NS", 
    "BAJFINANCE.NS", "KOTAKBANK.NS", "ADANIENT.NS", "AXISBANK.NS", 
    "ASIANPAINT.NS", "MARUTI.NS", "SUNPHARMA.NS", "TITAN.NS", 
    "ULTRACEMCO.NS", "TATASTEEL.NS", "NTPC.NS", "M&M.NS", "POWERGRID.NS", 
    "JSWSTEEL.NS", "ADANIPORTS.NS", "GRASIM.NS", "HCLTECH.NS", 
    "INDUSINDBK.NS", "ONGC.NS", "TATAMOTORS.NS"
]

def populate_nifty():
    print(f"Starting NIFTY population for {len(NIFTY_30_TICKERS)} stocks...")
    
    for ticker in NIFTY_30_TICKERS:
        try:
            print(f"\n--- Processing {ticker} ---")
            # 1. Fetch and store historical data
            hist = fetch_and_store_stock_data(ticker, period="1y")
            if hist is None or hist.empty:
                print(f"Failed to fetch data for {ticker}")
                continue
                
            # 2. Run prediction and SAVE to DB
            print(f"Generating Transformer-enhanced prediction for {ticker}...")
            pipeline = MLPipeline(ticker)
            result = pipeline.run()
            pipeline.save_predictions(result)
            pipeline.close()
            
        except Exception as e:
            print(f"Error processing {ticker}: {e}")
            continue
    
    print("\nNIFTY population complete!")

if __name__ == "__main__":
    populate_nifty()
