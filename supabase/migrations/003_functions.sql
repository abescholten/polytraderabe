-- ============================================================
-- 003_functions.sql — Trigger functions and utilities
-- ============================================================

-- Compute Brier score when actual_outcome is set on a forecast
CREATE OR REPLACE FUNCTION public.compute_brier_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.actual_outcome IS NOT NULL AND OLD.actual_outcome IS NULL THEN
        NEW.brier_score := (NEW.forecast_probability - NEW.actual_outcome) ^ 2;
        NEW.resolved_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Compute trade PnL when outcome is set
CREATE OR REPLACE FUNCTION public.compute_trade_pnl()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.outcome IS NOT NULL AND OLD.outcome IS NULL THEN
        -- For YES side: profit if outcome=1, loss if outcome=0
        -- For NO side: profit if outcome=0, loss if outcome=1
        IF NEW.side = 'YES' THEN
            NEW.pnl := (NEW.outcome - NEW.entry_price) * NEW.size;
        ELSE
            NEW.pnl := ((1 - NEW.outcome) - NEW.entry_price) * NEW.size;
        END IF;
        NEW.status := 'resolved';
        NEW.resolved_at := now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION public.update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Expire old pending signals past their expires_at
CREATE OR REPLACE FUNCTION public.expire_old_signals()
RETURNS void AS $$
BEGIN
    UPDATE public.signals
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trg_compute_brier
    BEFORE UPDATE ON public.forecasts
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_brier_score();

CREATE TRIGGER trg_compute_trade_pnl
    BEFORE UPDATE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.compute_trade_pnl();

CREATE TRIGGER trg_markets_updated
    BEFORE UPDATE ON public.markets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER trg_strategies_updated
    BEFORE UPDATE ON public.strategies
    FOR EACH ROW
    EXECUTE FUNCTION public.update_timestamp();
