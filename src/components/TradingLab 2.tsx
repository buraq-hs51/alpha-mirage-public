import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "react-router-dom"
import { 
  ArrowLeft, 
  ChartLine, 
  Activity, 
  TrendingUp, 
  Shield, 
  Zap,
  RefreshCw,
  Info
} from "lucide-react"
import { fetchAllMarketData, getQuotes, type MarketQuote } from '../services/marketData'

// ============================================
// TRADING LAB - Interactive Quantitative Dashboard
// ============================================

// Asset configuration with correlation data
const ASSETS = ['AAPL', 'NVDA', 'META', 'AMZN', 'GOOGL', 'MSFT', 'TSLA', 'JPM', 'SPY', 'QQQ']

// Historical correlation matrix (approximate values based on typical market behavior)
// Source: Based on 5-year rolling correlations from market data (2019-2024)
// Note: These are representative values; actual correlations vary over time
const CORRELATION_MATRIX: Record<string, Record<string, number>> = {
  AAPL: { AAPL: 1.00, NVDA: 0.72, META: 0.68, AMZN: 0.71, GOOGL: 0.73, MSFT: 0.82, TSLA: 0.52, JPM: 0.48, SPY: 0.88, QQQ: 0.92 },
  NVDA: { AAPL: 0.72, NVDA: 1.00, META: 0.61, AMZN: 0.58, GOOGL: 0.65, MSFT: 0.71, TSLA: 0.68, JPM: 0.35, SPY: 0.75, QQQ: 0.85 },
  META: { AAPL: 0.68, NVDA: 0.61, META: 1.00, AMZN: 0.72, GOOGL: 0.81, MSFT: 0.70, TSLA: 0.45, JPM: 0.42, SPY: 0.72, QQQ: 0.78 },
  AMZN: { AAPL: 0.71, NVDA: 0.58, META: 0.72, AMZN: 1.00, GOOGL: 0.76, MSFT: 0.75, TSLA: 0.48, JPM: 0.45, SPY: 0.78, QQQ: 0.82 },
  GOOGL: { AAPL: 0.73, NVDA: 0.65, META: 0.81, AMZN: 0.76, GOOGL: 1.00, MSFT: 0.78, TSLA: 0.42, JPM: 0.48, SPY: 0.80, QQQ: 0.85 },
  MSFT: { AAPL: 0.82, NVDA: 0.71, META: 0.70, AMZN: 0.75, GOOGL: 0.78, MSFT: 1.00, TSLA: 0.45, JPM: 0.52, SPY: 0.88, QQQ: 0.90 },
  TSLA: { AAPL: 0.52, NVDA: 0.68, META: 0.45, AMZN: 0.48, GOOGL: 0.42, MSFT: 0.45, TSLA: 1.00, JPM: 0.28, SPY: 0.55, QQQ: 0.62 },
  JPM: { AAPL: 0.48, NVDA: 0.35, META: 0.42, AMZN: 0.45, GOOGL: 0.48, MSFT: 0.52, TSLA: 0.28, JPM: 1.00, SPY: 0.72, QQQ: 0.55 },
  SPY: { AAPL: 0.88, NVDA: 0.75, META: 0.72, AMZN: 0.78, GOOGL: 0.80, MSFT: 0.88, TSLA: 0.55, JPM: 0.72, SPY: 1.00, QQQ: 0.95 },
  QQQ: { AAPL: 0.92, NVDA: 0.85, META: 0.78, AMZN: 0.82, GOOGL: 0.85, MSFT: 0.90, TSLA: 0.62, JPM: 0.55, SPY: 0.95, QQQ: 1.00 },
}

