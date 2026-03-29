"""Address schemas for commerce service."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from models.address import AddressType


class AddressBase(BaseModel):
    """Base address schema."""
    address_type: AddressType = AddressType.SHIPPING
    full_name: str
    phone: str
    email: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str = "India"
    is_default: bool = False


class AddressCreate(AddressBase):
    """Schema for creating an address."""
    pass


class AddressUpdate(BaseModel):
    """Schema for updating an address."""
    address_type: Optional[AddressType] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    is_default: Optional[bool] = None


class AddressResponse(AddressBase):
    """Schema for address response."""
    id: int
    user_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
