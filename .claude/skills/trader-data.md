---
name: trader-data
description: >
  Supabase database schema designer and data pipeline specialist for the trading platform.
  Covers table design, RLS policies, migrations, real-time subscriptions, data sync pipelines,
  caching strategies, and forecast tracking for calibration analysis. Trigger on: "database",
  "schema", "table", "migration", "RLS", "Supabase", "data model", "positions table",
  "trades table", "signals table", "forecasts", "pipeline", "sync", "cache", or any task
  involving data storage, retrieval, or the database layer. When in doubt, trigger it.
---

# Trader Data

You are a Supabase database specialist for the prediction market trading platform. The database
stores all markets, signals, trades, positions, forecasts, and performance metrics — and powers
the real-time dashboard via Supabase Realtime.

## Core Principles

1. **RLS on everything** — even tables only accessed by the backend service role
2. **Migrations, not GUI** — all schema changes as SQL in `supabase/migrations/`
3. **Audit trail** — every trade-related mutation is logged with timestamp and actor
4. **Forecast tracking** — every prediction stored for Brier score computation
5. **Denormalize for dashboards** — pre-compute aggregates for fast dashboard queries

## Schema Overview

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   markets    │────▶│   signals    │────▶│   trades    │
│ (from Gamma) │     │ (algo output)│     │ (executed)  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ price_history│     │  forecasts   │     │  positions  │
│ (time series)│     │ (for Brier)  │     │ (open/closed│
└─────────────┘     └──────────────┘     └─────────────┘
                                               │
                                               ▼
                                         ┌─────────────┐
                                         │ pnl_snapshots│
                                         │ (daily P&L)  │
                                         └─────────────┘
```

## Migration: Core Tables

```sql
-- supabase/migrations/001_core_schema.sql

-- ============================================
-- MARKETS — synced from Polymarket Gamma API
-- ============================================
CREATE TABLE public.markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condition_id TEXT UNIQUE NOT NULL,          -- Polymarket condition ID
    question TEXT NOT NULL,                      -- Human-readable question
    slug TEXT,                                   -- URL slug
    category TEXT DEFAULT 'uncategorized',       -- weather, politics, sports, etc.
    yes_token_id TEXT NOT NULL,                  -- Token ID for YES outcome
    no_token_id TEXT NOT NULL,                   -- Token ID for NO outcome
    end_date TIMESTAMPTZ,                        -- Resolution date
    active BOOLEAN DEFAULT true,
    closed BOOLEAN DEFAULT false,
    resolved BOOLEAN DEFAULT false,
    outcome INTEGER,                             -- 1=YES, 0=NO, NULL=unresolved
    resolution_source TEXT,                      -- How it was resolved
    volume NUMERIC,                              -- Total USDC volume
    volume_24h NUMERIC,                          -- 24h volume
    liquidity NUMERIC,                           -- Current liquidity
    best_bid NUMERIC,                            -- Current best bid (YES)
    best_ask NUMERIC,                            -- Current best ask (YES)
    metadata JSONB DEFAULT '{}',                 -- Extra Gamma API fields
    synced_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_markets_active ON public.markets(active, closed);
CREATE INDEX idx_markets_category ON public.markets(category);
CREATE INDEX idx_markets_end_date ON public.markets(end_date);
CREATE INDEX idx_markets_condition_id ON public.markets(condition_id);

-- ============================================
-- PRICE_HISTORY — time series of market prices
-- ============================================
CREATE TABLE public.price_history (
    id BIGSERIAL PRIMARY KEY,
    market_id UUID REFERENCES public.markets(id) ON DELETE CASCADE,
    yes_price NUMERIC NOT NULL,
    no_price NUMERIC NOT NULL,
    best_bid NUMERIC,
    best_ask NUMERIC,
    spread NUMERIC,
    volume_since_last NUMERIC DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_history_market_time ON public.price_history(market_id, recorded_at DESC);

-- ============================================
-- STRATEGIES — registered trading algorithms
-- ============================================
CREATE TABLE public.strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,                   -- e.g. 'weather_temperature'
    category TEXT NOT NULL,                       -- 'weather', 'politics', etc.
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    config JSONB DEFAULT '{}',                   -- Strategy-specific parameters
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SIGNALS — algorithm output awaiting approval
-- ============================================
CREATE TABLE public.signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES public.strategies(id),
    strategy_name TEXT NOT NULL,
    market_id UUID REFERENCES public.markets(id),
    our_probability NUMERIC NOT NULL CHECK (our_probability BETWEEN 0 AND 1),
    market_price NUMERIC NOT NULL CHECK (market_price BETWEEN 0 AND 1),
    edge NUMERIC NOT NULL,
    confidence TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    recommended_side TEXT CHECK (recommended_side IN ('YES', 'NO')),
    recommended_size NUMERIC,
    reasoning TEXT,
    model_breakdown JSONB,                       -- Per-model probabilities
    risk_check JSONB,                            -- Risk manager output
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed')),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '2 hours',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signals_status ON public.signals(status);
CREATE INDEX idx_signals_strategy ON public.signals(strategy_name);
CREATE INDEX idx_signals_market ON public.signals(market_id);

-- ============================================
-- TRADES — executed trades (paper or live)
-- ============================================
CREATE TABLE public.trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id UUID REFERENCES public.signals(id),
    market_id UUID REFERENCES public.markets(id),
    strategy_name TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
    size NUMERIC NOT NULL,                       -- USDC amount
    entry_price NUMERIC NOT NULL,                -- Price at execution
    fill_price NUMERIC,                          -- Actual fill price (live only)
    is_paper BOOLEAN DEFAULT true,
    order_id TEXT,                                -- Polymarket order ID (live only)
    kelly_fraction NUMERIC,
    edge_at_entry NUMERIC,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'resolved')),
    outcome INTEGER,                             -- 1=YES won, 0=NO won
    pnl NUMERIC,                                 -- Computed after resolution
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trades_status ON public.trades(status);
CREATE INDEX idx_trades_strategy ON public.trades(strategy_name);
CREATE INDEX idx_trades_paper ON public.trades(is_paper);

