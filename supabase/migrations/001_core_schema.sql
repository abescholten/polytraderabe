-- ============================================================
-- 001_core_schema.sql — Core tables for PolyTrader
-- ============================================================

-- Markets — synced from Polymarket Gamma API
CREATE TABLE public.markets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    condition_id    TEXT UNIQUE NOT NULL,
    question        TEXT NOT NULL,
    slug            TEXT,
    category        TEXT DEFAULT 'uncategorized',
    yes_token_id    TEXT NOT NULL,
    no_token_id     TEXT NOT NULL,
    end_date        TIMESTAMPTZ,
    active          BOOLEAN DEFAULT true,
    closed          BOOLEAN DEFAULT false,
    resolved        BOOLEAN DEFAULT false,
    outcome         INTEGER,                          -- 1=YES, 0=NO, NULL=unresolved
    resolution_source TEXT,
    volume          NUMERIC,
    volume_24h      NUMERIC,
    liquidity       NUMERIC,
    best_bid        NUMERIC,
    best_ask        NUMERIC,
    metadata        JSONB DEFAULT '{}',
    synced_at       TIMESTAMPTZ DEFAULT now(),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_markets_active_closed ON public.markets (active, closed);
CREATE INDEX idx_markets_category ON public.markets (category);
CREATE INDEX idx_markets_end_date ON public.markets (end_date);
CREATE INDEX idx_markets_condition_id ON public.markets (condition_id);

-- Price history — time series
CREATE TABLE public.price_history (
    id                  BIGSERIAL PRIMARY KEY,
    market_id           UUID NOT NULL REFERENCES public.markets(id) ON DELETE CASCADE,
    yes_price           NUMERIC NOT NULL,
    no_price            NUMERIC NOT NULL,
    best_bid            NUMERIC,
    best_ask            NUMERIC,
    spread              NUMERIC,
    volume_since_last   NUMERIC DEFAULT 0,
    recorded_at         TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_price_history_market_recorded ON public.price_history (market_id, recorded_at DESC);

-- Strategies — registered algorithms
CREATE TABLE public.strategies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT UNIQUE NOT NULL,
    category    TEXT NOT NULL,
    description TEXT,
    is_active   BOOLEAN DEFAULT true,
    config      JSONB DEFAULT '{}',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Signals — algorithm output
CREATE TABLE public.signals (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id         UUID REFERENCES public.strategies(id),
    strategy_name       TEXT NOT NULL,
    market_id           UUID REFERENCES public.markets(id),
    our_probability     NUMERIC CHECK (our_probability >= 0 AND our_probability <= 1),
    market_price        NUMERIC CHECK (market_price >= 0 AND market_price <= 1),
    edge                NUMERIC,
    confidence          TEXT CHECK (confidence IN ('high', 'medium', 'low')),
    recommended_side    TEXT CHECK (recommended_side IN ('YES', 'NO')),
    recommended_size    NUMERIC,
    reasoning           TEXT,
    model_breakdown     JSONB,
    risk_check          JSONB,
    status              TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'executed')),
    approved_at         TIMESTAMPTZ,
    approved_by         TEXT,
    rejection_reason    TEXT,
    expires_at          TIMESTAMPTZ DEFAULT now() + INTERVAL '2 hours',
    created_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_signals_status ON public.signals (status);
CREATE INDEX idx_signals_strategy_name ON public.signals (strategy_name);
CREATE INDEX idx_signals_market_id ON public.signals (market_id);

-- Trades — executed
CREATE TABLE public.trades (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       UUID REFERENCES public.signals(id),
    market_id       UUID REFERENCES public.markets(id),
    strategy_name   TEXT NOT NULL,
    side            TEXT CHECK (side IN ('YES', 'NO')),
    size            NUMERIC NOT NULL,
    entry_price     NUMERIC NOT NULL,
    fill_price      NUMERIC,
    is_paper        BOOLEAN DEFAULT true,
    order_id        TEXT,
    kelly_fraction  NUMERIC,
    edge_at_entry   NUMERIC,
    status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'filled', 'cancelled', 'resolved')),
    outcome         INTEGER,
    pnl             NUMERIC,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trades_status ON public.trades (status);
CREATE INDEX idx_trades_strategy_name ON public.trades (strategy_name);
CREATE INDEX idx_trades_is_paper ON public.trades (is_paper);

-- Positions — aggregated open
CREATE TABLE public.positions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id       UUID NOT NULL REFERENCES public.markets(id),
    strategy_name   TEXT NOT NULL,
    side            TEXT CHECK (side IN ('YES', 'NO')),
    total_size      NUMERIC DEFAULT 0,
    avg_entry_price NUMERIC NOT NULL,
    current_price   NUMERIC,
    unrealized_pnl  NUMERIC DEFAULT 0,
    is_paper        BOOLEAN DEFAULT true,
    status          TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    opened_at       TIMESTAMPTZ DEFAULT now(),
    closed_at       TIMESTAMPTZ,
    UNIQUE (market_id, strategy_name, side, is_paper)
);

-- Forecasts — for Brier score tracking
CREATE TABLE public.forecasts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id               UUID REFERENCES public.markets(id),
    strategy_name           TEXT NOT NULL,
    forecast_probability    NUMERIC CHECK (forecast_probability >= 0 AND forecast_probability <= 1),
    market_price_at_forecast NUMERIC NOT NULL,
    lead_time_hours         NUMERIC,
    model_breakdown         JSONB,
    actual_outcome          INTEGER,
    brier_score             NUMERIC,
    forecast_at             TIMESTAMPTZ DEFAULT now(),
    resolved_at             TIMESTAMPTZ
);

CREATE INDEX idx_forecasts_strategy_name ON public.forecasts (strategy_name);
CREATE INDEX idx_forecasts_unresolved ON public.forecasts (market_id) WHERE actual_outcome IS NULL;

-- PnL snapshots — daily portfolio
CREATE TABLE public.pnl_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date            DATE NOT NULL,
    strategy_name   TEXT,                             -- NULL = portfolio total
    bankroll        NUMERIC NOT NULL,
    daily_pnl       NUMERIC NOT NULL,
    cumulative_pnl  NUMERIC NOT NULL,
    total_trades    INTEGER,
    win_rate        NUMERIC,
    brier_score     NUMERIC,
    max_drawdown    NUMERIC,
    is_paper        BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE (date, strategy_name, is_paper)
);

-- Audit log — all mutations
CREATE TABLE public.audit_log (
    id          BIGSERIAL PRIMARY KEY,
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID,
    actor       TEXT DEFAULT 'system',
    details     JSONB,
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_log_entity ON public.audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log (created_at DESC);
