export type SignalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'executed'
export type SignalDirection = 'buy_yes' | 'buy_no' | 'sell_yes' | 'sell_no'

export interface Signal {
  id: string
  market_id: string
  strategy_id: string
  direction: SignalDirection
  our_probability: number
  market_price: number
  edge: number
  confidence: number
  kelly_fraction: number
  recommended_size: number
  status: SignalStatus
  reason: string | null
  market_question: string | null
  strategy_name: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
}
