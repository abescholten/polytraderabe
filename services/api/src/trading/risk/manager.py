from datetime import datetime, timedelta, timezone
from typing import Optional
from supabase import Client

from src.trading.risk.limits import RiskLimits


class RiskManager:
    """Validates trades against risk limits before execution."""

    def __init__(self, db: Client, limits: Optional[RiskLimits] = None):
        self.db = db
        self.limits = limits or RiskLimits()
        self._halted = False
        self._portfolio_value: float = 0.0
        self._open_positions: list[dict] = []
        self._daily_pnl: float = 0.0
        self._daily_trade_count: int = 0
        self._peak_value: float = 0.0
        self._load_state()

    def _load_state(self):
        """Load current portfolio state from Supabase."""
        try:
            # Get portfolio config
            config_resp = (
                self.db.table("portfolio_config")
                .select("*")
                .limit(1)
                .execute()
            )
            if config_resp.data:
                cfg = config_resp.data[0]
                self._portfolio_value = float(cfg.get("bankroll", 1000.0))
                self._peak_value = float(cfg.get("peak_value", self._portfolio_value))
                self._halted = bool(cfg.get("is_halted", False))

            # Get open positions
            positions_resp = (
                self.db.table("trades")
                .select("*")
                .eq("status", "open")
                .execute()
            )
            self._open_positions = positions_resp.data or []

            # Compute daily PnL and trade count
            today_start = datetime.now(timezone.utc).replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            daily_resp = (
                self.db.table("trades")
                .select("pnl, created_at")
                .gte("created_at", today_start.isoformat())
                .execute()
            )
            daily_trades = daily_resp.data or []
            self._daily_trade_count = len(daily_trades)
            self._daily_pnl = sum(
                float(t.get("pnl", 0) or 0) for t in daily_trades
            )

        except Exception:
            # If DB is unavailable, use safe defaults
            self._portfolio_value = 1000.0
            self._peak_value = 1000.0
            self._open_positions = []
            self._daily_pnl = 0.0
            self._daily_trade_count = 0

    def check_trade(
        self,
        market_id: str,
        size: float,
        side: str,
        edge: float,
    ) -> dict:
        """Check whether a proposed trade passes all risk checks.

        Args:
            market_id: The market condition ID.
            size: Dollar size of the proposed trade.
            side: 'YES' or 'NO'.
            edge: The estimated edge (our_prob - market_price).

        Returns:
            Dict with 'allowed' (bool) and 'reason' (str if rejected).
        """
        # 1. Check if trading is halted
        if self._halted:
            return {"allowed": False, "reason": "Trading is halted by circuit breaker or manual kill switch."}

        # 2. Check drawdown circuit breaker
        if self._portfolio_value > 0 and self._peak_value > 0:
            drawdown = (self._peak_value - self._portfolio_value) / self._peak_value
            if drawdown >= self.limits.drawdown_circuit_breaker:
                return {
                    "allowed": False,
                    "reason": f"Drawdown circuit breaker triggered: {drawdown:.1%} >= {self.limits.drawdown_circuit_breaker:.1%}.",
                }

        # 3. Check daily stop loss
        if self._portfolio_value > 0:
            daily_loss_pct = abs(min(self._daily_pnl, 0)) / self._portfolio_value
            if daily_loss_pct >= self.limits.daily_stop_loss_pct:
                return {
                    "allowed": False,
                    "reason": f"Daily stop loss triggered: {daily_loss_pct:.1%} loss today.",
                }

        # 4. Check position size as percentage of portfolio
        if self._portfolio_value > 0:
            position_pct = size / self._portfolio_value
            if position_pct > self.limits.max_position_pct:
                return {
                    "allowed": False,
                    "reason": f"Position size {position_pct:.1%} exceeds max {self.limits.max_position_pct:.1%} of portfolio.",
                }

        # 5. Check dollar cap
        if size > self.limits.max_position_usd:
            return {
                "allowed": False,
                "reason": f"Position ${size:.2f} exceeds max ${self.limits.max_position_usd:.2f} per trade.",
            }

        # 6. Check total portfolio exposure
        total_exposure = sum(
            float(p.get("size", 0)) for p in self._open_positions
        )
        if self._portfolio_value > 0:
            new_exposure_pct = (total_exposure + size) / self._portfolio_value
            if new_exposure_pct > self.limits.max_portfolio_pct:
                return {
                    "allowed": False,
                    "reason": f"Total exposure {new_exposure_pct:.1%} would exceed max {self.limits.max_portfolio_pct:.1%}.",
                }

        # 7. Check minimum edge threshold
        if abs(edge) < self.limits.min_edge_threshold:
            return {
                "allowed": False,
                "reason": f"Edge {abs(edge):.1%} below minimum {self.limits.min_edge_threshold:.1%}.",
            }

        # 8. Check daily trade count
        if self._daily_trade_count >= self.limits.max_trades_per_day:
            return {
                "allowed": False,
                "reason": f"Daily trade limit reached: {self._daily_trade_count}/{self.limits.max_trades_per_day}.",
            }

        # 9. Check for duplicate position in same market
        for pos in self._open_positions:
            if pos.get("market_id") == market_id and pos.get("side") == side:
                return {
                    "allowed": False,
                    "reason": f"Already have an open {side} position in market {market_id}.",
                }

        return {"allowed": True, "reason": "All risk checks passed."}
