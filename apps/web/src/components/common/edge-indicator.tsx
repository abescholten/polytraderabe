import { cn } from '@/lib/utils'
import { edgeColor } from '@/lib/utils/colors'

interface EdgeIndicatorProps {
  value: number
  className?: string
}

export function EdgeIndicator({ value, className }: EdgeIndicatorProps) {
  const sign = value > 0 ? '+' : ''
  return (
    <span
      className={cn(
        'font-mono text-sm font-medium',
        edgeColor(value),
        className
      )}
    >
      {sign}{(value * 100).toFixed(1)}%
    </span>
  )
}
