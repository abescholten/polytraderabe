---
name: trader-backend
description: >
  Python FastAPI backend specialist for the trading platform, running as Vercel serverless
  functions. Covers API endpoint design, cron job handlers, Supabase integration from Python,
  async patterns, Pydantic models, and the serverless execution constraints. Trigger on:
  "backend", "API", "endpoint", "FastAPI", "Python function", "serverless", "cron", "route",
  "handler", "Pydantic", "async", or any task involving the Python API layer. When in doubt,
  trigger it.
---

# Trader Backend

You are a Python FastAPI backend specialist. The backend runs as Vercel serverless functions
with Python 3.12, connecting to Supabase for persistence and Polymarket/Open-Meteo APIs for data.

## Architecture

```
services/api/
├── src/
│   ├── api/                     # FastAPI route modules
│   │   ├── __init__.py
│   │   ├── signals.py           # Signal CRUD + approval
│   │   ├── strategies.py        # Strategy listing + config
│   │   ├── portfolio.py         # Positions, P&L, exposure
│   │   ├── markets.py           # Market browser, search
│   │   ├── backtesting.py       # Backtest trigger + results
│   │   └── health.py            # Health check + status
│   ├── trading/
│   │   ├── strategies/          # Algorithm implementations
│   │   │   ├── base.py          # TradingStrategy ABC
│   │   │   ├── weather_temp.py  # Weather temperature strategy
│   │   │   └── registry.py      # Strategy registry
│   │   ├── execution/
│   │   │   ├── engine.py        # Paper/live execution
│   │   │   └── paper.py         # Paper trade tracker
│   │   ├── risk/
│   │   │   ├── manager.py       # Risk checks
│   │   │   └── limits.py        # Position/portfolio limits
│   │   └── backtesting/
│   │       ├── runner.py        # Backtest orchestrator
│   │       └── metrics.py       # Brier, calibration, ROI
│   ├── data/
│   │   ├── weather/
│   │   │   ├── open_meteo.py    # Open-Meteo API client
│   │   │   └── probability.py   # Ensemble → probability
│   │   ├── market/
│   │   │   ├── gamma.py         # Gamma API client
│   │   │   ├── clob.py          # CLOB API client
│   │   │   └── websocket.py     # WebSocket client (Railway only)
│   │   └── pipeline/
│   │       ├── sync.py          # Scheduled data sync
│   │       └── cache.py         # Supabase-based caching
│   ├── models/
│   │   ├── signal.py            # Signal Pydantic models
│   │   ├── trade.py             # Trade models
│   │   ├── market.py            # Market models
│   │   └── strategy.py          # Strategy config models
│   ├── db/
│   │   ├── client.py            # Supabase Python client
│   │   └── queries.py           # Common queries
│   └── main.py                  # FastAPI app with router includes
├── tests/
├── pyproject.toml
└── requirements.txt
```

## Vercel Python Function Setup

### File Structure for Vercel

Vercel Python functions live in `api/` at the project root. Each file becomes an endpoint:

```
api/
├── signals/
│   ├── index.py                 # GET /api/signals
│   ├── [id]/
│   │   ├── index.py             # GET /api/signals/[id]
│   │   ├── approve.py           # POST /api/signals/[id]/approve
│   │   └── reject.py            # POST /api/signals/[id]/reject
├── strategies/
│   └── index.py                 # GET /api/strategies
├── portfolio/
│   ├── positions.py             # GET /api/portfolio/positions
│   └── performance.py           # GET /api/portfolio/performance
├── markets/
│   └── index.py                 # GET /api/markets
├── backtesting/
│   └── run.py                   # POST /api/backtesting/run
├── cron/
│   ├── scan-signals.py          # Cron: run all strategies
│   ├── sync-prices.py           # Cron: update market prices
│   └── check-resolutions.py     # Cron: check market outcomes
└── health.py                    # GET /api/health
```

### Vercel Function Pattern

```python
# api/signals/index.py
from http.server import BaseHTTPRequestHandler
import json

# For simple functions (Vercel Python runtime):
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Your logic here
        data = {"signals": []}
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())
```

### FastAPI on Vercel (Recommended)

Use FastAPI with the Mangum adapter for a cleaner developer experience:

```python
# api/main.py — Single FastAPI app exposed at /api/*
from fastapi import FastAPI, Depends, HTTPException
from mangum import Mangum
from contextlib import asynccontextmanager

app = FastAPI(title="Polymarket Trader API", version="0.1.0")

# Import routers
from src.api.signals import router as signals_router
from src.api.strategies import router as strategies_router
from src.api.portfolio import router as portfolio_router

app.include_router(signals_router, prefix="/signals", tags=["signals"])
app.include_router(strategies_router, prefix="/strategies", tags=["strategies"])
app.include_router(portfolio_router, prefix="/portfolio", tags=["portfolio"])

# Vercel serverless handler
handler = Mangum(app, lifespan="off")
```

Configure in `vercel.json`:

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/main.py" }
  ],
  "crons": [
    { "path": "/api/cron/scan-signals", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/sync-prices", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/check-resolutions", "schedule": "0 * * * *" }
  ]
}
```

## Vercel Python Constraints

| Constraint | Hobby | Pro ($20/mo) |
|-----------|-------|-------------|
| Execution timeout | 60s | 300s (800s max) |
| Memory | 1024 MB | 3008 MB |
| Bundle size | 250 MB | 500 MB |
| Cron frequency | 1/day | 1/minute |
| Cold start | ~2-5s | ~2-5s |

**Critical implications**:
- Cron every 5 minutes requires **Vercel Pro**
- Backtests hitting many APIs may timeout at 60s on Hobby — design for pagination
- Cold starts mean first-request latency — keep deps lean
- No WebSocket support — use Supabase Realtime or Railway for persistent connections
- `/tmp` is ephemeral (500 MB) — don't rely on filesystem state

## Supabase Python Client

```python
# src/db/client.py
from supabase import create_client, Client
import os

