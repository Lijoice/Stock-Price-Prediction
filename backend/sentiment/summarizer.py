import os
import re
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OpenAI = None
    OPENAI_AVAILABLE = False
from dotenv import load_dotenv

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

def _get_client():
    """Lazily create OpenAI client to avoid module-level errors."""
    if not OPENAI_AVAILABLE or not OPENAI_API_KEY:
        return None
    try:
        return OpenAI(api_key=OPENAI_API_KEY)
    except Exception as e:
        print(f"Failed to create OpenAI client: {e}")
        return None

def calculate_final_impact(ticker, articles, trend_context=None):
    """Unified logic to determine sentiment impact based on news scores and ML trend."""
    # Determine trend impact
    trend_impact = "Neutral"
    if trend_context:
        if "Bullish" in trend_context: trend_impact = "Positive"
        elif "Bearish" in trend_context: trend_impact = "Negative"

    positive_news = [a for a in articles if a.get('score', 0) > 0.1]
    negative_news = [a for a in articles if a.get('score', 0) < -0.1]
    
    pos_count = len(positive_news)
    neg_count = len(negative_news)
    
    # Hierarchy: Trend first, unless news is extremely skewed opposite
    impact = "Neutral"
    if trend_impact == "Positive":
        # Only override if negative news is significantly higher than positive
        if neg_count > (pos_count + 1) * 3:
            impact = "Neutral"
        else:
            impact = "Positive"
    elif trend_impact == "Negative":
        if pos_count > (neg_count + 1) * 2:
            impact = "Neutral"
        else:
            impact = "Negative"
    else:
        # Balanced or Neutral trend: Normal logic
        if pos_count > neg_count * 1.5: impact = "Positive"
        elif neg_count > pos_count * 1.5: impact = "Negative"
        else: impact = "Neutral"
    
    return impact

def _generate_fallback_summary(ticker, articles, trend_context=None):
    """Generate a detailed summary without OpenAI using article titles and yfinance."""
    parts = []
    
    # Market data section
    try:
        import yfinance as yf
        stock = yf.Ticker(ticker)
        hist = stock.history(period="5d")
        info = stock.info
        company_name = info.get('longName', ticker)
        if not hist.empty:
            last_close = hist['Close'].iloc[-1]
            prev_close = hist['Close'].iloc[-2] if len(hist) > 1 else last_close
            change = last_close - prev_close
            pct_change = (change / prev_close) * 100 if prev_close != 0 else 0
            direction = "rose" if change > 0 else "fell" if change < 0 else "remained flat"
            
            parts.append(
                f"{company_name} ({ticker}) {direction} {abs(pct_change):.2f}% to close at ${last_close:.2f}."
            )
    except Exception as e:
        print(f"Fallback summary error: {e}")
    
    # News headlines section with sentiment
    parts.append(f"\n\nKey News Headlines ({len(articles)} analyzed):")
    for a in articles[:8]:
        score = a.get('score', 0)
        label = "Positive" if score > 0.1 else "Negative" if score < -0.1 else "Neutral"
        parts.append(f"\n• [{label}] {a['text']}")
    
    # Final calculated impact
    impact = calculate_final_impact(ticker, articles, trend_context)
    parts.append(f"\n\nOverall Sentiment: {impact} (based on geopolitical signals and market trend).")
    
    return " ".join(parts), impact

def generate_summary(ticker, articles, trend_context=None):
    """
    Generates a concise geopolitical summary of stock news/tweets and its impact.
    Returns: (summary_text, impact_text, list_of_scores, pros_cons_dict)
    """
    if not articles:
        return "No recent news found to analyze.", "Neutral", [], {"pros": [], "cons": []}

    # Build context for LLM
    context_lines = []
    for i, a in enumerate(articles[:10]):
        line = f"[{i}] {a['text']}"
        desc = a.get('description', '')
        if desc: line += f" | Details: {desc}"
        context_lines.append(line)
    context = "\n".join(context_lines)
    
    client = _get_client()
    if not client:
        return _generate_fallback_summary(ticker, articles, trend_context)

    prompt = f"""
    You are a geopolitical and financial expert. Analyze these 10 news items for {ticker}:
    {context}
    
    MARKET TREND FORECAST: {trend_context or 'Neutral'}
    
    INSTRUCTIONS:
    1. Your "summary" should explain the catalysts while explicitly aligning with the MARKET TREND FORECAST.
    2. Even if news seems negative, if the forecast is "Bullish", explain why the stock might be resilient or identify the hidden strengths.
    3. The "impact" field is your initial assessment, but it will be combined with the trend logic.
    4. Provide 2-3 specific "pros" and "cons". If news is sparse, use company fundamentals (e.g., market share, revenue growth for {ticker}).
    
    Return strictly as a JSON object:
    "summary": (max 2 sentences),
    "impact": ("Positive", "Negative", or "Neutral"),
    "scores": [list of 10 floats],
    "pros": [list of strings],
    "cons": [list of strings]
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a concise geopolitical analyst. You ONLY output valid JSON."},
                {"role": "user", "content": prompt}
            ],
            response_format={ "type": "json_object" },
            temperature=0.1
        )
        text = response.choices[0].message.content.strip()
        import json
        data = json.loads(text)
        
        summary = data.get("summary", "No summary generated.")
        scores = data.get("scores", [0.0] * 10)
        
        # Apply scores to articles for unified impact calculation
        for i, article in enumerate(articles[:10]):
            if i < len(scores):
                article['score'] = scores[i]
        
        # Determine final impact using Python hierarchy (anchored to trend)
        impact = calculate_final_impact(ticker, articles, trend_context)
        
        pros_cons = {
            "pros": data.get("pros", []),
            "cons": data.get("cons", [])
        }
        
        return summary, impact, scores[:10], pros_cons

    except Exception as e:
        print(f"JSON Summarization error: {e}")
        return _generate_fallback_summary(ticker, articles, trend_context)

