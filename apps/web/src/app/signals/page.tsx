'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Check, X, Zap, Clock } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { ProbabilityBadge } from '@/components/common/probability-badge'
import { EdgeIndicator } from '@/components/common/edge-indicator'
import { formatCurrency, formatDateTime, formatProbability } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { Signal, SignalStatus } from '@/types/signal'

export default function SignalsPage() {
  const [pendingSignals, setPendingSignals] = useState<Signal[]>([])
  const [historySignals, setHistorySignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  const fetchSignals = () => {
    setLoading(true)
    Promise.all([
      tradingApi.getSignals('pending').catch(() => []),
      tradingApi.getSignals().catch(() => []),
    ])
      .then(([pending, all]) => {
        setPendingSignals(pending)
        setHistorySignals(all.filter((s: Signal) => s.status !== 'pending'))
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchSignals()
  }, [])

  const handleApprove = async (id: string) => {
    try {
      await tradingApi.approveSignal(id)
      fetchSignals()
    } catch {
      // Silently fail - in production would show toast
    }
  }

  const handleReject = async (id: string) => {
    try {
      await tradingApi.rejectSignal(id)
      fetchSignals()
    } catch {
      // Silently fail - in production would show toast
    }
  }

  const statusBadgeColor = (status: SignalStatus) => {
    switch (status) {
      case 'approved':
      case 'executed':
        return 'bg-green-500/10 text-green-500'
      case 'rejected':
      case 'expired':
        return 'bg-red-500/10 text-red-500'
      default:
        return 'bg-amber-500/10 text-amber-500'
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Pending Approval */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
            <Zap className="size-4 text-amber-500" />
            Pending Approval
            {pendingSignals.length > 0 && (
              <span className="ml-2 flex size-5 items-center justify-center rounded-full bg-amber-500/20 font-mono text-xs text-amber-500">
                {pendingSignals.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-32 rounded-lg bg-[#2e3240]/50 animate-pulse" />
              ))}
            </div>
          ) : pendingSignals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-[#2e3240]">
                <Check className="size-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-[#e8eaed]">All caught up</p>
                <p className="text-xs text-[#8b8f9a]">No signals waiting for approval</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingSignals.map((signal) => (
                <div
                  key={signal.id}
                  className="rounded-lg border border-[#2e3240] bg-[#0f1117] p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e8eaed]">
                        {signal.market_question || `Signal ${signal.id.slice(0, 8)}`}
                      </p>
                      <p className="mt-1 text-xs text-[#8b8f9a]">
                        {signal.strategy_name || 'Unknown Strategy'} &middot;{' '}
                        {signal.direction.replace('_', ' ').toUpperCase()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20"
                        onClick={() => handleApprove(signal.id)}
                      >
                        <Check className="size-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/20 text-red-500 hover:bg-red-500/10"
                        onClick={() => handleReject(signal.id)}
                      >
                        <X className="size-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-[#8b8f9a]">Our Probability</p>
                      <ProbabilityBadge value={signal.our_probability} className="mt-1" />
                    </div>
                    <div>
                      <p className="text-xs text-[#8b8f9a]">Market Price</p>
                      <p className="mt-1 font-mono text-sm text-[#e8eaed]">
                        {formatProbability(signal.market_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8b8f9a]">Edge</p>
                      <EdgeIndicator value={signal.edge} className="mt-1" />
                    </div>
                    <div>
                      <p className="text-xs text-[#8b8f9a]">Confidence</p>
                      <p className="mt-1 font-mono text-sm text-[#e8eaed]">
                        {(signal.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-4 text-xs text-[#8b8f9a]">
                    <span>
                      Recommended size:{' '}
                      <span className="font-mono text-[#e8eaed]">
                        {formatCurrency(signal.recommended_size)}
                      </span>
                    </span>
                    <span>
                      Kelly:{' '}
                      <span className="font-mono text-[#e8eaed]">
                        {(signal.kelly_fraction * 100).toFixed(1)}%
                      </span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signal History */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
            <Clock className="size-4 text-[#8b8f9a]" />
            Signal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-48 rounded-lg bg-[#2e3240]/50 animate-pulse" />
          ) : historySignals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="text-sm text-[#8b8f9a]">No signal history yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[#2e3240] hover:bg-transparent">
                  <TableHead className="text-[#8b8f9a]">Market</TableHead>
                  <TableHead className="text-[#8b8f9a]">Direction</TableHead>
                  <TableHead className="text-[#8b8f9a]">Edge</TableHead>
                  <TableHead className="text-[#8b8f9a]">Status</TableHead>
                  <TableHead className="text-[#8b8f9a]">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historySignals.map((signal) => (
                  <TableRow key={signal.id} className="border-[#2e3240]">
                    <TableCell className="max-w-[200px] truncate text-[#e8eaed]">
                      {signal.market_question || signal.market_id.slice(0, 12)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-[#e8eaed]">
                      {signal.direction.replace('_', ' ').toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <EdgeIndicator value={signal.edge} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                          statusBadgeColor(signal.status)
                        )}
                      >
                        {signal.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-[#8b8f9a]">
                      {formatDateTime(signal.created_at)}
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
