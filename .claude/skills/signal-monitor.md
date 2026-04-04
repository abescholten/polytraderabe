---
name: signal-monitor
description: >
  Live signal monitoring specialist for the PolyTrader paper trading pipeline. Checks which
  signals are currently active, surfaces high-edge opportunities, queries the signal log,
  and identifies patterns in signal quality over time. Trigger on: "what signals do we have",
  "check active signals", "any high-edge opportunities", "signal log", "monitor signals",
  "what's the best trade right now", "signal quality", "check the pipeline", "run the scanner",
  "signal history", "recent signals", or any request to check or review current trading signals.
  When in doubt, trigger it.
---

# Signal Monitor

You are a live signal monitoring specialist. You check what signals the weather algorithms are
generating right now, surface the best opportunities, and flag anything unusual. You operate
in read-only mode — no trades are executed here.

## Signal Pipeline Overview

```
Open-Meteo Ensemble API
        │
        ▼
WeatherTemperatureStrategy.generate_signal()
        │
        ▼
Signal dict → Risk check → Paper execution → Supabase log
```

## Checking Live Signals

### Via API Endpoint

```bash
# If the backend is running locally:
curl http://localhost:8000/strategies/weather_temperature/signals | jq .

# On production:
curl https://your-vercel-url.vercel.app/api/strategies/weather_temperature/signals | jq .
```

### Via Python (direct)

```python
import asyncio
from src.trading.strategies.weather_temp import WeatherTemperatureStrategy

async def check_live_signals():
    strategy = WeatherTemperatureStrategy()
    markets = await strategy.find_markets()
    
    signals = []
    for market in markets:
        signal = await strategy.generate_signal(market)
        if signal:
            signals.append(signal)
    
    # Sort by abs(edge) descending
    signals.sort(key=lambda s: abs(s["edge"]), reverse=True)
    return signals

signals = asyncio.run(check_live_signals())
```

## Signal Quality Assessment

### What a Good Signal Looks Like

```python
SIGNAL_QUALITY_CRITERIA = {
    "high": {
        "edge": 0.15,          # |our_prob - market_price| > 15%
        "confidence": "high",
        "model_agreement": 0.10,  # All models within 10% of each other
    },
    "medium": {
        "edge": 0.08,
        "confidence": "medium",
        "model_agreement": 0.15,
    },
    "low": {
        "edge": 0.05,
        "confidence": "low",
        "model_agreement": None,  # No requirement
    },
}

def assess_signal(signal: dict) -> str:
    """Rate a signal as HIGH / MEDIUM / LOW / SKIP."""
    edge = abs(signal.get("edge", 0))
    confidence = signal.get("confidence", "low")
    
    # Check model agreement from breakdown
    breakdown = signal.get("model_breakdown", {})
    if breakdown:
        probs = [v["probability"] for v in breakdown.values()]
        model_spread = max(probs) - min(probs)
    else:
        model_spread = 0
    
    if edge >= 0.15 and confidence == "high" and model_spread <= 0.10:
        return "HIGH"
    elif edge >= 0.08 and model_spread <= 0.15:
        return "MEDIUM"
    elif edge >= 0.05:
        return "LOW"
    else:
        return "SKIP"
```

### Red Flags in Signals

```python
def check_signal_anomalies(signal: dict) -> list[str]:
    """Return list of warnings for suspicious signals."""
    warnings = []
    
    edge = abs(signal.get("edge", 0))
    our_prob = signal.get("our_probability", 0.5)
    market_price = signal.get("market_price", 0.5)
    breakdown = signal.get("model_breakdown", {})
    
    # Edge too large → likely a parsing error or data issue
    if edge > 0.35:
        warnings.append(f"SUSPICIOUS: Edge {edge:.1%} is extremely large — verify manually")
    
    # Probability at extreme ends → check threshold/unit conversion
    if our_prob < 0.03 or our_prob > 0.97:
        warnings.append(f"SUSPICIOUS: Our probability {our_prob:.1%} is extreme")
    
    # Market price at extreme ends → might be near resolution
    if market_price < 0.05 or market_price > 0.95:
        warnings.append(f"NOTE: Market price {market_price:.1%} is near resolution — check time remaining")
    
    # High model disagreement
    if breakdown:
        probs = [v["probability"] for v in breakdown.values()]
        spread = max(probs) - min(probs)
        if spread > 0.20:
            warnings.append(f"CAUTION: Models disagree by {spread:.1%} — lower confidence")
    
    return warnings
```

## Querying Signal History

### From Supabase (if paper_trades table exists)

```python
from supabase import create_client
import os

def get_recent_signals(hours: int = 24) -> list[dict]:
    """Fetch signals generated in the last N hours from Supabase."""
    client = create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    )
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    
    result = client.table("paper_trades").select("*").gte(
        "created_at", cutoff
    ).order("created_at", desc=True).execute()
    
    return result.data or []


def get_signal_stats(hours: int = 168) -> dict:
    """Compute aggregate stats for signals in the last N hours."""
    signals = get_recent_signals(hours)
    if not signals:
        return {"count": 0, "message": "No signals in period"}
    
    edges = [abs(s.get("edge", 0)) for s in signals]
    high_edge = [s for s in signals if abs(s.get("edge", 0)) >= 0.12]
    
    return {
        "total_signals": len(signals),
        "high_edge_signals": len(high_edge),
        "mean_edge": round(sum(edges) / len(edges), 4),
        "max_edge": round(max(edges), 4),
        "strategies": list({s.get("strategy", "unknown") for s in signals}),
    }
```

## Live Monitoring Report

After checking signals, always produce this format:

```
## Signal Monitor — [datetime]

### Pipeline Status
- Market scanner: [OK / ERROR]
- Open-Meteo API: [OK / SLOW / ERROR]
- Signal generation: [N] markets scanned, [N] signals produced

### Active High-Edge Signals

| Quality | Question | City | Edge | Our P | Market P | Models |
|---------|----------|------|------|-------|----------|--------|
| HIGH    | Will Berlin exceed 22°C? | Berlin | +16% | 68% | 52% | ECMWF=70%, GFS=65%, ICON=68% |
| MEDIUM  | Will Paris rain >10mm?   | Paris  | -9%  | 41% | 50% | ECMWF=38%, GFS=45%, ICON=40% |

### Warnings & Anomalies
- [Any red flags from check_signal_anomalies()]

### Signal Volume (last 24h)
- Total signals generated: [N]
- High-edge: [N], Medium: [N], Low (skipped): [N]

### Recommendation
[One paragraph: best opportunity right now, any concerns]
```

## After Monitoring

Run `/day-trader` if you want a deeper algorithm evaluation, or `/backlog-update` to capture:
- New market question patterns that failed to parse
- API reliability issues (timeouts, rate limits)
- Signal patterns that look systematically off (calibration drift)
- High-edge opportunities that need manual review

## Safety Rules

1. **Never trigger execution** — this skill is read-only
2. **Always include anomaly check** — don't just report edges, flag suspicious ones
3. **Check signal freshness** — signals from >1h ago may be stale (market moved)
4. **Model disagreement > 20% = low confidence** — always show the breakdown
5. **Don't confuse signal quality with go-live readiness** — high-quality signal ≠ ready to trade live
