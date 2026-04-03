import os

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def health_check():
    """Health check endpoint.

    Tests connectivity to:
    - Supabase (database)
    - Polymarket CLOB (market data)
    - Open-Meteo (weather data)

    Returns status and trading mode.
    """
    checks: dict[str, dict] = {}

    # Check Supabase
    try:
        from src.db.client import get_supabase
        db = get_supabase()
        # Simple query to test connectivity
        db.table("portfolio_config").select("id").limit(1).execute()
        checks["supabase"] = {"status": "ok"}
    except Exception as e:
        checks["supabase"] = {"status": "error", "message": str(e)}

    # Check Polymarket CLOB
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get("https://clob.polymarket.com/time")
            resp.raise_for_status()
            checks["polymarket_clob"] = {"status": "ok"}
    except Exception as e:
        checks["polymarket_clob"] = {"status": "error", "message": str(e)}

    # Check Open-Meteo
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={"latitude": 40.71, "longitude": -74.01, "hourly": "temperature_2m", "forecast_days": 1},
            )
            resp.raise_for_status()
            checks["open_meteo"] = {"status": "ok"}
    except Exception as e:
        checks["open_meteo"] = {"status": "error", "message": str(e)}

    # Determine overall status
    all_ok = all(c["status"] == "ok" for c in checks.values())

    # Trading mode
    live_enabled = os.environ.get("LIVE_TRADING_ENABLED", "false").lower() == "true"
    trading_mode = "live" if live_enabled else "paper"

    return {
        "status": "healthy" if all_ok else "degraded",
        "trading_mode": trading_mode,
        "checks": checks,
    }
