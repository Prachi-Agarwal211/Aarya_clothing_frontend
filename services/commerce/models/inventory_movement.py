"""InventoryMovement - audit trail for every stock change.

Every adjustment (sale, restock, manual, return, correction) writes one row.
Used by admin/reporting to reconstruct stock history.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database.database import Base
from shared.time_utils import ist_naive


VALID_REASONS = ("order", "restock", "manual", "return", "correction")


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id           = Column(Integer, primary_key=True, index=True)
    variant_id   = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    delta        = Column(Integer, nullable=False)
    reason       = Column(String(32), nullable=False)
    notes        = Column(Text)
    performed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at   = Column(DateTime, default=ist_naive, index=True)

    variant = relationship("ProductVariant", back_populates="movements")
