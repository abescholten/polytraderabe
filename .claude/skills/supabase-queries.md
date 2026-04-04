---
name: supabase-queries
description: >
  Supabase query patterns for the PolyTrader platform. Covers standard queries for paper trades,
  backtest results, orderbook snapshots, weather forecasts, and market data. Trigger on:
  "query Supabase", "fetch from database", "read paper trades", "get orderbook data",
  "backtest results from database", "Supabase query", "database query", "read from Supabase",
  "how do I query", "fetch market data from db", or any task involving reading or writing
  to Supabase tables in the PolyTrader schema.
  When in doubt, trigger it.
---

# Supabase Queries

Standard query patterns for PolyTrader's Supabase database. All queries use the
Python Supabase client (backend) or the JS/TS client (frontend via Next.js).

## Client Setup

### Python Backend

```python
import os
from supabase import create_client, Client

def get_supabase_client() -> Client:
    """Get Supabase client with service role key (backend only)."""
    return create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],  # Never expose to frontend
    )

# In FastAPI endpoints, use dependency injection:
from functools import lru_cache

@lru_cache(maxsize=1)
def get_db() -> Client:
    return get_supabase_client()
```

### TypeScript Frontend

```typescript
// apps/web/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // Only anon key in frontend
)
```

## Table Reference

| Table | Purpose | Key Columns |
|---|---|---|
| `markets` | Polymarket market metadata | `condition_id`, `question`, `city`, `region`, `active` |
| `orderbook_snapshots` | Full orderbook depth per market | `market_id`, `captured_at`, `best_bid`, `best_ask`, `mid_price`, `spread`, `bids`, `asks` |
| `weather_forecasts` | Ensemble forecast storage | `city`, `model`, `variable`, `forecast_date`, `target_date`, `data` |
| `paper_trades` | Paper trade log | `strategy`, `market_id`, `side`, `size`, `edge`, `our_probability`, `market_price`, `created_at` |
| `backtest_runs` | Backtest results | `strategy_name`, `config`, `summary`, `calibration`, `equity_curve`, `completed_at` |

## Common Query Patterns

### Markets

```python
# Get all active weather markets for a specific city
def get_weather_markets_by_city(city: str, db: Client) -> list[dict]:
    result = db.table("markets").select("*").eq(
        "city", city
    ).eq("active", True).execute()
    return result.data or []

# Get markets by region
def get_europe_markets(db: Client) -> list[dict]:
    result = db.table("markets").select(
        "condition_id, question, city, volume, liquidity"
    ).eq("region", "europe").eq("active", True).order(
        "volume", desc=True
    ).execute()
    return result.data or []

# Upsert market (discover or update)
def upsert_market(market: dict, db: Client) -> None:
    db.table("markets").upsert(
        market, on_conflict="condition_id"
    ).execute()
```

### Orderbook Snapshots

```python
# Latest snapshot for a market
def get_latest_orderbook(market_id: str, db: Client) -> dict | None:
    result = db.table("orderbook_snapshots").select("*").eq(
        "market_id", market_id
    ).order("captured_at", desc=True).limit(1).execute()
    return result.data[0] if result.data else None

# Time-series: orderbook history for a market
def get_orderbook_history(
    market_id: str,
    hours: int = 24,
    interval_minutes: int = 5,
    db: Client = None,
) -> list[dict]:
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    result = db.table("orderbook_snapshots").select(
        "captured_at, best_bid, best_ask, mid_price, spread"
    ).eq("market_id", market_id).gte(
        "captured_at", cutoff
    ).order("captured_at").execute()

    # Downsample to interval_minutes
    rows = result.data or []
    if interval_minutes <= 1:
        return rows
    sampled = []
    last_ts = None
    for row in rows:
        ts = row["captured_at"]
        if last_ts is None or (
            (datetime.fromisoformat(ts) - datetime.fromisoformat(last_ts)).seconds
            >= interval_minutes * 60
        ):
            sampled.append(row)
            last_ts = ts
    return sampled

# Best bid/ask spread over time for a market
def get_spread_history(market_id: str, hours: int = 48, db: Client = None) -> list[dict]:
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    result = db.table("orderbook_snapshots").select(
        "captured_at, spread, mid_price"
    ).eq("market_id", market_id).gte("captured_at", cutoff).order("captured_at").execute()
    return result.data or []
```

### Paper Trades

```python
# Get recent paper trades
def get_paper_trades(hours: int = 24, db: Client = None) -> list[dict]:
    from datetime import datetime, timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    result = db.table("paper_trades").select("*").gte(
        "created_at", cutoff
    ).order("created_at", desc=True).execute()
    return result.data or []

# Get trades for a specific strategy
def get_strategy_trades(strategy: str, limit: int = 50, db: Client = None) -> list[dict]:
    result = db.table("paper_trades").select("*").eq(
        "strategy", strategy
    ).order("created_at", desc=True).limit(limit).execute()
    return result.data or []

# Log a new paper trade
def log_paper_trade(trade: dict, db: Client) -> str:
    """Returns the new trade's ID."""
    result = db.table("paper_trades").insert(trade).execute()
    return result.data[0]["id"]

# Mark a paper trade as resolved with outcome
def resolve_paper_trade(trade_id: str, outcome: int, pnl: float, db: Client) -> None:
    db.table("paper_trades").update({
        "resolved": True,
        "outcome": outcome,
        "pnl": pnl,
        "resolved_at": "now()",
    }).eq("id", trade_id).execute()
```

