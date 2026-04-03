export type StrategyStatus = 'active' | 'paused' | 'disabled' | 'backtesting'

export interface Strategy {
  id: string
  name: string
  slug: string
  description: string
  category: string
  status: StrategyStatus
  config: Record<string, unknown>
  brier_score: number | null
  roi: number | null
  total_trades: number
  win_rate: number | null
  avg_edge: number | null
  created_at: string
  updated_at: string
}

export interface StrategyPerformance {
  strategy_id: string
  strategy_name: string
  brier_score: number | null
  roi: number | null
  total_trades: number
  win_rate: number | null
  avg_edge: number | null
  total_pnl: number | null
}
