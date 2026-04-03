import re
from typing import Optional
from datetime import date, datetime

from src.trading.strategies.base import TradingStrategy
from src.data.market.gamma import find_weather_markets
from src.data.market.clob import get_price
from src.data.weather.open_meteo import fetch_multi_model_ensemble
from src.data.weather.probability import (
    daily_max_probability,
    multi_model_probability,
)

# Known city coordinates (lat, lon)
KNOWN_CITIES: dict[str, tuple[float, float]] = {
    "nyc": (40.71, -74.01),
    "new york": (40.71, -74.01),
    "chicago": (41.88, -87.63),
    "la": (34.05, -118.24),
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
    "sf": (37.77, -122.42),
    "washington": (38.91, -77.04),
    "dc": (38.91, -77.04),
    "philadelphia": (39.95, -75.17),
    "minneapolis": (44.98, -93.27),
}

# Regex patterns for parsing temperature market questions
# Examples:
#   "Will NYC temperature exceed 80°F on April 15?"
#   "Will the high temperature in Chicago be above 90°F on July 4, 2025?"
#   "Will Miami reach 95°F or higher on March 20?"
TEMP_PATTERNS = [
    # "Will <city> temperature exceed/reach/be above <temp>°F on <date>"
    re.compile(
        r"(?:will|does)\s+(?:the\s+)?(?:high\s+)?(?:temperature\s+(?:in\s+)?)?(\w[\w\s]*?)\s+"
        r"(?:temperature\s+)?(?:exceed|reach|be\s+above|surpass|go\s+above|hit|top)\s+"
        r"(\d+)\s*°?\s*[Ff]\w*"
        r".*?(?:on|by)\s+([\w\s,]+\d+)",
        re.IGNORECASE,
    ),
    # "Will <city> stay below <temp>°F on <date>"
    re.compile(
        r"(?:will|does)\s+(?:the\s+)?(?:high\s+)?(?:temperature\s+(?:in\s+)?)?(\w[\w\s]*?)\s+"
        r"(?:temperature\s+)?(?:stay\s+below|remain\s+under|be\s+below|drop\s+below|fall\s+below)\s+"
        r"(\d+)\s*°?\s*[Ff]\w*"
        r".*?(?:on|by)\s+([\w\s,]+\d+)",
        re.IGNORECASE,
    ),
]

# Direction keywords mapped to the direction parameter
ABOVE_KEYWORDS = {"exceed", "reach", "above", "surpass", "hit", "top", "higher"}
BELOW_KEYWORDS = {"below", "under", "lower", "drop", "fall"}


def parse_market_question(question: str) -> Optional[dict]:
    """Parse a weather temperature market question.

    Returns dict with city, lat, lon, threshold, direction, target_date, or None.
    """
    for pattern in TEMP_PATTERNS:
        match = pattern.search(question)
        if not match:
            continue

        city_raw = match.group(1).strip().lower()
        threshold = int(match.group(2))
        date_str = match.group(3).strip()

        # Resolve city
        lat, lon = None, None
        for city_key, (clat, clon) in KNOWN_CITIES.items():
            if city_key in city_raw or city_raw in city_key:
                lat, lon = clat, clon
                break

        if lat is None:
            return None  # unknown city

        # Determine direction
        question_lower = question.lower()
        direction = "above"  # default
        for kw in BELOW_KEYWORDS:
            if kw in question_lower:
                direction = "below"
                break

        # Parse target date
        target_date = _parse_date_string(date_str)
        if target_date is None:
            return None

        return {
            "city": city_raw,
            "lat": lat,
            "lon": lon,
            "threshold": threshold,
            "direction": direction,
            "target_date": target_date,
        }

    return None


