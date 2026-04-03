from src.trading.strategies.base import TradingStrategy
from src.trading.strategies.weather_temp import WeatherTemperatureStrategy


def get_all_strategies() -> list[TradingStrategy]:
    """Return all registered trading strategies."""
    return [
        WeatherTemperatureStrategy(),
    ]
