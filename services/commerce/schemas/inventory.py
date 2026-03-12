"""Inventory schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class InventoryBase(BaseModel):
    """Base inventory schema."""
    sku: str
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int = 0
    low_stock_threshold: int = 10


class InventoryCreate(InventoryBase):
    """Schema for creating inventory."""
    product_id: int


class InventoryUpdate(BaseModel):
    """Schema for updating inventory."""
    quantity: Optional[int] = None
    reserved_quantity: Optional[int] = None
    low_stock_threshold: Optional[int] = None


class InventoryResponse(BaseModel):
    """Schema for inventory response."""
    id: int
    product_id: int
    sku: str
    size: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    reserved_quantity: int
    low_stock_threshold: int
    available_quantity: int
    is_low_stock: bool
    is_out_of_stock: bool
    updated_at: datetime
    
    class Config:
        from_attributes = True


class StockAdjustment(BaseModel):
    """Schema for stock adjustment."""
    sku: str
    adjustment: int  # Positive to add, negative to subtract
    reason: Optional[str] = None


class LowStockItem(BaseModel):
    """Schema for low stock alert."""
    product_id: int
    product_name: str
    sku: str
    size: Optional[str]
    color: Optional[str]
    available_quantity: int
    low_stock_threshold: int
