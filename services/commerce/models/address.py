"""Address models for commerce service."""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum
from database.database import Base


class AddressType(str, enum.Enum):
    """Address type enumeration."""
    SHIPPING = "shipping"
    BILLING = "billing"
    BOTH = "both"


class Address(Base):
    """Address model for multi-address support."""
    __tablename__ = "addresses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # FK to users in core service
    
    # Address type
    address_type = Column(
        Enum(
            AddressType,
            native_enum=False,
            length=20,
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        default=AddressType.SHIPPING,
        nullable=False
    )
    
    # Contact information
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(255), nullable=True)
    
    # Address details
    address_line1 = Column(String(255), nullable=False)
    address_line2 = Column(String(255), nullable=True)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    postal_code = Column(String(20), nullable=False)
    country = Column(String(100), nullable=False, default='India')
    
    # Flags
    is_default = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    def to_formatted_string(self) -> str:
        """Format address as string for shipping labels."""
        parts = [
            self.full_name,
            self.address_line1,
        ]
        if self.address_line2:
            parts.append(self.address_line2)
        parts.extend([
            f"{self.city}, {self.state} {self.postal_code}",
            self.country,
            f"Phone: {self.phone}"
        ])
        return "\n".join(parts)
