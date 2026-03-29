"""Payment models for payment service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Numeric, Text, Boolean, JSON
from database.database import Base


class PaymentTransaction(Base):
    """Payment transaction model."""
    __tablename__ = "payment_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="INR")
    payment_method = Column(String(50), nullable=False)  # razorpay, card, upi, etc.

    # Razorpay specific
    razorpay_order_id = Column(String(100), nullable=True, index=True)
    razorpay_payment_id = Column(String(100), nullable=True, index=True)
    razorpay_signature = Column(String(500), nullable=True)

    # Cashfree specific
    cashfree_order_id = Column(String(100), nullable=True, index=True)
    cashfree_reference_id = Column(String(100), nullable=True, index=True)
    cashfree_session_id = Column(String(100), nullable=True)
    cashfree_signature = Column(String(500), nullable=True)
    
    # Transaction details
    transaction_id = Column(String(100), nullable=False, unique=True, index=True)
    status = Column(String(50), default="pending")  # pending, processing, completed, failed, refunded
    gateway_response = Column(JSON, nullable=True)  # Store full gateway response
    
    # Metadata
    description = Column(Text, nullable=True)
    customer_email = Column(String(255), nullable=True)
    customer_phone = Column(String(20), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    
    # Refund details
    refund_amount = Column(Numeric(10, 2), nullable=True)
    refund_id = Column(String(100), nullable=True)
    refund_status = Column(String(50), nullable=True)
    refund_reason = Column(Text, nullable=True)


class PaymentMethod(Base):
    """Payment method configuration."""
    __tablename__ = "payment_methods"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # razorpay, upi, card, etc.
    display_name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    config = Column(JSON, nullable=True)  # Store method-specific config
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class WebhookEvent(Base):
    """Webhook event log."""
    __tablename__ = "webhook_events"
    
    id = Column(Integer, primary_key=True, index=True)
    gateway = Column(String(50), nullable=False)  # razorpay
    event_type = Column(String(100), nullable=False)
    event_id = Column(String(100), nullable=True, unique=True)
    payload = Column(JSON, nullable=False)
    processed = Column(Boolean, default=False)
    processing_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at = Column(DateTime, nullable=True)
