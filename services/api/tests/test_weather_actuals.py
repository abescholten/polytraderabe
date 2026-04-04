import pytest
from unittest.mock import AsyncMock, patch
from datetime import date
import numpy as np

from src.data.weather.open_meteo import fetch_daily_max_actuals


@pytest.mark.asyncio
async def test_fetch_daily_max_actuals_returns_correct_shape():
    """Should return one row per calendar date with max/min/mean."""
    # 2 days of hourly data (48 hours)
    times = [f"2024-01-0{1 + i//24}T{i%24:02d}:00" for i in range(48)]
    temps = [5.0 + i * 0.1 for i in range(48)]  # rising temps

    mock_response = {
        "hourly": {
            "time": times,
            "temperature_2m": temps,
        }
    }

    with patch("src.data.weather.open_meteo.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=AsyncMock(
                raise_for_status=lambda: None,
                json=lambda: mock_response,
            )
        )
        result = await fetch_daily_max_actuals(
            lat=52.37,
            lon=4.89,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
        )

    assert len(result) == 2
    assert result[0]["date"] == date(2024, 1, 1)
    assert result[1]["date"] == date(2024, 1, 2)
    assert "daily_max" in result[0]
    assert "daily_min" in result[0]
    assert "daily_mean" in result[0]
    assert result[0]["daily_max"] >= result[0]["daily_min"]
    # Day 1: temps[0..23] = 5.0, 5.1, ..., 7.3
    assert result[0]["daily_min"] == 5.0
    assert result[0]["daily_max"] == 7.3
    assert result[0]["daily_mean"] == 6.1
    # Day 2: temps[24..47] = 7.4, 7.5, ..., 9.7
    assert result[1]["daily_min"] == 7.4
    assert result[1]["daily_max"] == 9.7
    assert result[1]["daily_mean"] == 8.5


@pytest.mark.asyncio
async def test_fetch_daily_max_actuals_handles_missing_hours():
    """Should skip dates with no data rather than crashing."""
    mock_response = {"hourly": {"time": [], "temperature_2m": []}}

    with patch("src.data.weather.open_meteo.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=AsyncMock(
                raise_for_status=lambda: None,
                json=lambda: mock_response,
            )
        )
        result = await fetch_daily_max_actuals(
            lat=52.37,
            lon=4.89,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 2),
        )

    assert result == []


@pytest.mark.asyncio
async def test_fetch_daily_max_actuals_skips_nan_hours():
    """NaN values in hourly data should be skipped; day still produces a row."""
    times = [f"2024-01-01T{i:02d}:00" for i in range(24)]
    temps = [float("nan")] * 12 + [10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0, 17.0, 18.0, 19.0, 20.0, 21.0]

    mock_response = {"hourly": {"time": times, "temperature_2m": temps}}

    with patch("src.data.weather.open_meteo.httpx.AsyncClient") as mock_client:
        mock_client.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=AsyncMock(
                raise_for_status=lambda: None,
                json=lambda: mock_response,
            )
        )
        result = await fetch_daily_max_actuals(
            lat=52.37, lon=4.89,
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 1),
        )

    assert len(result) == 1
    assert result[0]["daily_max"] == 21.0
    assert result[0]["daily_min"] == 10.0
