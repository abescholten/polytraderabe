import type { Signal } from '@/types/signal'
import type { Trade, Position } from '@/types/trade'
import type { Strategy, StrategyPerformance } from '@/types/strategy'
import type { Market } from '@/types/market'
import type { CityWeather, CityDetail } from '@/types/weather'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}

export const tradingApi = {
  // Health
  health: () => fetchApi<{ status: string; version: string }>('/health'),

  // Signals
  getSignals: (status?: string) => {
    const params = status ? `?status=${status}` : ''
    return fetchApi<Signal[]>(`/api/signals${params}`)
  },
  approveSignal: (id: string) =>
    fetchApi<Signal>(`/api/signals/${id}/approve`, { method: 'POST' }),
  rejectSignal: (id: string) =>
    fetchApi<Signal>(`/api/signals/${id}/reject`, { method: 'POST' }),

  // Strategies
  getStrategies: () => fetchApi<Strategy[]>('/api/strategies'),
  getStrategy: (id: string) => fetchApi<Strategy>(`/api/strategies/${id}`),
  getStrategyPerformance: () =>
    fetchApi<StrategyPerformance[]>('/api/strategies/performance'),

  // Portfolio
  getPositions: () => fetchApi<Position[]>('/api/portfolio/positions'),
  getPortfolioSummary: () =>
    fetchApi<{
      total_value: number
      daily_pnl: number
      total_pnl: number
      total_exposure: number
      open_positions: number
    }>('/api/portfolio/summary'),

  // Trades
  getTrades: (limit?: number) => {
    const params = limit ? `?limit=${limit}` : ''
    return fetchApi<Trade[]>(`/api/trades${params}`)
  },

  // Markets
  getMarkets: (category?: string) => {
    const params = category ? `?category=${category}` : ''
    return fetchApi<Market[]>(`/api/markets${params}`)
  },
  getMarket: (id: string) => fetchApi<Market>(`/api/markets/${id}`),

  // Weather
  getWeatherForecasts: () =>
    fetchApi<{ cities: CityWeather[]; fetched_at: string | null }>('/weather/forecasts'),
  getWeatherByCity: (city: string) =>
    fetchApi<CityDetail>(`/weather/forecasts/${city}`),
}
