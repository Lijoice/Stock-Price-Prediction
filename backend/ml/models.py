
import pandas as pd
import numpy as np
from statsmodels.tsa.arima.model import ARIMA
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import MinMaxScaler
try:
    from tensorflow.keras.models import Sequential
    from tensorflow.keras.layers import LSTM, Dense
    TF_AVAILABLE = True
except ImportError:
    TF_AVAILABLE = False
    Sequential = None
    LSTM = None
    Dense = None
import warnings
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tools.sm_exceptions import ValueWarning, ConvergenceWarning

# Suppress statsmodels warnings
warnings.filterwarnings("ignore", category=ValueWarning)
warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=ConvergenceWarning)

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    xgb = None

try:
    import pandas_ta as ta
    TA_AVAILABLE = True
except ImportError:
    TA_AVAILABLE = False
    ta = None
import joblib
import os

class TimeSeriesModel:
    def __init__(self):
        pass
    
    def train(self, data):
        raise NotImplementedError
        
    def predict(self, steps):
        raise NotImplementedError

class ARIMAModel(TimeSeriesModel):
    def __init__(self, order=(5,1,0)):
        super().__init__()
        self.order = order
        self.model = None
        
    def train(self, data: pd.Series):
        """
        Trains ARIMA model on the provided time series data (Close prices).
        """
        self.model = ARIMA(data, order=self.order)
        self.model_fit = self.model.fit()
        print(f"ARIMA Model trained with order {self.order}")
        
    def predict(self, steps=7):
        if not self.model:
            raise ValueError("Model not trained yet.")
        forecast = self.model_fit.forecast(steps=steps)
        return forecast.tolist()

class LinearRegressionModel(TimeSeriesModel):
    def __init__(self):
        super().__init__()
        self.model = LinearRegression()
        
    def prepare_features(self, data: pd.DataFrame):
        """
        Feature Engineering:
        - Lag features (previous days' prices)
        - Moving Averages (MA7, MA30)
        - Technical Indicators via pandas-ta (RSI, MACD, Bollinger Bands, ADX, %B)
        - Sentiment Scores (if available)
        - Sector Index Correlation (if available)
        """
        df = data.copy()
        
        # Lag and MA
        df['Lag1'] = df['Close'].shift(1)
        df['Lag7'] = df['Close'].shift(7)
        df['MA7'] = df['Close'].rolling(window=7).mean()
        df['MA30'] = df['Close'].rolling(window=30).mean()
        
        # Technical Indicators
        if TA_AVAILABLE:
            df.ta.rsi(length=14, append=True)
            df.ta.macd(fast=12, slow=26, signal=9, append=True)
            df.ta.bbands(length=20, std=2, append=True)
            df.ta.adx(length=14, append=True) # Trend Strength
            
            # Bollinger %B (Position relative to bands)
            # %B = (Close - Lower Band) / (Upper Band - Lower Band)
            ub_col = 'BBU_20_2.0'
            lb_col = 'BBL_20_2.0'
            if ub_col in df.columns and lb_col in df.columns:
                df['BBP_20_2.0'] = (df['Close'] - df[lb_col]) / (df[ub_col] - df[lb_col] + 1e-6)
        else:
            df['RSI_14'] = 50.0
            df['MACD_12_26_9'] = 0.0
            df['BBL_20_2.0_2.0'] = df['Close'] * 0.95
            df['BBU_20_2.0_2.0'] = df['Close'] * 1.05
            df['ADX_14'] = 20.0
            df['BBP_20_2.0'] = 0.5

        # Sector Index Correlation
        if 'IndexClose' in df.columns:
            df['Index_Lag1'] = df['IndexClose'].shift(1)
            df['Index_Ret'] = df['IndexClose'].pct_change()
            df['Rel_Strength'] = df['Close'] / (df['IndexClose'] + 1e-6)

        if 'Volume' in df.columns:
            df['Volume_MA7'] = df['Volume'].rolling(window=7).mean()
            df['Volume_Change'] = df['Volume'].pct_change()
        
        # Volatility
        df['Std7'] = df['Close'].rolling(window=7).std()

        # Handle NaNs from rolling/pct_change
        df.replace([np.inf, -np.inf], 0, inplace=True)
        df.bfill(inplace=True)
        df.ffill(inplace=True)
        df.fillna(0, inplace=True)
        return df
        
    def train(self, data: pd.DataFrame, extra_features=None):
        df = self.prepare_features(data)
        
        # Base features
        features = ['Lag1', 'Lag7', 'MA7', 'RSI_14', 'MACD_12_26_9', 'Std7']
        if 'Volume_MA7' in df.columns:
            features.append('Volume_MA7')
            
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True) 
             features.extend(extra_features.columns.tolist())
             
        self.features_used = features
        X = df[features]
        y = df['Close']
        self.model.fit(X, y)
        print(f"Linear Regression Model trained with features: {features}")
        
    def predict(self, data: pd.DataFrame, extra_features=None, steps=7):
        """
        Recursive prediction for next 7 days.
        """
        df = self.prepare_features(data)
        last_row = df.iloc[-1:].copy()
        
        if extra_features is not None:
             last_row = last_row.join(extra_features, how='left')
             last_row.fillna(0, inplace=True)
             
        predictions = []
        recent_prices = df['Close'].tolist()
        
        for _ in range(steps):
             # 1. Update features for the next step based on the evolving history
             # Lags
             current_lag1 = recent_prices[-1]
             current_lag7 = recent_prices[-7] if len(recent_prices) >= 7 else recent_prices[0]
             current_ma7 = np.mean(recent_prices[-7:]) if len(recent_prices) >= 7 else np.mean(recent_prices)
             
             feature_vals = {
                 'Lag1': [current_lag1],
                 'Lag7': [current_lag7],
                 'MA7': [current_ma7],
             }
             
             # Technicals (RSI/MACD/Std) - simple carry forward for future forecasting
             for f in self.features_used:
                 if f not in feature_vals:
                     if f in last_row.columns:
                         feature_vals[f] = [last_row[f].values[-1]]
                     else:
                         feature_vals[f] = [df[f].iloc[-1] if f in df.columns else 0]
                         
             features_df = pd.DataFrame(feature_vals)[self.features_used]
             
             pred = self.model.predict(features_df)[0]
             
             # Prevent ridiculous divergence
             last_actual = recent_prices[-1]
             if pred > last_actual * 1.5: pred = last_actual * 1.05
             if pred < last_actual * 0.5: pred = last_actual * 0.95
             
             predictions.append(pred)
             recent_prices.append(pred) # Update history for next iteration lags/MA
             
        return predictions

