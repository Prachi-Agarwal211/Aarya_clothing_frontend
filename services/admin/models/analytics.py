"""Analytics + staff operation models for the admin service.

Note: `InventoryMovement` is also defined in `services/commerce/models/inventory_movement.py`
because both services share the same Postgres table. They must stay schema-compatible.
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Boolean
from database.database import Base

from shared.time_utils import ist_naive


class AnalyticsCache(Base):
    """Pre-computed analytics data cache."""
    __tablename__ = "analytics_cache"

    id           = Column(Integer, primary_key=True, index=True)
    cache_key    = Column(String(255), unique=True, nullable=False, index=True)
    data         = Column(JSON, nullable=False)
    period_start = Column(DateTime)
    period_end   = Column(DateTime)
    created_at   = Column(DateTime, default=ist_naive)
    expires_at   = Column(DateTime)


class InventoryMovement(Base):
    """Stock movement audit row. Mirrors `commerce/models/inventory_movement.py`."""
    __tablename__ = "inventory_movements"

    id           = Column(Integer, primary_key=True, index=True)
    variant_id   = Column(Integer, nullable=False, index=True)
    delta        = Column(Integer, nullable=False)
    reason       = Column(String(32), nullable=False)
    notes        = Column(Text)
    performed_by = Column(Integer)
    created_at   = Column(DateTime, default=ist_naive, index=True)


class StaffTask(Base):
    """Staff task management."""
    __tablename__ = "staff_tasks"

    id           = Column(Integer, primary_key=True, index=True)
    assigned_to  = Column(Integer, index=True)
    task_type    = Column(String(50),  nullable=False)
    title        = Column(String(255), nullable=False)
    description  = Column(Text)
    priority     = Column(String(20),  default="medium")
    status       = Column(String(20),  default="pending", index=True)
    due_time     = Column(DateTime)
    completed_at = Column(DateTime)
    created_at   = Column(DateTime, default=ist_naive)
    updated_at   = Column(DateTime, default=ist_naive, onupdate=ist_naive)


class StaffNotification(Base):
    """Staff notifications for real-time alerts."""
    __tablename__ = "staff_notifications"

    id                = Column(Integer, primary_key=True, index=True)
    user_id           = Column(Integer, index=True)
    notification_type = Column(String(50), nullable=False)
    message           = Column(Text, nullable=False)
    data              = Column(JSON)
    is_read           = Column(Boolean, default=False)
    created_at        = Column(DateTime, default=ist_naive)
