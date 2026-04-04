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


from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock


def test_get_actuals_returns_empty_when_no_data():
    """GET /weather/actuals/{city} returns empty list when DB has no rows."""
    from src.api.weather_actuals_api import router
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router, prefix="/weather")

    mock_db = MagicMock()
    (mock_db.table.return_value
        .select.return_value
        .eq.return_value
        .gte.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value.data) = []

    with patch("src.api.weather_actuals_api.get_supabase", return_value=mock_db):
        client = TestClient(app)
        resp = client.get("/weather/actuals/amsterdam")

    assert resp.status_code == 200
    assert resp.json() == {"city": "amsterdam", "actuals": []}


def test_get_actuals_returns_rows():
    """GET /weather/actuals/{city} returns and maps rows from DB correctly."""
    from src.api.weather_actuals_api import router
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router, prefix="/weather")

    mock_rows = [
        {"date": "2024-01-01", "daily_max_celsius": 8.5, "daily_min_celsius": 2.1, "daily_mean_celsius": 5.0},
        {"date": "2024-01-02", "daily_max_celsius": 9.1, "daily_min_celsius": 3.0, "daily_mean_celsius": 5.8},
    ]
    mock_db = MagicMock()
    (mock_db.table.return_value
        .select.return_value
        .eq.return_value
        .gte.return_value
        .order.return_value
        .limit.return_value
        .execute.return_value.data) = mock_rows

    with patch("src.api.weather_actuals_api.get_supabase", return_value=mock_db):
        client = TestClient(app)
        resp = client.get("/weather/actuals/amsterdam?days=30")

    assert resp.status_code == 200
    data = resp.json()
    assert data["city"] == "amsterdam"
    assert len(data["actuals"]) == 2
    assert data["actuals"][0]["date"] == "2024-01-01"
    assert data["actuals"][0]["daily_max"] == 8.5
    assert data["actuals"][1]["daily_min"] == 3.0


@pytest.mark.asyncio
async def test_backfill_upserts_rows_for_all_cities():
    """POST /weather/backfill calls upsert for each city that has data."""
    from src.api.weather_actuals_api import router, CITIES
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router, prefix="/weather")

    fake_daily = [{"date": date(2024, 1, 1), "daily_max": 10.0, "daily_min": 5.0, "daily_mean": 7.5}]
    mock_db = MagicMock()
    mock_db.table.return_value.upsert.return_value.execute.return_value = MagicMock()

    with patch("src.api.weather_actuals_api.fetch_daily_max_actuals", new=AsyncMock(return_value=fake_daily)) as mock_fetch, \
         patch("src.api.weather_actuals_api.get_supabase", return_value=mock_db):
        client = TestClient(app)
        resp = client.post("/weather/backfill?days=7")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["errors"] == {}
    assert set(data["rows_upserted"].keys()) == set(CITIES.keys())
    assert all(v == 1 for v in data["rows_upserted"].values())
    assert mock_fetch.call_count == len(CITIES)


@pytest.mark.asyncio
async def test_backfill_skips_upsert_when_no_rows():
    """POST /weather/backfill does not call upsert for cities with empty data."""
    from src.api.weather_actuals_api import router
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router, prefix="/weather")

    mock_db = MagicMock()

    with patch("src.api.weather_actuals_api.fetch_daily_max_actuals", new=AsyncMock(return_value=[])), \
         patch("src.api.weather_actuals_api.get_supabase", return_value=mock_db):
        client = TestClient(app)
        resp = client.post("/weather/backfill?days=7")

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert all(v == 0 for v in data["rows_upserted"].values())
    mock_db.table.return_value.upsert.assert_not_called()


def test_get_actuals_returns_404_for_unknown_city():
    """GET /weather/actuals/{city} returns 404 for cities not in CITIES dict."""
    from src.api.weather_actuals_api import router
    from fastapi import FastAPI
    app = FastAPI()
    app.include_router(router, prefix="/weather")

    with patch("src.api.weather_actuals_api.get_supabase"):
        client = TestClient(app)
        resp = client.get("/weather/actuals/atlantis")

    assert resp.status_code == 404
