// Feature Engineering Service - 55 features matching Python exactly

import { type AssetData } from './mlDataLayer';

interface ScalerData {
  mean: number[];
  scale: number[];
  feature_names: string[];
}

let scalerData: ScalerData | null = null;
let scalerLoading: Promise<void> | null = null;

async function loadScaler(): Promise<ScalerData | null> {
  if (scalerData) return scalerData;
  if (!scalerLoading) {
    scalerLoading = (async () => {
      try {
        let response = await fetch('/alpha-mirage/models/scaler.json');
        if (!response.ok) response = await fetch('/models/scaler.json');
        if (response.ok) {
          scalerData = await response.json();
          console.log('Loaded scaler with ' + scalerData?.feature_names.length + ' features');
        }
      } catch (e) {
        console.error('Failed to load scaler:', e);
      }
    })();
  }
  await scalerLoading;
  return scalerData;
}

loadScaler();

export interface FeatureVector {
  symbol: string;
  timestamp: number;
  returns_1d: number;
  log_returns_1d: number;
  returns_2d: number;
  log_returns_2d: number;
  returns_3d: number;
  log_returns_3d: number;
  returns_5d: number;
  log_returns_5d: number;
  returns_10d: number;
  log_returns_10d: number;
  returns_20d: number;
  log_returns_20d: number;
  price_to_sma5: number;
  price_to_sma10: number;
  price_to_sma20: number;
  price_to_sma50: number;
  sma_5_10_cross: number;
  sma_10_20_cross: number;
  sma_20_50_cross: number;
  rsi_7: number;
  rsi_14: number;
  rsi_21: number;
  momentum_5d: number;
  roc_5d: number;
  momentum_10d: number;
  roc_10d: number;
  momentum_20d: number;
  roc_20d: number;
  macd: number;
  macd_signal: number;
  macd_histogram: number;
  macd_cross: number;
  volatility_5d: number;
  volatility_10d: number;
  volatility_20d: number;
  atr_5: number;
  atr_10: number;
  atr_14: number;
  atr_pct_5: number;
  atr_pct_14: number;
  bb_position: number;
  bb_width: number;
  adx_14: number;
  trend_strength: number;
  volume_ratio: number;
  obv_change: number;
  body_ratio: number;
  upper_shadow: number;
  lower_shadow: number;
  higher_high: number;
  lower_low: number;
  higher_close: number;
  skewness: number;
  kurtosis: number;
  zscore: number;
}

function sma(values: number[], period: number): number {
  if (values.length < period) return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const alpha = 2 / (period + 1);
  let result = values[0];
  for (let i = 1; i < values.length; i++) result = values[i] * alpha + result * (1 - alpha);
  return result;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.map(v => Math.pow(v - mean, 2)).reduce((a, b) => a + b, 0) / (values.length - 1));
}

function calculateRSI(closes: number[], period: number): number {
  if (closes.length < period + 1) return 50;
  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);
  const alpha = 1 / period;
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < Math.min(period, changes.length); i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    avgGain = avgGain * (1 - alpha) + (changes[i] > 0 ? changes[i] : 0) * alpha;
    avgLoss = avgLoss * (1 - alpha) + (changes[i] < 0 ? Math.abs(changes[i]) : 0) * alpha;
  }
  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

function trueRange(high: number, low: number, prevClose: number): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

function calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
  if (highs.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) trs.push(trueRange(highs[i], lows[i], closes[i - 1]));
  return sma(trs.slice(-period), period);
}

function calculateMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLine = ema12 - ema26;
  const macdValues: number[] = [];
  for (let i = 26; i <= closes.length; i++) macdValues.push(ema(closes.slice(0, i), 12) - ema(closes.slice(0, i), 26));
  const signalLine = macdValues.length >= 9 ? ema(macdValues, 9) : macdLine;
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
}

function calculateBollinger(closes: number[], period: number = 20): { position: number; width: number } {
  const middle = sma(closes.slice(-period), period);
  const std = stdDev(closes.slice(-period));
  const upper = middle + 2 * std;
  const lower = middle - 2 * std;
  const current = closes[closes.length - 1];
  return {
    position: (upper - lower) > 0 ? (current - lower) / (upper - lower) : 0.5,
    width: middle > 0 ? (upper - lower) / middle : 0
  };
}

function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
  if (highs.length < period + 1) return 25;
  const plusDM: number[] = [], minusDM: number[] = [], tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(trueRange(highs[i], lows[i], closes[i - 1]));
  }
  const smoothTR = ema(tr, period);
  const plusDI = smoothTR > 0 ? 100 * ema(plusDM, period) / smoothTR : 0;
  const minusDI = smoothTR > 0 ? 100 * ema(minusDM, period) / smoothTR : 0;
  return (plusDI + minusDI) > 0 ? 100 * Math.abs(plusDI - minusDI) / (plusDI + minusDI) : 0;
}

