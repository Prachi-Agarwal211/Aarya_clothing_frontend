"""Analytics and staff operation models."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Numeric, Boolean
from database.database import Base


class AnalyticsCache(Base):
    """Pre-computed analytics data cache."""
    __tablename__ = "analytics_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    cache_key = Column(String(255), unique=True, nullable=False, index=True)
    data = Column(JSON, nullable=False)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime)


class InventoryMovement(Base):
    """Stock movement/adjustment history for audit trail."""
    __tablename__ = "inventory_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, nullable=False, index=True)
    product_id = Column(Integer, nullable=False, index=True)
    adjustment = Column(Integer, nullable=False)
    reason = Column(String(50), nullable=False)  # restock, damaged_items, return, correction, transfer
    notes = Column(Text)
    supplier = Column(String(255))
    cost_price = Column(Numeric(10, 2))
    performed_by = Column(Integer)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)


class StaffTask(Base):
    """Staff task management."""
    __tablename__ = "staff_tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    assigned_to = Column(Integer, index=True)
    task_type = Column(String(50), nullable=False)  # stock_update, order_processing, quality_check
    title = Column(String(255), nullable=False)
    description = Column(Text)
    priority = Column(String(20), default="medium")
    status = Column(String(20), default="pending", index=True)  # pending, in_progress, completed
    due_time = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class StaffNotification(Base):
    """Staff notifications for real-time alerts."""
    __tablename__ = "staff_notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    notification_type = Column(String(50), nullable=False)  # low_stock, new_order, stock_adjustment
    message = Column(Text, nullable=False)
    data = Column(JSON)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
