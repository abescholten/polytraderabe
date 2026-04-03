from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from src.db.client import get_supabase
from src.models.signal import SignalStatus
from src.trading.execution.engine import ExecutionEngine

router = APIRouter()


@router.get("/")
async def list_signals(
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """List trading signals with optional status filter."""
    db = get_supabase()
    query = db.table("signals").select("*").order("created_at", desc=True)

    if status:
        # Validate status
        try:
            SignalStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status: {status}. Must be one of: {[s.value for s in SignalStatus]}",
            )
        query = query.eq("status", status)

    query = query.range(offset, offset + limit - 1)
    resp = query.execute()

    return {
        "signals": resp.data or [],
        "count": len(resp.data or []),
        "offset": offset,
        "limit": limit,
    }


@router.get("/{signal_id}")
async def get_signal(signal_id: str):
    """Get a single signal by ID."""
    db = get_supabase()
    resp = db.table("signals").select("*").eq("id", signal_id).execute()

    if not resp.data:
        raise HTTPException(status_code=404, detail="Signal not found")

    return resp.data[0]


@router.post("/{signal_id}/approve")
async def approve_signal(signal_id: str):
    """Approve a signal and execute the trade.

    Transitions signal from pending -> approved, then executes via
    the ExecutionEngine (paper mode by default).
    """
    db = get_supabase()

    # Fetch the signal
    resp = db.table("signals").select("*").eq("id", signal_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Signal not found")

    signal = resp.data[0]

    if signal.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Signal is '{signal.get('status')}', can only approve 'pending' signals.",
        )

    now = datetime.now(timezone.utc).isoformat()

    # Update signal status to approved
    db.table("signals").update({
        "status": "approved",
        "approved_at": now,
        "approved_by": "dashboard_user",
    }).eq("id", signal_id).execute()

    # Execute the trade
    engine = ExecutionEngine(db)
    result = engine_result = await engine.execute_signal(signal)

    # If executed, link the trade and mark signal as executed
    if engine_result.get("executed"):
        trade = engine_result.get("trade", {})
        trade_id = trade.get("id")
        db.table("signals").update({
            "status": "executed",
            "trade_id": trade_id,
        }).eq("id", signal_id).execute()
    else:
        # Trade was rejected by risk manager — signal stays approved but not executed
        pass

    return {
        "signal_id": signal_id,
        "status": "executed" if engine_result.get("executed") else "approved",
        "execution": engine_result,
    }


@router.post("/{signal_id}/reject")
async def reject_signal(signal_id: str, reason: str = Query(..., min_length=1)):
    """Reject a signal with a reason."""
    db = get_supabase()

    # Fetch the signal
    resp = db.table("signals").select("*").eq("id", signal_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Signal not found")

    signal = resp.data[0]

    if signal.get("status") != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Signal is '{signal.get('status')}', can only reject 'pending' signals.",
        )

    db.table("signals").update({
        "status": "rejected",
        "rejection_reason": reason,
    }).eq("id", signal_id).execute()

    return {
        "signal_id": signal_id,
        "status": "rejected",
        "rejection_reason": reason,
    }
