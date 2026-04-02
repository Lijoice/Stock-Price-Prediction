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
   cd stock-scout-dashboard
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
cd stock-scout-dashboard
npm run dev
```

## 🚀 Deployment on Railway

This app is configured for deployment on Railway.

1. **Push to GitHub**:
   - Create a new repository on GitHub.
   - Add the remote: `git remote add origin https://github.com/yourusername/yourrepo.git`
   - Push: `git push -u origin master`

2. **Deploy on Railway**:
   - Connect your GitHub repo to Railway.
   - Railway will auto-detect the monorepo and create two services: backend (Python) and frontend (Node.js).
   - For the frontend service, set environment variable `VITE_API_URL` to the backend's Railway URL (e.g., `https://your-backend-service.railway.app`).
   - Deploy!

## 📝 Notes
- The app uses SQLite for simplicity; for production, consider PostgreSQL.
- API keys should be set in environment variables for security.
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
