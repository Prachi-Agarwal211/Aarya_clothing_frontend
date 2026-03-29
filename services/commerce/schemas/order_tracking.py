"""Order tracking schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models.order import OrderStatus


class OrderTrackingCreate(BaseModel):
    """Schema for creating an order tracking entry."""
    order_id: int
    status: OrderStatus
    location: Optional[str] = None
    notes: Optional[str] = None
    updated_by: Optional[int] = None


class OrderTrackingResponse(BaseModel):
    """Schema for order tracking response."""
    id: int
    order_id: int
    status: OrderStatus
    location: Optional[str]
    notes: Optional[str]
    updated_by: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True
