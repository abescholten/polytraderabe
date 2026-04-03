'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { tradingApi } from '@/lib/api/trading-api'
import { EnsembleChart } from '@/components/weather/ensemble-chart'
import { ForecastTable } from '@/components/weather/forecast-table'
import { WeatherLegend } from '@/components/weather/weather-legend'
import type { CityDetail } from '@/types/weather'

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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-[400px] animate-pulse rounded-xl border border-[#2e3240] bg-[#1a1d27]" />
      <div className="h-64 animate-pulse rounded-xl border border-[#2e3240] bg-[#1a1d27]" />
    </div>
  )
}

export default function CityWeatherPage() {
  const params = useParams<{ city: string }>()
  const city = params.city
  const [data, setData] = useState<CityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!city) return
    tradingApi
      .getWeatherByCity(city)
      .then(setData)
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch city data')
      })
      .finally(() => setLoading(false))
  }, [city])

  return (
    <div className="space-y-6 p-6">
      <div>
        <Link
          href="/weather"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[#8b8f9a] transition-colors hover:text-[#e8eaed]"
        >
          <ArrowLeft className="size-4" />
          Back to Weather
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#e8eaed]">
              {capitalize(city)}
            </h2>
            {data?.lat !== null && data?.lon !== null && data && (
              <p className="mt-1 font-mono text-sm text-[#8b8f9a]">
                {data.lat?.toFixed(2)}&deg;N, {data.lon?.toFixed(2)}&deg;E
              </p>
            )}
          </div>
          {data?.fetched_at && (
            <span className="inline-flex items-center rounded-md bg-[#2e3240] px-2.5 py-1 text-xs font-mono text-[#8b8f9a]">
              Last sync: {timeAgo(data.fetched_at)}
            </span>
          )}
        </div>
      </div>

      {loading && <LoadingSkeleton />}

      {error && (
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 p-4 text-sm text-[#ef4444]">
          {error}
        </div>
      )}

      {!loading && !error && data && data.forecasts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-lg font-medium text-[#8b8f9a]">
            No data for this city
          </p>
          <p className="mt-1 text-sm text-[#8b8f9a]">
            Forecast data will appear once the pipeline processes this city.
          </p>
        </div>
      )}

      {!loading && !error && data && data.forecasts.length > 0 && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#2e3240] bg-[#1a1d27] p-4">
            <h3 className="mb-4 text-sm font-medium text-[#8b8f9a]">
              Ensemble Spread
            </h3>
            <EnsembleChart forecasts={data.forecasts} />
          </div>

          <div className="rounded-xl border border-[#2e3240] bg-[#1a1d27] p-4">
            <h3 className="mb-4 text-sm font-medium text-[#8b8f9a]">
              Daily Forecasts
            </h3>
            <ForecastTable forecasts={data.forecasts} />
          </div>

          <WeatherLegend sections={['models', 'chart', 'probability-colors']} />
        </div>
      )}
    </div>
  )
}
