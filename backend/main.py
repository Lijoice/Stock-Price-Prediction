from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from .ml.pipeline import MLPipeline
from .data.stock_data import fetch_and_store_stock_data
from .data.twitter_data import fetch_twitter_sentiment
from .data.news_data import fetch_news_sentiment
from .database import SessionLocal
from .models import Stock, StockPrice, Sentiment, User, Prediction
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

app = FastAPI(title="Stock Price Prediction & Recommendation API")

origins = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Welcome to the Stock Prediction API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/update-data/{ticker}")
async def update_data(ticker: str, background_tasks: BackgroundTasks):
    """
    Trigger background data update for a ticker.
    """
    def run_update(t):
        print(f"Updating data for {t}")
        fetch_and_store_stock_data(t)
        fetch_twitter_sentiment(t)
        fetch_news_sentiment(t)
        print(f"Data update for {t} complete")
        
    background_tasks.add_task(run_update, ticker)
    return {"message": f"Data update for {ticker} started in background"}

@app.get("/predict/{ticker}")
def predict(ticker: str, force: bool = False, db: Session = Depends(get_db)):
    from .models import Stock, StockPrice, Prediction
    ticker = ticker.upper()
    
    try:
        # Get stock ID
        stock = db.query(Stock).filter(Stock.ticker == ticker).first()
        if not stock:
            # Create stock entry if not exists
            stock = Stock(ticker=ticker, name=ticker)
            db.add(stock)
            db.commit()
            db.refresh(stock)

        # Check cache if not force
        today = datetime.now().date()
        cached = db.query(Prediction).filter(
            Prediction.stock_id == stock.id,
            Prediction.prediction_date == today
        ).all()

        if cached:
            print(f"Using cached predictions for {ticker}")
            # Group by model type
            models_data = {}
            dates_set = set()
            for p in cached:
                if p.model_type not in models_data:
                    models_data[p.model_type] = []
                # Ensure we store (date, price) to sort later
                models_data[p.model_type].append((p.target_date.strftime('%Y-%m-%d'), p.predicted_price))
                dates_set.add(p.target_date.strftime('%Y-%m-%d'))
            
            # Sort dates and prices
            sorted_dates = sorted(list(dates_set))
            
            # --- Recuperate Metrics for Cache ---
            # If metrics are missing from cache (as in old records), provide defaults or calculate once
            metrics = {}
            for m_type in ["Arima", "Lstm", "Lr", "Xgb", "Trans"]:
                metrics[f"{m_type.lower()}_rmse"] = -1.0 # Default
            
            # Re-calculate recommendation from ensemble if possible
            result = {
                "dates": sorted_dates, 
                "metrics": metrics,
                **{m.lower(): [it[1] for it in items] for m, items in models_data.items()}
            }

            # Get latest close for recommendation
            latest_price = db.query(StockPrice).filter(StockPrice.stock_id == stock.id).order_by(StockPrice.date.desc()).first()
            last_close = latest_price.close if latest_price else 0
            
            ensemble_line = result.get('ensemble', [])
            avg_pred = sum(ensemble_line) / len(ensemble_line) if ensemble_line else last_close
            
            recommendation = "NEUTRAL"
            if avg_pred > last_close * 1.01: recommendation = "BUY"
            elif avg_pred < last_close * 0.99: recommendation = "SELL"
            
            # Ensure latest_trend is populated for sentiment context if missing
            if stock.latest_trend is None and ensemble_line:
                roi = ((avg_pred - last_close) / last_close * 100) if last_close > 0 else 0
                stock.latest_trend = float(roi)
                db.commit()

            import json
            pros = json.loads(stock.latest_pros) if stock.latest_pros else []
            cons = json.loads(stock.latest_cons) if stock.latest_cons else []
            
            return {
                "ticker": ticker,
                "recommendation": recommendation,
                "current_price": last_close,
                "predictions": result,
                "pros_cons": {
                    "pros": pros,
                    "cons": cons
                },
                "cached": True
            }

        # No cache, run pipeline
        pipeline = MLPipeline(ticker)
        try:
            # Check if we have enough data, if not try to fetch
            try:
                 pipeline.get_data()
            except ValueError:
                 # If no data, try to fetch
                 data = fetch_and_store_stock_data(ticker)
                 if data is None:
                     raise HTTPException(status_code=404, detail=f"Stock data for {ticker} could not be found or fetched. Please ensure the ticker symbol is correct (e.g., RELIANCE.NS for NSE).")
            
            result = pipeline.run()
            pipeline.save_predictions(result)

            # Calculate recommendation
            data = pipeline.get_data()
            last_close = data.iloc[-1]['Close']
            avg_pred = sum(result['ensemble']) / len(result['ensemble'])
            
            recommendation = "NEUTRAL"
            if avg_pred > last_close * 1.01: recommendation = "BUY"
            elif avg_pred < last_close * 0.99: recommendation = "SELL"
                
            # Calculate ROI for sentiment anchoring
            roi = ((avg_pred - last_close) / last_close * 100) if last_close > 0 else 0
            trend_str = f"{'Bullish' if roi > 1 else 'Bearish' if roi < -1 else 'Neutral'} ({roi:+.2f}% 7d forecast)"
            
            # Store trend for other endpoints
            stock.latest_trend = float(roi)
            db.flush()

            # Sync Refresh Sentiment with Context
            pc_data = fetch_news_sentiment(ticker, trend_context=trend_str)
            
            pros_cons = pc_data.get("pros_cons", {"pros": [], "cons": []}) if pc_data else {"pros": [], "cons": []}

            return {
                "ticker": ticker,
                "recommendation": recommendation,
                "current_price": last_close,
                "predictions": result,
                "pros_cons": pros_cons,
                "cached": False
            }
        finally:
            pipeline.close()
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Prediction Error for {ticker}: {e}")
        if "No price data found" in str(e) or "Insufficient data" in str(e):
             raise HTTPException(status_code=400, detail=f"Insufficient historical data for {ticker} to generate a reliable prediction.")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{ticker}")
