"""
Easebuzz Payment Schemas
Pydantic models for Easebuzz payment operations
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from decimal import Decimal
from enum import Enum


class EasebuzzPaymentMethod(str, Enum):
    """Easebuzz supported payment methods"""
    UPI = "upi"
    CREDIT_CARD = "credit_card"
    DEBIT_CARD = "debit_card"
    NET_BANKING = "net_banking"
    WALLET = "wallet"
    EMI = "emi"
    BHIM_UPI = "bhim_upi"
    PHONEPE_UPI = "phonepe_upi"
    GPAY_UPI = "gpay_upi"
    PAYTM_UPI = "paytm_upi"


class EasebuzzPaymentRequest(BaseModel):
    """Easebuzz payment request"""
    txnid: str = Field(..., description="Unique transaction ID")
    amount: str = Field(..., description="Amount in INR (string format)")
    firstname: str = Field(..., description="Customer first name")
    email: str = Field(..., description="Customer email")
    phone: str = Field(..., description="Customer phone number")
    productinfo: str = Field(..., description="Product description")
    surl: str = Field(..., description="Success URL")
    furl: str = Field(..., description="Failure URL")
    udf1: Optional[str] = Field(None, description="User defined field 1")
    udf2: Optional[str] = Field(None, description="User defined field 2")
    udf3: Optional[str] = Field(None, description="User defined field 3")
    udf4: Optional[str] = Field(None, description="User defined field 4")
    udf5: Optional[str] = Field(None, description="User defined field 5")
    address1: Optional[str] = Field(None, description="Address line 1")
    address2: Optional[str] = Field(None, description="Address line 2")
    city: Optional[str] = Field(None, description="City")
    state: Optional[str] = Field(None, description="State")
    country: Optional[str] = Field(None, description="Country")
    zipcode: Optional[str] = Field(None, description="ZIP code")
    
    @validator('amount')
    def validate_amount(cls, v):
        """Validate amount format"""
        try:
            amount = Decimal(v)
            if amount <= 0:
                raise ValueError("Amount must be greater than 0")
            if amount > 100000:  # 1 lakh limit
                raise ValueError("Amount cannot exceed 1,00,000 INR")
            return v
        except Exception as e:
            raise ValueError(f"Invalid amount format: {str(e)}")
    
    @validator('phone')
    def validate_phone(cls, v):
        """Validate phone number"""
        if not v.isdigit() or len(v) < 10 or len(v) > 12:
            raise ValueError("Invalid phone number format")
        return v
    
    @validator('email')
    def validate_email(cls, v):
        """Validate email format"""
        if '@' not in v or '.' not in v:
            raise ValueError("Invalid email format")
        return v


class EasebuzzPaymentResponse(BaseModel):
    """Easebuzz payment response"""
    success: bool = Field(..., description="Payment initiation success")
    payment_url: Optional[str] = Field(None, description="Payment URL for redirect")
    txnid: Optional[str] = Field(None, description="Transaction ID")
    easebuzz_order_id: Optional[str] = Field(None, description="Easebuzz order ID")
    status: str = Field(..., description="Payment status")
    error: Optional[str] = Field(None, description="Error message if failed")


class EasebuzzVerificationRequest(BaseModel):
    """Easebuzz payment verification request"""
    txnid: str = Field(..., description="Transaction ID")
    easebuzz_order_id: str = Field(..., description="Easebuzz order ID")


class EasebuzzVerificationResponse(BaseModel):
    """Easebuzz payment verification response"""
    success: bool = Field(..., description="Verification success")
    status: Optional[str] = Field(None, description="Payment status")
    amount: Optional[str] = Field(None, description="Payment amount")
    txnid: Optional[str] = Field(None, description="Transaction ID")
    easebuzz_order_id: Optional[str] = Field(None, description="Easebuzz order ID")
    payment_mode: Optional[str] = Field(None, description="Payment mode used")
    bank_ref_num: Optional[str] = Field(None, description="Bank reference number")
    card_category: Optional[str] = Field(None, description="Card category")
    error: Optional[str] = Field(None, description="Error message if failed")


class EasebuzzRefundRequest(BaseModel):
    """Easebuzz refund request"""
    txnid: str = Field(..., description="Original transaction ID")
    amount: str = Field(..., description="Refund amount")
    refund_reason: str = Field("Customer request", description="Reason for refund")


class EasebuzzRefundResponse(BaseModel):
    """Easebuzz refund response"""
    success: bool = Field(..., description="Refund success")
    refund_id: Optional[str] = Field(None, description="Refund transaction ID")
    status: Optional[str] = Field(None, description="Refund status")
    amount: Optional[str] = Field(None, description="Refund amount")
    txnid: Optional[str] = Field(None, description="Original transaction ID")
    error: Optional[str] = Field(None, description="Error message if failed")


class EasebuzzPaymentMethod(BaseModel):
    """Easebuzz payment method info"""
    id: str = Field(..., description="Payment method ID")
    name: str = Field(..., description="Payment method name")
    description: str = Field(..., description="Payment method description")
    fee_type: str = Field(..., description="Fee type (percentage/fixed)")
    fee_amount: float = Field(..., description="Fee amount")
    processing_time: str = Field(..., description="Processing time")
    icon: str = Field(..., description="Icon emoji")
    available: bool = Field(True, description="Whether method is available")


class EasebuzzPaymentMethodsResponse(BaseModel):
    """Easebuzz payment methods response"""
    methods: List[EasebuzzPaymentMethod] = Field(..., description="Available payment methods")
    default_method: str = Field(..., description="Default payment method")


class EasebuzzWebhookEvent(BaseModel):
    """Easebuzz webhook event"""
    event: str = Field(..., description="Event type")
    data: Dict[str, Any] = Field(..., description="Event data")


class EasebuzzWebhookResponse(BaseModel):
    """Easebuzz webhook response"""
    processed: bool = Field(..., description="Whether webhook was processed")
    message: str = Field(..., description="Response message")
    event_type: Optional[str] = Field(None, description="Event type processed")
