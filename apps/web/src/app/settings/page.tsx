'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Settings,
  Shield,
  Wifi,
  WifiOff,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking')
  const [apiVersion, setApiVersion] = useState<string | null>(null)

  const tradingMode = process.env.NEXT_PUBLIC_TRADING_MODE || 'paper'

  useEffect(() => {
    tradingApi
      .health()
      .then((data) => {
        setApiStatus('connected')
        setApiVersion(data.version)
      })
      .catch(() => {
        setApiStatus('disconnected')
      })
  }, [])

  const riskLimits = [
    { label: 'Max Position Size', value: '$500', description: 'Maximum investment per market' },
    { label: 'Max Total Exposure', value: '50%', description: 'Maximum percentage of portfolio at risk' },
    { label: 'Min Edge Threshold', value: '5%', description: 'Minimum edge required to generate signals' },
    { label: 'Max Daily Loss', value: '$200', description: 'Trading halts if daily loss exceeds this' },
    { label: 'Kelly Fraction Cap', value: '25%', description: 'Maximum fraction of Kelly criterion to use' },
    { label: 'Min Liquidity', value: '$10,000', description: 'Minimum market liquidity to trade' },
  ]

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Trading Mode */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
            <Shield className="size-4 text-amber-500" />
            Trading Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 rounded-lg bg-[#0f1117] p-4">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-full',
                tradingMode === 'live'
                  ? 'bg-red-500/10'
                  : 'bg-amber-500/10'
              )}
            >
              {tradingMode === 'live' ? (
                <AlertTriangle className="size-5 text-red-500" />
              ) : (
                <Shield className="size-5 text-amber-500" />
              )}
            </div>
            <div>
              <p
                className={cn(
                  'font-mono text-sm font-bold uppercase',
                  tradingMode === 'live' ? 'text-red-500' : 'text-amber-500'
                )}
              >
                {tradingMode === 'live' ? 'LIVE TRADING' : 'PAPER TRADING'}
              </p>
              <p className="text-xs text-[#8b8f9a]">
                {tradingMode === 'live'
                  ? 'Real money is at risk. All trades execute on Polymarket.'
                  : 'Simulated trading. No real money is used. Trades are recorded locally.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Limits */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
            <Settings className="size-4 text-blue-500" />
            Risk Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {riskLimits.map((limit) => (
              <div
                key={limit.label}
                className="flex items-center justify-between rounded-lg bg-[#0f1117] p-3"
              >
                <div className="flex-1">
                  <p className="text-sm text-[#e8eaed]">{limit.label}</p>
                  <p className="text-xs text-[#8b8f9a]">{limit.description}</p>
                </div>
                <span className="font-mono text-sm font-medium text-[#e8eaed]">
                  {limit.value}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-[#8b8f9a]">
            Risk limits are configured in the backend. Contact the system administrator to modify these values.
          </p>
        </CardContent>
      </Card>

      {/* API Connection */}
      <Card className="border-[#2e3240] bg-[#1a1d27]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#e8eaed]">
            {apiStatus === 'connected' ? (
              <Wifi className="size-4 text-green-500" />
            ) : (
              <WifiOff className="size-4 text-red-500" />
            )}
            API Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg bg-[#0f1117] p-3">
              <div className="flex items-center gap-3">
                {apiStatus === 'checking' ? (
                  <div className="size-2 rounded-full bg-amber-500 animate-pulse" />
                ) : apiStatus === 'connected' ? (
                  <CheckCircle className="size-4 text-green-500" />
                ) : (
                  <WifiOff className="size-4 text-red-500" />
                )}
                <div>
                  <p className="text-sm text-[#e8eaed]">Trading API</p>
                  <p className="text-xs text-[#8b8f9a]">
                    {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                  apiStatus === 'checking'
                    ? 'bg-amber-500/10 text-amber-500'
                    : apiStatus === 'connected'
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-red-500/10 text-red-500'
                )}
              >
                {apiStatus === 'checking'
                  ? 'Checking...'
                  : apiStatus === 'connected'
                    ? 'Connected'
                    : 'Disconnected'}
              </span>
            </div>

            {apiVersion && (
              <div className="flex items-center justify-between rounded-lg bg-[#0f1117] p-3">
                <p className="text-sm text-[#8b8f9a]">API Version</p>
                <span className="font-mono text-sm text-[#e8eaed]">{apiVersion}</span>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg bg-[#0f1117] p-3">
              <p className="text-sm text-[#8b8f9a]">Supabase</p>
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                  process.env.NEXT_PUBLIC_SUPABASE_URL
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                )}
              >
                {process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured' : 'Not Configured'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
