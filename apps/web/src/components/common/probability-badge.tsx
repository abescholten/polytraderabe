import { cn } from '@/lib/utils'
import { probabilityBgColor } from '@/lib/utils/colors'
import { formatProbability } from '@/lib/utils/format'

interface ProbabilityBadgeProps {
  value: number
  className?: string
}

export function ProbabilityBadge({ value, className }: ProbabilityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-xs font-medium',
        probabilityBgColor(value),
        className
      )}
    >
      {formatProbability(value)}
    </span>
  )
}
