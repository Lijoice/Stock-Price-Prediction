from newsapi import NewsApiClient
import os
import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from ..models import Sentiment, Stock
from ..database import SessionLocal
from ..sentiment.summarizer import generate_summary
from ..sentiment.finbert import get_sentiment

load_dotenv()
NEWS_API_KEY = os.getenv("NEWS_API_KEY")

def fetch_news_sentiment(ticker: str, days: int = 25, trend_context: str = None):
    """
    Fetches news for a given ticker, generates summary/pros/cons.
    Returns: dict with summary, impact, and pros_cons or None.
    """
    if not NEWS_API_KEY:
        print("News API Key not found.")
        return None

    db = None
    try:
        newsapi = NewsApiClient(api_key=NEWS_API_KEY)
        
        db: Session = SessionLocal()
        stock = db.query(Stock).filter(Stock.ticker == ticker).first()
        
        if not stock:
            print("Stock not found in DB")
            return None

        # Clean ticker for search
        # Clean ticker for search
        symbol_only = ticker.split('.')[0]
        
        # Sanitize brand name (remove extra spaces which break logic)
        brand_name = stock.name.replace("Limited", "").replace("Ltd.", "").strip() if stock.name and stock.name != ticker else symbol_only
        clean_brand = " ".join(brand_name.split())
        
        # Tier 1: Detailed geopolitical/business query
        search_query = f'("{clean_brand}" OR {symbol_only}) AND (geopolitical OR "trade war" OR sanctions OR AI OR cloud OR earnings OR "market share" OR growth OR expansion OR global)'
        
        to_date = datetime.now().strftime('%Y-%m-%d')
        from_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')
        
        print(f"Fetching GEOPOLITICAL news for {ticker} using query: {search_query}")
        all_articles = newsapi.get_everything(
            q=search_query,
            from_param=from_date,
            to=to_date,
            language='en',
            sort_by='relevancy',
            page_size=10
        )
        
        # Tier 2 Fallback: If no results, try a broader search
        if not all_articles.get('articles') or len(all_articles['articles']) == 0:
            search_query = f'"{clean_brand}" stock market analysis'
            print(f"No results for Tier 1. Falling back to Tier 2: {search_query}")
            all_articles = newsapi.get_everything(
                q=search_query,
                from_param=from_date,
                to=to_date,
                language='en',
                sort_by='relevancy',
                page_size=10
            )

        # Tier 3 (Ultra-broad): Just the ticker or brand name if still nothing
        if not all_articles.get('articles') or len(all_articles['articles']) == 0:
            search_query = f'{symbol_only} stock'
            print(f"No results for Tier 2. Falling back to Tier 3: {search_query}")
            all_articles = newsapi.get_everything(
                q=search_query,
                from_param=from_date,
                to=to_date,
                language='en',
                sort_by='relevancy',
                page_size=5
            )
        
        articles_data = []
        sent_objects = []
        if isinstance(all_articles, dict) and all_articles.get('status') == 'ok' and all_articles.get('articles'):
            for article in all_articles['articles']:
                pub_date = datetime.strptime(article['publishedAt'][:10], '%Y-%m-%d').date()
                
                new_sentiment = Sentiment(
                    stock_id=stock.id,
                    date=pub_date,
                    source="NewsAPI (Geo)",
                    score=0.0,
                    magnitude=1.0,
                    text=article['title'],
                    url=article['url']
                )
                db.add(new_sentiment)
                sent_objects.append(new_sentiment)
                
                articles_data.append({
                    "text": article['title'],
                    "description": article.get('description', ''),
                    "source": article.get('source', {}).get('name', 'Unknown'),
                    "date": article['publishedAt'][:10],
                    "score": 0.0
                })
            
            db.flush()
            
            # Generate Summary & Real Sentiment Scores using OpenAI with trend context
            summary, impact, scores, pros_cons = generate_summary(ticker, articles_data, trend_context=trend_context)
            
            # Update individual article scores in DB
            for i, score in enumerate(scores):
                if i < len(sent_objects):
                    sent_objects[i].score = score
            
            stock.latest_summary = summary
            stock.summary_impact = impact
            
            stock.latest_pros = json.dumps(pros_cons.get("pros", []))
            stock.latest_cons = json.dumps(pros_cons.get("cons", []))
            
            db.commit()
            print(f"Stored geopolitical analysis and pros/cons for {ticker}")
            return {
                "summary": summary,
                "impact": impact,
                "pros_cons": pros_cons
            }
        else:
            print(f"No news found for {ticker}, using fundamental fallback for Pros/Cons")
            # Fallback: Get some basic stats from yfinance info
            import yfinance as yf
            stock_info = yf.Ticker(ticker).info
            
            pros = []
            cons = []
            
            # Simple rules for pros/cons based on info
            if stock_info.get('returnOnEquity', 0) > 0.15: pros.append(f"Strong ROE of {stock_info['returnOnEquity']*100:.1f}%")
            if stock_info.get('dividendYield', 0) > 0.02: pros.append(f"Healthy dividend yield of {stock_info['dividendYield']*100:.1f}%")
            if stock_info.get('profitMargins', 0) > 0.10: pros.append(f"Solid profit margins ({stock_info['profitMargins']*100:.1f}%)")
            
            pb = stock_info.get('priceToBook', 0)
            if pb > 5: cons.append(f"Trading at high Price-to-Book ratio ({pb:.2f}x)")
            elif pb > 0 and pb < 1: pros.append(f"Trading below book value ({pb:.2f}x)")
            
            pe = stock_info.get('trailingPE', 0)
            if pe > 40: cons.append(f"Elevated P/E ratio ({pe:.2f}x) relative to peers")
            
            if trend_context and "Bearish" in trend_context:
                cons.append(f"Technical indicators suggest downward pressure ({trend_context})")
            elif trend_context and "Bullish" in trend_context:
                pros.append(f"Technical momentum is positive ({trend_context})")

            # Final fallbacks if lists are still empty
            if not pros: pros = ["Stable market position", "Industry leader"]
            if not cons: cons = ["Global macroeconomic headwinds", "Market volatility"]

            stock.latest_pros = json.dumps(pros[:3])
            stock.latest_cons = json.dumps(cons[:3])
            stock.latest_summary = f"No recent geopolitical news articles found for {ticker}. Analysis is based on fundamental and technical indicators."
            stock.summary_impact = "Neutral"
            if trend_context and "Bearish" in trend_context: stock.summary_impact = "Negative"
            elif trend_context and "Bullish" in trend_context: stock.summary_impact = "Positive"

            db.commit()
            return {
                "summary": stock.latest_summary,
                "impact": stock.summary_impact,
                "pros_cons": {"pros": pros[:3], "cons": cons[:3]}
            }

    except Exception as e:
        print(f"Error fetching news for {ticker}: {e}")
        return None
    finally:
        if db:
            db.close()

if __name__ == "__main__":
    # Test
    fetch_news_sentiment("RELIANCE.NS")
