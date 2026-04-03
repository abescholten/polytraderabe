from fastapi import APIRouter

from src.db.client import get_supabase

router = APIRouter()


@router.get("/forecasts")
async def get_weather_forecasts():
    """Get the latest weather forecasts for all cities.

    Returns the most recent fetch per city with aggregated data across models.
    """
    db = get_supabase()

    # Get the most recent fetched_at timestamp
    latest = (
        db.table("weather_forecasts")
        .select("fetched_at")
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    if not latest.data:
        return {"cities": [], "fetched_at": None}

    latest_fetch = latest.data[0]["fetched_at"]

    # Get all records from the latest fetch
    resp = (
        db.table("weather_forecasts")
        .select("*")
        .eq("fetched_at", latest_fetch)
        .order("city")
        .order("forecast_date")
        .execute()
    )
    records = resp.data or []

    # Group by city
    cities: dict[str, dict] = {}
    for r in records:
        city = r["city"]
        if city not in cities:
            cities[city] = {
                "city": city,
                "lat": r["lat"],
                "lon": r["lon"],
                "forecasts": [],
                "fetched_at": r["fetched_at"],
            }
        cities[city]["forecasts"].append({
            "model": r["model"],
            "forecast_date": r["forecast_date"],
            "member_values": r["member_values"],
            "probability_above": r["probability_above"],
        })

    return {
        "cities": list(cities.values()),
        "fetched_at": latest_fetch,
    }


@router.get("/forecasts/{city}")
async def get_weather_by_city(city: str):
    """Get detailed weather forecasts for a specific city.

    Returns all models and forecast dates from the latest fetch.
    """
    db = get_supabase()

    # Get the most recent fetch for this city
    latest = (
        db.table("weather_forecasts")
        .select("fetched_at")
        .eq("city", city.lower())
        .order("fetched_at", desc=True)
        .limit(1)
        .execute()
    )
    if not latest.data:
        return {"city": city, "forecasts": [], "fetched_at": None}

    latest_fetch = latest.data[0]["fetched_at"]

    resp = (
        db.table("weather_forecasts")
        .select("*")
        .eq("city", city.lower())
        .eq("fetched_at", latest_fetch)
        .order("forecast_date")
        .order("model")
        .execute()
    )
    records = resp.data or []

    # Group by forecast_date, then by model
    by_date: dict[str, dict] = {}
    for r in records:
        d = r["forecast_date"]
        if d not in by_date:
            by_date[d] = {"forecast_date": d, "models": {}}
        members = r["member_values"]
        by_date[d]["models"][r["model"]] = {
            "member_values": members,
            "probability_above": r["probability_above"],
            "mean": round(sum(members) / len(members), 1) if members else None,
            "min": round(min(members), 1) if members else None,
            "max": round(max(members), 1) if members else None,
            "member_count": len(members),
        }

    return {
        "city": city.lower(),
        "lat": records[0]["lat"] if records else None,
        "lon": records[0]["lon"] if records else None,
        "fetched_at": latest_fetch,
        "forecasts": list(by_date.values()),
    }
