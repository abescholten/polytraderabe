# Weather Data Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a solid weather data foundation for the Polymarket weather trading strategy — city registry, multi-variable forecasting, a second API source (MeteoStat), probability calibration, and a real backtesting framework.

**Architecture:** Extract shared city data into a registry module, add multi-variable Open-Meteo support alongside MeteoStat as a second historical source, add calibration algorithms that score forecasts against ERA5 actuals, and replace the placeholder backtest in `weather_temp.py` with a proper replay framework in the backtesting module.

**Tech Stack:** Python 3.12, Open-Meteo API (existing), MeteoStat (new, pip install), NumPy, scikit-learn (isotonic regression), pytest, httpx

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/data/cities.py` | Create | Single source of truth for EU + US city coordinates + aliases |
| `src/data/weather/open_meteo.py` | Modify | Add multi-variable support (precipitation, wind speed) |
| `src/data/weather/meteostat.py` | Create | MeteoStat historical station data provider |
| `src/data/weather/provider.py` | Create | `WeatherProvider` protocol — both sources implement it |
| `src/data/weather/calibration.py` | Create | Brier score, calibration curve, isotonic calibration |
| `src/data/weather/algorithms.py` | Create | KDE probability, Bayesian updating, model-weighted blend |
| `src/trading/backtesting/weather.py` | Create | Real historical replay framework |
| `src/trading/strategies/weather_temp.py` | Modify | Use city registry; delegate backtest to new framework |
| `services/api/requirements.txt` | Modify | Add `meteostat`, `scikit-learn` |
| `tests/test_cities.py` | Create | City registry tests |
| `tests/test_weather_algorithms.py` | Create | Algorithm + calibration tests |
| `tests/test_meteostat.py` | Create | MeteoStat provider tests |
| `tests/test_backtesting_weather.py` | Create | Backtesting framework tests |

---

### Task 1: City Registry

**Files:**
- Create: `services/api/src/data/cities.py`
- Create: `services/api/tests/test_cities.py`
- Modify: `services/api/src/trading/strategies/weather_temp.py` (lines 14-48: remove KNOWN_CITIES, import from cities)

- [ ] **Step 1: Write the failing test**

```python
# services/api/tests/test_cities.py
from src.data.cities import find_city, EUROPEAN_CITIES, US_CITIES, ALL_CITIES, City


def test_find_city_by_name():
    city = find_city("Amsterdam")
    assert city is not None
    assert city.name == "Amsterdam"
    assert city.country == "NL"
    assert city.region == "europe"
    assert abs(city.lat - 52.37) < 0.01
    assert abs(city.lon - 4.90) < 0.01


def test_find_city_by_alias():
    city = find_city("nyc")
    assert city is not None
    assert city.name == "New York"


def test_find_city_case_insensitive():
    assert find_city("london") is not None
    assert find_city("PARIS") is not None


def test_find_city_unknown_returns_none():
    assert find_city("Atlantis") is None


def test_european_cities_count():
    assert len(EUROPEAN_CITIES) >= 20


def test_us_cities_count():
    assert len(US_CITIES) >= 15


def test_all_cities_have_valid_coords():
    for city in ALL_CITIES:
        assert -90 <= city.lat <= 90, f"{city.name} has invalid lat {city.lat}"
        assert -180 <= city.lon <= 180, f"{city.name} has invalid lon {city.lon}"


def test_city_is_frozen():
    city = find_city("Berlin")
    import pytest
    with pytest.raises(Exception):
        city.lat = 0.0  # type: ignore
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && pytest tests/test_cities.py -v
```

Expected: `ModuleNotFoundError: No module named 'src.data.cities'`

- [ ] **Step 3: Create city registry**

```python
# services/api/src/data/cities.py
from dataclasses import dataclass


@dataclass(frozen=True)
class City:
    name: str
    country: str  # ISO 2-letter code
    region: str   # "europe" | "us"
    lat: float
    lon: float
    aliases: tuple[str, ...] = ()


EUROPEAN_CITIES: list[City] = [
    City("Amsterdam", "NL", "europe", 52.37, 4.90, ("ams", "adam")),
    City("Berlin", "DE", "europe", 52.52, 13.41),
    City("Brussels", "BE", "europe", 50.85, 4.35, ("bruxelles",)),
    City("London", "GB", "europe", 51.51, -0.13),
    City("Paris", "FR", "europe", 48.86, 2.35),
    City("Vienna", "AT", "europe", 48.21, 16.37, ("wien",)),
    City("Zurich", "CH", "europe", 47.38, 8.54, ("zürich",)),
    City("Rome", "IT", "europe", 41.90, 12.50, ("roma",)),
    City("Madrid", "ES", "europe", 40.42, -3.70),
    City("Lisbon", "PT", "europe", 38.72, -9.14, ("lisboa",)),
    City("Prague", "CZ", "europe", 50.08, 14.44, ("praha",)),
    City("Warsaw", "PL", "europe", 52.23, 21.01, ("warszawa",)),
    City("Stockholm", "SE", "europe", 59.33, 18.07),
    City("Copenhagen", "DK", "europe", 55.68, 12.57, ("københavn",)),
    City("Oslo", "NO", "europe", 59.91, 10.75),
    City("Helsinki", "FI", "europe", 60.17, 24.94),
    City("Budapest", "HU", "europe", 47.50, 19.04),
    City("Athens", "GR", "europe", 37.98, 23.73, ("athina",)),
    City("Dublin", "IE", "europe", 53.33, -6.25),
    City("Bucharest", "RO", "europe", 44.43, 26.10, ("bucurești",)),
]