class LSTMModel(TimeSeriesModel):
    def __init__(self, look_back=60):
        super().__init__()
        self.look_back = look_back
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
    def create_dataset(self, dataset):
        X, Y = [], []
        for i in range(len(dataset) - self.look_back - 1):
            a = dataset[i:(i + self.look_back), 0]
            X.append(a)
            Y.append(dataset[i + self.look_back, 0])
        return np.array(X), np.array(Y)
        
    def train(self, data: pd.Series, extra_features: pd.DataFrame = None, epochs=1, batch_size=1):
        # Let's combine close price with technical indicators and extra features
        df = pd.DataFrame({'Close': data})
        
        # Technical Indicators
        df.ta.rsi(length=14, append=True)
        df.ta.macd(fast=12, slow=26, signal=9, append=True)
        df.ta.bbands(length=20, std=2, append=True)
        
        df.dropna(inplace=True)
        
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True)
             
        self.feature_columns = df.columns.tolist()
        
        dataset = df.values
        dataset = self.scaler.fit_transform(dataset)
        
        X, y = [], []
        # Target is the Close price (index 0)
        target_col_idx = df.columns.get_loc('Close')
        
        for i in range(len(dataset) - self.look_back - 1):
            a = dataset[i:(i + self.look_back), :]
            X.append(a)
            Y = dataset[i + self.look_back, target_col_idx]
            y.append(Y)
            
        X = np.array(X)
        y = np.array(y)
        
        if not TF_AVAILABLE:
            print("TensorFlow not available. Skipping LSTM training.")
            return

        self.model = Sequential()
        self.model.add(LSTM(50, input_shape=(self.look_back, X.shape[2])))
        self.model.add(Dense(1))
        self.model.compile(loss='mean_squared_error', optimizer='adam')
        
        if len(X) > 0:
            self.model.fit(X, y, epochs=epochs, batch_size=batch_size, verbose=2)
            print("LSTM Model trained")
        else:
             print("Not enough data to train LSTM with given look_back and NaNs from indicators")
        
    def predict(self, data: pd.Series, extra_features: pd.DataFrame = None, steps=7):
        # Prepare recent history to predict from
        df = pd.DataFrame({'Close': data})
        if TA_AVAILABLE:
            df.ta.rsi(length=14, append=True)
            df.ta.macd(fast=12, slow=26, signal=9, append=True)
            df.ta.bbands(length=20, std=2, append=True)
        else:
            df['RSI_14'] = 50.0
            df['MACD_12_26_9'] = 0.0
            df['BBL_20_2.0_2.0'] = df['Close'] * 0.95
            df['BBU_20_2.0_2.0'] = df['Close'] * 1.05
        
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True)
             
        df.dropna(inplace=True)
        
        if len(df) < self.look_back:
            # Fallback if history too short
            return [data.iloc[-1]] * steps
            
        last_data = df.values[-self.look_back:]
        current_batch = self.scaler.transform(last_data)
        current_batch = current_batch.reshape(1, self.look_back, df.shape[1])
        
        target_col_idx = df.columns.get_loc('Close')
        
        predictions_scaled = []
        for _ in range(steps):
            pred = self.model.predict(current_batch, verbose=0)
            pred_val = pred[0, 0]
            predictions_scaled.append(pred_val)
            
            # Recursive update: Use the predicted value as the next 'Close'
            # We copy the last row of the batch and update ONLY the Close price
            new_row = current_batch[0, -1, :].copy()
            new_row[target_col_idx] = pred_val
            
            # Shift the window: remove oldest row, append new predicted row
            new_batch = np.append(current_batch[0, 1:, :], new_row.reshape(1, df.shape[1]), axis=0)
            current_batch = new_batch.reshape(1, self.look_back, df.shape[1])
            
        # Inverse transform
        dummy = np.zeros((len(predictions_scaled), df.shape[1]))
        dummy[:, target_col_idx] = predictions_scaled
        preds = self.scaler.inverse_transform(dummy)[:, target_col_idx]
        
        return preds.tolist()

