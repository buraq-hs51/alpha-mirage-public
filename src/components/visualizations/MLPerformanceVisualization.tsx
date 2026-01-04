import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts'
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const generatePerformanceData = () => {
  return [
    { metric: 'Latency', value: 92, fullMark: 100 },
    { metric: 'Accuracy', value: 88, fullMark: 100 },
    { metric: 'Throughput', value: 85, fullMark: 100 },
    { metric: 'Reliability', value: 95, fullMark: 100 },
    { metric: 'Scalability', value: 90, fullMark: 100 },
  ]
}

export function MLPerformanceVisualization() {
  const data = generatePerformanceData()

  return (
    <Card className="p-6 bg-card/80 border-border/30">
      <h4 className="text-sm font-semibold mb-4 text-foreground/90">ML Microservice Performance Metrics</h4>
      <div className="flex flex-wrap gap-2 mb-4">
        <Badge variant="outline" className="text-xs">FastAPI</Badge>
        <Badge variant="outline" className="text-xs">Docker</Badge>
        <Badge variant="outline" className="text-xs">Redis Cache</Badge>
        <Badge variant="outline" className="text-xs">Load Balanced</Badge>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <RadarChart data={data}>
          <PolarGrid stroke="oklch(0.25 0.03 250 / 0.3)" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fill: 'oklch(0.60 0.01 250)', fontSize: 10 }}
          />
          <Radar 
            name="Performance Score" 
            dataKey="value" 
            stroke="oklch(0.75 0.15 200)" 
            fill="oklch(0.75 0.15 200)" 
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'oklch(0.16 0.02 250)', 
              border: '1px solid oklch(0.25 0.03 250)',
              borderRadius: '8px',
              color: 'oklch(0.85 0.01 250)'
            }}
            formatter={(value: number) => [`${value}/100`, 'Score']}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Production-ready API performance across key operational metrics
      </p>
    </Card>
  )
}
