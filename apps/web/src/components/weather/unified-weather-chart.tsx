'use client'

import { useMemo } from 'react'
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { WeatherActual, CityDetailForecast } from '@/types/weather'

interface UnifiedDataPoint {
  date: string
  actualMean: number | null
  actualRange: [number, number] | null
  ecmwfMean: number | null
  ecmwfRange: [number, number] | null
  gfsMean: number | null
  isForecast: boolean
}

function formatDateLabel(iso: string): string {
  const [, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(2000, month - 1, day)).toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ dataKey: string; value: number | [number, number] | null; payload: UnifiedDataPoint }>
  label?: string
}) {
  if (!active || !payload?.length || !label) return null

  const isForecast = payload[0]?.payload?.isForecast ?? false

  const actualMean = payload.find((p) => p.dataKey === 'actualMean')?.value
  const actualRange = payload.find((p) => p.dataKey === 'actualRange')?.value
  const ecmwfMean = payload.find((p) => p.dataKey === 'ecmwfMean')?.value
  const ecmwfRange = payload.find((p) => p.dataKey === 'ecmwfRange')?.value
  const gfsMean = payload.find((p) => p.dataKey === 'gfsMean')?.value

  return (
    <div className="rounded-lg border border-[#2e3240] bg-[#1a1d27] px-3 py-2 text-xs font-mono shadow-lg">
      <p className="mb-1 text-[#8b8f9a]">
        {formatDateLabel(label)}{' '}
        <span className={isForecast ? 'text-[#f59e0b]' : 'text-[#22c55e]'}>
          {isForecast ? '(prognose)' : '(gemeten)'}
        </span>
      </p>
      {typeof actualMean === 'number' && (
        <p className="text-[#3b82f6]">Gemiddeld: {actualMean.toFixed(1)}°C</p>
      )}
      {Array.isArray(actualRange) && (
        <p className="text-[#9ca3af]">
          Spreiding: {(actualRange as [number, number])[0].toFixed(1)}° – {(actualRange as [number, number])[1].toFixed(1)}°C
        </p>
      )}
      {typeof ecmwfMean === 'number' && (
        <p className="text-[#3b82f6]">ECMWF: {ecmwfMean.toFixed(1)}°C</p>
      )}
      {Array.isArray(ecmwfRange) && (
        <p className="text-[#9ca3af]">
          ECMWF spread: {(ecmwfRange as [number, number])[0].toFixed(1)}° – {(ecmwfRange as [number, number])[1].toFixed(1)}°C
        </p>
      )}
      {typeof gfsMean === 'number' && (
        <p className="text-[#f59e0b]">GFS: {gfsMean.toFixed(1)}°C</p>
      )}
    </div>
  )
}

interface UnifiedWeatherChartProps {
  actuals: WeatherActual[]
  forecasts: CityDetailForecast[]
  daysBack: number
  daysForward: number
}

export function UnifiedWeatherChart({
  actuals,
  forecasts,
  daysBack,
  daysForward,
}: UnifiedWeatherChartProps) {
  const today = new Date().toISOString().slice(0, 10)

  const data = useMemo<UnifiedDataPoint[]>(() => {
    const cutoffBack = new Date()
    cutoffBack.setDate(cutoffBack.getDate() - daysBack)
    const backStr = cutoffBack.toISOString().slice(0, 10)

    const cutoffFwd = new Date()
    cutoffFwd.setDate(cutoffFwd.getDate() + daysForward)
    const fwdStr = cutoffFwd.toISOString().slice(0, 10)

    const pointsMap = new Map<string, UnifiedDataPoint>()

    // Fill actuals (historical, up to and including today)
    for (const a of actuals) {
      if (a.date < backStr || a.date > today) continue
      pointsMap.set(a.date, {
        date: a.date,
        actualMean: a.daily_mean,
        actualRange:
          a.daily_min !== null && a.daily_max !== null
            ? [a.daily_min, a.daily_max]
            : null,
        ecmwfMean: null,
        ecmwfRange: null,
        gfsMean: null,
        isForecast: false,
      })
    }

    // Fill forecasts (today and future)
    for (const f of forecasts) {
      if (f.forecast_date < today || f.forecast_date > fwdStr) continue
      const ecmwf = f.models['ecmwf_ifs']
      const gfs = f.models['gfs_seamless']
      const existing = pointsMap.get(f.forecast_date)
      pointsMap.set(f.forecast_date, {
        date: f.forecast_date,
        actualMean: existing?.actualMean ?? null,
        actualRange: existing?.actualRange ?? null,
        ecmwfMean: ecmwf?.mean ?? null,
        ecmwfRange:
          ecmwf?.min != null && ecmwf?.max != null
            ? [ecmwf.min, ecmwf.max]
            : null,
        gfsMean: gfs?.mean ?? null,
        isForecast: true,
      })
    }

    return [...pointsMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [actuals, forecasts, daysBack, daysForward, today])

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#8b8f9a]">
        Geen data beschikbaar voor het geselecteerde venster.
      </p>
    )
  }

  return (
    <div className="w-full">
      <div className="h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2e3240" />
            <XAxis
              dataKey="date"
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={formatDateLabel}
              interval="preserveStartEnd"
            />
            <YAxis
              stroke="#9ca3af"
              tick={{ fill: '#9ca3af', fontSize: 11, fontFamily: 'monospace' }}
              tickFormatter={(v: number) => `${v}°C`}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Vandaag-marker */}
            <ReferenceLine
              x={today}
              stroke="#6b7280"
              strokeDasharray="4 3"
              label={{
                value: 'Vandaag',
                fill: '#9ca3af',
                fontSize: 10,
                fontFamily: 'monospace',
                position: 'top',
              }}
            />

            {/* Historisch: solide blauw */}
            <Area
              type="monotone"
              dataKey="actualRange"
              name="Gemeten spreiding"
              fill="#3b82f6"
              fillOpacity={0.18}
              stroke="none"
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="actualMean"
              name="Gemeten gemiddeld"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />

            {/* Prognose ECMWF: gestippeld blauw, lichter */}
            <Area
              type="monotone"
              dataKey="ecmwfRange"
              name="ECMWF spreiding"
              fill="#3b82f6"
              fillOpacity={0.08}
              stroke="none"
              isAnimationActive={false}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="ecmwfMean"
              name="ECMWF prognose"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />

            {/* Prognose GFS: gestippeld amber */}
            <Line
              type="monotone"
              dataKey="gfsMean"
              name="GFS prognose"
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda */}
      <div className="mt-2 flex flex-wrap items-center gap-4 px-2 text-[11px] font-mono text-[#9ca3af]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-6 bg-[#3b82f6]" />
          Gemeten
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-6"
            style={{
              height: 0,
              borderTop: '2px dashed #3b82f6',
            }}
          />
          ECMWF prognose
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-6"
            style={{
              height: 0,
              borderTop: '2px dashed #f59e0b',
            }}
          />
          GFS prognose
        </span>
      </div>
    </div>
  )
}