-- ============================================
-- POSITIONS — aggregated open positions
-- ============================================
CREATE TABLE public.positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES public.markets(id),
    strategy_name TEXT NOT NULL,
    side TEXT NOT NULL CHECK (side IN ('YES', 'NO')),
    total_size NUMERIC NOT NULL DEFAULT 0,
    avg_entry_price NUMERIC NOT NULL,
    current_price NUMERIC,
    unrealized_pnl NUMERIC DEFAULT 0,
    is_paper BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    UNIQUE (market_id, strategy_name, side, is_paper)
);

-- ============================================
-- FORECASTS — for Brier score computation
-- ============================================
CREATE TABLE public.forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES public.markets(id),
    strategy_name TEXT NOT NULL,
    forecast_probability NUMERIC NOT NULL CHECK (forecast_probability BETWEEN 0 AND 1),
    market_price_at_forecast NUMERIC NOT NULL,
    lead_time_hours NUMERIC,                     -- Hours before resolution
    model_breakdown JSONB,                       -- Per-model detail
    actual_outcome INTEGER,                      -- 1 or 0, NULL if unresolved
    brier_score NUMERIC,                         -- Computed: (forecast - outcome)²
    forecast_at TIMESTAMPTZ DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_forecasts_strategy ON public.forecasts(strategy_name);
CREATE INDEX idx_forecasts_unresolved ON public.forecasts(actual_outcome) WHERE actual_outcome IS NULL;

-- ============================================
-- PNL_SNAPSHOTS — daily portfolio snapshots
-- ============================================
CREATE TABLE public.pnl_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    strategy_name TEXT,                           -- NULL = portfolio total
    bankroll NUMERIC NOT NULL,
    daily_pnl NUMERIC NOT NULL,
    cumulative_pnl NUMERIC NOT NULL,
    total_trades INTEGER NOT NULL,
    win_rate NUMERIC,
    brier_score NUMERIC,
    max_drawdown NUMERIC,
    is_paper BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (date, strategy_name, is_paper)
);

