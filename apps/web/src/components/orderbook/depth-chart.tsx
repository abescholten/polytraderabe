'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import type { OrderbookSnapshot } from '@/types/orderbook'

interface Props {
  snapshot: OrderbookSnapshot | null
  loading?: boolean
}

interface DepthPoint {
  price: number
  bidCumulative: number | null
  askCumulative: number | null
}

function buildDepthSeries(snapshot: OrderbookSnapshot): DepthPoint[] {
  // Bids: sorted highest price first (already from API) — cumulate top-down
  const bidPoints: DepthPoint[] = []
  let bidCum = 0
  for (let i = snapshot.bids.length - 1; i >= 0; i--) {
    const level = snapshot.bids[i]
    bidCum += Number(level.size)
    bidPoints.push({ price: Number(level.price), bidCumulative: bidCum, askCumulative: null })
  }

  // Asks: sorted lowest price first (already from API) — cumulate bottom-up
  const askPoints: DepthPoint[] = []
  let askCum = 0
  for (const level of snapshot.asks) {
    askCum += Number(level.size)
    askPoints.push({ price: Number(level.price), bidCumulative: null, askCumulative: askCum })
  }

  // Merge and sort by price ascending
  return [...bidPoints, ...askPoints].sort((a, b) => a.price - b.price)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number | null; dataKey: string; color: string }>
  label?: number
}) {
  if (!active || !payload?.length || label === undefined) return null
  return (
    <div className="rounded border border-[#2e3240] bg-[#1a1d27] px-3 py-2 text-xs">
      <p className="mb-1 text-[#8b8f9a]">{`${(label * 100).toFixed(1)}%`}</p>
      {payload.map((p) => {
        if (p.value == null) return null
        return (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey === 'bidCumulative' ? 'Bid depth' : 'Ask depth'}:{' '}
            ${p.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </p>
        )
      })}
    </div>
  )
}

export function DepthChart({ snapshot, loading }: Props) {
  if (loading) {
    return (
      <div
        data-testid="depth-chart-loading"
        className="h-40 animate-pulse rounded-lg bg-[#2e3240]/50"
      />
    )
  }

  if (!snapshot) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-[#8b8f9a]">
        No orderbook data
      </div>
    )
  }

  const data = buildDepthSeries(snapshot)

  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2e3240" vertical={false} />
        <XAxis
          dataKey="price"
          type="number"
          domain={[0, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 10, fill: '#8b8f9a' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) =>
            v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
          }
          tick={{ fontSize: 10, fill: '#8b8f9a' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<CustomTooltip />} />
        {snapshot.mid_price !== null && (
          <ReferenceLine
            x={snapshot.mid_price}
            stroke="#6b7280"
            strokeDasharray="4 2"
            label={{ value: 'Mid', fontSize: 9, fill: '#6b7280', position: 'top' }}
          />
        )}
        <Area
          type="stepAfter"
          dataKey="bidCumulative"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.2}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
        <Area
          type="stepBefore"
          dataKey="askCumulative"
          stroke="#ef4444"
          fill="#ef4444"
          fillOpacity={0.2}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
