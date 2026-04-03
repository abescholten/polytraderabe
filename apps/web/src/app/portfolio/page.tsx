'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Briefcase, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { formatCurrency, formatPercent } from '@/lib/utils/format'
import { pnlColor } from '@/lib/utils/colors'
import { cn } from '@/lib/utils'
import type { Position } from '@/types/trade'

interface PortfolioData {
  total_value: number
  daily_pnl: number
  total_pnl: number
  total_exposure: number
  open_positions: number
}

const defaultPortfolio: PortfolioData = {
  total_value: 10000,
  daily_pnl: 0,
  total_pnl: 0,
  total_exposure: 0,
  open_positions: 0,
}

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [portfolio, setPortfolio] = useState<PortfolioData>(defaultPortfolio)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      tradingApi.getPositions().catch(() => []),
      tradingApi.getPortfolioSummary().catch(() => defaultPortfolio),
    ])
      .then(([pos, port]) => {
        setPositions(pos)
        setPortfolio(port)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      {/* Portfolio Summary Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          {
            label: 'Total Value',
            value: formatCurrency(portfolio.total_value),
            icon: Wallet,
            color: 'text-blue-500',
          },
          {
            label: 'Daily P&L',
            value: formatCurrency(portfolio.daily_pnl),
            icon: portfolio.daily_pnl >= 0 ? TrendingUp : TrendingDown,
            color: pnlColor(portfolio.daily_pnl),
          },
          {
            label: 'Total P&L',
            value: formatCurrency(portfolio.total_pnl),
            icon: portfolio.total_pnl >= 0 ? TrendingUp : TrendingDown,
            color: pnlColor(portfolio.total_pnl),
          },
          {
            label: 'Exposure',
            value: formatPercent(portfolio.total_exposure),
            icon: Briefcase,
            color: 'text-amber-500',
          },
        ].map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.label} className="border-[#2e3240] bg-[#1a1d27]">
              <CardContent className="flex items-center gap-3 pt-4">
                <div className={cn('flex size-10 items-center justify-center rounded-full bg-[#0f1117]')}>
                  <Icon className={cn('size-5', stat.color)} />
                </div>
                <div>
                  <p className="text-xs text-[#8b8f9a]">{stat.label}</p>
                  <p className={cn('font-mono text-xl font-bold', stat.color)}>
                    {loading ? '...' : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Positions Table */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
            <Briefcase className="size-4 text-blue-500" />
            Open Positions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg bg-[#2e3240]/50 animate-pulse" />
              ))}
            </div>
          ) : positions.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#2e3240]">
                <Briefcase className="size-6 text-[#8b8f9a]" />
              </div>
              <div>
                <p className="text-sm text-[#e8eaed]">No open positions</p>
                <p className="text-xs text-[#8b8f9a]">
                  Positions will appear after trades are executed
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2e3240] hover:bg-transparent">
                  <TableHead className="text-[#8b8f9a]">Market</TableHead>
                  <TableHead className="text-[#8b8f9a]">Outcome</TableHead>
                  <TableHead className="text-right text-[#8b8f9a]">Size</TableHead>
                  <TableHead className="text-right text-[#8b8f9a]">Avg Price</TableHead>
                  <TableHead className="text-right text-[#8b8f9a]">Current</TableHead>
                  <TableHead className="text-right text-[#8b8f9a]">Unrealized P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => (
                  <TableRow key={position.id} className="border-[#2e3240]">
                    <TableCell className="max-w-[250px] truncate text-[#e8eaed]">
                      {position.market_question || position.market_id.slice(0, 12)}
                    </TableCell>
                    <TableCell className="text-[#e8eaed]">
                      {position.outcome}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[#e8eaed]">
                      {position.size}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[#e8eaed]">
                      {formatCurrency(position.average_price)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[#e8eaed]">
                      {position.current_price !== null
                        ? formatCurrency(position.current_price)
                        : '--'}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono font-medium',
                        pnlColor(position.unrealized_pnl ?? 0)
                      )}
                    >
                      {position.unrealized_pnl !== null
                        ? formatCurrency(position.unrealized_pnl)
                        : '--'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
