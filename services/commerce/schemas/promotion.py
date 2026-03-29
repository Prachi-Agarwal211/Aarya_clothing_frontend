"""Promotion schemas for commerce service."""
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal

from models.promotion import DiscountType


class PromotionBase(BaseModel):
    """Base promotion schema."""
    code: str
    description: Optional[str] = None
    discount_type: DiscountType
    discount_value: Decimal
    min_order_value: Decimal = Decimal('0')
    max_discount_amount: Optional[Decimal] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: bool = True
    
    @field_validator('code')
    @classmethod
    def code_uppercase(cls, v):
        """Convert code to uppercase."""
        return v.upper().strip()


class PromotionCreate(PromotionBase):
    """Schema for creating a promotion."""
    pass


class PromotionUpdate(BaseModel):
    """Schema for updating a promotion."""
    code: Optional[str] = None
    description: Optional[str] = None
    discount_type: Optional[DiscountType] = None
    discount_value: Optional[Decimal] = None
    min_order_value: Optional[Decimal] = None
    max_discount_amount: Optional[Decimal] = None
    max_uses: Optional[int] = None
    max_uses_per_user: Optional[int] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: Optional[bool] = None


class PromotionResponse(PromotionBase):
    """Schema for promotion response."""
    id: int
    used_count: int
    is_valid: bool
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class PromotionValidateRequest(BaseModel):
    """Schema for validating a promotion code."""
    code: str
    user_id: int
    order_total: Decimal


class PromotionValidateResponse(BaseModel):
    """Schema for promotion validation response."""
    valid: bool
    message: str
    promotion: Optional[PromotionResponse] = None
    discount_amount: Decimal = Decimal('0')
    final_total: Decimal = Decimal('0')
