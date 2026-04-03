---
name: trading-engine
description: >
  Trading logic, risk management, and position sizing specialist for prediction market algorithms.
  Covers Kelly criterion, fractional Kelly, position limits, portfolio risk, paper trading
  implementation, drawdown circuit breakers, kill switches, and strategy lifecycle management.
  Trigger on: "Kelly", "position size", "risk management", "stop loss", "drawdown",
  "circuit breaker", "paper trading", "shadow trading", "dry run", "bankroll", "edge",
  "expected value", "strategy", "algorithm", "signal", "trade execution", "kill switch",
  "semi-automated", "trade approval", or any discussion of trading logic and risk controls.
  When in doubt, trigger it.
---

# Trading Engine

You are a prediction market trading engine specialist. This project trades binary outcome markets
(YES/NO) starting with weather, expanding to other categories. The engine operates in
**semi-automated mode**: algorithms generate signals, humans approve execution.

## Core Architecture

```
Signal Sources (weather, news, etc.)
        │
        ▼
┌─────────────────────┐
│  Strategy Manager    │  Runs all registered strategies
├─────────────────────┤
│  Signal Generator    │  Each strategy produces: probability, edge, confidence
├─────────────────────┤
│  Risk Manager        │  Position sizing, portfolio limits, circuit breakers
├─────────────────────┤
│  Execution Engine    │  Paper mode / Live mode with approval gate
├─────────────────────┤
│  Trade Logger        │  Full audit trail in Supabase
└─────────────────────┘
```

## Kelly Criterion for Binary Markets

### Full Kelly

For a binary market where you buy YES at price `p_market` and believe true probability is `p_true`:

```python
def kelly_fraction(p_true: float, p_market: float) -> float:
    """Full Kelly fraction for binary prediction market.

    Returns the optimal fraction of bankroll to wager.
    Positive = buy YES, negative = buy NO.
    """
    if p_true <= 0 or p_true >= 1 or p_market <= 0 or p_market >= 1:
        return 0.0

    # Edge on YES side
    edge_yes = p_true - p_market
    # Edge on NO side
    edge_no = (1 - p_true) - (1 - p_market)

    if edge_yes > 0:
        # Buy YES: potential profit = (1 - p_market), potential loss = p_market
        return edge_yes / (1 - p_market)
    elif edge_no > 0:
        # Buy NO: potential profit = p_market, potential loss = (1 - p_market)
        return -edge_no / p_market
    else:
        return 0.0  # No edge
```

### Fractional Kelly (Recommended)

Full Kelly is too aggressive for prediction markets due to model uncertainty. Use 15-25% Kelly:

```python
def position_size(
    p_true: float,
    p_market: float,
    bankroll: float,
    kelly_fraction_mult: float = 0.15,  # 15% of full Kelly
    max_position_pct: float = 0.05,     # 5% of bankroll max
    max_position_usd: float = 100.0,    # Hard dollar cap
    min_edge: float = 0.05,             # 5% minimum edge to trade
) -> dict:
    """Compute position size with all safety limits applied.

    Returns dict with size, side, and reasoning.
    """
    full_kelly = kelly_fraction(p_true, p_market)
    edge = abs(p_true - p_market) if full_kelly > 0 else abs((1-p_true) - (1-p_market))

    # No trade if edge below threshold
    if edge < min_edge:
        return {"size": 0, "side": None, "reason": f"Edge {edge:.3f} below minimum {min_edge}"}

    # Fractional Kelly
    raw_size = abs(full_kelly) * kelly_fraction_mult * bankroll

    # Apply all caps
    capped_size = min(
        raw_size,
        max_position_pct * bankroll,
        max_position_usd,
    )

    # Minimum trade size (Polymarket minimum is ~$1)
    if capped_size < 1.0:
        return {"size": 0, "side": None, "reason": "Position too small after caps"}

    side = "YES" if full_kelly > 0 else "NO"

    return {
        "size": round(capped_size, 2),
        "side": side,
        "edge": round(edge, 4),
        "full_kelly": round(abs(full_kelly), 4),
        "fractional_kelly": round(abs(full_kelly) * kelly_fraction_mult, 4),
        "reason": f"Edge={edge:.1%}, Kelly={abs(full_kelly):.1%}, Size=${capped_size:.2f} {side}",
    }
```

## Expected Value

```python
def expected_value(p_true: float, p_market: float, size: float, side: str) -> float:
    """Expected profit/loss for a binary market trade.

    For YES at price p_market:
      Win: profit = size × (1 - p_market) / p_market  [per share profit × shares]
      Lose: loss = -size
      EV = p_true × profit + (1 - p_true) × loss

    Simplified: EV per dollar = p_true - p_market (for YES)
    """
    if side == "YES":
        return size * (p_true - p_market) / p_market
    else:
        return size * ((1 - p_true) - (1 - p_market)) / (1 - p_market)
```

## Risk Management

### Portfolio Limits

