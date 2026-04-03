export function edgeColor(edge: number): string {
  if (edge > 0.05) return 'text-green-500'
  if (edge > 0) return 'text-green-400'
  if (edge > -0.05) return 'text-red-400'
  return 'text-red-500'
}

export function probabilityColor(prob: number): string {
  if (prob >= 0.7) return 'text-green-500'
  if (prob >= 0.3) return 'text-amber-500'
  return 'text-red-500'
}

export function probabilityBgColor(prob: number): string {
  if (prob >= 0.7) return 'bg-green-500/10 text-green-500 border-green-500/20'
  if (prob >= 0.3) return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
  return 'bg-red-500/10 text-red-500 border-red-500/20'
}

export function pnlColor(pnl: number): string {
  if (pnl > 0) return 'text-green-500'
  if (pnl < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

export function statusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'bg-green-500/10 text-green-500 border-green-500/20'
    case 'paused':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    case 'disabled':
      return 'bg-red-500/10 text-red-500 border-red-500/20'
    case 'backtesting':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
    default:
      return 'bg-muted text-muted-foreground'
  }
}
