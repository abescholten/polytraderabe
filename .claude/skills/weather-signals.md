---
name: weather-signals
description: >
  Weather forecasting and probability computation specialist using Open-Meteo Ensemble API
  for converting weather forecasts into tradeable probability signals. Use this skill whenever
  working with weather data, ensemble forecasts, probability estimation, forecast verification,
  calibration analysis, or any code that fetches/processes meteorological data. Trigger on:
  "weather", "Open-Meteo", "ensemble", "forecast", "temperature", "precipitation", "probability",
  "ECMWF", "GFS", "ERA5", "reanalysis", "historical weather", "forecast skill", "Brier score",
  "calibration", "EFI", "extreme forecast index", or any weather-related data processing.
  When in doubt, trigger it.
---

# Weather Signals

You are a weather data and probability specialist. This project uses Open-Meteo's free APIs to
convert ensemble weather forecasts into tradeable probability signals for prediction markets.

## Core Concept

Prediction markets ask binary questions: "Will NYC exceed 80°F on April 15?" priced at 0.65
(= market thinks 65% likely). We use weather **ensemble models** — which run the same forecast
dozens of times with slightly varied inputs — to compute our own probability and trade when
our estimate diverges from the market.

**Example**: 51 ECMWF ensemble members forecast NYC temperature. If 41/51 exceed 80°F, our
probability is 0.804 (80.4%). Market says 65%. Edge = 15.4%. → Trade signal.

## Open-Meteo API Architecture

All APIs are **free for non-commercial use**, require **no API key**, and allow up to
**10,000 calls/day** on the free tier.

| API | Base URL | Purpose |
|-----|----------|---------|
| **Ensemble** | `https://ensemble-api.open-meteo.com/v1/ensemble` | Individual ensemble members |
| **Forecast** | `https://api.open-meteo.com/v1/forecast` | Best-guess deterministic forecast |
| **Historical** | `https://archive-api.open-meteo.com/v1/archive` | ERA5 reanalysis (1940-present) |
| **Historical Forecast** | `https://historical-forecast-api.open-meteo.com/v1/forecast` | Archived forecasts (2-5 years) |
| **Seasonal** | `https://seasonal-api.open-meteo.com/v1/seasonal` | ECMWF SEAS5 (7 months out) |

## Ensemble API — The Primary Signal Source

### Available Models

| Model | Members | Resolution | Range | Best For |
|-------|---------|------------|-------|----------|
| `ecmwf_ifs025_ensemble` | 51 | 25km | 15 days | Primary: highest member count, best calibration |
| `gfs_seamless_eps` | 31 | 25km | 16 days | Secondary: different model physics for diversity |
| `icon_seamless_eps` | 40 | 13km | 7.5 days | Short-range European detail |
| `gem_global_ensemble` | 21 | 25km | 16 days | Additional diversity (Canadian model) |
| `bom_access_global_ensemble` | 18 | 40km | 10 days | Southern hemisphere specialist |
| `ukmo_seamless_ensemble` | 18 | 10km | 7 days | UK/European short-range |

### Fetching Ensemble Data

```python
import httpx
import numpy as np
from datetime import datetime

async def fetch_ensemble(
    lat: float,
    lon: float,
    model: str = "ecmwf_ifs025_ensemble",
    variables: list[str] = ["temperature_2m"],
    days: int = 7,
) -> dict:
    """Fetch ensemble forecast data from Open-Meteo.

    Returns dict with keys per variable, each containing a 2D array:
    [time_steps x ensemble_members].
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://ensemble-api.open-meteo.com/v1/ensemble",
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": ",".join(variables),
                "models": model,
                "forecast_days": days,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()

    result = {"time": data["hourly"]["time"]}
    for var in variables:
        # Ensemble members come as var_member01, var_member02, ...
        members = []
        for key, values in data["hourly"].items():
            if key.startswith(var + "_member"):
                members.append(values)
        result[var] = np.array(members).T  # shape: (time_steps, n_members)
    return result


async def fetch_multi_model_ensemble(
    lat: float,
    lon: float,
    variable: str = "temperature_2m",
) -> dict[str, np.ndarray]:
    """Fetch ensembles from multiple models for diversity."""
    models = [
        "ecmwf_ifs025_ensemble",  # 51 members
        "gfs_seamless_eps",        # 31 members
        "icon_seamless_eps",       # 40 members
    ]
    results = {}
    for model in models:
        data = await fetch_ensemble(lat, lon, model, [variable])
        results[model] = data[variable]
    return results
```

## Probability Computation

### Basic Threshold Probability

