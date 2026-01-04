import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { Card } from "@/components/ui/card"

const generateAlphaData = () => {
  return [
    { factor: 'Momentum', tStat: 3.2, pValue: 0.001, significant: true },
    { factor: 'Reversal', tStat: -2.1, pValue: 0.035, significant: true },
    { factor: 'Volume', tStat: 1.8, pValue: 0.072, significant: false },
    { factor: 'Volatility', tStat: -2.8, pValue: 0.005, significant: true },
    { factor: 'Spread', tStat: 2.5, pValue: 0.012, significant: true },
    { factor: 'Trend', tStat: 0.9, pValue: 0.368, significant: false },
  ]
}

export function AlphaSignalsVisualization() {
  const data = generateAlphaData()

  return (
    <Card className="p-6 bg-card/80 border-border/30">
      <h4 className="text-sm font-semibold mb-4 text-foreground/90">Alpha Factor T-Statistics (Significance Test)</h4>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 250 / 0.2)" />
          <XAxis 
            dataKey="factor" 
            stroke="oklch(0.60 0.01 250)"
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 11 }}
            angle={-15}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="oklch(0.60 0.01 250)"
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 12 }}
            label={{ value: 't-Statistic', angle: -90, position: 'insideLeft', fill: 'oklch(0.60 0.01 250)' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'oklch(0.16 0.02 250)', 
              border: '1px solid oklch(0.25 0.03 250)',
              borderRadius: '8px',
              color: 'oklch(0.85 0.01 250)'
            }}
            formatter={(value: number, name: string, props: any) => {
              if (name === 'tStat') {
                return [
                  <>
                    <div>t-Stat: {value.toFixed(2)}</div>
                    <div>p-value: {props.payload.pValue.toFixed(3)}</div>
                    <div>{props.payload.significant ? '✓ Significant' : '✗ Not Significant'}</div>
                  </>,
                  ''
                ]
              }
              return value
            }}
          />
          <ReferenceLine y={0} stroke="oklch(0.60 0.01 250)" strokeWidth={1} />
          <ReferenceLine y={1.96} stroke="oklch(0.72 0.12 85)" strokeDasharray="3 3" label={{ value: 'α=0.05', fill: 'oklch(0.72 0.12 85)', fontSize: 10 }} />
          <ReferenceLine y={-1.96} stroke="oklch(0.72 0.12 85)" strokeDasharray="3 3" />
          <Bar dataKey="tStat" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.significant 
                  ? (entry.tStat > 0 ? 'oklch(0.70 0.15 140)' : 'oklch(0.60 0.22 25)') 
                  : 'oklch(0.40 0.01 250)'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Statistical significance of predictive factors (|t| &gt; 1.96 indicates p &lt; 0.05)
      </p>
    </Card>
  )
}