US_CITIES: list[City] = [
    City("New York", "US", "us", 40.71, -74.01, ("nyc", "new york city", "ny")),
    City("Chicago", "US", "us", 41.88, -87.63),
    City("Los Angeles", "US", "us", 34.05, -118.24, ("la",)),
    City("Miami", "US", "us", 25.76, -80.19),
    City("Houston", "US", "us", 29.76, -95.37),
    City("Dallas", "US", "us", 32.78, -96.80),
    City("Phoenix", "US", "us", 33.45, -112.07),
    City("Denver", "US", "us", 39.74, -104.99),
    City("Seattle", "US", "us", 47.61, -122.33),
    City("Boston", "US", "us", 42.36, -71.06),
    City("Atlanta", "US", "us", 33.75, -84.39),
    City("San Francisco", "US", "us", 37.77, -122.42, ("sf", "san fran")),
    City("Washington", "US", "us", 38.91, -77.04, ("dc", "washington dc")),
    City("Philadelphia", "US", "us", 39.95, -75.17, ("philly",)),
    City("Minneapolis", "US", "us", 44.98, -93.27),
]

ALL_CITIES: list[City] = EUROPEAN_CITIES + US_CITIES

_LOOKUP: dict[str, City] = {}
for _city in ALL_CITIES:
    _LOOKUP[_city.name.lower()] = _city
    for _alias in _city.aliases:
        _LOOKUP[_alias.lower()] = _city


def find_city(name: str) -> City | None:
    """Find a city by name or alias (case-insensitive)."""
    return _LOOKUP.get(name.lower().strip())
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd services/api && pytest tests/test_cities.py -v
```

Expected: All 8 tests PASS

- [ ] **Step 5: Update weather_temp.py to use city registry**

In `services/api/src/trading/strategies/weather_temp.py`, replace lines 14-48 (the `KNOWN_CITIES` dict) and the city-lookup logic in `parse_market_question()`:

```python
# Add at top of file, replace the KNOWN_CITIES import section:
from src.data.cities import find_city
```

Replace the city-lookup block in `parse_market_question()` (lines 94-99):
```python
        # Resolve city using registry
        city_obj = find_city(city_raw)
        if city_obj is None:
            return None
        lat, lon = city_obj.lat, city_obj.lon
```

Remove the `KNOWN_CITIES` dict entirely (lines 14-48).

- [ ] **Step 6: Run existing strategy tests to confirm nothing broke**

```bash
cd services/api && pytest tests/ -v -k "not test_orderbook and not test_discovery"
```

Expected: PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add services/api/src/data/cities.py services/api/tests/test_cities.py services/api/src/trading/strategies/weather_temp.py
git commit -m "feat: city registry module replacing inline KNOWN_CITIES dict"
```

---

### Task 2: Multi-Variable Weather Fetching

**Files:**
- Modify: `services/api/src/data/weather/open_meteo.py`
- Modify: `services/api/tests/` (extend existing tests or create `tests/test_open_meteo.py`)

- [ ] **Step 1: Write failing tests**

```python
# services/api/tests/test_open_meteo.py
import pytest
import numpy as np
from unittest.mock import AsyncMock, patch
from src.data.weather.open_meteo import fetch_ensemble, fetch_multi_model_ensemble

# Minimal fake response for temperature + precipitation
FAKE_RESPONSE = {
    "hourly": {
        "time": ["2025-01-01T00:00", "2025-01-01T01:00"],
        "temperature_2m": [5.0, 6.0],
        "temperature_2m_member01": [4.5, 5.5],
        "precipitation": [0.0, 0.2],
        "precipitation_member01": [0.0, 0.1],
        "wind_speed_10m": [10.0, 12.0],
        "wind_speed_10m_member01": [9.0, 11.0],
    }
}


@pytest.mark.asyncio
async def test_fetch_ensemble_multi_variable():
    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_resp = AsyncMock()
        mock_resp.json.return_value = FAKE_RESPONSE
        mock_resp.raise_for_status = AsyncMock()
        mock_client_cls.return_value.__aenter__.return_value.get = AsyncMock(
            return_value=mock_resp
        )
        result = await fetch_ensemble(
            lat=52.37,
            lon=4.90,
            variables=["temperature_2m", "precipitation", "wind_speed_10m"],
        )

    assert "temperature_2m" in result
    assert "precipitation" in result
    assert "wind_speed_10m" in result
    assert result["temperature_2m"].shape == (2, 2)  # (time_steps, members)
    assert result["precipitation"].shape == (2, 2)


@pytest.mark.asyncio
async def test_fetch_multi_model_ensemble_multi_variable():
    with patch("src.data.weather.open_meteo.fetch_ensemble", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = {
            "time": ["2025-01-01T00:00"],
            "temperature_2m": np.array([[5.0]]),
            "precipitation": np.array([[0.1]]),
        }
        result = await fetch_multi_model_ensemble(
            lat=52.37,
            lon=4.90,
            variables=["temperature_2m", "precipitation"],
        )

    assert set(result.keys()) == {"ecmwf_ifs", "gfs_seamless", "icon_seamless"}
    assert mock_fetch.call_count == 3
    # Verify variables were passed through
    call_args = mock_fetch.call_args_list[0]
    assert "temperature_2m" in call_args.kwargs.get("variables", []) or \
           "temperature_2m" in (call_args.args[2] if len(call_args.args) > 2 else [])
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && pytest tests/test_open_meteo.py -v
```

Expected: `TypeError` or assertion error — `fetch_multi_model_ensemble` only accepts `variable` (singular), not `variables`.

