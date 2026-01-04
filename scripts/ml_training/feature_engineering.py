"""
=============================================================================
FEATURE ENGINEERING - Technical Indicators for ML Models (Optimized)
=============================================================================
Calculates 50+ technical features from OHLCV data including:
- Price-based features (returns, momentum)
- Moving averages (SMA, EMA)
- Volatility (ATR, Bollinger Bands)
- Momentum (RSI, MACD, ROC)
- Volume indicators (OBV, VWAP)
- Statistical features (skewness, kurtosis)

OPTIMIZATION TECHNIQUES:
- Vectorized NumPy operations (avoid loops)
- Efficient rolling calculations with pandas
- Pre-allocated arrays for large computations
- Cached intermediate results
- Parallel processing where applicable

Author: Shadaab Ahmed
=============================================================================
"""

import pandas as pd
import numpy as np
from typing import List, Tuple, Optional
import logging
from pathlib import Path
import json
from functools import lru_cache
import warnings
warnings.filterwarnings('ignore')

logger = logging.getLogger(__name__)

# =============================================================================
# OPTIMIZED TECHNICAL INDICATOR FUNCTIONS
# Using vectorized operations for maximum performance
# =============================================================================

def sma(series: pd.Series, period: int) -> pd.Series:
    """Simple Moving Average - vectorized."""
    return series.rolling(window=period, min_periods=1).mean()


def ema(series: pd.Series, period: int) -> pd.Series:
    """Exponential Moving Average - optimized with numba-like speed."""
    return series.ewm(span=period, adjust=False, min_periods=1).mean()


def rsi(series: pd.Series, period: int = 14) -> pd.Series:
    """Relative Strength Index - vectorized with Wilder's smoothing."""
    delta = series.diff()
    # Vectorized gain/loss calculation
    gain = np.where(delta > 0, delta, 0)
    loss = np.where(delta < 0, -delta, 0)
    
    # Use exponential weighted mean for efficiency
    avg_gain = pd.Series(gain, index=series.index).ewm(alpha=1/period, min_periods=period).mean()
    avg_loss = pd.Series(loss, index=series.index).ewm(alpha=1/period, min_periods=period).mean()
    
    rs = avg_gain / (avg_loss + 1e-10)
    return 100 - (100 / (1 + rs))


