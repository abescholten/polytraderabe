// apps/web/src/app/markets/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { tradingApi } from '@/lib/api/trading-api'
import { BidAskLadder } from '@/components/orderbook/bid-ask-ladder'
import { OddsSparkline } from '@/components/orderbook/odds-sparkline'
import { DepthChart } from '@/components/orderbook/depth-chart'
import { MarketLink } from '@/components/common/market-link'
import { formatCurrency, formatCompactNumber, formatDate } from '@/lib/utils/format'
import type { Market } from '@/types/market'
import type { OrderbookSnapshot, OddsTimepoint } from '@/types/orderbook'

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [market, setMarket] = useState<Market | null>(null)
  const [yesSnapshot, setYesSnapshot] = useState<OrderbookSnapshot | null>(null)
  const [noSnapshot, setNoSnapshot] = useState<OrderbookSnapshot | null>(null)
  const [history, setHistory] = useState<OddsTimepoint[]>([])
  const [loading, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      tradingApi.getMarket(id),
      tradingApi.getOrderbook(id),
    ])
      .then(([mkt, ob]) => {
        setMarket(mkt)
        const yes = ob.snapshots.find((s) => s.side === 'YES') ?? null
        const no = ob.snapshots.find((s) => s.side === 'NO') ?? null
        setYesSnapshot(yes)
        setNoSnapshot(no)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    tradingApi
      .getOrderbookHistory(id, 'YES', 24, 5)
      .then((res) => setHistory(res.points))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded bg-[#2e3240]/50" />
        <div className="h-40 animate-pulse rounded-lg bg-[#2e3240]/50" />
        <div className="grid grid-cols-2 gap-4">
          <div className="h-64 animate-pulse rounded-lg bg-[#2e3240]/50" />
          <div className="h-64 animate-pulse rounded-lg bg-[#2e3240]/50" />
        </div>
      </div>
    )
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-[#e8eaed]">Market not found</p>
        <Link href="/markets" className="text-xs text-blue-500 hover:underline">
          ← Back to markets
        </Link>
      </div>
    )
  }

  const midPrice = yesSnapshot?.mid_price ?? null
  const spread = yesSnapshot?.spread ?? null

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link
        href="/markets"
        className="flex w-fit items-center gap-1 text-xs text-[#8b8f9a] hover:text-[#e8eaed]"
      >
        <ArrowLeft className="size-3" />
        Markets
      </Link>

      {/* Market header */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-start justify-between gap-4 text-[#e8eaed]">
            <span className="text-base font-semibold leading-snug">{market.question}</span>
            <MarketLink slug={market.slug} label="Polymarket ↗" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-6 text-xs text-[#8b8f9a]">
            <div>
              <span>Category</span>
              <p className="mt-0.5 font-medium text-[#e8eaed]">{market.category}</p>
            </div>
            <div>
              <span>Ends</span>
              <p className="mt-0.5 font-medium text-[#e8eaed]">{formatDate(market.end_date)}</p>
            </div>
            {market.volume !== null && (
              <div>
                <span>Volume</span>
                <p className="mt-0.5 font-medium text-[#e8eaed]">
                  ${formatCompactNumber(market.volume)}
                </p>
              </div>
            )}
            {midPrice !== null && (
              <div>
                <span>YES mid</span>
                <p className="mt-0.5 font-mono font-semibold text-blue-400">
                  {formatCurrency(midPrice)}
                </p>
              </div>
            )}
            {spread !== null && (
              <div>
                <span>Spread</span>
                <p className="mt-0.5 font-mono font-medium text-[#e8eaed]">
                  {formatCurrency(spread)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Odds history sparkline */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-[#e8eaed]">
            <TrendingUp className="size-4 text-blue-500" />
            YES probability — last 24h
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OddsSparkline points={history} loading={historyLoading} />
        </CardContent>
      </Card>

      {/* Orderbook: ladder + depth side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-[#2e3240] bg-[#1a1d27]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#e8eaed]">YES orderbook</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-3">
            <BidAskLadder snapshot={yesSnapshot} />
          </CardContent>
        </Card>

        <Card className="border-[#2e3240] bg-[#1a1d27]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#e8eaed]">Depth chart</CardTitle>
          </CardHeader>
          <CardContent>
            <DepthChart snapshot={yesSnapshot} loading={loading} />
            {noSnapshot && (
              <>
                <p className="mt-4 mb-2 text-xs font-semibold text-[#8b8f9a]">
                  NO orderbook
                </p>
                <BidAskLadder snapshot={noSnapshot} />
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
