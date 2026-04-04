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
