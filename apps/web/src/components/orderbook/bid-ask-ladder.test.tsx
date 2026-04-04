import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BidAskLadder } from './bid-ask-ladder'
import type { OrderbookSnapshot } from '@/types/orderbook'

const snapshot: OrderbookSnapshot = {
  market_id: 'mkt-1',
  token_id: 'tok-1',
  side: 'YES',
  bids: [
    { price: '0.54', size: '200.00' },
    { price: '0.53', size: '100.00' },
  ],
  asks: [
    { price: '0.56', size: '150.00' },
    { price: '0.57', size: '80.00' },
  ],
  best_bid: 0.54,
  best_ask: 0.56,
  mid_price: 0.55,
  spread: 0.02,
  bid_depth: 300,
  ask_depth: 230,
  num_bid_levels: 2,
  num_ask_levels: 2,
  recorded_at: '2026-04-04T12:00:00Z',
}

describe('BidAskLadder', () => {
  it('renders bid and ask sections', () => {
    render(<BidAskLadder snapshot={snapshot} />)
    expect(screen.getByText('Bids')).toBeInTheDocument()
    expect(screen.getByText('Asks')).toBeInTheDocument()
  })

  it('shows bid prices as percentages', () => {
    render(<BidAskLadder snapshot={snapshot} />)
    expect(screen.getByText('54.0%')).toBeInTheDocument()
    expect(screen.getByText('53.0%')).toBeInTheDocument()
  })

  it('shows ask prices as percentages', () => {
    render(<BidAskLadder snapshot={snapshot} />)
    expect(screen.getByText('56.0%')).toBeInTheDocument()
    expect(screen.getByText('57.0%')).toBeInTheDocument()
  })

  it('shows mid price', () => {
    render(<BidAskLadder snapshot={snapshot} />)
    expect(screen.getByText('55.0%')).toBeInTheDocument()
  })

  it('renders empty state when no snapshot', () => {
    render(<BidAskLadder snapshot={null} />)
    expect(screen.getByText('No orderbook data')).toBeInTheDocument()
  })
})
