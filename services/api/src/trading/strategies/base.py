from abc import ABC, abstractmethod
from typing import Optional
from datetime import date


class TradingStrategy(ABC):
    """Abstract base class for all trading strategies."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique identifier for this strategy."""
        ...

    @property
    @abstractmethod
    def category(self) -> str:
        """Category grouping (e.g. 'weather', 'sports', 'politics')."""
        ...

    @abstractmethod
    async def find_markets(self) -> list[dict]:
        """Discover markets this strategy can trade.

        Returns:
            List of market dicts with at least 'condition_id' and 'question'.
        """
        ...

    @abstractmethod
    async def generate_signal(self, market: dict) -> Optional[dict]:
        """Analyze a market and optionally produce a trading signal.

        Args:
            market: Market dict from find_markets().

        Returns:
            Signal dict with keys: strategy, market_id, our_probability,
            market_price, edge, confidence, reasoning, model_breakdown.
            Returns None if no actionable signal.
        """
        ...

    @abstractmethod
    async def backtest(self, start_date: date, end_date: date) -> dict:
        """Run a historical backtest over the given date range.

        Args:
            start_date: Backtest start date.
            end_date: Backtest end date.

        Returns:
            Dict with backtest results: total_trades, win_rate, pnl,
            brier_score, max_drawdown, sharpe_ratio.
        """
        ...
