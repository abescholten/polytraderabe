'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { pnlColor } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'

interface PortfolioData {
  total_value: number
  daily_pnl: number
  total_pnl: number
  total_exposure: number
  open_positions: number
}

const defaultData: PortfolioData = {
  total_value: 10000,
  daily_pnl: 0,
  total_pnl: 0,
  total_exposure: 0,
  open_positions: 0,
}

export function PortfolioSummary() {
  const [data, setData] = useState<PortfolioData>(defaultData)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tradingApi
      .getPortfolioSummary()
      .then(setData)
      .catch(() => setData(defaultData))
      .finally(() => setLoading(false))
  }, [])

  const stats = [
    {
      label: 'Total Value',
      value: formatCurrency(data.total_value),
      icon: DollarSign,
      color: 'text-blue-500',
    },
    {
      label: 'Daily P&L',
      value: formatCurrency(data.daily_pnl),
      icon: data.daily_pnl >= 0 ? TrendingUp : TrendingDown,
      color: pnlColor(data.daily_pnl),
    },
    {
      label: 'Total P&L',
      value: formatCurrency(data.total_pnl),
      icon: data.total_pnl >= 0 ? TrendingUp : TrendingDown,
      color: pnlColor(data.total_pnl),
    },
    {
      label: 'Exposure',
      value: formatPercent(data.total_exposure),
      icon: PieChart,
      color: 'text-amber-500',
    },
  ]

  return (
    <Card className="border-[#2e3240] bg-[#1a1d27]">
      <CardHeader>
        <CardTitle className="text-[#e8eaed]">Portfolio Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-[#2e3240]/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon
              return (
                <div
                  key={stat.label}
                  className="flex flex-col gap-1 rounded-lg bg-[#0f1117] p-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className={cn('size-3.5', stat.color)} />
                    <span className="text-xs text-[#8b8f9a]">{stat.label}</span>
                  </div>
                  <span className={cn('font-mono text-lg font-semibold', stat.color)}>
                    {stat.value}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
