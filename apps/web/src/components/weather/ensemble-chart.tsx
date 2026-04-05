'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { CityDetailForecast } from '@/types/weather'

interface ChartDataPoint {
  date: string
  ecmwfMean: number | null
  ecmwfMin: number | null
  ecmwfMax: number | null
  ecmwfRange: [number, number] | null
  gfsMean: number | null
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number | null; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const ecmwfMean = payload.find((p) => p.dataKey === 'ecmwfMean')
  const ecmwfRange = payload.find((p) => p.dataKey === 'ecmwfRange')
  const gfsMean = payload.find((p) => p.dataKey === 'gfsMean')

  const rangeValue = ecmwfRange?.value as unknown as [number, number] | null

  return (
    <div className="rounded-lg border border-[#2e3240] bg-[#1a1d27] px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-xs text-[#8b8f9a]">{label}</p>
      {ecmwfMean?.value !== null && ecmwfMean?.value !== undefined && (
        <p className="font-mono text-sm text-[#3b82f6]">
          ECMWF Mean: {ecmwfMean.value.toFixed(1)}&deg;C
        </p>
      )}
      {rangeValue && (
        <p className="font-mono text-xs text-[#8b8f9a]">
          Range: {rangeValue[0].toFixed(1)}&deg;C &mdash;{' '}
          {rangeValue[1].toFixed(1)}&deg;C
        </p>
      )}
      {gfsMean?.value !== null && gfsMean?.value !== undefined && (
        <p className="font-mono text-sm text-[#f59e0b]">
          GFS Mean: {gfsMean.value.toFixed(1)}&deg;C
        </p>
      )}
    </div>
  )
}

export function EnsembleChart({
  forecasts,
}: {
  forecasts: CityDetailForecast[]
}) {
  const data = useMemo<ChartDataPoint[]>(() => {
    return forecasts.map((f) => {
      const ecmwf = f.models['ecmwf_ifs']
      const gfs = f.models['gfs_seamless']
      return {
        date: f.forecast_date,
        ecmwfMean: ecmwf?.mean ?? null,
        ecmwfMin: ecmwf?.min ?? null,
        ecmwfMax: ecmwf?.max ?? null,
        ecmwfRange:
          ecmwf?.min !== null &&
          ecmwf?.min !== undefined &&
          ecmwf?.max !== null &&
          ecmwf?.max !== undefined
            ? [ecmwf.min, ecmwf.max]
            : null,
        gfsMean: gfs?.mean ?? null,
      }
    })
  }, [forecasts])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#8b8f9a]">
        No chart data available.
      </p>
    )
  }

  return (
    <div className="h-[400px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2e3240" />
          <XAxis
            dataKey="date"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
            tickFormatter={(value: string) => value.slice(5)}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
            tickFormatter={(value: number) => `${value}\u00b0C`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, fontFamily: 'monospace', color: '#9ca3af' }}
          />
          <Area
            type="monotone"
            dataKey="ecmwfRange"
            name="ECMWF Range"
            stroke="none"
            fill="#3b82f6"
            fillOpacity={0.2}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="ecmwfMean"
            name="ECMWF Mean"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="gfsMean"
            name="GFS Mean"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
