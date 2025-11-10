from datetime import datetime

from pydantic import BaseModel, Field


class ProductionOrder(BaseModel):
    id: int
    product_code: str = Field(..., examples=["WIDGET-001"])
    scheduled_start: datetime
    scheduled_end: datetime
    quantity: int = Field(..., ge=1)
    status: str = Field(..., examples=["scheduled", "in_progress", "completed"])
