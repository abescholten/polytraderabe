'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, ArrowRight } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import type { Signal } from '@/types/signal'

export function ActiveSignals() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    tradingApi
      .getSignals('pending')
      .then(setSignals)
      .catch(() => setSignals([]))
      .finally(() => setLoading(false))
  }, [])

  const pendingCount = signals.length

  return (
    <Card className="border-[#2e3240] bg-[#1a1d27]">
      <CardHeader>
        <CardTitle className="text-[#e8eaed]">Active Signals</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-24 rounded-lg bg-[#2e3240]/50 animate-pulse" />
        ) : pendingCount === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-[#2e3240]">
              <Zap className="size-5 text-[#8b8f9a]" />
            </div>
            <div>
              <p className="text-sm text-[#8b8f9a]">No pending signals</p>
              <p className="text-xs text-[#8b8f9a]/60">
                Signals will appear when strategies detect opportunities
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-[#0f1117] p-4">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
                <Zap className="size-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-mono text-2xl font-bold text-amber-500">
                  {pendingCount}
                </p>
                <p className="text-xs text-[#8b8f9a]">Pending Approval</p>
              </div>
            </div>
            <Link
              href="/signals"
              className="flex items-center justify-center gap-2 rounded-lg border border-[#2e3240] px-4 py-2 text-sm text-blue-500 transition-colors hover:bg-blue-500/5"
            >
              Review Signals
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
