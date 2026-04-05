"""Vercel cron-triggered endpoints for weather data sync.

Vercel sends: Authorization: Bearer <CRON_SECRET>
These endpoints are GET (cron requirement) and call the same logic
as the n8n webhook endpoints but without the webhook secret check.
"""
from __future__ import annotations

import os
from datetime import date, timedelta, datetime, timezone

import numpy as np
from fastapi import APIRouter, Header, HTTPException

from src.db.client import get_supabase
from src.data.weather.open_meteo import fetch_ensemble, fetch_daily_max_actuals

router = APIRouter()

CRON_SECRET = os.environ.get("CRON_SECRET", "")

EURO_CITIES: dict[str, tuple[float, float]] = {
    "amsterdam":  (52.37, 4.89),
    "berlin":     (52.52, 13.40),
    "brussels":   (50.85, 4.35),
    "london":     (51.51, -0.13),
    "paris":      (48.85, 2.35),
    "vienna":     (48.21, 16.37),
    "zurich":     (47.38, 8.54),
    "rome":       (41.90, 12.50),
    "madrid":     (40.42, -3.70),
    "lisbon":     (38.72, -9.14),
    "prague":     (50.08, 14.44),
    "warsaw":     (52.23, 21.01),
}

MODELS = ["ecmwf_ifs", "gfs_seamless", "icon_seamless"]
THRESHOLDS_C = [0, 10, 15, 20, 25, 30, 35]


def _verify_cron(authorization: str | None) -> None:
    """Accept requests from Vercel cron (Bearer CRON_SECRET) or if no secret configured."""
    if not CRON_SECRET:
        return  # dev mode — no secret configured
    expected = f"Bearer {CRON_SECRET}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("/cron/sync-forecasts")
async def cron_sync_forecasts(authorization: str | None = Header(None)) -> dict:
    """Fetch 10-day ensemble forecasts for all cities. Called by Vercel cron every 6h."""
    _verify_cron(authorization)
    db = get_supabase()
    now = datetime.now(timezone.utc)
    records_inserted = 0
    errors: list[dict] = []

    for city_name, (lat, lon) in EURO_CITIES.items():
        for model in MODELS:
            try:
                data = await fetch_ensemble(
                    lat=lat, lon=lon, model=model,
                    variables=["temperature_2m"], days=10,
                )
                times = data.get("time", [])
                ensemble = data.get("temperature_2m")
                if ensemble is None or len(times) == 0:
                    continue

                date_indices: dict[str, list[int]] = {}
                for i, t in enumerate(times):
                    d = t[:10]
                    date_indices.setdefault(d, []).append(i)

                for forecast_date_str, indices in date_indices.items():
                    day_data = ensemble[indices, :]
                    daily_max_per_member = np.nanmax(day_data, axis=0)
                    member_values = [
                        round(float(v), 2) for v in daily_max_per_member
                        if not np.isnan(v)
                    ]
                    if not member_values:
                        continue
                    prob_above = {
                        str(thresh): round(
                            sum(1 for v in member_values if v >= thresh) / len(member_values), 4
                        )
                        for thresh in THRESHOLDS_C
                    }
                    record = {
                        "city": city_name, "lat": lat, "lon": lon,
                        "model": model, "variable": "temperature_2m",
                        "forecast_date": forecast_date_str,
                        "member_values": member_values,
                        "probability_above": prob_above,
                        "fetched_at": now.isoformat(),
                    }
                    db.table("weather_forecasts").insert(record).execute()
                    records_inserted += 1
            except Exception as e:
                errors.append({"city": city_name, "model": model, "error": str(e)})

    return {
        "cities": len(EURO_CITIES),
        "models": len(MODELS),
        "records_inserted": records_inserted,
        "errors": errors,
        "fetched_at": now.isoformat(),
    }


@router.get("/cron/sync-actuals")
async def cron_sync_actuals(authorization: str | None = Header(None)) -> dict:
    """Fetch ERA5 actuals for the last 4 days (covers ERA5's ~2-day lag). Called daily."""
    _verify_cron(authorization)
    db = get_supabase()
    end_date = date.today() - timedelta(days=2)   # ERA5 lag
    start_date = end_date - timedelta(days=3)     # fetch 4 days to be safe

    results: dict[str, int] = {}
    errors: dict[str, str] = {}

    for city, (lat, lon) in EURO_CITIES.items():
        try:
            daily = await fetch_daily_max_actuals(
                lat=lat, lon=lon, start_date=start_date, end_date=end_date
            )
            rows = [
                {
                    "city": city, "lat": lat, "lon": lon,
                    "date": row["date"].isoformat(),
                    "daily_max_celsius": row["daily_max"],
                    "daily_min_celsius": row["daily_min"],
                    "daily_mean_celsius": row["daily_mean"],
                    "source": "era5",
                }
                for row in daily
            ]
            if rows:
                db.table("weather_actuals").upsert(
                    rows, on_conflict="city,date,source"
                ).execute()
            results[city] = len(rows)
        except Exception as exc:
            errors[city] = str(exc)
            results[city] = 0

    return {
        "status": "partial" if errors else "ok",
        "date_range": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "rows_upserted": results,
        "errors": errors,
    }
