'use client'

import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { WeatherActual } from '@/types/weather'

interface ActualsChartProps {
  actuals: WeatherActual[]
}

function ActualsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: unknown; color: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null

  const meanEntry = payload.find((p) => p.dataKey === 'mean')
  const mean = meanEntry?.value

  return (
    <div className="rounded-lg border border-[#2e3240] bg-[#1a1d27] px-3 py-2 shadow-lg">
      <p className="mb-1 font-mono text-xs text-[#9ca3af]">{label}</p>
      {mean !== null && mean !== undefined && (
        <p className="font-mono text-sm text-[#3b82f6]">
          Gemiddeld: {(mean as number).toFixed(1)}&deg;C
        </p>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

export function ActualsChart({ actuals }: ActualsChartProps) {
  if (actuals.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#8b8f9a]">
        Geen historische data beschikbaar
      </p>
    )
  }

  const data = actuals.map((a) => ({
    date: formatDate(a.date),
    range: [a.daily_min ?? 0, a.daily_max ?? 0] as [number, number],
    mean: a.daily_mean,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3240" />
        <XAxis
          dataKey="date"
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12, fontFamily: 'monospace' }}
          tickFormatter={(value: number) => `${value}\u00b0C`}
          width={36}
        />
        <Tooltip content={<ActualsTooltip />} />
        <Area
          type="monotone"
          dataKey="range"
          fill="#3b82f6"
          fillOpacity={0.2}
          stroke="none"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="mean"
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
