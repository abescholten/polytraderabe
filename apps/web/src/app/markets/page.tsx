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
import { BarChart3, Globe } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { MarketLink } from '@/components/common/market-link'
import { formatCurrency, formatCompactNumber, formatDate } from '@/lib/utils/format'
import type { Market } from '@/types/market'

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tradingApi
      .getMarkets()
      .then(setMarkets)
      .catch(() => setMarkets([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Card className="border-[#2e3240] bg-[#1a1d27]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
          <BarChart3 className="size-4 text-blue-500" />
          Markets
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-lg bg-[#2e3240]/50 animate-pulse" />
            ))}
          </div>
        ) : markets.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[#2e3240]">
              <Globe className="size-6 text-[#8b8f9a]" />
            </div>
            <div>
              <p className="text-sm text-[#e8eaed]">No markets available</p>
              <p className="text-xs text-[#8b8f9a]">
                Markets will appear once the data pipeline fetches them from Polymarket
              </p>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-[#2e3240] hover:bg-transparent">
                <TableHead className="text-[#8b8f9a]">Question</TableHead>
                <TableHead className="text-[#8b8f9a]">Category</TableHead>
                <TableHead className="text-right text-[#8b8f9a]">Best Bid</TableHead>
                <TableHead className="text-right text-[#8b8f9a]">Best Ask</TableHead>
                <TableHead className="text-right text-[#8b8f9a]">Volume</TableHead>
                <TableHead className="text-[#8b8f9a]">End Date</TableHead>
                <TableHead className="text-[#8b8f9a]">Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {markets.map((market) => (
                <TableRow key={market.id} className="border-[#2e3240]">
                  <TableCell className="max-w-[300px] truncate text-[#e8eaed]">
                    {market.question}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                      {market.category}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-[#e8eaed]">
                    {market.best_bid !== null
                      ? formatCurrency(market.best_bid)
                      : '--'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[#e8eaed]">
                    {market.best_ask !== null
                      ? formatCurrency(market.best_ask)
                      : '--'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[#e8eaed]">
                    {market.volume !== null
                      ? `$${formatCompactNumber(market.volume)}`
                      : '--'}
                  </TableCell>
                  <TableCell className="text-xs text-[#8b8f9a]">
                    {formatDate(market.end_date)}
                  </TableCell>
                  <TableCell>
                    <MarketLink slug={market.slug} label="View" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