def get_history(ticker: str, days: int = 365, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.ticker == ticker.upper()).first()
    
    # Check if we have prices. If not or too few, try to fetch.
    price_count = 0
    if stock:
        price_count = db.query(StockPrice).filter(StockPrice.stock_id == stock.id).count()

    if not stock or price_count < 10:
        print(f"Data missing for {ticker}, fetching...")
        fetch_and_store_stock_data(ticker)
        stock = db.query(Stock).filter(Stock.ticker == ticker.upper()).first()
        if not stock:
             raise HTTPException(status_code=404, detail="Stock not found")
        
    start_date = datetime.now().date() - timedelta(days=days)
    prices = db.query(StockPrice).filter(
        StockPrice.stock_id == stock.id,
        StockPrice.date >= start_date
    ).order_by(StockPrice.date).all()
    
    data = [{
        "date": str(p.date), # Ensure it's a string
        "open": p.open,
        "high": p.high,
        "low": p.low,
        "close": p.close,
        "volume": p.volume
    } for p in prices]
    
    return data

@app.get("/quotes")
def get_quotes(symbols: str):
    import yfinance as yf
    tickers = [s.strip() for s in symbols.split(",") if s.strip()]
    results = []
    for ticker in tickers:
        try:
            stock = yf.Ticker(ticker)
            hist = stock.history(period="5d") # Fetch slightly more to guarantee previous day
            if hist.empty:
                continue
            last_row = hist.iloc[-1]
            prev_row = hist.iloc[-2] if len(hist) > 1 else last_row
            
            close_price = float(last_row['Close'])
            prev_close = float(prev_row['Close'])
            change = close_price - prev_close
            change_percent = (change / prev_close) * 100 if prev_close != 0 else 0
            
            results.append({
                "symbol": ticker,
                "value": close_price,
                "change": change,
                "changePercent": change_percent,
                "open": float(last_row['Open']),
                "high": float(last_row['High']),
                "low": float(last_row['Low']),
                "prev": prev_close
            })
        except Exception as e:
            print(f"Error fetching quote for {ticker}: {e}")
            pass
    return results

