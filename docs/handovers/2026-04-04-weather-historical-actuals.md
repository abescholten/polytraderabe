# Handover: Weather Historical Actuals (ERA5)

**Date:** 2026-04-04  
**Branch:** worktree-weather → main  
**Commits:** 12 (0ec1cb9 … bba1570)

---

## What Was Built

Full-stack feature to store and display ERA5 historical daily temperatures alongside the existing 10-day ensemble forecasts. Before this work, the `weather_forecasts` table only contained forward-looking forecasts starting from the day the API was switched on. The dashboard had no historical context.

---

## Why

The weather API was activated one day ago. Without historical data the dashboard showed only future forecasts with no past reference — no way to judge whether probabilities are calibrated against actual temperatures.

---

## What Changed

### Database
- **`supabase/migrations/008_weather_actuals.sql`** — new table `weather_actuals` storing ERA5 daily max/min/mean per city. Columns `NOT NULL`. UNIQUE on `(city, date, source)` for safe upserts. RLS enabled with anon + authenticated read policies. Index on `(city, date DESC)`.

### Backend (`services/api/`)
- **`src/data/weather/open_meteo.py`** — added `fetch_daily_max_actuals(lat, lon, start_date, end_date)`: calls existing `fetch_historical_actuals()`, aggregates hourly ERA5 data to daily max/min/mean, skips NaN hours.
- **`src/api/weather_actuals_api.py`** — new router with two endpoints:
  - `GET /weather/actuals/{city}?days=30` — reads `weather_actuals` from DB; returns 404 for unknown cities.
  - `POST /weather/backfill?days=90` — fetches ERA5 for all 12 cities **in parallel** (`asyncio.gather`), upserts into DB. Returns `{status, rows_upserted, errors}`.
- **`src/main.py`** — registered `weather_actuals_router` under `/weather`.

### Frontend (`apps/web/`)
- **`src/types/weather.ts`** — added `WeatherActual` and `CityActuals` interfaces.
- **`src/lib/api/trading-api.ts`** — added `getWeatherActuals(city, days?)`.
- **`src/components/weather/actuals-chart.tsx`** — new Recharts `ComposedChart`: shaded min–max area + mean line, Dutch locale dates, "Gemiddeld" + "Spreiding" tooltip, `useMemo`, `connectNulls={false}`, null-safe range.
- **`src/app/weather/[city]/page.tsx`** — fetches actuals + forecasts in parallel (`Promise.all`). Actuals 404/error is swallowed so the forecast chart remains visible. "Historische temperatuur (30 dagen)" section appears above "Ensemble Spread".

---

## Key Decisions

| Decision | Rationale |
|---|---|
| Separate `weather_actuals` table | Keep actuals apart from forecasts — different schema (no ensemble members), different retention, different query patterns |
| `NOT NULL` on temperature columns | ERA5 always returns valid values; nulls would be a data pipeline bug, not expected data |
| `asyncio.gather` for backfill | 12 sequential HTTP calls ≈ 24–36 s; Vercel default timeout is 300 s but parallel fetch is ~2–3 s total |
| `.catch(() => null)` on actuals fetch in frontend | Actuals are additive — if backfill hasn't run yet, the forecast chart must still work |
| City 404 guard | Prevent probing arbitrary city strings from silently returning empty 200s |

---

## Environment Variables Added

None — uses existing `SUPABASE_SERVICE_ROLE_KEY` for backfill writes and `NEXT_PUBLIC_SUPABASE_*` for frontend reads.

---

## External Services Configured

### Supabase
Apply the migration to production:
```bash
supabase db push
```
Or run the SQL in `supabase/migrations/008_weather_actuals.sql` directly in the Supabase dashboard → SQL editor.

### Trigger the backfill (REQUIRED after deploy)
Once the migration is applied and the service is deployed, trigger the 90-day historical backfill:
```bash
curl -X POST "https://<your-vercel-url>/api/weather/backfill?days=90"
```
Expected response: `{"status":"ok","rows_upserted":{"amsterdam":88,"berlin":88,...},"errors":{}}`

ERA5 has a ~2-day lag so today's data will be absent; that is expected.

### Optional: Weekly n8n refresh
Add a weekly Schedule trigger in n8n:
- Schedule: Monday 02:00 UTC
- HTTP Request: `POST https://<vercel-url>/api/weather/backfill?days=14`

This keeps the last 2 weeks fresh as ERA5 data becomes available.

---

## Tests

- **Backend:** 15 tests, all passing (`services/api/tests/test_weather_actuals.py` — 8 tests; pre-existing 7 tests unchanged)
- **Frontend:** TypeScript clean on all new files (1 pre-existing error in `weather-legend.tsx` unrelated to this work)

---

## Known Issues / Follow-up

| Issue | Severity | Notes |
|---|---|---|
| `weather-legend.tsx` TypeScript error (readonly tuple) | Minor | Pre-existing, unrelated to this feature |
| Backfill endpoint has no auth token | Low | Consistent with other webhook endpoints; limits attack surface by obscurity |
| Actuals chart only visible when forecasts also exist | Low | By design — guards are independent but actuals section is nested inside the forecast guard |
| `ActualsChart` has no Vitest tests | Low | Consistent with other weather components |

---

## How to Verify

1. Apply migration (`supabase db push`)
2. Deploy to Vercel (push to main triggers auto-deploy)
3. Trigger backfill: `POST /api/weather/backfill?days=90`
4. Open `/weather/amsterdam` — "Historische temperatuur (30 dagen)" chart should appear above "Ensemble Spread" showing ~88 days of ERA5 data
5. Open `/weather/atlantis` — should return 404
6. Check backfill is idempotent: run the curl command twice; row counts should stay the same
