from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime


class SignalStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    expired = "expired"
    executed = "executed"


class SignalCreate(BaseModel):
    strategy: str
    market_id: str
    our_probability: float = Field(..., ge=0.0, le=1.0)
    market_price: float = Field(..., ge=0.0, le=1.0)
    edge: float
    confidence: str = Field(..., pattern="^(high|medium|low)$")
    reasoning: str
    model_breakdown: Optional[dict] = None


class SignalResponse(SignalCreate):
    id: str
    status: SignalStatus = SignalStatus.pending
    created_at: datetime
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    trade_id: Optional[str] = None
