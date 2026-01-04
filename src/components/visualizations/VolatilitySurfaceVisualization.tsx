import { useEffect, useRef } from 'react'
import { Card } from "@/components/ui/card"
import * as d3 from 'd3'

interface VolData {
  strike: number
  maturity: string
  maturityValue: number
  volatility: number
}

const generateVolatilityData = (): VolData[] => {
  const data: VolData[] = []
  const strikes = [90, 95, 100, 105, 110]
  const maturities = ['1M', '3M', '6M', '1Y']
  const maturityValues = [1, 3, 6, 12]
  
  strikes.forEach((strike, i) => {
    maturities.forEach((maturity, j) => {
      const distance = Math.abs(strike - 100)
      const timeEffect = Math.sqrt(maturityValues[j])
      const vol = 20 + distance * 0.3 + timeEffect * 2 - (strike > 100 ? 2 : 0)
      data.push({
        strike,
        maturity,
        maturityValue: maturityValues[j],
        volatility: vol
      })
    })
  })
  return data
}

export function VolatilitySurfaceVisualization() {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const data = generateVolatilityData()
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = 400
    const height = 250
    const margin = { top: 20, right: 80, bottom: 40, left: 50 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const strikes = Array.from(new Set(data.map(d => d.strike)))
    const maturities = Array.from(new Set(data.map(d => d.maturityValue)))

    const xScale = d3.scaleBand()
      .domain(strikes.map(String))
      .range([0, chartWidth])
      .padding(0.1)

    const yScale = d3.scaleBand()
      .domain(maturities.map(String))
      .range([chartHeight, 0])
      .padding(0.1)

    const colorScale = d3.scaleSequential(d3.interpolateRgb('oklch(0.70 0.15 200)', 'oklch(0.60 0.22 25)'))
      .domain([18, 32])

    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => xScale(String(d.strike)) || 0)
      .attr('y', d => yScale(String(d.maturityValue)) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', d => colorScale(d.volatility))
      .attr('rx', 4)
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('opacity', 0.8)
        tooltip.style('opacity', 1)
          .html(`Strike: ${d.strike}<br/>Maturity: ${d.maturity}<br/>Vol: ${d.volatility.toFixed(1)}%`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px')
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 1)
        tooltip.style('opacity', 0)
      })

    g.selectAll('.vol-text')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'vol-text')
      .attr('x', d => (xScale(String(d.strike)) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => (yScale(String(d.maturityValue)) || 0) + yScale.bandwidth() / 2)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', 'oklch(0.98 0 0)')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .text(d => d.volatility.toFixed(1))

    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .attr('color', 'oklch(0.60 0.01 250)')
      .selectAll('text')
      .attr('font-size', '11px')

    g.append('g')
      .call(d3.axisLeft(yScale))
      .attr('color', 'oklch(0.60 0.01 250)')
      .selectAll('text')
      .attr('font-size', '11px')

    g.append('text')
      .attr('x', chartWidth / 2)
      .attr('y', chartHeight + 35)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.60 0.01 250)')
      .attr('font-size', '12px')
      .text('Strike Price')

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -chartHeight / 2)
      .attr('y', -35)
      .attr('text-anchor', 'middle')
      .attr('fill', 'oklch(0.60 0.01 250)')
      .attr('font-size', '12px')
      .text('Maturity (Months)')

    const legendWidth = 60
    const legendHeight = chartHeight

    const legendScale = d3.scaleLinear()
      .domain([18, 32])
      .range([legendHeight, 0])

    const legendAxis = d3.axisRight(legendScale)
      .ticks(5)
      .tickFormat(d => d + '%')

    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right + 10},${margin.top})`)

    const gradient = svg.append('defs')
      .append('linearGradient')
      .attr('id', 'vol-gradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%')

    gradient.selectAll('stop')
      .data([
        { offset: '0%', color: 'oklch(0.70 0.15 200)' },
        { offset: '100%', color: 'oklch(0.60 0.22 25)' }
      ])
      .enter()
      .append('stop')
      .attr('offset', d => d.offset)
      .attr('stop-color', d => d.color)

    legend.append('rect')
      .attr('width', 20)
      .attr('height', legendHeight)
      .style('fill', 'url(#vol-gradient)')
      .attr('rx', 4)

    legend.append('g')
      .attr('transform', `translate(20, 0)`)
      .call(legendAxis)
      .attr('color', 'oklch(0.60 0.01 250)')
      .selectAll('text')
      .attr('font-size', '10px')

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('background-color', 'oklch(0.16 0.02 250)')
      .style('border', '1px solid oklch(0.25 0.03 250)')
      .style('border-radius', '8px')
      .style('padding', '8px')
      .style('font-size', '12px')
      .style('color', 'oklch(0.85 0.01 250)')
      .style('pointer-events', 'none')
      .style('z-index', '1000')

    return () => {
      tooltip.remove()
    }
  }, [])

  return (
    <Card className="p-6 bg-card/80 border-border/30">
      <h4 className="text-sm font-semibold mb-4 text-foreground/90">FX Implied Volatility Surface Heatmap</h4>
      <div className="flex justify-center">
        <svg ref={svgRef}></svg>
      </div>
      <p className="text-xs text-muted-foreground mt-3 text-center">
        Volatility smile and term structure visualization (%, hover for details)
      </p>
    </Card>
  )
}
