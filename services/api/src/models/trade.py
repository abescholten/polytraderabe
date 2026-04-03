from enum import Enum
from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class TradeStatus(str, Enum):
    open = "open"
    filled = "filled"
    cancelled = "cancelled"
    resolved = "resolved"


class TradeResponse(BaseModel):
    id: str
    signal_id: Optional[str] = None
    market_id: str
    strategy_name: str
    side: str  # YES or NO
    size: float
    entry_price: float
    fill_price: Optional[float] = None
    is_paper: bool = True
    kelly_fraction: Optional[float] = None
    edge_at_entry: Optional[float] = None
    status: TradeStatus = TradeStatus.open
    outcome: Optional[str] = None
    pnl: Optional[float] = None
    created_at: datetime
