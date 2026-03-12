"""Review service for managing product reviews."""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from fastapi import HTTPException, status

from models.review import Review
from models.product import Product
from models.order import Order, OrderItem


class ReviewService:
    """Service for review management operations."""
    
    def __init__(self, db: Session):
        """Initialize review service."""
        self.db = db
    
    def get_product_reviews(
        self,
        product_id: int,
        approved_only: bool = True,
        skip: int = 0,
        limit: int = 50
    ) -> List[Review]:
        """Get all reviews for a product."""
        query = self.db.query(Review).filter(Review.product_id == product_id)
        
        if approved_only:
            query = query.filter(Review.is_approved == True)
        
        return query.order_by(desc(Review.created_at)).offset(skip).limit(limit).all()
    
    def create_review(
        self,
        product_id: int,
        user_id: int,
        rating: int,
        title: Optional[str] = None,
        comment: Optional[str] = None,
        order_id: Optional[int] = None
    ) -> Review:
        """Create a product review."""
        # Validate product exists
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        
        # Validate rating
        if rating < 1 or rating > 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rating must be between 1 and 5"
            )
        
        # Check if user already reviewed this product
        existing = self.db.query(Review).filter(
            Review.product_id == product_id,
            Review.user_id == user_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already reviewed this product"
            )
        
        # Check verified purchase if order_id provided
        is_verified = False
        if order_id:
            order_item = self.db.query(OrderItem).join(Order).filter(
                Order.id == order_id,
                Order.user_id == user_id,
                OrderItem.product_id == product_id
            ).first()
            
            is_verified = order_item is not None
        
        review = Review(
            product_id=product_id,
            user_id=user_id,
            order_id=order_id,
            rating=rating,
            title=title,
            comment=comment,
            is_verified_purchase=is_verified,
            is_approved=False  # Requires moderation
        )
        
        self.db.add(review)
        self.db.commit()
        self.db.refresh(review)
        
        return review
    
    def approve_review(self, review_id: int) -> Review:
        """Approve a review (admin/staff)."""
        review = self.db.query(Review).filter(Review.id == review_id).first()
        
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        review.is_approved = True
        self.db.commit()
        self.db.refresh(review)
        
        return review
    
    def delete_review(self, review_id: int, user_id: Optional[int] = None) -> bool:
        """Delete a review."""
        query = self.db.query(Review).filter(Review.id == review_id)
        
        if user_id:
            query = query.filter(Review.user_id == user_id)
        
        review = query.first()
        
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        self.db.delete(review)
        self.db.commit()
        
        return True
    
    def mark_helpful(self, review_id: int) -> Review:
        """Increment helpful count."""
        review = self.db.query(Review).filter(Review.id == review_id).first()
        
        if not review:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Review not found"
            )
        
        review.helpful_count += 1
        self.db.commit()
        self.db.refresh(review)
        
        return review