@app.get("/sentiment/{ticker}")
def get_sentiment(ticker: str, force: bool = False, background_tasks: BackgroundTasks = None, db: Session = Depends(get_db)):
    stock = db.query(Stock).filter(Stock.ticker == ticker.upper()).first()
    if not stock:
        # Try a quick fetch of stock info at least
        fetch_and_store_stock_data(ticker)
        stock = db.query(Stock).filter(Stock.ticker == ticker.upper()).first()
        if not stock:
            raise HTTPException(status_code=404, detail="Stock not found")
        
    # Get last 7 days sentiment
    seven_days_ago = datetime.now().date() - timedelta(days=7)
    sentiments = db.query(Sentiment).filter(
        Sentiment.stock_id == stock.id,
        Sentiment.date >= seven_days_ago
    ).order_by(Sentiment.id.desc()).limit(10).all()
    
    # If no summary or stale placeholder OR forced, fetch news
    if force or not stock.latest_summary or stock.latest_summary in [
        "No summary available yet.", 
        "Analyzing latest market signals...",
        "Error generating analysis summary."
    ]:
        print(f"Refreshing news/sentiment for {ticker} (Force={force})...")
        try:
            # Use latest_trend for context if available
            trend_str = None
            roi = stock.latest_trend
            
            # If roi is missing, try to quickly calculate from DB predictions
            if roi is None:
                today = datetime.now().date()
                latest_preds = db.query(Prediction).filter(
                    Prediction.stock_id == stock.id,
                    Prediction.prediction_date == today,
                    Prediction.model_type == 'Ensemble'
                ).all()
                if latest_preds:
                    avg_pred = sum([p.predicted_price for p in latest_preds]) / len(latest_preds)
                    latest_price = db.query(StockPrice).filter(StockPrice.stock_id == stock.id).order_by(StockPrice.date.desc()).first()
                    if latest_price:
                        roi = ((avg_pred - latest_price.close) / latest_price.close * 100)
                        stock.latest_trend = roi
                        db.commit()

            if roi is not None:
                trend_str = f"{'Bullish' if roi > 1 else 'Bearish' if roi < -1 else 'Neutral'} ({roi:+.2f}% 7d forecast)"
            
            fetch_news_sentiment(ticker, trend_context=trend_str)
            # Refresh the stock and sentiments from DB after the sync fetch
            db.expire_all()
            stock = db.query(Stock).filter(Stock.ticker == ticker.upper()).first()
            sentiments = db.query(Sentiment).filter(
                Sentiment.stock_id == stock.id,
                Sentiment.date >= seven_days_ago
            ).all()
        except Exception as e:
            print(f"Sync news fetch failed: {e}")
        # Twitter is currently disabled due to API 403 restrictions in developer tier
        # background_tasks.add_task(fetch_twitter_sentiment, ticker)

    data = {
        "summary": stock.latest_summary or "No recent news found to analyze.",
        "impact": stock.summary_impact or "Neutral",
        "feed": [{
            "date": str(s.date),
            "source": s.source,
            "score": s.score,
            "magnitude": s.magnitude,
            "text": s.text,
            "url": s.url
        } for s in sentiments]
    }
    
    return data

@app.post("/auth/register")
def register(user_data: dict, db: Session = Depends(get_db)):
    from .models import User
    from .auth import get_password_hash, generate_otp
    
    email = user_data.get("email")
    password = user_data.get("password")
    
    if not email or not password:
         raise HTTPException(status_code=400, detail="Email and password required")
         
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pw = get_password_hash(password)
    otp = generate_otp()
    
    # Send real email
    from .auth import send_verification_email
    sent = send_verification_email(email, otp)
    
    if not sent:
        # Fallback print to terminal if SMTP not configured or failed
        print(f"========================================")
        print(f"VERIFICATION CODE for {email}: {otp}")
        print(f"========================================")
    else:
        print(f"Verification email sent to {email}")
    
    user = User(
        email=email, 
        hashed_password=hashed_pw,
        verification_code=otp,
        is_verified=True # Auto-verify for dev
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"message": "User registered. Please verify your email."}

@app.post("/auth/verify")
def verify_email(data: dict, db: Session = Depends(get_db)):
    from .models import User
    
    email = data.get("email")
    code = data.get("code")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    if user.is_verified:
        return {"message": "User already verified"}
        
    if user.verification_code != code:
        raise HTTPException(status_code=400, detail="Invalid verification code")
        
    user.is_verified = True
    user.verification_code = None # Clear code
    db.commit()
    
    return {"message": "Email verified successfully"}

