"""Bayesian updating strategy — trades on recency-weighted model divergence.

Edge: The most recently updated model (ECMWF: 2x/day, GFS/ICON: 4x/day) is
given higher weight. If the recency-weighted probability strongly disagrees
with the market price, there is an arbitrage window before the market catches
up to the new run.
"""

import logging
import re
from datetime import date, datetime
from typing import Any, Optional

from src.trading.strategies.base import TradingStrategy
from src.trading.strategies.weather_temp import KNOWN_CITIES
from src.data.market.gamma import find_weather_markets
from src.data.market.clob import get_price
from src.data.weather.open_meteo import fetch_multi_model_ensemble
from src.data.weather.probability import daily_max_probability

logger = logging.getLogger(__name__)

# Models and their update frequency (runs/day) — higher = more recent data
MODEL_RECENCY_WEIGHTS: dict[str, float] = {
    "ecmwf_ifs025_ensemble": 2.0,   # 00 + 12 UTC
    "gfs_seamless_eps": 4.0,        # 00, 06, 12, 18 UTC
    "icon_seamless_eps": 4.0,       # 00, 06, 12, 18 UTC
}

MIN_EDGE = 0.08
KELLY_FRACTION = 0.25

# Celsius-aware regex patterns (supplement the Fahrenheit patterns in weather_temp.py)
_CELSIUS_ABOVE = re.compile(
    r"(?:will|does)\s+(?:the\s+)?(?:high\s+)?(?:temperature\s+(?:in\s+)?)?(\w[\w\s]*?)\s+"
    r"(?:temperature\s+)?(?:exceed|reach|be\s+above|surpass|go\s+above|hit|top)\s+"
    r"(-?\d+(?:\.\d+)?)\s*°?\s*[Cc]\w*"
    r".*?(?:on|by)\s+([\w\s,]+\d+)",
    re.IGNORECASE,
)
_CELSIUS_BELOW = re.compile(
    r"(?:will|does)\s+(?:the\s+)?(?:high\s+)?(?:temperature\s+(?:in\s+)?)?(\w[\w\s]*?)\s+"
    r"(?:temperature\s+)?(?:stay\s+below|remain\s+under|be\s+below|drop\s+below|fall\s+below)\s+"
    r"(-?\d+(?:\.\d+)?)\s*°?\s*[Cc]\w*"
    r".*?(?:on|by)\s+([\w\s,]+\d+)",
    re.IGNORECASE,
)
_BELOW_KEYWORDS = {"below", "under", "lower", "drop", "fall"}


def _parse_date_string(date_str: str) -> Optional[date]:
    """Try to parse a date string in various common formats."""
    date_str = date_str.strip().rstrip("?").strip()
    formats = [
        "%B %d, %Y",
        "%B %d %Y",
        "%B %d",
        "%b %d, %Y",
        "%b %d %Y",
        "%b %d",
        "%m/%d/%Y",
        "%m/%d",
        "%Y-%m-%d",
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


def parse_market_question(question: str) -> Optional[dict[str, Any]]:
    """Parse a weather temperature market question supporting both °C and °F.

    Returns dict with city, lat, lon, threshold (°C float), direction,
    target_date — or None if unparseable.
    """
    from src.trading.strategies.weather_temp import parse_market_question as _parse_f

    # Try the existing Fahrenheit parser first
    result = _parse_f(question)
    if result is not None:
        # Convert °F threshold to °C for consistent internal representation
        result = dict(result)
        result["threshold"] = (result["threshold"] - 32) * 5 / 9
        return result

    # Try Celsius patterns
    for pattern, direction_hint in ((_CELSIUS_ABOVE, "above"), (_CELSIUS_BELOW, "below")):
        match = pattern.search(question)
        if not match:
            continue

        city_raw = match.group(1).strip().lower()
        threshold = float(match.group(2))
        date_str = match.group(3).strip()

        # Resolve city
        lat, lon = None, None
        city_found = None
        for city_key, (clat, clon) in KNOWN_CITIES.items():
            if city_key in city_raw or city_raw in city_key:
                lat, lon = clat, clon
                city_found = city_key
                break

        if lat is None:
            return None

        # Determine direction
        question_lower = question.lower()
        direction = direction_hint
        for kw in _BELOW_KEYWORDS:
            if kw in question_lower:
                direction = "below"
                break

        target_date = _parse_date_string(date_str)
        if target_date is None:
            return None

        return {
            "city": city_found or city_raw,
            "lat": lat,
            "lon": lon,
            "threshold": threshold,
            "direction": direction,
            "target_date": target_date,
        }

    return None


class WeatherBayesianStrategy(TradingStrategy):
    """Bayesian updating strategy using recency-weighted ensemble probabilities."""

    @property
    def name(self) -> str:
        return "weather_bayesian"

    @property
    def category(self) -> str:
        return "weather"

    async def find_markets(self) -> list[dict[str, Any]]:
        return await find_weather_markets()

    async def generate_signal(self, market: dict[str, Any]) -> Optional[dict[str, Any]]:
        parsed = parse_market_question(market.get("question", ""))
        if parsed is None:
            return None

        lat: float = parsed["lat"]
        lon: float = parsed["lon"]
        threshold: float = parsed["threshold"]
        direction: str = parsed["direction"]
        target_date: date = parsed["target_date"]

        try:
            ensemble_data = await fetch_multi_model_ensemble(
                lat=lat,
                lon=lon,
                variable="temperature_2m",
            )
            market_price = await get_price(market["condition_id"])
        except Exception:
            logger.exception("Data fetch failed for market %s", market.get("condition_id"))
            return None

        if market_price is None:
            return None

        model_probs: dict[str, float] = {}
        total_weight = 0.0
        weighted_sum = 0.0

        for model_name, weight in MODEL_RECENCY_WEIGHTS.items():
            model_data = ensemble_data.get(model_name)
            if not model_data:
                continue
            # Support both "temperature_2m" (actual API) and "temperature_2m_max" (tests)
            hourly_ensemble = model_data.get("temperature_2m") or model_data.get(
                "temperature_2m_max"
            )
            times = model_data.get("time", [])
            if hourly_ensemble is None:
                continue
            prob = daily_max_probability(
                hourly_ensemble,
                times=times,
                target_date=target_date,
                threshold=threshold,
                direction=direction,
            )
            model_probs[model_name] = prob
            weighted_sum += prob * weight
            total_weight += weight

        if total_weight == 0:
            return None

        our_probability = weighted_sum / total_weight
        edge = our_probability - market_price

        if abs(edge) < MIN_EDGE:
            return None

        side = "YES" if edge > 0 else "NO"
        if abs(edge) >= 0.15:
            confidence = "high"
        elif abs(edge) >= 0.10:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "strategy": self.name,
            "market_id": market["condition_id"],
            "our_probability": our_probability,
            "market_price": market_price,
            "edge": edge,
            "side": side,
            "confidence": confidence,
            "reasoning": (
                f"Recency-weighted probability {our_probability:.1%} vs "
                f"market {market_price:.1%} (edge {edge:+.1%}). "
                f"Model breakdown: "
                + ", ".join(f"{m}={p:.1%}" for m, p in model_probs.items())
            ),
            "model_breakdown": model_probs,
        }

    async def backtest(self, start_date: date, end_date: date) -> dict[str, Any]:
        return {
            "total_trades": 0,
            "win_rate": None,
            "pnl": 0.0,
            "brier_score": None,
            "max_drawdown": 0.0,
            "sharpe_ratio": None,
        }
