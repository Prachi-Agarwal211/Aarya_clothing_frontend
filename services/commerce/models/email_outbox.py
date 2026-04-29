"""
Email Outbox Model
==================
Persistent queue for transactional emails with retry logic and idempotency.

This replaces synchronous httpx calls to Core service with fire-and-forget
outbox pattern. Guarantees at-least-once delivery with exponential backoff.

Design:
- Email created in same transaction as order status change
- Worker process polls outbox, sends emails, marks sent or records error
- Retry with exponential backoff (1min, 5min, 30min, 2hr, final fail)
- Unique constraint on (order_id, email_type) prevents duplicates
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    Float,
    Index,
    UniqueConstraint,
)
from sqlalchemy.sql import func
from database.database import Base
import enum


class EmailType(enum.Enum):
    """Types of transactional emails."""

    ORDER_CONFIRMATION = "order_confirmation"
    ORDER_SHIPPED = "order_shipped"
    ORDER_DELIVERED = "order_delivered"
    ORDER_CANCELLED = "order_cancelled"
    ORDER_REFUNDED = "order_refunded"


class EmailStatus(enum.Enum):
    """Email delivery status."""

    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"
    RETRYING = "retrying"


class EmailOutbox(Base):
    """Outbox table for reliable async email delivery."""

    __tablename__ = "email_outbox"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    email_type = Column(String(50), nullable=False)  # EmailType value
    status = Column(String(20), nullable=False, default=EmailStatus.PENDING.value)

    # Email content (snapshot at time of order)
    to_email = Column(String(255), nullable=False)
    subject = Column(Text, nullable=False)
    body_html = Column(Text, nullable=False)
    body_text = Column(Text, nullable=True)

    # Metadata for debugging/auditing
    email_metadata = Column(
        Text, nullable=True
    )  # JSON: {"attempts": 0, "last_error": "", ...}

    # Retry state machine
    attempts = Column(Integer, default=0, nullable=False)
    last_attempt_at = Column(DateTime(timezone=True), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True, index=True)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    sent_at = Column(DateTime(timezone=True), nullable=True)

    # Unique constraint: one email of each type per order (idempotency)
    __table_args__ = (
        UniqueConstraint("order_id", "email_type", name="uq_email_outbox_order_type"),
        Index("idx_email_outbox_status_retry", "status", "next_retry_at"),
    )

    def __repr__(self):
        return f"<EmailOutbox(id={self.id}, order={self.order_id}, type={self.email_type}, status={self.status})>"
