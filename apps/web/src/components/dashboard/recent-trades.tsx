'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { formatCurrency, timeAgo } from '@/lib/utils/format'
import { pnlColor } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import type { Trade } from '@/types/trade'

export function RecentTrades() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tradingApi
      .getTrades(5)
      .then(setTrades)
      .catch(() => setTrades([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="border-[#2e3240] bg-[#1a1d27]">
      <CardHeader>
        <CardTitle className="text-[#e8eaed]">Recent Trades</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[#2e3240]/50 animate-pulse" />
            ))}
          </div>
        ) : trades.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#2e3240]">
              <Receipt className="size-5 text-[#8b8f9a]" />
            </div>
            <div>
              <p className="text-sm text-[#8b8f9a]">No trades yet</p>
              <p className="text-xs text-[#8b8f9a]/60">
                Trades will appear after signals are approved and executed
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center gap-3 rounded-lg bg-[#0f1117] p-3"
              >
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full',
                    trade.side === 'buy'
                      ? 'bg-green-500/10'
                      : 'bg-red-500/10'
                  )}
                >
                  {trade.side === 'buy' ? (
                    <ArrowUpRight className="size-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="size-4 text-red-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm text-[#e8eaed]">
                    {trade.market_question || `Market ${trade.market_id.slice(0, 8)}...`}
                  </p>
                  <p className="text-xs text-[#8b8f9a]">
                    {trade.side.toUpperCase()} {trade.outcome} at{' '}
                    <span className="font-mono">{formatCurrency(trade.price)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className={cn('font-mono text-sm font-medium', pnlColor(trade.pnl ?? 0))}>
                    {trade.pnl !== null ? formatCurrency(trade.pnl) : '--'}
                  </span>
                  <span className="text-xs text-[#8b8f9a]">
                    {timeAgo(trade.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
