import os
from pathlib import Path
from typing import Optional

from supabase import Client

from src.db.client import get_supabase
from src.trading.risk.manager import RiskManager
from src.trading.execution.paper import PaperTrader

# Kill switch file path — if this file exists, live trading is disabled
KILL_SWITCH_PATH = Path("/tmp/polytrader_kill_switch")


class ExecutionEngine:
    """Handles signal execution, routing to paper or live trading."""

    def __init__(self, db: Optional[Client] = None):
        self.db = db or get_supabase()
        self.risk_manager = RiskManager(self.db)
        self.paper_trader = PaperTrader()

    def is_live_trading_enabled(self) -> bool:
        """Check if live trading is enabled.

        Live trading requires:
        1. LIVE_TRADING_ENABLED env var set to 'true'
        2. Kill switch file does NOT exist
        """
        env_enabled = os.environ.get("LIVE_TRADING_ENABLED", "false").lower() == "true"
        kill_switch_active = KILL_SWITCH_PATH.exists()
        return env_enabled and not kill_switch_active

    async def execute_signal(self, signal: dict) -> dict:
        """Execute a trading signal.

        1. Compute position sizing using Kelly criterion.
        2. Run risk checks.
        3. Route to paper or live execution.

        Args:
            signal: Signal dict with strategy, market_id, our_probability,
                    market_price, edge, confidence.

        Returns:
            Dict with trade details or rejection info.
        """
        our_prob = signal.get("our_probability", 0.5)
        market_price = signal.get("market_price", 0.5)
        edge = signal.get("edge", 0.0)

        # Kelly criterion for position sizing
        # f* = (bp - q) / b where b = odds, p = our_prob, q = 1-p
        if market_price > 0 and market_price < 1:
            b = (1.0 / market_price) - 1.0  # decimal odds for YES
            p = our_prob
            q = 1.0 - p
            kelly = (b * p - q) / b if b > 0 else 0.0
        else:
            kelly = 0.0

        # Use half-Kelly for safety
        half_kelly = max(kelly * 0.5, 0.0)

        # Determine side
        if edge > 0:
            side = "YES"
        else:
            side = "NO"
            # For NO bets, recalculate using NO probability
            half_kelly = max(abs(kelly) * 0.5, 0.0)

        # Cap position size
        portfolio_value = self.risk_manager._portfolio_value
        size = min(half_kelly * portfolio_value, 100.0)  # dollar cap
        size = max(size, 1.0)  # minimum $1 trade

        sizing = {
            "side": side,
            "size": round(size, 2),
            "kelly_fraction": round(half_kelly, 4),
            "entry_price": market_price,
            "edge_at_entry": round(edge, 4),
        }

        # Risk check
        risk_result = self.risk_manager.check_trade(
            market_id=signal.get("market_id", ""),
            size=sizing["size"],
            side=sizing["side"],
            edge=edge,
        )

        if not risk_result["allowed"]:
            return {
                "executed": False,
                "reason": risk_result["reason"],
                "sizing": sizing,
            }

        # Route execution
        if self.is_live_trading_enabled():
            # Live trading path — not yet implemented
            # Would use py-clob-client here
            return {
                "executed": False,
                "reason": "Live trading is enabled but not yet implemented. Use paper mode.",
                "sizing": sizing,
            }
        else:
            # Paper trading
            trade = await self.paper_trader.record_trade(
                db=self.db,
                signal=signal,
                sizing=sizing,
            )
            return {
                "executed": True,
                "mode": "paper",
                "trade": trade,
                "sizing": sizing,
            }