-- ============================================
-- AUDIT_LOG — all mutations for compliance
-- ============================================
CREATE TABLE public.audit_log (
    id BIGSERIAL PRIMARY KEY,
    action TEXT NOT NULL,                         -- 'signal_created', 'trade_approved', etc.
    entity_type TEXT NOT NULL,                    -- 'signal', 'trade', 'position'
    entity_id UUID,
    actor TEXT DEFAULT 'system',                  -- 'system', 'cron', 'user'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_time ON public.audit_log(created_at DESC);
```

## Migration: RLS Policies

```sql
-- supabase/migrations/002_rls_policies.sql

-- Enable RLS on all tables
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pnl_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Single-user app: authenticated user can read everything
-- Service role (backend) handles all writes

-- Read policies for authenticated users
CREATE POLICY "Authenticated read" ON public.markets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.strategies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.trades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.pnl_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- Write policies: signals approval from authenticated user
CREATE POLICY "User can approve signals" ON public.signals
    FOR UPDATE TO authenticated
    USING (status = 'pending')
    WITH CHECK (status IN ('approved', 'rejected'));
```

## Migration: Functions & Triggers

```sql
-- supabase/migrations/003_functions.sql

-- Auto-compute Brier score when forecast is resolved
CREATE OR REPLACE FUNCTION compute_brier_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_outcome IS NOT NULL AND OLD.actual_outcome IS NULL THEN
        NEW.brier_score := (NEW.forecast_probability - NEW.actual_outcome) ^ 2;
        NEW.resolved_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_brier
    BEFORE UPDATE ON public.forecasts
    FOR EACH ROW EXECUTE FUNCTION compute_brier_score();

-- Auto-compute trade P&L when resolved
CREATE OR REPLACE FUNCTION compute_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.outcome IS NOT NULL AND OLD.outcome IS NULL THEN
        IF NEW.side = 'YES' THEN
            IF NEW.outcome = 1 THEN
                NEW.pnl := NEW.size * (1 - NEW.entry_price) / NEW.entry_price;
            ELSE
                NEW.pnl := -NEW.size;
            END IF;
        ELSE -- NO
            IF NEW.outcome = 0 THEN
                NEW.pnl := NEW.size * NEW.entry_price / (1 - NEW.entry_price);
            ELSE
                NEW.pnl := -NEW.size;
            END IF;
        END IF;
        NEW.status := 'resolved';
        NEW.resolved_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compute_trade_pnl
    BEFORE UPDATE ON public.trades
    FOR EACH ROW EXECUTE FUNCTION compute_trade_pnl();

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_markets_updated
    BEFORE UPDATE ON public.markets
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trg_strategies_updated
    BEFORE UPDATE ON public.strategies
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Expire stale pending signals
CREATE OR REPLACE FUNCTION expire_old_signals()
RETURNS void AS $$
BEGIN
    UPDATE public.signals
    SET status = 'expired'
    WHERE status = 'pending' AND expires_at < now();
END;
$$ LANGUAGE plpgsql;
```

## Realtime Configuration

Enable Realtime on tables that the dashboard needs to update live:

```sql
-- supabase/migrations/004_realtime.sql

-- Enable realtime for dashboard-critical tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pnl_snapshots;
```

## Useful Queries

### Strategy Performance Dashboard

```sql
-- Per-strategy performance summary
SELECT
    t.strategy_name,
    COUNT(*) as total_trades,
    COUNT(*) FILTER (WHERE t.pnl > 0) as wins,
    COUNT(*) FILTER (WHERE t.pnl <= 0) as losses,
    ROUND(COUNT(*) FILTER (WHERE t.pnl > 0)::numeric / NULLIF(COUNT(*), 0), 3) as win_rate,
    ROUND(SUM(t.pnl)::numeric, 2) as total_pnl,
    ROUND(AVG(t.edge_at_entry)::numeric, 4) as avg_edge,
    ROUND(AVG(f.brier_score)::numeric, 4) as avg_brier
FROM public.trades t
LEFT JOIN public.forecasts f ON f.market_id = t.market_id AND f.strategy_name = t.strategy_name
WHERE t.status = 'resolved'
GROUP BY t.strategy_name;
```

### Calibration Data

```sql
-- Calibration curve data (10 bins)
SELECT
    FLOOR(forecast_probability * 10) / 10 as bin_start,
    ROUND(AVG(forecast_probability)::numeric, 3) as avg_forecast,
    ROUND(AVG(actual_outcome)::numeric, 3) as observed_frequency,
    COUNT(*) as sample_size
FROM public.forecasts
WHERE actual_outcome IS NOT NULL
GROUP BY FLOOR(forecast_probability * 10)
ORDER BY bin_start;
```

### Portfolio Exposure

```sql
-- Current portfolio exposure
SELECT
    COALESCE(SUM(total_size), 0) as total_exposure,
    COUNT(*) as open_positions,
    COALESCE(SUM(unrealized_pnl), 0) as total_unrealized_pnl
FROM public.positions
WHERE status = 'open';
```

## Safety Rules

1. **RLS is always enabled** — no exceptions, even for single-user mode
2. **Migrations are sequential** — never modify existing migrations, always add new ones
3. **Service role key is backend-only** — frontend uses anon key with RLS
4. **Audit log captures everything** — trade creation, approval, rejection, resolution
5. **Cascade deletes are intentional** — only on price_history (tied to market lifecycle)
6. **Brier score computed automatically** — via trigger, never manually set
