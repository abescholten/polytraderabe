---
name: backtesting
description: >
  Backtesting engine and strategy evaluation specialist for prediction market algorithms. Covers
  historical data collection, backtest orchestration, performance metrics (Brier score, calibration,
  ROI, Sharpe-like ratios), visualization of results, and go-live readiness assessment. Trigger on:
  "backtest", "historical", "performance", "metrics", "Brier score", "calibration", "ROI",
  "evaluation", "accuracy", "forecast skill", "lead time", "verification", "go-live criteria",
  "drawdown analysis", or any task involving testing strategies against historical data.
  When in doubt, trigger it.
---

# Backtesting

You are a backtesting and strategy evaluation specialist for prediction markets. The backtesting
engine tests algorithms against historical data to determine if they have a genuine edge before
risking real capital.

## Core Principle

**A strategy must prove itself in paper trading before going live.** Backtesting alone is
insufficient — it's prone to overfitting, look-ahead bias, and selection bias. But it's the
necessary first filter: if a strategy can't beat the market historically, it won't beat it live.

## Backtesting Pipeline

```
1. Collect historical markets (resolved, with known outcomes)
         │
2. For each market + resolution date:
   a. Fetch what weather forecast said N days before resolution
   b. Compute what our probability would have been
   c. Record: our_prob, market_price_at_time, actual_outcome
         │
3. Simulate trading decisions using strategy rules
   (position sizing, risk limits, minimum edge)
         │
4. Compute metrics: Brier, calibration, ROI, drawdown
         │
5. Compare to benchmarks (market Brier, random strategy)
```

## Backtest Runner

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional
import numpy as np

@dataclass
class BacktestConfig:
    """Configuration for a backtest run."""
    strategy_name: str
    start_date: str                          # YYYY-MM-DD
    end_date: str                            # YYYY-MM-DD
    initial_bankroll: float = 10000.0
    kelly_fraction: float = 0.15
    max_position_pct: float = 0.05
    max_position_usd: float = 100.0
    min_edge: float = 0.05
    min_liquidity: float = 1000.0            # Skip low-liquidity markets
    lead_time_hours: int = 48                # How far before resolution we trade

@dataclass
class BacktestTrade:
    """A simulated trade in the backtest."""
    market_id: str
    question: str
    our_probability: float
    market_price: float
    edge: float
    side: str                                # YES or NO
    size: float
    entry_price: float
    outcome: int                             # 1=YES, 0=NO
    pnl: float
    trade_date: datetime
    resolution_date: datetime

@dataclass
class BacktestResult:
    """Complete backtest results."""
    config: BacktestConfig
    trades: list[BacktestTrade] = field(default_factory=list)
    forecasts: list[dict] = field(default_factory=list)  # For Brier/calibration
    run_id: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    @property
    def total_trades(self) -> int:
        return len(self.trades)

    @property
    def winners(self) -> int:
        return sum(1 for t in self.trades if t.pnl > 0)

    @property
    def losers(self) -> int:
        return sum(1 for t in self.trades if t.pnl <= 0)

    @property
    def win_rate(self) -> float:
        return self.winners / max(self.total_trades, 1)

    @property
    def total_pnl(self) -> float:
        return sum(t.pnl for t in self.trades)

    @property
    def roi(self) -> float:
        return self.total_pnl / self.config.initial_bankroll

    @property
    def avg_edge(self) -> float:
        if not self.trades:
            return 0
        return np.mean([t.edge for t in self.trades])

    @property
    def max_drawdown(self) -> float:
        if not self.trades:
            return 0
        cumulative = np.cumsum([t.pnl for t in self.trades])
        peak = np.maximum.accumulate(cumulative)
        drawdowns = peak - cumulative
        return float(np.max(drawdowns)) / self.config.initial_bankroll if len(drawdowns) > 0 else 0

    @property
    def brier_score(self) -> float:
        if not self.forecasts:
            return 1.0
        return np.mean([
            (f["probability"] - f["outcome"]) ** 2
            for f in self.forecasts
        ])

    @property
    def profit_factor(self) -> float:
        """Gross profit / gross loss. >1 is profitable."""
        gross_profit = sum(t.pnl for t in self.trades if t.pnl > 0)
        gross_loss = abs(sum(t.pnl for t in self.trades if t.pnl <= 0))
        return gross_profit / max(gross_loss, 0.01)
