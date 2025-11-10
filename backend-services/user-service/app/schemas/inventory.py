from pydantic import BaseModel, Field


class InventoryItem(BaseModel):
    id: int
    sku: str = Field(..., examples=["WIDGET-001"])
    quantity: int = Field(..., ge=0)
    location: str = Field(..., description="Warehouse location code")