function calculateSkewness(values: number[]): number {
  if (values.length < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = stdDev(values);
  if (std === 0) return 0;
  return values.map(v => Math.pow((v - mean) / std, 3)).reduce((a, b) => a + b, 0) / values.length;
}

function calculateKurtosis(values: number[]): number {
  if (values.length < 4) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const std = stdDev(values);
  if (std === 0) return 0;
  return (values.map(v => Math.pow((v - mean) / std, 4)).reduce((a, b) => a + b, 0) / values.length) - 3;
}

function calculateOBV(closes: number[], volumes: number[]): number[] {
  if (closes.length < 2) return [0];
  const obv: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    obv.push(obv[obv.length - 1] + (closes[i] > closes[i-1] ? volumes[i] : closes[i] < closes[i-1] ? -volumes[i] : 0));
  }
  return obv;
}

export function calculateFeatures(asset: AssetData): FeatureVector | null {
  const { historicalData, symbol, currentPrice } = asset;
  if (!historicalData || historicalData.length < 50) return null;
  
  const opens = historicalData.map(d => d.open);
  const highs = historicalData.map(d => d.high);
  const lows = historicalData.map(d => d.low);
  const closes = historicalData.map(d => d.close);
  const volumes = historicalData.map(d => d.volume);
  
  if (closes[closes.length - 1] !== currentPrice && currentPrice > 0) {
    closes.push(currentPrice);
    opens.push(currentPrice);
    highs.push(currentPrice);
    lows.push(currentPrice);
    volumes.push(volumes[volumes.length - 1] || 0);
  }
  
  const n = closes.length;
  const calcRet = (p: number) => n > p && closes[n-1-p] > 0 ? (closes[n-1] - closes[n-1-p]) / closes[n-1-p] : 0;
  const calcLogRet = (p: number) => n > p && closes[n-1-p] > 0 ? Math.log(closes[n-1] / closes[n-1-p]) : 0;
  
  const dailyReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) dailyReturns.push(closes[i-1] > 0 ? (closes[i] - closes[i-1]) / closes[i-1] : 0);
  
  const sma5 = sma(closes, 5), sma10 = sma(closes, 10), sma20 = sma(closes, 20), sma50 = sma(closes, 50);
  const mom = (p: number) => n > p ? closes[n-1] - closes[n-1-p] : 0;
  const roc = (p: number) => n > p && closes[n-1-p] > 0 ? ((closes[n-1] - closes[n-1-p]) / closes[n-1-p]) * 100 : 0;
  
  const macdResult = calculateMACD(closes);
  const atr5 = calculateATR(highs, lows, closes, 5);
  const atr10 = calculateATR(highs, lows, closes, 10);
  const atr14 = calculateATR(highs, lows, closes, 14);
  const bollinger = calculateBollinger(closes, Math.min(20, closes.length));
  const adx14 = calculateADX(highs, lows, closes, 14);
  
  const volumeSma10 = sma(volumes, 10);
  const obv = calculateOBV(closes, volumes);
  const obvChange = obv.length >= 6 && obv[obv.length - 6] !== 0 ? (obv[obv.length - 1] - obv[obv.length - 6]) / Math.abs(obv[obv.length - 6]) : 0;
  
  const last = { o: opens[n-1], h: highs[n-1], l: lows[n-1], c: closes[n-1] };
  const rangeHL = last.h - last.l + 1e-10;
  
  const trendStrength = ([sma5, sma10, sma20, sma50].filter(s => last.c > s).length) / 4;
  const recentReturns = dailyReturns.slice(-20);
  const meanRet = recentReturns.length > 0 ? recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length : 0;
  const stdRet = stdDev(recentReturns);
  const zscore = stdRet > 0 && dailyReturns.length > 0 ? (dailyReturns[dailyReturns.length - 1] - meanRet) / stdRet : 0;
  
  return {
    symbol, timestamp: Date.now(),
    returns_1d: calcRet(1), log_returns_1d: calcLogRet(1),
    returns_2d: calcRet(2), log_returns_2d: calcLogRet(2),
    returns_3d: calcRet(3), log_returns_3d: calcLogRet(3),
    returns_5d: calcRet(5), log_returns_5d: calcLogRet(5),
    returns_10d: calcRet(10), log_returns_10d: calcLogRet(10),
    returns_20d: calcRet(20), log_returns_20d: calcLogRet(20),
    price_to_sma5: sma5 > 0 ? last.c / sma5 : 1,
    price_to_sma10: sma10 > 0 ? last.c / sma10 : 1,
    price_to_sma20: sma20 > 0 ? last.c / sma20 : 1,
    price_to_sma50: sma50 > 0 ? last.c / sma50 : 1,
    sma_5_10_cross: sma10 > 0 ? sma5 / sma10 : 1,
    sma_10_20_cross: sma20 > 0 ? sma10 / sma20 : 1,
    sma_20_50_cross: sma50 > 0 ? sma20 / sma50 : 1,
    rsi_7: calculateRSI(closes, 7), rsi_14: calculateRSI(closes, 14), rsi_21: calculateRSI(closes, 21),
    momentum_5d: mom(5), roc_5d: roc(5), momentum_10d: mom(10), roc_10d: roc(10), momentum_20d: mom(20), roc_20d: roc(20),
    macd: macdResult.macd, macd_signal: macdResult.signal, macd_histogram: macdResult.histogram, macd_cross: macdResult.macd - macdResult.signal,
    volatility_5d: stdDev(dailyReturns.slice(-5)) * Math.sqrt(252),
    volatility_10d: stdDev(dailyReturns.slice(-10)) * Math.sqrt(252),
    volatility_20d: stdDev(dailyReturns.slice(-20)) * Math.sqrt(252),
    atr_5: atr5, atr_10: atr10, atr_14: atr14,
    atr_pct_5: last.c > 0 ? atr5 / last.c : 0, atr_pct_14: last.c > 0 ? atr14 / last.c : 0,
    bb_position: bollinger.position, bb_width: bollinger.width,
    adx_14: adx14, trend_strength: trendStrength,
    volume_ratio: volumeSma10 > 0 ? (volumes[n-1] || volumeSma10) / volumeSma10 : 1,
    obv_change: isFinite(obvChange) ? obvChange : 0,
    body_ratio: (last.c - last.o) / rangeHL,
    upper_shadow: (last.h - Math.max(last.o, last.c)) / rangeHL,
    lower_shadow: (Math.min(last.o, last.c) - last.l) / rangeHL,
    higher_high: n >= 2 && highs[n-1] > highs[n-2] ? 1 : 0,
    lower_low: n >= 2 && lows[n-1] < lows[n-2] ? 1 : 0,
    higher_close: dailyReturns.length > 0 && dailyReturns[dailyReturns.length - 1] > 0 ? 1 : 0,
    skewness: calculateSkewness(recentReturns), kurtosis: calculateKurtosis(recentReturns),
    zscore: isFinite(zscore) ? zscore : 0,
  };
}

