export function ModeBadge() {
  const mode = process.env.NEXT_PUBLIC_TRADING_MODE || 'paper'
  const isLive = mode === 'live'

  return (
    <div
      className={
        isLive
          ? 'flex h-8 items-center justify-center bg-red-500/10 border-b border-red-500/20'
          : 'flex h-8 items-center justify-center bg-amber-500/10 border-b border-amber-500/20'
      }
    >
      <div className="flex items-center gap-2">
        <div
          className={
            isLive
              ? 'size-2 rounded-full bg-red-500 animate-pulse'
              : 'size-2 rounded-full bg-amber-500'
          }
        />
        <span
          className={
            isLive
              ? 'text-xs font-semibold uppercase tracking-wider text-red-500'
              : 'text-xs font-semibold uppercase tracking-wider text-amber-500'
          }
        >
          {isLive ? 'LIVE TRADING' : 'PAPER TRADING'}
        </span>
      </div>
    </div>
  )
}