```

## Backtest Orchestrator

```python
class BacktestRunner:
    """Orchestrates backtesting for any strategy."""

    def __init__(self, strategy, config: BacktestConfig):
        self.strategy = strategy
        self.config = config

    async def run(self) -> BacktestResult:
        result = BacktestResult(
            config=self.config,
            run_id=str(uuid4()),
            started_at=datetime.utcnow(),
        )
        bankroll = self.config.initial_bankroll

        # 1. Get historical resolved markets
        markets = await self._get_historical_markets()

        for market in markets:
            # 2. Skip if insufficient liquidity
            if market.get("volume", 0) < self.config.min_liquidity:
                continue

            # 3. Get what the market price was N hours before resolution
            historical_price = await self._get_price_at_time(
                market, hours_before=self.config.lead_time_hours
            )
            if historical_price is None:
                continue

            # 4. Get what our forecast would have been
            signal = await self.strategy.generate_historical_signal(
                market, hours_before=self.config.lead_time_hours
            )
            if signal is None:
                continue

            # 5. Record forecast for Brier
            result.forecasts.append({
                "market_id": market["condition_id"],
                "probability": signal["our_probability"],
                "market_price": historical_price,
                "outcome": market["outcome"],
            })

            # 6. Would we have traded?
            edge = abs(signal["our_probability"] - historical_price)
            if edge < self.config.min_edge:
                continue

            # 7. Position sizing
            from src.trading.engine import kelly_fraction, position_size
            sizing = position_size(
                signal["our_probability"],
                historical_price,
                bankroll,
                self.config.kelly_fraction,
                self.config.max_position_pct,
                self.config.max_position_usd,
            )
            if sizing["size"] <= 0:
                continue

            # 8. Simulate trade
            side = sizing["side"]
            size = sizing["size"]
            entry = historical_price

            # Compute P&L
            outcome = market["outcome"]
            if side == "YES":
                pnl = size * (1 - entry) / entry if outcome == 1 else -size
            else:
                pnl = size * entry / (1 - entry) if outcome == 0 else -size

            trade = BacktestTrade(
                market_id=market["condition_id"],
                question=market["question"],
                our_probability=signal["our_probability"],
                market_price=historical_price,
                edge=edge,
                side=side,
                size=size,
                entry_price=entry,
                outcome=outcome,
                pnl=pnl,
                trade_date=market["end_date"] - timedelta(hours=self.config.lead_time_hours),
                resolution_date=market["end_date"],
            )
            result.trades.append(trade)
            bankroll += pnl

        result.completed_at = datetime.utcnow()
        return result

    async def _get_historical_markets(self) -> list[dict]:
        """Fetch resolved markets from Gamma API within date range."""
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://gamma-api.polymarket.com/markets",
                params={
                    "closed": "true",
                    "limit": 500,
                    "order": "end_date_iso",
                }
            )
            all_markets = resp.json()
            # Filter by date range and category
            return [
                m for m in all_markets
                if (self.config.start_date <= m.get("end_date_iso", "")[:10] <= self.config.end_date
                    and m.get("outcome") is not None)
            ]

    async def _get_price_at_time(self, market: dict, hours_before: int) -> float | None:
        """Get market price N hours before resolution from price history."""
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://clob.polymarket.com/prices-history",
                params={
                    "market": market["condition_id"],
                    "interval": "1h",
                    "fidelity": 1,
                }
            )
            if resp.status_code != 200:
                return None
            history = resp.json().get("history", [])
            # Find price at target time (simplified)
            if history:
                # Return price from approximately hours_before before end
                target_idx = max(0, len(history) - hours_before)
                return history[target_idx].get("p", None)
            return None
