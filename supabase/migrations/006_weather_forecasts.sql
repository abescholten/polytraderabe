CREATE TABLE public.weather_forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    city TEXT NOT NULL,
    lat NUMERIC NOT NULL,
    lon NUMERIC NOT NULL,
    model TEXT NOT NULL,
    variable TEXT NOT NULL DEFAULT 'temperature_2m',
    forecast_date DATE NOT NULL,
    member_values JSONB NOT NULL,
    probability_above JSONB,
    raw_hourly JSONB,
    model_run_time TIMESTAMPTZ,
    fetched_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (city, model, variable, forecast_date, fetched_at)
);

CREATE INDEX idx_weather_forecasts_city_date ON public.weather_forecasts (city, forecast_date);
CREATE INDEX idx_weather_forecasts_fetched ON public.weather_forecasts (fetched_at DESC);

ALTER TABLE public.weather_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read" ON public.weather_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon read" ON public.weather_forecasts FOR SELECT TO anon USING (true);
