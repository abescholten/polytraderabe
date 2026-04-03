export interface Market {
  id: string
  condition_id: string
  question: string
  slug: string
  category: string
  end_date: string
  active: boolean
  closed: boolean
  best_bid: number | null
  best_ask: number | null
  last_price: number | null
  volume: number | null
  liquidity: number | null
  outcomes: string[]
  created_at: string
  updated_at: string
}

export interface MarketWithPrices extends Market {
  yes_price: number | null
  no_price: number | null
  spread: number | null
}