```python
def threshold_probability(
    ensemble_values: np.ndarray,
    threshold: float,
    direction: str = "above",  # "above" or "below"
) -> float:
    """Compute probability from ensemble spread.

    Args:
        ensemble_values: 1D array of member values for a specific time step
        threshold: the value to compare against (e.g., 80°F)
        direction: "above" for P(X > threshold), "below" for P(X < threshold)

    Returns:
        Probability between 0 and 1
    """
    if direction == "above":
        count = np.sum(ensemble_values >= threshold)
    else:
        count = np.sum(ensemble_values <= threshold)
    return count / len(ensemble_values)
```

### Multi-Model Probability (Weighted)

```python
def multi_model_probability(
    model_probs: dict[str, float],
    weights: dict[str, float] | None = None,
) -> float:
    """Combine probabilities from multiple models.

    Default weights favor ECMWF (historically best calibrated).
    """
    default_weights = {
        "ecmwf_ifs025_ensemble": 0.50,
        "gfs_seamless_eps": 0.30,
        "icon_seamless_eps": 0.20,
    }
    w = weights or default_weights
    total_weight = sum(w.get(m, 0) for m in model_probs)
    if total_weight == 0:
        return np.mean(list(model_probs.values()))
    return sum(w.get(m, 0) * p for m, p in model_probs.items()) / total_weight
```

### Time-Windowed Probability

Markets often ask about a day ("Will the high exceed 80°F?"), not a specific hour:

```python
def daily_max_probability(
    hourly_ensemble: np.ndarray,
    times: list[str],
    target_date: str,
    threshold: float,
) -> float:
    """Probability that the daily maximum exceeds threshold.

    For each ensemble member, find the max over target_date's hours,
    then count members exceeding threshold.
    """
    # Filter to target date's hours
    date_mask = [t.startswith(target_date) for t in times]
    day_data = hourly_ensemble[date_mask, :]  # (24 hours, n_members)

    # Daily max per member
    member_maxes = np.max(day_data, axis=0)  # (n_members,)

    return threshold_probability(member_maxes, threshold, "above")
```

## Forecast Verification & Calibration

### Brier Score

The primary metric for evaluating probabilistic forecasts:

```python
def brier_score(forecasts: list[float], outcomes: list[int]) -> float:
    """Compute Brier score. Lower is better. Perfect = 0, worst = 1.

    Args:
        forecasts: list of probability forecasts (0 to 1)
        outcomes: list of actual outcomes (0 or 1)
    """
    return np.mean([(f - o) ** 2 for f, o in zip(forecasts, outcomes)])

# Polymarket's aggregate Brier score is ~0.058
# Your strategy should target below this to demonstrate an edge
POLYMARKET_BRIER_BENCHMARK = 0.058
```

### Calibration Analysis

```python
def calibration_curve(
    forecasts: list[float],
    outcomes: list[int],
    n_bins: int = 10,
) -> dict:
    """Compute calibration curve data.

    A well-calibrated model: when it predicts 70%, the outcome occurs ~70% of the time.
    """
    bins = np.linspace(0, 1, n_bins + 1)
    bin_centers = []
    observed_freqs = []
    counts = []

    for i in range(n_bins):
        mask = [(bins[i] <= f < bins[i + 1]) for f in forecasts]
        if sum(mask) > 0:
            bin_forecasts = [f for f, m in zip(forecasts, mask) if m]
            bin_outcomes = [o for o, m in zip(outcomes, mask) if m]
            bin_centers.append(np.mean(bin_forecasts))
            observed_freqs.append(np.mean(bin_outcomes))
            counts.append(len(bin_forecasts))

    return {
        "bin_centers": bin_centers,
        "observed_freq": observed_freqs,
        "counts": counts,
        "brier_score": brier_score(forecasts, outcomes),
    }
```

## Historical Data for Backtesting

### ERA5 Reanalysis (ground truth)

```python
async def fetch_historical_actuals(
    lat: float, lon: float,
    start_date: str, end_date: str,
    variables: list[str] = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
) -> dict:
    """Fetch historical weather actuals from ERA5 reanalysis.

    Available from 1940 to ~5 days ago. Hourly, 0.25° resolution.
    This is 'ground truth' for backtesting.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": ",".join(variables),
                "start_date": start_date,
                "end_date": end_date,
                "timezone": "auto",
            },
            timeout=60.0,
        )
        return resp.json()
```

### Historical Forecast Archive (backtest forecast skill)

```python
async def fetch_historical_forecast(
    lat: float, lon: float,
    forecast_date: str,
    lead_days: int = 3,
) -> dict:
    """Fetch what the forecast said N days before an event.

    Use this to evaluate: 'How good were forecasts 3 days ahead?'
    Available for 2-5 years depending on the model.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://historical-forecast-api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "hourly": "temperature_2m",
                "start_date": forecast_date,
                "end_date": forecast_date,
                "past_days": lead_days,
            },
            timeout=30.0,
        )
        return resp.json()
```

## Seasonal & Extreme Event Forecasts

### Extreme Forecast Index (EFI)

