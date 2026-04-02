# Stock Price Prediction & Recommendation App

A full-stack web application that predicts stock prices for the next 7 days and provides Buy/Sell recommendations using Ensemble ML models (ARIMA, LSTM, Linear Regression) and FinBERT-based Sentiment Analysis.

## 🚀 Features
- **Multi-Model Forecasting**: Combines ARIMA, LSTM, and Linear Regression.
- **Genetic Algorithm Optimization**: Auto-tunes ARIMA hyperparameters.
- **Sentiment Analysis**: FinBERT analysis of Twitter and News data.
- **Interactive UI**: React-based dashboard with Recharts.
- **Support**: Works for NSE/BSE (e.g., `RELIANCE.NS`) and NASDAQ (e.g., `AAPL`).

## 🛠️ Tech Stack
- **Backend**: FastAPI, SQLAlchemy, scikit-learn, TensorFlow, Statsmodels, Tweepy, NewsAPI.
- **Frontend**: React, Vite, Tailwind CSS, Recharts.
- **Database**: SQLite (local).

## 📋 Prerequisites
- Python 3.9+
- Node.js 16+
- API Keys (Optional for full functionality, dummy data used if missing):
    - Alpha Vantage / Yahoo Finance
    - Twitter API v2 Bearer Token
    - NewsAPI Key

## ⚙️ Setup

1. **Clone the repository** (or ensure you are in the project root).
2. **Setup Backend**:
   ```bash
   cd backend
   pip install -r requirements.txt
   python init_db.py
   ```
3. **Setup Frontend**:
   ```bash
   cd frontend
   npm install
   ```

## 🏃 Run the App

You can run the provided `run.bat` file to start both servers, or run them manually:

**Backend**:
```bash
uvicorn backend.main:app --reload --port 8000
```

**Frontend**:
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 to use the app.

## 🧪 Testing

Run the prediction pipeline manually:
```bash
python -m backend.ml.pipeline
```