```

## Performance Metrics

```python
class PerformanceMetrics:
    """Compute all performance metrics from a backtest result."""

    @staticmethod
    def summary(result: BacktestResult) -> dict:
        return {
            "total_trades": result.total_trades,
            "winners": result.winners,
            "losers": result.losers,
            "win_rate": round(result.win_rate, 3),
            "total_pnl": round(result.total_pnl, 2),
            "roi": round(result.roi, 4),
            "avg_edge": round(result.avg_edge, 4),
            "max_drawdown": round(result.max_drawdown, 4),
            "brier_score": round(result.brier_score, 4),
            "profit_factor": round(result.profit_factor, 2),
            "market_brier_benchmark": 0.058,
            "beats_market": result.brier_score < 0.058,
        }

    @staticmethod
    def calibration_curve(result: BacktestResult, n_bins: int = 10) -> list[dict]:
        """Compute calibration curve for the backtest."""
        if not result.forecasts:
            return []

        bins = np.linspace(0, 1, n_bins + 1)
        curve = []
        for i in range(n_bins):
            mask = [
                bins[i] <= f["probability"] < bins[i + 1]
                for f in result.forecasts
            ]
            if sum(mask):
                bin_forecasts = [f for f, m in zip(result.forecasts, mask) if m]
                curve.append({
                    "bin_start": round(bins[i], 1),
                    "bin_end": round(bins[i + 1], 1),
                    "avg_forecast": round(np.mean([f["probability"] for f in bin_forecasts]), 3),
                    "observed_freq": round(np.mean([f["outcome"] for f in bin_forecasts]), 3),
                    "count": len(bin_forecasts),
                })
        return curve

    @staticmethod
    def rolling_brier(result: BacktestResult, window: int = 20) -> list[dict]:
        """Rolling Brier score over time — shows if strategy is improving or degrading."""
        if len(result.forecasts) < window:
            return []

        rolling = []
        for i in range(window, len(result.forecasts) + 1):
            window_data = result.forecasts[i - window:i]
            score = np.mean([(f["probability"] - f["outcome"]) ** 2 for f in window_data])
            rolling.append({
                "index": i,
                "brier_score": round(score, 4),
            })
        return rolling

    @staticmethod
    def equity_curve(result: BacktestResult) -> list[dict]:
        """Cumulative P&L over time for the equity chart."""
        if not result.trades:
            return []

        cumulative = 0
        curve = [{"trade": 0, "equity": result.config.initial_bankroll}]
        for i, trade in enumerate(result.trades):
            cumulative += trade.pnl
            curve.append({
                "trade": i + 1,
                "equity": round(result.config.initial_bankroll + cumulative, 2),
                "pnl": round(trade.pnl, 2),
                "market": trade.question[:50],
            })
        return curve

    @staticmethod
    def edge_vs_outcome(result: BacktestResult) -> list[dict]:
        """Scatter data: predicted edge vs actual P&L — shows if edge translates to profit."""
        return [
            {
                "edge": round(t.edge, 4),
                "pnl": round(t.pnl, 2),
                "side": t.side,
                "won": t.pnl > 0,
            }
            for t in result.trades
        ]

    @staticmethod
    def lead_time_analysis(result: BacktestResult) -> dict:
        """Analyze how forecast accuracy varies by lead time."""
        # Group forecasts by lead time buckets
        buckets = {
            "6-12h": [], "12-24h": [], "24-48h": [],
            "48-72h": [], "72h+": []
        }
        for f in result.forecasts:
            lt = f.get("lead_time_hours", 48)
            if lt <= 12:
                buckets["6-12h"].append(f)
            elif lt <= 24:
                buckets["12-24h"].append(f)
            elif lt <= 48:
                buckets["24-48h"].append(f)
            elif lt <= 72:
                buckets["48-72h"].append(f)
            else:
                buckets["72h+"].append(f)

        return {
            bucket: {
                "count": len(forecasts),
                "brier": round(np.mean([(f["probability"] - f["outcome"])**2 for f in forecasts]), 4) if forecasts else None,
            }
            for bucket, forecasts in buckets.items()
        }
