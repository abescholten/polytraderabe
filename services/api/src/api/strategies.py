from fastapi import APIRouter

from src.db.client import get_supabase

router = APIRouter()


@router.get("/")
async def list_strategies():
    """List all registered strategies from the database."""
    db = get_supabase()

    resp = (
        db.table("strategies")
        .select("*")
        .order("name")
        .execute()
    )

    return {
        "strategies": resp.data or [],
        "count": len(resp.data or []),
    }
