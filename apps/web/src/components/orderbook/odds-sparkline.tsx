'use client'

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import type { OddsTimepoint } from '@/types/orderbook'

interface Props {
  points: OddsTimepoint[]
  loading?: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

// Recharts tooltip formatter
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number | [number, number] | null; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const mid = payload.find((p) => p.dataKey === 'mid_price')?.value
  const bid = payload.find((p) => p.dataKey === 'best_bid')?.value
  const ask = payload.find((p) => p.dataKey === 'best_ask')?.value
  return (
    <div className="rounded border border-[#2e3240] bg-[#1a1d27] px-3 py-2 text-xs">
      <p className="mb-1 text-[#8b8f9a]">{label}</p>
      {typeof mid === 'number' && (
        <p className="text-[#e8eaed]">Mid: {`${(mid * 100).toFixed(1)}%`}</p>
      )}
      {typeof bid === 'number' && typeof ask === 'number' && (
        <p className="text-[#8b8f9a]">
          Bid {`${(bid * 100).toFixed(1)}%`} / Ask {`${(ask * 100).toFixed(1)}%`}
        </p>
      )}
    </div>
  )
}

export function OddsSparkline({ points, loading }: Props) {
  if (loading) {
    return (
      <div
        data-testid="sparkline-loading"
        className="h-40 animate-pulse rounded-lg bg-[#2e3240]/50"
      />
    )
  }

  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[#8b8f9a]">
        No history data
      </div>
    )
  }

  const data = points.map((p) => ({
    t: formatTime(p.recorded_at),
    mid_price: p.mid_price,
    best_bid: p.best_bid,
    best_ask: p.best_ask,
    spread_band:
      p.best_bid !== null && p.best_ask !== null
        ? [p.best_bid, p.best_ask]
        : undefined,
  }))

  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3240" vertical={false} />
        <XAxis
          dataKey="t"
          tick={{ fontSize: 10, fill: '#8b8f9a' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 10, fill: '#8b8f9a' }}
          tickLine={false}
          axisLine={false}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        {/* Spread band: shaded area between best_bid and best_ask */}
        <Area
          type="monotone"
          dataKey="spread_band"
          stroke="none"
          fill="#3b82f6"
          fillOpacity={0.12}
          isAnimationActive={false}
        />
        {/* Mid price line */}
        <Line
          type="monotone"
          dataKey="mid_price"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
