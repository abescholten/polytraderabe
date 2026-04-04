export interface OrderbookLevel {
  price: string // decimal string e.g. "0.54"
  size: string // decimal string e.g. "120.00"
}

export interface OrderbookSnapshot {
  market_id: string
  token_id: string
  side: 'YES' | 'NO'
  bids: OrderbookLevel[] // sorted highest price first
  asks: OrderbookLevel[] // sorted lowest price first
  best_bid: number | null
  best_ask: number | null
  mid_price: number | null
  spread: number | null
  bid_depth: number // total $ size on bid side
  ask_depth: number
  recorded_at: string // ISO timestamp
}

export interface OddsTimepoint {
  recorded_at: string
  best_bid: number | null
  best_ask: number | null
  mid_price: number | null
  spread: number | null
  bid_depth: number
  ask_depth: number
}

export interface OrderbookHistoryResponse {
  market_id: string
  side: 'YES' | 'NO'
  points: OddsTimepoint[]
}
