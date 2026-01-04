import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card } from "@/components/ui/card"

const generateOptionPriceData = () => {
  const data: Array<{ strike: number; 'Heston Model': number; 'Black-Scholes': number }> = []
  for (let strike = 80; strike <= 120; strike += 2) {
    const callHeston = Math.max(0, 100 - strike + (strike < 100 ? 8 : -3))
    const callBS = Math.max(0, 100 - strike + (strike < 100 ? 6 : -2))
    data.push({
      strike,
      'Heston Model': parseFloat(callHeston.toFixed(2)),
      'Black-Scholes': parseFloat(callBS.toFixed(2))
    })
  }
  return data
}

export function HestonVisualization() {
  const data = generateOptionPriceData()

  return (
    <Card className="p-6 bg-card/80 border-border/30">
      <h4 className="text-sm font-semibold mb-4 text-foreground/90">Call Option Prices: Heston vs Black-Scholes</h4>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250 / 0.2)" />
          <XAxis 
            dataKey="strike" 
            stroke="oklch(0.60 0.01 250)"
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 12 }}
            label={{ value: 'Strike Price', position: 'insideBottom', offset: -5, fill: 'oklch(0.60 0.01 250)' }}
          />
          <YAxis 
            stroke="oklch(0.60 0.01 250)"
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 12 }}
            label={{ value: 'Option Price', angle: -90, position: 'insideLeft', fill: 'oklch(0.60 0.01 250)' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'oklch(0.16 0.02 250)', 
              border: '1px solid oklch(0.25 0.03 250)',
              borderRadius: '8px',
              color: 'oklch(0.85 0.01 250)'
            }}
          />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />
          <Line 
            type="monotone" 
            dataKey="Heston Model" 
            stroke="oklch(0.75 0.15 200)" 
            strokeWidth={2.5}
            dot={{ fill: 'oklch(0.75 0.15 200)', r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line 
            type="monotone" 
            dataKey="Black-Scholes" 
            stroke="oklch(0.72 0.12 85)" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ fill: 'oklch(0.72 0.12 85)', r: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Stochastic volatility model captures smile effect vs constant volatility assumption
      </p>
    </Card>
  )
}
