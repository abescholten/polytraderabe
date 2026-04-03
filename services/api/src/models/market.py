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
