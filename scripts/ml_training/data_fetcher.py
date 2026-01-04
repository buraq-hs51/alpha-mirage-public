"""
=============================================================================
DATA FETCHER - Historical Market Data for ML Training
=============================================================================
Fetches 5 years of OHLCV data from Yahoo Finance for:
- US Stocks (AAPL, MSFT, GOOGL, etc.)
- ETFs (SPY, QQQ, etc.)
- Crypto (via Yahoo Finance tickers)

Author: Shadaab Ahmed
=============================================================================
"""

import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from pathlib import Path
import json
import logging
from typing import List, Dict, Optional, Tuple
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# =============================================================================
# ASSET UNIVERSE
# =============================================================================

ASSET_UNIVERSE = {
    'stocks': [
        'AAPL', 'MSFT', 'GOOGL', 'NVDA', 'TSLA', 
        'AMZN', 'META', 'JPM', 'GS', 'AMD',
        'NFLX', 'CRM', 'ORCL', 'INTC', 'IBM',
        'BA', 'CAT', 'DIS', 'KO', 'PEP'
    ],
    'etfs': [
        'SPY', 'QQQ', 'IWM', 'DIA', 'EEM',
        'XLF', 'XLE', 'XLK', 'GLD', 'TLT',
        'VXX', 'HYG', 'LQD', 'IEF', 'USO'
    ],
    'crypto': [
        'BTC-USD', 'ETH-USD', 'BNB-USD', 'SOL-USD', 'XRP-USD',
        'ADA-USD', 'AVAX-USD', 'DOGE-USD', 'LINK-USD', 'MATIC-USD'
    ]
}

ALL_SYMBOLS = (
    ASSET_UNIVERSE['stocks'] + 
    ASSET_UNIVERSE['etfs'] + 
    ASSET_UNIVERSE['crypto']
)


def get_asset_class(symbol: str) -> str:
    """Determine asset class from symbol."""
    if symbol in ASSET_UNIVERSE['stocks']:
        return 'stock'
    elif symbol in ASSET_UNIVERSE['etfs']:
        return 'etf'
    elif symbol in ASSET_UNIVERSE['crypto'] or '-USD' in symbol:
        return 'crypto'
    return 'unknown'


def fetch_symbol_data(
    symbol: str,
    start_date: datetime,
    end_date: datetime,
    max_retries: int = 3
) -> Optional[pd.DataFrame]:
    """
    Fetch OHLCV data for a single symbol.
    
    Args:
        symbol: Ticker symbol
        start_date: Start date for data
        end_date: End date for data
        max_retries: Number of retry attempts
        
    Returns:
        DataFrame with OHLCV data or None if failed
    """
    for attempt in range(max_retries):
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(
                start=start_date,
                end=end_date,
                interval='1d',
                auto_adjust=True  # Adjust for splits/dividends
            )
            
            if len(df) < 100:
                logger.warning(f"{symbol}: Insufficient data ({len(df)} rows)")
                return None
            
            # Standardize column names
            df = df.rename(columns={
                'Open': 'open',
                'High': 'high',
                'Low': 'low',
                'Close': 'close',
                'Volume': 'volume'
            })
            
            # Keep only OHLCV
            df = df[['open', 'high', 'low', 'close', 'volume']].copy()
            df['symbol'] = symbol
            df['asset_class'] = get_asset_class(symbol)
            
            # Reset index to get date as column
            df = df.reset_index()
            df = df.rename(columns={'Date': 'date', 'index': 'date'})
            
            # Ensure date is datetime
            if 'date' in df.columns:
                df['date'] = pd.to_datetime(df['date']).dt.tz_localize(None)
            
            logger.info(f"✓ {symbol}: {len(df)} rows fetched")
            return df
            
        except Exception as e:
            logger.warning(f"{symbol} attempt {attempt + 1} failed: {e}")
            time.sleep(1)
    
    logger.error(f"✗ {symbol}: All attempts failed")
    return None


def fetch_all_data(
    symbols: List[str] = None,
    years: int = 5,
    output_dir: Path = None
) -> Tuple[pd.DataFrame, Dict]:
    """
    Fetch historical data for all symbols.
    
    Args:
        symbols: List of symbols (defaults to ALL_SYMBOLS)
        years: Number of years of history
        output_dir: Directory to save data
        
    Returns:
        Tuple of (combined DataFrame, metadata dict)
    """
    if symbols is None:
        symbols = ALL_SYMBOLS
    
    if output_dir is None:
        output_dir = Path(__file__).parent / 'data'
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    end_date = datetime.now()
    start_date = end_date - timedelta(days=years * 365)
    
    logger.info(f"📊 Fetching {len(symbols)} symbols from {start_date.date()} to {end_date.date()}")
    
    all_data = []
    metadata = {
        'fetch_timestamp': datetime.now().isoformat(),
        'start_date': start_date.isoformat(),
        'end_date': end_date.isoformat(),
        'symbols_requested': len(symbols),
        'symbols_fetched': 0,
        'symbols_failed': [],
        'total_rows': 0,
        'asset_breakdown': {}
    }
    
    for symbol in symbols:
        df = fetch_symbol_data(symbol, start_date, end_date)
        if df is not None:
            all_data.append(df)
            metadata['symbols_fetched'] += 1
        else:
            metadata['symbols_failed'].append(symbol)
        
        # Rate limiting
        time.sleep(0.2)
    
    if not all_data:
        raise ValueError("No data fetched for any symbol")
    
    # Combine all data
    combined = pd.concat(all_data, ignore_index=True)
    metadata['total_rows'] = len(combined)
    
    # Asset breakdown
    for asset_class in combined['asset_class'].unique():
        subset = combined[combined['asset_class'] == asset_class]
        metadata['asset_breakdown'][asset_class] = {
            'symbols': subset['symbol'].nunique(),
            'rows': len(subset)
        }
    
    # Save to parquet (efficient storage)
    output_file = output_dir / 'raw_ohlcv.parquet'
    combined.to_parquet(output_file, index=False)
    logger.info(f"💾 Saved {len(combined):,} rows to {output_file}")
    
    # Save metadata
    metadata_file = output_dir / 'fetch_metadata.json'
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=2, default=str)
    
    return combined, metadata


def load_cached_data(data_dir: Path = None) -> Optional[pd.DataFrame]:
    """Load previously fetched data if available and recent."""
    if data_dir is None:
        data_dir = Path(__file__).parent / 'data'
    
    parquet_file = data_dir / 'raw_ohlcv.parquet'
    metadata_file = data_dir / 'fetch_metadata.json'
    
    if not parquet_file.exists() or not metadata_file.exists():
        return None
    
    # Check if data is recent (less than 24 hours old)
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    
    fetch_time = datetime.fromisoformat(metadata['fetch_timestamp'])
    if datetime.now() - fetch_time > timedelta(hours=24):
        logger.info("Cached data is stale (>24 hours)")
        return None
    
    df = pd.read_parquet(parquet_file)
    logger.info(f"📂 Loaded {len(df):,} rows from cache")
    return df


if __name__ == '__main__':
    # Test data fetching
    df, metadata = fetch_all_data(years=5)
    print(f"\nFetched {metadata['symbols_fetched']}/{metadata['symbols_requested']} symbols")
    print(f"Total rows: {metadata['total_rows']:,}")
    print(f"Asset breakdown: {json.dumps(metadata['asset_breakdown'], indent=2)}")