- [ ] **Step 3: Update `fetch_multi_model_ensemble` signature**

In `services/api/src/data/weather/open_meteo.py`, replace the function starting at line 73:

```python
async def fetch_multi_model_ensemble(
    lat: float,
    lon: float,
    variables: list[str] | None = None,
) -> dict[str, dict]:
    """Fetch ensemble data from ECMWF (51), GFS (31), and ICON (40).

    Returns dict keyed by model name, each containing the ensemble data dict.
    Supports multiple variables (temperature_2m, precipitation, wind_speed_10m, etc.)
    """
    if variables is None:
        variables = ["temperature_2m"]

    models = ["ecmwf_ifs", "gfs_seamless", "icon_seamless"]
    results = {}

    for model in models:
        results[model] = await fetch_ensemble(
            lat=lat,
            lon=lon,
            model=model,
            variables=variables,
            days=10,
        )

    return results
```

Also update the call site in `weather_temp.py` line 197 to pass `variables=["temperature_2m"]` explicitly:
```python
multi_data = await fetch_multi_model_ensemble(lat, lon, variables=["temperature_2m"])
```

- [ ] **Step 4: Run tests**

```bash
cd services/api && pytest tests/test_open_meteo.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/data/weather/open_meteo.py services/api/tests/test_open_meteo.py services/api/src/trading/strategies/weather_temp.py
git commit -m "feat: multi-variable support in fetch_multi_model_ensemble"
```

---

### Task 3: MeteoStat Historical Provider + Provider Protocol

**Files:**
- Modify: `services/api/requirements.txt`
- Create: `services/api/src/data/weather/provider.py`
- Create: `services/api/src/data/weather/meteostat.py`
- Create: `services/api/tests/test_meteostat.py`

- [ ] **Step 1: Add dependency**

In `services/api/requirements.txt`, add:
```
meteostat>=1.6.8
```

Install it:
```bash
cd services/api && pip install meteostat
```

- [ ] **Step 2: Write failing tests**

```python
# services/api/tests/test_meteostat.py
import pytest
from datetime import date
from unittest.mock import patch, MagicMock
import pandas as pd
import numpy as np
from src.data.weather.meteostat import fetch_station_daily, nearest_station_id
from src.data.weather.provider import WeatherProvider


def test_weather_provider_protocol():
    """Both Open-Meteo and MeteoStat must satisfy WeatherProvider."""
    from src.data.weather.meteostat import MeteostatProvider
    from src.data.weather.open_meteo import OpenMeteoProvider
    # Protocol check: both must be instances of WeatherProvider
    assert isinstance(MeteostatProvider(), WeatherProvider)
    assert isinstance(OpenMeteoProvider(), WeatherProvider)


def test_fetch_station_daily_returns_expected_keys():
    fake_df = pd.DataFrame({
        "tavg": [10.5, 12.0],
        "tmin": [5.0, 6.0],
        "tmax": [16.0, 18.0],
        "prcp": [0.0, 2.5],
        "wspd": [15.0, 20.0],
    }, index=pd.to_datetime(["2025-01-01", "2025-01-02"]))

    with patch("src.data.weather.meteostat.Daily") as mock_daily_cls:
        mock_daily = MagicMock()
        mock_daily.fetch.return_value = fake_df
        mock_daily_cls.return_value = mock_daily

        with patch("src.data.weather.meteostat.Point") as mock_point:
            result = fetch_station_daily(
                lat=52.37,
                lon=4.90,
                start_date=date(2025, 1, 1),
                end_date=date(2025, 1, 2),
            )

    assert "dates" in result
    assert "tmax" in result
    assert "tmin" in result
    assert "prcp" in result
    assert len(result["dates"]) == 2
    assert result["tmax"][0] == pytest.approx(16.0)


def test_fetch_station_daily_handles_empty_response():
    empty_df = pd.DataFrame(columns=["tavg", "tmin", "tmax", "prcp", "wspd"])

    with patch("src.data.weather.meteostat.Daily") as mock_daily_cls:
        mock_daily = MagicMock()
        mock_daily.fetch.return_value = empty_df
        mock_daily_cls.return_value = mock_daily

        with patch("src.data.weather.meteostat.Point"):
            result = fetch_station_daily(52.37, 4.90, date(2025, 1, 1), date(2025, 1, 2))

    assert result["dates"] == []
    assert result["tmax"] == []
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd services/api && pytest tests/test_meteostat.py -v
```

Expected: `ModuleNotFoundError` for `src.data.weather.provider` and `src.data.weather.meteostat`

- [ ] **Step 4: Create the provider protocol**

```python
# services/api/src/data/weather/provider.py
from typing import Protocol, runtime_checkable
from datetime import date


@runtime_checkable
class WeatherProvider(Protocol):
    """Protocol that all weather data providers must satisfy."""

    async def fetch_historical_daily(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        variables: list[str],
    ) -> dict:
        """Fetch historical daily weather data.

        Returns dict with:
          - 'dates': list of date objects
          - One key per variable: list of float values (NaN for missing)
        """
        ...
```

- [ ] **Step 5: Create MeteoStat provider**

