"""Stock reservation models for commerce service."""
import enum
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum

from shared.time_utils import ist_naive
from database.database import Base


class ReservationStatus(str, enum.Enum):
    """Reservation status enumeration."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    RELEASED = "released"
    EXPIRED = "expired"


class StockReservation(Base):
    """Model for tracking temporary stock reservations."""
    __tablename__ = "stock_reservations"
    
    id = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(String(100), unique=True, index=True, nullable=False)
    user_id = Column(Integer, index=True, nullable=False)
    sku = Column(String(50), index=True, nullable=False)
    quantity = Column(Integer, nullable=False)
    
    status = Column(Enum(ReservationStatus, native_enum=False, length=20), default=ReservationStatus.PENDING, nullable=False)
    
    expires_at = Column(DateTime, nullable=False, index=True)
    order_id = Column(Integer, nullable=True, index=True)
    payment_ref = Column(String(255), nullable=True)
    
    created_at = Column(DateTime, default=lambda: ist_naive(), index=True)
    updated_at = Column(DateTime, default=lambda: ist_naive(), onupdate=lambda: ist_naive())
