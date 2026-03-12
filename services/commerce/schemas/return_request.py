"""Return request schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal

from models.return_request import ReturnReason, ReturnStatus


class ReturnRequestCreate(BaseModel):
    """Schema for creating a return request."""
    order_id: int
    reason: ReturnReason
    description: Optional[str] = None


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
    description: Optional[str]
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
