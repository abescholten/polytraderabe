# services/api/tests/test_weather_bayesian.py
from unittest.mock import AsyncMock, patch
from datetime import date

import pytest

from src.trading.strategies.weather_bayesian import WeatherBayesianStrategy


@pytest.fixture
def strategy() -> WeatherBayesianStrategy:
    return WeatherBayesianStrategy()


def test_name(strategy: WeatherBayesianStrategy) -> None:
    assert strategy.name == "weather_bayesian"


def test_category(strategy: WeatherBayesianStrategy) -> None:
    assert strategy.category == "weather"


@pytest.mark.asyncio
async def test_generate_signal_returns_none_when_no_edge(
    strategy: WeatherBayesianStrategy,
) -> None:
    """No signal when model probability is close to market price."""
    market = {
        "condition_id": "abc123",
        "question": "Will Amsterdam temperature exceed 18°C on April 10?",
    }
    with (
        patch(
            "src.trading.strategies.weather_bayesian.get_price",
            new_callable=AsyncMock,
            return_value=0.60,
        ),
        patch(
            "src.trading.strategies.weather_bayesian.fetch_multi_model_ensemble",
            new_callable=AsyncMock,
            return_value={
                "ecmwf_ifs025_ensemble": {"temperature_2m_max": [[18.2] * 51]},
                "gfs_seamless_eps": {"temperature_2m_max": [[18.1] * 31]},
                "icon_seamless_eps": {"temperature_2m_max": [[18.0] * 40]},
            },
        ),
        patch(
            "src.trading.strategies.weather_bayesian.daily_max_probability",
            return_value=0.62,
        ),
    ):
        # market price 60%, model says ~62% → edge <8%, no signal
        signal = await strategy.generate_signal(market)
        assert signal is None


@pytest.mark.asyncio
async def test_generate_signal_returns_signal_when_edge_exists(
    strategy: WeatherBayesianStrategy,
) -> None:
    """Signal returned when strong model divergence from market exists."""
    market = {
        "condition_id": "abc123",
        "question": "Will Amsterdam temperature exceed 15°C on April 10?",
    }
    with (
        patch(
            "src.trading.strategies.weather_bayesian.get_price",
            new_callable=AsyncMock,
            return_value=0.40,
        ),
        patch(
            "src.trading.strategies.weather_bayesian.fetch_multi_model_ensemble",
            new_callable=AsyncMock,
            return_value={
                "ecmwf_ifs025_ensemble": {"temperature_2m_max": [[16.0] * 51]},
                "gfs_seamless_eps": {"temperature_2m_max": [[16.0] * 31]},
                "icon_seamless_eps": {"temperature_2m_max": [[16.0] * 40]},
            },
        ),
        patch(
            "src.trading.strategies.weather_bayesian.daily_max_probability",
            return_value=0.90,
        ),
    ):
        signal = await strategy.generate_signal(market)
        assert signal is not None
        assert signal["strategy"] == "weather_bayesian"
        assert signal["edge"] > 0.08
        assert signal["our_probability"] > 0.80
        assert "reasoning" in signal


@pytest.mark.asyncio
async def test_generate_signal_returns_none_for_unparseable_market(
    strategy: WeatherBayesianStrategy,
) -> None:
    """No signal for markets the strategy cannot parse."""
    market = {
        "condition_id": "xyz",
        "question": "Will Bitcoin exceed $100,000 by end of 2025?",
    }
    signal = await strategy.generate_signal(market)
    assert signal is None


@pytest.mark.asyncio
async def test_backtest_returns_required_keys(strategy: WeatherBayesianStrategy) -> None:
    result = await strategy.backtest(date(2025, 1, 1), date(2025, 3, 31))
    for key in ("total_trades", "win_rate", "pnl", "brier_score", "max_drawdown", "sharpe_ratio"):
        assert key in result
