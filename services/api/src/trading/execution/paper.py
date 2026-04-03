import uuid
from datetime import datetime, timezone
from supabase import Client


class PaperTrader:
    """Handles paper (simulated) trade execution and portfolio tracking."""

    async def record_trade(
        self, db: Client, signal: dict, sizing: dict
    ) -> dict:
        """Record a paper trade in the database.

        Args:
            db: Supabase client.
            signal: Signal dict with strategy, market_id, etc.
            sizing: Sizing dict with side, size, kelly_fraction, entry_price, edge_at_entry.

        Returns:
            The created trade record as a dict.
        """
        trade_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        trade = {
            "id": trade_id,
            "signal_id": signal.get("signal_id") or signal.get("id"),
            "market_id": signal.get("market_id", ""),
            "strategy_name": signal.get("strategy", "unknown"),
            "side": sizing.get("side", "YES"),
            "size": sizing.get("size", 0.0),
            "entry_price": sizing.get("entry_price", 0.0),
            "fill_price": sizing.get("entry_price", 0.0),  # paper = instant fill at market
            "is_paper": True,
            "kelly_fraction": sizing.get("kelly_fraction", 0.0),
            "edge_at_entry": sizing.get("edge_at_entry", 0.0),
            "status": "open",
            "outcome": None,
            "pnl": None,
            "created_at": now,
        }

        try:
            resp = db.table("trades").insert(trade).execute()
            if resp.data:
                return resp.data[0]
        except Exception:
            pass

        return trade

    async def get_open_positions(self, db: Client) -> list[dict]:
        """Get all open paper positions.

        Returns:
            List of open trade dicts.
        """
        try:
            resp = (
                db.table("trades")
                .select("*")
                .eq("status", "open")
                .eq("is_paper", True)
                .order("created_at", desc=True)
                .execute()
            )
            return resp.data or []
        except Exception:
            return []

    async def compute_portfolio_value(self, db: Client) -> dict:
        """Compute the current portfolio value including open positions.

        Returns:
            Dict with bankroll, positions_value, total_value, position_count.
        """
        # Get bankroll from config
        bankroll = 1000.0
        try:
            config_resp = (
                db.table("portfolio_config")
                .select("bankroll")
                .limit(1)
                .execute()
            )
            if config_resp.data:
                bankroll = float(config_resp.data[0].get("bankroll", 1000.0))
        except Exception:
            pass

        # Get open positions
        open_positions = await self.get_open_positions(db)

        # Sum position values (size * entry_price as a rough mark)
        positions_value = 0.0
        for pos in open_positions:
            size = float(pos.get("size", 0))
            entry = float(pos.get("entry_price", 0))
            positions_value += size * entry

        # Get realized PnL from closed trades
        realized_pnl = 0.0
        try:
            closed_resp = (
                db.table("trades")
                .select("pnl")
                .eq("is_paper", True)
                .in_("status", ["filled", "resolved"])
                .execute()
            )
            if closed_resp.data:
                realized_pnl = sum(
                    float(t.get("pnl", 0) or 0) for t in closed_resp.data
                )
        except Exception:
            pass

        total_value = bankroll + realized_pnl + positions_value

        return {
            "bankroll": round(bankroll, 2),
            "realized_pnl": round(realized_pnl, 2),
            "positions_value": round(positions_value, 2),
            "total_value": round(total_value, 2),
            "position_count": len(open_positions),
        }