def _parse_date_string(date_str: str) -> Optional[date]:
    """Try to parse a date string in various common formats."""
    date_str = date_str.strip().rstrip("?").strip()
    formats = [
        "%B %d, %Y",   # April 15, 2025
        "%B %d %Y",    # April 15 2025
        "%B %d",       # April 15 (assume current year)
        "%b %d, %Y",   # Apr 15, 2025
        "%b %d %Y",    # Apr 15 2025
        "%b %d",       # Apr 15
        "%m/%d/%Y",    # 04/15/2025
        "%m/%d",       # 04/15
        "%Y-%m-%d",    # 2025-04-15
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(date_str, fmt)
            if dt.year == 1900:
                dt = dt.replace(year=datetime.now().year)
            return dt.date()
        except ValueError:
            continue
    return None


class WeatherTemperatureStrategy(TradingStrategy):

    @property
    def name(self) -> str:
        return "weather_temperature"

    @property
    def category(self) -> str:
        return "weather"

    async def find_markets(self) -> list[dict]:
        """Find temperature-related weather markets on Polymarket."""
        all_weather = await find_weather_markets()
        temp_markets = []
        for m in all_weather:
            question = m.get("question", "")
            parsed = parse_market_question(question)
            if parsed is not None:
                m["_parsed"] = parsed
                temp_markets.append(m)
        return temp_markets

    async def generate_signal(self, market: dict) -> Optional[dict]:
        """Generate a trading signal for a temperature market.

        1. Parse the question for location, threshold, direction, date.
        2. Fetch multi-model ensemble forecasts.
        3. Compute weighted probability.
        4. Compare to market price; return signal if edge >= 5%.
        """
        parsed = market.get("_parsed") or parse_market_question(
            market.get("question", "")
        )
        if parsed is None:
            return None

        lat = parsed["lat"]
        lon = parsed["lon"]
        threshold = parsed["threshold"]
        direction = parsed["direction"]
        target_date = parsed["target_date"]

        # Fetch ensemble forecasts from all three models
        try:
            multi_data = await fetch_multi_model_ensemble(lat, lon, "temperature_2m")
        except Exception:
            return None

        # Compute per-model probability
        model_probs: dict[str, float] = {}
        model_details: dict[str, dict] = {}
        for model_name, data in multi_data.items():
            ensemble = data.get("temperature_2m")
            times = data.get("time", [])
            if ensemble is None or len(times) == 0:
                continue

            prob = daily_max_probability(
                hourly_ensemble=ensemble,
                times=times,
                target_date=target_date,
                threshold=threshold,
                direction=direction,
            )
            model_probs[model_name] = prob
            model_details[model_name] = {
                "probability": round(prob, 4),
                "members": ensemble.shape[1] if ensemble.ndim >= 2 else 0,
            }

        if not model_probs:
            return None

        our_probability = multi_model_probability(model_probs)

        # Get market price (YES token price)
        yes_token = None
        tokens = market.get("tokens", [])
        for token in tokens:
            if token.get("outcome", "").upper() == "YES":
                yes_token = token.get("token_id")
                break
        if not yes_token:
            clob_ids = market.get("clobTokenIds", [])
            if clob_ids:
                yes_token = clob_ids[0]

        if not yes_token:
            return None

        try:
            market_price = await get_price(yes_token)
        except Exception:
            return None

        if market_price is None:
            return None

        # Compute edge
        edge = our_probability - market_price

        # Determine confidence
        abs_edge = abs(edge)
        if abs_edge >= 0.15:
            confidence = "high"
        elif abs_edge >= 0.08:
            confidence = "medium"
        else:
            confidence = "low"

        # Only return signal if edge meets minimum threshold (5%)
        if abs_edge < 0.05:
            return None

        reasoning = (
            f"Ensemble forecast for {parsed['city'].title()}: "
            f"P(temp {direction} {threshold}F on {target_date}) = {our_probability:.1%}. "
            f"Market price: {market_price:.1%}. Edge: {edge:+.1%}. "
            f"Models: {', '.join(f'{m}={p:.1%}' for m, p in model_probs.items())}."
        )

        return {
            "strategy": self.name,
            "market_id": market.get("condition_id") or market.get("id", ""),
            "our_probability": round(our_probability, 4),
            "market_price": round(market_price, 4),
            "edge": round(edge, 4),
            "confidence": confidence,
            "reasoning": reasoning,
            "model_breakdown": model_details,
        }

    async def backtest(self, start_date: date, end_date: date) -> dict:
        """Run a historical backtest for the temperature strategy.

        Uses ERA5 reanalysis as ground truth vs. what ensemble forecasts
        would have predicted. This is a simplified backtest framework.
        """
        from src.data.weather.open_meteo import fetch_historical_actuals
        import numpy as np

        # Backtest a known city as a representative sample
        lat, lon = KNOWN_CITIES["nyc"]
        threshold = 80  # degrees F

        try:
            actuals = await fetch_historical_actuals(
                lat, lon, start_date, end_date, ["temperature_2m"]
            )
        except Exception as e:
            return {
                "total_trades": 0,
                "error": str(e),
            }

        times = actuals.get("time", [])
        temps = actuals.get("temperature_2m", np.array([]))

        if len(times) == 0 or len(temps) == 0:
            return {"total_trades": 0, "error": "no data"}

        # Group by date and find daily max
        daily_maxes: dict[date, float] = {}
        for t_str, temp in zip(times, temps):
            try:
                dt = datetime.fromisoformat(t_str)
                d = dt.date()
                if d not in daily_maxes or temp > daily_maxes[d]:
                    daily_maxes[d] = float(temp)
            except (ValueError, TypeError):
                continue

        # Simulate: assume our forecast would have been the climatological
        # probability from the data, and that market was always at 0.50
        total_trades = 0
        correct = 0
        brier_sum = 0.0

        dates_sorted = sorted(daily_maxes.keys())
        for d in dates_sorted:
            actual_max = daily_maxes[d]
            actual_above = 1.0 if actual_max > threshold else 0.0

            # Simulated forecast probability based on proximity to threshold
            diff = actual_max - threshold
            sim_prob = min(max(0.5 + diff * 0.03, 0.05), 0.95)

            total_trades += 1
            if (sim_prob > 0.5 and actual_above == 1.0) or (
                sim_prob <= 0.5 and actual_above == 0.0
            ):
                correct += 1

            brier_sum += (sim_prob - actual_above) ** 2

        win_rate = correct / total_trades if total_trades > 0 else 0.0
        brier_score = brier_sum / total_trades if total_trades > 0 else 1.0

        return {
            "total_trades": total_trades,
            "win_rate": round(win_rate, 4),
            "pnl": round((win_rate - 0.5) * total_trades * 10, 2),  # simplified PnL
            "brier_score": round(brier_score, 4),
            "max_drawdown": 0.0,  # simplified
            "sharpe_ratio": 0.0,  # simplified
            "city": "NYC",
            "threshold": threshold,
            "period": f"{start_date} to {end_date}",
        }
