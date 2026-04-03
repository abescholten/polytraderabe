-- ============================================================
-- 006_orderbook_snapshots.sql — Orderbook depth tracking
-- ============================================================

-- Add city/region columns to markets for filtering
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.markets ADD COLUMN IF NOT EXISTS region TEXT;

CREATE INDEX IF NOT EXISTS idx_markets_city ON public.markets (city);
CREATE INDEX IF NOT EXISTS idx_markets_region ON public.markets (region);

-- Orderbook snapshots — full depth per token
CREATE TABLE public.orderbook_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    market_id       UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    token_id        TEXT NOT NULL,
    side            TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
    bids            JSONB NOT NULL DEFAULT '[]',
    asks            JSONB NOT NULL DEFAULT '[]',
    best_bid        NUMERIC,
    best_ask        NUMERIC,
    mid_price       NUMERIC,
    spread          NUMERIC,
    bid_depth       NUMERIC DEFAULT 0,
    ask_depth       NUMERIC DEFAULT 0,
    num_bid_levels  INTEGER DEFAULT 0,
    num_ask_levels  INTEGER DEFAULT 0,
    recorded_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ob_market_recorded
    ON public.orderbook_snapshots (market_id, recorded_at DESC);

CREATE INDEX idx_ob_recorded_at
    ON public.orderbook_snapshots (recorded_at);

-- RLS (match existing pattern)
ALTER TABLE public.orderbook_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read orderbook snapshots"
    ON public.orderbook_snapshots FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Anon users can read orderbook snapshots"
    ON public.orderbook_snapshots FOR SELECT
    TO anon USING (true);

CREATE POLICY "Service role can insert orderbook snapshots"
    ON public.orderbook_snapshots FOR INSERT
    TO authenticated WITH CHECK (true);