export function normalizeFeatures(features: FeatureVector): number[] {
  const arr: number[] = [
    features.returns_1d, features.log_returns_1d, features.returns_2d, features.log_returns_2d,
    features.returns_3d, features.log_returns_3d, features.returns_5d, features.log_returns_5d,
    features.returns_10d, features.log_returns_10d, features.returns_20d, features.log_returns_20d,
    features.price_to_sma5, features.price_to_sma10, features.price_to_sma20, features.price_to_sma50,
    features.sma_5_10_cross, features.sma_10_20_cross, features.sma_20_50_cross,
    features.rsi_7, features.rsi_14, features.rsi_21,
    features.momentum_5d, features.roc_5d, features.momentum_10d, features.roc_10d, features.momentum_20d, features.roc_20d,
    features.macd, features.macd_signal, features.macd_histogram, features.macd_cross,
    features.volatility_5d, features.volatility_10d, features.volatility_20d,
    features.atr_5, features.atr_10, features.atr_14, features.atr_pct_5, features.atr_pct_14,
    features.bb_position, features.bb_width, features.adx_14, features.trend_strength,
    features.volume_ratio, features.obv_change,
    features.body_ratio, features.upper_shadow, features.lower_shadow, features.higher_high, features.lower_low, features.higher_close,
    features.skewness, features.kurtosis, features.zscore,
  ];
  
  if (scalerData && scalerData.mean.length === 55 && scalerData.scale.length === 55) {
    return arr.map((val, i) => {
      if (!isFinite(val)) val = scalerData!.mean[i];
      const scaled = (val - scalerData!.mean[i]) / (scalerData!.scale[i] || 1);
      return Math.max(-5, Math.min(5, scaled));
    });
  }
  return arr.map(v => isFinite(v) ? Math.max(-5, Math.min(5, v)) : 0);
}

export function calculateAllFeatures(assets: AssetData[]): Map<string, FeatureVector> {
  const map = new Map<string, FeatureVector>();
  for (const asset of assets) {
    const f = calculateFeatures(asset);
    if (f) map.set(asset.symbol, f);
  }
  return map;
}

export async function ensureScalerLoaded(): Promise<boolean> {
  await loadScaler();
  return scalerData !== null;
}

export function getScalerInfo(): { loaded: boolean; featureCount: number } {
  return { loaded: scalerData !== null, featureCount: scalerData?.feature_names.length || 0 };
}
