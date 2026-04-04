-- ============================================================
-- 008_weather_actuals.sql — ERA5 historical daily temperatures
-- ============================================================

CREATE TABLE public.weather_actuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city TEXT NOT NULL,
    lat NUMERIC NOT NULL,
    lon NUMERIC NOT NULL,
    date DATE NOT NULL,
    daily_max_celsius NUMERIC NOT NULL,
    daily_min_celsius NUMERIC NOT NULL,
    daily_mean_celsius NUMERIC NOT NULL,
    source TEXT NOT NULL DEFAULT 'era5',
    fetched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (city, date, source)
);

CREATE INDEX IF NOT EXISTS idx_weather_actuals_city_date ON public.weather_actuals (city, date DESC);

-- RLS (match existing pattern)
ALTER TABLE public.weather_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read weather actuals"
    ON public.weather_actuals FOR SELECT
    TO authenticated USING (true);

CREATE POLICY "Anon users can read weather actuals"
    ON public.weather_actuals FOR SELECT
    TO anon USING (true);

CREATE POLICY "Service role can insert weather actuals"
    ON public.weather_actuals FOR INSERT
    TO authenticated WITH CHECK (true);
