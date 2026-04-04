'use client'

import { useMemo } from 'react'
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

interface TooltipProps {
  active?: boolean
  label?: string
  payload?: Array<{ dataKey: string; value: number | [number, number] | null }>
}

function ActualsTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const meanEntry = payload.find((p) => p.dataKey === 'mean')
  const rangeEntry = payload.find((p) => p.dataKey === 'range')
  const meanVal = typeof meanEntry?.value === 'number' ? meanEntry.value : null
  const rangeVal = Array.isArray(rangeEntry?.value)
    ? (rangeEntry.value as [number, number])
    : null

  return (
    <div
      className="rounded-lg border border-[#2e3240] bg-[#1a1d27] p-2 text-xs font-mono"
      style={{ fontSize: 12 }}
    >
      <p className="mb-1 text-[#e8eaed]">{label}</p>
      {meanVal !== null && (
        <p className="text-[#3b82f6]">Gemiddeld: {meanVal.toFixed(1)}°C</p>
      )}
      {rangeVal && (
        <p className="text-[#9ca3af]">
          Spreiding: {rangeVal[0].toFixed(1)}° – {rangeVal[1].toFixed(1)}°C
        </p>
      )}
    </div>
  )
}

function formatDate(iso: string): string {
  const [, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(2000, month - 1, day))
    .toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function ActualsChart({ actuals }: ActualsChartProps) {
  const data = useMemo(() =>
    actuals.map((a) => ({
      date: formatDate(a.date),
      range: a.daily_min !== null && a.daily_max !== null
        ? ([a.daily_min, a.daily_max] as [number, number])
        : null,
      mean: a.daily_mean,
    })),
  [actuals])

  if (actuals.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#8b8f9a]">
        Geen historische data beschikbaar
      </p>
    )
  }

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
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="mean"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          name="mean"
          isAnimationActive={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