### Backtest Results

```python
# Store a backtest result
def store_backtest_result(result: dict, db: Client) -> str:
    """result should have: strategy_name, config, summary, calibration, equity_curve."""
    row = db.table("backtest_runs").insert(result).execute()
    return row.data[0]["id"]

# Get latest backtest for a strategy
def get_latest_backtest(strategy: str, db: Client) -> dict | None:
    result = db.table("backtest_runs").select("*").eq(
        "strategy_name", strategy
    ).order("completed_at", desc=True).limit(1).execute()
    return result.data[0] if result.data else None

# Get all backtests for comparison
def get_backtest_history(strategy: str, limit: int = 10, db: Client = None) -> list[dict]:
    result = db.table("backtest_runs").select(
        "id, strategy_name, summary, completed_at"
    ).eq("strategy_name", strategy).order(
        "completed_at", desc=True
    ).limit(limit).execute()
    return result.data or []
```

### Weather Forecasts

```python
# Store ensemble forecast data
def store_weather_forecast(
    city: str,
    model: str,
    variable: str,
    forecast_date: str,  # ISO date when forecast was made
    target_date: str,    # ISO date the forecast is for
    data: dict,          # Serialized numpy arrays
    db: Client = None,
) -> None:
    db.table("weather_forecasts").upsert({
        "city": city,
        "model": model,
        "variable": variable,
        "forecast_date": forecast_date,
        "target_date": target_date,
        "data": data,
    }, on_conflict="city,model,variable,forecast_date,target_date").execute()

# Get stored forecast (for backtesting replay)
def get_stored_forecast(
    city: str, model: str, variable: str,
    forecast_date: str, target_date: str,
    db: Client = None,
) -> dict | None:
    result = db.table("weather_forecasts").select("data").eq(
        "city", city
    ).eq("model", model).eq("variable", variable).eq(
        "forecast_date", forecast_date
    ).eq("target_date", target_date).execute()
    return result.data[0]["data"] if result.data else None
```

## TypeScript Frontend Patterns

```typescript
// Get active markets for dashboard
export async function getActiveMarkets(region?: string) {
  let query = supabase
    .from('markets')
    .select('condition_id, question, city, volume, liquidity')
    .eq('active', true)
    .order('volume', { ascending: false })

  if (region) {
    query = query.eq('region', region)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

// Real-time orderbook subscription
export function subscribeToOrderbook(
  marketId: string,
  onUpdate: (snapshot: any) => void
) {
  return supabase
    .channel(`orderbook:${marketId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'orderbook_snapshots',
        filter: `market_id=eq.${marketId}`,
      },
      (payload) => onUpdate(payload.new)
    )
    .subscribe()
}

// Get paper trade history for dashboard
export async function getPaperTrades(limit = 50) {
  const { data, error } = await supabase
    .from('paper_trades')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}
```

## Data Retention Queries

```sql
-- 5-minute samples for data older than 7 days (run on schedule)
DELETE FROM public.orderbook_snapshots
WHERE captured_at < NOW() - INTERVAL '7 days'
  AND id NOT IN (
    SELECT DISTINCT ON (
      market_id,
      date_trunc('hour', captured_at),
      floor(extract(minute from captured_at) / 5)
    ) id
    FROM public.orderbook_snapshots
    WHERE captured_at < NOW() - INTERVAL '7 days'
    ORDER BY market_id,
             date_trunc('hour', captured_at),
             floor(extract(minute from captured_at) / 5),
             captured_at
  );

-- Hourly samples for data older than 30 days
DELETE FROM public.orderbook_snapshots
WHERE captured_at < NOW() - INTERVAL '30 days'
  AND id NOT IN (
    SELECT DISTINCT ON (market_id, date_trunc('hour', captured_at))
    id
    FROM public.orderbook_snapshots
    WHERE captured_at < NOW() - INTERVAL '30 days'
    ORDER BY market_id, date_trunc('hour', captured_at), captured_at
  );
```

## Safety Rules

1. **Never use SUPABASE_SERVICE_ROLE_KEY in frontend code** — anon key only
2. **Always check RLS is enabled** on tables exposed to the frontend
3. **Prefer `.select("col1, col2")` over `.select("*")`** for large tables (orderbook_snapshots)
4. **Upsert over insert** for market data that might already exist
5. **Always handle None/empty result** — Supabase returns empty list, not error, on no match
6. **Use parameterized queries** — never interpolate user input into table/column names
