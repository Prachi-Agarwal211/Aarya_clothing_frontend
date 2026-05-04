"""Payment schemas for payment service."""
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Dict, Any
from decimal import Decimal
from enum import Enum


# ==================== Enums ====================

class PaymentMethod(str, Enum):
    RAZORPAY = "razorpay"
    CARD = "card"
    UPI = "upi"
    UPI_QR = "upi_qr"
    NETBANKING = "netbanking"
    WALLET = "wallet"


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class RefundStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ==================== Razorpay Schemas ====================

class RazorpayOrderRequest(BaseModel):
    """Request to create Razorpay order."""
    amount: Decimal = Field(..., gt=0, description="Amount in smallest currency unit (paise)")
    currency: str = Field(default="INR", description="Currency code")
    receipt: Optional[str] = Field(None, max_length=40, description="Receipt ID (max 40 characters)")
    notes: Optional[Dict[str, str]] = None
    # Snapshot fields for backup (prevents data loss if webhook fails)
    cart_snapshot: Optional[List[Dict[str, Any]]] = None
    shipping_address: Optional[str] = None


class RazorpayOrderResponse(BaseModel):
    """Razorpay order creation response."""
    id: str
    entity: str
    amount: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    currency: str
    receipt: Optional[str]
    offer_id: Optional[str]
    status: str
    attempts: int
    notes: Optional[Any] = None  # Razorpay may return [] (list) or {} (dict)
    created_at: int


class RazorpayPaymentVerification(BaseModel):
    """Razorpay payment verification request."""
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# ==================== QR Code Schemas ====================

class QrCodeCreateRequest(BaseModel):
    """Request to create a UPI QR code."""
    amount: Decimal = Field(..., gt=0, description="Amount in smallest currency unit (paise)")
    description: str = Field(..., min_length=1, max_length=255, description="Payment description")
    notes: Optional[Dict[str, str]] = None
    # Snapshot fields
    cart_snapshot: Optional[List[Dict[str, Any]]] = None
    shipping_address: Optional[str] = None


class QrCodeCreateResponse(BaseModel):
    """QR code creation response."""
    success: bool
    qr_code_id: str
    image_url: str
    amount: Decimal
    currency: str
    expires_at: int  # Unix timestamp
    transaction_id: Optional[str] = None


class QrCodeStatusResponse(BaseModel):
    """QR code status response."""
    qr_code_id: str
    status: str  # active, paid, expired
    amount: Decimal
    payment_id: Optional[str] = None
    paid_at: Optional[int] = None
    expires_at: int


# ==================== Payment Schemas ====================

class PaymentRequest(BaseModel):
    """Payment request schema."""
    order_id: int
    user_id: int
    amount: Decimal = Field(..., gt=0)
    currency: str = Field(default="INR")
    payment_method: PaymentMethod
    customer_email: Optional[EmailStr] = None
    customer_phone: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[Dict[str, str]] = None
    # Snapshot fields
    cart_snapshot: Optional[List[Dict[str, Any]]] = None
    shipping_address: Optional[str] = None


class PaymentResponse(BaseModel):
    """Payment response schema."""
    success: bool
    transaction_id: str
    status: PaymentStatus
    message: str
    amount: Decimal
    currency: str
    payment_method: PaymentMethod
    
    # Razorpay specific fields
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    
    # Additional fields
    gateway_response: Optional[Dict[str, Any]] = None
    redirect_url: Optional[str] = None


class PaymentStatusResponse(BaseModel):
    """Payment status response."""
    transaction_id: str
    order_id: int
    user_id: int
    amount: Decimal
    currency: str
    status: PaymentStatus
    payment_method: PaymentMethod
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None
    
    # Razorpay details
    razorpay_order_id: Optional[str] = None
    razorpay_payment_id: Optional[str] = None
    
    # Refund details
    refund_amount: Optional[Decimal] = None
    refund_id: Optional[str] = None
    refund_status: Optional[RefundStatus] = None
    refund_reason: Optional[str] = None


# ==================== Refund Schemas ====================

class RefundRequest(BaseModel):
    """Refund request schema."""
    transaction_id: str
    amount: Optional[Decimal] = None  # If not provided, refund full amount
    reason: str = Field(..., min_length=1, max_length=500)


class RefundResponse(BaseModel):
    """Refund response schema."""
    success: bool
    refund_id: str
    transaction_id: str
    refund_amount: Decimal
    status: RefundStatus
    message: str
    gateway_response: Optional[Dict[str, Any]] = None


# ==================== Webhook Schemas ====================

class WebhookEvent(BaseModel):
    """Webhook event schema."""
    event: str
    payload: Dict[str, Any]


class WebhookResponse(BaseModel):
    """Webhook processing response."""
    processed: bool
    message: str
    event_type: Optional[str] = None


# ==================== Payment Method Schemas ====================

class PaymentMethodInfo(BaseModel):
    """Payment method information."""
    name: str
    display_name: str
    is_active: bool
    supported_currencies: List[str] = []
    min_amount: Optional[Decimal] = None
    max_amount: Optional[Decimal] = None


class PaymentMethodsResponse(BaseModel):
    """Available payment methods response."""
    methods: List[PaymentMethodInfo]
    default_method: Optional[str] = None


# ==================== Transaction History ====================

class TransactionHistoryRequest(BaseModel):
    """Transaction history request."""
    user_id: Optional[int] = None
    order_id: Optional[int] = None
    status: Optional[PaymentStatus] = None
    payment_method: Optional[PaymentMethod] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=50, ge=1, le=100)


class TransactionSummary(BaseModel):
    """Transaction summary."""
    total_transactions: int
    total_amount: Decimal
    successful_transactions: int
    successful_amount: Decimal
    failed_transactions: int
    refunded_transactions: int
    refunded_amount: Decimal
