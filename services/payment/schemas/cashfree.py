"""Cashfree payment schemas."""
from pydantic import BaseModel
from typing import Optional, Dict, Any
from decimal import Decimal


class CashfreeOrderRequest(BaseModel):
    """Request to create a Cashfree order."""
    amount: Decimal
    currency: str = "INR"
    customer_name: Optional[str] = None
    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    order_note: Optional[str] = "Aarya Clothing Order"


class CashfreeOrderResponse(BaseModel):
    """Response after creating a Cashfree order."""
    success: bool
    cf_order_id: Optional[str] = None
    order_id: Optional[str] = None
    payment_session_id: Optional[str] = None
    order_status: Optional[str] = None
    order_amount: Optional[float] = None
    order_currency: Optional[str] = None
    error: Optional[str] = None


class CashfreeVerifyRequest(BaseModel):
    """Request to verify a Cashfree payment."""
    order_id: str
    cf_payment_id: Optional[str] = None


class CashfreeVerifyResponse(BaseModel):
    """Cashfree payment verification response."""
    success: bool
    order_id: str
    order_status: Optional[str] = None
    payment_status: Optional[str] = None
    cf_payment_id: Optional[str] = None
    payment_amount: Optional[float] = None
    payment_method: Optional[str] = None
    error: Optional[str] = None


class CashfreeRefundRequest(BaseModel):
    """Cashfree refund request."""
    order_id: str
    refund_amount: Decimal
    refund_note: str = "Customer request"


class CashfreeRefundResponse(BaseModel):
    """Cashfree refund response."""
    success: bool
    refund_id: Optional[str] = None
    order_id: Optional[str] = None
    refund_amount: Optional[float] = None
    refund_status: Optional[str] = None
    error: Optional[str] = None


class CashfreeWebhookPayload(BaseModel):
    """Cashfree webhook payload."""
    data: Optional[Dict[str, Any]] = None
    event_time: Optional[str] = None
    type: Optional[str] = None