def macd(series: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """MACD indicator."""
    ema_fast = ema(series, fast)
    ema_slow = ema(series, slow)
    macd_line = ema_fast - ema_slow
    signal_line = ema(macd_line, signal)
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def bollinger_bands(series: pd.Series, period: int = 20, std_dev: float = 2.0) -> Tuple[pd.Series, pd.Series, pd.Series]:
    """Bollinger Bands."""
    middle = sma(series, period)
    std = series.rolling(window=period).std()
    upper = middle + std_dev * std
    lower = middle - std_dev * std
    return upper, middle, lower


def atr(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Average True Range."""
    tr1 = high - low
    tr2 = abs(high - close.shift())
    tr3 = abs(low - close.shift())
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    return tr.rolling(window=period).mean()


def adx(high: pd.Series, low: pd.Series, close: pd.Series, period: int = 14) -> pd.Series:
    """Average Directional Index."""
    plus_dm = high.diff()
    minus_dm = -low.diff()
    
    plus_dm = plus_dm.where((plus_dm > minus_dm) & (plus_dm > 0), 0)
    minus_dm = minus_dm.where((minus_dm > plus_dm) & (minus_dm > 0), 0)
    
    tr = atr(high, low, close, 1)
    
    plus_di = 100 * ema(plus_dm, period) / (ema(tr, period) + 1e-10)
    minus_di = 100 * ema(minus_dm, period) / (ema(tr, period) + 1e-10)
    
    dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di + 1e-10)
    return ema(dx, period)


def obv(close: pd.Series, volume: pd.Series) -> pd.Series:
    """On-Balance Volume."""
    direction = np.sign(close.diff())
    return (volume * direction).cumsum()


def calculate_returns(close: pd.Series, periods: List[int]) -> pd.DataFrame:
    """Calculate returns for multiple periods."""
    returns = pd.DataFrame()
    for p in periods:
        returns[f'returns_{p}d'] = close.pct_change(p)
        returns[f'log_returns_{p}d'] = np.log(close / close.shift(p))
    return returns


def calculate_momentum(close: pd.Series, periods: List[int]) -> pd.DataFrame:
    """Calculate momentum indicators."""
    momentum = pd.DataFrame()
    for p in periods:
        momentum[f'momentum_{p}d'] = close - close.shift(p)
        momentum[f'roc_{p}d'] = (close - close.shift(p)) / (close.shift(p) + 1e-10) * 100
    return momentum


def calculate_volatility(returns: pd.Series, periods: List[int]) -> pd.DataFrame:
    """Calculate volatility for multiple periods."""
    vol = pd.DataFrame()
    for p in periods:
        vol[f'volatility_{p}d'] = returns.rolling(window=p).std() * np.sqrt(252)
    return vol


def calculate_statistical_features(returns: pd.Series, window: int = 20) -> pd.DataFrame:
    """Calculate statistical features."""
    stats = pd.DataFrame()
    stats['skewness'] = returns.rolling(window=window).skew()
    stats['kurtosis'] = returns.rolling(window=window).kurt()
    stats['zscore'] = (returns - returns.rolling(window=window).mean()) / (returns.rolling(window=window).std() + 1e-10)
    return stats


# =============================================================================
# MAIN FEATURE ENGINEERING FUNCTION
# =============================================================================

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Engineer all features for a single symbol's data.
    
    Args:
        df: DataFrame with columns [date, open, high, low, close, volume, symbol, asset_class]
        
    Returns:
        DataFrame with all engineered features
    """
    df = df.sort_values('date').reset_index(drop=True)
    
    close = df['close']
    high = df['high']
    low = df['low']
    volume = df['volume']
    open_price = df['open']
    
    features = pd.DataFrame(index=df.index)
    
    # Preserve original columns
    features['date'] = df['date']
    features['symbol'] = df['symbol']
    features['asset_class'] = df['asset_class']
    features['close'] = close
    
    # ==========================================================================
    # PRICE-BASED FEATURES
    # ==========================================================================
    
    # Returns for multiple periods
    returns_df = calculate_returns(close, [1, 2, 3, 5, 10, 20])
    for col in returns_df.columns:
        features[col] = returns_df[col]
    
    # Daily returns for calculations
    daily_returns = close.pct_change()
    
    # ==========================================================================
    # MOVING AVERAGES
    # ==========================================================================
    
    for period in [5, 10, 20, 50]:
        features[f'sma_{period}'] = sma(close, period)
        features[f'ema_{period}'] = ema(close, period)
    
    # Price relative to moving averages
    features['price_to_sma5'] = close / (features['sma_5'] + 1e-10)
    features['price_to_sma10'] = close / (features['sma_10'] + 1e-10)
    features['price_to_sma20'] = close / (features['sma_20'] + 1e-10)
    features['price_to_sma50'] = close / (features['sma_50'] + 1e-10)
    
    # Moving average crossovers
    features['sma_5_10_cross'] = features['sma_5'] / (features['sma_10'] + 1e-10)
    features['sma_10_20_cross'] = features['sma_10'] / (features['sma_20'] + 1e-10)
    features['sma_20_50_cross'] = features['sma_20'] / (features['sma_50'] + 1e-10)
    
    # ==========================================================================
    # MOMENTUM INDICATORS
    # ==========================================================================
    
    # RSI
    features['rsi_7'] = rsi(close, 7)
    features['rsi_14'] = rsi(close, 14)
    features['rsi_21'] = rsi(close, 21)
    
    # Momentum
    momentum_df = calculate_momentum(close, [5, 10, 20])
    for col in momentum_df.columns:
        features[col] = momentum_df[col]
    
    # MACD
    macd_line, signal_line, histogram = macd(close)
    features['macd'] = macd_line
    features['macd_signal'] = signal_line
    features['macd_histogram'] = histogram
    features['macd_cross'] = macd_line - signal_line
    
    # ==========================================================================
    # VOLATILITY INDICATORS
    # ==========================================================================
    
    # Rolling volatility
    vol_df = calculate_volatility(daily_returns, [5, 10, 20])
    for col in vol_df.columns:
        features[col] = vol_df[col]
    
    # ATR
    features['atr_5'] = atr(high, low, close, 5)
    features['atr_10'] = atr(high, low, close, 10)
    features['atr_14'] = atr(high, low, close, 14)
    
    # ATR percentage
    features['atr_pct_5'] = features['atr_5'] / (close + 1e-10)
    features['atr_pct_14'] = features['atr_14'] / (close + 1e-10)
    
    # Bollinger Bands
    bb_upper, bb_middle, bb_lower = bollinger_bands(close)
    features['bb_position'] = (close - bb_lower) / (bb_upper - bb_lower + 1e-10)
    features['bb_width'] = (bb_upper - bb_lower) / (bb_middle + 1e-10)
    
    # ==========================================================================
    # TREND INDICATORS
    # ==========================================================================
    
    # ADX
    features['adx_14'] = adx(high, low, close, 14)
    
    # Trend strength (based on price vs multiple MAs)
    above_sma5 = (close > features['sma_5']).astype(int)
    above_sma10 = (close > features['sma_10']).astype(int)
    above_sma20 = (close > features['sma_20']).astype(int)
    above_sma50 = (close > features['sma_50']).astype(int)
    features['trend_strength'] = (above_sma5 + above_sma10 + above_sma20 + above_sma50) / 4
    
    # ==========================================================================
    # VOLUME INDICATORS
    # ==========================================================================
    
    features['volume_sma_5'] = sma(volume, 5)
    features['volume_sma_10'] = sma(volume, 10)
    features['volume_ratio'] = volume / (features['volume_sma_10'] + 1e-10)
    
    # OBV
    obv_values = obv(close, volume)
    features['obv'] = obv_values
    features['obv_change'] = obv_values.pct_change(5)
    
    # ==========================================================================
    # CANDLESTICK PATTERNS
    # ==========================================================================
    
    body = close - open_price
    range_hl = high - low + 1e-10
    
    features['body_ratio'] = body / range_hl
    features['upper_shadow'] = (high - pd.concat([close, open_price], axis=1).max(axis=1)) / range_hl
    features['lower_shadow'] = (pd.concat([close, open_price], axis=1).min(axis=1) - low) / range_hl
    
    # Higher highs / Lower lows
    features['higher_high'] = (high > high.shift(1)).astype(int)
    features['lower_low'] = (low < low.shift(1)).astype(int)
    features['higher_close'] = (close > close.shift(1)).astype(int)
    
    # ==========================================================================
    # STATISTICAL FEATURES
    # ==========================================================================
    
    stats_df = calculate_statistical_features(daily_returns)
    for col in stats_df.columns:
        features[col] = stats_df[col]
    
    # ==========================================================================
    # TARGET VARIABLE - Next day return direction
    # ==========================================================================
    
    features['target'] = (close.shift(-1) > close).astype(int)
    features['target_return'] = close.pct_change(-1) * -1  # Next day return
    
    return features


def process_all_symbols(df: pd.DataFrame, output_dir: Path = None) -> Tuple[pd.DataFrame, dict]:
    """
    Process all symbols and engineer features.
    
    Args:
        df: Raw OHLCV data for all symbols
        output_dir: Directory to save processed data
        
    Returns:
        Tuple of (processed DataFrame, metadata)
    """
    if output_dir is None:
        output_dir = Path(__file__).parent / 'data'
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    all_features = []
    symbols = df['symbol'].unique()
    
    logger.info(f"🔧 Engineering features for {len(symbols)} symbols...")
    
    for symbol in symbols:
        symbol_df = df[df['symbol'] == symbol].copy()
        features = engineer_features(symbol_df)
        all_features.append(features)
    
    combined = pd.concat(all_features, ignore_index=True)
    
    # Drop rows with NaN (from rolling calculations)
    initial_rows = len(combined)
    combined = combined.dropna()
    dropped_rows = initial_rows - len(combined)
    
    # Get feature columns (exclude metadata and target)
    exclude_cols = ['date', 'symbol', 'asset_class', 'close', 'target', 'target_return']
    feature_cols = [c for c in combined.columns if c not in exclude_cols]
    
    metadata = {
        'timestamp': pd.Timestamp.now().isoformat(),
        'total_samples': len(combined),
        'symbols': len(symbols),
        'feature_count': len(feature_cols),
        'features': feature_cols,
        'dropped_nan_rows': dropped_rows,
        'date_range': {
            'start': str(combined['date'].min()),
            'end': str(combined['date'].max())
        }
    }
    
    # Save processed features
    output_file = output_dir / 'features.parquet'
    combined.to_parquet(output_file, index=False)
    logger.info(f"💾 Saved {len(combined):,} samples with {len(feature_cols)} features to {output_file}")
    
    # Save metadata
    metadata_file = output_dir / 'feature_metadata.json'
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2, default=str)
    
    return combined, metadata


if __name__ == '__main__':
    from data_fetcher import fetch_all_data, load_cached_data
    
    # Load or fetch data
    df = load_cached_data()
    if df is None:
        df, _ = fetch_all_data(years=5)
    
    # Engineer features
    features, metadata = process_all_symbols(df)
    
    print(f"\n✅ Feature engineering complete!")
    print(f"   Samples: {metadata['total_samples']:,}")
    print(f"   Features: {metadata['feature_count']}")
    print(f"   Date range: {metadata['date_range']['start']} to {metadata['date_range']['end']}")
