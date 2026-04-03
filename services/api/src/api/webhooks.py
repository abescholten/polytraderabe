import os
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Header

from src.db.client import get_supabase
from src.trading.strategies.registry import get_all_strategies
from src.data.market.clob import get_prices
from src.data.market.gamma import get_market_detail
from src.trading.execution.paper import PaperTrader

router = APIRouter()

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")


def _verify_secret(x_webhook_secret: str | None):
    """Verify the webhook secret header."""
    if not WEBHOOK_SECRET:
        return  # no secret configured, allow all (dev mode)
    if x_webhook_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


@router.post("/scan-signals")
async def scan_signals(x_webhook_secret: str | None = Header(None)):
    """Run all strategies to discover new trading signals.

    Triggered by n8n on a schedule (e.g., every 30 minutes).
    """
    _verify_secret(x_webhook_secret)

    db = get_supabase()
    strategies = get_all_strategies()

    signals_created = []
    errors = []

    for strategy in strategies:
        try:
            markets = await strategy.find_markets()
            for market in markets:
                try:
                    # Upsert market into Supabase so sync-prices and dashboard work
                    condition_id = market.get("condition_id", "")
                    if condition_id:
                        tokens = market.get("tokens", [])
                        yes_token = ""
                        no_token = ""
                        for t in tokens:
                            if t.get("outcome", "").upper() == "YES":
                                yes_token = t.get("token_id", "")
                            elif t.get("outcome", "").upper() == "NO":
                                no_token = t.get("token_id", "")
                        if not yes_token:
                            clob_ids = market.get("clobTokenIds", [])
                            if len(clob_ids) >= 2:
                                yes_token = clob_ids[0]
                                no_token = clob_ids[1]
                            elif len(clob_ids) == 1:
                                yes_token = clob_ids[0]

                        market_record = {
                            "condition_id": condition_id,
                            "question": market.get("question", ""),
                            "slug": market.get("slug", ""),
                            "category": "weather",
                            "yes_token_id": yes_token or "unknown",
                            "no_token_id": no_token or "unknown",
                            "end_date": market.get("end_date_iso"),
                            "active": market.get("active", True),
                            "closed": market.get("closed", False),
                            "volume": market.get("volume"),
                            "volume_24h": market.get("volume_24hr"),
                            "liquidity": market.get("liquidity"),
                            "best_bid": market.get("best_bid"),
                            "best_ask": market.get("best_ask"),
                            "synced_at": datetime.now(timezone.utc).isoformat(),
                        }
                        db.table("markets").upsert(
                            market_record, on_conflict="condition_id"
                        ).execute()

                    signal = await strategy.generate_signal(market)
                    if signal is None:
                        continue

                    # Resolve market UUID from condition_id
                    market_uuid = None
                    if condition_id:
                        market_row = (
                            db.table("markets")
                            .select("id")
                            .eq("condition_id", condition_id)
                            .limit(1)
                            .execute()
                        )
                        if market_row.data:
                            market_uuid = market_row.data[0]["id"]

                    # Check for duplicate: same strategy + market + pending
                    dup_query = (
                        db.table("signals")
                        .select("id")
                        .eq("strategy_name", signal["strategy"])
                        .eq("status", "pending")
                    )
                    if market_uuid:
                        dup_query = dup_query.eq("market_id", market_uuid)
                    existing = dup_query.execute()
                    if existing.data:
                        continue  # skip duplicate

                    # Insert signal
                    signal_record = {
                        "id": str(uuid.uuid4()),
                        "strategy_name": signal["strategy"],
                        "market_id": market_uuid,
                        "our_probability": signal["our_probability"],
                        "market_price": signal["market_price"],
                        "edge": signal["edge"],
                        "confidence": signal["confidence"],
                        "recommended_side": "YES" if signal["edge"] > 0 else "NO",
                        "reasoning": signal["reasoning"],
                        "model_breakdown": signal.get("model_breakdown"),
                        "status": "pending",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                    db.table("signals").insert(signal_record).execute()
                    signals_created.append(signal_record)

                except Exception as e:
                    errors.append({
                        "strategy": strategy.name,
                        "market": market.get("condition_id", "unknown"),
                        "error": str(e),
                    })

        except Exception as e:
            errors.append({
                "strategy": strategy.name,
                "error": str(e),
            })

    return {
        "signals_created": len(signals_created),
        "signals": signals_created,
        "errors": errors,
        "strategies_run": len(strategies),
    }


@router.post("/sync-prices")
async def sync_prices(x_webhook_secret: str | None = Header(None)):
    """Fetch current prices for all tracked markets and update price history.

    Triggered by n8n on a schedule (e.g., every 15 minutes).
    """
    _verify_secret(x_webhook_secret)

    db = get_supabase()

    # Get all active markets with token IDs
    markets_resp = (
        db.table("markets")
        .select("id, condition_id, yes_token_id, no_token_id")
        .eq("active", True)
        .eq("closed", False)
        .execute()
    )
    markets = markets_resp.data or []

    if not markets:
        return {"updated": 0, "message": "No active markets to sync"}

    # Collect all token IDs
    token_ids = []
    token_to_market: dict[str, dict] = {}
    for m in markets:
        yes_id = m.get("yes_token_id")
        if yes_id:
            token_ids.append(yes_id)
            token_to_market[yes_id] = m

    if not token_ids:
        return {"updated": 0, "message": "No token IDs to query"}

    # Batch fetch prices
    prices = await get_prices(token_ids, side="BUY")

    now = datetime.now(timezone.utc).isoformat()
    updated = 0

    for token_id, price in prices.items():
        if price is None:
            continue

        market = token_to_market.get(token_id)
        if not market:
            continue

        # Update market best_bid
        try:
            db.table("markets").update({
                "best_bid": price,
                "best_ask": min(price + 0.02, 1.0),  # approximate spread
            }).eq("id", market["id"]).execute()
        except Exception:
            pass

        # Insert price history record
        try:
            db.table("price_history").insert({
                "id": str(uuid.uuid4()),
                "market_id": market["id"],
                "condition_id": market.get("condition_id", ""),
                "yes_price": price,
                "no_price": round(1.0 - price, 4),
                "timestamp": now,
            }).execute()
            updated += 1
        except Exception:
            pass

    return {"updated": updated, "total_markets": len(markets)}


@router.post("/check-resolutions")
async def check_resolutions(x_webhook_secret: str | None = Header(None)):
    """Check for resolved markets and update outcomes.

    Triggered by n8n on a schedule (e.g., every hour).
    """
    _verify_secret(x_webhook_secret)

    db = get_supabase()

    # Get active markets that might have resolved
    markets_resp = (
        db.table("markets")
        .select("*")
        .eq("active", True)
        .eq("resolved", False)
        .execute()
    )
    markets = markets_resp.data or []

    resolved_count = 0
    trades_settled = 0

    for market in markets:
        condition_id = market.get("condition_id", "")
        if not condition_id:
            continue

        try:
            detail = await get_market_detail(condition_id)
            if not detail:
                continue

            # Check if market is resolved
            is_resolved = detail.get("resolved", False)
            is_closed = detail.get("closed", False)

            if not is_resolved and not is_closed:
                continue

            # Determine outcome
            outcome = None
            tokens = detail.get("tokens", [])
            for token in tokens:
                if token.get("winner", False):
                    outcome = token.get("outcome", "").upper()
                    break

            # Update market record
            db.table("markets").update({
                "resolved": True,
                "closed": True,
                "active": False,
                "outcome": outcome,
            }).eq("id", market["id"]).execute()
            resolved_count += 1

            # Settle trades for this market
            if outcome:
                trades_resp = (
                    db.table("trades")
                    .select("*")
                    .eq("market_id", market.get("id", ""))
                    .eq("status", "open")
                    .execute()
                )
                open_trades = trades_resp.data or []

                for trade in open_trades:
                    side = trade.get("side", "YES")
                    size = float(trade.get("size", 0))
                    entry_price = float(trade.get("entry_price", 0))

                    # Compute PnL
                    if side == outcome:
                        # Won: payout is size * (1 / entry_price - 1) approximately
                        pnl = size * (1.0 - entry_price) / entry_price if entry_price > 0 else 0
                    else:
                        # Lost: lose the stake
                        pnl = -size

                    db.table("trades").update({
                        "status": "resolved",
                        "outcome": outcome,
                        "pnl": round(pnl, 2),
                    }).eq("id", trade["id"]).execute()
                    trades_settled += 1

        except Exception:
            continue

    return {
        "markets_checked": len(markets),
        "markets_resolved": resolved_count,
        "trades_settled": trades_settled,
    }


@router.post("/daily-snapshot")
async def daily_snapshot(x_webhook_secret: str | None = Header(None)):
    """Compute and store a daily portfolio snapshot.

    Triggered by n8n once per day (e.g., at midnight UTC).
    """
    _verify_secret(x_webhook_secret)

    db = get_supabase()
    paper = PaperTrader()

    # Compute portfolio value
    portfolio = await paper.compute_portfolio_value(db)

    # Get today's trades
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    today_trades_resp = (
        db.table("trades")
        .select("pnl, status")
        .gte("created_at", today_start.isoformat())
        .execute()
    )
    today_trades = today_trades_resp.data or []

    daily_pnl = sum(float(t.get("pnl", 0) or 0) for t in today_trades)
    trades_today = len(today_trades)

    # Get total signal counts
    signals_resp = (
        db.table("signals")
        .select("status")
        .gte("created_at", today_start.isoformat())
        .execute()
    )
    signals_today = signals_resp.data or []
    signals_generated = len(signals_today)
    signals_approved = sum(1 for s in signals_today if s.get("status") in ("approved", "executed"))

    snapshot = {
        "id": str(uuid.uuid4()),
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "portfolio_value": portfolio["total_value"],
        "bankroll": portfolio["bankroll"],
        "positions_value": portfolio["positions_value"],
        "realized_pnl": portfolio["realized_pnl"],
        "daily_pnl": round(daily_pnl, 2),
        "trades_today": trades_today,
        "signals_generated": signals_generated,
        "signals_approved": signals_approved,
        "position_count": portfolio["position_count"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        db.table("daily_snapshots").insert(snapshot).execute()
    except Exception:
        pass  # snapshot already exists for today or table issue

    return snapshot
