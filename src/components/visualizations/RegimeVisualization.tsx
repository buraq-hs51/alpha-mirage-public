import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const generateRegimeData = () => {
  const regimes = [
    { period: 'Jan-Mar', returns: 2.3, regime: 'Bull', allocation: '70/30' },
    { period: 'Apr-Jun', returns: -1.2, regime: 'Bear', allocation: '30/70' },
    { period: 'Jul-Sep', returns: 0.5, regime: 'Sideways', allocation: '50/50' },
    { period: 'Oct-Dec', returns: 3.1, regime: 'Bull', allocation: '70/30' },
  ]
  return regimes
}

export function RegimeVisualization() {
  const data = generateRegimeData()

  const getRegimeColor = (regime: string) => {
    switch(regime) {
      case 'Bull': return 'oklch(0.70 0.15 140)'
      case 'Bear': return 'oklch(0.60 0.22 25)'
      case 'Sideways': return 'oklch(0.72 0.12 85)'
      default: return 'oklch(0.75 0.15 200)'
    }
  }

  return (
    <Card className="p-6 bg-card/80 border-border/30">
      <h4 className="text-sm font-semibold mb-4 text-foreground/90">Regime-Based Returns & Asset Allocation</h4>
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge className="bg-[oklch(0.70_0.15_140)] text-white">Bull Market</Badge>
        <Badge className="bg-[oklch(0.60_0.22_25)] text-white">Bear Market</Badge>
        <Badge className="bg-[oklch(0.72_0.12_85)] text-accent-foreground">Sideways</Badge>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <defs>
            {data.map((entry, index) => (
              <linearGradient key={index} id={`colorReturns${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={getRegimeColor(entry.regime)} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={getRegimeColor(entry.regime)} stopOpacity={0.1}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250 / 0.2)" />
          <XAxis 
            dataKey="period" 
            stroke="oklch(0.60 0.01 250)"
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 12 }}
          />
          <YAxis 
            stroke="oklch(0.60 0.01 250)"
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 12 }}
            label={{ value: 'Returns (%)', angle: -90, position: 'insideLeft', fill: 'oklch(0.60 0.01 250)' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'oklch(0.16 0.02 250)', 
              border: '1px solid oklch(0.25 0.03 250)',
              borderRadius: '8px',
              color: 'oklch(0.85 0.01 250)'
            }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'returns') {
                return [`${value}%`, 'Returns']
              }
              return value
            }}
            labelFormatter={(label, payload) => {
              if (payload && payload[0]) {
                return `${label} (${payload[0].payload.regime} - ${payload[0].payload.allocation})`
              }
              return label
            }}
          />
          <ReferenceLine y={0} stroke="oklch(0.60 0.01 250)" strokeDasharray="3 3" />
          <Area 
            type="monotone" 
            dataKey="returns" 
            stroke="oklch(0.75 0.15 200)" 
            strokeWidth={2}
            fill="url(#colorReturns0)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Dynamic allocation adjusted based on HMM-detected market regimes
      </p>
    </Card>
  )
}
