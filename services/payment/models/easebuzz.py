"""
Easebuzz Payment Models
Database models for Easebuzz payment transactions
"""

from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Numeric, JSON
from sqlalchemy.sql import func
from database.database import Base


class EasebuzzTransaction(Base):
    """Easebuzz payment transaction model"""
    __tablename__ = "easebuzz_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String(100), unique=True, index=True, nullable=False)
    easebuzz_order_id = Column(String(100), index=True, nullable=False)
    txnid = Column(String(100), index=True, nullable=False)
    
    # Payment details
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="INR", nullable=False)
    payment_mode = Column(String(50), nullable=True)
    bank_ref_num = Column(String(100), nullable=True)
    card_category = Column(String(50), nullable=True)
    
    # Customer details
    firstname = Column(String(100), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=False)
    productinfo = Column(Text, nullable=False)
    
    # Address details
    address1 = Column(String(255), nullable=True)
    address2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    zipcode = Column(String(20), nullable=True)
    
    # URLs and callbacks
    surl = Column(Text, nullable=False)
    furl = Column(Text, nullable=False)
    
    # Status tracking
    status = Column(String(50), default="initiated", nullable=False)
    easebuzz_status = Column(String(50), nullable=True)
    payment_url = Column(Text, nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    
    # Metadata
    udf1 = Column(String(255), nullable=True)
    udf2 = Column(String(255), nullable=True)
    udf3 = Column(String(255), nullable=True)
    udf4 = Column(String(255), nullable=True)
    udf5 = Column(String(255), nullable=True)
    
    # Foreign keys (no FK constraint - cross-service reference)
    user_id = Column(Integer, nullable=True, index=True)
    order_id = Column(Integer, nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<EasebuzzTransaction(id={self.id}, transaction_id={self.transaction_id}, status={self.status})>"


class EasebuzzRefund(Base):
    """Easebuzz refund model"""
    __tablename__ = "easebuzz_refunds"
    
    id = Column(Integer, primary_key=True, index=True)
    refund_id = Column(String(100), unique=True, index=True, nullable=False)
    original_transaction_id = Column(String(100), nullable=False, index=True)
    
    # Refund details
    amount = Column(Numeric(10, 2), nullable=False)
    refund_reason = Column(Text, nullable=False)
    status = Column(String(50), default="initiated", nullable=False)
    
    # Easebuzz details
    easebuzz_refund_id = Column(String(100), nullable=True)
    easebuzz_status = Column(String(50), nullable=True)
    
    # Error handling
    error_message = Column(Text, nullable=True)
    error_code = Column(String(50), nullable=True)
    
    # Metadata
    processed_by = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<EasebuzzRefund(id={self.id}, refund_id={self.refund_id}, status={self.status})>"


class EasebuzzWebhookLog(Base):
    """Easebuzz webhook log model"""
    __tablename__ = "easebuzz_webhook_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    webhook_id = Column(String(100), unique=True, index=True, nullable=False)
    event_type = Column(String(100), nullable=False)
    
    # Webhook data
    payload = Column(JSON, nullable=False)
    signature = Column(String(512), nullable=True)
    
    # Processing status
    processed = Column(Boolean, default=False, nullable=False)
    processing_attempts = Column(Integer, default=0, nullable=False)
    error_message = Column(Text, nullable=True)
    
    # Related transaction
    transaction_id = Column(String(100), nullable=True, index=True)
    
    # Timestamps
    received_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    
    def __repr__(self):
        return f"<EasebuzzWebhookLog(id={self.id}, event_type={self.event_type}, processed={self.processed})>"
