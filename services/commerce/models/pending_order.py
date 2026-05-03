"""Pending order model for checkout snapshots."""
from sqlalchemy import Column, Integer, String, DateTime, Numeric, JSON, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
import uuid

from database.database import Base
from shared.time_utils import ist_naive

class PendingOrder(Base):
    __tablename__ = "pending_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    payment_intent_id = Column(UUID(as_uuid=True), default=uuid.uuid4, nullable=False)
    
    # Payment details
    razorpay_order_id = Column(String(100), nullable=True, index=True)
    razorpay_payment_id = Column(String(100), nullable=True, index=True)
    qr_code_id = Column(String(100), nullable=True)
    payment_method = Column(String(50), default='razorpay')
    
    # Cart snapshot
    cart_snapshot = Column(JSONB, nullable=False)
    
    # Order details
    shipping_address = Column(Text, nullable=False)
    address_id = Column(Integer, nullable=True)
    promo_code = Column(String(50), nullable=True)
    order_notes = Column(Text, nullable=True)
    subtotal = Column(Numeric(10,2), nullable=False)
    discount_applied = Column(Numeric(10,2), default=0)
    shipping_cost = Column(Numeric(10,2), default=0)
    gst_amount = Column(Numeric(10,2), default=0)
    cgst_amount = Column(Numeric(10,2), default=0)
    sgst_amount = Column(Numeric(10,2), default=0)
    igst_amount = Column(Numeric(10,2), default=0)
    total_amount = Column(Numeric(10,2), nullable=False)
    delivery_state = Column(String(50), nullable=True)
    customer_gstin = Column(String(15), nullable=True)
    
    # Status tracking
    status = Column(String(30), default='pending')
    order_id = Column(Integer, nullable=True)
    transaction_id = Column(String(255), nullable=True)
    
    # Timing
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=ist_naive)
    updated_at = Column(DateTime(timezone=True), default=ist_naive, onupdate=ist_naive)
    payment_completed_at = Column(DateTime(timezone=True), nullable=True)
    order_created_at = Column(DateTime(timezone=True), nullable=True)
    
    # Error tracking
    error_message = Column(Text, nullable=True)
    error_details = Column(JSONB, nullable=True)
    retry_count = Column(Integer, default=0)