def get_supabase() -> Client:
    """Create Supabase client. Use pooled connection string from Vercel."""
    return create_client(
        os.environ["NEXT_PUBLIC_SUPABASE_URL"],
        os.environ["SUPABASE_SERVICE_ROLE_KEY"],  # Backend uses service role
    )
```

### Common Query Patterns

```python
# src/db/queries.py
from supabase import Client

async def get_pending_signals(db: Client) -> list[dict]:
    return db.table("signals").select("*, markets(*)").eq("status", "pending").execute().data

async def insert_signal(db: Client, signal: dict) -> dict:
    return db.table("signals").insert(signal).execute().data[0]

async def approve_signal(db: Client, signal_id: str, approved_by: str) -> dict:
    return db.table("signals").update({
        "status": "approved",
        "approved_by": approved_by,
        "approved_at": "now()",
    }).eq("id", signal_id).execute().data[0]

async def get_portfolio_exposure(db: Client) -> float:
    positions = db.table("positions").select("size").eq("status", "open").execute().data
    return sum(p["size"] for p in positions)
```

## API Endpoint Patterns

### Signals Router

```python
# src/api/signals.py
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from src.db.client import get_supabase
from src.trading.execution.engine import ExecutionEngine

router = APIRouter()

class ApprovalRequest(BaseModel):
    pass  # No body needed — ID comes from path

class RejectionRequest(BaseModel):
    reason: str

@router.get("/")
async def list_signals(status: str = None):
    db = get_supabase()
    query = db.table("signals").select("*, markets(*)")
    if status:
        query = query.eq("status", status)
    result = query.order("created_at", desc=True).limit(50).execute()
    return result.data

@router.post("/{signal_id}/approve")
async def approve_signal(signal_id: str):
    db = get_supabase()
    signal = db.table("signals").select("*").eq("id", signal_id).single().execute().data
    if not signal:
        raise HTTPException(404, "Signal not found")
    if signal["status"] != "pending":
        raise HTTPException(400, f"Signal is {signal['status']}, not pending")

    # Update status
    db.table("signals").update({"status": "approved", "approved_at": "now()"}).eq("id", signal_id).execute()

    # Execute trade (paper or live)
    engine = ExecutionEngine()
    result = await engine.execute_signal(signal)

    return {"status": "approved", "execution": result}
```

### Cron Job Handlers

```python
# api/cron/scan-signals.py
from fastapi import FastAPI, Request
from src.trading.strategies.registry import get_all_strategies
from src.trading.risk.manager import RiskManager
from src.db.client import get_supabase

app = FastAPI()

@app.post("/api/cron/scan-signals")
async def scan_signals(request: Request):
    """Run by Vercel cron every 5 minutes. Scans all strategies for new signals."""
    # Verify cron secret (prevent external triggers)
    auth = request.headers.get("authorization")
    if auth != f"Bearer {os.environ['CRON_SECRET']}":
        return {"error": "Unauthorized"}

    db = get_supabase()
    strategies = get_all_strategies()
    risk = RiskManager(db)

    new_signals = []
    for strategy in strategies:
        try:
            markets = await strategy.find_markets()
            for market in markets:
                signal = await strategy.generate_signal(market)
                if signal and signal["edge"] >= 0.05:
                    # Store as pending signal
                    record = await db.table("signals").insert({
                        "strategy": strategy.name,
                        "market_id": market["condition_id"],
                        "our_probability": signal["our_probability"],
                        "market_price": signal["market_price"],
                        "edge": signal["edge"],
                        "confidence": signal["confidence"],
                        "reasoning": signal["reasoning"],
                        "status": "pending",
                    }).execute()
                    new_signals.append(record.data[0])
        except Exception as e:
            # Log error but don't fail entire scan
            print(f"Strategy {strategy.name} error: {e}")

    return {"scanned": len(strategies), "new_signals": len(new_signals)}
```

## Pydantic Models

```python
# src/models/signal.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class SignalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    EXECUTED = "executed"

class SignalCreate(BaseModel):
    strategy: str
    market_id: str
    our_probability: float = Field(ge=0, le=1)
    market_price: float = Field(ge=0, le=1)
    edge: float
    confidence: str
    reasoning: str
    model_breakdown: Optional[dict] = None

class SignalResponse(SignalCreate):
    id: str
    status: SignalStatus
    created_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    trade_id: Optional[str] = None  # Linked trade after execution
```

## Dependencies

```
# requirements.txt
fastapi>=0.115.0
mangum>=0.19.0
supabase>=2.10.0
httpx>=0.28.0
py-clob-client>=0.34.0
pydantic>=2.10.0
numpy>=2.0.0
python-dotenv>=1.0.0
```

## Environment Variables

All secrets are in Vercel env vars (not .env files in repo):

```bash
# Set via: vercel env add VARIABLE_NAME
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_API_KEY=...
POLYMARKET_API_SECRET=...
POLYMARKET_PASSPHRASE=...
CRON_SECRET=random-secret-for-cron-auth
ENABLE_LIVE_TRADING=false
```

## Safety Rules

1. **Service role key stays on backend** — never expose to frontend
2. **Cron endpoints verify auth header** — prevent external triggers
3. **All writes go through Supabase RLS** — even with service role, design defensively
4. **Error handling is mandatory** — every endpoint has try/catch, returns structured errors
5. **Timeout-aware design** — paginate API calls, don't block on long operations
6. **Log everything** — Vercel logs + Supabase audit table for all trade-related actions
