/**
 * ============================================
 * SYSTEM HEALTH MONITOR
 * ============================================
 * 
 * Real-time performance monitoring widget that displays:
 * - Page load latency
 * - API response times
 * - Translation cache hit rate
 * - Memory usage
 * - Render FPS
 * 
 * Demonstrates: Observability, performance optimization,
 * and real-time systems monitoring - core quant dev skills.
 * 
 * Author: Shadaab Ahmed
 * ============================================
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Pulse, 
  Cpu, 
  HardDrive, 
  WifiHigh, 
  Timer,
  ChartLine,
  CaretUp,
  CaretDown,
  X,
  Terminal,
  Brain
} from '@phosphor-icons/react';
import { useTranslation } from '@/i18n';
import { getRealModelStatus, isUsingRealModels } from '@/services/mlPredictionService';

interface SystemMetrics {
  // Page Performance
  pageLoadTime: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
  domContentLoaded: number;
  
  // Runtime Metrics
  fps: number;
  memoryUsed: number;
  memoryTotal: number;
  heapUsage: number;
  
  // Network
  apiLatency: number;
  connectionType: string;
  downlink: number;
  
  // Custom Metrics
  translationCacheHits: number;
  translationCacheMisses: number;
  renderCount: number;
  lastUpdate: number;
}

interface LatencyHistoryPoint {
  timestamp: number;
  value: number;
}

// Get performance metrics from browser APIs
function getPerformanceMetrics(): Partial<SystemMetrics> {
  const metrics: Partial<SystemMetrics> = {};
  
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      metrics.pageLoadTime = Math.round(navigation.loadEventEnd - navigation.startTime);
      metrics.domContentLoaded = Math.round(navigation.domContentLoadedEventEnd - navigation.startTime);
      metrics.timeToInteractive = Math.round(navigation.domInteractive - navigation.startTime);
    }
    
    // First Contentful Paint
    const paintEntries = performance.getEntriesByType('paint');
    const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
    if (fcp) {
      metrics.firstContentfulPaint = Math.round(fcp.startTime);
    }
    
    // Memory (Chrome only)
    const memory = (performance as any).memory;
    if (memory) {
      metrics.memoryUsed = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      metrics.memoryTotal = Math.round(memory.totalJSHeapSize / 1024 / 1024);
      metrics.heapUsage = Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100);
    }
  }
  
  // Network Information API
  const connection = (navigator as any).connection;
  if (connection) {
    metrics.connectionType = connection.effectiveType || 'unknown';
    metrics.downlink = connection.downlink || 0;
  }
  
  return metrics;
}

// FPS Counter using requestAnimationFrame
function useFPS() {
  const [fps, setFps] = useState(60);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());
  
  useEffect(() => {
    let animationId: number;
    
    const measureFPS = () => {
      frameCount.current++;
      const now = performance.now();
      const delta = now - lastTime.current;
      
      if (delta >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / delta));
        frameCount.current = 0;
        lastTime.current = now;
      }
      
      animationId = requestAnimationFrame(measureFPS);
    };
    
    animationId = requestAnimationFrame(measureFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);
  
  return fps;
}

// Simulated API latency measurement (measures actual fetch timing)
function useAPILatency() {
  const [latency, setLatency] = useState(0);
  const [history, setHistory] = useState<LatencyHistoryPoint[]>([]);
  
  useEffect(() => {
    const measureLatency = async () => {
      const start = performance.now();
      try {
        // Ping a lightweight endpoint
        await fetch('https://finnhub.io/api/v1/quote?symbol=AAPL&token=demo', {
          method: 'HEAD',
          mode: 'no-cors'
        });
      } catch {
        // Even if it fails, we measure the round trip
      }
      const end = performance.now();
      const measured = Math.round(end - start);
      
      setLatency(measured);
      setHistory(prev => {
        const newHistory = [...prev, { timestamp: Date.now(), value: measured }];
        // Keep last 20 points
        return newHistory.slice(-20);
      });
    };
    
    measureLatency();
    const interval = setInterval(measureLatency, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return { latency, history };
}

// Mini sparkline chart
function Sparkline({ data, color = 'cyan' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 40;
    const y = 12 - ((value - min) / range) * 10;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width="40" height="14" className="inline-block ml-2">
      <polyline
        points={points}
        fill="none"
        stroke={color === 'cyan' ? 'oklch(0.75 0.18 190)' : 'oklch(0.72 0.19 145)'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Status indicator with pulse animation
function StatusIndicator({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const colors = {
    healthy: 'bg-green-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500'
  };
  
  return (
    <div className={`w-2 h-2 rounded-full ${colors[status]} animate-pulse`} />
  );
}

// Metric Row Component
function MetricRow({ 
  icon: Icon, 
  label, 
  value, 
  unit, 
  status,
  trend,
  sparklineData
}: { 
  icon: React.ElementType;
  label: string; 
  value: string | number; 
  unit?: string;
  status?: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  sparklineData?: number[];
}) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-cyan-400/70" />
        <span className="text-foreground/60 text-xs">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {sparklineData && <Sparkline data={sparklineData} />}
        <span className="text-foreground font-mono text-xs font-medium">
          {value}{unit && <span className="text-foreground/50 ml-0.5">{unit}</span>}
        </span>
        {trend && (
          <span className={trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-foreground/30'}>
            {trend === 'up' ? <CaretUp size={10} weight="bold" /> : 
             trend === 'down' ? <CaretDown size={10} weight="bold" /> : 
             <span className="text-[8px]">━</span>}
          </span>
        )}
        {status && <StatusIndicator status={status} />}
      </div>
    </div>
  );
}

export function SystemHealthMonitor() {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [metrics, setMetrics] = useState<Partial<SystemMetrics>>({});
  const [renderCount, setRenderCount] = useState(0);
  const fps = useFPS();
  const { latency: apiLatency, history: latencyHistory } = useAPILatency();
  
  // Track render count
  useEffect(() => {
    setRenderCount(prev => prev + 1);
  }, []);
  
  // Listen for ESC key to close expanded panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);
  
  // Get performance metrics on mount and periodically
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(getPerformanceMetrics());
    };
    
    updateMetrics();
    const interval = setInterval(updateMetrics, 2000);
    return () => clearInterval(interval);
  }, []);
  
  // Calculate translation cache stats from localStorage
  const getCacheStats = useCallback(() => {
    try {
      const cacheData = localStorage.getItem('translationCache');
      if (cacheData) {
        const cache = JSON.parse(cacheData);
        return Object.keys(cache).length;
      }
    } catch {}
    return 0;
  }, []);
  
  const cacheEntries = getCacheStats();
  
  // Determine status levels
  const getLatencyStatus = (ms: number): 'healthy' | 'warning' | 'critical' => {
    if (ms < 100) return 'healthy';
    if (ms < 300) return 'warning';
    return 'critical';
  };
  
  const getFPSStatus = (fps: number): 'healthy' | 'warning' | 'critical' => {
    if (fps >= 55) return 'healthy';
    if (fps >= 30) return 'warning';
    return 'critical';
  };
  
  if (!isVisible) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 z-50 pointer-events-auto hidden lg:block cursor-auto"
      style={{ cursor: 'auto' }}
    >
      <AnimatePresence mode="wait">
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="bg-black/90 backdrop-blur-xl border border-cyan-500/30 rounded-lg shadow-2xl shadow-cyan-500/10 w-72 cursor-auto"
            style={{ cursor: 'auto' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyan-500/20">
              <div className="flex items-center gap-2">
                <Terminal size={14} className="text-cyan-400" weight="duotone" />
                <span className="text-cyan-400 font-mono text-xs font-bold tracking-wider">
                  SYSTEM METRICS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-green-400 font-mono">LIVE</span>
                </div>
                <button 
                  onClick={() => setIsExpanded(false)}
                  className="text-foreground/50 hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            
            {/* Metrics Grid */}
            <div className="px-3 py-2 space-y-0">
              {/* Performance Section */}
              <div className="mb-2">
                <div className="text-[9px] text-cyan-400/60 uppercase tracking-widest mb-1">
                  Page Performance
                </div>
                <MetricRow 
                  icon={Timer}
                  label="Load Time"
                  value={metrics.pageLoadTime || '--'}
                  unit="ms"
                  status={getLatencyStatus(metrics.pageLoadTime || 0)}
                />
                <MetricRow 
                  icon={Pulse}
                  label="FCP"
                  value={metrics.firstContentfulPaint || '--'}
                  unit="ms"
                  status={getLatencyStatus(metrics.firstContentfulPaint || 0)}
                />
                <MetricRow 
                  icon={ChartLine}
                  label="TTI"
                  value={metrics.timeToInteractive || '--'}
                  unit="ms"
                />
              </div>
              
              {/* Runtime Section */}
              <div className="mb-2">
                <div className="text-[9px] text-purple-400/60 uppercase tracking-widest mb-1">
                  Runtime
                </div>
                <MetricRow 
                  icon={Pulse}
                  label="Frame Rate"
                  value={fps}
                  unit="fps"
                  status={getFPSStatus(fps)}
                  trend={fps >= 58 ? 'stable' : fps >= 50 ? 'down' : 'down'}
                />
                {metrics.memoryUsed && (
                  <MetricRow 
                    icon={HardDrive}
                    label="Memory"
                    value={metrics.memoryUsed}
                    unit="MB"
                    status={metrics.heapUsage && metrics.heapUsage > 80 ? 'warning' : 'healthy'}
                  />
                )}
                <MetricRow 
                  icon={Cpu}
                  label="Renders"
                  value={renderCount}
                />
              </div>
              
              {/* Network Section */}
              <div className="mb-2">
                <div className="text-[9px] text-green-400/60 uppercase tracking-widest mb-1">
                  Network
                </div>
                <MetricRow 
                  icon={WifiHigh}
                  label="API Latency"
                  value={apiLatency}
                  unit="ms"
                  status={getLatencyStatus(apiLatency)}
                  sparklineData={latencyHistory.map(h => h.value)}
                />
                {metrics.connectionType && (
                  <MetricRow 
                    icon={WifiHigh}
                    label="Connection"
                    value={metrics.connectionType.toUpperCase()}
                    status="healthy"
                  />
                )}
              </div>
              
              {/* Cache Section */}
              <div className="mb-2">
                <div className="text-[9px] text-yellow-400/60 uppercase tracking-widest mb-1">
                  Translation Cache
                </div>
                <MetricRow 
                  icon={HardDrive}
                  label="Cached Strings"
                  value={cacheEntries}
                  status="healthy"
                />
              </div>
              
              {/* ML Models Section */}
              <div>
                <div className="text-[9px] text-emerald-400/60 uppercase tracking-widest mb-1">
                  ML Engine
                </div>
                <MetricRow 
                  icon={Brain}
                  label="Model Type"
                  value={isUsingRealModels() ? 'REAL TFJS' : 'SIMULATED'}
                  status={isUsingRealModels() ? 'healthy' : 'warning'}
                />
                <MetricRow 
                  icon={Cpu}
                  label="Models Loaded"
                  value={getRealModelStatus().modelsLoaded}
                  unit="/4"
                  status={getRealModelStatus().status === 'healthy' ? 'healthy' : getRealModelStatus().status === 'degraded' ? 'warning' : 'critical'}
                />
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-cyan-500/20 bg-cyan-500/5">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <kbd className="px-1.5 py-0.5 bg-black/50 border border-foreground/20 rounded text-[8px] font-mono text-cyan-400">
                    ESC
                  </kbd>
                  <span className="text-[9px] text-foreground/40 font-mono">to close</span>
                </div>
                <span className="text-[9px] text-foreground/30 font-mono">
                  {new Date().toLocaleTimeString()}
                </span>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setIsExpanded(true)}
            className="bg-black/80 backdrop-blur-xl border border-cyan-500/30 rounded-lg px-3 py-2 
                       hover:border-cyan-500/50 hover:bg-black/90 transition-all duration-300
                       shadow-lg shadow-cyan-500/10 group cursor-pointer"
            style={{ cursor: 'pointer' }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Pulse size={14} className="text-cyan-400" weight="duotone" />
                <span className="text-cyan-400 font-mono text-[10px] font-bold">SYS</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-foreground/60">{fps}<span className="text-foreground/40">fps</span></span>
                <span className="text-foreground/30">|</span>
                <span className="text-foreground/60">{apiLatency}<span className="text-foreground/40">ms</span></span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default SystemHealthMonitor;