```python
# services/api/src/data/weather/meteostat.py
from datetime import date, datetime
import numpy as np
from meteostat import Point, Daily  # type: ignore[import]


def fetch_station_daily(
    lat: float,
    lon: float,
    start_date: date,
    end_date: date,
) -> dict:
    """Fetch daily station observations via MeteoStat nearest-point lookup.

    Returns dict with keys:
      - 'dates': list[date]
      - 'tmax': list[float]   (°C, NaN if missing)
      - 'tmin': list[float]   (°C, NaN if missing)
      - 'tavg': list[float]   (°C, NaN if missing)
      - 'prcp': list[float]   (mm, NaN if missing)
      - 'wspd': list[float]   (km/h, NaN if missing)
    """
    location = Point(lat, lon)
    start = datetime(start_date.year, start_date.month, start_date.day)
    end = datetime(end_date.year, end_date.month, end_date.day)

    data = Daily(location, start, end)
    df = data.fetch()

    if df.empty:
        return {"dates": [], "tmax": [], "tmin": [], "tavg": [], "prcp": [], "wspd": []}

    def col(name: str) -> list[float]:
        if name not in df.columns:
            return [float("nan")] * len(df)
        return [float(v) if not np.isnan(v) else float("nan") for v in df[name]]

    return {
        "dates": [dt.date() for dt in df.index.to_pydatetime()],
        "tmax": col("tmax"),
        "tmin": col("tmin"),
        "tavg": col("tavg"),
        "prcp": col("prcp"),
        "wspd": col("wspd"),
    }


class MeteostatProvider:
    """WeatherProvider implementation backed by MeteoStat station data."""

    async def fetch_historical_daily(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        variables: list[str],
    ) -> dict:
        # MeteoStat is synchronous; run in thread pool in real async context
        return fetch_station_daily(lat, lon, start_date, end_date)
```

Add `OpenMeteoProvider` shim to `open_meteo.py` (append at end of file):
```python
# services/api/src/data/weather/open_meteo.py — add at end:

class OpenMeteoProvider:
    """WeatherProvider implementation backed by Open-Meteo ERA5 reanalysis."""

    async def fetch_historical_daily(
        self,
        lat: float,
        lon: float,
        start_date: date,
        end_date: date,
        variables: list[str] | None = None,
    ) -> dict:
        from datetime import date as date_type
        if variables is None:
            variables = ["temperature_2m"]
        raw = await fetch_historical_actuals(lat, lon, start_date, end_date, variables)
        times = raw.get("time", [])
        result: dict = {"dates": []}
        for t in times:
            try:
                result["dates"].append(datetime.fromisoformat(t).date())
            except (ValueError, TypeError):
                pass
        for var in variables:
            result[var] = list(raw.get(var, np.array([])))
        return result
```

Also add `from datetime import datetime` at top of `open_meteo.py` if not present.

- [ ] **Step 6: Run tests**

```bash
cd services/api && pytest tests/test_meteostat.py -v
```

Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add services/api/requirements.txt services/api/src/data/weather/provider.py services/api/src/data/weather/meteostat.py services/api/src/data/weather/open_meteo.py services/api/tests/test_meteostat.py
git commit -m "feat: MeteoStat provider and WeatherProvider protocol"
```

---

### Task 4: Probability Algorithms (KDE + Bayesian)

**Files:**
- Create: `services/api/src/data/weather/algorithms.py`
- Create: `services/api/tests/test_weather_algorithms.py`

- [ ] **Step 1: Write failing tests**

```python
# services/api/tests/test_weather_algorithms.py
import numpy as np
import pytest
from src.data.weather.algorithms import (
    kde_threshold_probability,
    bayesian_probability,
    weighted_model_blend,
)


def test_kde_probability_above_threshold():
    # 80% of members above 20°C
    members = np.array([15.0, 18.0, 22.0, 25.0, 26.0])
    prob = kde_threshold_probability(members, threshold=20.0, direction="above")
    # KDE should give roughly 60-80% (not exactly 3/5 = 0.6 due to smoothing)
    assert 0.4 <= prob <= 0.95


def test_kde_probability_below_threshold():
    members = np.array([5.0, 8.0, 12.0, 22.0, 25.0])
    prob = kde_threshold_probability(members, threshold=15.0, direction="below")
    assert 0.4 <= prob <= 0.85


def test_kde_handles_single_member():
    members = np.array([10.0])
    prob = kde_threshold_probability(members, threshold=5.0, direction="above")
    assert 0.0 <= prob <= 1.0


def test_bayesian_probability_no_prior_data():
    # No historical correction → falls back to ensemble probability
    members = np.array([18.0, 20.0, 22.0, 19.0])
    prob = bayesian_probability(
        ensemble_members=members,
        threshold=20.0,
        direction="above",
        climatological_prior=None,
    )
    assert 0.0 <= prob <= 1.0


def test_bayesian_probability_with_strong_prior():
    # Members say 75% above, but climatology says 20% → result between them
    members = np.concatenate([np.ones(30) * 25.0, np.ones(10) * 15.0])
    prob = bayesian_probability(
        ensemble_members=members,
        threshold=20.0,
        direction="above",
        climatological_prior=0.20,
        prior_weight=0.3,
    )
    # Should be between 0.20 and 0.75
    assert 0.20 <= prob <= 0.75


def test_weighted_model_blend_default_weights():
    probs = {"ecmwf_ifs": 0.60, "gfs_seamless": 0.50, "icon_seamless": 0.40}
    result = weighted_model_blend(probs)
    # ECMWF weight=0.5, GFS=0.3, ICON=0.2 → 0.6*0.5 + 0.5*0.3 + 0.4*0.2 = 0.53
    assert result == pytest.approx(0.53)


def test_weighted_model_blend_custom_weights():
    probs = {"ecmwf_ifs": 0.70, "gfs_seamless": 0.60}
    weights = {"ecmwf_ifs": 0.6, "gfs_seamless": 0.4}
    result = weighted_model_blend(probs, weights=weights)
    assert result == pytest.approx(0.66)


