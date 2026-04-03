import numpy as np
from datetime import date, datetime
from typing import Optional


def celsius_to_fahrenheit(c: float) -> float:
    return c * 9.0 / 5.0 + 32.0


def fahrenheit_to_celsius(f: float) -> float:
    return (f - 32.0) * 5.0 / 9.0


def threshold_probability(
    ensemble_values: np.ndarray,
    threshold: float,
    direction: str = "above",
) -> float:
    """Compute P(X > threshold) or P(X < threshold) from a 1D array of ensemble members.

    Args:
        ensemble_values: 1D array of member values for a single time step.
        threshold: The threshold value.
        direction: 'above' for P(X > threshold), 'below' for P(X < threshold).

    Returns:
        Probability as a float in [0, 1].
    """
    valid = ensemble_values[~np.isnan(ensemble_values)]
    if len(valid) == 0:
        return 0.5  # no data, return uninformative prior

    if direction == "above":
        count = np.sum(valid > threshold)
    elif direction == "below":
        count = np.sum(valid < threshold)
    else:
        raise ValueError(f"direction must be 'above' or 'below', got '{direction}'")

    return float(count / len(valid))


def daily_max_probability(
    hourly_ensemble: np.ndarray,
    times: list[str],
    target_date: date,
    threshold: float,
    direction: str = "above",
) -> float:
    """Compute probability that the daily max (or min) exceeds a threshold.

    For 'above': P(max(X_day) > threshold).
    For 'below': P(min(X_day) < threshold).

    Args:
        hourly_ensemble: 2D array (time_steps, members).
        times: List of ISO datetime strings corresponding to rows.
        target_date: The date to evaluate.
        threshold: Temperature threshold.
        direction: 'above' or 'below'.

    Returns:
        Probability as float in [0, 1].
    """
    # Filter to the target date's hours
    day_indices = []
    for i, t in enumerate(times):
        try:
            dt = datetime.fromisoformat(t)
            if dt.date() == target_date:
                day_indices.append(i)
        except (ValueError, TypeError):
            continue

    if not day_indices:
        return 0.5  # no data for target date

    day_data = hourly_ensemble[day_indices, :]  # shape: (hours_in_day, members)

    if direction == "above":
        # For each member, take the max across the day's hours
        member_maxes = np.nanmax(day_data, axis=0)  # shape: (members,)
        prob = float(np.sum(member_maxes > threshold) / len(member_maxes))
    elif direction == "below":
        # For each member, take the min across the day's hours
        member_mins = np.nanmin(day_data, axis=0)
        prob = float(np.sum(member_mins < threshold) / len(member_mins))
    else:
        raise ValueError(f"direction must be 'above' or 'below', got '{direction}'")

    return prob


def multi_model_probability(
    model_probs: dict[str, float],
    weights: Optional[dict[str, float]] = None,
) -> float:
    """Combine probabilities from multiple models using weighted average.

    Default weights: ECMWF=0.50, GFS=0.30, ICON=0.20.

    Args:
        model_probs: Dict mapping model name to probability.
        weights: Optional dict mapping model name to weight. Weights are normalized.

    Returns:
        Weighted probability as float in [0, 1].
    """
    if weights is None:
        weights = {
            "ecmwf_ifs": 0.50,
            "gfs_seamless": 0.30,
            "icon_seamless": 0.20,
        }

    total_weight = 0.0
    weighted_sum = 0.0

    for model, prob in model_probs.items():
        w = weights.get(model, 0.0)
        weighted_sum += prob * w
        total_weight += w

    if total_weight == 0.0:
        # Fall back to simple average
        values = list(model_probs.values())
        return sum(values) / len(values) if values else 0.5

    return weighted_sum / total_weight
