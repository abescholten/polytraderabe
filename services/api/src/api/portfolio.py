from fastapi import APIRouter

from src.db.client import get_supabase
from src.trading.execution.paper import PaperTrader

router = APIRouter()


@router.get("/positions")
async def get_positions():
    """Get all active (open) positions."""
    db = get_supabase()
    paper = PaperTrader()
    positions = await paper.get_open_positions(db)

    return {
        "positions": positions,
        "count": len(positions),
    }


@router.get("/performance")
async def get_performance():
    """Get portfolio performance metrics.

    Returns total PnL, win rate, Brier score, and other stats.
    """
    db = get_supabase()
    paper = PaperTrader()

    # Get portfolio value
    portfolio = await paper.compute_portfolio_value(db)

    # Get all resolved trades for performance stats
    try:
        resolved_resp = (
            db.table("trades")
            .select("*")
            .in_("status", ["resolved", "filled"])
            .order("created_at", desc=True)
            .execute()
        )
        resolved_trades = resolved_resp.data or []
    except Exception:
        resolved_trades = []

    total_trades = len(resolved_trades)
    winning_trades = 0
    total_pnl = 0.0
    brier_sum = 0.0
    brier_count = 0

    for trade in resolved_trades:
        pnl = float(trade.get("pnl", 0) or 0)
        total_pnl += pnl
        if pnl > 0:
            winning_trades += 1

        # Compute Brier score component if outcome is known
        outcome = trade.get("outcome")
        edge = float(trade.get("edge_at_entry", 0) or 0)
        entry = float(trade.get("entry_price", 0.5) or 0.5)
        if outcome is not None:
            actual = 1.0 if outcome == "YES" else 0.0
            our_prob = entry + edge  # reconstruct our probability
            our_prob = max(0.0, min(1.0, our_prob))
            brier_sum += (our_prob - actual) ** 2
            brier_count += 1

    win_rate = winning_trades / total_trades if total_trades > 0 else 0.0
    brier_score = brier_sum / brier_count if brier_count > 0 else None

    # Get daily snapshots for charts
    try:
        snapshots_resp = (
            db.table("daily_snapshots")
            .select("*")
            .order("date", desc=True)
            .limit(30)
            .execute()
        )
        snapshots = snapshots_resp.data or []
    except Exception:
        snapshots = []

    return {
        "portfolio": portfolio,
        "total_trades": total_trades,
        "winning_trades": winning_trades,
        "win_rate": round(win_rate, 4),
        "total_pnl": round(total_pnl, 2),
        "brier_score": round(brier_score, 4) if brier_score is not None else None,
        "daily_snapshots": snapshots,
    }
