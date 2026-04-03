'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import type { CityWeather } from '@/types/weather'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function tempColor(mean: number): string {
  if (mean < 10) return '#3b82f6'
  if (mean <= 24) return '#22c55e'
  if (mean <= 32) return '#f59e0b'
  return '#ef4444'
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function CityCard({ city }: { city: CityWeather }) {
  const today = new Date().toISOString().slice(0, 10)

  const todayData = useMemo(() => {
    const todayForecasts = city.forecasts.filter(
      (f) => f.forecast_date === today
    )
    if (todayForecasts.length === 0) return null

    const allMembers = todayForecasts.flatMap((f) => f.member_values)
    if (allMembers.length === 0) return null

    const min = Math.min(...allMembers)
    const max = Math.max(...allMembers)
    const mean = allMembers.reduce((a, b) => a + b, 0) / allMembers.length

    // Aggregate probability_above from all models for today
    const probAbove: Record<string, number[]> = {}
    for (const f of todayForecasts) {
      for (const [threshold, prob] of Object.entries(f.probability_above)) {
        if (!probAbove[threshold]) probAbove[threshold] = []
        probAbove[threshold].push(prob)
      }
    }
    const avgProb: Record<string, number> = {}
    for (const [threshold, probs] of Object.entries(probAbove)) {
      avgProb[threshold] = probs.reduce((a, b) => a + b, 0) / probs.length
    }

    return { min, max, mean, probAbove: avgProb }
  }, [city.forecasts, today])

  const color = todayData ? tempColor(todayData.mean) : '#3b82f6'

  return (
    <Link href={`/weather/${city.city}`} className="block">
      <Card className="border-[#2e3240] bg-[#1a1d27] transition-colors hover:bg-[#1e2230]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <div
              className="size-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <CardTitle className="text-[#e8eaed]">
              {capitalize(city.city)}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {todayData ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span
                  className="font-mono text-2xl font-bold"
                  style={{ color }}
                >
                  {todayData.mean.toFixed(1)}&deg;C
                </span>
                <span className="font-mono text-sm text-[#8b8f9a]">
                  {todayData.min.toFixed(1)}&deg;C &mdash;{' '}
                  {todayData.max.toFixed(1)}&deg;C
                </span>
              </div>
              <div className="flex gap-2">
                {todayData.probAbove['20'] !== undefined && (
                  <span className="inline-flex items-center rounded-md bg-[#2e3240] px-2 py-0.5 text-xs font-mono text-[#8b8f9a]">
                    P(&gt;20&deg;C){' '}
                    <span className="ml-1 text-[#e8eaed]">
                      {(todayData.probAbove['20'] * 100).toFixed(0)}%
                    </span>
                  </span>
                )}
                {todayData.probAbove['25'] !== undefined && (
                  <span className="inline-flex items-center rounded-md bg-[#2e3240] px-2 py-0.5 text-xs font-mono text-[#8b8f9a]">
                    P(&gt;25&deg;C){' '}
                    <span className="ml-1 text-[#e8eaed]">
                      {(todayData.probAbove['25'] * 100).toFixed(0)}%
                    </span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#8b8f9a]">No forecast for today</p>
          )}
        </CardContent>
        <CardFooter className="border-t border-[#2e3240] bg-transparent">
          <span className="text-xs text-[#8b8f9a]">
            Last updated: {timeAgo(city.fetched_at)}
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
