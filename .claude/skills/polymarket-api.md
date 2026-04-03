---
name: polymarket-api
description: >
  Polymarket API integration expert — covering the CLOB orderbook API, Gamma market discovery API,
  Data API, WebSocket streams, and the py-clob-client Python SDK. Use this skill whenever working
  with Polymarket endpoints, authentication, order placement, market data fetching, price history,
  token IDs, or any code that talks to Polymarket's infrastructure. Trigger on: "Polymarket",
  "CLOB", "Gamma API", "py-clob-client", "token_id", "condition_id", "order book", "market data",
  "polymarket auth", "EIP-712", "HMAC", or any task involving reading or writing to Polymarket's
  APIs. Even if someone just says "fetch markets" or "place order" in the context of this project —
  use this skill. When in doubt, trigger it.
---

# Polymarket API Integration

You are a Polymarket API specialist. This project uses three Polymarket APIs plus WebSocket streams,
all running on Polygon mainnet (Chain ID 137) with USDC collateral and ERC-1155 conditional tokens.

## Architecture Overview

| Service | Base URL | Auth Required | Purpose |
|---------|----------|---------------|---------|
| **CLOB API** | `https://clob.polymarket.com` | Read: No / Trade: Yes | Orderbook, pricing, order management |
| **Gamma API** | `https://gamma-api.polymarket.com` | No | Market discovery, events, categories, search |
| **Data API** | `https://data-api.polymarket.com` | No | User positions, trades, leaderboards |
| **WebSocket** | `wss://ws-subscriptions-clob.polymarket.com/ws/market` | Market: No / User: Yes | Real-time orderbook + price streams |

## CLOB API — Core Endpoints

### Public (no auth)

```
GET /price?token_id={id}&side={BUY|SELL}
GET /prices?token_ids={id1},{id2}&side={BUY|SELL}        # batch (up to 200)
GET /book?token_id={id}                                    # full orderbook
GET /midpoint?token_id={id}
GET /spread?token_id={id}
GET /last-trade-price?token_id={id}
GET /prices-history?market={condition_id}&interval={1m|5m|1h|1d}&fidelity={1-60}
GET /tick-size?token_id={id}                               # min price increment
GET /neg-risk?token_id={id}                                # is this a neg-risk market?
```

### Authenticated (L2 auth required)

```
POST   /order                    # Place single order
POST   /orders                   # Batch orders (max 15)
DELETE /order/{order_id}         # Cancel single order
DELETE /orders                   # Cancel batch
DELETE /cancel-all               # Cancel ALL open orders
GET    /orders?market={id}&status={OPEN|FILLED|CANCELLED}
GET    /trades?market={id}
GET    /positions?market={id}
```

### Order Types

| Type | Behavior |
|------|----------|
| `GTC` | Good Till Cancel — stays on book until filled or cancelled |
| `GTD` | Good Till Date — expires at specified timestamp |
| `FOK` | Fill or Kill — must fill entirely or cancel immediately |
| `FAK` | Fill and Kill — fills what it can, cancels the rest |

## Gamma API — Market Discovery

The Gamma API is your primary tool for finding tradeable markets.

```
GET /markets?active=true&closed=false&limit=50&order=volume24hr
GET /markets?tag_id=100381                    # Filter by category (weather)
GET /markets?slug=will-nyc-temperature-exceed
GET /markets/{condition_id}                   # Single market detail
GET /events                                   # Group of related markets
GET /events/{event_slug}
```

Key response fields:
- `condition_id` — unique market identifier
- `tokens[0].token_id` / `tokens[1].token_id` — YES and NO token IDs
- `tokens[0].outcome` — "Yes" or "No"
- `question` — human-readable market question
- `end_date_iso` — resolution date
- `active`, `closed`, `archived` — market status flags
- `volume`, `volume_24hr`, `liquidity` — trading metrics
- `best_bid`, `best_ask` — current top of book
- `tags` — category tags (search for weather, climate, temperature)

