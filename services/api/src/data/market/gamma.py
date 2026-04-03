import httpx
from typing import Optional

GAMMA_API_URL = "https://gamma-api.polymarket.com"

WEATHER_TAG_ID = "100381"
WEATHER_KEYWORDS = [
    "temperature",
    "weather",
    "rain",
    "snow",
    "heat",
    "cold",
    "hurricane",
    "storm",
]


async def find_weather_markets() -> list[dict]:
    """Search for weather-related markets on Polymarket via the Gamma API.

    Uses tag_id 100381 and keyword searches to find weather markets.
    Returns a deduplicated list of market dicts.
    """
    seen_ids: set[str] = set()
    markets: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        # First: search by tag
        try:
            resp = await client.get(
                f"{GAMMA_API_URL}/markets",
                params={
                    "tag_id": WEATHER_TAG_ID,
                    "closed": "false",
                    "limit": 100,
                },
            )
            resp.raise_for_status()
            tag_results = resp.json()
            if isinstance(tag_results, list):
                for m in tag_results:
                    mid = m.get("id") or m.get("condition_id", "")
                    if mid and mid not in seen_ids:
                        seen_ids.add(mid)
                        markets.append(m)
        except httpx.HTTPError:
            pass  # tag search failed, continue with keyword search

        # Second: search by keywords
        for keyword in WEATHER_KEYWORDS:
            try:
                resp = await client.get(
                    f"{GAMMA_API_URL}/markets",
                    params={
                        "closed": "false",
                        "limit": 50,
                        "_q": keyword,
                    },
                )
                resp.raise_for_status()
                keyword_results = resp.json()
                if isinstance(keyword_results, list):
                    for m in keyword_results:
                        mid = m.get("id") or m.get("condition_id", "")
                        if mid and mid not in seen_ids:
                            seen_ids.add(mid)
                            markets.append(m)
            except httpx.HTTPError:
                continue

    return markets


async def get_market_detail(condition_id: str) -> Optional[dict]:
    """Get detailed information for a single market by condition ID."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{GAMMA_API_URL}/markets/{condition_id}")
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        return resp.json()


async def resolve_market_tokens(condition_id: str) -> Optional[dict]:
    """Resolve a market's token IDs and metadata.

    Returns dict with yes_token, no_token, question, end_date, or None if not found.
    """
    market = await get_market_detail(condition_id)
    if not market:
        return None

    # Gamma API returns tokens in different formats depending on market type
    tokens = market.get("tokens", [])
    yes_token = None
    no_token = None

    for token in tokens:
        outcome = token.get("outcome", "").upper()
        token_id = token.get("token_id", "")
        if outcome == "YES":
            yes_token = token_id
        elif outcome == "NO":
            no_token = token_id

    # Fallback: if tokens list is empty, check clobTokenIds
    if not yes_token and not no_token:
        clob_ids = market.get("clobTokenIds", [])
        if len(clob_ids) >= 2:
            yes_token = clob_ids[0]
            no_token = clob_ids[1]
        elif len(clob_ids) == 1:
            yes_token = clob_ids[0]

    return {
        "yes_token": yes_token,
        "no_token": no_token,
        "question": market.get("question", ""),
        "end_date": market.get("end_date_iso") or market.get("endDate"),
        "condition_id": condition_id,
    }
