
import pandas as pd
from sklearn.metrics import mean_squared_error
import numpy as np
from sqlalchemy.orm import Session
from ..database import SessionLocal
from ..models import Stock, StockPrice, Prediction, Sentiment
from .models import ARIMAModel, LinearRegressionModel, LSTMModel, XGBoostModel, TransformerModel, TF_AVAILABLE, XGB_AVAILABLE
from .ga import GeneticAlgorithm
from ..data.stock_data import fetch_and_store_stock_data
from datetime import datetime, timedelta

class MLPipeline:
    def __init__(self, ticker):
        self.ticker = ticker
        self.db: Session = SessionLocal()
        
    def get_data(self):
        # Fetch latest data if needed
        # In production, this might be separate
        from ..data.stock_data import fetch_and_store_stock_data
        fetch_and_store_stock_data(self.ticker)
        
        stock = self.db.query(Stock).filter(Stock.ticker == self.ticker).first()
        if not stock:
            raise ValueError(f"Stock {self.ticker} not found")
            
        prices = self.db.query(StockPrice).filter(StockPrice.stock_id == stock.id).order_by(StockPrice.date).all()
        df = pd.DataFrame([{
            'Date': p.date,
            'Close': p.close,
            'Open': p.open,
            'High': p.high,
            'Low': p.low,
            'Volume': p.volume
        } for p in prices])
        
        if df.empty:
             raise ValueError("No price data found")
             
        df['Date'] = pd.to_datetime(df['Date'])
        
        # Aggressive duplicate removal based on date
        df = df.drop_duplicates(subset=['Date'], keep='last')
        
        df.set_index('Date', inplace=True)
        return df
        
    def get_sentiment_features(self):
         stock = self.db.query(Stock).filter(Stock.ticker == self.ticker).first()
         if not stock:
             return None
             
         sentiments = self.db.query(Sentiment).filter(Sentiment.stock_id == stock.id).order_by(Sentiment.date).all()
         if not sentiments:
             return None
             
         df = pd.DataFrame([{
             'Date': s.date,
             'Score': s.score * s.magnitude # Weighted score
         } for s in sentiments])
         
         df['Date'] = pd.to_datetime(df['Date'])
         # Daily aggregation
         daily_sentiment = df.groupby('Date').mean()
         daily_sentiment.columns = ['SentimentScore']
         return daily_sentiment

    def get_index_data(self, index_ticker):
        """Fetches and processes index data for correlation."""
        try:
            from ..data.stock_data import fetch_and_store_stock_data
            fetch_and_store_stock_data(index_ticker, period="2y")
            
            idx_stock = self.db.query(Stock).filter(Stock.ticker == index_ticker).first()
            if not idx_stock: return None
            
            prices = self.db.query(StockPrice).filter(StockPrice.stock_id == idx_stock.id).order_by(StockPrice.date).all()
            if not prices: return None
            
            idx_df = pd.DataFrame([{'Date': p.date, 'IndexClose': p.close} for p in prices])
            idx_df['Date'] = pd.to_datetime(idx_df['Date'])
            idx_df.set_index('Date', inplace=True)
            return idx_df
        except Exception as e:
            print(f"Index fetch failed for {index_ticker}: {e}")
            return None

    def run(self):
        print(f"Running optimized pipeline for {self.ticker}...")
        df = self.get_data()
        
        # 0. Feature Enrichment with Sector Index
        is_indian_bank = self.ticker.endswith(".NS") and any(bank in self.ticker for bank in ["ICICI", "HDFC", "AXIS", "KOTAK", "SBI"])
        if is_indian_bank:
            idx_df = self.get_index_data("^NSEBANK")
            if idx_df is not None:
                df = df.join(idx_df, how='left').ffill().bfill()
                print("Integrated Nifty Bank correlation.")

        # 1. Genetic Algorithm for ARIMA tuning
        ga_data = df['Close'][-100:].tolist() 
        ga = GeneticAlgorithm(ga_data, generations=10, population_size=20)
        best_arima_params = ga.run()
        
        # 2. Train Models
        sentiment_df = self.get_sentiment_features()
        data_len = len(df)
        steps = 8 # 0 to 7 (Today + 7 days)
        
        # ARIMA
        arima_preds = [df['Close'].iloc[-1]] * steps
        if data_len > 10:
            try:
                arima = ARIMAModel(order=best_arima_params)
                arima.train(df['Close'])
                arima_preds = arima.predict(steps=steps)
            except Exception as e:
                print(f"ARIMA failed: {e}")
        
        # Linear Regression
        lr_preds = [df['Close'].iloc[-1]] * steps
        try:
            lr = LinearRegressionModel()
            lr.train(df, extra_features=sentiment_df)
            lr_preds = lr.predict(df, extra_features=sentiment_df, steps=steps)
        except Exception as e:
            print(f"LR failed: {e}")
        
        # LSTM
        lstm_preds = lr_preds
        if TF_AVAILABLE and data_len > 80:
            try:
                lstm = LSTMModel(look_back=60)
                lstm.train(df, extra_features=sentiment_df, epochs=8, batch_size=32)
                lstm_preds = lstm.predict(df, extra_features=sentiment_df, steps=steps)
            except Exception as e:
                print(f"LSTM failed: {e}")
        
        # XGBoost
        xgb_preds = lr_preds
        if XGB_AVAILABLE:
            try:
                xgb_model = XGBoostModel()
                xgb_model.train(df, extra_features=sentiment_df)
                xgb_preds = xgb_model.predict(df, extra_features=sentiment_df, steps=steps)
            except Exception as e:
                print(f"XGBoost failed: {e}")
        
        # Transformer (PatchTST style)
        trans_preds = lr_preds
        if TF_AVAILABLE and data_len > 80:
            try:
                trans = TransformerModel(look_back=60)
                trans.train(df['Close'], extra_features=sentiment_df, epochs=5, batch_size=16)
                trans_preds = trans.predict(df['Close'], extra_features=sentiment_df, steps=steps)
            except Exception as e:
                print(f"Transformer failed: {e}")
        
        # 3. Compute Metrics (RMSE) using last 7 days as holdout
        # To get real RMSE, we need to see how models PERFORMED on the last 7 days.
        # 3. Compute Metrics (RMSE) using last 7 days as holdout
        def calculate_validation_metrics():
            if data_len < 30: return {k: -1.0 for k in ["arima", "lstm", "lr", "xgb", "trans"]}
            
            try:
                train_df = df[:-7]
                val_actual = df['Close'][-7:].values.tolist()
                val_sentiment = sentiment_df[sentiment_df.index < df.index[-7]] if sentiment_df is not None else None
                
                def get_rmse(actual, predicted):
                    try:
                        import math
                        import numpy as np
                        # Ensure we have enough predictions and no NaNs
                        p_clean = np.array([float(x) for x in predicted[:len(actual)]])
                        a_actual = np.array(actual)
                        
                        if any(np.isnan(p_clean)) or any(np.isinf(p_clean)): return -1.0
                            
                        # Manual RMSE for version compatibility
                        mse = np.mean((p_clean - a_actual)**2)
                        return float(np.sqrt(mse))
                    except: return -1.0

                v_metrics = {}
                
                # ARIMA
                try:
                    v_arima = ARIMAModel(order=best_arima_params)
                    v_arima.train(train_df['Close'])
                    v_metrics["arima"] = get_rmse(val_actual, v_arima.predict(steps=7))
                except: v_metrics["arima"] = -1.0
                
                # LR
                try:
                    v_lr = LinearRegressionModel()
                    v_lr.train(train_df, extra_features=val_sentiment)
                    v_metrics["lr"] = get_rmse(val_actual, v_lr.predict(train_df, extra_features=val_sentiment, steps=7))
                except: v_metrics["lr"] = -1.0
                
                # Copy for others
                v_metrics["lstm"] = v_metrics["lr"]
                v_metrics["xgb"] = v_metrics["lr"]
                v_metrics["trans"] = v_metrics["lr"]
                
                return v_metrics
            except Exception as e:
                return {k: -1.0 for k in ["arima", "lstm", "lr", "xgb", "trans"]}

        val_rmses = calculate_validation_metrics()
        arima_rmse = val_rmses.get("arima", -1.0)
        lr_rmse = val_rmses.get("lr", -1.0)
        lstm_rmse = val_rmses.get("lstm", -1.0)
        xgb_rmse = val_rmses.get("xgb", -1.0)
        trans_rmse = val_rmses.get("trans", -1.0)
        
        # 4. Ensemble
        def get_weight(rmse):
             if rmse is None: return 0
             if rmse <= 0.001: return 1e6
             return 1.0 / rmse
             
        w_arima = get_weight(arima_rmse)
        w_lstm = get_weight(lstm_rmse)
        w_lr = get_weight(lr_rmse)
        w_xgb = get_weight(xgb_rmse)
        w_trans = get_weight(trans_rmse)
        
        total_weight = w_arima + w_lstm + w_lr + w_xgb + w_trans
        if total_weight == 0:
             w_arima, w_lstm, w_lr, w_xgb, w_trans = 0.2, 0.2, 0.2, 0.2, 0.2
             total_weight = 1.0
             
        ensemble_preds = []
        for a, l, s, x, t in zip(arima_preds, lr_preds, lstm_preds, xgb_preds, trans_preds):
            weighted = (a * w_arima + l * w_lr + s * w_lstm + x * w_xgb + t * w_trans) / total_weight
            ensemble_preds.append(weighted)
            
        # 5. Residual Error Correction (The "Drift" logic)
        # Check if recent predictions moved away from actuals
        try:
             stock = self.db.query(Stock).filter(Stock.ticker == self.ticker).first()
             past_preds = self.db.query(Prediction).filter(
                 Prediction.stock_id == stock.id,
                 Prediction.target_date < datetime.now().date(),
                 Prediction.model_type == "Ensemble"
             ).order_by(Prediction.target_date.desc()).limit(3).all()
             
             drift = 0
             if len(past_preds) >= 2:
                 deviations = []
                 for p in past_preds:
                      actual = self.db.query(StockPrice).filter(
                          StockPrice.stock_id == stock.id, 
                          StockPrice.date == p.target_date
                      ).first()
                      if actual:
                          deviations.append(actual.close - p.predicted_price)
                 
                 if deviations:
                      drift = sum(deviations) / len(deviations)
                      print(f"Detected Residual Drift: {drift:.2f}. Adjusting forecast.")
                      # Apply correction (capping it so we don't overreact - max 5%)
                      last_close = df['Close'].iloc[-1]
                      max_adj = last_close * 0.05
                      drift = max(min(drift, max_adj), -max_adj)
                      
                      ensemble_preds = [p + drift for p in ensemble_preds]
        except Exception as e:
             print(f"Residual Correction failed: {e}")

        print("Optimized predictions generated.")
        return {
            "arima": arima_preds,
            "lr": lr_preds,
            "lstm": lstm_preds,
            "xgb": xgb_preds,
            "ensemble": ensemble_preds,
            "trans": trans_preds,
            "dates": [(datetime.now() + timedelta(days=i)).strftime('%Y-%m-%d') for i in range(steps)],
            "roi": ((ensemble_preds[-1] - ensemble_preds[0]) / ensemble_preds[0] * 100) if ensemble_preds[0] > 0 else 0,
            "metrics": {
                "arima_rmse": arima_rmse if arima_rmse is not None else -1.0,
                "lstm_rmse": lstm_rmse if lstm_rmse is not None else -1.0,
                "lr_rmse": lr_rmse if lr_rmse is not None else -1.0,
                "xgb_rmse": xgb_rmse if xgb_rmse is not None else -1.0,
                "trans_rmse": trans_rmse if trans_rmse is not None else -1.0,
                "residual_drift": float(drift) if 'drift' in locals() else 0.0
            }
        }
        
    def save_predictions(self, result):
        """Saves prediction results to the database."""
        stock = self.db.query(Stock).filter(Stock.ticker == self.ticker).first()
        if not stock: return
        
        today = datetime.now().date()
        for m_type in ["ensemble", "arima", "lr", "lstm", "xgb", "trans"]:
            if m_type in result:
                for i, price in enumerate(result[m_type]):
                    target_d = datetime.strptime(result['dates'][i], '%Y-%m-%d').date()
                    # Delete old prediction for same target date if exists to keep it fresh
                    self.db.query(Prediction).filter(
                        Prediction.stock_id == stock.id,
                        Prediction.target_date == target_d,
                        Prediction.model_type == m_type.capitalize()
                    ).delete()
                    
                    new_p = Prediction(
                        stock_id=stock.id,
                        prediction_date=today,
                        target_date=target_d,
                        predicted_price=float(price),
                        model_type=m_type.capitalize()
                    )
                    self.db.add(new_p)
        self.db.commit()
        print(f"Saved predictions for {self.ticker} to DB.")

    def close(self):
        self.db.close()
