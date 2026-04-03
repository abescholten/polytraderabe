from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Query

from src.db.client import get_supabase


def _minutes_diff(ts1: str, ts2: str) -> float:
    """Compute minutes between two ISO timestamps."""
    t1 = datetime.fromisoformat(ts1.replace("Z", "+00:00"))
    t2 = datetime.fromisoformat(ts2.replace("Z", "+00:00"))
    return abs((t2 - t1).total_seconds()) / 60

router = APIRouter()


@router.get("/")
async def list_markets(
    category: Optional[str] = Query(None, description="Filter by category"),
    active_only: bool = Query(True, description="Only show active markets"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List tracked markets from the database."""
    db = get_supabase()

    query = db.table("markets").select("*").order("end_date", desc=False)

    if category:
        query = query.eq("category", category)

    if active_only:
        query = query.eq("active", True).eq("closed", False)

    query = query.range(offset, offset + limit - 1)
    resp = query.execute()

    return {
        "markets": resp.data or [],
        "count": len(resp.data or []),
        "offset": offset,
        "limit": limit,
    }


@router.get("/weather")
async def list_weather_markets(
    region: Optional[str] = Query(None, description="Filter by region (europe, north_america)"),
    city: Optional[str] = Query(None, description="Filter by city name"),
):
    """List active weather markets, optionally filtered by region or city."""
    db = get_supabase()
    query = (
        db.table("markets")
        .select("*")
        .eq("active", True)
        .eq("category", "weather")
    )
    if region:
        query = query.eq("region", region)
    if city:
        query = query.ilike("city", city)
    resp = query.order("volume_24h", desc=True).execute()
    return {"markets": resp.data or []}


@router.get("/{market_id}/orderbook")
async def get_latest_orderbook(market_id: str):
    """Get the latest orderbook snapshot for a market (both YES and NO)."""
    db = get_supabase()
    resp = (
        db.table("orderbook_snapshots")
        .select("*")
        .eq("market_id", market_id)
        .order("recorded_at", desc=True)
        .limit(2)
        .execute()
    )
    return {"snapshots": resp.data or []}


@router.get("/{market_id}/orderbook/history")
async def get_orderbook_history(
    market_id: str,
    side: str = Query("YES", description="Token side: YES or NO"),
    hours: int = Query(24, ge=1, le=168, description="Hours of history"),
    interval_minutes: int = Query(1, ge=1, le=60, description="Downsample interval"),
):
    """Get orderbook summary time-series for a market.

    Returns mid_price, spread, and depth over time.
    Use interval_minutes > 1 to downsample (e.g., 5 for 5-min intervals).
    """
    db = get_supabase()
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    resp = (
        db.table("orderbook_snapshots")
        .select("recorded_at, best_bid, best_ask, mid_price, spread, bid_depth, ask_depth")
        .eq("market_id", market_id)
        .eq("side", side)
        .gte("recorded_at", since)
        .order("recorded_at", desc=False)
        .execute()
    )
    rows = resp.data or []

    if interval_minutes > 1 and rows:
        sampled = []
        last_ts = None
        for row in rows:
            ts = row["recorded_at"]
            if last_ts is None or _minutes_diff(last_ts, ts) >= interval_minutes:
                sampled.append(row)
                last_ts = ts
        rows = sampled

    return {"market_id": market_id, "side": side, "points": rows}
