-- ============================================================
-- 008_seed_strategies_v2.sql — Add Bayesian and Momentum strategies
-- ============================================================

INSERT INTO public.strategies (name, category, description, is_active, config)
VALUES
    (
        'weather_bayesian',
        'weather',
        'Bayesian updating strategy — assigns higher weight to the most recently updated weather model runs (GFS/ICON update 4x/day, ECMWF 2x/day). Trades when the recency-weighted probability diverges from the market price by more than 8%.',
        true,
        '{"min_edge": 0.08, "kelly_fraction": 0.25, "model_weights": {"ecmwf_ifs": 2.0, "gfs_seamless": 4.0, "icon_seamless": 4.0}}'
    ),
    (
        'weather_momentum',
        'weather',
        'Momentum strategy — detects sustained directional price movement in weather market YES prices using orderbook snapshot history. Buys YES when price has risen consistently over 6 recent snapshots, NO when falling consistently.',
        true,
        '{"min_move": 0.05, "snapshot_limit": 6, "min_monotone_ratio": 0.8, "kelly_fraction": 0.25}'
    )
ON CONFLICT (name) DO NOTHING;