```python
from dataclasses import dataclass, field
from datetime import datetime, timedelta

@dataclass
class RiskLimits:
    """Hard limits that cannot be exceeded. Change requires code review."""
    max_position_pct: float = 0.05        # 5% per market
    max_portfolio_pct: float = 0.30       # 30% total exposure
    max_position_usd: float = 100.0       # Hard dollar cap per position
    daily_stop_loss_pct: float = 0.05     # 5% daily loss limit
    drawdown_circuit_breaker: float = 0.15 # 15% from peak stops all trading
    max_correlated_exposure: float = 0.15  # 15% in correlated markets
    min_edge_threshold: float = 0.05       # 5% minimum edge
    max_trades_per_day: int = 20           # Rate limit on trade count
    min_time_to_resolution_hours: int = 6  # Don't trade markets resolving in <6h


@dataclass
class PortfolioState:
    """Current portfolio state, persisted in Supabase."""
    bankroll: float = 10000.0
    peak_bankroll: float = 10000.0
    positions: dict = field(default_factory=dict)  # market_id -> {size, side, entry_price}
    daily_pnl: float = 0.0
    daily_trades: int = 0
    last_reset: datetime = field(default_factory=datetime.utcnow)
    is_halted: bool = False
    halt_reason: str = ""
```

### Risk Checks

```python
class RiskManager:
    def __init__(self, limits: RiskLimits, state: PortfolioState):
        self.limits = limits
        self.state = state

    def check_trade(self, market_id: str, size: float, side: str, edge: float) -> dict:
        """Run all risk checks before allowing a trade. Returns pass/fail with reasons."""
        checks = []

        # 1. Circuit breaker
        if self.state.is_halted:
            return {"allowed": False, "reason": f"Trading halted: {self.state.halt_reason}"}

        # 2. Drawdown check
        drawdown = 1 - (self.state.bankroll / self.state.peak_bankroll)
        if drawdown >= self.limits.drawdown_circuit_breaker:
            self.state.is_halted = True
            self.state.halt_reason = f"Drawdown {drawdown:.1%} exceeded {self.limits.drawdown_circuit_breaker:.1%}"
            return {"allowed": False, "reason": self.state.halt_reason}

        # 3. Daily stop loss
        if abs(self.state.daily_pnl) >= self.limits.daily_stop_loss_pct * self.state.bankroll:
            checks.append(f"Daily stop loss hit: {self.state.daily_pnl:.2f}")

        # 4. Position size limit
        if size > self.limits.max_position_pct * self.state.bankroll:
            checks.append(f"Position {size:.2f} exceeds {self.limits.max_position_pct:.0%} of bankroll")

        # 5. Dollar cap
        if size > self.limits.max_position_usd:
            checks.append(f"Position ${size:.2f} exceeds ${self.limits.max_position_usd} cap")

        # 6. Portfolio exposure
        total_exposure = sum(p["size"] for p in self.state.positions.values()) + size
        if total_exposure > self.limits.max_portfolio_pct * self.state.bankroll:
            checks.append(f"Total exposure {total_exposure:.2f} exceeds {self.limits.max_portfolio_pct:.0%}")

        # 7. Minimum edge
        if edge < self.limits.min_edge_threshold:
            checks.append(f"Edge {edge:.3f} below minimum {self.limits.min_edge_threshold}")

        # 8. Daily trade count
        if self.state.daily_trades >= self.limits.max_trades_per_day:
            checks.append(f"Daily trade limit ({self.limits.max_trades_per_day}) reached")

        # 9. Duplicate position check
        if market_id in self.state.positions:
            existing = self.state.positions[market_id]
            if existing["side"] != side:
                checks.append(f"Already have {existing['side']} position — would need to close first")

        if checks:
            return {"allowed": False, "reason": "; ".join(checks)}

        return {"allowed": True, "reason": "All checks passed"}
```

## Paper Trading Implementation

### Three-Gate Safety

Live trading requires ALL THREE to be true:

```python
import os

def is_live_trading_enabled() -> bool:
    """Three independent gates must all be true for live trading."""
    gate_1 = os.environ.get("ENABLE_LIVE_TRADING") == "true"
    gate_2 = not os.path.exists("/tmp/TRADING_STOP")  # Kill switch file
    gate_3 = True  # Per-order dry_run flag (checked at execution time)
    return gate_1 and gate_2 and gate_3
```

### Paper Trade Execution

```python
from datetime import datetime
from typing import Optional

@dataclass
class TradeRecord:
    id: str
    market_id: str
    strategy: str
    side: str              # "YES" or "NO"
    size: float            # USDC amount
    entry_price: float     # Market price at signal time
    our_probability: float
    edge: float
    kelly_fraction: float
    timestamp: datetime
    is_paper: bool = True
    order_id: Optional[str] = None  # Polymarket order ID (None if paper)
    fill_price: Optional[float] = None
    resolved: bool = False
    outcome: Optional[int] = None  # 1=YES won, 0=NO won
    pnl: Optional[float] = None

    def compute_pnl(self, outcome: int) -> float:
        """Compute profit/loss after resolution."""
        price = self.fill_price or self.entry_price
        if self.side == "YES":
            if outcome == 1:
                return self.size * (1 - price) / price  # Profit
            else:
                return -self.size  # Loss
        else:  # NO
            if outcome == 0:
                return self.size * price / (1 - price)  # Profit
            else:
                return -self.size  # Loss
```

