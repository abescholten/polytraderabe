from unittest.mock import MagicMock, patch
from datetime import date, datetime, timezone

import pytest

from src.trading.strategies.weather_momentum import _compute_momentum, WeatherMomentumStrategy


@pytest.fixture
def strategy() -> WeatherMomentumStrategy:
    return WeatherMomentumStrategy()


def test_name(strategy: WeatherMomentumStrategy) -> None:
    assert strategy.name == "weather_momentum"


def test_category(strategy: WeatherMomentumStrategy) -> None:
    assert strategy.category == "weather"


def make_snapshots(prices: list[float]) -> list[dict]:
    """Build fake orderbook snapshot rows with ascending timestamps."""
    now = datetime(2025, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    return [
        {
            "market_id": "abc123",
            "best_bid": p - 0.01,
            "best_ask": p + 0.01,
            "mid_price": p,
            "created_at": now.replace(hour=i).isoformat(),
        }
        for i, p in enumerate(prices)
    ]


def test_compute_momentum_too_few_prices() -> None:
    assert _compute_momentum([]) == (None, 0.0)
    assert _compute_momentum([0.5]) == (None, 0.0)
    assert _compute_momentum([0.5, 0.6]) == (None, 0.0)


def test_compute_momentum_detects_upward() -> None:
    direction, mag = _compute_momentum([0.40, 0.45, 0.50, 0.55, 0.60, 0.68])
    assert direction == "up"
    assert abs(mag - 0.28) < 1e-9


def test_compute_momentum_detects_downward() -> None:
    direction, mag = _compute_momentum([0.70, 0.65, 0.58, 0.50, 0.42, 0.35])
    assert direction == "down"
    assert abs(mag - 0.35) < 1e-9


def test_compute_momentum_below_min_move() -> None:
    # All steps up but total move < MIN_MOVE (0.05)
    assert _compute_momentum([0.50, 0.51, 0.52, 0.53])[0] is None


def test_compute_momentum_mixed_signal() -> None:
    # 3 up, 2 down in 5 steps = 60% < MIN_MONOTONE_RATIO(80%)
    assert _compute_momentum([0.40, 0.50, 0.45, 0.55, 0.50, 0.60])[0] is None


@pytest.mark.asyncio
async def test_generate_signal_returns_none_for_non_weather_market(
    strategy: WeatherMomentumStrategy,
) -> None:
    market = {
        "condition_id": "xyz",
        "question": "Will Bitcoin exceed $100,000 by end of 2025?",
    }
    signal = await strategy.generate_signal(market)
    assert signal is None


@pytest.mark.asyncio
async def test_generate_signal_returns_none_when_no_momentum(
    strategy: WeatherMomentumStrategy,
) -> None:
    """No signal when price moves sideways (no sustained direction)."""
    market = {
        "condition_id": "abc123",
        "question": "Will Amsterdam temperature exceed 18°F on April 10?",
    }
    # Flat price — no momentum (reversed: DB returns newest-first)
    snapshots = list(reversed(make_snapshots([0.50, 0.51, 0.50, 0.49, 0.50, 0.51])))
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = snapshots

    with patch("src.trading.strategies.weather_momentum.get_supabase", return_value=mock_db):
        signal = await strategy.generate_signal(market)
        assert signal is None
        mock_db.table.assert_called_once_with("orderbook_snapshots")


@pytest.mark.asyncio
async def test_generate_signal_returns_buy_on_upward_momentum(
    strategy: WeatherMomentumStrategy,
) -> None:
    """Signal: buy YES when prices are consistently rising."""
    market = {
        "condition_id": "abc123",
        "question": "Will Amsterdam temperature exceed 18°F on April 10?",
    }
    # Rising prices: 40% → 55% → 68% (reversed: DB returns newest-first)
    snapshots = list(reversed(make_snapshots([0.40, 0.45, 0.50, 0.55, 0.60, 0.68])))
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = snapshots

    with patch("src.trading.strategies.weather_momentum.get_supabase", return_value=mock_db):
        signal = await strategy.generate_signal(market)
        assert signal is not None
        assert signal["strategy"] == "weather_momentum"
        assert signal["side"] == "YES"
        assert signal["edge"] > 0
        for key in ("strategy", "market_id", "our_probability", "market_price", "edge", "side", "confidence", "reasoning", "model_breakdown"):
            assert key in signal
        mock_db.table.assert_called_once_with("orderbook_snapshots")


@pytest.mark.asyncio
async def test_generate_signal_returns_sell_on_downward_momentum(
    strategy: WeatherMomentumStrategy,
) -> None:
    """Signal: buy NO when prices are consistently falling."""
    market = {
        "condition_id": "abc123",
        "question": "Will Amsterdam temperature exceed 18°F on April 10?",
    }
    # Falling prices: 70% → 55% → 35% (reversed: DB returns newest-first)
    snapshots = list(reversed(make_snapshots([0.70, 0.65, 0.58, 0.50, 0.42, 0.35])))
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = snapshots

    with patch("src.trading.strategies.weather_momentum.get_supabase", return_value=mock_db):
        signal = await strategy.generate_signal(market)
        assert signal is not None
        assert signal["side"] == "NO"
        mock_db.table.assert_called_once_with("orderbook_snapshots")


@pytest.mark.asyncio
async def test_generate_signal_returns_none_at_price_extreme(
    strategy: WeatherMomentumStrategy,
) -> None:
    """No signal when current price is at extreme (>0.85)."""
    market = {
        "condition_id": "abc123",
        "question": "Will Amsterdam temperature exceed 80°F on April 10?",
    }
    # Rising prices but last price is at extreme (>0.85)
    snapshots = list(reversed(make_snapshots([0.78, 0.82, 0.86, 0.88, 0.90, 0.92])))
    mock_db = MagicMock()
    mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = snapshots

    with patch("src.trading.strategies.weather_momentum.get_supabase", return_value=mock_db):
        signal = await strategy.generate_signal(market)
        assert signal is None


@pytest.mark.asyncio
async def test_backtest_returns_required_keys(strategy: WeatherMomentumStrategy) -> None:
    result = await strategy.backtest(date(2025, 1, 1), date(2025, 3, 31))
    for key in ("total_trades", "win_rate", "pnl", "brier_score", "max_drawdown", "sharpe_ratio"):
        assert key in result
