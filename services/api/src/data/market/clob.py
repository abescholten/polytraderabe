import httpx
from typing import Optional

CLOB_BASE_URL = "https://clob.polymarket.com"


async def get_price(token_id: str, side: str = "BUY") -> Optional[float]:
    """Get the current price for a single token.

    Args:
        token_id: The CLOB token ID.
        side: 'BUY' or 'SELL'.

    Returns:
        Price as float in [0, 1], or None if unavailable.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{CLOB_BASE_URL}/price",
            params={"token_id": token_id, "side": side},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        price_str = data.get("price")
        if price_str is not None:
            return float(price_str)
        return None


async def get_prices(
    token_ids: list[str], side: str = "BUY"
) -> dict[str, Optional[float]]:
    """Get prices for multiple tokens in batch (up to 200 at a time).

    Args:
        token_ids: List of CLOB token IDs.
        side: 'BUY' or 'SELL'.

    Returns:
        Dict mapping token_id to price (or None if unavailable).
    """
    results: dict[str, Optional[float]] = {}

    # Process in batches of 200
    for batch_start in range(0, len(token_ids), 200):
        batch = token_ids[batch_start : batch_start + 200]

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{CLOB_BASE_URL}/prices",
                params={"token_ids": ",".join(batch), "side": side},
            )
            if resp.status_code != 200:
                for tid in batch:
                    results[tid] = None
                continue

            data = resp.json()
            # Response is a dict of token_id -> price string
            for tid in batch:
                price_str = data.get(tid, {}).get("price") if isinstance(data.get(tid), dict) else data.get(tid)
                if price_str is not None:
                    try:
                        results[tid] = float(price_str)
                    except (ValueError, TypeError):
                        results[tid] = None
                else:
                    results[tid] = None

    return results


async def get_price_history(
    condition_id: str,
    interval: str = "1h",
    fidelity: int = 60,
) -> list[dict]:
    """Get price history for a market.

    Args:
        condition_id: The market condition ID.
        interval: Time interval ('1m', '5m', '1h', '1d').
        fidelity: Number of data points to return.

    Returns:
        List of dicts with 't' (timestamp) and 'p' (price) keys.
    """
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{CLOB_BASE_URL}/prices-history",
            params={
                "market": condition_id,
                "interval": interval,
                "fidelity": fidelity,
            },
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        if isinstance(data, dict):
            return data.get("history", [])
        if isinstance(data, list):
            return data
        return []