@app.post("/auth/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    from .models import User
    from .auth import verify_password, create_access_token
    
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # if not user.is_verified:
    #     raise HTTPException(status_code=400, detail="Email not verified. Please verify your account.")
        
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

from .auth import get_current_user

@app.get("/watchlist")
def get_watchlist(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from .models import Watchlist
    watchlists = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).all()
    return [{"ticker": w.ticker, "added_date": w.added_date} for w in watchlists]

@app.post("/watchlist")
def add_to_watchlist(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from .models import Watchlist
    ticker = data.get("ticker")
    if not ticker:
        raise HTTPException(status_code=400, detail="Ticker required")
        
    ticker = ticker.upper()
    existing = db.query(Watchlist).filter(Watchlist.user_id == current_user.id, Watchlist.ticker == ticker).first()
    if existing:
        return {"message": "Already in watchlist"}
        
    new_item = Watchlist(user_id=current_user.id, ticker=ticker)
    db.add(new_item)
    db.commit()
    return {"message": f"{ticker} added to watchlist"}

@app.delete("/watchlist/{ticker}")
def remove_from_watchlist(ticker: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    from .models import Watchlist
    ticker = ticker.upper()
    item = db.query(Watchlist).filter(Watchlist.user_id == current_user.id, Watchlist.ticker == ticker).first()
    if not item:
        raise HTTPException(status_code=404, detail="Not found in watchlist")
        
    db.delete(item)
    db.commit()
    return {"message": f"{ticker} removed from watchlist"}

# --- Portfolio Simulation Endpoints ---

@app.get("/stocks/discovery")
def get_stock_discovery(market: str = "indian", db: Session = Depends(get_db)):
    """
    Groups stocks by sector and provides top picks based on AI recommendations.
    """
    if market == "us":
        stocks = db.query(Stock).filter(
            (Stock.exchange == "NASDAQ") | (Stock.exchange == "NYSE")
        ).all()
    else:
        # Filter for Indian stocks
        stocks = db.query(Stock).filter(
            (Stock.ticker.like("%.NS")) | (Stock.ticker.like("%.BO")) | (Stock.exchange == "NSE") | (Stock.exchange == "BSE")
        ).all()
    discovery_data = {}
    
    for stock in stocks:
        try:
            sector = str(stock.sector) if stock.sector and stock.sector != "Unknown" else "Other"
            
            # Manual Mapping for common "Unknown" Indian tickers
            if sector == "Other":
                if "SILVER" in stock.ticker: sector = "Commodities & ETFs"
                elif "GOLD" in stock.ticker: sector = "Commodities & ETFs"
                elif "NIFTY" in stock.ticker or stock.ticker.startswith("^"): sector = "Indices"
                elif stock.ticker.endswith(".NS") or stock.ticker.endswith(".BO"):
                     # Check industry as fallback
                     if stock.industry and stock.industry != "Unknown":
                          sector = stock.industry
            
            if sector not in discovery_data:
                discovery_data[sector] = []
                
            # Get latest price and latest ensemble prediction
            latest_price = db.query(StockPrice).filter(StockPrice.stock_id == stock.id).order_by(StockPrice.date.desc()).first()
            latest_pred = db.query(Prediction).filter(
                Prediction.stock_id == stock.id, 
                Prediction.model_type == "Ensemble"
            ).order_by(Prediction.prediction_date.desc()).first()
            
            # Robust value extraction
            try:
                c_price = float(latest_price.close) if latest_price and latest_price.close is not None else 0.0
            except:
                c_price = 0.0
                
            try:
                p_price = float(latest_pred.predicted_price) if latest_pred and latest_pred.predicted_price is not None else c_price
            except:
                p_price = c_price
                
            try:
                roi_val = ((p_price - c_price) / c_price * 100) if c_price > 0 else 0.0
            except:
                roi_val = 0.0
                
            # Final safety for rounding
            c_price = round(c_price, 2) if c_price is not None else 0.0
            p_price = round(p_price, 2) if p_price is not None else 0.0
            roi_val = round(roi_val, 2) if roi_val is not None else 0.0
            
            discovery_data[sector].append({
                "ticker": str(stock.ticker),
                "name": str(stock.name) if stock.name else str(stock.ticker),
                "industry": str(stock.industry) if stock.industry else "Unknown",
                "current_price": c_price,
                "predicted_price": p_price,
                "roi": roi_val,
                "impact": str(stock.summary_impact) if stock.summary_impact else "Neutral"
            })
        except Exception as e:
            print(f"Skipping {getattr(stock, 'ticker', 'unknown')} in discovery due to error: {e}")
            continue
        
    # Collect all tickers for batch price data fetch (only for top 5 in each sector)
    all_top_tickers = []
    for sector in discovery_data:
        sector_stocks = sorted(discovery_data[sector], key=lambda x: x['roi'], reverse=True)[:5]
        all_top_tickers.extend([s['ticker'] for s in sector_stocks])
    
    # Batch fetch from yfinance for consistent Open/High/Low/Prev
    import yfinance as yf
    market_data = {}
    if all_top_tickers:
        try:
            # Fetch 2 days to get Previous Close
            data = yf.download(all_top_tickers, period="2d", group_by='ticker', progress=False)
            for ticker in all_top_tickers:
                try:
                    if len(all_top_tickers) > 1:
                        if ticker not in data.columns.levels[0]:
                            print(f"DEBUG: Ticker {ticker} not found in download results")
                            continue
                        t_data = data[ticker]
                    else:
                        t_data = data
                        
                    if not t_data.empty and len(t_data) >= 1:
                        last_row = t_data.iloc[-1]
                        prev_row = t_data.iloc[-2] if len(t_data) > 1 else last_row
                        
                        def safe_float(val, default=0.0):
                            try:
                                import math
                                f_val = float(val)
                                if math.isnan(f_val) or math.isinf(f_val):
                                    return default
                                return round(f_val, 2)
                            except:
                                return default

                        market_data[ticker] = {
                            "open": safe_float(last_row['Open']),
                            "high": safe_float(last_row['High']),
                            "low": safe_float(last_row['Low']),
                            "prev_close": safe_float(prev_row['Close']),
                            "change": safe_float(last_row['Close'] - prev_row['Close']),
                            "change_percent": safe_float((last_row['Close'] - prev_row['Close']) / prev_row['Close'] * 100) if prev_row['Close'] != 0 else 0.0
                        }
                except Exception as e:
                    print(f"DEBUG: Error extracting data for {ticker}: {e}")
                    continue
        except Exception as e:
            print(f"Error in batch download: {e}")

    # Finalize output with enriched metrics
    final_output = []
    for sector, items in discovery_data.items():
        if not items: continue
        try:
            sorted_items = sorted(items, key=lambda x: x.get('roi', 0), reverse=True)
            top_5 = sorted_items[:5]
            
            # Enrich with market data
            enriched_stocks = []
            for s in top_5:
                m = market_data.get(s['ticker'], {})
                s.update({
                    "open": m.get("open", s['current_price']),
                    "high": m.get("high", s['current_price']),
                    "low": m.get("low", s['current_price']),
                    "prev_close": m.get("prev_close", s['current_price']),
                    "change": m.get("change", 0.0),
                    "change_percent": m.get("change_percent", 0.0)
                })
                enriched_stocks.append(s)
            
            avg_roi = sum(item['roi'] for item in items) / len(items)
            mood = "Neutral"
            
            if avg_roi > 2.0: mood = "Very Bullish"
            elif avg_roi > 0.5: mood = "Bullish"
            elif avg_roi < -2.0: mood = "Very Bearish"
            elif avg_roi < -0.5: mood = "Bearish"
                
            final_output.append({
                "sector": sector,
                "stocks": enriched_stocks,
                "top_pick": enriched_stocks[0] if enriched_stocks else None,
                "avg_roi": round(avg_roi, 2),
                "mood": mood
            })
        except Exception as e:
            print(f"Error processing sector {sector}: {e}")
        
    return sorted(final_output, key=lambda x: x['sector'])
