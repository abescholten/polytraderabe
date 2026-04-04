-- supabase/migrations/008_weather_actuals.sql
CREATE TABLE public.weather_actuals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city TEXT NOT NULL,
    lat NUMERIC NOT NULL,
    lon NUMERIC NOT NULL,
    date DATE NOT NULL,
    daily_max_celsius NUMERIC,
    daily_min_celsius NUMERIC,
    daily_mean_celsius NUMERIC,
    source TEXT NOT NULL DEFAULT 'era5',
    fetched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (city, date, source)
);

CREATE INDEX idx_weather_actuals_city_date ON public.weather_actuals (city, date DESC);