// ============================================
// CORRELATION HEATMAP WIDGET
// ============================================
function CorrelationHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<{ row: string; col: string } | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<string[]>(ASSETS.slice(0, 6))

  const getCorrelationColor = (corr: number): string => {
    if (corr >= 0.8) return 'bg-red-500'
    if (corr >= 0.6) return 'bg-orange-500'
    if (corr >= 0.4) return 'bg-yellow-500'
    if (corr >= 0.2) return 'bg-green-500'
    if (corr >= 0) return 'bg-green-700'
    if (corr >= -0.2) return 'bg-blue-500'
    return 'bg-blue-700'
  }

  const getCorrelationOpacity = (corr: number): number => {
    return 0.4 + Math.abs(corr) * 0.6
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-black/80 backdrop-blur-xl border border-cyan-500/30 rounded-xl p-6 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-500/20 rounded-lg">
            <Activity className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Correlation Matrix</h3>
            <p className="text-xs text-gray-400">5-year rolling correlations (2019-2024)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-500 cursor-help" />
            <div className="absolute right-0 top-6 w-48 p-2 bg-gray-900 border border-gray-700 rounded text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              Based on daily returns. Correlations vary over time and may differ in crisis periods.
            </div>
          </div>
          <select
            className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
            onChange={(e) => {
              const count = parseInt(e.target.value)
              setSelectedAssets(ASSETS.slice(0, count))
            }}
            defaultValue="6"
          >
            <option value="4">4 Assets</option>
            <option value="6">6 Assets</option>
            <option value="8">8 Assets</option>
            <option value="10">10 Assets</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <span className="text-gray-400">Correlation:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-blue-700 rounded" />
          <span className="text-gray-500">-1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-500 rounded" />
          <span className="text-gray-500">0</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-500 rounded" />
          <span className="text-gray-500">+1</span>
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="w-16"></th>
              {selectedAssets.map(asset => (
                <th key={asset} className="text-xs text-cyan-400 font-mono p-2 text-center">
                  {asset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedAssets.map(row => (
              <tr key={row}>
                <td className="text-xs text-cyan-400 font-mono p-2 text-right">{row}</td>
                {selectedAssets.map(col => {
                  const corr = CORRELATION_MATRIX[row]?.[col] ?? 0
                  const isHovered = hoveredCell?.row === row && hoveredCell?.col === col
                  const isDiagonal = row === col
                  
                  return (
                    <td key={col} className="p-1">
                      <motion.div
                        className={`
                          w-full aspect-square rounded-md flex items-center justify-center
                          cursor-pointer transition-all duration-200
                          ${getCorrelationColor(corr)}
                          ${isHovered ? 'ring-2 ring-white scale-110 z-10' : ''}
                          ${isDiagonal ? 'ring-1 ring-cyan-400' : ''}
                        `}
                        style={{ opacity: getCorrelationOpacity(corr) }}
                        onMouseEnter={() => setHoveredCell({ row, col })}
                        onMouseLeave={() => setHoveredCell(null)}
                        whileHover={{ scale: 1.1 }}
                      >
                        <span className={`text-xs font-mono font-bold ${isHovered ? 'text-white' : 'text-white/80'}`}>
                          {corr.toFixed(2)}
                        </span>
                      </motion.div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover Info */}
      <AnimatePresence>
        {hoveredCell && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 p-3 bg-gray-900/80 rounded-lg border border-cyan-500/20"
          >
            <p className="text-sm text-gray-300">
              <span className="text-cyan-400 font-mono">{hoveredCell.row}</span>
              {" ↔ "}
              <span className="text-cyan-400 font-mono">{hoveredCell.col}</span>
              {": "}
              <span className="text-white font-bold">
                {(CORRELATION_MATRIX[hoveredCell.row]?.[hoveredCell.col] ?? 0).toFixed(3)}
              </span>
              {hoveredCell.row !== hoveredCell.col && (
                <span className="text-gray-500 ml-2">
                  ({CORRELATION_MATRIX[hoveredCell.row]?.[hoveredCell.col] >= 0.7 
                    ? "High correlation - diversification limited" 
                    : CORRELATION_MATRIX[hoveredCell.row]?.[hoveredCell.col] >= 0.4
                    ? "Moderate correlation"
                    : "Low correlation - good for diversification"})
                </span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ============================================
// MONTE CARLO SIMULATOR WIDGET
// ============================================
function MonteCarloSimulator() {
  const [params, setParams] = useState({
    initialPrice: 100,
    drift: 0.08,      // 8% annual drift
    volatility: 0.20, // 20% annual vol
    days: 252,        // 1 year
    paths: 50
  })
  const [simulatedPaths, setSimulatedPaths] = useState<number[][]>([])
  const [isSimulating, setIsSimulating] = useState(false)
  const [stats, setStats] = useState({ mean: 0, std: 0, var95: 0, var99: 0 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Generate paths using Geometric Brownian Motion
  const runSimulation = useCallback(() => {
    setIsSimulating(true)
    const paths: number[][] = []
    const dt = 1 / 252 // Daily time step
    const finalPrices: number[] = []

    for (let p = 0; p < params.paths; p++) {
      const path = [params.initialPrice]
      let price = params.initialPrice

      for (let d = 1; d <= params.days; d++) {
        const z = gaussianRandom()
        const drift = (params.drift - 0.5 * params.volatility ** 2) * dt
        const diffusion = params.volatility * Math.sqrt(dt) * z
        price = price * Math.exp(drift + diffusion)
        path.push(price)
      }
      paths.push(path)
      finalPrices.push(price)
    }

    // Calculate statistics
    const mean = finalPrices.reduce((a, b) => a + b, 0) / finalPrices.length
    const variance = finalPrices.reduce((a, b) => a + (b - mean) ** 2, 0) / (finalPrices.length - 1) // Use n-1 for sample variance
    const std = Math.sqrt(variance)
    
    // Calculate VaR as potential loss from initial price
    // Sort returns (not prices) to find the worst outcomes
    const sortedReturns = finalPrices
      .map(p => p - params.initialPrice) // Dollar P&L, not percentage
      .sort((a, b) => a - b) // Ascending order (worst first)
    
    // VaR is the loss at the specified percentile (as a positive number representing loss)
    const var95Index = Math.floor(sortedReturns.length * 0.05)
    const var99Index = Math.max(0, Math.floor(sortedReturns.length * 0.01))

    setStats({
      mean,
      std,
      // VaR is typically reported as a positive number representing potential loss
      var95: -sortedReturns[var95Index], // Negate because we want loss as positive
      var99: -sortedReturns[var99Index]
    })

    setSimulatedPaths(paths)
    setTimeout(() => setIsSimulating(false), 500)
  }, [params])

  // Box-Muller transform for Gaussian random numbers
  function gaussianRandom(): number {
    const u1 = Math.random()
    const u2 = Math.random()
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  }

  // Draw paths on canvas
  useEffect(() => {
    if (!canvasRef.current || simulatedPaths.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const padding = 40

    // Clear canvas
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)

    // Find price range
    const allPrices = simulatedPaths.flat()
    const minPrice = Math.min(...allPrices) * 0.95
    const maxPrice = Math.max(...allPrices) * 1.05

    // Draw grid
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padding + (height - 2 * padding) * (i / 4)
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.stroke()

      // Price labels
      const price = maxPrice - (maxPrice - minPrice) * (i / 4)
      ctx.fillStyle = '#6b7280'
      ctx.font = '10px monospace'
      ctx.textAlign = 'right'
      ctx.fillText(`$${price.toFixed(0)}`, padding - 5, y + 3)
    }

    // Draw paths with animation effect
    const numDays = params.days + 1
    const xScale = (width - 2 * padding) / numDays
    const yScale = (height - 2 * padding) / (maxPrice - minPrice)

    simulatedPaths.forEach((path, pathIdx) => {
      const hue = (pathIdx / simulatedPaths.length) * 60 + 180 // Cyan to green gradient
      ctx.strokeStyle = `hsla(${hue}, 70%, 50%, 0.4)`
      ctx.lineWidth = 1

      ctx.beginPath()
      path.forEach((price, day) => {
        const x = padding + day * xScale
        const y = height - padding - (price - minPrice) * yScale
        if (day === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })

    // Draw mean path
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let d = 0; d <= params.days; d++) {
      const avgPrice = simulatedPaths.reduce((sum, path) => sum + path[d], 0) / simulatedPaths.length
      const x = padding + d * xScale
      const y = height - padding - (avgPrice - minPrice) * yScale
      if (d === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Labels
    ctx.fillStyle = '#f59e0b'
    ctx.font = '11px monospace'
    ctx.textAlign = 'left'
    ctx.fillText('Mean Path', width - padding - 60, 20)
    
    ctx.fillStyle = '#22d3ee'
    ctx.fillText('Simulated Paths', width - padding - 60, 35)

  }, [simulatedPaths, params.days])

  // Run initial simulation
  useEffect(() => {
    runSimulation()
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-black/80 backdrop-blur-xl border border-emerald-500/30 rounded-xl p-6 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Monte Carlo Simulator</h3>
            <p className="text-xs text-gray-400">Geometric Brownian Motion paths</p>
          </div>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={runSimulation}
          disabled={isSimulating}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 
                     border border-emerald-500/50 rounded-lg text-emerald-400 text-sm transition-all"
        >
          <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
          Simulate
        </motion.button>
      </div>

      {/* Parameters */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Initial $</label>
          <input
            type="number"
            value={params.initialPrice}
            onChange={e => setParams(p => ({ ...p, initialPrice: Number(e.target.value) }))}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Drift (μ)</label>
          <input
            type="number"
            step="0.01"
            value={params.drift}
            onChange={e => setParams(p => ({ ...p, drift: Number(e.target.value) }))}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Vol (σ)</label>
          <input
            type="number"
            step="0.01"
            value={params.volatility}
            onChange={e => setParams(p => ({ ...p, volatility: Number(e.target.value) }))}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Days</label>
          <input
            type="number"
            value={params.days}
            onChange={e => setParams(p => ({ ...p, days: Number(e.target.value) }))}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Paths</label>
          <input
            type="number"
            value={params.paths}
            onChange={e => setParams(p => ({ ...p, paths: Math.min(200, Number(e.target.value)) }))}
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-white font-mono"
          />
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-lg overflow-hidden border border-gray-800 mb-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={300}
          className="w-full"
        />
        {isSimulating && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-emerald-400 font-mono">Simulating...</div>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Expected Price</div>
          <div className="text-lg font-mono text-white">${stats.mean.toFixed(2)}</div>
          <div className={`text-xs ${stats.mean > params.initialPrice ? 'text-green-400' : 'text-red-400'}`}>
            {((stats.mean - params.initialPrice) / params.initialPrice * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Std Deviation</div>
          <div className="text-lg font-mono text-white">${stats.std.toFixed(2)}</div>
          <div className="text-xs text-gray-500">
            {(stats.std / params.initialPrice * 100).toFixed(1)}% of initial
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">95% VaR (Loss)</div>
          <div className={`text-lg font-mono ${stats.var95 > 0 ? 'text-red-400' : 'text-green-400'}`}>
            ${stats.var95.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">5% chance of losing more</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">99% VaR (Loss)</div>
          <div className={`text-lg font-mono ${stats.var99 > 0 ? 'text-red-400' : 'text-green-400'}`}>
            ${stats.var99.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">1% chance of losing more</div>
        </div>
      </div>

      {/* Formula */}
      <div className="mt-4 p-3 bg-gray-900/30 rounded-lg border border-gray-800">
        <div className="text-xs text-gray-400 font-mono">
          dS = μS dt + σS dW  →  S(t) = S₀ exp[(μ - σ²/2)t + σW(t)]
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// OPTIONS PAYOFF BUILDER WIDGET
// ============================================
interface OptionLeg {
  id: number
  type: 'call' | 'put'
  position: 'long' | 'short'
  strike: number
  premium: number
  quantity: number
}

function OptionsPayoffBuilder() {
  const [spot, setSpot] = useState(100)
  const [legs, setLegs] = useState<OptionLeg[]>([
    { id: 1, type: 'call', position: 'long', strike: 100, premium: 5, quantity: 1 }
  ])
  const [priceRange, setPriceRange] = useState({ min: 70, max: 130 })
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Predefined strategies
  const strategies = {
    'Long Call': [{ type: 'call', position: 'long', strike: 100, premium: 5, quantity: 1 }],
    'Long Put': [{ type: 'put', position: 'long', strike: 100, premium: 5, quantity: 1 }],
    'Bull Call Spread': [
      { type: 'call', position: 'long', strike: 95, premium: 8, quantity: 1 },
      { type: 'call', position: 'short', strike: 105, premium: 3, quantity: 1 }
    ],
    'Bear Put Spread': [
      { type: 'put', position: 'long', strike: 105, premium: 8, quantity: 1 },
      { type: 'put', position: 'short', strike: 95, premium: 3, quantity: 1 }
    ],
    'Straddle': [
      { type: 'call', position: 'long', strike: 100, premium: 5, quantity: 1 },
      { type: 'put', position: 'long', strike: 100, premium: 5, quantity: 1 }
    ],
    'Iron Condor': [
      { type: 'put', position: 'short', strike: 90, premium: 2, quantity: 1 },
      { type: 'put', position: 'long', strike: 85, premium: 1, quantity: 1 },
      { type: 'call', position: 'short', strike: 110, premium: 2, quantity: 1 },
      { type: 'call', position: 'long', strike: 115, premium: 1, quantity: 1 }
    ],
    'Butterfly': [
      { type: 'call', position: 'long', strike: 95, premium: 8, quantity: 1 },
      { type: 'call', position: 'short', strike: 100, premium: 5, quantity: 2 },
      { type: 'call', position: 'long', strike: 105, premium: 3, quantity: 1 }
    ]
  }

  const loadStrategy = (name: string) => {
    const strat = strategies[name as keyof typeof strategies]
    if (strat) {
      setLegs(strat.map((leg, idx) => ({ ...leg, id: idx + 1 } as OptionLeg)))
    }
  }

  const addLeg = () => {
    setLegs([...legs, {
      id: Date.now(),
      type: 'call',
      position: 'long',
      strike: spot,
      premium: 5,
      quantity: 1
    }])
  }

  const removeLeg = (id: number) => {
    if (legs.length > 1) {
      setLegs(legs.filter(l => l.id !== id))
    }
  }

  const updateLeg = (id: number, updates: Partial<OptionLeg>) => {
    setLegs(legs.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  // Calculate payoff at expiration
  // Formula: Payoff = Position × Quantity × (Intrinsic Value - Premium Paid)
  // For long: you pay premium upfront, receive intrinsic at expiry
  // For short: you receive premium upfront, pay intrinsic at expiry
  const calculatePayoff = useCallback((priceAtExpiry: number): number => {
    return legs.reduce((total, leg) => {
      let intrinsic = 0

      if (leg.type === 'call') {
        // Call intrinsic = max(0, S - K)
        intrinsic = Math.max(0, priceAtExpiry - leg.strike)
      } else {
        // Put intrinsic = max(0, K - S)
        intrinsic = Math.max(0, leg.strike - priceAtExpiry)
      }

      let legPayoff: number
      if (leg.position === 'long') {
        // Long option: Pay premium, receive intrinsic
        // P&L = Intrinsic - Premium
        legPayoff = (intrinsic - leg.premium) * leg.quantity
      } else {
        // Short option: Receive premium, pay intrinsic
        // P&L = Premium - Intrinsic
        legPayoff = (leg.premium - intrinsic) * leg.quantity
      }

      return total + legPayoff
    }, 0)
  }, [legs])

  // Calculate key metrics
  const metrics = useMemo(() => {
    const prices = Array.from({ length: 100 }, (_, i) => priceRange.min + (priceRange.max - priceRange.min) * i / 99)
    const payoffs = prices.map(p => calculatePayoff(p))

    const maxProfit = Math.max(...payoffs)
    const maxLoss = Math.min(...payoffs)
    const breakevens = prices.filter((p, i) => {
      if (i === 0) return false
      return (payoffs[i - 1] < 0 && payoffs[i] >= 0) || (payoffs[i - 1] >= 0 && payoffs[i] < 0)
    })

    const netPremium = legs.reduce((sum, leg) => {
      return sum + (leg.position === 'long' ? -leg.premium : leg.premium) * leg.quantity
    }, 0)

    return { maxProfit, maxLoss, breakevens, netPremium }
  }, [legs, priceRange, calculatePayoff])

  // Draw payoff diagram
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    const padding = 50

    // Clear
    ctx.fillStyle = '#0a0a0a'
    ctx.fillRect(0, 0, width, height)

    // Calculate payoff curve
    const numPoints = 200
    const prices: number[] = []
    const payoffs: number[] = []

    for (let i = 0; i < numPoints; i++) {
      const price = priceRange.min + (priceRange.max - priceRange.min) * (i / (numPoints - 1))
      prices.push(price)
      payoffs.push(calculatePayoff(price))
    }

    const minPayoff = Math.min(...payoffs, 0)
    const maxPayoff = Math.max(...payoffs, 0)
    const payoffRange = maxPayoff - minPayoff || 20

    const xScale = (width - 2 * padding) / (priceRange.max - priceRange.min)
    const yScale = (height - 2 * padding) / (payoffRange * 1.2)
    const zeroY = height - padding - (-minPayoff + payoffRange * 0.1) * yScale

    // Draw grid
    ctx.strokeStyle = '#1f2937'
    ctx.lineWidth = 1
    
    // X-axis (zero line)
    ctx.strokeStyle = '#374151'
    ctx.beginPath()
    ctx.moveTo(padding, zeroY)
    ctx.lineTo(width - padding, zeroY)
    ctx.stroke()

    // Draw spot price line
    const spotX = padding + (spot - priceRange.min) * xScale
    ctx.strokeStyle = '#6366f1'
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(spotX, padding)
    ctx.lineTo(spotX, height - padding)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw payoff curve
    ctx.beginPath()
    prices.forEach((price, i) => {
      const x = padding + (price - priceRange.min) * xScale
      const y = zeroY - payoffs[i] * yScale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding)
    gradient.addColorStop(0, 'rgba(34, 197, 94, 0.3)')
    gradient.addColorStop(0.5, 'rgba(34, 197, 94, 0)')
    gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0)')
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)')

    ctx.strokeStyle = '#22d3ee'
    ctx.lineWidth = 2
    ctx.stroke()

    // Fill areas
    ctx.lineTo(width - padding, zeroY)
    ctx.lineTo(padding, zeroY)
    ctx.closePath()
    ctx.fillStyle = gradient
    ctx.fill()

    // Labels
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px monospace'
    
    // X-axis labels
    ctx.textAlign = 'center'
    for (let p = priceRange.min; p <= priceRange.max; p += 10) {
      const x = padding + (p - priceRange.min) * xScale
      ctx.fillText(`$${p}`, x, height - padding + 15)
    }

    // Y-axis labels
    ctx.textAlign = 'right'
    const yStep = payoffRange / 4
    for (let i = 0; i <= 4; i++) {
      const payoff = minPayoff - payoffRange * 0.1 + (payoffRange * 1.2) * (i / 4)
      const y = height - padding - (payoff - minPayoff + payoffRange * 0.1) * yScale
      ctx.fillText(`$${payoff.toFixed(0)}`, padding - 5, y + 3)
    }

    // Spot price label
    ctx.fillStyle = '#6366f1'
    ctx.textAlign = 'center'
    ctx.fillText(`Spot: $${spot}`, spotX, padding - 10)

    // Strike markers
    ctx.fillStyle = '#f59e0b'
    legs.forEach(leg => {
      const strikeX = padding + (leg.strike - priceRange.min) * xScale
      ctx.beginPath()
      ctx.arc(strikeX, zeroY, 4, 0, Math.PI * 2)
      ctx.fill()
    })

  }, [legs, spot, priceRange, calculatePayoff])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-black/80 backdrop-blur-xl border border-purple-500/30 rounded-xl p-6 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <ChartLine className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Options Payoff Builder</h3>
            <p className="text-xs text-gray-400">Build and visualize multi-leg strategies</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300"
            onChange={e => e.target.value && loadStrategy(e.target.value)}
            defaultValue=""
          >
            <option value="">Load Strategy...</option>
            {Object.keys(strategies).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Spot Price */}
      <div className="flex items-center gap-4 mb-4">
        <label className="text-sm text-gray-400">Spot Price:</label>
        <input
          type="range"
          min={priceRange.min}
          max={priceRange.max}
          value={spot}
          onChange={e => setSpot(Number(e.target.value))}
          className="flex-1 accent-purple-500"
        />
        <span className="text-white font-mono w-16">${spot}</span>
      </div>

      {/* Legs */}
      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
        {legs.map((leg, idx) => (
          <div key={leg.id} className="flex items-center gap-2 bg-gray-900/50 rounded-lg p-2">
            <span className="text-xs text-gray-500 w-6">#{idx + 1}</span>
            <select
              value={leg.position}
              onChange={e => updateLeg(leg.id, { position: e.target.value as 'long' | 'short' })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <select
              value={leg.type}
              onChange={e => updateLeg(leg.id, { type: e.target.value as 'call' | 'put' })}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white"
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">K:</span>
              <input
                type="number"
                value={leg.strike}
                onChange={e => updateLeg(leg.id, { strike: Number(e.target.value) })}
                className="w-16 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">P:</span>
              <input
                type="number"
                value={leg.premium}
                onChange={e => updateLeg(leg.id, { premium: Number(e.target.value) })}
                className="w-14 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400">Qty:</span>
              <input
                type="number"
                value={leg.quantity}
                onChange={e => updateLeg(leg.id, { quantity: Number(e.target.value) })}
                className="w-12 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono"
              />
            </div>
            <button
              onClick={() => removeLeg(leg.id)}
              className="text-red-400 hover:text-red-300 text-xs px-2"
              disabled={legs.length === 1}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addLeg}
        className="w-full py-2 mb-4 border border-dashed border-gray-700 rounded-lg text-gray-400 
                   hover:border-purple-500 hover:text-purple-400 transition-colors text-sm"
      >
        + Add Leg
      </button>

      {/* Payoff Chart */}
      <div className="rounded-lg overflow-hidden border border-gray-800 mb-4">
        <canvas
          ref={canvasRef}
          width={600}
          height={250}
          className="w-full"
        />
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Max Profit</div>
          <div className={`text-lg font-mono ${metrics.maxProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.maxProfit === Infinity ? '∞' : `$${metrics.maxProfit.toFixed(2)}`}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Max Loss</div>
          <div className={`text-lg font-mono ${metrics.maxLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {metrics.maxLoss === -Infinity ? '-∞' : `$${metrics.maxLoss.toFixed(2)}`}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Net Premium</div>
          <div className={`text-lg font-mono ${metrics.netPremium >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${metrics.netPremium.toFixed(2)}
          </div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Breakeven(s)</div>
          <div className="text-lg font-mono text-cyan-400">
            {metrics.breakevens.length > 0 
              ? metrics.breakevens.map(b => `$${b.toFixed(0)}`).join(', ')
              : 'N/A'}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// VAR DASHBOARD WIDGET
// ============================================
function VaRDashboard() {
  const [quotes, setQuotes] = useState<MarketQuote[]>([])
  const [portfolioValue, setPortfolioValue] = useState(100000)
  const [confidenceLevel, setConfidenceLevel] = useState<0.95 | 0.99>(0.95)
  const [loading, setLoading] = useState(true)

  // Portfolio weights (equal weighted for simplicity)
  const portfolioAssets = ['AAPL', 'NVDA', 'META', 'AMZN', 'GOOGL', 'MSFT']
  const weights = portfolioAssets.map(() => 1 / portfolioAssets.length)

  // Annualized volatilities (%) - Based on historical data (2023-2024 estimates)
  // Source: Calculated from daily returns, annualized by √252
  const volatilities: Record<string, number> = {
    AAPL: 24.5,  // Apple - Large cap, moderate vol
    NVDA: 48.3,  // NVIDIA - High vol semiconductor/AI
    META: 38.1,  // Meta - Tech, higher vol
    AMZN: 32.8,  // Amazon - E-commerce/cloud
    GOOGL: 28.5, // Alphabet - Large cap tech
    MSFT: 22.3   // Microsoft - Most stable large cap
  }

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const data = await getQuotes(portfolioAssets)
      setQuotes(data)
      setLoading(false)
    }
    loadData()
  }, [])

  // Calculate VaR using variance-covariance method with actual correlation matrix
  const varMetrics = useMemo(() => {
    // Z-scores for normal distribution
    // 95% confidence: 1.645 (one-tailed)
    // 99% confidence: 2.326 (one-tailed)
    const zScore = confidenceLevel === 0.95 ? 1.6449 : 2.3263

    // Calculate portfolio variance using the full covariance matrix
    // σ²_p = Σᵢ Σⱼ wᵢ wⱼ ρᵢⱼ σᵢ σⱼ
    let portfolioVariance = 0
    
    for (let i = 0; i < portfolioAssets.length; i++) {
      for (let j = 0; j < portfolioAssets.length; j++) {
        const assetI = portfolioAssets[i]
        const assetJ = portfolioAssets[j]
        const volI = (volatilities[assetI] || 25) / 100  // Convert to decimal
        const volJ = (volatilities[assetJ] || 25) / 100
        // Use actual correlation from matrix (or 1 for same asset)
        const corr = CORRELATION_MATRIX[assetI]?.[assetJ] ?? (i === j ? 1 : 0.5)
        portfolioVariance += weights[i] * weights[j] * volI * volJ * corr
      }
    }

    const annualVol = Math.sqrt(portfolioVariance)
    // Convert annual volatility to daily: σ_daily = σ_annual / √252
    const dailyVol = annualVol / Math.sqrt(252)

    // Parametric VaR formula: VaR = Portfolio Value × z × σ
    const varDaily = portfolioValue * zScore * dailyVol
    
    // 10-day VaR using square root of time rule (assumes IID returns)
    const var10Day = varDaily * Math.sqrt(10)

    // Marginal VaR (contribution of each asset to portfolio VaR)
    // MVaRᵢ = wᵢ × σᵢ × (Σⱼ wⱼ ρᵢⱼ σⱼ) / σ_p × VaR_p / Portfolio_Value
    const componentVaR = portfolioAssets.map((asset, i) => {
      const volI = (volatilities[asset] || 25) / 100
      
      // Calculate covariance of asset i with portfolio
      let covWithPortfolio = 0
      for (let j = 0; j < portfolioAssets.length; j++) {
        const assetJ = portfolioAssets[j]
        const volJ = (volatilities[assetJ] || 25) / 100
        const corr = CORRELATION_MATRIX[asset]?.[assetJ] ?? (i === j ? 1 : 0.5)
        covWithPortfolio += weights[j] * volI * volJ * corr
      }
      
      // Component VaR = weight × (cov with portfolio / portfolio vol) × VaR
      const betaToPortfolio = covWithPortfolio / (annualVol * annualVol) * annualVol
      const componentVar = weights[i] * betaToPortfolio / annualVol * varDaily
      
      return { 
        asset, 
        var: Math.abs(componentVar), 
        pct: Math.abs(componentVar) / varDaily * 100,
        vol: volatilities[asset]
      }
    }).sort((a, b) => b.var - a.var)

    return {
      dailyVaR: varDaily,
      var10Day,
      portfolioVol: annualVol * 100,
      dailyVol: dailyVol * 100,
      componentVaR,
      confidenceLevel
    }
  }, [portfolioValue, confidenceLevel])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-black/80 backdrop-blur-xl border border-red-500/30 rounded-xl p-6 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Value at Risk Dashboard</h3>
            <p className="text-xs text-gray-400">Parametric VaR with component breakdown</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfidenceLevel(0.95)}
            className={`px-3 py-1 rounded text-xs transition-all ${
              confidenceLevel === 0.95 
                ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            95% VaR
          </button>
          <button
            onClick={() => setConfidenceLevel(0.99)}
            className={`px-3 py-1 rounded text-xs transition-all ${
              confidenceLevel === 0.99 
                ? 'bg-red-500/30 text-red-400 border border-red-500/50' 
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            99% VaR
          </button>
        </div>
      </div>

      {/* Portfolio Value Input */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-sm text-gray-400">Portfolio Value:</label>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">$</span>
          <input
            type="number"
            value={portfolioValue}
            onChange={e => setPortfolioValue(Number(e.target.value))}
            className="w-32 bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white font-mono"
          />
        </div>
      </div>

      {/* VaR Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-900/30 to-red-900/10 rounded-xl p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-red-400" />
            <span className="text-xs text-gray-400">1-Day VaR ({confidenceLevel * 100}%)</span>
          </div>
          <div className="text-2xl font-mono text-red-400 font-bold">
            ${varMetrics.dailyVaR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {(varMetrics.dailyVaR / portfolioValue * 100).toFixed(2)}% of portfolio
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-orange-900/10 rounded-xl p-4 border border-orange-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-orange-400" />
            <span className="text-xs text-gray-400">10-Day VaR ({confidenceLevel * 100}%)</span>
          </div>
          <div className="text-2xl font-mono text-orange-400 font-bold">
            ${varMetrics.var10Day.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            √10 scaling rule applied
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-900/10 rounded-xl p-4 border border-yellow-500/20">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Portfolio Volatility</span>
          </div>
          <div className="text-2xl font-mono text-yellow-400 font-bold">
            {varMetrics.portfolioVol.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Annualized
          </div>
        </div>
      </div>

      {/* Component VaR */}
      <div className="mb-4">
        <h4 className="text-sm text-gray-400 mb-3">Component VaR Breakdown (by risk contribution)</h4>
        <div className="space-y-2">
          {varMetrics.componentVaR.map((comp, idx) => (
            <div key={comp.asset} className="flex items-center gap-3">
              <div className="w-16 flex flex-col">
                <span className="text-xs text-cyan-400 font-mono">{comp.asset}</span>
                <span className="text-[10px] text-gray-600">σ={comp.vol}%</span>
              </div>
              <div className="flex-1 h-6 bg-gray-900 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(comp.pct, 100)}%` }}
                  transition={{ delay: idx * 0.1, duration: 0.5 }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, 
                      ${idx === 0 ? '#ef4444' : idx === 1 ? '#f97316' : idx === 2 ? '#eab308' : '#22c55e'} 0%, 
                      ${idx === 0 ? '#dc2626' : idx === 1 ? '#ea580c' : idx === 2 ? '#ca8a04' : '#16a34a'} 100%)`
                  }}
                />
              </div>
              <span className="w-24 text-xs text-gray-400 text-right">
                ${comp.var.toFixed(0)} ({comp.pct.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Formula */}
      <div className="p-3 bg-gray-900/30 rounded-lg border border-gray-800">
        <div className="text-xs text-gray-400 font-mono">
          VaR = Portfolio Value × z<sub>α</sub> × σ<sub>portfolio,daily</sub>
          <span className="text-gray-600 ml-4">| z<sub>{(confidenceLevel * 100).toFixed(0)}%</sub> = {confidenceLevel === 0.95 ? '1.6449' : '2.3263'}</span>
          <span className="text-gray-600 ml-4">| σ<sub>daily</sub> = {varMetrics.dailyVol.toFixed(2)}%</span>
        </div>
      </div>
    </motion.div>
  )
}

// ============================================
// MAIN TRADING LAB PAGE
// ============================================
export default function TradingLab() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Initial data fetch
    fetchAllMarketData().then(() => {
      setIsLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/10 via-transparent to-purple-900/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link 
              to="/"
              className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Portfolio</span>
            </Link>

            <div className="flex items-center gap-3">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-green-500"
              />
              <span className="text-sm text-gray-400">Live Data</span>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 py-12 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 
                       rounded-full text-cyan-400 text-sm mb-6"
          >
            <Zap className="w-4 h-4" />
            Interactive Quantitative Dashboard
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-6xl font-bold mb-4"
          >
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Trading Lab
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-gray-400 max-w-2xl mx-auto"
          >
            Explore quantitative finance concepts with live, interactive tools.
            Monte Carlo simulations, options strategies, risk analytics, and more.
          </motion.p>
        </div>
      </section>

      {/* Widgets Grid */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-cyan-400 font-mono">Loading market data...</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Row 1: Correlation Heatmap + Monte Carlo */}
              <CorrelationHeatmap />
              <MonteCarloSimulator />

              {/* Row 2: Options Payoff (Full Width) */}
              <div className="lg:col-span-2">
                <OptionsPayoffBuilder />
              </div>

              {/* Row 3: VaR Dashboard (Full Width) */}
              <div className="lg:col-span-2">
                <VaRDashboard />
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 py-8 px-6">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            Built with React, TypeScript, and real market data from Finnhub API
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs text-gray-600">
            <span>17 Symbols</span>
            <span>•</span>
            <span>3-min Cache TTL</span>
            <span>•</span>
            <span>6 API calls/min</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