class XGBoostModel(TimeSeriesModel):
    def __init__(self):
        super().__init__()
        if not XGB_AVAILABLE:
            print("XGBoost not available. Using dummy model.")
            self.model = None
            return
        self.model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=100)
        
    def prepare_features(self, data: pd.DataFrame):
        df = data.copy()
        
        # Lag and MA
        df['Lag1'] = df['Close'].shift(1)
        df['Lag2'] = df['Close'].shift(2)
        df['Lag7'] = df['Close'].shift(7)
        df['MA7'] = df['Close'].rolling(window=7).mean()
        df['MA14'] = df['Close'].rolling(window=14).mean()
        
        # Technical Indicators
        df.ta.rsi(length=14, append=True)
        df.ta.macd(fast=12, slow=26, signal=9, append=True)
        df.ta.bbands(length=20, std=2, append=True)
        
        df.dropna(inplace=True)
        return df
        
    def train(self, data: pd.DataFrame, extra_features=None):
        df = self.prepare_features(data)
        
        features = ['Lag1', 'Lag2', 'Lag7', 'MA7', 'MA14', 'RSI_14', 'MACD_12_26_9', 'BBL_20_2.0_2.0', 'BBU_20_2.0_2.0']
        
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True)
             features.extend(extra_features.columns.tolist())
             
        self.features_used = features
        X = df[features]
        y = df['Close']
        
        if self.model:
            self.model.fit(X, y)
            print("XGBoost Model trained")
        else:
            print("XGBoost Model skipped (not available)")
        
    def predict(self, data: pd.DataFrame, extra_features=None, steps=7):
        df = self.prepare_features(data)
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True)
             
        if df.empty:
            return [data['Close'].iloc[-1]] * steps
            
        if not self.model:
            return [data['Close'].iloc[-1]] * steps

        last_row = df.iloc[-1:].copy()
        predictions = []
        
        for _ in range(steps):
            features_df = last_row[self.features_used]
            pred = self.model.predict(features_df)[0]
            predictions.append(float(pred))
            
            # Simply carry forward features for recursion
            # Just update Close-related lags (very simplified)
            last_row['Lag7'] = last_row['Lag2']
            last_row['Lag2'] = last_row['Lag1']
            last_row['Lag1'] = pred
            
        return predictions
