import { useState, useEffect, useMemo } from "react"
import { useTranslation } from "@/i18n"

// Import shared utilities from market data service
import { getQuote, getQuotes, hasCachedData, getHistoricalCandles } from "@/services/marketData"

// Technical indicator calculations (duplicated from InteractiveEffects for mobile version)
function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50
  let gains = 0, losses = 0
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / period
  const avgLoss = losses / period
  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - (100 / (1 + rs))
}

function calcMomentum(closes: number[], period: number): number {
  if (closes.length < period) return 0
  const current = closes[closes.length - 1]
  const past = closes[closes.length - period]
  return past > 0 ? ((current - past) / past) * 100 : 0
}

function calcSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0
  const slice = closes.slice(-period)
  return slice.reduce((a, b) => a + b, 0) / period
}

function calcVolatility(closes: number[]): number {
  if (closes.length < 2) return 0
  const returns: number[] = []
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1])
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

// ============================================
// MOBILE WIDGETS SECTION - Shown only on mobile
// Contains all 5 main widgets in a scrollable section
// ============================================
export function MobileWidgetsSection() {
  const { t } = useTranslation()
  
  return (
    <section 
      id="mobile-widgets" 
      className="block sm:hidden relative z-50 py-8 px-4 border-t border-b border-cyan-500/30"
      style={{ backgroundColor: '#030305', isolation: 'isolate' }}
    >
      {/* Multiple solid background layers to ensure complete opacity */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0" style={{ backgroundColor: '#030305' }} />
      
      <div className="max-w-lg mx-auto relative z-10">
        <h2 className="text-xl font-bold text-center mb-6 text-cyan-400 flex items-center justify-center gap-2">
          <span className="text-2xl">📊</span>
          <span>{t('Live Trading Widgets')}</span>
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        </h2>
        
        <div className="space-y-4">
          {/* Black-Scholes Greeks Widget */}
          <MobileGreeksWidget />
          
          {/* Alpha Signals Widget */}
          <MobileAlphaSignalsWidget />
          
          {/* Order Book / Market Depth Widget */}
          <MobileOrderBookWidget />
          
          {/* Backtest Engine Widget */}
          <MobileBacktestWidget />
          
          {/* Portfolio Analytics Widget */}
          <MobilePortfolioWidget />
        </div>
      </div>
    </section>
  )
}

// ============================================
// MOBILE GREEKS WIDGET (Black-Scholes)
// ============================================
function MobileGreeksWidget() {
  const { t } = useTranslation()
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [greeks, setGreeks] = useState({ delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, callPrice: 0 })
  const [isLive, setIsLive] = useState(false)
  
  const indices = [
    { symbol: 'SPX', name: 'S&P 500', spot: 4750, strike: 4750, iv: 0.14, expiry: 21, rate: 0.0525 },
    { symbol: 'NDX', name: 'NASDAQ', spot: 16800, strike: 16800, iv: 0.18, expiry: 21, rate: 0.0525 },
    { symbol: 'DJI', name: 'Dow Jones', spot: 37500, strike: 37500, iv: 0.12, expiry: 21, rate: 0.0525 },
  ]
  
  const calculateGreeks = (S: number, K: number, r: number, sigma: number, T: number) => {
    if (T <= 0) T = 0.001
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T))
    const d2 = d1 - sigma * Math.sqrt(T)
    const pdf = (x: number) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI)
    const cdf = (x: number) => {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
      const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
      const sign = x < 0 ? -1 : 1
      const absX = Math.abs(x) / Math.sqrt(2)
      const t = 1 / (1 + p * absX)
      const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX)
      return 0.5 * (1 + sign * y)
    }
    const Nd1 = cdf(d1), Nd2 = cdf(d2)
    const callPrice = S * Nd1 - K * Math.exp(-r * T) * Nd2
    const delta = Nd1
    const gamma = pdf(d1) / (S * sigma * Math.sqrt(T))
    const theta = (-(S * pdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2) / 365
    const vega = S * pdf(d1) * Math.sqrt(T) / 100
    const rho = K * T * Math.exp(-r * T) * Nd2 / 100
    return { delta, gamma, theta, vega, rho, callPrice }
  }
  
  useEffect(() => {
    const idx = indices[selectedIndex]
    const T = idx.expiry / 365
    setGreeks(calculateGreeks(idx.spot, idx.strike, idx.rate, idx.iv, T))
    if (hasCachedData()) setIsLive(true)
  }, [selectedIndex])
  
  const currentIdx = indices[selectedIndex]
  
  return (
    <div className="bg-[#0a0a0f] border border-purple-500/40 rounded-lg p-3 font-mono">
      <div className="flex items-center justify-between mb-2 border-b border-purple-500/20 pb-2">
        <span className="text-purple-400 font-bold text-sm">{t('BLACK-SCHOLES GREEKS')}</span>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <span className="text-[10px] text-foreground/50">{isLive ? t('LIVE') : t('DEMO')}</span>
        </div>
      </div>
      
      {/* Index Selector */}
      <div className="flex gap-1 mb-3">
        {indices.map((idx, i) => (
          <button
            key={idx.symbol}
            onClick={() => setSelectedIndex(i)}
            className={`px-2 py-1 rounded text-xs transition-colors ${
              selectedIndex === i 
                ? 'bg-purple-500/40 text-purple-300 border border-purple-500/50' 
                : 'bg-foreground/5 text-foreground/50'
            }`}
          >
            {idx.symbol}
          </button>
        ))}
      </div>
      
      {/* Parameters */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div className="text-center">
          <div className="text-foreground/50">{t('SPOT')}</div>
          <div className="text-cyan-400">{currentIdx.spot.toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="text-foreground/50">{t('STRIKE')}</div>
          <div className="text-foreground">{currentIdx.strike.toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="text-foreground/50">{t('IV')}</div>
          <div className="text-yellow-400">{(currentIdx.iv * 100).toFixed(1)}%</div>
        </div>
        <div className="text-center">
          <div className="text-foreground/50">{t('DTE')}</div>
          <div className="text-foreground/70">{currentIdx.expiry}d</div>
        </div>
      </div>
      
      {/* Call Price */}
      <div className="bg-green-500/10 border border-green-500/30 rounded px-2 py-1.5 mb-3 flex justify-between">
        <span className="text-green-400">{t('CALL VALUE')}</span>
        <span className="text-green-400 font-bold">${greeks.callPrice.toFixed(2)}</span>
      </div>
      
      {/* Greeks */}
      <div className="space-y-1 text-xs">
        <div className="flex justify-between"><span className="text-foreground/60">Δ Delta</span><span className="text-green-400">{greeks.delta.toFixed(4)}</span></div>
        <div className="flex justify-between"><span className="text-foreground/60">Γ Gamma</span><span className="text-cyan-400">{greeks.gamma.toFixed(6)}</span></div>
        <div className="flex justify-between"><span className="text-foreground/60">Θ Theta</span><span className="text-red-400">{greeks.theta.toFixed(4)}</span></div>
        <div className="flex justify-between"><span className="text-foreground/60">ν Vega</span><span className="text-purple-400">{greeks.vega.toFixed(4)}</span></div>
        <div className="flex justify-between"><span className="text-foreground/60">ρ Rho</span><span className="text-yellow-400">{greeks.rho.toFixed(4)}</span></div>
      </div>
    </div>
  )
}

// ============================================
// MOBILE ALPHA SIGNALS WIDGET
// ============================================
const ASIA_ASSETS = [
  { symbol: '9988.HK', name: 'Alibaba HK' },
  { symbol: 'D05.SI', name: 'DBS Bank' },
]

function MobileAlphaSignalsWidget() {
  const { t } = useTranslation()
  const [signals, setSignals] = useState<{symbol: string, name: string, price: number, change: number, signal: string, alphaScore: number, rsi14: number}[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    const fetchSignals = async () => {
      const newSignals: typeof signals = []
      for (const asset of ASIA_ASSETS) {
        const quote = getQuote(asset.symbol)
        if (!quote) continue
        const candles = await getHistoricalCandles(asset.symbol)
        let rsi14 = 50, momentum5d = 0, trendStrength = 0
        if (candles && candles.closes.length > 0) {
          const closes = candles.closes
          rsi14 = calcRSI(closes, 14)
          momentum5d = calcMomentum(closes, 5)
          const sma20 = calcSMA(closes, 20)
          trendStrength = sma20 > 0 ? ((quote.price - sma20) / sma20) * 100 : 0
        }
        const momFactor = Math.max(-1, Math.min(1, momentum5d / 5))
        const rsiFactor = (50 - rsi14) / 50
        const trendFactor = Math.max(-1, Math.min(1, trendStrength / 5))
        const dailyFactor = Math.max(-1, Math.min(1, quote.change / 2))
        const alphaScore = Math.max(-1, Math.min(1, momFactor * 0.30 + rsiFactor * 0.25 + trendFactor * 0.25 + dailyFactor * 0.20))
        const signal = alphaScore > 0.15 ? 'LONG' : alphaScore < -0.15 ? 'SHORT' : 'HOLD'
        newSignals.push({ symbol: asset.symbol, name: asset.name, price: quote.price, change: quote.change, signal, alphaScore, rsi14 })
      }
      if (newSignals.length > 0) { setSignals(newSignals); setIsLoading(false) }
    }
    if (hasCachedData()) fetchSignals()
    const timer = setTimeout(() => { if (hasCachedData()) fetchSignals() }, 2000)
    return () => clearTimeout(timer)
  }, [])
  
  const getSignalColor = (signal: string) => {
    if (signal === 'LONG') return 'text-green-400 bg-green-500/20 border-green-500/30'
    if (signal === 'SHORT') return 'text-red-400 bg-red-500/20 border-red-500/30'
    return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
  }
  
  if (isLoading) {
    return (
      <div className="bg-[#0a0a0f] border border-purple-500/40 rounded-lg p-3 font-mono">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-purple-400 font-bold text-sm">🤖 {t('Alpha Signals')}</span>
        </div>
        <div className="text-center py-4 text-foreground/50">
          <div className="animate-spin w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full mx-auto mb-2" />
          <div className="text-xs">{t('Loading signals...')}</div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="bg-[#0a0a0f] border border-purple-500/40 rounded-lg p-3 font-mono">
      <div className="flex items-center justify-between mb-2 border-b border-purple-500/20 pb-2">
        <span className="text-purple-400 font-bold text-sm">🤖 {t('Alpha Signals')}</span>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-foreground/50">{t('LIVE')}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        {signals.map((s) => (
          <div key={s.symbol} className="bg-[#0f1218] rounded-lg p-2 border border-purple-500/20">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">{s.symbol}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded border font-bold ${getSignalColor(s.signal)}`}>{s.signal}</span>
              </div>
              <span className={`text-sm ${s.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {s.change >= 0 ? '▲' : '▼'} {Math.abs(s.change).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-foreground">${s.price.toFixed(2)}</span>
              <span className={`${s.alphaScore >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                α: {s.alphaScore >= 0 ? '+' : ''}{s.alphaScore.toFixed(3)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// MOBILE ORDER BOOK WIDGET
// ============================================
function MobileOrderBookWidget() {
  const { t } = useTranslation()
  const [orderBook, setOrderBook] = useState({
    bids: [
      { price: 189.45, size: 2500 }, { price: 189.44, size: 1800 }, { price: 189.43, size: 3200 },
    ],
    asks: [
      { price: 189.46, size: 2100 }, { price: 189.47, size: 1600 }, { price: 189.48, size: 2800 },
    ],
  })
  
  useEffect(() => {
    const interval = setInterval(() => {
      setOrderBook(prev => ({
        bids: prev.bids.map(order => ({ ...order, size: Math.max(500, order.size + Math.floor((Math.random() - 0.5) * 800)) })),
        asks: prev.asks.map(order => ({ ...order, size: Math.max(500, order.size + Math.floor((Math.random() - 0.5) * 800)) })),
      }))
    }, 2000)
    return () => clearInterval(interval)
  }, [])
  
  const maxSize = Math.max(...orderBook.bids.map(o => o.size), ...orderBook.asks.map(o => o.size))
  
  return (
    <div className="bg-[#0a0a0f] border border-cyan-500/20 rounded-lg p-3 font-mono">
      <div className="text-cyan-400 font-bold mb-2 text-sm">{t('ORDER BOOK')}</div>
      
      {/* Asks */}
      <div className="space-y-0.5 mb-1 text-xs">
        {[...orderBook.asks].reverse().map((order, i) => (
          <div key={`ask-${i}`} className="relative flex justify-between">
            <div className="absolute right-0 top-0 bottom-0 bg-red-500/20" style={{ width: `${(order.size / maxSize) * 100}%` }} />
            <span className="relative text-red-400">{order.price.toFixed(2)}</span>
            <span className="relative text-foreground/50">{order.size.toLocaleString()}</span>
          </div>
        ))}
      </div>
      
      <div className="border-t border-b border-cyan-500/30 py-1 my-1 text-center text-xs">
        <span className="text-cyan-400">{t('Spread')}: </span>
        <span className="text-foreground/70">$0.01</span>
      </div>
      
      {/* Bids */}
      <div className="space-y-0.5 text-xs">
        {orderBook.bids.map((order, i) => (
          <div key={`bid-${i}`} className="relative flex justify-between">
            <div className="absolute left-0 top-0 bottom-0 bg-green-500/20" style={{ width: `${(order.size / maxSize) * 100}%` }} />
            <span className="relative text-green-400">{order.price.toFixed(2)}</span>
            <span className="relative text-foreground/50">{order.size.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================
// MOBILE BACKTEST WIDGET
// ============================================
function MobileBacktestWidget() {
  const { t } = useTranslation()
  const [selectedStrategy, setSelectedStrategy] = useState('momentum')
  const [metrics] = useState({
    cagr: 18.5, sharpe: 1.42, sortino: 1.95, maxDrawdown: 12.3,
    winRate: 54.2, profitFactor: 1.65, totalTrades: 156,
  })
  
  return (
    <div className="bg-[#0a0a0f] border border-purple-500/40 rounded-lg p-3 font-mono">
      <div className="flex items-center justify-between mb-2 border-b border-purple-500/20 pb-2">
        <span className="text-purple-400 font-bold text-sm">{t('BACKTEST ENGINE')}</span>
        <span className="text-foreground/40 text-xs">12M</span>
      </div>
      
      <select 
        value={selectedStrategy}
        onChange={(e) => setSelectedStrategy(e.target.value)}
        className="w-full bg-[#0f1218] border border-purple-500/30 rounded px-2 py-1.5 text-xs text-foreground mb-3"
      >
        <option value="momentum">📈 Cross-Sectional Momentum</option>
        <option value="meanrev">🔄 Mean Reversion (RSI)</option>
        <option value="pairs">⚖️ Statistical Arbitrage</option>
      </select>
      
      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-2 text-center bg-[#0f1218] rounded-lg p-2">
        <div>
          <div className="text-foreground/50 text-[10px]">{t('SHARPE')}</div>
          <div className="font-bold text-sm text-green-400">{metrics.sharpe.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-foreground/50 text-[10px]">{t('SORTINO')}</div>
          <div className="font-bold text-sm text-green-400">{metrics.sortino.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-foreground/50 text-[10px]">{t('MAX DD')}</div>
          <div className="font-bold text-sm text-red-400">-{metrics.maxDrawdown.toFixed(1)}%</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-foreground/50">{t('Win Rate')}</span>
          <span className="text-green-400">{metrics.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground/50">{t('Profit Factor')}</span>
          <span className="text-green-400">{metrics.profitFactor.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground/50">{t('Total Trades')}</span>
          <span className="text-foreground">{metrics.totalTrades}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-foreground/50">CAGR</span>
          <span className="text-green-400">+{metrics.cagr.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// MOBILE PORTFOLIO WIDGET
// ============================================
function MobilePortfolioWidget() {
  const { t } = useTranslation()
  const [metrics, setMetrics] = useState({
    portfolioValue: 0, dailyPnL: 0, dailyPnLPercent: 0,
    sharpeRatio: 0, volatility: 0, beta: 1.25, alpha: 0,
  })
  const [holdings, setHoldings] = useState<{symbol: string, change: number}[]>([])
  const [isLive, setIsLive] = useState(false)
  
  useEffect(() => {
    const updateFromCache = () => {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'AMZN', 'META']
      const quotes = getQuotes(symbols)
      if (quotes.length === 0) return
      
      let totalValue = 0, totalPnL = 0, portfolioReturn = 0
      const newHoldings: typeof holdings = []
      
      quotes.forEach(quote => {
        const shares = 100
        const value = quote.price * shares
        const prevClose = quote.prevClose || quote.price
        const pnl = (quote.price - prevClose) * shares
        totalValue += value
        totalPnL += pnl
        portfolioReturn += (1/6) * quote.change
        newHoldings.push({ symbol: quote.symbol, change: quote.change })
      })
      
      if (newHoldings.length > 0) {
        setHoldings(newHoldings)
        setMetrics({
          portfolioValue: totalValue,
          dailyPnL: totalPnL,
          dailyPnLPercent: portfolioReturn,
          sharpeRatio: portfolioReturn > 0 ? 1.5 : -0.5,
          volatility: 22.5,
          beta: 1.25,
          alpha: portfolioReturn * 252 - 10,
        })
        setIsLive(true)
      }
    }
    
    if (hasCachedData()) updateFromCache()
    const timer = setTimeout(() => { if (hasCachedData()) updateFromCache() }, 2000)
    return () => clearTimeout(timer)
  }, [])
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
  
  return (
    <div className="bg-[#0a0a0f] border border-green-500/40 rounded-lg p-3 font-mono">
      <div className="flex items-center justify-between mb-2 border-b border-green-500/20 pb-2">
        <span className="text-green-400 font-bold text-sm">{t('PORTFOLIO ANALYTICS')}</span>
        <div className="flex items-center gap-1">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
          <span className="text-[10px] text-foreground/50">{isLive ? t('LIVE') : t('LOADING')}</span>
        </div>
      </div>
      
      {/* Portfolio Value */}
      <div className="mb-2">
        <div className="flex justify-between items-baseline">
          <span className="text-foreground/60 text-xs">{t('PORTFOLIO VALUE')}</span>
          <span className="text-foreground font-bold text-sm">{formatCurrency(metrics.portfolioValue)}</span>
        </div>
        <div className="flex justify-between items-baseline mt-0.5">
          <span className="text-foreground/60 text-xs">{t("TODAY'S P&L")}</span>
          <span className={`font-bold text-sm ${metrics.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.dailyPnL >= 0 ? '+' : ''}{formatCurrency(metrics.dailyPnL)}
          </span>
        </div>
      </div>
      
      {/* Holdings Grid */}
      <div className="mb-2">
        <div className="text-foreground/50 text-[10px] mb-1">{t('HOLDINGS')} ({holdings.length})</div>
        <div className="grid grid-cols-3 gap-1 text-xs">
          {holdings.slice(0, 6).map(h => (
            <div key={h.symbol} className="flex justify-between">
              <span className="text-foreground/70">{h.symbol}</span>
              <span className={h.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                {h.change >= 0 ? '+' : ''}{h.change.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Risk Metrics */}
      <div className="border-t border-green-500/20 pt-2">
        <div className="text-foreground/50 text-[10px] mb-1">{t('RISK METRICS')}</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <div className="flex justify-between">
            <span className="text-foreground/50">{t('Sharpe')}</span>
            <span className={metrics.sharpeRatio > 0 ? 'text-green-400' : 'text-red-400'}>{metrics.sharpeRatio.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">{t('Beta')}</span>
            <span className="text-cyan-400">{metrics.beta.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">{t('Volatility')}</span>
            <span className="text-orange-400">{metrics.volatility.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-foreground/50">{t('Alpha')}</span>
            <span className={metrics.alpha > 0 ? 'text-green-400' : 'text-red-400'}>
              {metrics.alpha > 0 ? '+' : ''}{metrics.alpha.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MobileWidgetsSection
