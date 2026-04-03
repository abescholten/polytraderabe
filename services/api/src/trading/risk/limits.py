from dataclasses import dataclass, field


@dataclass
class RiskLimits:
    """Position and portfolio risk limits for the trading system."""

    # Position sizing
    max_position_pct: float = 0.05        # Max 5% of portfolio per position
    max_portfolio_pct: float = 0.30        # Max 30% total portfolio in positions
    max_position_usd: float = 100.0        # Hard dollar cap per position

    # Drawdown controls
    daily_stop_loss_pct: float = 0.05      # Stop trading if daily loss exceeds 5%
    drawdown_circuit_breaker: float = 0.15 # Halt if total drawdown exceeds 15%

    # Correlation / concentration
    max_correlated_exposure: float = 0.15  # Max 15% in correlated markets

    # Signal quality
    min_edge_threshold: float = 0.05       # Minimum 5% edge to trade

    # Activity limits
    max_trades_per_day: int = 20
    min_time_to_resolution_hours: int = 6  # Don't trade markets resolving in < 6h