class TransformerModel(TimeSeriesModel):
    def __init__(self, look_back=60, num_heads=2, ff_dim=32):
        super().__init__()
        self.look_back = look_back
        self.num_heads = num_heads
        self.ff_dim = ff_dim
        self.model = None
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        
    def transformer_encoder(self, inputs, head_size, num_heads, ff_dim, dropout=0):
        # Attention and Normalization
        from tensorflow.keras import layers
        x = layers.MultiHeadAttention(
            key_dim=head_size, num_heads=num_heads, dropout=dropout
        )(inputs, inputs)
        x = layers.Dropout(dropout)(x)
        res = x + inputs
        x = layers.LayerNormalization(epsilon=1e-6)(res)

        # Feed Forward Part
        x = layers.Conv1D(filters=ff_dim, kernel_size=1, activation="relu")(x)
        x = layers.Dropout(dropout)(x)
        x = layers.Conv1D(filters=inputs.shape[-1], kernel_size=1)(x)
        res = x + res
        return layers.LayerNormalization(epsilon=1e-6)(res)

    def train(self, data: pd.Series, extra_features: pd.DataFrame = None, epochs=5, batch_size=16):
        if not TF_AVAILABLE:
            print("TensorFlow not available for Transformer.")
            return

        from tensorflow.keras import layers, Model
        
        df = pd.DataFrame({'Close': data})
        if TA_AVAILABLE:
            df.ta.rsi(length=14, append=True)
            df.ta.macd(fast=12, slow=26, signal=9, append=True)
            df.ta.bbands(length=20, std=2, append=True)
        
        df.dropna(inplace=True)
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True)
             
        self.feature_columns = df.columns.tolist()
        dataset = self.scaler.fit_transform(df.values)
        
        X, y = [], []
        target_col_idx = df.columns.get_loc('Close')
        
        for i in range(len(dataset) - self.look_back - 1):
            X.append(dataset[i:(i + self.look_back), :])
            y.append(dataset[i + self.look_back, target_col_idx])
            
        X, y = np.array(X), np.array(y)
        
        if len(X) < 10:
            print("Not enough data for Transformer training.")
            return

        inputs = layers.Input(shape=(self.look_back, X.shape[2]))
        x = self.transformer_encoder(inputs, head_size=X.shape[2], num_heads=self.num_heads, ff_dim=self.ff_dim)
        x = layers.GlobalAveragePooling1D(data_format="channels_last")(x)
        for dim in [64, 32]:
            x = layers.Dense(dim, activation="relu")(x)
            x = layers.Dropout(0.1)(x)
        outputs = layers.Dense(1)(x)
        
        self.model = Model(inputs, outputs)
        self.model.compile(optimizer="adam", loss="mse")
        
        self.model.fit(X, y, epochs=epochs, batch_size=batch_size, verbose=0)
        print("Transformer Model trained successfully.")

    def predict(self, data: pd.Series, extra_features: pd.DataFrame = None, steps=7):
        if not self.model:
            return [data.iloc[-1]] * steps
            
        df = pd.DataFrame({'Close': data})
        if TA_AVAILABLE:
            df.ta.rsi(length=14, append=True)
            df.ta.macd(fast=12, slow=26, signal=9, append=True)
            df.ta.bbands(length=20, std=2, append=True)
        
        if extra_features is not None:
             df = df.join(extra_features, how='left')
             df.fillna(0, inplace=True)
        
        df.dropna(inplace=True)
        if len(df) < self.look_back:
            return [data.iloc[-1]] * steps
            
        last_data = df.values[-self.look_back:]
        current_batch = self.scaler.transform(last_data)
        current_batch = current_batch.reshape(1, self.look_back, df.shape[1])
        
        target_col_idx = df.columns.get_loc('Close')
        predictions_scaled = []
        
        for _ in range(steps):
            pred = self.model.predict(current_batch, verbose=0)
            pred_val = pred[0, 0]
            predictions_scaled.append(pred_val)
            
            new_row = current_batch[0, -1, :].copy()
            new_row[target_col_idx] = pred_val
            
            new_batch = np.append(current_batch[0, 1:, :], new_row.reshape(1, df.shape[1]), axis=0)
            current_batch = new_batch.reshape(1, self.look_back, df.shape[1])
            
        dummy = np.zeros((len(predictions_scaled), df.shape[1]))
        dummy[:, target_col_idx] = predictions_scaled
        preds = self.scaler.inverse_transform(dummy)[:, target_col_idx]
        
        return preds.tolist()
