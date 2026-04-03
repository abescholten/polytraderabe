import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarketLinkProps {
  slug: string
  label?: string
  className?: string
}

export function MarketLink({ slug, label, className }: MarketLinkProps) {
  return (
    <a
      href={`https://polymarket.com/event/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 transition-colors text-sm',
        className
      )}
    >
      {label || 'View on Polymarket'}
      <ExternalLink className="size-3" />
    </a>
  )
}
