from typing import Optional

from fastapi import APIRouter, Query

from src.db.client import get_supabase

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
