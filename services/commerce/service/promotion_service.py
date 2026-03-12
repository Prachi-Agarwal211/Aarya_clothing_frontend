"""Promotion service for managing promotional codes."""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from fastapi import HTTPException, status
from decimal import Decimal
from datetime import datetime, timezone

from models.promotion import Promotion, PromotionUsage, DiscountType
from schemas.promotion import PromotionCreate, PromotionUpdate


class PromotionService:
    """Service for promotion/coupon management operations."""
    
    def __init__(self, db: Session):
        """Initialize promotion service."""
        self.db = db
    
    def get_all_promotions(self, active_only: bool = False) -> List[Promotion]:
        """Get all promotions."""
        query = self.db.query(Promotion)
        
        if active_only:
            query = query.filter(Promotion.is_active == True)
        
        return query.order_by(Promotion.created_at.desc()).all()
    
    def get_promotion_by_code(self, code: str) -> Optional[Promotion]:
        """Get promotion by code."""
        return self.db.query(Promotion).filter(
            Promotion.code == code.upper()
        ).first()
    
    def create_promotion(self, promotion_data: PromotionCreate) -> Promotion:
        """Create a new promotion."""
        # Check if code already exists
        existing = self.get_promotion_by_code(promotion_data.code)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Promotion code '{promotion_data.code}' already exists"
            )
        
        promotion = Promotion(**promotion_data.model_dump())
        self.db.add(promotion)
        self.db.commit()
        self.db.refresh(promotion)
        
        return promotion
    
    def update_promotion(self, promotion_id: int, promotion_data: PromotionUpdate) -> Promotion:
        """Update a promotion."""
        promotion = self.db.query(Promotion).filter(Promotion.id == promotion_id).first()
        
        if not promotion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Promotion not found"
            )
        
        # Check code uniqueness if updating
        if promotion_data.code and promotion_data.code != promotion.code:
            existing = self.get_promotion_by_code(promotion_data.code)
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Promotion code '{promotion_data.code}' already exists"
                )
        
        update_data = promotion_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(promotion, field, value)
        
        promotion.updated_at = datetime.now(timezone.utc)
        self.db.commit()
        self.db.refresh(promotion)
        
        return promotion
    
    def delete_promotion(self, promotion_id: int) -> bool:
        """Delete a promotion."""
        promotion = self.db.query(Promotion).filter(Promotion.id == promotion_id).first()
        
        if not promotion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Promotion not found"
            )
        
        self.db.delete(promotion)
        self.db.commit()
        
        return True
    
    def validate_promotion(
        self, 
        code: str, 
        user_id: int, 
        order_total: Decimal
    ) -> dict:
        """
        Validate promotion code and calculate discount.
        
        Returns dict with validation result and discount details.
        """
        promotion = self.get_promotion_by_code(code)
        
        if not promotion:
            return {
                "valid": False,
                "message": "Invalid promotion code",
                "discount_amount": Decimal('0'),
                "final_total": order_total
            }
        
        # Check if promotion is valid
        if not promotion.is_valid:
            if not promotion.is_active:
                message = "Promotion code is inactive"
            elif promotion.valid_from and datetime.now(timezone.utc) < promotion.valid_from:
                message = "Promotion code is not yet valid"
            elif promotion.valid_until and datetime.now(timezone.utc) > promotion.valid_until:
                message = "Promotion code has expired"
            elif promotion.max_uses and promotion.used_count >= promotion.max_uses:
                message = "Promotion code has reached its usage limit"
            else:
                message = "Promotion code is invalid"
            
            return {
                "valid": False,
                "message": message,
                "discount_amount": Decimal('0'),
                "final_total": order_total
            }
        
        # Check user usage limit
        user_usage_count = self.db.query(PromotionUsage).filter(
            PromotionUsage.promotion_id == promotion.id,
            PromotionUsage.user_id == user_id
        ).count()
        
        if user_usage_count >= promotion.max_uses_per_user:
            return {
                "valid": False,
                "message": "You have already used this promotion code",
                "discount_amount": Decimal('0'),
                "final_total": order_total
            }
        
        # Calculate discount
        discount_amount = Decimal(str(promotion.calculate_discount(float(order_total))))
        final_total = max(Decimal('0'), order_total - discount_amount)
        
        return {
            "valid": True,
            "message": "Promotion code applied successfully",
            "promotion": promotion,
            "discount_amount": discount_amount,
            "final_total": final_total
        }
    
    def record_usage(
        self, 
        promotion_id: int, 
        user_id: int, 
        discount_amount: Decimal,
        order_id: Optional[int] = None
    ) -> PromotionUsage:
        """Record promotion usage."""
        promotion = self.db.query(Promotion).filter(Promotion.id == promotion_id).first()
        
        if not promotion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Promotion not found"
            )
        
        # Create usage record
        usage = PromotionUsage(
            promotion_id=promotion_id,
            user_id=user_id,
            order_id=order_id,
            discount_amount=discount_amount
        )
        
        # Increment used count
        promotion.used_count += 1
        
        self.db.add(usage)
        self.db.commit()
        self.db.refresh(usage)
        
        return usage
