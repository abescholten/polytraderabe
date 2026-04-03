-- ============================================================
-- 005_seed_strategy.sql — Initial strategy seed data
-- ============================================================

INSERT INTO public.strategies (name, category, description, is_active, config)
VALUES (
    'weather_temperature',
    'weather',
    'Uses Open-Meteo ensemble forecasts to predict weather market outcomes based on temperature thresholds',
    true,
    '{"min_edge": 0.05, "kelly_fraction": 0.15, "models": ["ecmwf_ifs025_ensemble", "gfs_seamless_eps", "icon_seamless_eps"]}'
);
