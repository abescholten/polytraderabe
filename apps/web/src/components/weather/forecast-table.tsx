'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { CityDetailForecast } from '@/types/weather'

function probColor(value: number): string {
  if (value > 0.7) return '#22c55e'
  if (value >= 0.3) return '#f59e0b'
  return '#ef4444'
}

function formatProb(
  forecast: CityDetailForecast,
  threshold: string
): { text: string; color: string } | null {
  const ecmwf = forecast.models['ecmwf']
  if (!ecmwf) return null
  const prob = ecmwf.probability_above[threshold]
  if (prob === undefined) return null
  return {
    text: `${(prob * 100).toFixed(0)}%`,
    color: probColor(prob),
  }
}

function ModelCell({
  forecast,
  modelKey,
}: {
  forecast: CityDetailForecast
  modelKey: string
}) {
  const model = forecast.models[modelKey]
  if (!model || model.mean === null) {
    return <span className="text-[#8b8f9a]">&mdash;</span>
  }
  return (
    <div>
      <span className="font-mono font-bold text-[#e8eaed]">
        {model.mean.toFixed(1)}&deg;C
      </span>
      {model.min !== null && model.max !== null && (
        <div className="font-mono text-xs text-[#8b8f9a]">
          ({model.min.toFixed(1)}&mdash;{model.max.toFixed(1)})
        </div>
      )}
    </div>
  )
}

export function ForecastTable({
  forecasts,
}: {
  forecasts: CityDetailForecast[]
}) {
  if (forecasts.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#8b8f9a]">
        No forecast data available.
      </p>
    )
  }

  return (
    <Table className="border-[#2e3240]">
      <TableHeader>
        <TableRow className="border-[#2e3240] hover:bg-transparent">
          <TableHead className="text-[#8b8f9a]">Date</TableHead>
          <TableHead className="text-[#8b8f9a]">ECMWF</TableHead>
          <TableHead className="text-[#8b8f9a]">GFS</TableHead>
          <TableHead className="text-[#8b8f9a]">ICON</TableHead>
          <TableHead className="text-center text-[#8b8f9a]">
            P(&gt;15&deg;C)
          </TableHead>
          <TableHead className="text-center text-[#8b8f9a]">
            P(&gt;20&deg;C)
          </TableHead>
          <TableHead className="text-center text-[#8b8f9a]">
            P(&gt;25&deg;C)
          </TableHead>
          <TableHead className="text-center text-[#8b8f9a]">
            P(&gt;30&deg;C)
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {forecasts.map((forecast) => {
          const p15 = formatProb(forecast, '15')
          const p20 = formatProb(forecast, '20')
          const p25 = formatProb(forecast, '25')
          const p30 = formatProb(forecast, '30')

          return (
            <TableRow
              key={forecast.forecast_date}
              className="border-[#2e3240] hover:bg-[#1e2230]"
            >
              <TableCell className="font-mono text-[#e8eaed]">
                {forecast.forecast_date}
              </TableCell>
              <TableCell>
                <ModelCell forecast={forecast} modelKey="ecmwf" />
              </TableCell>
              <TableCell>
                <ModelCell forecast={forecast} modelKey="gfs" />
              </TableCell>
              <TableCell>
                <ModelCell forecast={forecast} modelKey="icon" />
              </TableCell>
              <TableCell className="text-center">
                {p15 ? (
                  <span className="font-mono text-sm" style={{ color: p15.color }}>
                    {p15.text}
                  </span>
                ) : (
                  <span className="text-[#8b8f9a]">&mdash;</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {p20 ? (
                  <span className="font-mono text-sm" style={{ color: p20.color }}>
                    {p20.text}
                  </span>
                ) : (
                  <span className="text-[#8b8f9a]">&mdash;</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {p25 ? (
                  <span className="font-mono text-sm" style={{ color: p25.color }}>
                    {p25.text}
                  </span>
                ) : (
                  <span className="text-[#8b8f9a]">&mdash;</span>
                )}
              </TableCell>
              <TableCell className="text-center">
                {p30 ? (
                  <span className="font-mono text-sm" style={{ color: p30.color }}>
                    {p30.text}
                  </span>
                ) : (
                  <span className="text-[#8b8f9a]">&mdash;</span>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
