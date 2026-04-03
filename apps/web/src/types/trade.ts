export type TradeStatus = 'pending' | 'filled' | 'partially_filled' | 'cancelled' | 'failed'
export type TradeSide = 'buy' | 'sell'

export interface Trade {
  id: string
  signal_id: string | null
  market_id: string
  side: TradeSide
  outcome: string
  size: number
  price: number
  cost: number
  status: TradeStatus
  filled_price: number | null
  filled_size: number | null
  pnl: number | null
  fees: number | null
  market_question: string | null
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  market_id: string
  outcome: string
  size: number
  average_price: number
  current_price: number | null
  unrealized_pnl: number | null
  market_question: string | null
  created_at: string
  updated_at: string
}