```

## Go-Live Readiness Checklist

```python
@dataclass
class GoLiveAssessment:
    """Automated assessment of whether a strategy is ready for live trading."""

    @staticmethod
    def assess(result: BacktestResult, paper_results: list[BacktestResult] = None) -> dict:
        checks = {}

        # 1. Sufficient sample size
        checks["sample_size"] = {
            "required": 30,
            "actual": result.total_trades,
            "passed": result.total_trades >= 30,
        }

        # 2. Brier score below market benchmark
        checks["brier_score"] = {
            "required": "< 0.058",
            "actual": round(result.brier_score, 4),
            "passed": result.brier_score < 0.058,
        }

        # 3. Positive ROI
        checks["positive_roi"] = {
            "required": "> 0%",
            "actual": f"{result.roi:.1%}",
            "passed": result.roi > 0,
        }

        # 4. Win rate above break-even
        checks["win_rate"] = {
            "required": "> 50%",
            "actual": f"{result.win_rate:.1%}",
            "passed": result.win_rate > 0.5,
        }

        # 5. Maximum drawdown within limits
        checks["max_drawdown"] = {
            "required": "< 15%",
            "actual": f"{result.max_drawdown:.1%}",
            "passed": result.max_drawdown < 0.15,
        }

        # 6. Profit factor > 1
        checks["profit_factor"] = {
            "required": "> 1.0",
            "actual": round(result.profit_factor, 2),
            "passed": result.profit_factor > 1.0,
        }

        # 7. Calibration (if enough data)
        cal = PerformanceMetrics.calibration_curve(result)
        if cal:
            max_deviation = max(abs(b["avg_forecast"] - b["observed_freq"]) for b in cal)
            checks["calibration"] = {
                "required": "< 10% max deviation",
                "actual": f"{max_deviation:.1%}",
                "passed": max_deviation < 0.10,
            }

        all_passed = all(c["passed"] for c in checks.values())

        return {
            "ready": all_passed,
            "checks": checks,
            "recommendation": (
                "Strategy meets all go-live criteria. Consider starting with reduced position sizes (50% of normal)."
                if all_passed
                else "Strategy does NOT meet go-live criteria. Continue paper trading and analyze failing checks."
            ),
        }
```

## Backtest Report Storage

Store backtest results in Supabase for dashboard display:

```sql
CREATE TABLE public.backtest_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_name TEXT NOT NULL,
    config JSONB NOT NULL,
    summary JSONB NOT NULL,       -- Total trades, ROI, Brier, etc.
    calibration JSONB,            -- Calibration curve data
    equity_curve JSONB,           -- For chart rendering
    go_live_assessment JSONB,     -- Readiness check results
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

## Common Pitfalls

1. **Look-ahead bias** — Never use information that wasn't available at trade time. The forecast must be from BEFORE the resolution date.
2. **Survivorship bias** — Include markets that had low volume or were hard to trade. Don't only backtest "easy" markets.
3. **Overfitting** — If you tune parameters to maximize backtest ROI, you're fitting noise. Use walk-forward validation: train on first 70%, validate on last 30%.
4. **Ignoring slippage** — Backtest assumes execution at mid-price. Real execution has spread costs. Subtract estimated slippage (0.5-1%) from backtest returns.
5. **Ignoring fees** — Polymarket charges takers 0-1.25%. If your strategy takes from the book, subtract fees.
6. **Selection bias** — Don't cherry-pick which markets to include. Run against ALL markets in the category.

## Safety Rules

1. **Backtests never touch real APIs for trading** — only for reading historical data
2. **Results are stored, not just displayed** — for reproducibility and comparison
3. **Go-live assessment is automated** — no manual overriding of failing criteria
4. **Walk-forward validation is mandatory** — never evaluate on the same data you optimized on
5. **Paper trading complements backtesting** — backtest passes are necessary but not sufficient

## Real Backtesting Implementation

The `WeatherBacktester` class in `src/trading/backtesting/weather.py` (planned) provides
proper historical replay — for each day in the range it fetches ERA5 actuals as ground truth
and computes what the ensemble forecast would have predicted. Returns `BacktestResult` with
Brier score, reliability, win rate, and mean edge.

The older `backtest()` method on `WeatherTemperatureStrategy` was a simplified simulation
and has been replaced to delegate to `WeatherBacktester`.

## After Any Backtest Work

Run `/day-trader` to evaluate the results and `/backlog-update` to capture:
- Algorithm improvements revealed by backtest data
- New market categories to test
- Parameter tuning opportunities
- Go-live readiness assessment findings