### Finding Weather Markets

Weather market discovery uses three strategies (see `src/data/market/discovery.py`):
1. **Tag search** — `tag_id=100381` (official weather category)
2. **Keyword search** — temperature, weather, rain, snow, heat, cold, hurricane, storm
3. **European city name search** — 20 EU capitals, filtered to weather-related questions only

Markets are classified with city/region using `classify_market_city()` for filtering.

### Fetching Full Orderbook

```python
# GET /book?token_id={id} — returns full depth
from src.data.market.clob import get_orderbook, get_orderbooks_batch

book = await get_orderbook(token_id)
# Returns: {"bids": [{"price": "0.65", "size": "100"}, ...], "asks": [...]}

# Batch fetch (concurrent via asyncio.gather)
books = await get_orderbooks_batch([token1, token2, token3])
```

## Authentication

### Two-Level System

**L1 Auth** — Used to derive API credentials from your Ethereum wallet:
1. Sign an EIP-712 typed data message with your private key
2. Receive `apiKey`, `secret`, `passphrase`
3. This is a one-time setup step

**L2 Auth** — Used for every authenticated request:
- HMAC-SHA256 signature over: timestamp + method + path + body
- Headers: `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, `POLY_NONCE`, `POLY_API_KEY`

### Python SDK Setup

```python
from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, OrderType
from py_clob_client.order_builder.constants import BUY, SELL
import os

def create_client() -> ClobClient:
    """Create authenticated Polymarket CLOB client."""
    client = ClobClient(
        host="https://clob.polymarket.com",
        chain_id=137,  # Polygon mainnet
        key=os.environ["POLYMARKET_PRIVATE_KEY"],
        signature_type=1,  # POLY_GNOSIS_SAFE = 0, POLY_PROXY = 1, EOA = 2
        funder=os.environ.get("FUNDER_ADDRESS")  # Optional: for proxy wallets
    )
    # Derive or load API credentials
    client.set_api_creds(client.create_or_derive_api_creds())
    return client
```

### Placing Orders

```python
def place_limit_buy(client: ClobClient, token_id: str, price: float, size: float):
    """Place a GTC limit buy order. Returns order response or None in paper mode."""
    order_args = OrderArgs(
        token_id=token_id,
        price=price,       # 0.01 to 0.99
        size=size,          # in USDC
        side=BUY,
    )
    signed_order = client.create_order(order_args)

    if os.environ.get("ENABLE_LIVE_TRADING") == "true":
        return client.post_order(signed_order, OrderType.GTC)
    else:
        # Paper trading: log the order without submitting
        return {"paper": True, "order": signed_order, "would_execute": True}
```

### Batch Operations

```python
# Batch price fetch (up to 200 tokens)
prices = client.get_prices(
    token_ids=["token1", "token2", "token3"],
    side="BUY"
)

# Batch order placement (up to 15)
orders = [
    client.create_order(OrderArgs(token_id=t, price=p, size=s, side=BUY))
    for t, p, s in order_list
]
client.post_orders(orders, OrderType.GTC)
```

## WebSocket Streams

### Market Data (unauthenticated)

```python
import asyncio
import json
import websockets

async def stream_orderbook(token_ids: list[str]):
    """Stream real-time orderbook updates."""
    uri = "wss://ws-subscriptions-clob.polymarket.com/ws/market"
    async with websockets.connect(uri) as ws:
        # Subscribe to markets
        for token_id in token_ids:
            await ws.send(json.dumps({
                "type": "market",
                "assets_id": token_id
            }))

        async for message in ws:
            data = json.loads(message)
            # data contains: bids, asks, best_bid, best_ask, spread
            yield data
