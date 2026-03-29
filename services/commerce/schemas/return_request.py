"""Return request schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal

from models.return_request import ReturnReason, ReturnStatus, ReturnType


class ReturnRequestCreate(BaseModel):
    """Schema for creating a return request."""
    order_id: int
    reason: ReturnReason
    description: Optional[str] = None
    # Enhanced return fields - aligned with migration
    type: str = "return"  # "return" or "exchange"
    items: List[dict] = []  # Array of items to return: [{item_id, quantity, reason}, ...]
    exchange_preference: Optional[str] = None  # e.g., "exchange", "refund", "store_credit"
    video_url: Optional[str] = None  # URL of uploaded video evidence


class ReturnRequestUpdate(BaseModel):
    """Schema for updating a return request (staff)."""
    status: Optional[ReturnStatus] = None
    refund_amount: Optional[Decimal] = None
    rejection_reason: Optional[str] = None
    return_tracking_number: Optional[str] = None
    is_item_received: Optional[bool] = None


class ReturnRequestResponse(BaseModel):
    """Schema for return request response."""
    id: int
    order_id: int
    user_id: int
    reason: ReturnReason
    type: str  # "return" or "exchange"
    items: Optional[str] = None  # JSON string of items array
    description: Optional[str]
    # Enhanced return fields
    exchange_preference: Optional[str] = None
    video_url: Optional[str] = None
    # Existing fields
    status: ReturnStatus
    refund_amount: Optional[Decimal]
    refund_transaction_id: Optional[str]
    approved_by: Optional[int]
    rejection_reason: Optional[str]
    return_tracking_number: Optional[str]
    is_item_received: bool
    requested_at: datetime
    approved_at: Optional[datetime]
    received_at: Optional[datetime]
    refunded_at: Optional[datetime]
    updated_at: datetime
    
    class Config:
        from_attributes = True
