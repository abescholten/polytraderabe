from __future__ import annotations

import httpx
import numpy as np
from datetime import date
from typing import Optional


OPEN_METEO_ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
OPEN_METEO_HISTORICAL_URL = "https://archive-api.open-meteo.com/v1/era5"

# Model member counts
MODEL_MEMBERS = {
    "ecmwf_ifs": 51,
    "gfs_seamless": 31,
    "icon_seamless": 40,
}


async def fetch_ensemble(
    lat: float,
    lon: float,
    model: str = "ecmwf_ifs",
    variables: list[str] | None = None,
    days: int = 7,
) -> dict:
    """Fetch ensemble forecast data from Open-Meteo.

    Returns dict with 'time' (list of ISO strings) and per-variable keys
    containing 2D numpy arrays of shape (time_steps, members).
    """
    if variables is None:
        variables = ["temperature_2m"]

    member_count = MODEL_MEMBERS.get(model, 51)

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(variables),
        "models": model,
        "forecast_days": days,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(OPEN_METEO_ENSEMBLE_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])

    result: dict = {"time": times}
    for var in variables:
        members_data = []
        # Member 0 is returned as the base variable name (e.g. "temperature_2m")
        values = hourly.get(var, [])
        if values:
            members_data.append(values)
        # Members 1..N are returned as e.g. "temperature_2m_member01"
        for i in range(1, member_count):
            key = f"{var}_member{i:02d}"
            values = hourly.get(key, [])
            if values:
                members_data.append(values)
        if not members_data:
            continue
        # Transpose to (time_steps, members)
        arr = np.array(members_data, dtype=float).T
        result[var] = arr

    return result


async def fetch_multi_model_ensemble(
    lat: float,
    lon: float,
    variable: str = "temperature_2m",
) -> dict[str, dict]:
    """Fetch ensemble data from ECMWF (51), GFS (31), and ICON (40).

    Returns dict keyed by model name, each containing the ensemble data dict.
    """
    models = ["ecmwf_ifs", "gfs_seamless", "icon_seamless"]
    results = {}

    for model in models:
        results[model] = await fetch_ensemble(
            lat=lat,
            lon=lon,
            model=model,
            variables=[variable],
            days=10,
        )

    return results


async def fetch_historical_actuals(
    lat: float,
    lon: float,
    start_date: date,
    end_date: date,
    variables: list[str] | None = None,
) -> dict:
    """Fetch ERA5 reanalysis historical data from Open-Meteo.

    Returns dict with 'time' and per-variable arrays.
    """
    if variables is None:
        variables = ["temperature_2m"]

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "hourly": ",".join(variables),
        # Default is Celsius — no temperature_unit param needed
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(OPEN_METEO_HISTORICAL_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    hourly = data.get("hourly", {})
    result: dict = {"time": hourly.get("time", [])}
    for var in variables:
        values = hourly.get(var, [])
        result[var] = np.array(values, dtype=float)

    return result
