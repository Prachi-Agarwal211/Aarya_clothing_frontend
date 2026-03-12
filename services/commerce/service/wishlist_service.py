"""Wishlist service for managing user wishlists."""
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from models.wishlist import Wishlist
from models.product import Product


class WishlistService:
    """Service for wishlist management operations."""
    
    def __init__(self, db: Session):
        """Initialize wishlist service."""
        self.db = db
    
    def get_user_wishlist(self, user_id: int) -> List[Wishlist]:
        """Get all wishlist items for a user."""
        return self.db.query(Wishlist).filter(
            Wishlist.user_id == user_id
        ).all()
    
    def add_to_wishlist(self, user_id: int, product_id: int) -> Wishlist:
        """Add product to user's wishlist."""
        # Validate product exists and is active
        product = self.db.query(Product).filter(
            Product.id == product_id,
            Product.is_active == True
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not found"
            )
        
        # Check if already in wishlist
        existing = self.db.query(Wishlist).filter(
            Wishlist.user_id == user_id,
            Wishlist.product_id == product_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Product already in wishlist"
            )
        
        # Add to wishlist
        wishlist_item = Wishlist(
            user_id=user_id,
            product_id=product_id
        )
        
        self.db.add(wishlist_item)
        self.db.commit()
        self.db.refresh(wishlist_item)
        
        return wishlist_item
    
    def remove_from_wishlist(self, user_id: int, product_id: int) -> bool:
        """Remove product from user's wishlist."""
        wishlist_item = self.db.query(Wishlist).filter(
            Wishlist.user_id == user_id,
            Wishlist.product_id == product_id
        ).first()
        
        if not wishlist_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Product not in wishlist"
            )
        
        self.db.delete(wishlist_item)
        self.db.commit()
        
        return True
    
    def clear_wishlist(self, user_id: int) -> bool:
        """Clear all items from user's wishlist."""
        self.db.query(Wishlist).filter(
            Wishlist.user_id == user_id
        ).delete()
        
        self.db.commit()
        
        return True
    
    def is_in_wishlist(self, user_id: int, product_id: int) -> bool:
        """Check if product is in user's wishlist."""
        exists = self.db.query(Wishlist).filter(
            Wishlist.user_id == user_id,
            Wishlist.product_id == product_id
        ).first()
        
        return exists is not None
