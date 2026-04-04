import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { OddsSparkline } from './odds-sparkline'
import type { OddsTimepoint } from '@/types/orderbook'

// Recharts uses ResizeObserver — mock it
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div data-testid="area" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
}))

const points: OddsTimepoint[] = [
  {
    recorded_at: '2026-04-04T10:00:00Z',
    best_bid: 0.52,
    best_ask: 0.56,
    mid_price: 0.54,
    spread: 0.04,
    bid_depth: 1000,
    ask_depth: 900,
  },
  {
    recorded_at: '2026-04-04T11:00:00Z',
    best_bid: 0.55,
    best_ask: 0.58,
    mid_price: 0.565,
    spread: 0.03,
    bid_depth: 1100,
    ask_depth: 950,
  },
]

describe('OddsSparkline', () => {
  it('renders the chart', () => {
    render(<OddsSparkline points={points} />)
    expect(screen.getByTestId('chart')).toBeInTheDocument()
  })

  it('renders empty state when no points', () => {
    render(<OddsSparkline points={[]} />)
    expect(screen.getByText('No history data')).toBeInTheDocument()
  })

  it('renders loading state', () => {
    render(<OddsSparkline points={[]} loading />)
    expect(screen.getByTestId('sparkline-loading')).toBeInTheDocument()
  })
})
