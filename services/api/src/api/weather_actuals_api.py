from __future__ import annotations

import asyncio
from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query

from src.data.weather.open_meteo import fetch_daily_max_actuals
from src.db.client import get_supabase

router = APIRouter()

# 12 European capitals tracked by the weather pipeline
CITIES: dict[str, tuple[float, float]] = {
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


@router.get("/actuals/{city}")
async def get_weather_actuals(
    city: str,
    days: int = Query(default=30, ge=1, le=365),
):
    """Return stored ERA5 daily actuals for a city (oldest first)."""
    city_lower = city.lower()
    if city_lower not in CITIES:
        raise HTTPException(status_code=404, detail=f"Unknown city: {city!r}")
    db = get_supabase()
    since = (date.today() - timedelta(days=days)).isoformat()
    resp = (
        db.table("weather_actuals")
        .select("date, daily_max_celsius, daily_min_celsius, daily_mean_celsius")
        .eq("city", city_lower)
        .gte("date", since)
        .order("date", desc=False)
        .limit(days)
        .execute()
    )
    rows = resp.data or []
    actuals = [
        {
            "date": r["date"],
            "daily_max": r["daily_max_celsius"],
            "daily_min": r["daily_min_celsius"],
            "daily_mean": r["daily_mean_celsius"],
        }
        for r in rows
    ]
    return {"city": city_lower, "actuals": actuals}


@router.post("/backfill")
async def backfill_weather_actuals(days: int = Query(default=90, ge=1, le=730)):
    """Fetch ERA5 actuals for all 12 cities and upsert into weather_actuals.

    Safe to call multiple times — uses UPSERT on (city, date, source).
    Fetches all cities in parallel to stay within Vercel function timeout.
    """
    db = get_supabase()
    end_date = date.today() - timedelta(days=2)   # ERA5 has ~2-day lag
    start_date = end_date - timedelta(days=days - 1)

    async def _fetch_city(city: str, lat: float, lon: float) -> tuple[str, list[dict], str | None]:
        try:
            daily = await fetch_daily_max_actuals(
                lat=lat, lon=lon, start_date=start_date, end_date=end_date
            )
            return city, daily, None
        except Exception as exc:
            return city, [], str(exc)

    city_tasks = [
        _fetch_city(city, lat, lon)
        for city, (lat, lon) in CITIES.items()
    ]
    city_results = await asyncio.gather(*city_tasks)

    results: dict[str, int] = {}
    errors: dict[str, str] = {}
    for city, daily, error in city_results:
        if error is not None:
            errors[city] = error
            results[city] = 0
            continue
        lat, lon = CITIES[city]
        rows = [
            {
                "city": city,
                "lat": lat,
                "lon": lon,
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

    return {
        "status": "partial" if errors else "ok",
        "rows_upserted": results,
        "errors": errors,
    }