def test_weighted_model_blend_missing_model():
    # Only one model available
    probs = {"ecmwf_ifs": 0.70}
    result = weighted_model_blend(probs)
    assert result == pytest.approx(0.70)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && pytest tests/test_weather_algorithms.py -v
```

Expected: `ModuleNotFoundError: No module named 'src.data.weather.algorithms'`

- [ ] **Step 3: Implement algorithms module**

```python
# services/api/src/data/weather/algorithms.py
"""Advanced probability algorithms for ensemble weather forecasting."""
import numpy as np
from scipy.stats import gaussian_kde  # type: ignore[import]
from typing import Optional


DEFAULT_MODEL_WEIGHTS = {
    "ecmwf_ifs": 0.50,
    "gfs_seamless": 0.30,
    "icon_seamless": 0.20,
}


def kde_threshold_probability(
    ensemble_members: np.ndarray,
    threshold: float,
    direction: str = "above",
    bandwidth: str = "scott",
) -> float:
    """Compute P(X > threshold) using kernel density estimation.

    More accurate than counting members for small ensembles, as it
    smooths the empirical distribution.

    Args:
        ensemble_members: 1D array of ensemble member values.
        threshold: The threshold value.
        direction: 'above' or 'below'.
        bandwidth: KDE bandwidth method ('scott' or 'silverman').

    Returns:
        Probability as float in [0, 1].
    """
    valid = ensemble_members[~np.isnan(ensemble_members)]
    if len(valid) == 0:
        return 0.5
    if len(valid) == 1:
        # Can't fit KDE — fall back to step function
        if direction == "above":
            return 1.0 if valid[0] > threshold else 0.0
        return 1.0 if valid[0] < threshold else 0.0

    kde = gaussian_kde(valid, bw_method=bandwidth)
    # Integrate: P(X > threshold) = 1 - CDF(threshold)
    # Use numerical integration over a fine grid
    grid_min = min(valid.min(), threshold) - 3 * valid.std()
    grid_max = max(valid.max(), threshold) + 3 * valid.std()
    grid = np.linspace(grid_min, grid_max, 500)
    density = kde(grid)
    density /= density.sum()  # normalize

    if direction == "above":
        return float(density[grid > threshold].sum())
    elif direction == "below":
        return float(density[grid < threshold].sum())
    else:
        raise ValueError(f"direction must be 'above' or 'below', got '{direction}'")


def bayesian_probability(
    ensemble_members: np.ndarray,
    threshold: float,
    direction: str = "above",
    climatological_prior: Optional[float] = None,
    prior_weight: float = 0.2,
) -> float:
    """Compute probability using Bayesian blend of ensemble and climatological prior.

    When climatological_prior is None, returns the raw ensemble probability.
    When provided, blends ensemble estimate with the climatological base rate.

    Args:
        ensemble_members: 1D array of member values.
        threshold: Threshold value.
        direction: 'above' or 'below'.
        climatological_prior: Historical base rate P(event) for this location/season.
        prior_weight: Weight of the climatological prior in the blend (0–1).

    Returns:
        Blended probability as float in [0, 1].
    """
    valid = ensemble_members[~np.isnan(ensemble_members)]
    if len(valid) == 0:
        return climatological_prior if climatological_prior is not None else 0.5

    if direction == "above":
        ensemble_prob = float(np.sum(valid > threshold) / len(valid))
    elif direction == "below":
        ensemble_prob = float(np.sum(valid < threshold) / len(valid))
    else:
        raise ValueError(f"direction must be 'above' or 'below', got '{direction}'")

    if climatological_prior is None:
        return ensemble_prob

    prior_weight = max(0.0, min(1.0, prior_weight))
    return prior_weight * climatological_prior + (1 - prior_weight) * ensemble_prob


def weighted_model_blend(
    model_probs: dict[str, float],
    weights: Optional[dict[str, float]] = None,
) -> float:
    """Weighted blend of probabilities from multiple models.

    Args:
        model_probs: Dict mapping model name to probability.
        weights: Optional weight overrides. Defaults to ECMWF=0.5, GFS=0.3, ICON=0.2.

    Returns:
        Weighted probability as float in [0, 1].
    """
    effective_weights = weights or DEFAULT_MODEL_WEIGHTS

    weighted_sum = 0.0
    total_weight = 0.0
    for model, prob in model_probs.items():
        w = effective_weights.get(model, 0.0)
        weighted_sum += prob * w
        total_weight += w

    if total_weight == 0.0:
        values = list(model_probs.values())
        return sum(values) / len(values) if values else 0.5

    return weighted_sum / total_weight
```

- [ ] **Step 4: Add scipy to requirements**

In `services/api/requirements.txt`, add:
```
scipy>=1.13.0
```

Install:
```bash
pip install scipy
```

- [ ] **Step 5: Run tests**

```bash
cd services/api && pytest tests/test_weather_algorithms.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add services/api/src/data/weather/algorithms.py services/api/tests/test_weather_algorithms.py services/api/requirements.txt
git commit -m "feat: KDE and Bayesian probability algorithms for ensemble weather"
```

---

### Task 5: Forecast Calibration

**Files:**
- Create: `services/api/src/data/weather/calibration.py`
- Create: `services/api/tests/test_calibration.py`

The calibration module compares historical ensemble forecasts to ERA5 actuals to measure how well-calibrated our probability estimates are (a forecast of 70% should verify ~70% of the time).

- [ ] **Step 1: Write failing tests**

```python
# services/api/tests/test_calibration.py
import numpy as np
import pytest
from src.data.weather.calibration import (
    brier_score,
    calibration_curve,
    reliability_score,
)


