-- ============================================================
-- 004_realtime.sql — Enable Supabase Realtime on key tables
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.signals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
ALTER PUBLICATION supabase_realtime ADD TABLE public.positions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pnl_snapshots;