```

### User Data (authenticated)

```python
async def stream_user_orders(api_key: str):
    """Stream real-time order fills and updates for authenticated user."""
    uri = "wss://ws-subscriptions-clob.polymarket.com/ws/user"
    async with websockets.connect(uri, extra_headers={
        "POLY_API_KEY": api_key
    }) as ws:
        async for message in ws:
            data = json.loads(message)
            # Order fills, cancellations, position updates
            yield data
```

## Rate Limits

| Endpoint Group | Limit | Window | Behavior |
|---------------|-------|--------|----------|
| CLOB general | 9,000 | 10 seconds | Queued (Cloudflare) |
| Order placement | 3,500 burst | 10 seconds | Queued |
| Gamma API | 4,000 | 10 seconds | Queued |
| WebSocket | Connection-based | — | Max connections TBD |

**Important**: Cloudflare throttles rather than rejects — requests queue up and slow down rather than returning 429. Implement exponential backoff when response times increase:

```python
import time
from functools import wraps

def rate_limit_aware(max_retries=3, base_delay=0.5):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                start = time.monotonic()
                result = await func(*args, **kwargs)
                elapsed = time.monotonic() - start

                # If response took >2s, we're likely being throttled
                if elapsed > 2.0 and attempt < max_retries - 1:
                    delay = base_delay * (2 ** attempt)
                    await asyncio.sleep(delay)
                    continue
                return result
            return result
        return wrapper
    return decorator
```

## Fee Structure

- **Makers: 0% fee** (placing limit orders on the book)
- **Takers: variable** based on probability distance from 50%
- Formula: `fee = feeRate × price^exponent × (1-price)^exponent × shares`
- Weather markets peak at **1.25% taker fee** when price = 0.50
- Fee drops to near-zero at extremes (price near 0 or 1)

**Implication for strategy**: prefer limit orders (maker) over market orders (taker) to avoid fees entirely. This is a significant edge — design algorithms to post limit orders at target prices rather than taking from the book.

## Key Libraries

| Library | Purpose | Install |
|---------|---------|---------|
| `py-clob-client` | Official Polymarket SDK | `pip install py-clob-client` |
| `httpx` | Async HTTP for Gamma/Data API | `pip install httpx` |
| `websockets` | WebSocket streaming | `pip install websockets` |
| `web3` | Ethereum wallet operations | `pip install web3` |

## Common Patterns

### Market → Token ID Resolution

Every market has a `condition_id` (from Gamma) and two `token_id`s (YES and NO). You trade token_ids:

```python
async def resolve_market_tokens(condition_id: str) -> dict:
    """Get YES/NO token IDs for a market."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"https://gamma-api.polymarket.com/markets/{condition_id}")
        market = resp.json()
        return {
            "yes_token": next(t["token_id"] for t in market["tokens"] if t["outcome"] == "Yes"),
            "no_token": next(t["token_id"] for t in market["tokens"] if t["outcome"] == "No"),
            "question": market["question"],
            "end_date": market["end_date_iso"],
        }
```

### Price Monitoring Loop

```python
async def monitor_prices(token_ids: list[str], interval: float = 30.0):
    """Poll prices at regular intervals. Use for cron-job / serverless contexts."""
    async with httpx.AsyncClient() as client:
        while True:
            prices = {}
            for tid in token_ids:
                resp = await client.get(
                    "https://clob.polymarket.com/price",
                    params={"token_id": tid, "side": "BUY"}
                )
                prices[tid] = float(resp.json()["price"])
            yield prices
            await asyncio.sleep(interval)
```

## Safety Rules

1. **Never hardcode private keys** — always read from environment variables
2. **Paper mode is default** — `client.post_order()` must be gated behind explicit live flag
3. **Validate token_ids** before every order — confirm they match the intended market
4. **Check market status** (active, not closed/archived) before placing orders
5. **Implement order size validation** — compare against position limits before submission
6. **Log every order attempt** (paper or live) with full context for audit trail
7. **Handle Cloudflare throttling** — implement backoff when latency spikes
