
import tweepy
import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..models import Sentiment, Stock
from ..database import SessionLocal
from ..sentiment.finbert import get_sentiment
import statistics

from dotenv import load_dotenv

load_dotenv()
# You need to set these in your .env file
BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN")

def fetch_twitter_sentiment(ticker: str, days: int = 7):
    """
    Fetches tweets for a given ticker and returns a dummy sentiment score
    since we don't have a real FinBERT model integrated yet.
    In a real scenario, this would:
    1. Query Twitter API v2
    2. Clean text
    3. Pass to FinBERT
    4. Aggregate scores
    """
    if not BEARER_TOKEN:
        print("Twitter Bearer Token not found.")
        return None

    db = None
    try:
        client = tweepy.Client(bearer_token=BEARER_TOKEN)
        
        # Construct query: ticker OR company name -is:retweet lang:en
        query = f"{ticker} -is:retweet lang:en"
        
        # Defines start_time
        start_time = datetime.utcnow() - timedelta(days=days)
        
        print(f"Fetching tweets for {ticker} since {start_time}")
        
        # Note: Essential Access only allows searching recent tweets (last 7 days)
        tweets = client.search_recent_tweets(
            query=query,
            tweet_fields=['created_at', 'public_metrics'],
            max_results=10 # keeping it low for test
        )
        
        if not tweets.data:
            print(f"No tweets found for {ticker}")
            return None

        db: Session = SessionLocal()
        stock = db.query(Stock).filter(Stock.ticker == ticker).first()
        
        if not stock: 
            print("Stock not found in DB")
            return None

        sentiments = []
        for tweet in tweets.data:
            # FinBERT sentiment analysis
            try:
                score = float(get_sentiment(tweet.text)) # Convert to float
            except Exception as e:
                print(f"Error in sentiment prediction: {e}")
                score = 0.0
            
            # engagement weight = retweets + likes + replies
            metrics = tweet.public_metrics
            engagement = metrics.get('retweet_count', 0) + metrics.get('like_count', 0)
            
            new_sentiment = Sentiment(
                stock_id=stock.id,
                date=tweet.created_at.date(),
                source="Twitter",
                score=score,
                magnitude=engagement,
                text=tweet.text,
                url=f"https://twitter.com/i/web/status/{tweet.id}"
            )
            db.add(new_sentiment)
            sentiments.append(score)
            
        db.commit()
        print(f"Stored {len(sentiments)} tweets for {ticker}")
        
    except Exception as e:
        print(f"Error fetching tweets: {e}")
        return None
    finally:
        if db:
            db.close()

if __name__ == "__main__":
    # Test
    # Note: Will fail without valid API key
    fetch_twitter_sentiment("AAPL")
