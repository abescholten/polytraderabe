from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class MarketResponse(BaseModel):
    id: str
    condition_id: str
    question: str
    category: str
    yes_token_id: Optional[str] = None
    no_token_id: Optional[str] = None
    end_date: Optional[datetime] = None
    active: bool = True
    closed: bool = False
    resolved: bool = False
    outcome: Optional[str] = None
    volume: Optional[float] = None
    best_bid: Optional[float] = None
    best_ask: Optional[float] = None


class OrderbookLevel(BaseModel):
    price: str
    size: str


class OrderbookSnapshotResponse(BaseModel):
    market_id: str
    token_id: str
    side: str
    bids: list[OrderbookLevel]
    asks: list[OrderbookLevel]
    best_bid: Optional[float] = None
    best_ask: Optional[float] = None
    mid_price: Optional[float] = None
    spread: Optional[float] = None
    bid_depth: float = 0
    ask_depth: float = 0
    recorded_at: str


class OddsTimepoint(BaseModel):
    recorded_at: str
    best_bid: Optional[float] = None
    best_ask: Optional[float] = None
    mid_price: Optional[float] = None
    spread: Optional[float] = None
    bid_depth: float = 0
    ask_depth: float = 0
