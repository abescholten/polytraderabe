import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DepthChart } from './depth-chart'
import type { OrderbookSnapshot } from '@/types/orderbook'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="depth-chart">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div data-testid="area" />,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  CartesianGrid: () => null,
  ReferenceLine: () => null,
}))

const snapshot: OrderbookSnapshot = {
  market_id: 'mkt-1',
  token_id: 'tok-1',
  side: 'YES',
  bids: [
    { price: '0.54', size: '200.00' },
    { price: '0.53', size: '100.00' },
    { price: '0.50', size: '300.00' },
  ],
  asks: [
    { price: '0.56', size: '150.00' },
    { price: '0.57', size: '80.00' },
    { price: '0.60', size: '200.00' },
  ],
  best_bid: 0.54,
  best_ask: 0.56,
  mid_price: 0.55,
  spread: 0.02,
  bid_depth: 600,
  ask_depth: 430,
  num_bid_levels: 3,
  num_ask_levels: 3,
  recorded_at: '2026-04-04T12:00:00Z',
}

describe('DepthChart', () => {
  it('renders the chart', () => {
    render(<DepthChart snapshot={snapshot} />)
    expect(screen.getByTestId('depth-chart')).toBeInTheDocument()
  })

  it('renders empty state when no snapshot', () => {
    render(<DepthChart snapshot={null} />)
    expect(screen.getByText('No orderbook data')).toBeInTheDocument()
  })

  it('renders loading state', () => {
    render(<DepthChart snapshot={null} loading />)
    expect(screen.getByTestId('depth-chart-loading')).toBeInTheDocument()
  })
})
