'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Activity, Pause, XCircle, FlaskConical } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { formatPercent, formatNumber } from '@/lib/utils/format'
import { statusColor, pnlColor } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import type { Strategy } from '@/types/strategy'

const statusIcons: Record<string, typeof Activity> = {
  active: Activity,
  paused: Pause,
  disabled: XCircle,
  backtesting: FlaskConical,
}

export default function AlgorithmsPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tradingApi
      .getStrategies()
      .then(setStrategies)
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#e8eaed]">Trading Algorithms</h2>
          <p className="text-sm text-[#8b8f9a]">
            Manage and monitor your prediction market strategies
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 rounded-xl bg-[#1a1d27] border border-[#2e3240] animate-pulse" />
          ))}
        </div>
      ) : strategies.length === 0 ? (
        <Card className="border-[#2e3240] bg-[#1a1d27]">
          <CardContent>
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#2e3240]">
                <Brain className="size-6 text-[#8b8f9a]" />
              </div>
              <div>
                <p className="text-sm text-[#e8eaed]">No strategies configured</p>
                <p className="text-xs text-[#8b8f9a]">
                  Strategies are defined in the backend configuration and will appear here automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {strategies.map((strategy) => {
            const StatusIcon = statusIcons[strategy.status] || Activity
            return (
              <Card
                key={strategy.id}
                className="border-[#2e3240] bg-[#1a1d27] transition-colors hover:border-[#3b82f6]/30"
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between text-[#e8eaed]">
                    <div className="flex items-center gap-2">
                      <Brain className="size-4 text-blue-500" />
                      <span className="text-sm">{strategy.name}</span>
                    </div>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
                        statusColor(strategy.status)
                      )}
                    >
                      <StatusIcon className="size-3" />
                      {strategy.status}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-xs text-[#8b8f9a] line-clamp-2">
                    {strategy.description}
                  </p>

                  <div className="mb-3">
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                      {strategy.category}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-[#0f1117] p-2">
                      <p className="text-xs text-[#8b8f9a]">Brier Score</p>
                      <p className="font-mono text-sm font-medium text-[#e8eaed]">
                        {strategy.brier_score !== null
                          ? formatNumber(strategy.brier_score, 3)
                          : '--'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#0f1117] p-2">
                      <p className="text-xs text-[#8b8f9a]">ROI</p>
                      <p
                        className={cn(
                          'font-mono text-sm font-medium',
                          pnlColor(strategy.roi ?? 0)
                        )}
                      >
                        {strategy.roi !== null ? formatPercent(strategy.roi) : '--'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#0f1117] p-2">
                      <p className="text-xs text-[#8b8f9a]">Trades</p>
                      <p className="font-mono text-sm font-medium text-[#e8eaed]">
                        {strategy.total_trades}
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#0f1117] p-2">
                      <p className="text-xs text-[#8b8f9a]">Win Rate</p>
                      <p className="font-mono text-sm font-medium text-[#e8eaed]">
                        {strategy.win_rate !== null
                          ? formatPercent(strategy.win_rate, 0)
                          : '--'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
