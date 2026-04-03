from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class StrategyResponse(BaseModel):
    id: str
    name: str
    category: str
    description: Optional[str] = None
    is_active: bool = True
    config: dict = {}
    created_at: datetime
