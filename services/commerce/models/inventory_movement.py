"""Inventory movement audit model aligned with current schema."""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text

from database.database import Base
from shared.time_utils import ist_naive


VALID_REASONS = ("order", "restock", "manual", "return", "correction")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(Integer, primary_key=True, index=True)
    inventory_id = Column(Integer, ForeignKey("inventory.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    quantity_change = Column(Integer, nullable=False)
    movement_type = Column(String(32), nullable=False)
    notes = Column(Text)
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, default=ist_naive, index=True)
