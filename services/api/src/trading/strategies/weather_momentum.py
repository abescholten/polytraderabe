"""Momentum strategy — trades on sustained directional price movement.

Edge: When a weather market's YES price moves consistently in one direction
over the past N snapshots, newer model runs are probably all agreeing in
that direction. We ride the momentum wave.
"""

import logging
from datetime import date
from typing import Optional

from src.trading.strategies.base import TradingStrategy
from src.trading.strategies.weather_temp import parse_market_question
from src.data.market.gamma import find_weather_markets
from src.db.client import get_supabase

logger = logging.getLogger(__name__)

MIN_MOVE = 0.05
SNAPSHOT_LIMIT = 6
MIN_MONOTONE_RATIO = 0.8


def _compute_momentum(prices: list[float]) -> tuple[Optional[str], float]:
    """Return (direction, magnitude) of momentum, or (None, 0) if no clear trend.

    direction: 'up' | 'down' | None
    magnitude: absolute total price change over the window
    """
    if len(prices) < 3:
        return None, 0.0

    moves = [prices[i + 1] - prices[i] for i in range(len(prices) - 1)]
    up_steps = sum(1 for m in moves if m > 0)
    down_steps = sum(1 for m in moves if m < 0)
    total = len(moves)

    total_move = prices[-1] - prices[0]

    if abs(total_move) < MIN_MOVE:
        return None, 0.0

    if up_steps / total >= MIN_MONOTONE_RATIO:
        return "up", abs(total_move)
    if down_steps / total >= MIN_MONOTONE_RATIO:
        return "down", abs(total_move)

    return None, 0.0


class WeatherMomentumStrategy(TradingStrategy):
    """Momentum strategy that follows sustained directional moves in YES price."""

    @property
    def name(self) -> str:
        return "weather_momentum"

    @property
    def category(self) -> str:
        return "weather"

    async def find_markets(self) -> list[dict]:
        return await find_weather_markets()

    async def generate_signal(self, market: dict) -> Optional[dict]:
        parsed = parse_market_question(market.get("question", ""))
        if parsed is None:
            return None

        condition_id = market["condition_id"]

        try:
            db = get_supabase()
            result = (
                db.table("orderbook_snapshots")
                .select("mid_price, created_at")
                .eq("market_id", condition_id)
                .order("created_at", desc=True)
                .limit(SNAPSHOT_LIMIT)
                .execute()
            )
            rows = result.data or []
        except Exception:
            logger.exception("Failed to fetch snapshots for %s", condition_id)
            return None

        if len(rows) < 3:
            return None

        # Rows are newest-first; reverse so prices are oldest-first
        prices = [float(r["mid_price"]) for r in reversed(rows)]
        direction, magnitude = _compute_momentum(prices)

        if direction is None:
            return None

        current_price = prices[-1]

        # Don't trade if current price is already at an extreme
        if current_price > 0.85 or current_price < 0.15:
            return None

        if direction == "up":
            side = "YES"
            edge = current_price - 0.50
        else:
            side = "NO"
            edge = 0.50 - current_price

        confidence: str
        if magnitude >= 0.15:
            confidence = "high"
        elif magnitude >= 0.10:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "strategy": self.name,
            "market_id": condition_id,
            "our_probability": current_price,
            "market_price": current_price,
            "edge": edge,
            "side": side,
            "confidence": confidence,
            "reasoning": (
                f"Momentum {direction}: price moved {magnitude:+.1%} over last "
                f"{len(prices)} snapshots ({prices[0]:.1%} → {prices[-1]:.1%})"
            ),
            "model_breakdown": {},
        }

    async def backtest(self, start_date: date, end_date: date) -> dict:
        return {
            "total_trades": 0,
            "win_rate": None,
            "pnl": 0.0,
            "brier_score": None,
            "max_drawdown": 0.0,
            "sharpe_ratio": None,
        }
