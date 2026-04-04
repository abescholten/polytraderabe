import type { OrderbookSnapshot } from '@/types/orderbook'

interface Props {
  snapshot: OrderbookSnapshot | null
}

function pct(value: string | number): string {
  return `${(Number(value) * 100).toFixed(1)}%`
}

function dollars(value: string | number): string {
  return `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function LevelRow({
  price,
  size,
  maxSize,
  side,
}: {
  price: string
  size: string
  maxSize: number
  side: 'bid' | 'ask'
}) {
  const barPct = maxSize > 0 ? (Number(size) / maxSize) * 100 : 0
  const barColor = side === 'bid' ? 'bg-emerald-500/20' : 'bg-red-500/20'
  const textColor = side === 'bid' ? 'text-emerald-400' : 'text-red-400'

  return (
    <div className="relative flex items-center justify-between px-3 py-1 text-xs font-mono">
      <div
        className={`absolute inset-y-0 left-0 ${barColor}`}
        style={{ width: `${barPct}%` }}
      />
      <span className={`relative ${textColor}`}>{pct(price)}</span>
      <span className="relative text-[#8b8f9a]">{dollars(size)}</span>
    </div>
  )
}

export function BidAskLadder({ snapshot }: Props) {
  if (!snapshot) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-[#8b8f9a]">
        No orderbook data
      </div>
    )
  }

  const topBids = snapshot.bids.slice(0, 10)
  const topAsks = snapshot.asks.slice(0, 10)
  const maxBidSize = Math.max(...topBids.map((l) => Number(l.size)), 1)
  const maxAskSize = Math.max(...topAsks.map((l) => Number(l.size)), 1)

  return (
    <div className="flex flex-col gap-1">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1 text-[10px] font-medium uppercase tracking-wide text-[#8b8f9a]">
        <span>Price</span>
        <span>Size</span>
      </div>

      {/* Asks (lowest ask at bottom — closest to mid) */}
      <div className="mb-0.5">
        <div className="px-3 pb-0.5 text-[10px] font-semibold text-red-400">Asks</div>
        {[...topAsks].reverse().map((level, i) => (
          <LevelRow
            key={`ask-${level.price}`}
            price={level.price}
            size={level.size}
            maxSize={maxAskSize}
            side="ask"
          />
        ))}
      </div>

      {/* Mid price */}
      {snapshot.mid_price !== null && (
        <div className="flex items-center justify-between border-y border-[#2e3240] bg-[#2e3240]/30 px-3 py-1.5 text-xs font-semibold text-[#e8eaed]">
          <span>Mid</span>
          <span>{pct(snapshot.mid_price)}</span>
        </div>
      )}

      {/* Bids (highest bid at top — closest to mid) */}
      <div className="mt-0.5">
        <div className="px-3 pb-0.5 text-[10px] font-semibold text-emerald-400">Bids</div>
        {topBids.map((level, i) => (
          <LevelRow
            key={`bid-${level.price}`}
            price={level.price}
            size={level.size}
            maxSize={maxBidSize}
            side="bid"
          />
        ))}
      </div>

      {/* Spread */}
      {snapshot.spread !== null && (
        <div className="mt-1 px-3 text-[10px] text-[#8b8f9a]">
          Spread: {pct(snapshot.spread)} &nbsp;·&nbsp;
          Bid depth: {dollars(snapshot.bid_depth)} &nbsp;·&nbsp;
          Ask depth: {dollars(snapshot.ask_depth)}
        </div>
      )}
    </div>
  )
}
