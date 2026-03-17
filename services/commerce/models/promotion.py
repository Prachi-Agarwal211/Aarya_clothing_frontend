"""Promotion models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, Text, Enum, ForeignKey, ARRAY
import enum
from database.database import Base


class DiscountType(str, enum.Enum):
    """Discount type enumeration."""
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class UserType(str, enum.Enum):
    """User type restriction for promotions."""
    ALL = "all"
    NEW = "new"  # First-time customers only
    EXISTING = "existing"  # Returning customers only
    VIP = "vip"  # VIP customers only


class Promotion(Base):
    """Promotion/Coupon model for discount codes with comprehensive validation."""
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)

    # Discount details
    discount_type = Column(Enum(DiscountType, native_enum=False, length=20), nullable=False)
    discount_value = Column(Numeric(10, 2), nullable=False)  # Percentage or fixed amount

    # Conditions
    min_order_value = Column(Numeric(10, 2), default=0)
    max_discount_amount = Column(Numeric(10, 2), nullable=True)  # Cap for percentage discounts

    # Usage limits
    max_uses = Column(Integer, nullable=True)  # None = unlimited
    max_uses_per_user = Column(Integer, default=1)
    used_count = Column(Integer, default=0)

    # Validity
    valid_from = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    valid_until = Column(DateTime, nullable=True)

    # User type restriction
    user_type_restriction = Column(
        Enum(UserType, native_enum=False, length=20),
        default=UserType.ALL
    )

    # Category restrictions (stored as comma-separated IDs)
    # e.g., "1,2,3" for categories 1, 2, 3
    applicable_categories = Column(String(200), nullable=True)
    excluded_categories = Column(String(200), nullable=True)

    # Product restrictions (stored as comma-separated IDs)
    applicable_products = Column(String(200), nullable=True)
    excluded_products = Column(String(200), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)

    # Abuse prevention
    one_per_customer = Column(Boolean, default=True)
    prevent_stackable = Column(Boolean, default=True)  # Cannot combine with other offers

    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @property
    def is_valid(self) -> bool:
        """Check if promotion is currently valid."""
        now = datetime.now(timezone.utc)

        # Check active status
        if not self.is_active:
            return False

        # Check date validity
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False

        # Check usage limit
        if self.max_uses and self.used_count >= self.max_uses:
            return False

        return True

    def calculate_discount(self, order_total: float) -> float:
        """Calculate discount amount for given order total."""
        if not self.is_valid:
            return 0.0

        # Check minimum order value
        if order_total < float(self.min_order_value):
            return 0.0

        if self.discount_type == DiscountType.PERCENTAGE:
            discount = order_total * (float(self.discount_value) / 100)
            # Apply max discount cap if set
            if self.max_discount_amount:
                discount = min(discount, float(self.max_discount_amount))
        else:  # FIXED
            discount = float(self.discount_value)

        # Discount cannot exceed order total
        return min(discount, order_total)
    
    def get_applicable_category_ids(self) -> list:
        """Get list of applicable category IDs."""
        if not self.applicable_categories:
            return []
        return [int(x.strip()) for x in self.applicable_categories.split(',') if x.strip()]
    
    def get_excluded_category_ids(self) -> list:
        """Get list of excluded category IDs."""
        if not self.excluded_categories:
            return []
        return [int(x.strip()) for x in self.excluded_categories.split(',') if x.strip()]
    
    def get_applicable_product_ids(self) -> list:
        """Get list of applicable product IDs."""
        if not self.applicable_products:
            return []
        return [int(x.strip()) for x in self.applicable_products.split(',') if x.strip()]
    
    def get_excluded_product_ids(self) -> list:
        """Get list of excluded product IDs."""
        if not self.excluded_products:
            return []
        return [int(x.strip()) for x in self.excluded_products.split(',') if x.strip()]


class PromotionUsage(Base):
    """Track promotion usage per user."""
    __tablename__ = "promotion_usage"
    
    id = Column(Integer, primary_key=True, index=True)
    promotion_id = Column(Integer, ForeignKey("promotions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, nullable=False, index=True)
    order_id = Column(Integer, nullable=True)  # Link to order if applicable
    discount_amount = Column(Numeric(10, 2), nullable=False)
    used_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
