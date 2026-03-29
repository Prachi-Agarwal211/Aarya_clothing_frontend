"""Audit log models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, JSON, DateTime
from database.database import Base


class AuditLog(Base):
    """Audit log model for tracking admin/staff actions."""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # User who performed action
    
    # Action details
    action = Column(String(100), nullable=False, index=True)  # e.g., "product.update", "order.cancel"
    resource_type = Column(String(50), nullable=False)  # e.g., "product", "order", "promotion"
    resource_id = Column(Integer, nullable=True, index=True)  # ID of affected resource
    
    # Change tracking
    changes = Column(JSON, nullable=True)  # Before/after values
    description = Column(Text, nullable=True)
    
    # Request metadata
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
