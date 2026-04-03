from typing import Optional

import httpx

from src.data.market.gamma import GAMMA_API_URL, WEATHER_TAG_ID, WEATHER_KEYWORDS

EUROPEAN_CAPITALS: dict[str, tuple[float, float]] = {
    "amsterdam": (52.37, 4.90),
    "london": (51.51, -0.13),
    "paris": (48.86, 2.35),
    "berlin": (52.52, 13.41),
    "madrid": (40.42, -3.70),
    "rome": (41.90, 12.50),
    "lisbon": (38.72, -9.14),
    "brussels": (50.85, 4.35),
    "vienna": (48.21, 16.37),
    "zurich": (47.38, 8.54),
    "stockholm": (59.33, 18.07),
    "copenhagen": (55.68, 12.57),
    "oslo": (59.91, 10.75),
    "helsinki": (60.17, 24.94),
    "warsaw": (52.23, 21.01),
    "prague": (50.08, 14.44),
    "budapest": (47.50, 19.04),
    "athens": (37.98, 23.73),
    "dublin": (53.35, -6.26),
    "bucharest": (44.43, 26.10),
}

US_CITIES: dict[str, tuple[float, float]] = {
    "new york": (40.71, -74.01),
    "nyc": (40.71, -74.01),
    "chicago": (41.88, -87.63),
    "los angeles": (34.05, -118.24),
    "miami": (25.76, -80.19),
    "houston": (29.76, -95.37),
    "dallas": (32.78, -96.80),
    "phoenix": (33.45, -112.07),
    "denver": (39.74, -104.99),
    "seattle": (47.61, -122.33),
    "boston": (42.36, -71.06),
    "atlanta": (33.75, -84.39),
    "san francisco": (37.77, -122.42),
    "washington": (38.91, -77.04),
    "philadelphia": (39.95, -75.17),
    "minneapolis": (44.98, -93.27),
}

_CITY_DISPLAY_NAMES: dict[str, str] = {
    "nyc": "New York",
    "new york": "New York",
    "los angeles": "Los Angeles",
    "san francisco": "San Francisco",
    "washington": "Washington D.C.",
}

_WEATHER_TERMS = {
    "temperature", "weather", "rain", "snow", "heat", "cold",
    "storm", "wind", "frost", "degree", "celsius", "fahrenheit", "°",
}


def classify_market_city(question: str) -> Optional[dict]:
    """Parse a market question to extract city and region.

    Returns {"city": str, "region": str, "lat": float, "lon": float} or None.
    """
    q_lower = question.lower()

    for city_key, (lat, lon) in EUROPEAN_CAPITALS.items():
        if city_key in q_lower:
            return {
                "city": city_key.title(),
                "region": "europe",
                "lat": lat,
                "lon": lon,
            }

    for city_key, (lat, lon) in US_CITIES.items():
        if city_key in q_lower:
            display = _CITY_DISPLAY_NAMES.get(city_key, city_key.title())
            return {
                "city": display,
                "region": "north_america",
                "lat": lat,
                "lon": lon,
            }

    return None


async def find_all_weather_markets() -> list[dict]:
    """Find all weather markets: by tag, by keywords, and by European city names.

    Returns deduplicated list of market dicts, each enriched with
    'classified_city' and 'classified_region' if a city was detected.
    """
    seen_ids: set[str] = set()
    markets: list[dict] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 1. Search by weather tag
        try:
            resp = await client.get(
                f"{GAMMA_API_URL}/markets",
                params={"tag_id": WEATHER_TAG_ID, "closed": "false", "limit": 100},
            )
            resp.raise_for_status()
            tag_results = resp.json()
            if isinstance(tag_results, list):
                for m in tag_results:
                    mid = m.get("condition_id") or m.get("id", "")
                    if mid and mid not in seen_ids:
                        seen_ids.add(mid)
                        markets.append(m)
        except httpx.HTTPError:
            pass

        # 2. Search by weather keywords
        for keyword in WEATHER_KEYWORDS:
            try:
                resp = await client.get(
                    f"{GAMMA_API_URL}/markets",
                    params={"closed": "false", "limit": 50, "_q": keyword},
                )
                resp.raise_for_status()
                keyword_results = resp.json()
                if isinstance(keyword_results, list):
                    for m in keyword_results:
                        mid = m.get("condition_id") or m.get("id", "")
                        if mid and mid not in seen_ids:
                            seen_ids.add(mid)
                            markets.append(m)
            except httpx.HTTPError:
                continue

        # 3. Search by European capital names (filter to weather-related only)
        for city_name in EUROPEAN_CAPITALS:
            try:
                resp = await client.get(
                    f"{GAMMA_API_URL}/markets",
                    params={"closed": "false", "limit": 20, "_q": city_name},
                )
                resp.raise_for_status()
                city_results = resp.json()
                if isinstance(city_results, list):
                    for m in city_results:
                        mid = m.get("condition_id") or m.get("id", "")
                        if mid and mid not in seen_ids:
                            question = m.get("question", "").lower()
                            if any(term in question for term in _WEATHER_TERMS):
                                seen_ids.add(mid)
                                markets.append(m)
            except httpx.HTTPError:
                continue

    # Classify each market
    for m in markets:
        question = m.get("question", "")
        classification = classify_market_city(question)
        if classification:
            m["classified_city"] = classification["city"]
            m["classified_region"] = classification["region"]

    return markets
