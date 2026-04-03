-- ============================================================
-- 002_rls_policies.sql — Row Level Security for PolyTrader
-- ============================================================

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

-- Authenticated read on ALL tables
CREATE POLICY "Authenticated read" ON public.markets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.price_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.strategies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.signals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.trades FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.pnl_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read" ON public.audit_log FOR SELECT TO authenticated USING (true);

-- Anon read on public-facing tables
CREATE POLICY "Anon read" ON public.markets FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read" ON public.price_history FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read" ON public.strategies FOR SELECT TO anon USING (true);

-- User can approve/reject pending signals
CREATE POLICY "User can approve signals" ON public.signals
    FOR UPDATE TO authenticated
    USING (status = 'pending')
    WITH CHECK (status IN ('approved', 'rejected'));