```python
async def fetch_seasonal_with_efi(lat: float, lon: float) -> dict:
    """Fetch seasonal forecast with Extreme Forecast Index.

    EFI ranges from -1 to +1:
    - EFI > 0.6: Notable anomaly, potential market opportunity
    - EFI > 0.8: Exceptional event, high-edge opportunity
    - SOT (Shift of Tails) > 0: Right tail heavier than climatology
    """
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://seasonal-api.open-meteo.com/v1/seasonal",
            params={
                "latitude": lat,
                "longitude": lon,
                "daily": "temperature_2m_max,temperature_2m_min",
                "models": "ecmwf_seas5",
            },
            timeout=30.0,
        )
        return resp.json()
```

## Temperature Unit Handling

**Critical**: Open-Meteo returns Celsius by default. Polymarket weather markets often use
Fahrenheit (US-centric markets). Always confirm units and convert:

```python
def celsius_to_fahrenheit(c: float) -> float:
    return c * 9 / 5 + 32

def fahrenheit_to_celsius(f: float) -> float:
    return (f - 32) * 5 / 9

# Or request Fahrenheit directly from Open-Meteo:
# params["temperature_unit"] = "fahrenheit"
```

## Key Weather Variables for Trading

| Variable | Open-Meteo Key | Typical Market Questions |
|----------|---------------|------------------------|
| Temperature max | `temperature_2m_max` | "Will NYC exceed 80°F?" |
| Temperature min | `temperature_2m_min` | "Will it freeze in Chicago?" |
| Precipitation | `precipitation_sum` | "Will it rain >1 inch?" |
| Snowfall | `snowfall_sum` | "Will Central Park get snow?" |
| Wind speed | `wind_speed_10m_max` | Hurricane-related markets |
| Wind gusts | `wind_gusts_10m_max` | Severe weather markets |

## Signal Pipeline Pattern

```python
async def generate_weather_signal(
    market: dict,  # Polymarket market metadata
    lat: float,
    lon: float,
    threshold: float,
    threshold_unit: str = "fahrenheit",
    target_date: str = "",
) -> dict:
    """Full pipeline: fetch ensemble → compute probability → generate signal."""

    # 1. Fetch multi-model ensembles
    ensembles = await fetch_multi_model_ensemble(lat, lon, "temperature_2m")

    # 2. Compute per-model probability (convert units if needed)
    threshold_c = fahrenheit_to_celsius(threshold) if threshold_unit == "fahrenheit" else threshold
    model_probs = {}
    for model_name, data in ensembles.items():
        # Find closest time step to target date
        # (simplified — production code should match exact hours)
        daily_max = np.max(data, axis=0)  # max across time per member
        prob = threshold_probability(daily_max, threshold_c, "above")
        model_probs[model_name] = prob

    # 3. Weighted multi-model probability
    our_probability = multi_model_probability(model_probs)

    # 4. Compare to market price
    market_price = float(market.get("best_ask", market.get("price", 0.5)))
    edge = our_probability - market_price

    return {
        "market_id": market["condition_id"],
        "question": market["question"],
        "our_probability": round(our_probability, 4),
        "market_price": market_price,
        "edge": round(edge, 4),
        "model_breakdown": {k: round(v, 4) for k, v in model_probs.items()},
        "signal": "BUY_YES" if edge > 0.05 else ("BUY_NO" if edge < -0.05 else "NO_TRADE"),
        "confidence": "high" if abs(edge) > 0.10 else "medium" if abs(edge) > 0.05 else "low",
        "timestamp": datetime.utcnow().isoformat(),
    }
```

## Safety Rules

1. **Always verify temperature units** — a Celsius/Fahrenheit mismatch creates 100% wrong signals
2. **Validate ensemble member count** — if you get fewer members than expected, the API may have issues
3. **Rate limit Open-Meteo** — 10K calls/day free tier; cache aggressively (forecasts update 4x daily)
4. **Forecasts degrade with lead time** — weight signals by lead time (1-3 days = high confidence, 5+ days = lower)
5. **ERA5 has a 5-day lag** — don't use for real-time verification
6. **Open-Meteo is not for commercial use on free tier** — if this generates revenue, upgrade to their API plan

## Available Algorithms (in `src/data/weather/`)

| Module | Algorithms | Status |
|---|---|---|
| `probability.py` | `threshold_probability`, `daily_max_probability`, `multi_model_probability` | Stable |
| `algorithms.py` | `kde_threshold_probability`, `bayesian_probability`, `weighted_model_blend` | Planned (see weather-data-foundation plan) |
| `calibration.py` | `brier_score`, `calibration_curve`, `reliability_score` | Planned |

City coordinates live in `src/data/cities.py` (planned — currently in `weather_temp.py`).

## After Any Weather Data Work

Run `/backlog-update` to capture:
- New algorithm ideas or improvements
- Cities missing from the registry
- Variables missing from Open-Meteo fetches
- Calibration issues found during testing
