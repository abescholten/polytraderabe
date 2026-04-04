---
name: performance-report
description: >
  Weekly and on-demand performance review of paper trading results, algorithm calibration
  trends, and go-live readiness assessment for PolyTrader strategies. Generates structured
  reports the human can read to make decisions. Trigger on: "performance report", "how are
  we doing", "paper trading results", "weekly review", "are we ready to go live",
  "trading summary", "strategy performance", "portfolio report", "P&L summary",
  "calibration trend", "how is paper trading going", "go-live assessment",
  or any request for a summary of trading performance over time.
  When in doubt, trigger it.
---

# Performance Report

You are the performance review specialist for PolyTrader. You compile structured reports
from paper trading data, backtest results, and algorithm metrics so the human can decide
which strategies are ready and where to focus next.

**Output:** Always produce a structured Markdown report. Never summarize verbally without
showing the data.

## Data Sources

Pull from these in order (use what's available):

1. **Supabase `paper_trades`** — actual paper trading history (most valuable)
2. **Supabase `backtest_runs`** — backtesting results
3. **Local backtest files** — `services/api/backtests/*.json` if Supabase unavailable
4. **Signal logs** — recent signal output from the strategy pipeline

## Report Types

### 1. Weekly Performance Report

Run every ~7 days or on demand. Covers the last 7 days of paper trading.

```python
from datetime import datetime, timezone, timedelta

def build_weekly_report(trades: list[dict], period_days: int = 7) -> dict:
    """Compute weekly performance metrics from paper trade records."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=period_days)
    period_trades = [
        t for t in trades
        if datetime.fromisoformat(t["created_at"].replace("Z", "+00:00")) >= cutoff
    ]
    resolved = [t for t in period_trades if t.get("resolved")]

    if not resolved:
        return {
            "period": f"Last {period_days} days",
            "resolved_trades": 0,
            "message": "No resolved trades yet — markets still open",
        }

    total_pnl = sum(t.get("pnl", 0) for t in resolved)
    winners = [t for t in resolved if t.get("pnl", 0) > 0]
    losers = [t for t in resolved if t.get("pnl", 0) <= 0]
    edges = [abs(t.get("edge", 0)) for t in resolved]

    # Brier score from resolved trades
    import numpy as np
    forecasts = np.array([t.get("our_probability", 0.5) for t in resolved])
    outcomes = np.array([float(t.get("outcome", 0)) for t in resolved])
    brier = float(np.mean((forecasts - outcomes) ** 2)) if len(forecasts) > 0 else None

    return {
        "period": f"Last {period_days} days",
        "total_trades_generated": len(period_trades),
        "resolved_trades": len(resolved),
        "open_trades": len(period_trades) - len(resolved),
        "winners": len(winners),
        "losers": len(losers),
        "win_rate": round(len(winners) / len(resolved), 3) if resolved else 0,
        "total_pnl_usd": round(total_pnl, 2),
        "avg_edge": round(sum(edges) / len(edges), 4) if edges else 0,
        "brier_score": round(brier, 4) if brier is not None else None,
        "beats_market_benchmark": brier is not None and brier < 0.058,
    }
```

### 2. Strategy Comparison Report

Compare all strategies that have at least 5 resolved trades.

```python
def compare_strategies(trades: list[dict]) -> list[dict]:
    """Group by strategy and compute per-strategy metrics."""
    from collections import defaultdict
    import numpy as np

    by_strategy = defaultdict(list)
    for t in trades:
        if t.get("resolved"):
            by_strategy[t.get("strategy", "unknown")].append(t)

    results = []
    for strategy, strat_trades in by_strategy.items():
        if len(strat_trades) < 5:
            results.append({
                "strategy": strategy,
                "sample_size": len(strat_trades),
                "note": "Insufficient sample (need 5+)",
            })
            continue

        pnls = [t.get("pnl", 0) for t in strat_trades]
        forecasts = np.array([t.get("our_probability", 0.5) for t in strat_trades])
        outcomes = np.array([float(t.get("outcome", 0)) for t in strat_trades])
        brier = float(np.mean((forecasts - outcomes) ** 2))
        winners = sum(1 for p in pnls if p > 0)

        results.append({
            "strategy": strategy,
            "sample_size": len(strat_trades),
            "win_rate": round(winners / len(strat_trades), 3),
            "total_pnl": round(sum(pnls), 2),
            "avg_edge": round(float(np.mean([abs(t.get("edge", 0)) for t in strat_trades])), 4),
            "brier_score": round(brier, 4),
            "beats_market": brier < 0.058,
            "status": (
                "EXCELLENT" if brier < 0.04 and winners / len(strat_trades) > 0.55
                else "GOOD" if brier < 0.058
                else "MARGINAL" if brier < 0.07
                else "FAILING"
            ),
        })

    return sorted(results, key=lambda r: r.get("brier_score", 1.0))
```

### 3. Calibration Trend Report

Shows if calibration is improving or degrading over time.

```python
def calibration_trend(trades: list[dict], window_size: int = 20) -> list[dict]:
    """Rolling Brier score over resolved trades — shows improvement over time."""
    import numpy as np

    resolved = sorted(
        [t for t in trades if t.get("resolved")],
        key=lambda t: t.get("created_at", "")
    )

    if len(resolved) < window_size:
        return []

    trend = []
    for i in range(window_size, len(resolved) + 1):
        window = resolved[i - window_size:i]
        forecasts = np.array([t.get("our_probability", 0.5) for t in window])
        outcomes = np.array([float(t.get("outcome", 0)) for t in window])
        brier = float(np.mean((forecasts - outcomes) ** 2))
        trend.append({
            "trade_index": i,
            "brier_score": round(brier, 4),
            "date": window[-1].get("created_at", "")[:10],
            "improving": len(trend) > 0 and brier < trend[-1]["brier_score"],
        })

    return trend
```

### 4. Go-Live Readiness Assessment

```python
def go_live_assessment(
    strategy: str,
    trades: list[dict],
    backtest_result: dict | None = None,
) -> dict:
    """Automated go-live readiness check."""
    import numpy as np

    resolved = [t for t in trades if t.get("resolved") and t.get("strategy") == strategy]

    checks = {}

    # 1. Sample size
    checks["sample_size"] = {
        "required": 30,
        "actual": len(resolved),
        "passed": len(resolved) >= 30,
        "note": f"{len(resolved)}/30 resolved trades",
    }

    if len(resolved) >= 5:
        forecasts = np.array([t.get("our_probability", 0.5) for t in resolved])
        outcomes = np.array([float(t.get("outcome", 0)) for t in resolved])
        brier = float(np.mean((forecasts - outcomes) ** 2))
        pnls = [t.get("pnl", 0) for t in resolved]
        win_rate = sum(1 for p in pnls if p > 0) / len(pnls)
        total_pnl = sum(pnls)

        # 2. Brier score
        checks["brier_score"] = {
            "required": "< 0.058",
            "actual": round(brier, 4),
            "passed": brier < 0.058,
            "note": f"Market benchmark is 0.058",
        }

        # 3. Win rate
        checks["win_rate"] = {
            "required": "> 50%",
            "actual": f"{win_rate:.1%}",
            "passed": win_rate > 0.50,
        }

        # 4. Positive P&L
        checks["total_pnl"] = {
            "required": "> $0",
            "actual": f"${total_pnl:.2f}",
            "passed": total_pnl > 0,
        }

        # 5. Minimum 2 weeks of operation
        if resolved:
            from datetime import datetime
            first = datetime.fromisoformat(resolved[0]["created_at"].replace("Z", "+00:00"))
            last = datetime.fromisoformat(resolved[-1]["created_at"].replace("Z", "+00:00"))
            days_operating = (last - first).days
            checks["operating_time"] = {
                "required": "> 14 days",
                "actual": f"{days_operating} days",
                "passed": days_operating >= 14,
            }

    all_passed = all(c["passed"] for c in checks.values())
    return {
        "strategy": strategy,
        "ready_for_live": all_passed,
        "checks": checks,
        "recommendation": (
            "Ready for live trading with reduced position sizes (50% of normal Kelly)."
            if all_passed
            else "Continue paper trading. Review failing checks and target improvements."
        ),
    }
```

## Full Report Format

```markdown
# PolyTrader Performance Report
**Period:** [start] to [end] | **Generated:** [datetime]

---

## Executive Summary

| Metric | Value | Target | Status |
|--------|-------|--------|--------|
| Total resolved trades | [N] | > 30 | [✓/✗] |
| Brier score | [X] | < 0.058 | [✓/✗] |
| Win rate | [X%] | > 50% | [✓/✗] |
| Total P&L (paper) | $[X] | > $0 | [✓/✗] |
| Best strategy | [name] | — | — |

---

## Strategy Comparison

| Strategy | Trades | Win% | Brier | P&L | Status |
|----------|--------|------|-------|-----|--------|
| weather_temperature | [N] | [X%] | [X] | $[X] | [EXCELLENT/GOOD/MARGINAL/FAILING] |

---

## Calibration Trend

[Rolling Brier score chart data — show as ASCII if no charting available]

Week 1: [X] | Week 2: [X] | Week 3: [X] | Trend: [IMPROVING/STABLE/DEGRADING]

---

## Go-Live Assessment: [strategy name]

[Go-live check table]

---

## Insights & Recommendations

1. **Strongest area:** [observation]
2. **Weakest area:** [observation]
3. **Immediate action:** [what to do next]

---

## Backlog Items Generated

- [P1/P2/P3] [item]: [why]
```

## After Performance Report

Always run `/backlog-update` with:
- Strategies that need calibration improvement (P1 if failing, P2 if marginal)
- Win rate patterns that suggest systematic errors
- Any go-live readiness gaps found
- Market categories with insufficient sample size (need more markets)

## Safety Rules

1. **Require N>5 before computing Brier** — below that it's noise, not signal
2. **Show confidence intervals where possible** — small sample = high variance
3. **Never green-light go-live without the 30-trade minimum** — automated check, no overrides
4. **Flag P&L separately from Brier** — profitable paper trades with poor Brier is lucky, not skilled
5. **Always compare to market benchmark (0.058)** — relative performance matters more than absolute
6. **Open (unresolved) trades don't count** — only include resolved trades in all metrics