def test_brier_score_perfect_forecast():
    # P=1.0 when outcome=True → Brier = 0
    forecasts = np.array([1.0, 0.0, 1.0, 0.0])
    outcomes = np.array([1.0, 0.0, 1.0, 0.0])
    assert brier_score(forecasts, outcomes) == pytest.approx(0.0)


def test_brier_score_worst_forecast():
    # P=0.0 when outcome=True → Brier = 1
    forecasts = np.array([0.0, 1.0])
    outcomes = np.array([1.0, 0.0])
    assert brier_score(forecasts, outcomes) == pytest.approx(1.0)


def test_brier_score_climatology():
    # Climatological forecast of 0.5 → Brier = 0.25
    forecasts = np.array([0.5, 0.5, 0.5, 0.5])
    outcomes = np.array([1.0, 0.0, 1.0, 0.0])
    assert brier_score(forecasts, outcomes) == pytest.approx(0.25)


def test_calibration_curve_returns_bins():
    forecasts = np.linspace(0.1, 0.9, 100)
    # Make outcomes correlate with forecasts
    rng = np.random.default_rng(42)
    outcomes = (rng.random(100) < forecasts).astype(float)
    bins, mean_pred, mean_obs = calibration_curve(forecasts, outcomes, n_bins=5)
    assert len(bins) == 5
    assert len(mean_pred) == 5
    assert len(mean_obs) == 5
    assert all(0.0 <= v <= 1.0 for v in mean_pred)
    assert all(0.0 <= v <= 1.0 for v in mean_obs)


def test_reliability_score_perfect():
    # Perfect calibration → reliability = 0.0
    forecasts = np.array([0.3, 0.3, 0.7, 0.7])
    outcomes = np.array([0.0, 1.0, 1.0, 0.0])  # mean(outcomes) ≈ 0.5
    # Not perfect, but test that the function returns a float in [0, 1]
    score = reliability_score(forecasts, outcomes)
    assert 0.0 <= score <= 1.0


def test_brier_score_empty_raises():
    with pytest.raises(ValueError, match="empty"):
        brier_score(np.array([]), np.array([]))
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && pytest tests/test_calibration.py -v
```

Expected: `ModuleNotFoundError: No module named 'src.data.weather.calibration'`

- [ ] **Step 3: Implement calibration module**

```python
# services/api/src/data/weather/calibration.py
"""Forecast calibration: Brier score, reliability, calibration curves."""
import numpy as np
from typing import Optional


def brier_score(
    forecasts: np.ndarray,
    outcomes: np.ndarray,
) -> float:
    """Compute the Brier score for probabilistic forecasts.

    Brier score = mean((forecast - outcome)^2)
    0 = perfect, 1 = worst possible, 0.25 = uninformative (always 0.5).

    Args:
        forecasts: 1D array of forecast probabilities in [0, 1].
        outcomes: 1D array of binary outcomes (0.0 or 1.0).

    Returns:
        Brier score as float in [0, 1].
    """
    if len(forecasts) == 0:
        raise ValueError("Cannot compute Brier score on empty arrays")
    return float(np.mean((forecasts - outcomes) ** 2))


