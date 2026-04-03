'use client'

import { useEffect, useState } from 'react'
import { tradingApi } from '@/lib/api/trading-api'
import { CityCard } from '@/components/weather/city-card'
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

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="h-48 animate-pulse rounded-xl border border-[#2e3240] bg-[#1a1d27]"
        />
      ))}
    </div>
  )
}

export default function WeatherPage() {
  const [cities, setCities] = useState<CityWeather[]>([])
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    tradingApi
      .getWeatherForecasts()
      .then((data) => {
        setCities(data.cities)
        setFetchedAt(data.fetched_at)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch weather data')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[#e8eaed]">
            Weather Forecasts
          </h2>
          <p className="mt-1 text-sm text-[#8b8f9a]">
            12 European Capitals &mdash; Updated hourly
          </p>
        </div>
        {fetchedAt && (
          <span className="inline-flex items-center rounded-md bg-[#2e3240] px-2.5 py-1 text-xs font-mono text-[#8b8f9a]">
            Last sync: {timeAgo(fetchedAt)}
          </span>
        )}
      </div>

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-4 text-sm text-[#ef4444]">
          {error}
        </div>
      )}

      {!loading && !error && cities.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium text-[#8b8f9a]">
            No weather data yet
          </p>
          <p className="mt-1 text-sm text-[#8b8f9a]">
            Weather forecasts will appear here once the data pipeline runs.
          </p>
        </div>
      )}

      {!loading && !error && cities.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <CityCard key={city.city} city={city} />
          ))}
        </div>
      )}
    </div>
  )
}
