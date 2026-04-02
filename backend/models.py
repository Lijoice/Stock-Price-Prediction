from sqlalchemy import Column, Integer, String, Float, DateTime, Date, ForeignKey, Boolean, Enum
from sqlalchemy.orm import relationship
from .database import Base
from datetime import datetime

class Stock(Base):

    __tablename__ = "stocks"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, unique=True, index=True)
    name = Column(String)
    exchange = Column(String) # NSE, BSE, NASDAQ
    sector = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    latest_summary = Column(String, nullable=True)
    latest_pros = Column(String, nullable=True) # JSON string
    latest_cons = Column(String, nullable=True) # JSON string
    latest_trend = Column(Float, nullable=True) # 7d ROI prediction
    summary_impact = Column(String, nullable=True) # Positive, Negative, Neutral
    
    prices = relationship("StockPrice", back_populates="stock")
    predictions = relationship("Prediction", back_populates="stock")
    sentiments = relationship("Sentiment", back_populates="stock")

class StockPrice(Base):
    __tablename__ = "stock_prices"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    date = Column(Date, index=True)
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Integer)
    
    stock = relationship("Stock", back_populates="prices")

class Sentiment(Base):
    __tablename__ = "sentiments"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    date = Column(Date, index=True)
    source = Column(String) # Twitter, News
    score = Column(Float) # -1 to 1
    magnitude = Column(Float) # Confidence or engagement weight
    text = Column(String, nullable=True) # Actual content
    url = Column(String, nullable=True) # Source link
    
    stock = relationship("Stock", back_populates="sentiments")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"))
    prediction_date = Column(Date) # Date prediction was made
    target_date = Column(Date) # Date prediction is for
    predicted_price = Column(Float)
    model_type = Column(String) # ARIMA, LSTM, LR, Ensemble
    confidence = Column(Float)
    
    stock = relationship("Stock", back_populates="predictions")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_verified = Column(Boolean, default=False)
    verification_code = Column(String, nullable=True)

    watchlists = relationship("Watchlist", back_populates="user")
    watchlists = relationship("Watchlist", back_populates="user")


class Watchlist(Base):
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ticker = Column(String, index=True)
    added_date = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="watchlists")