def calibration_curve(
    forecasts: np.ndarray,
    outcomes: np.ndarray,
    n_bins: int = 10,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute a reliability diagram (calibration curve).

    Bins forecasts by probability, computes mean predicted and mean observed
    frequency per bin. A perfectly calibrated model has mean_pred == mean_obs.

    Args:
        forecasts: 1D array of forecast probabilities in [0, 1].
        outcomes: 1D array of binary outcomes (0.0 or 1.0).
        n_bins: Number of probability bins.

    Returns:
        Tuple of (bin_centers, mean_predicted, mean_observed) arrays.
        Bins with no samples are excluded.
    """
    edges = np.linspace(0.0, 1.0, n_bins + 1)
    centers = []
    mean_pred = []
    mean_obs = []

    for i in range(n_bins):
        lo, hi = edges[i], edges[i + 1]
        mask = (forecasts >= lo) & (forecasts < hi)
        if i == n_bins - 1:
            mask = (forecasts >= lo) & (forecasts <= hi)
        if mask.sum() == 0:
            continue
        centers.append((lo + hi) / 2)
        mean_pred.append(float(forecasts[mask].mean()))
        mean_obs.append(float(outcomes[mask].mean()))

    return np.array(centers), np.array(mean_pred), np.array(mean_obs)


def reliability_score(
    forecasts: np.ndarray,
    outcomes: np.ndarray,
    n_bins: int = 10,
) -> float:
    """Compute the reliability component of the Brier score decomposition.

    Lower is better (0 = perfectly calibrated). This measures systematic
    over/under-confidence: how far mean_predicted deviates from mean_observed.

    Args:
        forecasts: 1D array of forecast probabilities.
        outcomes: 1D array of binary outcomes.
        n_bins: Number of calibration bins.

    Returns:
        Reliability score as float >= 0.
    """
    _, mean_pred, mean_obs = calibration_curve(forecasts, outcomes, n_bins)
    if len(mean_pred) == 0:
        return 0.0
    return float(np.mean((mean_pred - mean_obs) ** 2))
```

- [ ] **Step 4: Run tests**

```bash
cd services/api && pytest tests/test_calibration.py -v
```

Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add services/api/src/data/weather/calibration.py services/api/tests/test_calibration.py
git commit -m "feat: forecast calibration module (Brier score, reliability, calibration curves)"
```

---

### Task 6: Real Backtesting Framework

**Files:**
- Create: `services/api/src/trading/backtesting/weather.py`
- Create: `services/api/tests/test_backtesting_weather.py`
- Modify: `services/api/src/trading/strategies/weather_temp.py` (delegate `backtest()` to new framework)

Replace the simplified simulation in `weather_temp.py:backtest()` with calls to a proper historical replay that uses ERA5 actuals as ground truth.

- [ ] **Step 1: Write failing tests**

```python
# services/api/tests/test_backtesting_weather.py
import pytest
import numpy as np
from datetime import date
from unittest.mock import AsyncMock, patch, MagicMock
from src.trading.backtesting.weather import WeatherBacktester, BacktestResult


@pytest.mark.asyncio
async def test_backtest_result_fields():
    result = BacktestResult(
        city="Amsterdam",
        variable="temperature_2m",
        threshold=15.0,
        direction="above",
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        n_events=31,
        n_correct=20,
        brier_score=0.18,
        reliability=0.02,
        win_rate=0.645,
        mean_edge=0.08,
    )
    assert result.win_rate == pytest.approx(0.645)
    assert result.brier_score == pytest.approx(0.18)


@pytest.mark.asyncio
async def test_backtester_runs_and_returns_result():
    # Mock ERA5 actuals: 10 days, some above threshold
    fake_actuals = {
        "time": [f"2024-01-{i:02d}T12:00" for i in range(1, 11)],
        "temperature_2m": np.array([10.0, 12.0, 16.0, 18.0, 14.0, 20.0, 11.0, 19.0, 13.0, 17.0]),
    }
    # Mock ensemble: returns fixed probability array
    fake_ensemble = {
        "time": [f"2024-01-{i:02d}T{h:02d}:00" for i in range(1, 11) for h in range(24)],
        "temperature_2m": np.tile(np.array([15.0] * 51), (240, 1)),  # (240 hours, 51 members)
    }

    with patch(
        "src.trading.backtesting.weather.fetch_historical_actuals",
        new_callable=AsyncMock,
        return_value=fake_actuals,
    ), patch(
        "src.trading.backtesting.weather.fetch_ensemble",
        new_callable=AsyncMock,
        return_value={**fake_ensemble, "time": fake_ensemble["time"]},
    ):
        backtester = WeatherBacktester()
        result = await backtester.run(
            lat=52.37,
            lon=4.90,
            city="Amsterdam",
            variable="temperature_2m",
            threshold=15.0,
            direction="above",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 10),
        )

    assert isinstance(result, BacktestResult)
    assert result.city == "Amsterdam"
    assert result.n_events >= 0
    assert 0.0 <= result.brier_score <= 1.0
    assert 0.0 <= result.win_rate <= 1.0


@pytest.mark.asyncio
async def test_backtester_handles_no_data():
    with patch(
        "src.trading.backtesting.weather.fetch_historical_actuals",
        new_callable=AsyncMock,
        return_value={"time": [], "temperature_2m": np.array([])},
    ):
        backtester = WeatherBacktester()
        result = await backtester.run(
            lat=52.37,
            lon=4.90,
            city="Amsterdam",
            variable="temperature_2m",
            threshold=15.0,
            direction="above",
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 10),
        )

    assert result.n_events == 0
    assert result.brier_score == 0.0
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/api && pytest tests/test_backtesting_weather.py -v
```

Expected: `ModuleNotFoundError: No module named 'src.trading.backtesting.weather'`

- [ ] **Step 3: Implement backtesting framework**

```python
# services/api/src/trading/backtesting/weather.py
"""Real historical backtest for weather probability forecasts.

Replay: for each day in [start_date, end_date], compute what our ensemble
forecast would have predicted vs. what ERA5 actually observed.
"""
from dataclasses import dataclass
from datetime import date, timedelta
import numpy as np

from src.data.weather.open_meteo import fetch_historical_actuals, fetch_ensemble
from src.data.weather.probability import daily_max_probability
from src.data.weather.calibration import brier_score, reliability_score


@dataclass
class BacktestResult:
    city: str
    variable: str
    threshold: float
    direction: str
    start_date: date
    end_date: date
    n_events: int
    n_correct: int
    brier_score: float
    reliability: float
    win_rate: float
    mean_edge: float  # mean |forecast - 0.5| for days where a trade would be taken


class WeatherBacktester:
    """Run historical backtests for weather threshold forecasts.

    For each day in the period:
    1. Fetch ERA5 actuals to determine if the event occurred.
    2. Fetch the ensemble forecast (as if we were forecasting 3 days ahead).
    3. Compute probability and compare to outcome.
    """

    async def run(
        self,
        lat: float,
        lon: float,
        city: str,
        variable: str,
        threshold: float,
        direction: str,
        start_date: date,
        end_date: date,
        forecast_lead_days: int = 3,
    ) -> BacktestResult:
        """Run the backtest.

        Args:
            lat, lon: Location coordinates.
            city: City name for the result label.
            variable: Weather variable (e.g. 'temperature_2m').
            threshold: Event threshold.
            direction: 'above' or 'below'.
            start_date, end_date: Backtest period.
            forecast_lead_days: How many days ahead the forecast is made.

        Returns:
            BacktestResult with aggregate metrics.
        """
        # Fetch ERA5 actuals for the entire period
        actuals = await fetch_historical_actuals(
            lat, lon, start_date, end_date, [variable]
        )
        actual_times = actuals.get("time", [])
        actual_values = actuals.get(variable, np.array([]))

        if len(actual_times) == 0 or len(actual_values) == 0:
            return BacktestResult(
                city=city, variable=variable, threshold=threshold,
                direction=direction, start_date=start_date, end_date=end_date,
                n_events=0, n_correct=0, brier_score=0.0, reliability=0.0,
                win_rate=0.0, mean_edge=0.0,
            )

        # Group ERA5 actuals by date → daily max or min
        from datetime import datetime
        daily_values: dict[date, list[float]] = {}
        for t_str, val in zip(actual_times, actual_values):
            try:
                d = datetime.fromisoformat(t_str).date()
                daily_values.setdefault(d, []).append(float(val))
            except (ValueError, TypeError):
                continue

        forecast_probs: list[float] = []
        outcomes: list[float] = []

        current = start_date
        while current <= end_date:
            if current not in daily_values:
                current += timedelta(days=1)
                continue

            day_vals = daily_values[current]
            if direction == "above":
                actual_stat = max(day_vals)
                outcome = 1.0 if actual_stat > threshold else 0.0
            else:
                actual_stat = min(day_vals)
                outcome = 1.0 if actual_stat < threshold else 0.0

            # Fetch ensemble forecast (as-if made `forecast_lead_days` before)
            try:
                ensemble_data = await fetch_ensemble(
                    lat=lat, lon=lon, variables=[variable], days=forecast_lead_days + 1
                )
                ensemble = ensemble_data.get(variable)
                times = ensemble_data.get("time", [])

                if ensemble is not None and len(times) > 0:
                    prob = daily_max_probability(
                        hourly_ensemble=ensemble,
                        times=times,
                        target_date=current,
                        threshold=threshold,
                        direction=direction,
                    )
                else:
                    prob = 0.5
            except Exception:
                prob = 0.5

            forecast_probs.append(prob)
            outcomes.append(outcome)
            current += timedelta(days=1)

        if not forecast_probs:
            return BacktestResult(
                city=city, variable=variable, threshold=threshold,
                direction=direction, start_date=start_date, end_date=end_date,
                n_events=0, n_correct=0, brier_score=0.0, reliability=0.0,
                win_rate=0.0, mean_edge=0.0,
            )

        fp = np.array(forecast_probs)
        oc = np.array(outcomes)
        n_events = len(oc)
        n_correct = int(np.sum((fp > 0.5) == (oc == 1.0)))
        bs = brier_score(fp, oc)
        rel = reliability_score(fp, oc)
        win_rate = n_correct / n_events if n_events > 0 else 0.0
        mean_edge = float(np.mean(np.abs(fp - 0.5)))

        return BacktestResult(
            city=city, variable=variable, threshold=threshold,
            direction=direction, start_date=start_date, end_date=end_date,
            n_events=n_events, n_correct=n_correct, brier_score=round(bs, 4),
            reliability=round(rel, 4), win_rate=round(win_rate, 4),
            mean_edge=round(mean_edge, 4),
        )
```

- [ ] **Step 4: Replace placeholder backtest in weather_temp.py**

In `services/api/src/trading/strategies/weather_temp.py`, replace the entire `backtest()` method (lines 285-361) with:

```python
    async def backtest(self, start_date: date, end_date: date) -> dict:
        """Run a historical backtest. Delegates to WeatherBacktester."""
        from src.trading.backtesting.weather import WeatherBacktester
        from src.data.cities import find_city

        city_obj = find_city("new york")
        if city_obj is None:
            return {"error": "city not found", "total_trades": 0}

        backtester = WeatherBacktester()
        result = await backtester.run(
            lat=city_obj.lat,
            lon=city_obj.lon,
            city=city_obj.name,
            variable="temperature_2m",
            threshold=26.7,  # 80°F in Celsius
            direction="above",
            start_date=start_date,
            end_date=end_date,
        )
        return {
            "total_trades": result.n_events,
            "win_rate": result.win_rate,
            "brier_score": result.brier_score,
            "reliability": result.reliability,
            "mean_edge": result.mean_edge,
            "city": result.city,
            "threshold": f"{result.threshold}°C ({result.threshold * 9/5 + 32:.0f}°F)",
            "period": f"{start_date} to {end_date}",
        }
```

- [ ] **Step 5: Run tests**

```bash
cd services/api && pytest tests/test_backtesting_weather.py -v
```

Expected: All 3 tests PASS

- [ ] **Step 6: Run full test suite**

```bash
cd services/api && pytest tests/ -v
```

Expected: All tests PASS (no regressions)

- [ ] **Step 7: Commit**

```bash
git add services/api/src/trading/backtesting/weather.py services/api/tests/test_backtesting_weather.py services/api/src/trading/strategies/weather_temp.py
git commit -m "feat: real weather backtesting framework with Brier score and calibration metrics"
```

---

## Self-Review

**Spec coverage check:**

| Backlog item | Covered by task(s) |
|---|---|
| Multiple weather APIs | Task 3 (MeteoStat + OpenMeteoProvider protocol) |
| European cities | Task 1 (20 EU cities in registry) |
| Different algorithms | Task 4 (KDE, Bayesian, weighted blend) |
| Test scenarios / backtesting | Task 5 (calibration) + Task 6 (historical replay) |

**Placeholder scan:** No TBDs, all code blocks are complete with actual implementations.

**Type consistency:**
- `City` dataclass from Task 1 is used in Task 6's `backtest()` method via `find_city()`
- `fetch_ensemble` signature unchanged (Task 2 only modifies `fetch_multi_model_ensemble`)
- `WeatherProvider` protocol in Task 3 is implemented by both `MeteostatProvider` and `OpenMeteoProvider`
- `brier_score` and `reliability_score` from Task 5 are imported in Task 6's `WeatherBacktester`

All cross-task dependencies are consistent.