## Strategy Interface

Every algorithm must implement this interface:

```python
from abc import ABC, abstractmethod
from typing import Optional

class TradingStrategy(ABC):
    """Base class for all trading strategies."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Unique strategy identifier."""
        ...

    @property
    @abstractmethod
    def category(self) -> str:
        """Market category: 'weather', 'politics', 'sports', etc."""
        ...

    @abstractmethod
    async def find_markets(self) -> list[dict]:
        """Discover tradeable markets for this strategy."""
        ...

    @abstractmethod
    async def generate_signal(self, market: dict) -> Optional[dict]:
        """Analyze a market and return a signal or None.

        Signal dict must contain:
        - our_probability: float (0-1)
        - market_price: float (0-1)
        - edge: float
        - confidence: str ('high', 'medium', 'low')
        - reasoning: str
        """
        ...

    @abstractmethod
    async def backtest(self, start_date: str, end_date: str) -> dict:
        """Run historical backtest. Returns performance metrics."""
        ...
```

### Weather Strategy Implementation Pattern

```python
class WeatherTemperatureStrategy(TradingStrategy):
    name = "weather_temperature"
    category = "weather"

    async def find_markets(self) -> list[dict]:
        # Use Gamma API to find temperature markets
        # Filter for: active, binary, >24h to resolution, sufficient liquidity
        ...

    async def generate_signal(self, market: dict) -> Optional[dict]:
        # 1. Parse market question for: location, threshold, date, direction
        # 2. Fetch multi-model ensemble from Open-Meteo
        # 3. Compute weighted probability
        # 4. Compare to market price
        # 5. Return signal if edge exceeds threshold
        ...

    async def backtest(self, start_date: str, end_date: str) -> dict:
        # 1. Fetch historical markets from Gamma API
        # 2. For each resolved market, fetch historical forecast from that date
        # 3. Compute what our signal would have been
        # 4. Calculate P&L, Brier score, calibration
        ...
```

## Strategy Manager

```python
class StrategyManager:
    """Orchestrates all registered strategies."""

    def __init__(self, strategies: list[TradingStrategy], risk_manager: RiskManager):
        self.strategies = {s.name: s for s in strategies}
        self.risk = risk_manager

    async def run_scan(self) -> list[dict]:
        """Run all strategies, collect signals, apply risk checks."""
        all_signals = []

        for name, strategy in self.strategies.items():
            markets = await strategy.find_markets()
            for market in markets:
                signal = await strategy.generate_signal(market)
                if signal and signal["edge"] >= self.risk.limits.min_edge_threshold:
                    # Compute position size
                    sizing = position_size(
                        signal["our_probability"],
                        signal["market_price"],
                        self.risk.state.bankroll,
                    )
                    if sizing["size"] > 0:
                        # Risk check
                        risk_check = self.risk.check_trade(
                            market["condition_id"],
                            sizing["size"],
                            sizing["side"],
                            signal["edge"],
                        )
                        all_signals.append({
                            "strategy": name,
                            "market": market,
                            "signal": signal,
                            "sizing": sizing,
                            "risk_check": risk_check,
                        })

        return all_signals
```

## Semi-Automated Approval Flow

```python
from enum import Enum

class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"

@dataclass
class TradeProposal:
    """A trade waiting for human approval."""
    id: str
    signal: dict
    sizing: dict
    risk_check: dict
    status: ApprovalStatus = ApprovalStatus.PENDING
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: datetime = field(default_factory=lambda: datetime.utcnow() + timedelta(hours=2))
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None
```

The dashboard shows pending proposals. User clicks approve/reject. Only approved proposals execute.

## Go-Live Criteria

Before transitioning from paper to live trading, ALL of these must be met:

1. **30+ resolved markets** in paper trading with positive ROI
2. **Brier score below 0.058** (Polymarket's aggregate benchmark)
3. **Calibration accuracy within 5%** across all probability bins
4. **Maximum drawdown within tolerance** during paper period
5. **Strategy has been running >2 weeks** in paper mode
6. **Manual review of all losing trades** — understood and acceptable
7. **Kill switch tested** — confirm it halts trading within 1 minute

## Safety Rules

1. **Paper mode is the default** — ALWAYS. Live trading requires explicit, deliberate activation.
2. **Position limits are immutable** — hard-coded, not configurable via UI or env vars alone
3. **Every trade is logged** — paper or live, with full signal context, for audit
4. **Kill switch is always accessible** — via env var, file flag, or database toggle
5. **No strategy can bypass risk checks** — the RiskManager is the single gate
6. **Semi-automated means human in the loop** — never auto-execute without approval
7. **Drawdown circuit breaker is automatic** — no human override without code change
