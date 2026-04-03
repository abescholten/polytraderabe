'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Brain, Activity } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { formatPercent, formatNumber } from '@/lib/utils/format'
import { pnlColor } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import type { StrategyPerformance } from '@/types/strategy'

export function StrategyHealth() {
  const [strategies, setStrategies] = useState<StrategyPerformance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tradingApi
      .getStrategyPerformance()
      .then(setStrategies)
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="border-[#2e3240] bg-[#1a1d27]">
      <CardHeader>
        <CardTitle className="text-[#e8eaed]">Strategy Health</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-[#2e3240]/50 animate-pulse" />
            ))}
          </div>
        ) : strategies.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#2e3240]">
              <Brain className="size-5 text-[#8b8f9a]" />
            </div>
            <div>
              <p className="text-sm text-[#8b8f9a]">No strategies configured</p>
              <p className="text-xs text-[#8b8f9a]/60">
                Add strategies in the Algorithms page
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {strategies.map((strategy) => (
              <div
                key={strategy.strategy_id}
                className="rounded-lg bg-[#0f1117] p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="size-3.5 text-blue-500" />
                    <span className="text-sm font-medium text-[#e8eaed]">
                      {strategy.strategy_name}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-[#8b8f9a]">
                    {strategy.total_trades} trades
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-[#8b8f9a]">Brier Score</p>
                    <p className="font-mono text-sm font-medium text-[#e8eaed]">
                      {strategy.brier_score !== null
                        ? formatNumber(strategy.brier_score, 3)
                        : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8b8f9a]">ROI</p>
                    <p
                      className={cn(
                        'font-mono text-sm font-medium',
                        pnlColor(strategy.roi ?? 0)
                      )}
                    >
                      {strategy.roi !== null
                        ? formatPercent(strategy.roi)
                        : '--'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8b8f9a]">Win Rate</p>
                    <p className="font-mono text-sm font-medium text-[#e8eaed]">
                      {strategy.win_rate !== null
                        ? formatPercent(strategy.win_rate, 0)
                        : '--'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
